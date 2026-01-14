//! CooccurrenceMatrix - 标签共现矩阵
//!
//! 从 VCP rust-vexus-lite 移植的 NPMI (Normalized Pointwise Mutual Information) 实现。
//! 用于计算标签之间的关联强度，支持多跳标签扩展。
//!
//! 算法原理:
//! - PMI = log(P(x,y) / (P(x) * P(y)))
//! - NPMI = PMI / -log(P(x,y))  归一化到 [-1, 1]
//! - 最终权重 = (NPMI + 1) / 2  映射到 [0, 1]

#![allow(clippy::new_without_default)]

use hashbrown::HashSet;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::{HashMap, VecDeque};

// ==================== 类型定义 ====================

/// 标签共现关系
#[napi(object)]
pub struct TagCooccurrence {
    /// 源标签
    pub tag1: String,
    /// 目标标签
    pub tag2: String,
    /// 共现权重 (0-1)
    pub weight: f64,
    /// 共现次数 (权重 * 100 的近似值)
    pub count: u32,
}

/// 标签信息
#[napi(object)]
pub struct TagInfo {
    /// 标签 ID
    pub id: String,
    /// 标签名称
    pub name: String,
    /// 出现频率
    pub frequency: u32,
}

/// 文档输入（用于构建共现矩阵）
#[napi(object)]
pub struct DocumentInput {
    /// 文档 ID
    pub id: String,
    /// 文档包含的标签列表
    pub tags: Vec<String>,
}

// ==================== CooccurrenceMatrix ====================

/// 共现矩阵核心结构
///
/// 使用 NPMI (Normalized Pointwise Mutual Information) 计算标签关联度。
/// 支持高效的关联查询和多跳扩展。
#[napi]
pub struct CooccurrenceMatrix {
    /// 所有标签列表（有序）
    tags: Vec<String>,
    /// 标签到索引的映射
    tag_index: HashMap<String, usize>,
    /// 共现权重矩阵（稀疏存储: (i, j) -> weight）
    weights: HashMap<(usize, usize), f64>,
    /// 标签频率
    tag_freq: HashMap<String, u32>,
    /// 总文档数
    total_docs: u32,
}

#[napi]
impl CooccurrenceMatrix {
    /// 创建空的共现矩阵
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            tags: Vec::new(),
            tag_index: HashMap::new(),
            weights: HashMap::new(),
            tag_freq: HashMap::new(),
            total_docs: 0,
        }
    }

    /// 从文档列表构建共现矩阵
    ///
    /// 使用 NPMI (Normalized PMI) 计算权重，自动处理所有标签对的关联度。
    ///
    /// @param documents - 文档列表，每个文档包含 id 和 tags
    /// @returns 创建的共现关系数量
    #[napi]
    pub fn build_from_documents(&mut self, documents: Vec<DocumentInput>) -> Result<u32> {
        let total_docs = documents.len();
        if total_docs == 0 {
            return Ok(0);
        }

        self.total_docs = total_docs as u32;

        // 1. 收集所有标签及其出现的文档
        let mut tag_doc_set: HashMap<String, HashSet<String>> = HashMap::new();

        for doc in &documents {
            for tag in &doc.tags {
                tag_doc_set
                    .entry(tag.clone())
                    .or_default()
                    .insert(doc.id.clone());
            }
        }

        // 2. 创建有序标签列表和索引
        let mut tags: Vec<String> = tag_doc_set.keys().cloned().collect();
        tags.sort();

        self.tags = tags.clone();
        self.tag_index = tags
            .iter()
            .enumerate()
            .map(|(i, t)| (t.clone(), i))
            .collect();

        // 3. 记录标签频率
        for (tag, docs) in &tag_doc_set {
            self.tag_freq.insert(tag.clone(), docs.len() as u32);
        }

        // 4. 计算共现频率
        let mut cooccur_count: HashMap<(usize, usize), u32> = HashMap::new();

        for doc in &documents {
            let doc_tags: Vec<usize> = doc
                .tags
                .iter()
                .filter_map(|t| self.tag_index.get(t).copied())
                .collect();

            for i in 0..doc_tags.len() {
                for j in (i + 1)..doc_tags.len() {
                    let (a, b) = if doc_tags[i] < doc_tags[j] {
                        (doc_tags[i], doc_tags[j])
                    } else {
                        (doc_tags[j], doc_tags[i])
                    };
                    *cooccur_count.entry((a, b)).or_insert(0) += 1;
                }
            }
        }

        // 5. 计算 NPMI 权重
        let total_f64 = total_docs as f64;

        for ((i, j), count) in cooccur_count {
            if count == 0 {
                continue;
            }

            let tag1 = &self.tags[i];
            let tag2 = &self.tags[j];

            let freq1 = *self.tag_freq.get(tag1).unwrap_or(&0) as f64;
            let freq2 = *self.tag_freq.get(tag2).unwrap_or(&0) as f64;

            if freq1 == 0.0 || freq2 == 0.0 {
                continue;
            }

            // PMI = log(P(x,y) / (P(x) * P(y)))
            let p_xy = count as f64 / total_f64;
            let p_x = freq1 / total_f64;
            let p_y = freq2 / total_f64;

            let pmi = (p_xy / (p_x * p_y)).ln();
            // NPMI = PMI / -log(P(x,y)) 归一化到 [-1, 1]
            let npmi = pmi / -p_xy.ln();
            // 转换到 [0, 1]
            let weight = (npmi + 1.0) / 2.0;

            // 存储对称权重
            self.weights.insert((i, j), weight);
            self.weights.insert((j, i), weight);
        }

        tracing::info!(
            tags = self.tags.len(),
            relations = self.weights.len() / 2,
            docs = total_docs,
            "CooccurrenceMatrix built"
        );

        Ok(self.weights.len() as u32 / 2)
    }

    /// 获取两个标签之间的共现权重
    ///
    /// @param tag1 - 第一个标签
    /// @param tag2 - 第二个标签
    /// @returns 共现权重 (0-1)，不存在返回 0
    #[napi]
    pub fn get_cooccurrence(&self, tag1: String, tag2: String) -> f64 {
        let idx1 = match self.tag_index.get(&tag1) {
            Some(&i) => i,
            None => return 0.0,
        };
        let idx2 = match self.tag_index.get(&tag2) {
            Some(&i) => i,
            None => return 0.0,
        };

        *self.weights.get(&(idx1, idx2)).unwrap_or(&0.0)
    }

    /// 获取与给定标签最相关的标签
    ///
    /// @param tag - 目标标签
    /// @param top_k - 返回数量（默认 10）
    /// @param min_weight - 最小权重阈值（默认 0.1）
    #[napi]
    pub fn get_related_tags(
        &self,
        tag: String,
        top_k: Option<u32>,
        min_weight: Option<f64>,
    ) -> Vec<TagCooccurrence> {
        let k = top_k.unwrap_or(10) as usize;
        let threshold = min_weight.unwrap_or(0.1);

        let idx = match self.tag_index.get(&tag) {
            Some(&i) => i,
            None => return Vec::new(),
        };

        let mut related: Vec<TagCooccurrence> = Vec::new();

        for (i, other_tag) in self.tags.iter().enumerate() {
            if i == idx {
                continue;
            }

            let weight = *self.weights.get(&(idx, i)).unwrap_or(&0.0);
            if weight >= threshold {
                related.push(TagCooccurrence {
                    tag1: tag.clone(),
                    tag2: other_tag.clone(),
                    weight,
                    count: (weight * 100.0) as u32,
                });
            }
        }

        // 按权重降序排序
        related.sort_by(|a, b| {
            b.weight
                .partial_cmp(&a.weight)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        related.truncate(k);

        related
    }

    /// 多跳标签扩展（BFS）
    ///
    /// 从种子标签出发，沿共现关系进行多跳扩展，用于查询扩展。
    ///
    /// @param seeds - 种子标签列表
    /// @param depth - 最大扩展深度（默认 2）
    /// @param decay_factor - 衰减因子（默认 0.7）
    #[napi]
    pub fn expand_tags(
        &self,
        seeds: Vec<String>,
        depth: Option<u32>,
        decay_factor: Option<f64>,
    ) -> Vec<TagCooccurrence> {
        let max_depth = depth.unwrap_or(2) as usize;
        let decay = decay_factor.unwrap_or(0.7);

        let mut expanded: HashMap<String, f64> = HashMap::new();

        // 初始化种子标签权重为 1.0
        for seed in &seeds {
            expanded.insert(seed.clone(), 1.0);
        }

        let mut frontier: VecDeque<String> = seeds.iter().cloned().collect();
        let mut visited: HashSet<String> = seeds.iter().cloned().collect();

        for d in 0..max_depth {
            let decay_mult = decay.powi((d + 1) as i32);
            let frontier_size = frontier.len();

            for _ in 0..frontier_size {
                let Some(tag) = frontier.pop_front() else {
                    break;
                };

                let current_weight = *expanded.get(&tag).unwrap_or(&0.0);
                let related = self.get_related_tags(tag.clone(), Some(5), Some(0.2));

                for rel in related {
                    let new_weight = current_weight * rel.weight * decay_mult;
                    let existing = *expanded.get(&rel.tag2).unwrap_or(&0.0);

                    if new_weight > existing {
                        expanded.insert(rel.tag2.clone(), new_weight);

                        if !visited.contains(&rel.tag2) {
                            visited.insert(rel.tag2.clone());
                            frontier.push_back(rel.tag2);
                        }
                    }
                }
            }
        }

        // 转换为结果数组
        let mut results: Vec<TagCooccurrence> = expanded
            .into_iter()
            .map(|(tag, weight)| TagCooccurrence {
                tag1: String::new(), // 表示来自扩展
                tag2: tag,
                weight,
                count: (weight * 100.0) as u32,
            })
            .collect();

        // 按权重排序
        results.sort_by(|a, b| {
            b.weight
                .partial_cmp(&a.weight)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results
    }

    /// 计算 TagMemo 增强权重
    ///
    /// 基于 PMI 共现矩阵计算标签增强权重，用于搜索结果排序。
    /// 算法: alpha * exp(sum(cooccurrence)) + beta * log(1 + tag_count)
    ///
    /// @param query_tags - 查询中的标签
    /// @param result_tags - 结果中的标签
    /// @param alpha - 指数增强系数（默认 0.3）
    /// @param beta - 对数降噪系数（默认 0.1）
    #[napi]
    pub fn calculate_boost(
        &self,
        query_tags: Vec<String>,
        result_tags: Vec<String>,
        alpha: Option<f64>,
        beta: Option<f64>,
    ) -> f64 {
        let a = alpha.unwrap_or(0.3);
        let b = beta.unwrap_or(0.1);

        if query_tags.is_empty() || result_tags.is_empty() {
            return 0.0;
        }

        // 计算所有标签对的共现权重之和
        let mut total_cooccurrence = 0.0;
        let mut match_count = 0;

        for qt in &query_tags {
            for rt in &result_tags {
                let weight = self.get_cooccurrence(qt.clone(), rt.clone());
                if weight > 0.0 {
                    total_cooccurrence += weight;
                    match_count += 1;
                }
            }
        }

        if match_count == 0 {
            return 0.0;
        }

        // PMI 风格增强: alpha * exp(sum) + beta * log(1 + count)
        let boost = a * (total_cooccurrence / match_count as f64).exp()
            + b * (1.0 + match_count as f64).ln();

        boost.min(2.0) // 限制最大增强值
    }

    /// 获取所有标签
    #[napi]
    pub fn get_all_tags(&self) -> Vec<String> {
        self.tags.clone()
    }

    /// 获取标签数量
    #[napi]
    pub fn tag_count(&self) -> u32 {
        self.tags.len() as u32
    }

    /// 获取标签信息
    #[napi]
    pub fn get_tag_info(&self, tag: String) -> Option<TagInfo> {
        self.tag_freq.get(&tag).map(|&freq| TagInfo {
            id: tag.clone(),
            name: tag,
            frequency: freq,
        })
    }

    /// 序列化为 JSON 字符串（用于持久化）
    #[napi]
    pub fn to_json(&self) -> Result<String> {
        let mut json = String::from("{");

        // tags
        json.push_str("\"tags\":[");
        json.push_str(
            &self
                .tags
                .iter()
                .map(|t| format!("\"{}\"", t.replace('\\', "\\\\").replace('"', "\\\"")))
                .collect::<Vec<_>>()
                .join(","),
        );
        json.push_str("],");

        // tag_freq
        json.push_str("\"tagFreq\":{");
        json.push_str(
            &self
                .tag_freq
                .iter()
                .map(|(k, v)| {
                    format!(
                        "\"{}\":{}",
                        k.replace('\\', "\\\\").replace('"', "\\\""),
                        v
                    )
                })
                .collect::<Vec<_>>()
                .join(","),
        );
        json.push_str("},");

        // weights (稀疏格式)
        json.push_str("\"weights\":{");
        let weights_str: Vec<String> = self
            .weights
            .iter()
            .filter(|((i, j), _)| i < j) // 只存储上三角
            .map(|((i, j), w)| format!("\"{},{}\":{}", i, j, w))
            .collect();
        json.push_str(&weights_str.join(","));
        json.push_str("},");

        // total_docs
        json.push_str(&format!("\"totalDocs\":{}", self.total_docs));

        json.push('}');

        Ok(json)
    }

    /// 从 JSON 字符串加载（用于恢复）
    #[napi(factory)]
    pub fn from_json(json_str: String) -> Result<Self> {
        // 简单的 JSON 解析（生产环境建议使用 serde_json）
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| Error::from_reason(format!("JSON parse error: {}", e)))?;

        let mut matrix = Self::new();

        // 解析 tags
        if let Some(tags) = parsed.get("tags").and_then(|v| v.as_array()) {
            matrix.tags = tags
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect();

            matrix.tag_index = matrix
                .tags
                .iter()
                .enumerate()
                .map(|(i, t)| (t.clone(), i))
                .collect();
        }

        // 解析 tagFreq
        if let Some(freq) = parsed.get("tagFreq").and_then(|v| v.as_object()) {
            for (k, v) in freq {
                if let Some(f) = v.as_u64() {
                    matrix.tag_freq.insert(k.clone(), f as u32);
                }
            }
        }

        // 解析 weights
        if let Some(weights) = parsed.get("weights").and_then(|v| v.as_object()) {
            for (k, v) in weights {
                if let Some(w) = v.as_f64() {
                    let parts: Vec<&str> = k.split(',').collect();
                    if parts.len() == 2 {
                        if let (Ok(i), Ok(j)) = (parts[0].parse::<usize>(), parts[1].parse::<usize>())
                        {
                            matrix.weights.insert((i, j), w);
                            matrix.weights.insert((j, i), w);
                        }
                    }
                }
            }
        }

        // 解析 totalDocs
        if let Some(total) = parsed.get("totalDocs").and_then(|v| v.as_u64()) {
            matrix.total_docs = total as u32;
        }

        tracing::info!(
            tags = matrix.tags.len(),
            relations = matrix.weights.len() / 2,
            "CooccurrenceMatrix loaded from JSON"
        );

        Ok(matrix)
    }
}
