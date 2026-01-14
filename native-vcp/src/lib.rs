//! Native VCP Runtime
//!
//! 高性能原生模块，为 Cherry Studio 提供：
//! - VexusIndex - HNSW 向量索引（从 VCP rust-vexus-lite 移植）
//! - CooccurrenceMatrix - NPMI 标签共现矩阵
//! - SemanticGroupMatcher - 语义组匹配
//! - ChineseSearchEngine - jieba-rs + Tantivy 中文全文搜索
//! - TagMemo 标签共现矩阵（向量级运算）
//! - 统一数据库层（SQLite/LibSQL）
//! - 向量相似度计算
//! - 全链路追踪日志

#![deny(clippy::all)]

mod chinese_search;
mod chunker;
mod cooccurrence;
mod database;
mod hybrid_search;
mod search;
mod semantic_group;
mod tagmemo;
mod tracing_bridge;
mod vector;
mod vexus;
mod waverag;

use napi::bindgen_prelude::*;
use napi_derive::napi;

// 核心模块导出
pub use chinese_search::*;
pub use chunker::*;
pub use cooccurrence::*;
pub use database::*;
pub use hybrid_search::*;
pub use search::*;
pub use semantic_group::*;
pub use tagmemo::*;
pub use tracing_bridge::*;
pub use vector::*;
pub use vexus::*;
pub use waverag::*;

/// 模块版本
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 初始化原生模块
#[napi]
pub fn initialize(config: NativeVCPConfig) -> Result<()> {
    // 初始化日志
    tracing_bridge::init_tracing(&config.log_level.unwrap_or_else(|| "info".to_string()))?;

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "Native VCP Runtime initialized"
    );

    Ok(())
}

/// 原生模块配置
#[napi(object)]
#[derive(Debug, Clone)]
pub struct NativeVCPConfig {
    /// 数据目录
    pub data_dir: String,
    /// 日志级别 (trace, debug, info, warn, error)
    pub log_level: Option<String>,
    /// 是否启用全文搜索
    pub enable_search: Option<bool>,
    /// 向量维度
    pub vector_dim: Option<u32>,
}

/// 健康检查
#[napi]
pub fn health_check() -> HealthStatus {
    HealthStatus {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        features: vec![
            "tagmemo".to_string(),
            "tagmemo_boost".to_string(),
            "database".to_string(),
            "diary".to_string(),
            "vector".to_string(),
            "search".to_string(),
            "chinese_search".to_string(),
            "hybrid_search".to_string(),
            "waverag".to_string(),
            "chunker".to_string(),
            "tracing".to_string(),
        ],
    }
}

#[napi(object)]
pub struct HealthStatus {
    pub status: String,
    pub version: String,
    pub features: Vec<String>,
}
