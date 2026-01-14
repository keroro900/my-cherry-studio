# VCP Diary Feature User Guide

> This guide explains how to use VCP diary features in Cherry Studio for intelligent knowledge retrieval and AI memory enhancement.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Diary Declaration Syntax](#diary-declaration-syntax)
4. [Knowledge Base Diary Mode](#knowledge-base-diary-mode)
5. [ShowVCP Debug Panel](#showvcp-debug-panel)
6. [Advanced Features](#advanced-features)
7. [FAQ](#faq)

---

## Overview

VCP (Virtual Character Protocol) diary features enable AI assistants to:

- **Smart Knowledge Retrieval**: Automatically retrieve relevant knowledge during conversations
- **Memory Persistence**: AI can proactively write important information to knowledge bases
- **Context Enhancement**: Automatically inject relevant context based on conversation progress
- **Debug Transparency**: Real-time visibility into retrieval process via ShowVCP panel

### Core Features

| Feature | Description |
|---------|-------------|
| 4 Retrieval Modes | Full-text injection, RAG retrieval, Threshold full-text, Threshold RAG |
| Knowledge Base Linking | Assistants can link to multiple knowledge bases |
| Auto Summarization | AI automatically generates diary summaries |
| Real-time Debugging | ShowVCP panel shows complete call chain |

---

## Quick Start

### Step 1: Create a Knowledge Base

1. Open the **Knowledge Base** page
2. Click **New Knowledge Base**
3. Enter a name (e.g., `Work Log`)
4. Add documents or create diary entries directly

### Step 2: Link Assistant to Knowledge Base

1. Open **Assistant Settings**
2. Find the **Knowledge Base** configuration
3. Select the knowledge base to link
4. Save settings

### Step 3: Use Diary Declaration Syntax

Add diary declarations in the assistant's system prompt:

```
You are an intelligent assistant.

Before answering questions, please refer to:
[[Work Log]]

Please provide help based on user questions and knowledge base content.
```

### Step 4: Start Conversation

When chatting with the assistant, it will automatically:
1. Parse diary declarations in the system prompt
2. Retrieve from knowledge base based on user questions
3. Inject relevant content into conversation context

---

## Diary Declaration Syntax

VCP supports 4 diary declaration syntaxes controlling different retrieval modes:

### 1. RAG Retrieval `[[knowledge_base]]`

```
[[Work Log]]
```

- **Mode**: Semantic similarity retrieval
- **Feature**: Returns Top-K chunks most relevant to user question
- **Use Case**: Scenarios requiring precise matching

### 2. Full-text Injection `{{knowledge_base}}`

```
{{Product Manual}}
```

- **Mode**: Inject complete knowledge base content
- **Feature**: Adds entire knowledge base content to context
- **Use Case**: Small knowledge bases requiring complete reference

### 3. Threshold RAG `《《knowledge_base》》`

```
《《Technical Docs》》
```

- **Mode**: RAG retrieval with similarity threshold
- **Feature**: Only injects if similarity exceeds threshold
- **Use Case**: Avoiding irrelevant content interference

### 4. Threshold Full-text `<<knowledge_base>>`

```
<<FAQ List>>
```

- **Mode**: Full-text injection with similarity threshold
- **Feature**: Only injects full content if average similarity meets threshold
- **Use Case**: Conditional full reference

### Mixed Usage Example

```
You are a fashion advisor assistant.

## Core Knowledge
{{Brand Introduction}}

## Reference Data
[[2024 Spring Trends]]
《《Color Matching Guide》》

Please answer user questions about fashion styling based on the above knowledge.
```

---

## Knowledge Base Diary Mode

On the Knowledge Base page, select **Diary Mode** for dedicated diary management features.

### Diary Editor

The diary editor supports:
- VCP syntax highlighting
- Real-time preview of retrieval declarations
- Syntax legend tips

### Knowledge Browser

Browser features:
- View all diary entries
- Search and filter
- Edit and delete entries
- View chunk details

### Tag Management

Tag features:
- Automatic tag extraction from diary content
- Tag statistics and visualization
- Semantic group management

---

## ShowVCP Debug Panel

ShowVCP is VCP's transparency debugging mechanism, letting you "see through" AI interactions with knowledge bases in real-time.

### Enable ShowVCP

1. Open **Settings** > **Developer Options**
2. Enable **ShowVCP Debug Mode**
3. Configure display options:
   - Show timestamps
   - Show execution duration
   - Show call arguments
   - Show return results

### Debug Panel Information

When enabled, each conversation displays:

```
╔══════════════════════════════════════════════════════════════╗
║                     ShowVCP Debug Info                        ║
╠══════════════════════════════════════════════════════════════╣
║ Agent: Fashion Advisor
║ Session ID: vcp-session-xxx
║ Start Time: 2024-12-28T10:30:00.000Z
╠══════════════════════════════════════════════════════════════╣
║ Call Records (3):
╟──────────────────────────────────────────────────────────────╢
║ 1. [✓] context::agent_load (12ms)
║ 2. [✓] diary_read::diary_search (156ms)
║    Args: {"query":"spring colors","knowledgeBaseId":"kb-xxx"}
║ 3. [✓] context::context_rules_execute (8ms)
╠══════════════════════════════════════════════════════════════╣
║ Context Injections (2):
║ 1. 2024 spring colors focus on pastel tones...
║ 2. Spring silhouette trends favor loose comfort...
╚══════════════════════════════════════════════════════════════╝
```

### Call Type Reference

| Type | Description |
|------|-------------|
| `context::agent_load` | Load VCP Agent configuration |
| `diary_read::diary_search` | Execute diary/knowledge base search |
| `context::context_rules_execute` | Execute context injection rules |
| `diary_write::diary_write` | AI writes to diary |
| `injection` | Context content injection |

---

## Advanced Features

### AI Auto-write to Diary

AI can proactively write to diary during conversations. Supported trigger methods:

#### 1. Tool Call Method

If the AI model supports tool calls, it can directly call the `diary_write` tool.

#### 2. Marker Method

AI can use special markers in output:

```
<<<[DIARY_WRITE]>>>
Discussed spring color trends with user today. User prefers soft pastel tones.
<<<[/DIARY_WRITE]>>>
```

Or simple markers:

```
[DIARY]
Important finding: User has strong interest in sustainable fashion.
[/DIARY]
```

### Diary Summary Feature

The system supports automatic diary summary generation:

1. Select multiple diaries in the browser
2. Click **Generate Summary**
3. AI will analyze and generate a comprehensive summary
4. Summary is saved as new diary entry with `auto-summary` tag

### VCP Agent Configuration

Advanced users can create VCP Agents for fine-grained control:

```typescript
// VCP Agent configuration example
{
  name: "fashion_advisor",
  displayName: "Fashion Advisor",
  systemPrompt: "You are a professional fashion advisor...\n\n[[Fashion Knowledge]]",
  vcpConfig: {
    enableDiary: true,
    knowledgeBaseId: "kb-fashion-xxx",
    knowledgeBaseName: "Fashion Knowledge",
    enableMemory: true,
    memoryWindowSize: 10
  }
}
```

---

## FAQ

### Q1: Why is knowledge base retrieval returning no results?

**Possible causes:**
1. Knowledge base name spelled incorrectly
2. Knowledge base content is empty
3. User question has low relevance to knowledge base content

**Solutions:**
- Check if knowledge base name in diary declaration is correct
- Ensure knowledge base has relevant documents added
- Try full-text injection mode `{{}}` for testing

### Q2: ShowVCP panel not showing?

**Solutions:**
1. Confirm ShowVCP is enabled in settings
2. Confirm assistant is linked to knowledge base or VCP Agent
3. Restart application and retry

### Q3: How to choose the right retrieval mode?

| Scenario | Recommended Mode |
|----------|------------------|
| Q&A applications | `[[]]` RAG retrieval |
| Reference manuals | `{{}}` Full-text injection |
| Large knowledge bases | `《《》》` Threshold RAG |
| Optional reference | `<<>>` Threshold full-text |

### Q4: Diary write not working?

**Checklist:**
1. Confirm AI model supports tool calls or can recognize markers
2. Check `diary_write` call status in ShowVCP panel
3. Confirm knowledge base has write permissions

### Q5: How to improve retrieval quality?

**Optimization tips:**
1. Use clear document titles
2. Add relevant tags to diaries
3. Regularly generate summaries to organize content
4. Adjust retrieval Top-K parameter

---

## Related Links

- [VCP Architecture Document](../VCP-ARCHITECTURE.md)
- [VCP Extension Development Guide](../VCP-EXTENSIONS-USAGE.md)
- [Knowledge Base Usage Guide](./memory.md)

---

> Document Version: 1.0.0
> Last Updated: 2024-12-28
