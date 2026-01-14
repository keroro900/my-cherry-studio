//! 中文搜索模块 (jieba-rs + Tantivy)
//!
//! 提供高性能中文全文搜索能力，使用 jieba-rs 进行中文分词，
//! Tantivy 进行全文索引和搜索。
//!
//! 特性:
//! - jieba 中文分词
//! - BM25 排序
//! - 高亮支持
//! - 混合语言支持

use jieba_rs::Jieba;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::tokenizer::{
    LowerCaser, SimpleTokenizer, TextAnalyzer, Token, TokenStream, Tokenizer,
};
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};

// 全局 jieba 实例（延迟初始化）
static JIEBA: Lazy<Jieba> = Lazy::new(Jieba::new);

// ==================== jieba 分词器 ====================

/// jieba 分词器
#[derive(Clone)]
pub struct JiebaTokenizer;

impl Tokenizer for JiebaTokenizer {
    type TokenStream<'a> = JiebaTokenStream;

    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        let tokens = JIEBA.cut(text, true); // 使用搜索模式
        let mut offset = 0;
        let tantivy_tokens: Vec<Token> = tokens
            .into_iter()
            .filter(|s| !s.trim().is_empty())
            .map(|word| {
                let start = text[offset..].find(word).map(|i| offset + i).unwrap_or(offset);
                let end = start + word.len();
                offset = end;
                Token {
                    offset_from: start,
                    offset_to: end,
                    position: 0, // 会在后面重新计算
                    text: word.to_string(),
                    position_length: 1,
                }
            })
            .collect();

        JiebaTokenStream {
            tokens: tantivy_tokens,
            index: 0,
        }
    }
}

pub struct JiebaTokenStream {
    tokens: Vec<Token>,
    index: usize,
}

impl TokenStream for JiebaTokenStream {
    fn advance(&mut self) -> bool {
        if self.index < self.tokens.len() {
            self.tokens[self.index].position = self.index;
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn token(&self) -> &Token {
        &self.tokens[self.index - 1]
    }

    fn token_mut(&mut self) -> &mut Token {
        &mut self.tokens[self.index - 1]
    }
}

// ==================== 中文搜索引擎 ====================

/// 中文搜索引擎
///
/// 使用 jieba-rs 进行中文分词，Tantivy 进行全文索引。
/// 支持中英文混合搜索。
#[napi]
pub struct ChineseSearchEngine {
    index: Arc<Index>,
    reader: Arc<IndexReader>,
    writer: Arc<RwLock<IndexWriter>>,
    schema: Schema,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    tags_field: Field,
    metadata_field: Field,
}

#[napi]
impl ChineseSearchEngine {
    /// 创建或打开中文搜索引擎
    ///
    /// @param path - 索引存储路径
    #[napi(factory)]
    pub fn open(path: String) -> Result<Self> {
        let path_buf = PathBuf::from(&path);

        // 确保目录存在
        std::fs::create_dir_all(&path_buf).map_err(|e| Error::from_reason(e.to_string()))?;

        // 创建中文分词器
        let chinese_analyzer = TextAnalyzer::builder(JiebaTokenizer)
            .filter(LowerCaser)
            .build();

        // 创建英文分词器（用于标签等）
        let english_analyzer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(LowerCaser)
            .build();

        // 定义 Schema
        let mut schema_builder = Schema::builder();

        // ID 字段（不分词，用于精确匹配）
        let id_field = schema_builder.add_text_field("id", STRING | STORED);

        // 标题字段（中文分词）
        let title_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("jieba")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        let title_field = schema_builder.add_text_field("title", title_options.clone());

        // 内容字段（中文分词）
        let content_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("jieba")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        let content_field = schema_builder.add_text_field("content", content_options);

        // 标签字段（英文分词，空格分隔）
        let tags_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("simple")
                    .set_index_option(IndexRecordOption::WithFreqs),
            )
            .set_stored();
        let tags_field = schema_builder.add_text_field("tags", tags_options);

        // 元数据字段（JSON 存储）
        let metadata_field = schema_builder.add_text_field("metadata", STORED);

        let schema = schema_builder.build();

        // 打开或创建索引
        let index = if path_buf.join("meta.json").exists() {
            Index::open_in_dir(&path_buf).map_err(|e| Error::from_reason(e.to_string()))?
        } else {
            Index::create_in_dir(&path_buf, schema.clone())
                .map_err(|e| Error::from_reason(e.to_string()))?
        };

        // 注册分词器
        index.tokenizers().register("jieba", chinese_analyzer);
        index.tokenizers().register("simple", english_analyzer);

        // 创建 Reader
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| Error::from_reason(e.to_string()))?;

        // 创建 Writer（100MB 缓冲）
        let writer = index
            .writer(100_000_000)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::info!(path = %path, "Chinese search engine opened");

        Ok(Self {
            index: Arc::new(index),
            reader: Arc::new(reader),
            writer: Arc::new(RwLock::new(writer)),
            schema,
            id_field,
            title_field,
            content_field,
            tags_field,
            metadata_field,
        })
    }

    /// 添加文档
    ///
    /// @param doc - 要添加的文档
    #[napi]
    pub fn add_document(&self, doc: ChineseSearchDocument) -> Result<()> {
        let mut writer = self.writer.write();

        let tantivy_doc = doc!(
            self.id_field => doc.id,
            self.title_field => doc.title.unwrap_or_default(),
            self.content_field => doc.content,
            self.tags_field => doc.tags.unwrap_or_default().join(" "),
            self.metadata_field => doc.metadata.unwrap_or_else(|| "{}".to_string()),
        );

        writer
            .add_document(tantivy_doc)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    /// 批量添加文档
    #[napi]
    pub fn add_documents(&self, docs: Vec<ChineseSearchDocument>) -> Result<u32> {
        let mut writer = self.writer.write();
        let mut added = 0;

        for doc in docs {
            let tantivy_doc = doc!(
                self.id_field => doc.id,
                self.title_field => doc.title.unwrap_or_default(),
                self.content_field => doc.content,
                self.tags_field => doc.tags.unwrap_or_default().join(" "),
                self.metadata_field => doc.metadata.unwrap_or_else(|| "{}".to_string()),
            );

            if writer.add_document(tantivy_doc).is_ok() {
                added += 1;
            }
        }

        tracing::debug!(added = added, "Documents added");

        Ok(added)
    }

    /// 更新文档（先删除再添加）
    #[napi]
    pub fn update_document(&self, doc: ChineseSearchDocument) -> Result<()> {
        self.delete_document(doc.id.clone())?;
        self.add_document(doc)?;
        Ok(())
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

        // 刷新 reader
        self.reader.reload().map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::debug!("Changes committed");
        Ok(())
    }

    /// 搜索
    ///
    /// @param query - 搜索查询
    /// @param limit - 返回数量限制（默认 10）
    /// @param fields - 搜索字段（可选，默认搜索 title 和 content）
    #[napi]
    pub fn search(
        &self,
        query: String,
        limit: Option<u32>,
        fields: Option<Vec<String>>,
    ) -> Result<Vec<ChineseSearchResult>> {
        let limit = limit.unwrap_or(10) as usize;
        let searcher = self.reader.searcher();

        // 确定搜索字段
        let search_fields = if let Some(f) = fields {
            f.iter()
                .filter_map(|name| self.schema.get_field(name).ok())
                .collect()
        } else {
            vec![self.title_field, self.content_field]
        };

        if search_fields.is_empty() {
            return Ok(Vec::new());
        }

        let query_parser = QueryParser::for_index(&self.index, search_fields);

        let parsed_query = query_parser
            .parse_query(&query)
            .map_err(|e| Error::from_reason(format!("Query parse error: {}", e)))?;

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

            let metadata = retrieved_doc
                .get_first(self.metadata_field)
                .and_then(|v| v.as_str())
                .map(String::from);

            results.push(ChineseSearchResult {
                id,
                title,
                content,
                tags,
                metadata,
                score: score as f64,
            });
        }

        Ok(results)
    }

    /// 使用 jieba 分词
    ///
    /// @param text - 要分词的文本
    /// @param search_mode - 是否使用搜索模式（默认 true）
    #[napi]
    pub fn tokenize(&self, text: String, search_mode: Option<bool>) -> Vec<String> {
        let use_search = search_mode.unwrap_or(true);
        if use_search {
            JIEBA.cut(&text, true).into_iter().map(String::from).collect()
        } else {
            JIEBA.cut(&text, false).into_iter().map(String::from).collect()
        }
    }

    /// 提取关键词
    ///
    /// @param text - 要提取关键词的文本
    /// @param top_k - 返回的关键词数量
    #[napi]
    pub fn extract_keywords(&self, text: String, top_k: Option<u32>) -> Vec<KeywordResult> {
        let k = top_k.unwrap_or(10) as usize;

        // 使用 jieba 分词，然后统计词频
        let words = JIEBA.cut(&text, true);
        let mut freq: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();

        for word in words {
            let trimmed = word.trim();
            // 过滤掉单字符和标点
            if trimmed.len() > 3 && !trimmed.chars().all(|c| c.is_ascii_punctuation() || c.is_whitespace()) {
                *freq.entry(trimmed).or_insert(0) += 1;
            }
        }

        // 按词频排序
        let mut sorted: Vec<_> = freq.into_iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));

        sorted
            .into_iter()
            .take(k)
            .map(|(keyword, count)| KeywordResult {
                keyword: keyword.to_string(),
                weight: count as f64,
            })
            .collect()
    }

    /// 获取统计信息
    #[napi]
    pub fn get_stats(&self) -> Result<ChineseSearchStats> {
        let searcher = self.reader.searcher();
        let num_docs = searcher.num_docs();

        Ok(ChineseSearchStats {
            document_count: num_docs as i64,
        })
    }

    /// 清空索引
    #[napi]
    pub fn clear(&self) -> Result<()> {
        let mut writer = self.writer.write();
        writer.delete_all_documents().map_err(|e| Error::from_reason(e.to_string()))?;
        writer.commit().map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }
}

// ==================== 类型定义 ====================

#[napi(object)]
#[derive(Clone)]
pub struct ChineseSearchDocument {
    /// 文档唯一 ID
    pub id: String,
    /// 标题（可选）
    pub title: Option<String>,
    /// 内容
    pub content: String,
    /// 标签列表（可选）
    pub tags: Option<Vec<String>>,
    /// 元数据 JSON（可选）
    pub metadata: Option<String>,
}

#[napi(object)]
pub struct ChineseSearchResult {
    pub id: String,
    pub title: Option<String>,
    pub content: String,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<String>,
    pub score: f64,
}

#[napi(object)]
pub struct ChineseSearchStats {
    pub document_count: i64,
}

#[napi(object)]
pub struct KeywordResult {
    pub keyword: String,
    pub weight: f64,
}

// ==================== 便捷函数 ====================

/// 使用 jieba 分词（独立函数）
#[napi]
pub fn jieba_cut(text: String, search_mode: Option<bool>) -> Vec<String> {
    let use_search = search_mode.unwrap_or(true);
    if use_search {
        JIEBA.cut(&text, true).into_iter().map(String::from).collect()
    } else {
        JIEBA.cut(&text, false).into_iter().map(String::from).collect()
    }
}

/// 提取关键词（独立函数）
#[napi]
pub fn jieba_extract_keywords(text: String, top_k: Option<u32>) -> Vec<KeywordResult> {
    let k = top_k.unwrap_or(10) as usize;

    // 使用 jieba 分词，然后统计词频
    let words = JIEBA.cut(&text, true);
    let mut freq: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();

    for word in words {
        let trimmed = word.trim();
        // 过滤掉单字符和标点
        if trimmed.len() > 3 && !trimmed.chars().all(|c| c.is_ascii_punctuation() || c.is_whitespace()) {
            *freq.entry(trimmed).or_insert(0) += 1;
        }
    }

    // 按词频排序
    let mut sorted: Vec<_> = freq.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));

    sorted
        .into_iter()
        .take(k)
        .map(|(keyword, count)| KeywordResult {
            keyword: keyword.to_string(),
            weight: count as f64,
        })
        .collect()
}
