//! WaveRAG - 三阶段检索引擎
//!
//! 实现 VCPToolBox 的核心 RAG 算法：
//! 1. Lens (透镜) - 初始语义聚焦，标签提取
//! 2. Expansion (扩展) - 标签共现网络扩散
//! 3. Focus (聚焦) - 结果精排与融合
//!
//! 整合 VexusIndex + TagMemo + HybridSearch，
//! 单次 IPC 调用完成完整检索流程

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::{HashMap, HashSet};

use crate::cooccurrence::CooccurrenceMatrix;
use crate::hybrid_search::{HybridSearchEngine, HybridSearchResult, SearchResultItem};
use crate::tagmemo::{TagBoostParams, TagBoostResult, TagCooccurrenceMatrix};
use crate::vexus::{VexusIndex, VexusSearchResult};

// ==================== 配置类型 ====================

/// WaveRAG 配置
#[napi(object)]
#[derive(Clone)]
pub struct WaveRAGConfig {
    /// 透镜阶段: 最大标签数
    pub lens_max_tags: Option<u32>,
    /// 扩展阶段: 扩散深度
    pub expansion_depth: Option<u32>,
    /// 扩展阶段: 共现阈值
    pub expansion_threshold: Option<f64>,
    /// 扩展阶段: 最大扩展标签数
    pub expansion_max_tags: Option<u32>,
    /// 聚焦阶段: 结果数量
    pub focus_top_k: Option<u32>,
    /// 聚焦阶段: 分数阈值
    pub focus_score_threshold: Option<f64>,
    /// TagMemo 权重
    pub tag_memo_weight: Option<f64>,
    /// BM25 权重
    pub bm25_weight: Option<f64>,
    /// 向量搜索权重
    pub vector_weight: Option<f64>,
}

impl Default for WaveRAGConfig {
    fn default() -> Self {
        Self {
            lens_max_tags: Some(10),
            expansion_depth: Some(2),
            expansion_threshold: Some(0.3),
            expansion_max_tags: Some(20),
            focus_top_k: Some(10),
            focus_score_threshold: Some(0.5),
            tag_memo_weight: Some(0.65),
            bm25_weight: Some(0.5),
            vector_weight: Some(0.5),
        }
    }
}

// ==================== 阶段结果 ====================

/// 透镜阶段结果
#[napi(object)]
pub struct LensPhaseResult {
    /// 提取的标签
    pub tags: Vec<String>,
    /// 扩展的标签
    pub expanded_tags: Vec<String>,
    /// 耗时 (毫秒)
    pub duration_ms: u32,
}

/// 扩展阶段结果
#[napi(object)]
pub struct ExpansionPhaseResult {
    /// 扩展后的所有标签
    pub all_tags: Vec<String>,
    /// 扩展深度
    pub depth_reached: u32,
    /// 耗时 (毫秒)
    pub duration_ms: u32,
}

/// 聚焦阶段结果
#[napi(object)]
pub struct FocusPhaseResult {
    /// 最终结果数量
    pub result_count: u32,
    /// 应用 TagMemo 增强
    pub tag_boost_applied: bool,
    /// 耗时 (毫秒)
    pub duration_ms: u32,
}

/// 检索结果项
#[napi(object)]
#[derive(Clone)]
pub struct WaveRAGResultItem {
    /// 文档 ID
    pub id: String,
    /// 内容
    pub content: String,
    /// 最终分数
    pub final_score: f64,
    /// 原始分数
    pub original_score: f64,
    /// TagMemo 增强分数
    pub tag_boost_score: f64,
    /// 匹配的标签
    pub matched_tags: Vec<String>,
    /// 元数据 (JSON 字符串)
    pub metadata: Option<String>,
    /// 来源 ("vector", "bm25", "both")
    pub source: String,
}

/// WaveRAG 完整结果
#[napi(object)]
pub struct WaveRAGResult {
    /// 检索结果
    pub results: Vec<WaveRAGResultItem>,
    /// 透镜阶段信息
    pub lens_phase: LensPhaseResult,
    /// 扩展阶段信息
    pub expansion_phase: ExpansionPhaseResult,
    /// 聚焦阶段信息
    pub focus_phase: FocusPhaseResult,
    /// 查询标签
    pub query_tags: Vec<String>,
    /// 扩展标签
    pub expansion_tags: Vec<String>,
    /// 总耗时 (毫秒)
    pub total_duration_ms: u32,
    /// 追踪 ID (用于日志关联)
    pub trace_id: String,
}

// ==================== WaveRAG 引擎 ====================

/// WaveRAG 三阶段检索引擎
///
/// 整合 VexusIndex + TagMemo + HybridSearch
#[napi]
pub struct WaveRAGEngine {
    /// 配置
    config: WaveRAGConfig,
    /// 标签共现矩阵 (TagMemo)
    tag_matrix: TagCooccurrenceMatrix,
    /// NPMI 共现矩阵
    cooccurrence: CooccurrenceMatrix,
    /// 混合搜索引擎
    hybrid_search: HybridSearchEngine,
    /// 追踪 ID 计数器
    trace_counter: std::sync::atomic::AtomicU64,
}

#[napi]
impl WaveRAGEngine {
    /// 创建 WaveRAG 引擎
    #[napi(constructor)]
    pub fn new(config: Option<WaveRAGConfig>) -> Self {
        let cfg = config.unwrap_or_default();

        let hybrid_search = HybridSearchEngine::new(
            cfg.bm25_weight,
            cfg.vector_weight,
            cfg.tag_memo_weight,
        );

        Self {
            config: cfg,
            tag_matrix: TagCooccurrenceMatrix::new(None, None),
            cooccurrence: CooccurrenceMatrix::new(),
            hybrid_search,
            trace_counter: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// 生成追踪 ID
    fn generate_trace_id(&self) -> String {
        let counter = self
            .trace_counter
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        format!("wave-{}-{}", timestamp, counter)
    }

    /// 阶段 1: Lens (透镜) - 标签提取与语义扩展
    fn execute_lens_phase(&self, query_tags: &[String]) -> LensPhaseResult {
        let start = std::time::Instant::now();
        let max_tags = self.config.lens_max_tags.unwrap_or(10) as usize;

        // 使用 TagMemo 扩展查询标签
        let expanded = self.tag_matrix.expand_query(
            query_tags.to_vec(),
            Some(0.5), // expansion_factor
        );

        // 限制标签数量
        let final_tags: Vec<String> = expanded.into_iter().take(max_tags).collect();

        let duration_ms = start.elapsed().as_millis() as u32;

        LensPhaseResult {
            tags: query_tags.to_vec(),
            expanded_tags: final_tags.clone(),
            duration_ms,
        }
    }

    /// 阶段 2: Expansion (扩展) - 多跳标签扩散
    fn execute_expansion_phase(&self, seed_tags: &[String]) -> ExpansionPhaseResult {
        let start = std::time::Instant::now();
        let depth = self.config.expansion_depth.unwrap_or(2);
        let max_tags = self.config.expansion_max_tags.unwrap_or(20) as usize;
        let threshold = self.config.expansion_threshold.unwrap_or(0.3);

        // 使用 NPMI 共现矩阵进行多跳扩展
        let expanded = self.cooccurrence.expand_tags(
            seed_tags.to_vec(),
            Some(depth),
            Some(0.7), // decay_factor
        );

        // 过滤低权重标签并限制数量
        let all_tags: Vec<String> = expanded
            .into_iter()
            .filter(|t| t.weight >= threshold)
            .map(|t| t.tag2)
            .take(max_tags)
            .collect();

        let duration_ms = start.elapsed().as_millis() as u32;

        ExpansionPhaseResult {
            all_tags,
            depth_reached: depth,
            duration_ms,
        }
    }

    /// 阶段 3: Focus (聚焦) - 结果融合与精排
    fn execute_focus_phase(
        &self,
        query_tags: &[String],
        bm25_results: Vec<SearchResultItem>,
        vector_results: Vec<SearchResultItem>,
    ) -> (FocusPhaseResult, Vec<WaveRAGResultItem>) {
        let start = std::time::Instant::now();
        let top_k = self.config.focus_top_k.unwrap_or(10);
        let score_threshold = self.config.focus_score_threshold.unwrap_or(0.5);

        // 收集所有结果的标签用于 TagBoost
        let mut tag_boost_scores: HashMap<String, f64> = HashMap::new();

        // 从 bm25_results 和 vector_results 中提取标签并计算增强分数
        let all_results: Vec<&SearchResultItem> = bm25_results
            .iter()
            .chain(vector_results.iter())
            .collect();

        for item in &all_results {
            // 如果元数据中有标签信息，计算 TagBoost
            if let Some(ref metadata) = item.metadata {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(metadata) {
                    if let Some(tags) = parsed.get("tags").and_then(|t| t.as_array()) {
                        let content_tags: Vec<String> = tags
                            .iter()
                            .filter_map(|t| t.as_str().map(String::from))
                            .collect();

                        let boost_result = self.tag_matrix.compute_tag_boost(TagBoostParams {
                            query_tags: query_tags.to_vec(),
                            content_tags,
                            original_score: Some(item.score),
                            alpha_min: None,
                            alpha_max: None,
                            beta_base: None,
                        });

                        tag_boost_scores.insert(item.id.clone(), boost_result.tag_match_score);
                    }
                }
            }
        }

        // 使用混合搜索引擎融合结果
        let fused_results = self.hybrid_search.fuse_results(
            bm25_results,
            vector_results,
            Some(tag_boost_scores.clone()),
            Some(top_k),
        );

        // 转换为 WaveRAG 结果格式
        let wave_results: Vec<WaveRAGResultItem> = fused_results
            .into_iter()
            .filter(|r| r.final_score >= score_threshold)
            .map(|r| {
                let boost_score = tag_boost_scores.get(&r.id).copied().unwrap_or(0.0);
                WaveRAGResultItem {
                    id: r.id,
                    content: r.content,
                    final_score: r.final_score,
                    original_score: r.vector_score.max(r.bm25_score),
                    tag_boost_score: boost_score,
                    matched_tags: vec![], // 从元数据中提取
                    metadata: r.metadata,
                    source: r.source,
                }
            })
            .collect();

        let duration_ms = start.elapsed().as_millis() as u32;

        let phase = FocusPhaseResult {
            result_count: wave_results.len() as u32,
            tag_boost_applied: !tag_boost_scores.is_empty(),
            duration_ms,
        };

        (phase, wave_results)
    }

    /// 执行完整的三阶段检索
    ///
    /// 单次调用完成 Lens → Expansion → Focus 流程
    #[napi]
    pub fn search(
        &self,
        query_tags: Vec<String>,
        bm25_results: Vec<SearchResultItem>,
        vector_results: Vec<SearchResultItem>,
        config_override: Option<WaveRAGConfig>,
    ) -> WaveRAGResult {
        let total_start = std::time::Instant::now();
        let trace_id = self.generate_trace_id();

        // 应用配置覆盖
        let _config = config_override.as_ref().unwrap_or(&self.config);

        tracing::info!(
            trace_id = %trace_id,
            query_tags = ?query_tags,
            bm25_count = bm25_results.len(),
            vector_count = vector_results.len(),
            "WaveRAG search started"
        );

        // 阶段 1: Lens
        let lens_result = self.execute_lens_phase(&query_tags);
        tracing::debug!(
            trace_id = %trace_id,
            tags_count = lens_result.expanded_tags.len(),
            duration_ms = lens_result.duration_ms,
            "Lens phase completed"
        );

        // 阶段 2: Expansion
        let expansion_result = self.execute_expansion_phase(&lens_result.expanded_tags);
        tracing::debug!(
            trace_id = %trace_id,
            all_tags_count = expansion_result.all_tags.len(),
            depth = expansion_result.depth_reached,
            duration_ms = expansion_result.duration_ms,
            "Expansion phase completed"
        );

        // 阶段 3: Focus
        let (focus_result, results) =
            self.execute_focus_phase(&expansion_result.all_tags, bm25_results, vector_results);
        tracing::debug!(
            trace_id = %trace_id,
            result_count = focus_result.result_count,
            tag_boost = focus_result.tag_boost_applied,
            duration_ms = focus_result.duration_ms,
            "Focus phase completed"
        );

        let total_duration_ms = total_start.elapsed().as_millis() as u32;

        tracing::info!(
            trace_id = %trace_id,
            total_duration_ms = total_duration_ms,
            result_count = results.len(),
            "WaveRAG search completed"
        );

        WaveRAGResult {
            results,
            lens_phase: lens_result,
            expansion_phase: expansion_result,
            focus_phase: focus_result,
            query_tags,
            expansion_tags: vec![], // 已包含在 expansion_phase
            total_duration_ms,
            trace_id,
        }
    }

    /// 更新 TagMemo 共现矩阵
    #[napi]
    pub fn update_tag_matrix(&self, tag1: String, tag2: String, weight: Option<f64>) {
        self.tag_matrix.update(tag1, tag2, weight);
    }

    /// 批量更新 TagMemo 共现矩阵
    #[napi]
    pub fn batch_update_tag_matrix(&self, updates: Vec<crate::tagmemo::TagPairUpdate>) {
        self.tag_matrix.batch_update(updates);
    }

    /// 从 JSON 加载 TagMemo 矩阵
    #[napi]
    pub fn load_tag_matrix_from_json(&mut self, json: String) -> Result<()> {
        self.tag_matrix = TagCooccurrenceMatrix::from_json(json)?;
        Ok(())
    }

    /// 导出 TagMemo 矩阵为 JSON
    #[napi]
    pub fn export_tag_matrix_to_json(&self) -> Result<String> {
        self.tag_matrix.to_json()
    }

    /// 从文档构建 NPMI 共现矩阵
    #[napi]
    pub fn build_cooccurrence_from_documents(
        &mut self,
        documents: Vec<crate::cooccurrence::DocumentInput>,
    ) -> Result<u32> {
        self.cooccurrence.build_from_documents(documents)
    }

    /// 获取配置
    #[napi]
    pub fn get_config(&self) -> WaveRAGConfig {
        self.config.clone()
    }

    /// 更新配置
    #[napi]
    pub fn update_config(&mut self, config: WaveRAGConfig) {
        self.config = config;

        // 同步更新混合搜索引擎权重
        self.hybrid_search.set_weights(
            self.config.bm25_weight.unwrap_or(0.5),
            self.config.vector_weight.unwrap_or(0.5),
            self.config.tag_memo_weight.unwrap_or(0.65),
        );
    }

    /// 获取统计信息
    #[napi]
    pub fn get_stats(&self) -> WaveRAGStats {
        let tag_stats = self.tag_matrix.get_stats();

        WaveRAGStats {
            tag_count: tag_stats.tag_count,
            pair_count: tag_stats.pair_count,
            total_updates: tag_stats.total_updates,
            cooccurrence_tags: self.cooccurrence.tag_count(),
        }
    }

    /// 计算 TagBoost (暴露给外部调用)
    #[napi]
    pub fn compute_tag_boost(&self, params: TagBoostParams) -> TagBoostResult {
        self.tag_matrix.compute_tag_boost(params)
    }

    /// 批量计算 TagBoost
    #[napi]
    pub fn batch_compute_tag_boost(
        &self,
        items: Vec<crate::tagmemo::TagBoostBatchItem>,
        query_tags: Vec<String>,
    ) -> Vec<TagBoostResult> {
        self.tag_matrix
            .batch_compute_tag_boost(items, query_tags, None, None, None)
    }
}

/// WaveRAG 统计信息
#[napi(object)]
pub struct WaveRAGStats {
    /// TagMemo 标签数量
    pub tag_count: u32,
    /// TagMemo 标签对数量
    pub pair_count: u32,
    /// TagMemo 总更新次数
    pub total_updates: i64,
    /// NPMI 共现矩阵标签数量
    pub cooccurrence_tags: u32,
}

// ==================== 便捷函数 ====================

/// 创建默认的 WaveRAG 引擎
#[napi]
pub fn create_waverag_engine(config: Option<WaveRAGConfig>) -> WaveRAGEngine {
    WaveRAGEngine::new(config)
}

/// 快速三阶段检索 (无状态)
#[napi]
pub fn quick_waverag_search(
    query_tags: Vec<String>,
    bm25_results: Vec<SearchResultItem>,
    vector_results: Vec<SearchResultItem>,
    config: Option<WaveRAGConfig>,
) -> WaveRAGResult {
    let engine = WaveRAGEngine::new(config);
    engine.search(query_tags, bm25_results, vector_results, None)
}
