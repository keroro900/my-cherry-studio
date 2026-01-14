//! 向量运算模块
//!
//! 高性能向量相似度计算：
//! - 余弦相似度
//! - 欧氏距离
//! - 点积
//! - 批量计算

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// 计算余弦相似度
#[napi]
pub fn cosine_similarity(a: Vec<f64>, b: Vec<f64>) -> Result<f64> {
    if a.len() != b.len() {
        return Err(Error::from_reason("Vector dimensions must match"));
    }

    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        return Ok(0.0);
    }

    Ok(dot / denom)
}

/// 计算欧氏距离
#[napi]
pub fn euclidean_distance(a: Vec<f64>, b: Vec<f64>) -> Result<f64> {
    if a.len() != b.len() {
        return Err(Error::from_reason("Vector dimensions must match"));
    }

    let mut sum = 0.0;
    for i in 0..a.len() {
        let diff = a[i] - b[i];
        sum += diff * diff;
    }

    Ok(sum.sqrt())
}

/// 计算点积
#[napi]
pub fn dot_product(a: Vec<f64>, b: Vec<f64>) -> Result<f64> {
    if a.len() != b.len() {
        return Err(Error::from_reason("Vector dimensions must match"));
    }

    let mut dot = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
    }

    Ok(dot)
}

/// 向量归一化
#[napi]
pub fn normalize(v: Vec<f64>) -> Vec<f64> {
    let norm: f64 = v.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm == 0.0 {
        return v;
    }
    v.iter().map(|x| x / norm).collect()
}

/// 批量余弦相似度计算
#[napi]
pub fn batch_cosine_similarity(query: Vec<f64>, vectors: Vec<Vec<f64>>) -> Result<Vec<f64>> {
    let mut results = Vec::with_capacity(vectors.len());

    for v in vectors {
        results.push(cosine_similarity(query.clone(), v)?);
    }

    Ok(results)
}

/// 批量计算并返回 Top-K
#[napi]
pub fn top_k_similar(query: Vec<f64>, vectors: Vec<Vec<f64>>, k: u32) -> Result<Vec<SimilarityResult>> {
    let similarities = batch_cosine_similarity(query, vectors)?;

    let mut indexed: Vec<_> = similarities.into_iter().enumerate().collect();
    indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let results: Vec<_> = indexed
        .into_iter()
        .take(k as usize)
        .map(|(index, score)| SimilarityResult {
            index: index as u32,
            score,
        })
        .collect();

    Ok(results)
}

/// 相似度结果
#[napi(object)]
pub struct SimilarityResult {
    pub index: u32,
    pub score: f64,
}

/// 向量存储（内存中）
#[napi]
pub struct VectorStore {
    vectors: Vec<Vec<f64>>,
    ids: Vec<String>,
    dim: usize,
}

#[napi]
impl VectorStore {
    /// 创建向量存储
    #[napi(constructor)]
    pub fn new(dim: u32) -> Self {
        Self {
            vectors: Vec::new(),
            ids: Vec::new(),
            dim: dim as usize,
        }
    }

    /// 添加向量
    #[napi]
    pub fn add(&mut self, id: String, vector: Vec<f64>) -> Result<()> {
        if vector.len() != self.dim {
            return Err(Error::from_reason(format!(
                "Vector dimension mismatch: expected {}, got {}",
                self.dim,
                vector.len()
            )));
        }

        self.ids.push(id);
        self.vectors.push(vector);
        Ok(())
    }

    /// 批量添加
    #[napi]
    pub fn add_batch(&mut self, entries: Vec<VectorEntry>) -> Result<u32> {
        let mut added = 0;
        for entry in entries {
            if entry.vector.len() == self.dim {
                self.ids.push(entry.id);
                self.vectors.push(entry.vector);
                added += 1;
            }
        }
        Ok(added)
    }

    /// 搜索相似向量
    #[napi]
    pub fn search(&self, query: Vec<f64>, k: u32) -> Result<Vec<VectorSearchResult>> {
        if query.len() != self.dim {
            return Err(Error::from_reason("Query dimension mismatch"));
        }

        let similarities = batch_cosine_similarity(query, self.vectors.clone())?;

        let mut indexed: Vec<_> = similarities.into_iter().enumerate().collect();
        indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<_> = indexed
            .into_iter()
            .take(k as usize)
            .map(|(index, score)| VectorSearchResult {
                id: self.ids[index].clone(),
                score,
            })
            .collect();

        Ok(results)
    }

    /// 获取存储大小
    #[napi]
    pub fn size(&self) -> u32 {
        self.vectors.len() as u32
    }

    /// 清空存储
    #[napi]
    pub fn clear(&mut self) {
        self.vectors.clear();
        self.ids.clear();
    }
}

#[napi(object)]
pub struct VectorEntry {
    pub id: String,
    pub vector: Vec<f64>,
}

#[napi(object)]
pub struct VectorSearchResult {
    pub id: String,
    pub score: f64,
}
