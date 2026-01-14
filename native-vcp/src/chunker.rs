//! 文本分块模块
//!
//! 提供高性能的文本分块功能，用于知识库索引：
//! - 按 token 数量分块
//! - 支持重叠
//! - 智能边界检测（段落、句子、词）
//! - 支持中英文混合文本

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// 文本分块器
#[napi]
pub struct TextChunker {
    /// 最大 chunk 大小 (按字符数)
    max_chunk_size: usize,
    /// 重叠大小
    overlap_size: usize,
    /// 分隔符优先级（从高到低）
    separators: Vec<String>,
}

#[napi]
impl TextChunker {
    /// 创建文本分块器
    ///
    /// @param max_chunk_size - 最大 chunk 大小 (字符数，默认 1000)
    /// @param overlap_size - 重叠大小 (字符数，默认 200)
    #[napi(constructor)]
    pub fn new(max_chunk_size: Option<u32>, overlap_size: Option<u32>) -> Self {
        Self {
            max_chunk_size: max_chunk_size.unwrap_or(1000) as usize,
            overlap_size: overlap_size.unwrap_or(200) as usize,
            separators: vec![
                "\n\n".to_string(),   // 段落
                "\n".to_string(),     // 换行
                "。".to_string(),     // 中文句号
                "！".to_string(),     // 中文感叹号
                "？".to_string(),     // 中文问号
                "；".to_string(),     // 中文分号
                ". ".to_string(),     // 英文句号
                "! ".to_string(),     // 英文感叹号
                "? ".to_string(),     // 英文问号
                "; ".to_string(),     // 英文分号
                "，".to_string(),     // 中文逗号
                ", ".to_string(),     // 英文逗号
                " ".to_string(),      // 空格
            ],
        }
    }

    /// 设置自定义分隔符
    #[napi]
    pub fn set_separators(&mut self, separators: Vec<String>) {
        self.separators = separators;
    }

    /// 分块文本
    ///
    /// @param text - 要分块的文本
    /// @returns 分块结果列表
    #[napi]
    pub fn chunk(&self, text: String) -> Vec<TextChunk> {
        if text.is_empty() {
            return vec![];
        }

        let text_len = text.chars().count();
        if text_len <= self.max_chunk_size {
            return vec![TextChunk {
                content: text.clone(),
                start_offset: 0,
                end_offset: text.len() as u32,
                char_count: text_len as u32,
                index: 0,
            }];
        }

        self.recursive_split(&text, 0, 0)
    }

    /// 递归分块
    fn recursive_split(&self, text: &str, start_offset: usize, start_index: u32) -> Vec<TextChunk> {
        let char_count = text.chars().count();

        if char_count <= self.max_chunk_size {
            return vec![TextChunk {
                content: text.to_string(),
                start_offset: start_offset as u32,
                end_offset: (start_offset + text.len()) as u32,
                char_count: char_count as u32,
                index: start_index,
            }];
        }

        // 尝试使用各级分隔符分割
        for sep in &self.separators {
            let parts: Vec<&str> = text.split(sep).collect();
            if parts.len() > 1 {
                return self.merge_splits(parts, sep, start_offset, start_index);
            }
        }

        // 如果没有分隔符，强制按字符数分割
        self.force_split(text, start_offset, start_index)
    }

    /// 合并分割的部分
    fn merge_splits(
        &self,
        parts: Vec<&str>,
        sep: &str,
        start_offset: usize,
        start_index: u32,
    ) -> Vec<TextChunk> {
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();
        let mut current_offset = start_offset;
        let mut chunk_start_offset = start_offset;
        let mut index = start_index;

        for (i, part) in parts.iter().enumerate() {
            let part_with_sep = if i < parts.len() - 1 {
                format!("{}{}", part, sep)
            } else {
                part.to_string()
            };

            let potential_size = current_chunk.chars().count() + part_with_sep.chars().count();

            if potential_size > self.max_chunk_size && !current_chunk.is_empty() {
                // 保存当前 chunk
                let chunk_content = current_chunk.clone();
                let char_count = chunk_content.chars().count();

                chunks.push(TextChunk {
                    content: chunk_content.clone(),
                    start_offset: chunk_start_offset as u32,
                    end_offset: (chunk_start_offset + current_chunk.len()) as u32,
                    char_count: char_count as u32,
                    index,
                });
                index += 1;

                // 添加重叠
                let overlap_start = if char_count > self.overlap_size {
                    char_count - self.overlap_size
                } else {
                    0
                };
                current_chunk = chunk_content
                    .chars()
                    .skip(overlap_start)
                    .collect::<String>();

                chunk_start_offset = current_offset - current_chunk.len();
            }

            current_chunk.push_str(&part_with_sep);
            current_offset += part_with_sep.len();
        }

        // 处理剩余内容
        if !current_chunk.is_empty() {
            let char_count = current_chunk.chars().count();
            if char_count > self.max_chunk_size {
                // 递归处理过大的 chunk
                chunks.extend(self.recursive_split(&current_chunk, chunk_start_offset, index));
            } else {
                chunks.push(TextChunk {
                    content: current_chunk.clone(),
                    start_offset: chunk_start_offset as u32,
                    end_offset: (chunk_start_offset + current_chunk.len()) as u32,
                    char_count: char_count as u32,
                    index,
                });
            }
        }

        chunks
    }

    /// 强制按字符数分割
    fn force_split(&self, text: &str, start_offset: usize, start_index: u32) -> Vec<TextChunk> {
        let mut chunks = Vec::new();
        let chars: Vec<char> = text.chars().collect();
        let mut index = start_index;
        let mut byte_offset = start_offset;
        let mut i = 0;

        while i < chars.len() {
            let end = std::cmp::min(i + self.max_chunk_size, chars.len());
            let chunk_chars: String = chars[i..end].iter().collect();
            let chunk_len = chunk_chars.len();

            chunks.push(TextChunk {
                content: chunk_chars.clone(),
                start_offset: byte_offset as u32,
                end_offset: (byte_offset + chunk_len) as u32,
                char_count: (end - i) as u32,
                index,
            });

            byte_offset += chunk_len;
            index += 1;

            // 计算下一个起始位置（考虑重叠）
            let step = if self.max_chunk_size > self.overlap_size {
                self.max_chunk_size - self.overlap_size
            } else {
                self.max_chunk_size
            };
            i += step;
        }

        chunks
    }

    /// 批量分块
    #[napi]
    pub fn chunk_batch(&self, texts: Vec<String>) -> Vec<ChunkBatchResult> {
        texts
            .into_iter()
            .enumerate()
            .map(|(doc_index, text)| {
                let chunks = self.chunk(text);
                ChunkBatchResult {
                    doc_index: doc_index as u32,
                    chunks,
                }
            })
            .collect()
    }

    /// 估算 token 数量 (粗略估算)
    ///
    /// 中文约 1.5 字符/token，英文约 4 字符/token
    #[napi]
    pub fn estimate_tokens(&self, text: String) -> u32 {
        let mut chinese_chars = 0;
        let mut other_chars = 0;

        for c in text.chars() {
            if c >= '\u{4e00}' && c <= '\u{9fff}' {
                chinese_chars += 1;
            } else if !c.is_whitespace() {
                other_chars += 1;
            }
        }

        // 中文约 1.5 字符/token，英文约 4 字符/token
        ((chinese_chars as f64 / 1.5) + (other_chars as f64 / 4.0)) as u32
    }

    /// 按 token 数量分块
    ///
    /// @param text - 文本
    /// @param max_tokens - 最大 token 数
    /// @param overlap_tokens - 重叠 token 数
    #[napi]
    pub fn chunk_by_tokens(
        &self,
        text: String,
        max_tokens: Option<u32>,
        overlap_tokens: Option<u32>,
    ) -> Vec<TextChunk> {
        let max_tokens = max_tokens.unwrap_or(500);
        let overlap_tokens = overlap_tokens.unwrap_or(50);

        // 估算字符数
        let max_chars = (max_tokens as f64 * 2.5) as usize; // 平均估算
        let overlap_chars = (overlap_tokens as f64 * 2.5) as usize;

        let chunker = TextChunker {
            max_chunk_size: max_chars,
            overlap_size: overlap_chars,
            separators: self.separators.clone(),
        };

        chunker.chunk(text)
    }

    /// 获取分块器配置
    #[napi]
    pub fn get_config(&self) -> ChunkerConfig {
        ChunkerConfig {
            max_chunk_size: self.max_chunk_size as u32,
            overlap_size: self.overlap_size as u32,
            separators: self.separators.clone(),
        }
    }
}

// ==================== 数据类型 ====================

/// 文本块
#[napi(object)]
#[derive(Clone)]
pub struct TextChunk {
    /// 块内容
    pub content: String,
    /// 在原文中的起始字节偏移
    pub start_offset: u32,
    /// 在原文中的结束字节偏移
    pub end_offset: u32,
    /// 字符数
    pub char_count: u32,
    /// 块索引
    pub index: u32,
}

/// 批量分块结果
#[napi(object)]
pub struct ChunkBatchResult {
    /// 文档索引
    pub doc_index: u32,
    /// 分块列表
    pub chunks: Vec<TextChunk>,
}

/// 分块器配置
#[napi(object)]
pub struct ChunkerConfig {
    pub max_chunk_size: u32,
    pub overlap_size: u32,
    pub separators: Vec<String>,
}

// ==================== 便捷函数 ====================

/// 快速分块 (使用默认配置)
#[napi]
pub fn quick_chunk(text: String, max_size: Option<u32>, overlap: Option<u32>) -> Vec<TextChunk> {
    let chunker = TextChunker::new(max_size, overlap);
    chunker.chunk(text)
}

/// 估算 token 数量
#[napi]
pub fn estimate_token_count(text: String) -> u32 {
    let chunker = TextChunker::new(None, None);
    chunker.estimate_tokens(text)
}
