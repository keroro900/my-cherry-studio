//! 统一数据库层
//!
//! 使用 rusqlite 提供统一的数据库接口：
//! - 记忆存储
//! - 知识库
//! - 日记
//! - 标签池

use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::RwLock;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Arc;

/// 统一数据库
#[napi]
pub struct UnifiedDatabase {
    conn: Arc<RwLock<Connection>>,
    path: PathBuf,
}

#[napi]
impl UnifiedDatabase {
    /// 打开或创建数据库
    #[napi(factory)]
    pub fn open(path: String) -> Result<Self> {
        let path_buf = PathBuf::from(&path);

        // 确保目录存在
        if let Some(parent) = path_buf.parent() {
            std::fs::create_dir_all(parent).map_err(|e| Error::from_reason(e.to_string()))?;
        }

        let conn =
            Connection::open(&path_buf).map_err(|e| Error::from_reason(e.to_string()))?;

        // 启用 WAL 模式
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA foreign_keys = ON;
            ",
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        let db = Self {
            conn: Arc::new(RwLock::new(conn)),
            path: path_buf,
        };

        // 初始化表结构
        db.init_schema()?;

        tracing::info!(path = %path, "Database opened");

        Ok(db)
    }

    /// 初始化数据库架构
    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.write();

        conn.execute_batch(
            r#"
            -- 记忆表
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB,
                tags TEXT,
                importance REAL DEFAULT 0.5,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                metadata TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
            CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);

            -- 知识库表
            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT NOT NULL,
                embedding BLOB,
                source TEXT,
                kb_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                metadata TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_knowledge_kb ON knowledge(kb_name);

            -- 日记表
            CREATE TABLE IF NOT EXISTS diary (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                embedding BLOB,
                book_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_diary_date ON diary(date);
            CREATE INDEX IF NOT EXISTS idx_diary_book ON diary(book_name);

            -- 标签池表
            CREATE TABLE IF NOT EXISTS tag_pool (
                tag TEXT PRIMARY KEY,
                frequency INTEGER DEFAULT 1,
                last_used TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tag_frequency ON tag_pool(frequency DESC);

            -- 标签共现表
            CREATE TABLE IF NOT EXISTS tag_cooccurrence (
                tag1 TEXT NOT NULL,
                tag2 TEXT NOT NULL,
                count REAL DEFAULT 1.0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (tag1, tag2)
            );

            -- 全链路追踪日志表
            CREATE TABLE IF NOT EXISTS trace_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trace_id TEXT NOT NULL,
                span_id TEXT,
                parent_span_id TEXT,
                operation TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT,
                metadata TEXT,
                duration_ms INTEGER,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_trace_logs_trace_id ON trace_logs(trace_id);
            CREATE INDEX IF NOT EXISTS idx_trace_logs_created ON trace_logs(created_at);

            -- 调度任务表
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                task_type TEXT NOT NULL,
                cron_expression TEXT,
                enabled INTEGER DEFAULT 1,
                payload TEXT,
                priority INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                timeout_ms INTEGER DEFAULT 30000,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON scheduled_tasks(task_type);
            CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);

            -- 任务执行日志表
            CREATE TABLE IF NOT EXISTS task_execution_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                task_name TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                status TEXT NOT NULL,
                result TEXT,
                error TEXT,
                duration_ms INTEGER,
                retry_count INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_execution_logs(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_logs_started ON task_execution_logs(started_at);
            CREATE INDEX IF NOT EXISTS idx_task_logs_status ON task_execution_logs(status);
            "#,
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    // ==================== 记忆操作 ====================

    /// 保存记忆
    #[napi]
    pub fn save_memory(&self, memory: MemoryRecord) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO memories (id, content, embedding, tags, importance, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                memory.id,
                memory.content,
                memory.embedding.as_deref(),
                memory.tags.as_ref().map(|t| t.join(",")),
                memory.importance.unwrap_or(0.5),
                memory.created_at.as_deref().unwrap_or(&now),
                now,
                memory.metadata,
            ],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    /// 搜索记忆
    #[napi]
    pub fn search_memories(&self, query: MemoryQuery) -> Result<Vec<MemoryRecord>> {
        let conn = self.conn.read();
        let limit = query.limit.unwrap_or(10);

        let sql = format!(
            "SELECT id, content, embedding, tags, importance, created_at, updated_at, metadata
             FROM memories
             WHERE content LIKE ?1
             ORDER BY importance DESC, updated_at DESC
             LIMIT {}",
            limit
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let pattern = format!("%{}%", query.text.as_deref().unwrap_or(""));

        let rows = stmt
            .query_map([pattern], |row| {
                Ok(MemoryRecord {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    embedding: row.get::<_, Option<Vec<u8>>>(2)?,
                    tags: row
                        .get::<_, Option<String>>(3)?
                        .map(|s| s.split(',').map(String::from).collect()),
                    importance: Some(row.get(4)?),
                    created_at: Some(row.get(5)?),
                    updated_at: Some(row.get(6)?),
                    metadata: row.get(7)?,
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    // ==================== 日志追踪 ====================

    /// 记录追踪日志
    #[napi]
    pub fn log_trace(&self, log: TraceLog) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO trace_logs (trace_id, span_id, parent_span_id, operation, level, message, metadata, duration_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                log.trace_id,
                log.span_id,
                log.parent_span_id,
                log.operation,
                log.level,
                log.message,
                log.metadata,
                log.duration_ms,
                now,
            ],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(())
    }

    /// 查询追踪日志
    #[napi]
    pub fn query_traces(&self, query: TraceQuery) -> Result<Vec<TraceLog>> {
        let conn = self.conn.read();
        let limit = query.limit.unwrap_or(100);

        let mut sql = String::from(
            "SELECT trace_id, span_id, parent_span_id, operation, level, message, metadata, duration_ms, created_at
             FROM trace_logs WHERE 1=1",
        );

        if query.trace_id.is_some() {
            sql.push_str(" AND trace_id = ?1");
        }

        if query.level.is_some() {
            sql.push_str(" AND level = ?2");
        }

        sql.push_str(&format!(" ORDER BY created_at DESC LIMIT {}", limit));

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(TraceLog {
                    trace_id: row.get(0)?,
                    span_id: row.get(1)?,
                    parent_span_id: row.get(2)?,
                    operation: row.get(3)?,
                    level: row.get(4)?,
                    message: row.get(5)?,
                    metadata: row.get(6)?,
                    duration_ms: row.get(7)?,
                    created_at: Some(row.get(8)?),
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    /// 获取数据库统计
    #[napi]
    pub fn get_stats(&self) -> Result<DatabaseStats> {
        let conn = self.conn.read();

        let memory_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM memories", [], |row| row.get(0))
            .unwrap_or(0);

        let knowledge_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM knowledge", [], |row| row.get(0))
            .unwrap_or(0);

        let diary_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM diary", [], |row| row.get(0))
            .unwrap_or(0);

        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tag_pool", [], |row| row.get(0))
            .unwrap_or(0);

        let trace_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM trace_logs", [], |row| row.get(0))
            .unwrap_or(0);

        // 获取文件大小
        let file_size = std::fs::metadata(&self.path)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(DatabaseStats {
            memory_count: memory_count as i64,
            knowledge_count: knowledge_count as i64,
            diary_count: diary_count as i64,
            tag_count: tag_count as i64,
            trace_count: trace_count as i64,
            file_size_bytes: file_size as i64,
            path: self.path.to_string_lossy().to_string(),
        })
    }

    /// 执行 VACUUM
    #[napi]
    pub fn vacuum(&self) -> Result<()> {
        let conn = self.conn.write();
        conn.execute_batch("VACUUM;")
            .map_err(|e| Error::from_reason(e.to_string()))?;
        tracing::info!("Database vacuumed");
        Ok(())
    }

    // ==================== 日记操作 ====================

    /// 保存日记
    #[napi]
    pub fn save_diary(&self, diary: DiaryRecord) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO diary (id, date, content, tags, embedding, book_name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                diary.id,
                diary.date,
                diary.content,
                diary.tags.as_ref().map(|t| t.join(",")),
                diary.embedding.as_deref(),
                diary.book_name,
                diary.created_at.as_deref().unwrap_or(&now),
                now,
            ],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::debug!(id = %diary.id, "Diary saved");
        Ok(())
    }

    /// 获取日记
    #[napi]
    pub fn get_diary(&self, id: String) -> Result<Option<DiaryRecord>> {
        let conn = self.conn.read();

        let result = conn.query_row(
            "SELECT id, date, content, tags, embedding, book_name, created_at, updated_at
             FROM diary WHERE id = ?1",
            [&id],
            |row| {
                Ok(DiaryRecord {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    content: row.get(2)?,
                    tags: row
                        .get::<_, Option<String>>(3)?
                        .map(|s| s.split(',').map(String::from).collect()),
                    embedding: row.get::<_, Option<Vec<u8>>>(4)?,
                    book_name: row.get(5)?,
                    created_at: Some(row.get(6)?),
                    updated_at: Some(row.get(7)?),
                })
            },
        );

        match result {
            Ok(diary) => Ok(Some(diary)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    /// 删除日记
    #[napi]
    pub fn delete_diary(&self, id: String) -> Result<bool> {
        let conn = self.conn.write();

        let deleted = conn
            .execute("DELETE FROM diary WHERE id = ?1", [&id])
            .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::debug!(id = %id, deleted = deleted > 0, "Diary deleted");
        Ok(deleted > 0)
    }

    /// 按日期范围查询日记
    #[napi]
    pub fn query_diary_by_date_range(&self, query: DiaryDateQuery) -> Result<Vec<DiaryRecord>> {
        let conn = self.conn.read();
        let limit = query.limit.unwrap_or(100);

        let mut sql = String::from(
            "SELECT id, date, content, tags, embedding, book_name, created_at, updated_at
             FROM diary WHERE 1=1",
        );

        let mut params_vec: Vec<String> = Vec::new();

        if let Some(ref start) = query.start_date {
            sql.push_str(&format!(" AND date >= ?{}", params_vec.len() + 1));
            params_vec.push(start.clone());
        }

        if let Some(ref end) = query.end_date {
            sql.push_str(&format!(" AND date <= ?{}", params_vec.len() + 1));
            params_vec.push(end.clone());
        }

        if let Some(ref book) = query.book_name {
            sql.push_str(&format!(" AND book_name = ?{}", params_vec.len() + 1));
            params_vec.push(book.clone());
        }

        sql.push_str(&format!(" ORDER BY date DESC LIMIT {}", limit));

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

        let rows = stmt
            .query_map(param_refs.as_slice(), |row| {
                Ok(DiaryRecord {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    content: row.get(2)?,
                    tags: row
                        .get::<_, Option<String>>(3)?
                        .map(|s| s.split(',').map(String::from).collect()),
                    embedding: row.get::<_, Option<Vec<u8>>>(4)?,
                    book_name: row.get(5)?,
                    created_at: Some(row.get(6)?),
                    updated_at: Some(row.get(7)?),
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    /// 搜索日记 (全文搜索)
    #[napi]
    pub fn search_diary(&self, query: DiarySearchQuery) -> Result<Vec<DiaryRecord>> {
        let conn = self.conn.read();
        let limit = query.limit.unwrap_or(20);
        let pattern = format!("%{}%", query.keyword);

        let results: Vec<DiaryRecord> = if let Some(ref book) = query.book_name {
            let sql = format!(
                "SELECT id, date, content, tags, embedding, book_name, created_at, updated_at
                 FROM diary WHERE content LIKE ?1 AND book_name = ?2
                 ORDER BY date DESC LIMIT {}",
                limit
            );

            let mut stmt = conn
                .prepare(&sql)
                .map_err(|e| Error::from_reason(e.to_string()))?;

            let rows = stmt
                .query_map([&pattern, book], |row| {
                    Ok(DiaryRecord {
                        id: row.get(0)?,
                        date: row.get(1)?,
                        content: row.get(2)?,
                        tags: row
                            .get::<_, Option<String>>(3)?
                            .map(|s| s.split(',').map(String::from).collect()),
                        embedding: row.get::<_, Option<Vec<u8>>>(4)?,
                        book_name: row.get(5)?,
                        created_at: Some(row.get(6)?),
                        updated_at: Some(row.get(7)?),
                    })
                })
                .map_err(|e| Error::from_reason(e.to_string()))?;

            rows.filter_map(|r| r.ok()).collect()
        } else {
            let sql = format!(
                "SELECT id, date, content, tags, embedding, book_name, created_at, updated_at
                 FROM diary WHERE content LIKE ?1
                 ORDER BY date DESC LIMIT {}",
                limit
            );

            let mut stmt = conn
                .prepare(&sql)
                .map_err(|e| Error::from_reason(e.to_string()))?;

            let rows = stmt
                .query_map([&pattern], |row| {
                    Ok(DiaryRecord {
                        id: row.get(0)?,
                        date: row.get(1)?,
                        content: row.get(2)?,
                        tags: row
                            .get::<_, Option<String>>(3)?
                            .map(|s| s.split(',').map(String::from).collect()),
                        embedding: row.get::<_, Option<Vec<u8>>>(4)?,
                        book_name: row.get(5)?,
                        created_at: Some(row.get(6)?),
                        updated_at: Some(row.get(7)?),
                    })
                })
                .map_err(|e| Error::from_reason(e.to_string()))?;

            rows.filter_map(|r| r.ok()).collect()
        };

        Ok(results)
    }

    /// 按标签查询日记
    #[napi]
    pub fn query_diary_by_tags(&self, tags: Vec<String>, limit: Option<u32>) -> Result<Vec<DiaryRecord>> {
        let conn = self.conn.read();
        let limit = limit.unwrap_or(50);

        // 构建 OR 条件匹配任一标签
        let tag_conditions: Vec<String> = tags
            .iter()
            .enumerate()
            .map(|(i, _)| format!("tags LIKE ?{}", i + 1))
            .collect();

        let sql = format!(
            "SELECT id, date, content, tags, embedding, book_name, created_at, updated_at
             FROM diary WHERE {}
             ORDER BY date DESC LIMIT {}",
            tag_conditions.join(" OR "),
            limit
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let patterns: Vec<String> = tags.iter().map(|t| format!("%{}%", t)).collect();
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            patterns.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

        let rows = stmt
            .query_map(param_refs.as_slice(), |row| {
                Ok(DiaryRecord {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    content: row.get(2)?,
                    tags: row
                        .get::<_, Option<String>>(3)?
                        .map(|s| s.split(',').map(String::from).collect()),
                    embedding: row.get::<_, Option<Vec<u8>>>(4)?,
                    book_name: row.get(5)?,
                    created_at: Some(row.get(6)?),
                    updated_at: Some(row.get(7)?),
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    /// 列出所有日记本
    #[napi]
    pub fn list_diary_books(&self) -> Result<Vec<DiaryBookInfo>> {
        let conn = self.conn.read();

        let mut stmt = conn
            .prepare(
                "SELECT book_name, COUNT(*) as count, MAX(date) as latest_date
                 FROM diary
                 GROUP BY book_name
                 ORDER BY latest_date DESC",
            )
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(DiaryBookInfo {
                    book_name: row.get(0)?,
                    entry_count: row.get(1)?,
                    latest_date: row.get(2)?,
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    /// 获取日记统计信息
    #[napi]
    pub fn get_diary_stats(&self, book_name: Option<String>) -> Result<DiaryStats> {
        let conn = self.conn.read();

        let (total_count, total_words): (i64, i64) = if let Some(ref book) = book_name {
            conn.query_row(
                "SELECT COUNT(*), COALESCE(SUM(LENGTH(content)), 0)
                 FROM diary WHERE book_name = ?1",
                [book],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((0, 0))
        } else {
            conn.query_row(
                "SELECT COUNT(*), COALESCE(SUM(LENGTH(content)), 0) FROM diary",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((0, 0))
        };

        let first_date: Option<String> = if let Some(ref book) = book_name {
            conn.query_row(
                "SELECT MIN(date) FROM diary WHERE book_name = ?1",
                [book],
                |row| row.get(0),
            )
            .ok()
        } else {
            conn.query_row("SELECT MIN(date) FROM diary", [], |row| row.get(0))
                .ok()
        };

        let last_date: Option<String> = if let Some(ref book) = book_name {
            conn.query_row(
                "SELECT MAX(date) FROM diary WHERE book_name = ?1",
                [book],
                |row| row.get(0),
            )
            .ok()
        } else {
            conn.query_row("SELECT MAX(date) FROM diary", [], |row| row.get(0))
                .ok()
        };

        // 获取标签统计
        let top_tags: Vec<(String, i64)> = {
            let sql = if book_name.is_some() {
                "SELECT tags FROM diary WHERE book_name = ?1 AND tags IS NOT NULL"
            } else {
                "SELECT tags FROM diary WHERE tags IS NOT NULL"
            };

            let mut tag_counts: std::collections::HashMap<String, i64> =
                std::collections::HashMap::new();

            if let Ok(mut stmt) = conn.prepare(sql) {
                let rows: Vec<String> = if let Some(ref book) = book_name {
                    stmt.query_map([book], |row| row.get::<_, String>(0))
                        .ok()
                        .map(|r| r.filter_map(|x| x.ok()).collect())
                        .unwrap_or_default()
                } else {
                    stmt.query_map([], |row| row.get::<_, String>(0))
                        .ok()
                        .map(|r| r.filter_map(|x| x.ok()).collect())
                        .unwrap_or_default()
                };

                for tags_str in rows {
                    for tag in tags_str.split(',') {
                        let tag = tag.trim().to_string();
                        if !tag.is_empty() {
                            *tag_counts.entry(tag).or_insert(0) += 1;
                        }
                    }
                }
            }

            let mut sorted: Vec<_> = tag_counts.into_iter().collect();
            sorted.sort_by(|a, b| b.1.cmp(&a.1));
            sorted.truncate(10);
            sorted
        };

        Ok(DiaryStats {
            total_entries: total_count,
            total_words,
            first_entry_date: first_date,
            last_entry_date: last_date,
            top_tags: top_tags
                .into_iter()
                .map(|(tag, count)| TagCount { tag, count })
                .collect(),
            book_name,
        })
    }

    /// 批量保存日记
    #[napi]
    pub fn batch_save_diary(&self, diaries: Vec<DiaryRecord>) -> Result<u32> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();
        let mut saved = 0;

        for diary in diaries {
            if conn
                .execute(
                    "INSERT OR REPLACE INTO diary (id, date, content, tags, embedding, book_name, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        diary.id,
                        diary.date,
                        diary.content,
                        diary.tags.as_ref().map(|t| t.join(",")),
                        diary.embedding.as_deref(),
                        diary.book_name,
                        diary.created_at.as_deref().unwrap_or(&now),
                        now,
                    ],
                )
                .is_ok()
            {
                saved += 1;
            }
        }

        tracing::info!(saved = saved, "Batch diary save completed");
        Ok(saved)
    }

    // ==================== 调度任务操作 ====================

    /// 保存调度任务
    #[napi]
    pub fn save_scheduled_task(&self, task: ScheduledTask) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO scheduled_tasks
             (id, name, task_type, cron_expression, enabled, payload, priority, max_retries, timeout_ms, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                task.id,
                task.name,
                task.task_type,
                task.cron_expression,
                if task.enabled.unwrap_or(true) { 1 } else { 0 },
                task.payload,
                task.priority.unwrap_or(0),
                task.max_retries.unwrap_or(3),
                task.timeout_ms.unwrap_or(30000),
                task.created_at.as_deref().unwrap_or(&now),
                now,
            ],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::debug!(task_id = %task.id, task_name = %task.name, "Scheduled task saved");
        Ok(())
    }

    /// 获取调度任务
    #[napi]
    pub fn get_scheduled_task(&self, id: String) -> Result<Option<ScheduledTask>> {
        let conn = self.conn.read();

        let result: std::result::Result<ScheduledTask, rusqlite::Error> = conn.query_row(
            "SELECT id, name, task_type, cron_expression, enabled, payload, priority, max_retries, timeout_ms, created_at, updated_at
             FROM scheduled_tasks WHERE id = ?1",
            [&id],
            |row| {
                Ok(ScheduledTask {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    task_type: row.get(2)?,
                    cron_expression: row.get(3)?,
                    enabled: Some(row.get::<_, i32>(4)? == 1),
                    payload: row.get(5)?,
                    priority: Some(row.get(6)?),
                    max_retries: Some(row.get(7)?),
                    timeout_ms: Some(row.get(8)?),
                    created_at: Some(row.get(9)?),
                    updated_at: Some(row.get(10)?),
                })
            },
        );

        match result {
            Ok(task) => Ok(Some(task)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    /// 删除调度任务
    #[napi]
    pub fn delete_scheduled_task(&self, id: String) -> Result<bool> {
        let conn = self.conn.write();
        let affected = conn
            .execute("DELETE FROM scheduled_tasks WHERE id = ?1", [&id])
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 列出所有调度任务
    #[napi]
    pub fn list_scheduled_tasks(&self, enabled_only: Option<bool>) -> Result<Vec<ScheduledTask>> {
        let conn = self.conn.read();

        let sql = if enabled_only.unwrap_or(false) {
            "SELECT id, name, task_type, cron_expression, enabled, payload, priority, max_retries, timeout_ms, created_at, updated_at
             FROM scheduled_tasks WHERE enabled = 1 ORDER BY priority DESC, created_at DESC"
        } else {
            "SELECT id, name, task_type, cron_expression, enabled, payload, priority, max_retries, timeout_ms, created_at, updated_at
             FROM scheduled_tasks ORDER BY priority DESC, created_at DESC"
        };

        let mut stmt = conn.prepare(sql).map_err(|e| Error::from_reason(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(ScheduledTask {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    task_type: row.get(2)?,
                    cron_expression: row.get(3)?,
                    enabled: Some(row.get::<_, i32>(4)? == 1),
                    payload: row.get(5)?,
                    priority: Some(row.get(6)?),
                    max_retries: Some(row.get(7)?),
                    timeout_ms: Some(row.get(8)?),
                    created_at: Some(row.get(9)?),
                    updated_at: Some(row.get(10)?),
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    /// 启用/禁用调度任务
    #[napi]
    pub fn set_task_enabled(&self, id: String, enabled: bool) -> Result<bool> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        let affected = conn
            .execute(
                "UPDATE scheduled_tasks SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
                params![if enabled { 1 } else { 0 }, now, id],
            )
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 按类型查询调度任务
    #[napi]
    pub fn get_tasks_by_type(&self, task_type: String) -> Result<Vec<ScheduledTask>> {
        let conn = self.conn.read();

        let mut stmt = conn
            .prepare(
                "SELECT id, name, task_type, cron_expression, enabled, payload, priority, max_retries, timeout_ms, created_at, updated_at
                 FROM scheduled_tasks WHERE task_type = ?1 AND enabled = 1 ORDER BY priority DESC",
            )
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let rows = stmt
            .query_map([&task_type], |row| {
                Ok(ScheduledTask {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    task_type: row.get(2)?,
                    cron_expression: row.get(3)?,
                    enabled: Some(row.get::<_, i32>(4)? == 1),
                    payload: row.get(5)?,
                    priority: Some(row.get(6)?),
                    max_retries: Some(row.get(7)?),
                    timeout_ms: Some(row.get(8)?),
                    created_at: Some(row.get(9)?),
                    updated_at: Some(row.get(10)?),
                })
            })
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    // ==================== 任务执行日志操作 ====================

    /// 记录任务执行开始
    #[napi]
    pub fn log_task_start(&self, task_id: String, task_name: String) -> Result<i64> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO task_execution_logs (task_id, task_name, started_at, status)
             VALUES (?1, ?2, ?3, 'running')",
            params![task_id, task_name, now],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        let log_id = conn.last_insert_rowid();
        tracing::debug!(log_id = log_id, task_id = %task_id, "Task execution started");

        Ok(log_id)
    }

    /// 记录任务执行完成
    #[napi]
    pub fn log_task_complete(&self, log_id: i64, result: Option<String>, duration_ms: i64) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE task_execution_logs SET ended_at = ?1, status = 'completed', result = ?2, duration_ms = ?3 WHERE id = ?4",
            params![now, result, duration_ms, log_id],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::debug!(log_id = log_id, duration_ms = duration_ms, "Task execution completed");
        Ok(())
    }

    /// 记录任务执行失败
    #[napi]
    pub fn log_task_error(&self, log_id: i64, error: String, duration_ms: i64, retry_count: i32) -> Result<()> {
        let conn = self.conn.write();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE task_execution_logs SET ended_at = ?1, status = 'error', error = ?2, duration_ms = ?3, retry_count = ?4 WHERE id = ?5",
            params![now, error, duration_ms, retry_count, log_id],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::warn!(log_id = log_id, error = %error, "Task execution failed");
        Ok(())
    }

    /// 查询任务执行日志
    #[napi]
    pub fn query_task_logs(&self, query: TaskLogQuery) -> Result<Vec<TaskExecutionLog>> {
        let conn = self.conn.read();
        let limit = query.limit.unwrap_or(100);

        let sql = if let Some(ref task_id) = query.task_id {
            format!(
                "SELECT id, task_id, task_name, started_at, ended_at, status, result, error, duration_ms, retry_count
                 FROM task_execution_logs WHERE task_id = ?1 ORDER BY started_at DESC LIMIT {}",
                limit
            )
        } else if let Some(ref status) = query.status {
            format!(
                "SELECT id, task_id, task_name, started_at, ended_at, status, result, error, duration_ms, retry_count
                 FROM task_execution_logs WHERE status = ?1 ORDER BY started_at DESC LIMIT {}",
                limit
            )
        } else {
            format!(
                "SELECT id, task_id, task_name, started_at, ended_at, status, result, error, duration_ms, retry_count
                 FROM task_execution_logs ORDER BY started_at DESC LIMIT {}",
                limit
            )
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| Error::from_reason(e.to_string()))?;

        let rows = if let Some(ref task_id) = query.task_id {
            stmt.query_map([task_id], Self::map_task_log)
        } else if let Some(ref status) = query.status {
            stmt.query_map([status], Self::map_task_log)
        } else {
            stmt.query_map([], Self::map_task_log)
        }
        .map_err(|e| Error::from_reason(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| Error::from_reason(e.to_string()))?);
        }

        Ok(results)
    }

    fn map_task_log(row: &rusqlite::Row) -> rusqlite::Result<TaskExecutionLog> {
        Ok(TaskExecutionLog {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_name: row.get(2)?,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
            status: row.get(5)?,
            result: row.get(6)?,
            error: row.get(7)?,
            duration_ms: row.get(8)?,
            retry_count: row.get(9)?,
        })
    }

    /// 获取任务执行统计
    #[napi]
    pub fn get_task_stats(&self, task_id: Option<String>) -> Result<TaskStats> {
        let conn = self.conn.read();

        let (total, success, failed, avg_duration): (i64, i64, i64, f64) = if let Some(ref id) = task_id {
            conn.query_row(
                "SELECT
                    COUNT(*),
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END),
                    COALESCE(AVG(duration_ms), 0)
                 FROM task_execution_logs WHERE task_id = ?1",
                [id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap_or((0, 0, 0, 0.0))
        } else {
            conn.query_row(
                "SELECT
                    COUNT(*),
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END),
                    COALESCE(AVG(duration_ms), 0)
                 FROM task_execution_logs",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap_or((0, 0, 0, 0.0))
        };

        let last_execution: Option<String> = if let Some(ref id) = task_id {
            conn.query_row(
                "SELECT started_at FROM task_execution_logs WHERE task_id = ?1 ORDER BY started_at DESC LIMIT 1",
                [id],
                |row| row.get(0),
            )
            .ok()
        } else {
            conn.query_row(
                "SELECT started_at FROM task_execution_logs ORDER BY started_at DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok()
        };

        Ok(TaskStats {
            task_id,
            total_executions: total,
            successful_executions: success,
            failed_executions: failed,
            average_duration_ms: avg_duration,
            last_execution,
        })
    }

    /// 清理旧的执行日志
    #[napi]
    pub fn cleanup_old_task_logs(&self, days_to_keep: u32) -> Result<u32> {
        let conn = self.conn.write();
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days_to_keep as i64);
        let cutoff_str = cutoff.to_rfc3339();

        let deleted = conn
            .execute(
                "DELETE FROM task_execution_logs WHERE started_at < ?1",
                [&cutoff_str],
            )
            .map_err(|e| Error::from_reason(e.to_string()))?;

        tracing::info!(deleted = deleted, days = days_to_keep, "Old task logs cleaned up");
        Ok(deleted as u32)
    }
}

// ==================== 数据类型 ====================

#[napi(object)]
#[derive(Clone)]
pub struct MemoryRecord {
    pub id: String,
    pub content: String,
    pub embedding: Option<Vec<u8>>,
    pub tags: Option<Vec<String>>,
    pub importance: Option<f64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub metadata: Option<String>,
}

#[napi(object)]
pub struct MemoryQuery {
    pub text: Option<String>,
    pub tags: Option<Vec<String>>,
    pub min_importance: Option<f64>,
    pub limit: Option<u32>,
}

#[napi(object)]
#[derive(Clone)]
pub struct TraceLog {
    pub trace_id: String,
    pub span_id: Option<String>,
    pub parent_span_id: Option<String>,
    pub operation: String,
    pub level: String,
    pub message: Option<String>,
    pub metadata: Option<String>,
    pub duration_ms: Option<i64>,
    pub created_at: Option<String>,
}

#[napi(object)]
pub struct TraceQuery {
    pub trace_id: Option<String>,
    pub level: Option<String>,
    pub operation: Option<String>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct DatabaseStats {
    pub memory_count: i64,
    pub knowledge_count: i64,
    pub diary_count: i64,
    pub tag_count: i64,
    pub trace_count: i64,
    pub file_size_bytes: i64,
    pub path: String,
}

// ==================== 日记数据类型 ====================

#[napi(object)]
#[derive(Clone)]
pub struct DiaryRecord {
    pub id: String,
    pub date: String,
    pub content: String,
    pub tags: Option<Vec<String>>,
    pub embedding: Option<Vec<u8>>,
    pub book_name: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[napi(object)]
pub struct DiaryDateQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub book_name: Option<String>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct DiarySearchQuery {
    pub keyword: String,
    pub book_name: Option<String>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct DiaryBookInfo {
    pub book_name: String,
    pub entry_count: i64,
    pub latest_date: Option<String>,
}

#[napi(object)]
pub struct DiaryStats {
    pub total_entries: i64,
    pub total_words: i64,
    pub first_entry_date: Option<String>,
    pub last_entry_date: Option<String>,
    pub top_tags: Vec<TagCount>,
    pub book_name: Option<String>,
}

#[napi(object)]
#[derive(Clone)]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

// ==================== 调度任务数据类型 ====================

#[napi(object)]
#[derive(Clone)]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub task_type: String,
    pub cron_expression: Option<String>,
    pub enabled: Option<bool>,
    pub payload: Option<String>,
    pub priority: Option<i32>,
    pub max_retries: Option<i32>,
    pub timeout_ms: Option<i32>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[napi(object)]
#[derive(Clone)]
pub struct TaskExecutionLog {
    pub id: i64,
    pub task_id: String,
    pub task_name: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub status: String,
    pub result: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i64>,
    pub retry_count: Option<i32>,
}

#[napi(object)]
pub struct TaskLogQuery {
    pub task_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct TaskStats {
    pub task_id: Option<String>,
    pub total_executions: i64,
    pub successful_executions: i64,
    pub failed_executions: i64,
    pub average_duration_ms: f64,
    pub last_execution: Option<String>,
}
