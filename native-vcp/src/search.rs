//! Tantivy 全文搜索模块
//!
//! 提供高性能全文搜索能力

use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};

/// 全文搜索引擎
#[napi]
pub struct SearchEngine {
    index: Arc<Index>,
    reader: Arc<IndexReader>,
    writer: Arc<RwLock<IndexWriter>>,
    schema: Schema,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    tags_field: Field,
}

#[napi]
impl SearchEngine {
    /// 创建或打开搜索引擎
    #[napi(factory)]
    pub fn open(path: String) -> Result<Self> {
        let path_buf = PathBuf::from(&path);

        // 确保目录存在
        std::fs::create_dir_all(&path_buf).map_err(|e| Error::from_reason(e.to_string()))?;

        // 定义 Schema
        let mut schema_builder = Schema::builder();

        let id_field = schema_builder.add_text_field("id", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT | STORED);
        let tags_field = schema_builder.add_text_field("tags", TEXT | STORED);

        let schema = schema_builder.build();

        // 打开或创建索引
        let index = if path_buf.join("meta.json").exists() {
            Index::open_in_dir(&path_buf).map_err(|e| Error::from_reason(e.to_string()))?
        } else {
            Index::create_in_dir(&path_buf, schema.clone())
                .map_err(|e| Error::from_reason(e.to_string()))?
        };

        // 创建 Reader
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| Error::from_reason(e.to_string()))?;

        // 创建 Writer
        let writer = index
            .writer(50_000_000) // 50MB 缓冲
            .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::info!(path = %path, "Search engine opened");

        Ok(Self {
            index: Arc::new(index),
            reader: Arc::new(reader),
            writer: Arc::new(RwLock::new(writer)),
            schema,
            id_field,
            title_field,
            content_field,
            tags_field,
        })
    }

    /// 添加文档
    #[napi]
    pub fn add_document(&self, doc: SearchDocument) -> Result<()> {
        let mut writer = self.writer.write();

        let tantivy_doc = doc!(
            self.id_field => doc.id,
            self.title_field => doc.title.unwrap_or_default(),
            self.content_field => doc.content,
            self.tags_field => doc.tags.unwrap_or_default().join(" "),
        );

        writer
            .add_document(tantivy_doc)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    /// 批量添加文档
    #[napi]
    pub fn add_documents(&self, docs: Vec<SearchDocument>) -> Result<u32> {
        let mut writer = self.writer.write();
        let mut added = 0;

        for doc in docs {
            let tantivy_doc = doc!(
                self.id_field => doc.id,
                self.title_field => doc.title.unwrap_or_default(),
                self.content_field => doc.content,
                self.tags_field => doc.tags.unwrap_or_default().join(" "),
            );

            if writer.add_document(tantivy_doc).is_ok() {
                added += 1;
            }
        }

        Ok(added)
    }

    /// 删除文档
    #[napi]
    pub fn delete_document(&self, id: String) -> Result<()> {
        let mut writer = self.writer.write();
        let term = tantivy::Term::from_field_text(self.id_field, &id);
        writer.delete_term(term);
        Ok(())
    }

    /// 提交更改
    #[napi]
    pub fn commit(&self) -> Result<()> {
        let mut writer = self.writer.write();
        writer
            .commit()
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// 搜索
    #[napi]
    pub fn search(&self, query: String, limit: Option<u32>) -> Result<Vec<SearchResult>> {
        let limit = limit.unwrap_or(10) as usize;
        let searcher = self.reader.searcher();

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![self.title_field, self.content_field, self.tags_field],
        );

        let parsed_query = query_parser
            .parse_query(&query)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let top_docs = searcher
            .search(&parsed_query, &TopDocs::with_limit(limit))
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::with_capacity(top_docs.len());

        for (score, doc_address) in top_docs {
            let retrieved_doc: tantivy::TantivyDocument = searcher
                .doc(doc_address)
                .map_err(|e| Error::from_reason(e.to_string()))?;

            let id = retrieved_doc
                .get_first(self.id_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title_field)
                .and_then(|v| v.as_str())
                .map(String::from);

            let content = retrieved_doc
                .get_first(self.content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let tags = retrieved_doc
                .get_first(self.tags_field)
                .and_then(|v| v.as_str())
                .map(|s| s.split_whitespace().map(String::from).collect());

            results.push(SearchResult {
                id,
                title,
                content,
                tags,
                score: score as f64,
            });
        }

        Ok(results)
    }

    /// 获取统计信息
    #[napi]
    pub fn get_stats(&self) -> Result<SearchStats> {
        let searcher = self.reader.searcher();
        let num_docs = searcher.num_docs();

        Ok(SearchStats {
            document_count: num_docs as i64,
        })
    }
}

#[napi(object)]
#[derive(Clone)]
pub struct SearchDocument {
    pub id: String,
    pub title: Option<String>,
    pub content: String,
    pub tags: Option<Vec<String>>,
}

#[napi(object)]
pub struct SearchResult {
    pub id: String,
    pub title: Option<String>,
    pub content: String,
    pub tags: Option<Vec<String>>,
    pub score: f64,
}

#[napi(object)]
pub struct SearchStats {
    pub document_count: i64,
}
