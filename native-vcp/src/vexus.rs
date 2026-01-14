//! VexusIndex - HNSW 向量索引
//!
//! 从 VCP rust-vexus-lite 移植的高性能 HNSW 向量索引实现。
//! 使用 usearch 库提供 20x 性能提升（相比纯 TypeScript 实现）。
//!
//! 特性:
//! - HNSW (Hierarchical Navigable Small World) 算法
//! - 支持批量添加、搜索、删除
//! - 自动扩容
//! - 从 SQLite 恢复索引
//! - 原子保存

#![allow(clippy::new_without_default)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use rusqlite::Connection;
use std::sync::{Arc, RwLock};
use usearch::Index;

// ==================== 搜索结果 ====================

/// 向量搜索结果
#[napi(object)]
pub struct VexusSearchResult {
    /// 向量 ID（对应 SQLite 中的记录 ID）
    pub id: u32,
    /// 相似度分数 (0-1, 1 表示完全匹配)
    pub score: f64,
}

/// 索引统计信息
#[napi(object)]
pub struct VexusStats {
    /// 当前向量总数
    pub total_vectors: u32,
    /// 向量维度
    pub dimensions: u32,
    /// 当前容量
    pub capacity: u32,
    /// 内存使用量 (字节)
    pub memory_usage: u32,
}

// ==================== VexusIndex ====================

/// HNSW 向量索引
///
/// 基于 usearch 库实现的高性能向量索引，使用 HNSW 算法。
/// 支持余弦相似度、L2 距离等多种度量方式。
#[napi]
pub struct VexusIndex {
    index: Arc<RwLock<Index>>,
    dimensions: u32,
}

#[napi]
impl VexusIndex {
    /// 创建新的空索引
    ///
    /// @param dim - 向量维度
    /// @param capacity - 初始容量（建议设置为预期向量数的 1.5 倍）
    #[napi(constructor)]
    pub fn new(dim: u32, capacity: u32) -> Result<Self> {
        let index = Index::new(&usearch::IndexOptions {
            dimensions: dim as usize,
            metric: usearch::MetricKind::Cos, // 使用余弦相似度
            quantization: usearch::ScalarKind::F32,
            connectivity: 16,      // HNSW 连接度
            expansion_add: 128,    // 添加时的扩展因子
            expansion_search: 64,  // 搜索时的扩展因子
            multi: false,
        })
        .map_err(|e| Error::from_reason(format!("Failed to create index: {:?}", e)))?;

        index
            .reserve(capacity as usize)
            .map_err(|e| Error::from_reason(format!("Failed to reserve capacity: {:?}", e)))?;

        tracing::info!(
            dim = dim,
            capacity = capacity,
            "VexusIndex created"
        );

        Ok(Self {
            index: Arc::new(RwLock::new(index)),
            dimensions: dim,
        })
    }

    /// 从磁盘加载索引
    ///
    /// @param index_path - 索引文件路径
    /// @param dim - 向量维度
    /// @param capacity - 初始容量
    #[napi(factory)]
    pub fn load(index_path: String, dim: u32, capacity: u32) -> Result<Self> {
        let index = Index::new(&usearch::IndexOptions {
            dimensions: dim as usize,
            metric: usearch::MetricKind::Cos,
            quantization: usearch::ScalarKind::F32,
            connectivity: 16,
            expansion_add: 128,
            expansion_search: 64,
            multi: false,
        })
        .map_err(|e| Error::from_reason(format!("Failed to create index wrapper: {:?}", e)))?;

        // 加载索引文件
        index
            .load(&index_path)
            .map_err(|e| Error::from_reason(format!("Failed to load index: {:?}", e)))?;

        // 检查并扩容
        let current_capacity = index.capacity();
        if capacity as usize > current_capacity {
            index
                .reserve(capacity as usize)
                .map_err(|e| Error::from_reason(format!("Failed to expand capacity: {:?}", e)))?;
        }

        tracing::info!(
            path = index_path,
            dim = dim,
            size = index.size(),
            "VexusIndex loaded"
        );

        Ok(Self {
            index: Arc::new(RwLock::new(index)),
            dimensions: dim,
        })
    }

    /// 保存索引到磁盘
    ///
    /// 使用原子写入：先写临时文件，再重命名
    #[napi]
    pub fn save(&self, index_path: String) -> Result<()> {
        let index = self
            .index
            .read()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        let temp_path = format!("{}.tmp", index_path);

        index
            .save(&temp_path)
            .map_err(|e| Error::from_reason(format!("Failed to save index: {:?}", e)))?;

        std::fs::rename(&temp_path, &index_path)
            .map_err(|e| Error::from_reason(format!("Failed to rename: {}", e)))?;

        tracing::debug!(path = index_path, "VexusIndex saved");

        Ok(())
    }

    /// 添加单个向量
    ///
    /// @param id - 向量唯一 ID
    /// @param vector - 向量数据（Float32 Buffer）
    #[napi]
    pub fn add(&self, id: u32, vector: Buffer) -> Result<()> {
        let index = self
            .index
            .write()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        let vec_slice: &[f32] = unsafe {
            std::slice::from_raw_parts(
                vector.as_ptr() as *const f32,
                vector.len() / std::mem::size_of::<f32>(),
            )
        };

        if vec_slice.len() != self.dimensions as usize {
            return Err(Error::from_reason(format!(
                "Dimension mismatch: expected {}, got {}",
                self.dimensions,
                vec_slice.len()
            )));
        }

        // 自动扩容
        if index.size() + 1 >= index.capacity() {
            let new_cap = (index.capacity() as f64 * 1.5) as usize;
            let _ = index.reserve(new_cap);
        }

        index
            .add(id as u64, vec_slice)
            .map_err(|e| Error::from_reason(format!("Add failed: {:?}", e)))?;

        Ok(())
    }

    /// 批量添加向量
    ///
    /// @param ids - 向量 ID 列表
    /// @param vectors - 连续的向量数据（所有向量拼接成一个 Buffer）
    #[napi]
    pub fn add_batch(&self, ids: Vec<u32>, vectors: Buffer) -> Result<()> {
        let index = self
            .index
            .write()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        let count = ids.len();
        let dim = self.dimensions as usize;

        let vec_slice: &[f32] = unsafe {
            std::slice::from_raw_parts(
                vectors.as_ptr() as *const f32,
                vectors.len() / std::mem::size_of::<f32>(),
            )
        };

        if vec_slice.len() != count * dim {
            return Err(Error::from_reason(format!(
                "Batch size mismatch: expected {} * {} = {}, got {}",
                count,
                dim,
                count * dim,
                vec_slice.len()
            )));
        }

        // 预扩容
        if index.size() + count >= index.capacity() {
            let new_cap = ((index.size() + count) as f64 * 1.5) as usize;
            let _ = index.reserve(new_cap);
        }

        for (i, id) in ids.iter().enumerate() {
            let start = i * dim;
            let v = &vec_slice[start..start + dim];
            index
                .add(*id as u64, v)
                .map_err(|e| Error::from_reason(format!("Batch add failed at {}: {:?}", i, e)))?;
        }

        tracing::debug!(count = count, "Batch added vectors");

        Ok(())
    }

    /// 向量搜索
    ///
    /// @param query - 查询向量（Float32 Buffer）
    /// @param k - 返回的最近邻数量
    #[napi]
    pub fn search(&self, query: Buffer, k: u32) -> Result<Vec<VexusSearchResult>> {
        let index = self
            .index
            .read()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        let query_slice: &[f32] = unsafe {
            std::slice::from_raw_parts(
                query.as_ptr() as *const f32,
                query.len() / std::mem::size_of::<f32>(),
            )
        };

        if query_slice.len() != self.dimensions as usize {
            return Err(Error::from_reason(format!(
                "Search dimension mismatch: expected {}, got {}",
                self.dimensions,
                query_slice.len()
            )));
        }

        let matches = index
            .search(query_slice, k as usize)
            .map_err(|e| Error::from_reason(format!("Search failed: {:?}", e)))?;

        let mut results = Vec::with_capacity(matches.keys.len());

        for (key, &dist) in matches.keys.iter().zip(matches.distances.iter()) {
            // 余弦相似度: 1 - distance (usearch 返回的是距离)
            let score = 1.0 - dist as f64;
            results.push(VexusSearchResult {
                id: *key as u32,
                score: score.max(0.0).min(1.0),
            });
        }

        Ok(results)
    }

    /// 删除向量
    #[napi]
    pub fn remove(&self, id: u32) -> Result<()> {
        let index = self
            .index
            .write()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        index
            .remove(id as u64)
            .map_err(|e| Error::from_reason(format!("Remove failed: {:?}", e)))?;

        Ok(())
    }

    /// 获取索引统计信息
    #[napi]
    pub fn stats(&self) -> Result<VexusStats> {
        let index = self
            .index
            .read()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        Ok(VexusStats {
            total_vectors: index.size() as u32,
            dimensions: self.dimensions,
            capacity: index.capacity() as u32,
            memory_usage: index.memory_usage() as u32,
        })
    }

    /// 从 SQLite 恢复索引（异步）
    ///
    /// @param db_path - SQLite 数据库路径
    /// @param table_name - 表名（如 "memories", "chunks"）
    /// @param vector_column - 向量列名（默认 "embedding"）
    #[napi]
    pub fn recover_from_sqlite(
        &self,
        db_path: String,
        table_name: String,
        vector_column: Option<String>,
    ) -> AsyncTask<RecoverTask> {
        AsyncTask::new(RecoverTask {
            index: self.index.clone(),
            db_path,
            table_name,
            vector_column: vector_column.unwrap_or_else(|| "embedding".to_string()),
            dimensions: self.dimensions,
        })
    }

    /// 检查向量是否存在
    #[napi]
    pub fn contains(&self, id: u32) -> Result<bool> {
        let index = self
            .index
            .read()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        Ok(index.contains(id as u64))
    }

    /// 获取当前向量数量
    #[napi]
    pub fn size(&self) -> Result<u32> {
        let index = self
            .index
            .read()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        Ok(index.size() as u32)
    }
}

// ==================== 异步恢复任务 ====================

pub struct RecoverTask {
    index: Arc<RwLock<Index>>,
    db_path: String,
    table_name: String,
    vector_column: String,
    dimensions: u32,
}

impl Task for RecoverTask {
    type Output = u32;
    type JsValue = u32;

    fn compute(&mut self) -> Result<Self::Output> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| Error::from_reason(format!("Failed to open DB: {}", e)))?;

        let sql = format!(
            "SELECT id, {} FROM {} WHERE {} IS NOT NULL",
            self.vector_column, self.table_name, self.vector_column
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| Error::from_reason(format!("Failed to prepare: {}", e)))?;

        let expected_byte_len = self.dimensions as usize * std::mem::size_of::<f32>();
        let mut count = 0u32;
        let mut skipped = 0u32;

        let index = self
            .index
            .write()
            .map_err(|e| Error::from_reason(format!("Lock failed: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?))
            })
            .map_err(|e| Error::from_reason(format!("Query failed: {}", e)))?;

        for row_result in rows {
            if let Ok((id, vector_bytes)) = row_result {
                if vector_bytes.len() == expected_byte_len {
                    let vec_slice: &[f32] = unsafe {
                        std::slice::from_raw_parts(
                            vector_bytes.as_ptr() as *const f32,
                            self.dimensions as usize,
                        )
                    };

                    // 自动扩容
                    if index.size() + 1 >= index.capacity() {
                        let new_cap = (index.capacity() as f64 * 1.5) as usize;
                        let _ = index.reserve(new_cap);
                    }

                    if index.add(id as u64, vec_slice).is_ok() {
                        count += 1;
                    }
                } else {
                    skipped += 1;
                }
            }
        }

        if skipped > 0 {
            tracing::warn!(
                skipped = skipped,
                expected_bytes = expected_byte_len,
                "Skipped vectors due to dimension mismatch"
            );
        }

        tracing::info!(
            recovered = count,
            table = self.table_name,
            "VexusIndex recovery complete"
        );

        Ok(count)
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}
