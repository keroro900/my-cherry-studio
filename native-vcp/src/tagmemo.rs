//! TagMemo - 标签共现矩阵
//!
//! 实现 VCPToolBox 的核心标签增强算法：
//! - Alpha/Beta 动态权重
//! - PMI (点互信息) 计算
//! - 指数增强
//! - 噪声降低

use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

/// 标签共现矩阵
#[napi]
pub struct TagCooccurrenceMatrix {
    inner: Arc<RwLock<TagMatrixInner>>,
}

struct TagMatrixInner {
    /// Alpha 参数（新共现权重）
    alpha: f64,
    /// Beta 参数（衰减因子）
    beta: f64,
    /// 共现计数 tag1 -> tag2 -> count
    cooccurrence: HashMap<String, HashMap<String, f64>>,
    /// 单标签频率
    frequencies: HashMap<String, f64>,
    /// 总计数
    total_count: f64,
    /// 最小 PMI 阈值
    min_pmi_threshold: f64,
}

#[napi]
impl TagCooccurrenceMatrix {
    /// 创建新的标签共现矩阵
    #[napi(constructor)]
    pub fn new(alpha: Option<f64>, beta: Option<f64>) -> Self {
        let inner = TagMatrixInner {
            alpha: alpha.unwrap_or(0.8),
            beta: beta.unwrap_or(0.2),
            cooccurrence: HashMap::new(),
            frequencies: HashMap::new(),
            total_count: 0.0,
            min_pmi_threshold: 0.0,
        };

        Self {
            inner: Arc::new(RwLock::new(inner)),
        }
    }

    /// 更新共现
    #[napi]
    pub fn update(&self, tag1: String, tag2: String, weight: Option<f64>) {
        let weight = weight.unwrap_or(1.0);
        let mut inner = self.inner.write();

        // 先提取 alpha/beta 避免借用冲突
        let alpha = inner.alpha;
        let beta = inner.beta;

        // 更新共现计数
        let entry = inner
            .cooccurrence
            .entry(tag1.clone())
            .or_insert_with(HashMap::new);
        let count = entry.entry(tag2.clone()).or_insert(0.0);
        *count = *count * beta + weight * alpha;

        // 对称更新
        let entry = inner
            .cooccurrence
            .entry(tag2.clone())
            .or_insert_with(HashMap::new);
        let count = entry.entry(tag1.clone()).or_insert(0.0);
        *count = *count * beta + weight * alpha;

        // 更新频率
        *inner.frequencies.entry(tag1).or_insert(0.0) += weight;
        *inner.frequencies.entry(tag2).or_insert(0.0) += weight;
        inner.total_count += weight * 2.0;
    }

    /// 批量更新（高性能）
    #[napi]
    pub fn batch_update(&self, updates: Vec<TagPairUpdate>) {
        let mut inner = self.inner.write();

        // 先提取 alpha/beta 避免借用冲突
        let alpha = inner.alpha;
        let beta = inner.beta;

        for update in updates {
            let weight = update.weight.unwrap_or(1.0);

            // 更新共现
            let entry = inner
                .cooccurrence
                .entry(update.tag1.clone())
                .or_insert_with(HashMap::new);
            let count = entry.entry(update.tag2.clone()).or_insert(0.0);
            *count = *count * beta + weight * alpha;

            // 对称更新
            let entry = inner
                .cooccurrence
                .entry(update.tag2.clone())
                .or_insert_with(HashMap::new);
            let count = entry.entry(update.tag1.clone()).or_insert(0.0);
            *count = *count * beta + weight * alpha;

            // 更新频率
            *inner.frequencies.entry(update.tag1).or_insert(0.0) += weight;
            *inner.frequencies.entry(update.tag2).or_insert(0.0) += weight;
            inner.total_count += weight * 2.0;
        }
    }

    /// 计算 PMI（点互信息）
    #[napi]
    pub fn compute_pmi(&self, tag1: String, tag2: String) -> f64 {
        let inner = self.inner.read();

        if inner.total_count == 0.0 {
            return 0.0;
        }

        let freq1 = inner.frequencies.get(&tag1).copied().unwrap_or(0.0);
        let freq2 = inner.frequencies.get(&tag2).copied().unwrap_or(0.0);

        if freq1 == 0.0 || freq2 == 0.0 {
            return 0.0;
        }

        let cooc = inner
            .cooccurrence
            .get(&tag1)
            .and_then(|m| m.get(&tag2))
            .copied()
            .unwrap_or(0.0);

        if cooc == 0.0 {
            return 0.0;
        }

        let p_ab = cooc / inner.total_count;
        let p_a = freq1 / inner.total_count;
        let p_b = freq2 / inner.total_count;

        (p_ab / (p_a * p_b)).ln()
    }

    /// 获取关联标签（按 PMI 排序）
    #[napi]
    pub fn get_associations(&self, tag: String, top_k: Option<u32>) -> Vec<TagAssociation> {
        let inner = self.inner.read();
        let top_k = top_k.unwrap_or(10) as usize;

        let Some(coocs) = inner.cooccurrence.get(&tag) else {
            return vec![];
        };

        let mut associations: Vec<_> = coocs
            .iter()
            .filter_map(|(other_tag, &cooc)| {
                if cooc < inner.min_pmi_threshold {
                    return None;
                }

                let freq1 = inner.frequencies.get(&tag).copied().unwrap_or(0.0);
                let freq2 = inner.frequencies.get(other_tag).copied().unwrap_or(0.0);

                if freq1 == 0.0 || freq2 == 0.0 || inner.total_count == 0.0 {
                    return None;
                }

                let p_ab = cooc / inner.total_count;
                let p_a = freq1 / inner.total_count;
                let p_b = freq2 / inner.total_count;
                let pmi = (p_ab / (p_a * p_b)).ln();

                Some(TagAssociation {
                    tag: other_tag.clone(),
                    pmi,
                    cooccurrence: cooc,
                    frequency: freq2,
                })
            })
            .collect();

        // 按 PMI 降序排序
        associations.sort_by(|a, b| b.pmi.partial_cmp(&a.pmi).unwrap_or(std::cmp::Ordering::Equal));
        associations.truncate(top_k);

        associations
    }

    /// 指数增强查询扩展
    #[napi]
    pub fn expand_query(&self, tags: Vec<String>, expansion_factor: Option<f64>) -> Vec<String> {
        let factor = expansion_factor.unwrap_or(0.5);
        let inner = self.inner.read();

        let mut expanded: HashMap<String, f64> = HashMap::new();

        // 原始标签权重 1.0
        for tag in &tags {
            expanded.insert(tag.clone(), 1.0);
        }

        // 扩展关联标签
        for tag in &tags {
            if let Some(coocs) = inner.cooccurrence.get(tag) {
                for (other_tag, &cooc) in coocs {
                    if !expanded.contains_key(other_tag) {
                        let freq1 = inner.frequencies.get(tag).copied().unwrap_or(1.0);
                        let freq2 = inner.frequencies.get(other_tag).copied().unwrap_or(1.0);

                        // 指数增强权重
                        let weight = (cooc / (freq1 * freq2).sqrt()).exp() * factor;
                        expanded.insert(other_tag.clone(), weight);
                    }
                }
            }
        }

        // 按权重排序返回
        let mut result: Vec<_> = expanded.into_iter().collect();
        result.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        result.into_iter().map(|(tag, _)| tag).collect()
    }

    /// 设置最小 PMI 阈值
    #[napi]
    pub fn set_min_pmi_threshold(&self, threshold: f64) {
        self.inner.write().min_pmi_threshold = threshold;
    }

    /// 获取统计信息
    #[napi]
    pub fn get_stats(&self) -> TagMatrixStats {
        let inner = self.inner.read();

        TagMatrixStats {
            tag_count: inner.frequencies.len() as u32,
            pair_count: inner
                .cooccurrence
                .values()
                .map(|m| m.len())
                .sum::<usize>() as u32
                / 2,
            total_updates: inner.total_count as i64,
            alpha: inner.alpha,
            beta: inner.beta,
        }
    }

    /// 序列化为 JSON
    #[napi]
    pub fn to_json(&self) -> Result<String> {
        let inner = self.inner.read();

        let data = serde_json::json!({
            "alpha": inner.alpha,
            "beta": inner.beta,
            "cooccurrence": inner.cooccurrence,
            "frequencies": inner.frequencies,
            "total_count": inner.total_count,
        });

        serde_json::to_string(&data).map_err(|e| Error::from_reason(e.to_string()))
    }

    /// 从 JSON 加载
    #[napi(factory)]
    pub fn from_json(json: String) -> Result<Self> {
        let data: serde_json::Value =
            serde_json::from_str(&json).map_err(|e| Error::from_reason(e.to_string()))?;

        let inner = TagMatrixInner {
            alpha: data["alpha"].as_f64().unwrap_or(0.8),
            beta: data["beta"].as_f64().unwrap_or(0.2),
            cooccurrence: serde_json::from_value(data["cooccurrence"].clone()).unwrap_or_default(),
            frequencies: serde_json::from_value(data["frequencies"].clone()).unwrap_or_default(),
            total_count: data["total_count"].as_f64().unwrap_or(0.0),
            min_pmi_threshold: 0.0,
        };

        Ok(Self {
            inner: Arc::new(RwLock::new(inner)),
        })
    }

    /// 清空矩阵
    #[napi]
    pub fn clear(&self) {
        let mut inner = self.inner.write();
        inner.cooccurrence.clear();
        inner.frequencies.clear();
        inner.total_count = 0.0;
    }

    // ==================== Tag Boost 算法 (VCPToolBox _applyTagBoost) ====================

    /// 计算标签增强分数
    ///
    /// 核心算法来源: VCPToolBox _applyTagBoost
    /// - 动态 Alpha: 基于平均标签得分调整增强强度 [1.5, 3.5]
    /// - 动态 Beta: 模糊查询时提高降噪常数
    /// - 指数级毛刺增强 + 对数级降噪
    #[napi]
    pub fn compute_tag_boost(&self, params: TagBoostParams) -> TagBoostResult {
        let inner = self.inner.read();

        // 计算平均标签得分
        let tag_scores: Vec<f64> = params
            .query_tags
            .iter()
            .map(|t| {
                let freq = inner.frequencies.get(t).copied().unwrap_or(0.0);
                if inner.total_count > 0.0 {
                    freq / inner.total_count
                } else {
                    0.0
                }
            })
            .collect();

        let avg_score = if tag_scores.is_empty() {
            0.0
        } else {
            tag_scores.iter().sum::<f64>() / tag_scores.len() as f64
        };

        // 动态参数
        let alpha_min = params.alpha_min.unwrap_or(1.5);
        let alpha_max = params.alpha_max.unwrap_or(3.5);
        let beta_base = params.beta_base.unwrap_or(2.0);

        let dynamic_alpha = (alpha_min + (alpha_max - alpha_min) * avg_score).clamp(alpha_min, alpha_max);
        let dynamic_beta = beta_base + (1.0 - avg_score) * 3.0;

        // 计算 spike 分数
        let mut total_spike_score = 0.0;
        let mut spike_details = Vec::new();
        let mut matched_tags = Vec::new();

        for tag in &params.query_tags {
            let content_tags_lower: Vec<String> = params
                .content_tags
                .iter()
                .map(|t| t.to_lowercase())
                .collect();

            if content_tags_lower.contains(&tag.to_lowercase()) {
                matched_tags.push(tag.clone());

                let freq = inner.frequencies.get(tag).copied().unwrap_or(1.0);
                let global_freq = inner
                    .cooccurrence
                    .get(tag)
                    .map(|m| m.len() as f64)
                    .unwrap_or(1.0);

                // 核心算法：指数级毛刺 + 对数级降噪
                let logic_strength = freq.powf(dynamic_alpha);
                let noise_penalty = (global_freq + dynamic_beta).ln();
                let score = if noise_penalty > 0.0 {
                    logic_strength / noise_penalty
                } else {
                    logic_strength
                };

                total_spike_score += score;
                spike_details.push(SpikeDetail {
                    tag: tag.clone(),
                    weight: freq,
                    global_freq,
                    score,
                });
            }
        }

        // 扩展标签匹配 (权重衰减 50%)
        let mut expansion_tags = Vec::new();
        for tag in &params.query_tags {
            if let Some(coocs) = inner.cooccurrence.get(tag) {
                for (other_tag, &cooc) in coocs {
                    let content_tags_lower: Vec<String> = params
                        .content_tags
                        .iter()
                        .map(|t| t.to_lowercase())
                        .collect();

                    if content_tags_lower.contains(&other_tag.to_lowercase())
                        && !matched_tags.contains(other_tag)
                        && !expansion_tags.contains(other_tag)
                    {
                        expansion_tags.push(other_tag.clone());

                        let global_freq = inner
                            .cooccurrence
                            .get(other_tag)
                            .map(|m| m.len() as f64)
                            .unwrap_or(1.0);

                        // 扩展标签权重衰减
                        let weight = cooc * 0.5;
                        let logic_strength = weight.powf(dynamic_alpha);
                        let noise_penalty = (global_freq + dynamic_beta).ln();
                        let score = if noise_penalty > 0.0 {
                            (logic_strength / noise_penalty) * 0.5
                        } else {
                            logic_strength * 0.5
                        };

                        total_spike_score += score;
                        spike_details.push(SpikeDetail {
                            tag: other_tag.clone(),
                            weight,
                            global_freq,
                            score,
                        });
                    }
                }
            }
        }

        // 归一化 spike 分数
        let normalized_spike = total_spike_score / (total_spike_score + dynamic_beta * 2.0);
        let boost_factor = 1.0 + normalized_spike * 0.5; // 最多提升 50%

        // 计算最终分数
        let original_score = params.original_score.unwrap_or(0.0);
        let boosted_score = (original_score * boost_factor).min(1.0);

        TagBoostResult {
            original_score,
            boosted_score,
            matched_tags,
            expansion_tags,
            boost_factor,
            tag_match_score: total_spike_score,
            spike_details,
            dynamic_alpha,
            dynamic_beta,
        }
    }

    /// 批量计算标签增强
    #[napi]
    pub fn batch_compute_tag_boost(
        &self,
        items: Vec<TagBoostBatchItem>,
        query_tags: Vec<String>,
        alpha_min: Option<f64>,
        alpha_max: Option<f64>,
        beta_base: Option<f64>,
    ) -> Vec<TagBoostResult> {
        items
            .into_iter()
            .map(|item| {
                self.compute_tag_boost(TagBoostParams {
                    query_tags: query_tags.clone(),
                    content_tags: item.content_tags,
                    original_score: item.original_score,
                    alpha_min,
                    alpha_max,
                    beta_base,
                })
            })
            .collect()
    }
}

/// 标签对更新
#[napi(object)]
#[derive(Clone)]
pub struct TagPairUpdate {
    pub tag1: String,
    pub tag2: String,
    pub weight: Option<f64>,
}

/// 标签关联结果
#[napi(object)]
pub struct TagAssociation {
    pub tag: String,
    pub pmi: f64,
    pub cooccurrence: f64,
    pub frequency: f64,
}

/// 矩阵统计信息
#[napi(object)]
pub struct TagMatrixStats {
    pub tag_count: u32,
    pub pair_count: u32,
    pub total_updates: i64,
    pub alpha: f64,
    pub beta: f64,
}

// ==================== Tag Boost 数据类型 ====================

/// 标签增强参数
#[napi(object)]
#[derive(Clone)]
pub struct TagBoostParams {
    /// 查询标签列表
    pub query_tags: Vec<String>,
    /// 内容标签列表
    pub content_tags: Vec<String>,
    /// 原始分数 (可选)
    pub original_score: Option<f64>,
    /// Alpha 最小值 (默认 1.5)
    pub alpha_min: Option<f64>,
    /// Alpha 最大值 (默认 3.5)
    pub alpha_max: Option<f64>,
    /// Beta 基础值
    pub beta_base: Option<f64>,
}

/// 标签增强结果
#[napi(object)]
pub struct TagBoostResult {
    /// 原始分数
    pub original_score: f64,
    /// 增强后分数
    pub boosted_score: f64,
    /// 直接匹配的标签
    pub matched_tags: Vec<String>,
    /// 扩展匹配的标签
    pub expansion_tags: Vec<String>,
    /// 增强因子
    pub boost_factor: f64,
    /// 标签匹配总分
    pub tag_match_score: f64,
    /// 详细的 spike 计算信息
    pub spike_details: Vec<SpikeDetail>,
    /// 动态 Alpha
    pub dynamic_alpha: f64,
    /// 动态 Beta
    pub dynamic_beta: f64,
}

/// Spike 计算详情
#[napi(object)]
#[derive(Clone)]
pub struct SpikeDetail {
    /// 标签名
    pub tag: String,
    /// 共现权重
    pub weight: f64,
    /// 全局频率
    pub global_freq: f64,
    /// 计算得分
    pub score: f64,
}

/// 批量增强项
#[napi(object)]
#[derive(Clone)]
pub struct TagBoostBatchItem {
    /// 内容标签
    pub content_tags: Vec<String>,
    /// 原始分数
    pub original_score: Option<f64>,
}

// ==================== 向量级增强 (VCPToolBox _applyTagBoost 完整实现) ====================

/// 向量增强参数
#[napi(object)]
#[derive(Clone)]
pub struct VectorBoostParams {
    /// 原始向量
    pub original_vector: Vec<f64>,
    /// 查询标签列表
    pub query_tags: Vec<String>,
    /// 内容标签列表
    pub content_tags: Vec<String>,
    /// 标签对应的上下文向量 (tag -> vector 的扁平化表示)
    /// 格式: [tag1_dim0, tag1_dim1, ..., tag2_dim0, tag2_dim1, ...]
    pub tag_vectors: Option<Vec<f64>>,
    /// 标签名列表 (与 tag_vectors 对应)
    pub tag_names: Option<Vec<String>>,
    /// 向量维度
    pub vector_dim: u32,
    /// Alpha 最小值 (默认 1.5)
    pub alpha_min: Option<f64>,
    /// Alpha 最大值 (默认 3.5)
    pub alpha_max: Option<f64>,
    /// Beta 基础值 (默认 2.0)
    pub beta_base: Option<f64>,
    /// 最大增强比例 (默认 0.3, 即最多 30% 上下文融合)
    pub max_boost_ratio: Option<f64>,
}

/// 向量增强结果
#[napi(object)]
pub struct VectorBoostResult {
    /// 融合后的向量
    pub fused_vector: Vec<f64>,
    /// 原始分数
    pub original_score: f64,
    /// 增强后分数
    pub boosted_score: f64,
    /// 直接匹配的标签
    pub matched_tags: Vec<String>,
    /// 扩展匹配的标签
    pub expansion_tags: Vec<String>,
    /// 增强因子 (1.0 表示无增强)
    pub boost_factor: f64,
    /// 上下文融合比例 (0-1)
    pub context_blend_ratio: f64,
    /// 动态 Alpha
    pub dynamic_alpha: f64,
    /// 动态 Beta
    pub dynamic_beta: f64,
}

#[napi]
impl TagCooccurrenceMatrix {
    /// 向量级标签增强
    ///
    /// 完整实现 VCPToolBox _applyTagBoost 的向量融合算法：
    /// 1. 计算动态 Alpha/Beta
    /// 2. 标签索引召回 + 共现扩展
    /// 3. 构建上下文向量
    /// 4. 线性融合: fused = (1-ratio)*original + ratio*context
    /// 5. L2 归一化
    #[napi]
    pub fn boost_vector(&self, params: VectorBoostParams) -> VectorBoostResult {
        let inner = self.inner.read();
        let dim = params.vector_dim as usize;

        // 验证输入向量维度
        if params.original_vector.len() != dim {
            return VectorBoostResult {
                fused_vector: params.original_vector.clone(),
                original_score: 0.0,
                boosted_score: 0.0,
                matched_tags: vec![],
                expansion_tags: vec![],
                boost_factor: 1.0,
                context_blend_ratio: 0.0,
                dynamic_alpha: 1.5,
                dynamic_beta: 2.0,
            };
        }

        // === Step 1: 计算动态参数 ===
        let tag_scores: Vec<f64> = params
            .query_tags
            .iter()
            .map(|t| {
                let freq = inner.frequencies.get(t).copied().unwrap_or(0.0);
                if inner.total_count > 0.0 {
                    freq / inner.total_count
                } else {
                    0.0
                }
            })
            .collect();

        let avg_score = if tag_scores.is_empty() {
            0.0
        } else {
            tag_scores.iter().sum::<f64>() / tag_scores.len() as f64
        };

        let alpha_min = params.alpha_min.unwrap_or(1.5);
        let alpha_max = params.alpha_max.unwrap_or(3.5);
        let beta_base = params.beta_base.unwrap_or(2.0);
        let max_boost_ratio = params.max_boost_ratio.unwrap_or(0.3);

        let dynamic_alpha = (alpha_min + (alpha_max - alpha_min) * avg_score).clamp(alpha_min, alpha_max);
        let dynamic_beta = beta_base + (1.0 - avg_score) * 3.0;

        // === Step 2: 标签匹配 + 权重计算 ===
        let mut matched_tags: Vec<String> = Vec::new();
        let mut matched_weights: Vec<f64> = Vec::new();
        let mut total_spike_score = 0.0;

        let content_tags_lower: Vec<String> = params
            .content_tags
            .iter()
            .map(|t| t.to_lowercase())
            .collect();

        // 直接匹配
        for tag in &params.query_tags {
            if content_tags_lower.contains(&tag.to_lowercase()) {
                let freq = inner.frequencies.get(tag).copied().unwrap_or(1.0);
                let global_freq = inner
                    .cooccurrence
                    .get(tag)
                    .map(|m| m.len() as f64)
                    .unwrap_or(1.0);

                // 核心算法：指数级毛刺 + 对数级降噪
                let logic_strength = freq.powf(dynamic_alpha);
                let noise_penalty = (global_freq + dynamic_beta).ln();
                let weight = if noise_penalty > 0.0 {
                    logic_strength / noise_penalty
                } else {
                    logic_strength
                };

                matched_tags.push(tag.clone());
                matched_weights.push(weight);
                total_spike_score += weight;
            }
        }

        // 共现扩展匹配 (权重衰减 50%)
        let mut expansion_tags: Vec<String> = Vec::new();
        for tag in &params.query_tags {
            if let Some(coocs) = inner.cooccurrence.get(tag) {
                for (other_tag, &cooc) in coocs {
                    if content_tags_lower.contains(&other_tag.to_lowercase())
                        && !matched_tags.contains(other_tag)
                        && !expansion_tags.contains(other_tag)
                    {
                        expansion_tags.push(other_tag.clone());

                        let global_freq = inner
                            .cooccurrence
                            .get(other_tag)
                            .map(|m| m.len() as f64)
                            .unwrap_or(1.0);

                        let weight = cooc * 0.5;
                        let logic_strength = weight.powf(dynamic_alpha);
                        let noise_penalty = (global_freq + dynamic_beta).ln();
                        let expanded_weight = if noise_penalty > 0.0 {
                            (logic_strength / noise_penalty) * 0.5
                        } else {
                            logic_strength * 0.5
                        };

                        matched_weights.push(expanded_weight);
                        total_spike_score += expanded_weight;
                    }
                }
            }
        }

        // === Step 3: 构建上下文向量 ===
        let mut context_vector = vec![0.0f64; dim];
        let mut has_context = false;

        if let (Some(ref tag_vectors), Some(ref tag_names)) = (params.tag_vectors, params.tag_names) {
            // 从提供的标签向量构建上下文
            let all_matched: Vec<_> = matched_tags.iter().chain(expansion_tags.iter()).collect();
            let mut weight_sum = 0.0;

            for (idx, tag_name) in tag_names.iter().enumerate() {
                if all_matched.iter().any(|t| t.to_lowercase() == tag_name.to_lowercase()) {
                    let vec_start = idx * dim;
                    let vec_end = vec_start + dim;

                    if vec_end <= tag_vectors.len() {
                        // 找到对应的权重 (直接匹配或扩展)
                        let weight_idx = matched_tags.iter()
                            .chain(expansion_tags.iter())
                            .position(|t| t.to_lowercase() == tag_name.to_lowercase())
                            .unwrap_or(0);
                        let weight = matched_weights.get(weight_idx).copied().unwrap_or(1.0);

                        for (i, &val) in tag_vectors[vec_start..vec_end].iter().enumerate() {
                            context_vector[i] += val * weight;
                        }
                        weight_sum += weight;
                        has_context = true;
                    }
                }
            }

            // 归一化上下文向量
            if weight_sum > 0.0 {
                for v in &mut context_vector {
                    *v /= weight_sum;
                }
            }
        }

        // === Step 4: 计算融合比例 ===
        let normalized_spike = total_spike_score / (total_spike_score + dynamic_beta * 2.0);
        let boost_factor = 1.0 + normalized_spike * 0.5;
        let context_blend_ratio = if has_context {
            (normalized_spike * max_boost_ratio).min(max_boost_ratio)
        } else {
            0.0
        };

        // === Step 5: 向量线性融合 ===
        let mut fused_vector = if has_context && context_blend_ratio > 0.0 {
            params
                .original_vector
                .iter()
                .zip(context_vector.iter())
                .map(|(&orig, &ctx)| {
                    (1.0 - context_blend_ratio) * orig + context_blend_ratio * ctx
                })
                .collect()
        } else {
            params.original_vector.clone()
        };

        // === Step 6: L2 归一化 ===
        let norm: f64 = fused_vector.iter().map(|x| x * x).sum::<f64>().sqrt();
        if norm > 0.0 {
            for v in &mut fused_vector {
                *v /= norm;
            }
        }

        // 计算分数
        let original_score = 0.0; // 外部提供
        let boosted_score = (original_score * boost_factor).min(1.0);

        VectorBoostResult {
            fused_vector,
            original_score,
            boosted_score,
            matched_tags,
            expansion_tags,
            boost_factor,
            context_blend_ratio,
            dynamic_alpha,
            dynamic_beta,
        }
    }

    /// 批量向量增强
    #[napi]
    pub fn batch_boost_vectors(
        &self,
        original_vectors: Vec<Vec<f64>>,
        query_tags: Vec<String>,
        content_tags_list: Vec<Vec<String>>,
        tag_vectors: Option<Vec<f64>>,
        tag_names: Option<Vec<String>>,
        vector_dim: u32,
        alpha_min: Option<f64>,
        alpha_max: Option<f64>,
        beta_base: Option<f64>,
        max_boost_ratio: Option<f64>,
    ) -> Vec<VectorBoostResult> {
        original_vectors
            .into_iter()
            .zip(content_tags_list.into_iter())
            .map(|(original_vector, content_tags)| {
                self.boost_vector(VectorBoostParams {
                    original_vector,
                    query_tags: query_tags.clone(),
                    content_tags,
                    tag_vectors: tag_vectors.clone(),
                    tag_names: tag_names.clone(),
                    vector_dim,
                    alpha_min,
                    alpha_max,
                    beta_base,
                    max_boost_ratio,
                })
            })
            .collect()
    }
}
