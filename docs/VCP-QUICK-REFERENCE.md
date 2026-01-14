# VCP Quick Reference Guide

> Quick reference for VCP (Variable & Command Protocol) features in Cherry Studio

---

## Access VCP Features

VCP features are located in the **Knowledge Base** page:

1. Click **Knowledge Base** icon in the left sidebar
2. Select or create a knowledge base
3. Access VCP features via tabs:
   - **VCP 日记** (VCP Diary)
   - **Agent 管理** (Agent Management)
   - **上下文注入** (Context Injection)

---

## Knowledge Base Tabs

| Tab | Icon | Description |
|-----|------|-------------|
| 文件 | 📖 | File management |
| 笔记 | 📓 | Notes management |
| **VCP 日记** | 📖 | VCP diary declarations |
| 目录 | 📁 | Directory structure |
| 网址 | 🔗 | URL management |
| 网站 | 🌐 | Sitemap management |
| **Agent 管理** | 🤖 | VCP Agent configuration |
| **上下文注入** | ✨ | Context injection rules |

---

## Diary Declaration Syntax

### Four Basic Modes

| Syntax | Mode | Description |
|--------|------|-------------|
| `{{kb_name}}` | Fulltext | Inject entire knowledge base content |
| `[[kb_name]]` | RAG | Vector search for relevant chunks |
| `<<kb_name>>` | Threshold Fulltext | Inject fulltext only if relevance threshold met |
| `《《kb_name》》` | Threshold RAG | Search chunks only if threshold met |

---

## Retrieval Modifiers

Add modifiers after knowledge base name with `::` separator:

```
[[knowledge_base::Modifier1::Modifier2]]
```

### Available Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `::Time` | Time-aware retrieval | `[[diary::Time]]` |
| `::Group` | Default semantic groups | `[[fashion::Group]]` |
| `::Group(a,b,c)` | Custom semantic groups | `[[fashion::Group(color,style)]]` |
| `::TagMemo0.65` | Tag network with threshold | `[[kb::TagMemo0.7]]` |
| `::TopK10` | Limit results count | `[[docs::TopK5]]` |
| `::K10` | Shorthand for TopK | `[[docs::K5]]` |
| `::Threshold0.8` | Similarity threshold | `[[docs::Threshold0.6]]` |
| `::Rerank` | Enable reranking | `[[docs::Rerank]]` |
| `::MeshMemo` | Use MeshMemo backend | `[[kb::MeshMemo]]` |
| `::LightMemo` | Use LightMemo backend | `[[kb::LightMemo]]` |
| `::DeepMemo` | Use DeepMemo backend | `[[kb::DeepMemo]]` |

---

## Template Variables

### Variable Types

| Prefix | Type | Example |
|--------|------|---------|
| `Tar` | Target (user input) | `{{TarUserInput}}` |
| `Sar` | Session info | `{{SarSessionId}}` |
| `Var` | Custom variables | `{{VarProductName}}` |

### System Variables

```
{{current_date}}      - Current date
{{current_time}}      - Current time
{{current_datetime}}  - Full datetime
{{weekday}}           - Day of week
{{TarUserInput}}      - User's latest input
{{TarQuery}}          - User's query
```

---

## Agent Management

### Sub-tabs

| Tab | Description |
|-----|-------------|
| Agent 列表 | Create/edit/delete/activate agents |
| 变量管理 | Manage prompt variables |
| 模板管理 | Manage prompt templates |

### Variable Scopes

| Scope | Description |
|-------|-------------|
| 全局 (Global) | Available everywhere |
| Agent 级别 (Agent) | Per-agent variables |
| 会话级别 (Session) | Per-session variables |

---

## Context Injection

### Sub-tabs

| Tab | Description |
|-----|-------------|
| 注入规则 | Create and manage injection rules |
| 预设管理 | Manage rule presets |

### Injection Positions

| Position | Color | Description |
|----------|-------|-------------|
| system_prefix | Blue | Start of system prompt |
| system_suffix | Cyan | End of system prompt |
| context_prefix | Green | Start of context |
| context_suffix | Lime | End of context |
| user_prefix | Orange | Before user message |
| user_suffix | Gold | After user message |
| assistant_prefix | Purple | Before assistant message |
| hidden | Gray | Inject but don't display |

### Trigger Types

| Type | Description |
|------|-------------|
| always | Always trigger |
| keyword | Keyword match |
| regex | Regex pattern match |
| turn_count | After N turns |
| time_based | Time-based trigger |
| random | Random probability |
| context_length | Context length threshold |

---

## TOOL_REQUEST Protocol

### Standard Format

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」tool_name_here「末」
param1:「始」value1「末」
param2:「始」value2「末」
<<<[/TOOL_REQUEST]>>>
```

### Simplified Format

```
<<<[TOOL_REQUEST]>>>
tool_name: tool_name_here
param1: value1
param2: value2
<<<[/TOOL_REQUEST]>>>
```

### Key Normalization

These are all equivalent:
- `image_size` = `imageSize` = `ImageSize` = `IMAGE-SIZE`
- `tool_name` = `toolName` = `pluginName`

---

## Tool Result Markers

### Success Result

```
<<<[TOOL_RESULT]>>>
Tool: tool_name
Duration: 1234ms

{result content}
<<<[/TOOL_RESULT]>>>
```

### Error Result

```
<<<[TOOL_ERROR]>>>
Tool: tool_name
Error: error message
<<<[/TOOL_ERROR]>>>
```

---

## Retrieval Backend Comparison

| Backend | Characteristics | Best For |
|---------|-----------------|----------|
| **LightMemo** | BM25 + Vector, fast | Daily search, small KB |
| **DeepMemo** | Tantivy + Rerank, precise | Technical docs, high accuracy |
| **MeshMemo** | Multi-filter + MMR diversity | Complex queries, diverse results |

---

## Common Modifier Combinations

```
# Time-aware with result limit
[[kb::Time::K5]]

# Tag enhancement with threshold
[[kb::TagMemo0.7::TopK10]]

# Deep search with high precision
[[kb::DeepMemo::Threshold0.8]]

# Custom semantic groups
[[fashion::Group(color,style,occasion)::K10]]
```

---

> For detailed documentation, see [VCP-USER-GUIDE.md](zh/VCP-USER-GUIDE.md)
