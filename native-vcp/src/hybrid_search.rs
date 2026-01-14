//! 混合搜索模块
//!
//! 提供 BM25 + 向量搜索的融合搜索能力：
//! - Reciprocal Rank Fusion (RRF) 分数融合
//! - 可配置的权重比例
//! - TagMemo 增强支持

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;

/// 混合搜索引擎
///
/// 融合 BM25 全文搜索和向量相似度搜索的结果
#[napi]
pub struct HybridSearchEngine {
    /// BM25 权重
    bm25_weight: f64,
    /// 向量搜索权重
    vector_weight: f64,
    /// TagMemo 增强权重
    tag_boost_weight: f64,
    /// RRF 常数 k (默认 60)
    rrf_k: f64,
}

#[napi]
impl HybridSearchEngine {
    /// 创建混合搜索引擎
    ///
    /// @param bm25_weight - BM25 权重 (默认 0.5)
    /// @param vector_weight - 向量搜索权重 (默认 0.5)
    /// @param tag_boost_weight - TagMemo 增强权重 (默认 0.2)
    #[napi(constructor)]
    pub fn new(
        bm25_weight: Option<f64>,
        vector_weight: Option<f64>,
        tag_boost_weight: Option<f64>,
    ) -> Self {
        Self {
            bm25_weight: bm25_weight.unwrap_or(0.5),
            vector_weight: vector_weight.unwrap_or(0.5),
            tag_boost_weight: tag_boost_weight.unwrap_or(0.2),
            rrf_k: 60.0,
        }
    }

    /// 设置 RRF 常数 k
    #[napi]
    pub fn set_rrf_k(&mut self, k: f64) {
        self.rrf_k = k;
    }

    /// 设置权重
    #[napi]
    pub fn set_weights(&mut self, bm25: f64, vector: f64, tag_boost: f64) {
        self.bm25_weight = bm25;
        self.vector_weight = vector;
        self.tag_boost_weight = tag_boost;
    }

    /// 融合搜索结果
    ///
    /// 使用 Reciprocal Rank Fusion (RRF) 算法融合多个搜索结果列表
    ///
    /// @param bm25_results - BM25 搜索结果 (按相关性排序)
    /// @param vector_results - 向量搜索结果 (按相似度排序)
    /// @param tag_boost_scores - TagMemo 增强分数 (可选，id -> score)
    /// @param limit - 返回结果数量限制
    #[napi]
    pub fn fuse_results(
        &self,
        bm25_results: Vec<SearchResultItem>,
        vector_results: Vec<SearchResultItem>,
        tag_boost_scores: Option<HashMap<String, f64>>,
        limit: Option<u32>,
    ) -> Vec<HybridSearchResult> {
        let limit = limit.unwrap_or(20) as usize;
        let tag_scores = tag_boost_scores.unwrap_or_default();

        // 计算 RRF 分数
        let mut scores: HashMap<String, HybridScoreBuilder> = HashMap::new();

        // 处理 BM25 结果
        for (rank, item) in bm25_results.iter().enumerate() {
            let rrf_score = 1.0 / (self.rrf_k + rank as f64 + 1.0);
            let entry = scores.entry(item.id.clone()).or_insert_with(|| {
                HybridScoreBuilder::new(item.id.clone(), item.content.clone(), item.metadata.clone())
            });
            entry.bm25_score = item.score;
            entry.bm25_rank = Some(rank as u32);
            entry.bm25_rrf = rrf_score * self.bm25_weight;
        }

        // 处理向量搜索结果
        for (rank, item) in vector_results.iter().enumerate() {
            let rrf_score = 1.0 / (self.rrf_k + rank as f64 + 1.0);
            let entry = scores.entry(item.id.clone()).or_insert_with(|| {
                HybridScoreBuilder::new(item.id.clone(), item.content.clone(), item.metadata.clone())
            });
            entry.vector_score = item.score;
            entry.vector_rank = Some(rank as u32);
            entry.vector_rrf = rrf_score * self.vector_weight;
        }

        // 应用 TagMemo 增强
        for (id, boost) in &tag_scores {
            if let Some(entry) = scores.get_mut(id) {
                entry.tag_boost_score = *boost;
            }
        }

        // 计算最终分数并排序
        let mut results: Vec<HybridSearchResult> = scores
            .into_values()
            .map(|builder| builder.build(self.tag_boost_weight))
            .collect();

        results.sort_by(|a, b| {
            b.final_score
                .partial_cmp(&a.final_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results.truncate(limit);
        results
    }

    /// 简单加权融合
    ///
    /// 直接使用分数加权平均，适用于已归一化的分数
    #[napi]
    pub fn weighted_fusion(
        &self,
        bm25_results: Vec<SearchResultItem>,
        vector_results: Vec<SearchResultItem>,
        limit: Option<u32>,
    ) -> Vec<HybridSearchResult> {
        let limit = limit.unwrap_or(20) as usize;
        let mut scores: HashMap<String, HybridScoreBuilder> = HashMap::new();

        // 处理 BM25 结果
        for (rank, item) in bm25_results.iter().enumerate() {
            let entry = scores.entry(item.id.clone()).or_insert_with(|| {
                HybridScoreBuilder::new(item.id.clone(), item.content.clone(), item.metadata.clone())
            });
            entry.bm25_score = item.score;
            entry.bm25_rank = Some(rank as u32);
            entry.bm25_rrf = item.score * self.bm25_weight;
        }

        // 处理向量搜索结果
        for (rank, item) in vector_results.iter().enumerate() {
            let entry = scores.entry(item.id.clone()).or_insert_with(|| {
                HybridScoreBuilder::new(item.id.clone(), item.content.clone(), item.metadata.clone())
            });
            entry.vector_score = item.score;
            entry.vector_rank = Some(rank as u32);
            entry.vector_rrf = item.score * self.vector_weight;
        }

        // 计算最终分数
        let mut results: Vec<HybridSearchResult> = scores
            .into_values()
            .map(|builder| builder.build(0.0))
            .collect();

        results.sort_by(|a, b| {
            b.final_score
                .partial_cmp(&a.final_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results.truncate(limit);
        results
    }

    /// 获取配置
    #[napi]
    pub fn get_config(&self) -> HybridSearchConfig {
        HybridSearchConfig {
            bm25_weight: self.bm25_weight,
            vector_weight: self.vector_weight,
            tag_boost_weight: self.tag_boost_weight,
            rrf_k: self.rrf_k,
        }
    }

    /// 归一化分数到 [0, 1] 区间
    #[napi]
    pub fn normalize_scores(&self, results: Vec<SearchResultItem>) -> Vec<SearchResultItem> {
        if results.is_empty() {
            return results;
        }

        let max_score = results
            .iter()
            .map(|r| r.score)
            .fold(f64::NEG_INFINITY, f64::max);
        let min_score = results
            .iter()
            .map(|r| r.score)
            .fold(f64::INFINITY, f64::min);

        let range = max_score - min_score;
        if range < 1e-9 {
            // 所有分数相同
            return results
                .into_iter()
                .map(|mut r| {
                    r.score = 1.0;
                    r
                })
                .collect();
        }

        results
            .into_iter()
            .map(|mut r| {
                r.score = (r.score - min_score) / range;
                r
            })
            .collect()
    }
}

/// 分数构建器 (内部使用)
struct HybridScoreBuilder {
    id: String,
    content: String,
    metadata: Option<String>,
    bm25_score: f64,
    bm25_rank: Option<u32>,
    bm25_rrf: f64,
    vector_score: f64,
    vector_rank: Option<u32>,
    vector_rrf: f64,
    tag_boost_score: f64,
}

impl HybridScoreBuilder {
    fn new(id: String, content: String, metadata: Option<String>) -> Self {
        Self {
            id,
            content,
            metadata,
            bm25_score: 0.0,
            bm25_rank: None,
            bm25_rrf: 0.0,
            vector_score: 0.0,
            vector_rank: None,
            vector_rrf: 0.0,
            tag_boost_score: 0.0,
        }
    }

    fn build(self, tag_boost_weight: f64) -> HybridSearchResult {
        let base_score = self.bm25_rrf + self.vector_rrf;
        let tag_boost = self.tag_boost_score * tag_boost_weight;
        let final_score = base_score * (1.0 + tag_boost);

        HybridSearchResult {
            id: self.id,
            content: self.content,
            metadata: self.metadata,
            final_score,
            bm25_score: self.bm25_score,
            bm25_rank: self.bm25_rank,
            vector_score: self.vector_score,
            vector_rank: self.vector_rank,
            tag_boost_score: self.tag_boost_score,
            source: if self.bm25_rank.is_some() && self.vector_rank.is_some() {
                "both".to_string()
            } else if self.bm25_rank.is_some() {
                "bm25".to_string()
            } else {
                "vector".to_string()
            },
        }
    }
}

// ==================== 数据类型 ====================

/// 搜索结果项 (输入)
#[napi(object)]
#[derive(Clone)]
pub struct SearchResultItem {
    /// 文档 ID
    pub id: String,
    /// 文档内容
    pub content: String,
    /// 元数据 (JSON 字符串)
    pub metadata: Option<String>,
    /// 分数
    pub score: f64,
}

/// 混合搜索结果
#[napi(object)]
pub struct HybridSearchResult {
    /// 文档 ID
    pub id: String,
    /// 文档内容
    pub content: String,
    /// 元数据 (JSON 字符串)
    pub metadata: Option<String>,
    /// 最终融合分数
    pub final_score: f64,
    /// BM25 原始分数
    pub bm25_score: f64,
    /// BM25 排名
    pub bm25_rank: Option<u32>,
    /// 向量搜索原始分数
    pub vector_score: f64,
    /// 向量搜索排名
    pub vector_rank: Option<u32>,
    /// TagMemo 增强分数
    pub tag_boost_score: f64,
    /// 来源 ("bm25", "vector", "both")
    pub source: String,
}

/// 混合搜索配置
#[napi(object)]
pub struct HybridSearchConfig {
    pub bm25_weight: f64,
    pub vector_weight: f64,
    pub tag_boost_weight: f64,
    pub rrf_k: f64,
}

// ==================== 便捷函数 ====================

/// 快速 RRF 融合
#[napi]
pub fn quick_rrf_fusion(
    bm25_results: Vec<SearchResultItem>,
    vector_results: Vec<SearchResultItem>,
    limit: Option<u32>,
) -> Vec<HybridSearchResult> {
    let engine = HybridSearchEngine::new(None, None, None);
    engine.fuse_results(bm25_results, vector_results, None, limit)
}

/// 计算 RRF 分数
#[napi]
pub fn compute_rrf_score(rank: u32, k: Option<f64>) -> f64 {
    let k = k.unwrap_or(60.0);
    1.0 / (k + rank as f64 + 1.0)
}

/// 融合多个结果列表 (通用版本)
#[napi]
pub fn multi_source_fusion(
    result_lists: Vec<Vec<SearchResultItem>>,
    weights: Vec<f64>,
    k: Option<f64>,
    limit: Option<u32>,
) -> Vec<HybridSearchResult> {
    let k = k.unwrap_or(60.0);
    let limit = limit.unwrap_or(20) as usize;

    // 确保权重数量匹配
    let weights: Vec<f64> = if weights.len() != result_lists.len() {
        vec![1.0 / result_lists.len() as f64; result_lists.len()]
    } else {
        weights
    };

    let mut scores: HashMap<String, (String, Option<String>, f64)> = HashMap::new();

    for (list_idx, list) in result_lists.iter().enumerate() {
        let weight = weights.get(list_idx).copied().unwrap_or(1.0);

        for (rank, item) in list.iter().enumerate() {
            let rrf_score = weight / (k + rank as f64 + 1.0);

            let entry = scores.entry(item.id.clone()).or_insert_with(|| {
                (item.content.clone(), item.metadata.clone(), 0.0)
            });
            entry.2 += rrf_score;
        }
    }

    let mut results: Vec<HybridSearchResult> = scores
        .into_iter()
        .map(|(id, (content, metadata, score))| HybridSearchResult {
            id,
            content,
            metadata,
            final_score: score,
            bm25_score: 0.0,
            bm25_rank: None,
            vector_score: 0.0,
            vector_rank: None,
            tag_boost_score: 0.0,
            source: "multi".to_string(),
        })
        .collect();

    results.sort_by(|a, b| {
        b.final_score
            .partial_cmp(&a.final_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    results.truncate(limit);
    results
}
