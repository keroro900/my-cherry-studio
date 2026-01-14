# VCP 原生知识库与记忆体系规范（深度规格）

本文档定义 Cherry Studio 原生知识库/记忆系统的完整规格，替代 `external/VCPToolBox/KnowledgeBaseManager.js`，并对齐 VCPToolBox 与 VCPChat 的记忆与日记体系。

## 1. 目标
- 支持 All Memory 注入与 RAG 检索共存
- 兼容 VCPToolBox 的日记占位符与管理接口
- 具备标签共现、语义组与时间范围检索能力
- 复刻 VCPChat 的记忆中心（Memo UI）体验

## 2. 服务与模块

### 2.1 DailyNoteService
- 日记写入、读取、标签管理
- 兼容多种写入标记：
  - `<<<DailyNoteStart>>> ... <<<DailyNoteEnd>>>`
  - `<<<[DIARY_WRITE]>>> ... <<<[/DIARY_WRITE]>>>`
  - `【日记写入】...【/日记写入】`

### 2.2 检索栈
- LightMemo：BM25 + 轻量向量检索
- DeepMemo：全文检索（Tantivy / SQLite FTS）
- MeshMemo：多维过滤 + rerank
- TagMemo：标签共现与增益（PMI/NPMI 矩阵）
- 语义组（Semantic Groups）：词元组网与加权融合

### 2.3 RetrievalPlanner
- 解析语法并选择检索模式
- 支持 full / rag / threshold / time-range

### 2.4 索引与增量更新
- 文件变更监听：增量索引/删除/重建
- 数据链路：Ingestor → Chunker → Embedding → VectorIndex → TagIndex
- 多日记本/多文件夹并行索引与合并检索
- 重排序支持 RRF + 外部 reranker（Jina/Voyage/TEI 等）

## 3. 数据与目录

```
~/.cherry-studio/vcp/
  diary/
    <folder>/<note>.md
  vector/
  tag-index/
  semantic-groups/
```

## 4. 兼容 API（VCPToolBox 风格）

### 4.1 Admin API 端点
以 `admin_api/dailynotes` 作为前缀：
- `GET /folders`: 文件夹列表
- `GET /folder/:folder`: 某文件夹下日记列表
- `GET /note/:folder/:name`: 获取日记全文
- `POST /note/:folder/:name`: 保存日记（body: `{ content }`）
- `POST /delete-batch`: 批量删除（`notesToDelete[]`）
- `POST /move`: 批量移动（`sourceNotes[]`, `targetFolder`）
- `POST /folder/delete`: 删除空文件夹
- `GET /search?term=...&folder=...`: 搜索（folder 可选）

### 4.2 Auth 兼容
- VCPChat Memo 通过 Basic Auth 调用 Admin API
- `forumConfig.username/password` 提供凭据

### 4.3 工具写入（兼容 v1/human/tool）
- 通过 `DailyNote` 工具写入日记
- ToolRequest 示例：
```
<<<[TOOL_REQUEST]>>>
maid:「始」MaidName「末」,
tool_name:「始」DailyNote「末」,
command:「始」create「末」,
Date:「始」2025-05-20「末」,
Content:「始」内容文本「末」
<<<[END_TOOL_REQUEST]>>>
```

## 5. Memo UI 规格（VCPChat 对齐）

### 5.1 主要行为
- 侧栏文件夹列表、拖拽排序
- 支持隐藏文件夹与“隐藏管理”弹窗
- 默认过滤 `MusicDiary` 文件夹
- 支持“文件夹内/全局”搜索切换
- 支持批量管理（删除、移动）

### 5.2 Memo 编辑器
- Markdown + KaTeX 预览
- 自定义右键菜单（撤销/剪切/复制/粘贴）
- 支持 Esc 快捷关闭编辑器/弹窗

### 5.3 Memo 配置存储
- 文件：`<USER_DATA_DIR>/memo.config.json`
- 字段：
  - `hiddenFolders`: string[]
  - `folderOrder`: string[]

## 6. 检索与注入语法

### 6.1 全量注入
```
{{角色名日记本}}
{{公共日记本}}
```

### 6.2 RAG 检索
```
[[知识库]]
[[知识库::TimeRange(2024-01-01,2024-12-31)]]
[[知识库:k=1.5]]
```

### 6.3 阈值检索
```
<<知识库>>
《《知识库》》
```

## 7. 语义组与标签共现
- RAG Tags：文件与标签映射
- Semantic Groups：词元组网与加权融合
- TagMemo：PMI/NPMI 共现矩阵提升召回，支持时间窗/权重策略

## 8. RAG Observer 规格（VCPChat 对齐）
- 通过 WebSocket 订阅 VCPLog
- 识别消息类型：
  - `RAG_RETRIEVAL_DETAILS`
  - `META_THINKING_CHAIN`
  - `AGENT_PRIVATE_CHAT_PREVIEW`
  - `AI_MEMO_RETRIEVAL`
- UI 展示检索细节与信号动画

## 9. 高级能力（P2）
- AIMemo 并发检索
- 三大自学习（RAG/Tag/词元组）
- VCP 元思考
- Magi 三贤者

## 10. 验收标准
- Admin API 全量可用
- Memo UI 可读写/批量操作
- All Memory 与 RAG 同时工作
- Tag/语义组可调可视
