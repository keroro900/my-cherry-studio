# 日记-笔记-知识库-记忆 统一方案设计

## 一、现状分析

### 当前架构
```
                    ┌─────────────────────────────────────────┐
                    │           VCP BuiltinServices            │
                    │  (DiaryService, AICharacterDiaryPlugin)  │
                    └───────────────┬─────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  NoteService  │         │ KnowledgeService │         │  MemoryService  │
│ (Markdown+FM) │         │   (LibSQL+RAG)   │         │ (SQLite+Vector) │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
   Data/Notes/              Data/KnowledgeBase/            Data/Memory/
```

### 问题点
1. **存储分散**: 日记内容在 NoteService，但知识索引和记忆分散在其他服务
2. **检索割裂**: DiaryModeParser 支持 RAG 语法，但与知识库/记忆系统没有深度集成
3. **功能重复**: VCPDiaryIpcHandler 和 DailyNoteWriteIpcHandler 有重复逻辑
4. **入口混乱**: 多个 IPC Handler 处理相似的日记操作

## 二、统一方案设计

### 目标架构
```
                    ┌─────────────────────────────────────────┐
                    │         UnifiedDiaryService             │
                    │    (统一的日记服务层 - 新建)              │
                    └───────────────┬─────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  NoteService  │◄───────►│  KnowledgeIndex │◄───────►│  MemoryBrain    │
│   (存储层)    │         │   (向量索引层)   │         │   (记忆层)      │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                            Data/Notes/diary/
                         (统一存储位置)
```

### 核心改动

#### 1. 存储层统一 (Phase 1)

**目标**: 所有日记统一存储在 `Data/Notes/diary/` 目录

**修改文件**:
- `src/main/services/NoteService.ts` - 添加日记专用方法
- `src/main/vcp/ipc/VCPDiaryIpcHandler.ts` - 统一使用 NoteService
- `src/main/vcp/ipc/DailyNoteWriteIpcHandler.ts` - 合并到统一服务

**具体改动**:
```typescript
// NoteService.ts 新增方法
interface DiaryNoteOptions {
  characterName?: string       // AI 角色名
  date: string                 // 日期 YYYY-MM-DD
  aiGenerated: boolean         // 是否 AI 生成
  tags?: string[]              // 标签
  linkedKnowledgeBases?: string[] // 关联知识库
}

class NoteService {
  // 创建/更新日记笔记
  async saveDiaryNote(content: string, options: DiaryNoteOptions): Promise<NoteItem>

  // 获取日记列表 (支持角色过滤)
  async getDiaryNotes(characterName?: string): Promise<NoteItem[]>

  // 获取可用角色列表
  async getAvailableDiaryCharacters(): Promise<string[]>

  // 日记搜索 (整合 Tantivy + 向量)
  async searchDiaries(query: string, options?: DiarySearchOptions): Promise<DiarySearchResult[]>
}
```

#### 2. 知识索引集成 (Phase 2)

**目标**: 日记内容自动索引到知识库，支持 RAG 检索

**修改文件**:
- `src/main/knowledge/KnowledgeService.ts` - 添加日记索引支持
- `src/main/knowledge/modes/DiaryModeParser.ts` - 增强与知识库的连接
- 新建 `src/main/services/DiaryKnowledgeIntegration.ts`

**具体改动**:
```typescript
// DiaryKnowledgeIntegration.ts
class DiaryKnowledgeIntegration {
  // 日记保存时自动索引
  async onDiarySaved(note: NoteItem): Promise<void> {
    // 1. 提取元数据 (角色、日期、标签)
    // 2. 分块并生成向量
    // 3. 存入知识库索引 (标记为 diary 类型)
  }

  // 日记检索时融合知识库
  async enhancedSearch(query: string, options: DiarySearchOptions): Promise<EnhancedResult[]> {
    // 1. Tantivy 全文搜索
    // 2. 向量相似度搜索
    // 3. 结合 DiaryModeParser 语法 ([[]], {{}}, etc.)
    // 4. RRF 融合排序
  }
}
```

#### 3. 记忆系统融合 (Phase 3)

**目标**: 日记内容与全局记忆系统打通

**修改文件**:
- `src/main/memory/adapters/VCPMemoryAdapter.ts` - 添加日记后端
- `src/main/services/memory/IntegratedMemoryCoordinator.ts` - 注册日记后端
- `src/main/services/memory/MemoryBrain.ts` - WaveRAG 支持日记

**具体改动**:
```typescript
// IntegratedMemoryCoordinator.ts 修改
type MemoryBackendType = 'lightmemo' | 'deepmemo' | 'meshmemo' | 'aimemo' | 'diary' | 'knowledge'

// 添加 diary 后端支持
async intelligentSearch(query: string, options: SearchOptions): Promise<EnhancedSearchResult[]> {
  // 当 backends 包含 'diary' 时，调用日记搜索
  if (options.backends?.includes('diary')) {
    const diaryResults = await this.searchDiaryBackend(query, options)
    results.push(...diaryResults)
  }
  // ... RRF 融合
}
```

#### 4. VCP 服务层重构 (Phase 4)

**目标**: 统一 VCP 内置服务的日记相关功能

**修改文件**:
- `src/main/vcp/builtinServices/AICharacterDiaryPlugin.ts` - 使用统一服务
- `src/main/vcp/builtinServices/DiarySearchService.ts` - 新建，整合搜索
- 合并 `DailyNoteWritePlugin.ts` 和 `DiaryWritePlugin.ts`

**具体改动**:
```typescript
// DiarySearchService.ts (新建)
class DiarySearchService extends BaseBuiltinService {
  name = 'diary_search'

  async execute(params: { query: string; mode?: string; characterName?: string }) {
    // 支持 DiaryModeParser 语法
    const parsed = diaryModeParser.parse(params.query)

    // 调用统一的 DiaryKnowledgeIntegration
    const results = await diaryKnowledgeIntegration.enhancedSearch(
      parsed.cleanedText,
      {
        characterName: params.characterName,
        configs: parsed.configs,
        includeMemory: true  // 融合记忆系统
      }
    )

    return results
  }
}
```

## 三、数据迁移方案

### Frontmatter 标准化
```yaml
---
characterName: "小樱"          # AI 角色名 (可选)
date: "2025-01-06"            # 日期 (必须)
aiGenerated: true             # AI 生成标记
tags: ["日记", "工作"]         # 标签
linkedKnowledgeBases:         # 关联知识库
  - "工作知识库"
indexed: true                 # 是否已索引到知识库
memoryId: "xxx"               # 关联的记忆ID (可选)
---
```

### 迁移步骤
1. 扫描现有日记 (根据 frontmatter 属性识别)
2. 标准化 frontmatter 格式
3. 建立知识库索引
4. 建立记忆关联

## 四、API 统一

### IPC 通道整合
```typescript
// 合并前
VCP_Diary_Create         // VCPDiaryIpcHandler
VCP_Diary_Update
VCP_Diary_Delete
VCP_Diary_Search
VCP_Diary_GetByDate
VCP_DailyNote_Write      // DailyNoteWriteIpcHandler
VCP_DailyNote_Delete
VCP_DailyNote_GetBooks

// 合并后 - 统一到 VCPDiaryIpcHandler
VCP_Diary_Save           // 创建/更新统一
VCP_Diary_Delete
VCP_Diary_Search         // 增强搜索 (融合知识库+记忆)
VCP_Diary_GetByDate
VCP_Diary_GetCharacters  // 获取角色列表
VCP_Diary_GetStats       // 获取统计
VCP_Diary_Migrate        // 数据迁移
```

## 五、实施步骤

### Step 1: NoteService 增强 (1-2h)
- [ ] 添加 `saveDiaryNote()` 方法
- [ ] 添加 `getDiaryNotes()` 方法
- [ ] 添加 `getAvailableDiaryCharacters()` 方法
- [ ] 标准化 Frontmatter 处理

### Step 2: 知识索引集成 (2-3h)
- [ ] 创建 `DiaryKnowledgeIntegration.ts`
- [ ] 实现日记自动索引
- [ ] 实现增强搜索 (Tantivy + 向量 + RRF)
- [ ] 连接 DiaryModeParser

### Step 3: 记忆系统融合 (1-2h)
- [ ] IntegratedMemoryCoordinator 添加 diary 后端
- [ ] VCPMemoryAdapter 添加日记搜索方法
- [ ] MemoryBrain WaveRAG 支持日记

### Step 4: VCP 服务重构 (1-2h)
- [ ] 合并 DailyNoteWritePlugin 到 AICharacterDiaryPlugin
- [ ] 创建 DiarySearchService
- [ ] 统一 IPC Handler

### Step 5: 前端适配 (1h)
- [ ] DailyNotePanel 使用新 API
- [ ] NotesSidebar 日记过滤增强
- [ ] 添加知识库关联 UI

### Step 6: 数据迁移与测试 (1h)
- [ ] 实现迁移脚本
- [ ] 测试所有功能
- [ ] 清理废弃代码

## 六、文件清单

### 新建文件
- `src/main/services/DiaryKnowledgeIntegration.ts`
- `src/main/vcp/builtinServices/DiarySearchService.ts`

### 主要修改文件
- `src/main/services/NoteService.ts`
- `src/main/vcp/ipc/VCPDiaryIpcHandler.ts`
- `src/main/memory/adapters/VCPMemoryAdapter.ts`
- `src/main/services/memory/IntegratedMemoryCoordinator.ts`
- `src/main/vcp/builtinServices/AICharacterDiaryPlugin.ts`

### 可废弃文件
- `src/main/vcp/ipc/DailyNoteWriteIpcHandler.ts` (合并后)
- `src/main/vcp/builtinServices/DailyNoteWritePlugin.ts` (合并后)

## 七、风险与注意事项

1. **数据安全**: 迁移前需要备份现有日记数据
2. **向后兼容**: 保留旧 IPC 通道一段时间，逐步废弃
3. **性能考虑**: 日记自动索引应异步执行，避免阻塞写入
4. **Tantivy 锁**: 已修复的锁问题需持续监控
