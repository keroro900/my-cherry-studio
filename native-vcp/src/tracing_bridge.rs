//! 日志追踪桥接
//!
//! 将 Rust tracing 日志桥接到 Node.js

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use parking_lot::RwLock;
use std::sync::Arc;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{fmt, EnvFilter};

static LOG_CALLBACK: RwLock<Option<Arc<dyn Fn(LogEntry) + Send + Sync>>> = RwLock::new(None);

/// 初始化日志系统
pub fn init_tracing(level: &str) -> Result<()> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().json())
        .try_init()
        .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(())
}

/// 设置日志回调（用于发送到 Node.js）
#[napi]
pub fn set_log_callback(callback: JsFunction) -> Result<()> {
    let tsfn: ThreadsafeFunction<LogEntry, ErrorStrategy::Fatal> = callback
        .create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

    let tsfn = Arc::new(tsfn);
    let tsfn_clone = tsfn.clone();

    *LOG_CALLBACK.write() = Some(Arc::new(move |entry| {
        let _ = tsfn_clone.call(entry, ThreadsafeFunctionCallMode::NonBlocking);
    }));

    Ok(())
}

/// 发送日志到 Node.js
pub fn emit_log(entry: LogEntry) {
    if let Some(callback) = LOG_CALLBACK.read().as_ref() {
        callback(entry);
    }
}

/// 日志条目
#[napi(object)]
#[derive(Clone)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
    pub fields: Option<String>,
    pub span: Option<String>,
}

/// 创建 Trace ID
#[napi]
pub fn create_trace_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 创建 Span ID
#[napi]
pub fn create_span_id() -> String {
    uuid::Uuid::new_v4().to_string()[..8].to_string()
}

/// 全链路追踪器
#[napi]
pub struct Tracer {
    trace_id: String,
    spans: RwLock<Vec<SpanInfo>>,
}

#[napi]
impl Tracer {
    /// 创建新的追踪器
    #[napi(constructor)]
    pub fn new(trace_id: Option<String>) -> Self {
        Self {
            trace_id: trace_id.unwrap_or_else(create_trace_id),
            spans: RwLock::new(Vec::new()),
        }
    }

    /// 获取 Trace ID
    #[napi]
    pub fn get_trace_id(&self) -> String {
        self.trace_id.clone()
    }

    /// 开始一个 Span
    #[napi]
    pub fn start_span(&self, operation: String, parent_span_id: Option<String>) -> String {
        let span_id = create_span_id();
        let now = chrono::Utc::now();

        let span = SpanInfo {
            span_id: span_id.clone(),
            parent_span_id,
            operation,
            start_time: now.to_rfc3339(),
            end_time: None,
            duration_ms: None,
            status: "running".to_string(),
            metadata: None,
        };

        self.spans.write().push(span);

        tracing::info!(
            trace_id = %self.trace_id,
            span_id = %span_id,
            "Span started"
        );

        span_id
    }

    /// 结束一个 Span
    #[napi]
    pub fn end_span(&self, span_id: String, status: Option<String>, metadata: Option<String>) {
        let now = chrono::Utc::now();

        let mut spans = self.spans.write();
        if let Some(span) = spans.iter_mut().find(|s| s.span_id == span_id) {
            span.end_time = Some(now.to_rfc3339());
            span.status = status.unwrap_or_else(|| "completed".to_string());
            span.metadata = metadata;

            // 计算持续时间
            if let Ok(start) = chrono::DateTime::parse_from_rfc3339(&span.start_time) {
                span.duration_ms = Some((now - start.with_timezone(&chrono::Utc)).num_milliseconds());
            }

            tracing::info!(
                trace_id = %self.trace_id,
                span_id = %span_id,
                duration_ms = span.duration_ms,
                "Span ended"
            );
        }
    }

    /// 记录事件
    #[napi]
    pub fn log_event(&self, span_id: Option<String>, level: String, message: String, metadata: Option<String>) {
        let entry = LogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.clone(),
            target: "native-vcp".to_string(),
            message: message.clone(),
            fields: metadata,
            span: span_id.clone(),
        };

        emit_log(entry);

        match level.as_str() {
            "error" => tracing::error!(trace_id = %self.trace_id, span_id = ?span_id, "{}", message),
            "warn" => tracing::warn!(trace_id = %self.trace_id, span_id = ?span_id, "{}", message),
            "info" => tracing::info!(trace_id = %self.trace_id, span_id = ?span_id, "{}", message),
            "debug" => tracing::debug!(trace_id = %self.trace_id, span_id = ?span_id, "{}", message),
            _ => tracing::trace!(trace_id = %self.trace_id, span_id = ?span_id, "{}", message),
        }
    }

    /// 获取所有 Spans
    #[napi]
    pub fn get_spans(&self) -> Vec<SpanInfo> {
        self.spans.read().clone()
    }

    /// 导出为 JSON
    #[napi]
    pub fn to_json(&self) -> Result<String> {
        let data = serde_json::json!({
            "trace_id": self.trace_id,
            "spans": self.spans.read().iter().map(|s| {
                serde_json::json!({
                    "span_id": s.span_id,
                    "parent_span_id": s.parent_span_id,
                    "operation": s.operation,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "duration_ms": s.duration_ms,
                    "status": s.status,
                    "metadata": s.metadata,
                })
            }).collect::<Vec<_>>(),
        });

        serde_json::to_string_pretty(&data).map_err(|e| Error::from_reason(e.to_string()))
    }
}

/// Span 信息
#[napi(object)]
#[derive(Clone)]
pub struct SpanInfo {
    pub span_id: String,
    pub parent_span_id: Option<String>,
    pub operation: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub metadata: Option<String>,
}
