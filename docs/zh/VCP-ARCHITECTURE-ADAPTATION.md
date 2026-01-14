# VCP 功能架构适配方案

> 基于 Cherry Studio 现有生态，制定功能实现的架构策略：扩展、融合或合并。

---

## Cherry Studio 基础架构分析

### 核心架构模式

| 层级 | 技术 | 模式 | 示例 |
|------|------|------|------|
| **状态管理** | Redux Toolkit | 24+ Store Slices | `store/settings.ts`, `store/workflow.ts` |
| **服务层** | TypeScript Class | 单例 + 事件驱动 | `TaskQueueService`, `StoreSyncService` |
| **AI 插件** | @cherrystudio/ai-core | 可插拔中间件 | `vcpContextPlugin`, `searchOrchestrationPlugin` |
| **IPC 通信** | Electron IPC | 通道注册 | `VCPIpcHandler`, `window.api.*` |
| **Hooks** | React Hooks | 组合式 API | `useMermaid`, `useSelectionAssistant` |
| **持久化** | IndexedDB + Redux Persist | Transform 清理 | `store/indexedDBStorage.ts` |

### 已有功能发现 (更新对比)

| 功能 | 状态 | 文件位置 |
|------|------|----------|
| ✅ Mermaid 渲染 | **已实现** | `hooks/useMermaid.ts` |
| ✅ 划词小助手 | **已实现** | `hooks/useSelectionAssistant.ts`, `store/selectionStore.ts` |
| ✅ VCP 日记检索 | **已实现** | `vcpContextPlugin.ts` |
| ✅ 群聊编排 | **已实现** | `GroupChatOrchestrator.ts` |
| ✅ 任务队列 | **已实现** | `TaskQueueService.ts` |

---

## 功能实现策略

### 策略定义

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **扩展 (Extension)** | 作为独立模块添加，不修改现有代码 | 新功能、可选特性 |
| **融合 (Integration)** | 与现有功能深度整合，复用基础设施 | 增强现有能力 |
| **合并 (Merge)** | 替换或重构现有实现 | 功能重叠、需要统一 |

---

## 功能实现详案

### 1. 心流锁模式 (Flow Lock) — 扩展

**策略**: 扩展 (新独立模块)

**原因**:
- 全新的交互模式，不与现有功能冲突
- 需要独立的状态管理和 UI
- 可选功能，用户可开启/关闭

**架构设计**:

```
src/renderer/src/
├── store/
│   └── flowLock.ts              # Redux slice (新增)
├── services/
│   └── FlowLockService.ts       # 服务层 (新增)
├── hooks/
│   └── useFlowLock.ts           # React Hook (新增)
└── components/
    └── FlowLock/
        ├── FlowLockIndicator.tsx  # 状态指示器
        └── FlowLockSettings.tsx   # 设置面板
```

**Store Slice 设计**:

```typescript
// store/flowLock.ts
interface FlowLockState {
  isLocked: boolean
  lockedTopicId: string | null
  aiCanInitiate: boolean
  cooldownMs: number
  triggerPrompt: string
  lastAIInitiation: number | null
}

const flowLockSlice = createSlice({
  name: 'flowLock',
  initialState,
  reducers: {
    lockTopic: (state, action: PayloadAction<string>) => {...},
    unlock: (state) => {...},
    setAICanInitiate: (state, action: PayloadAction<boolean>) => {...},
    recordAIInitiation: (state) => {...}
  }
})
```

**与现有系统的交互**:

```typescript
// 在 aiCore/plugins/ 添加 flowLockPlugin.ts
export const flowLockPlugin = (topicId: string): AiPlugin => ({
  name: 'flowLock',
  onRequestStart: async (params, context) => {
    const flowLockState = store.getState().flowLock
    if (flowLockState.isLocked && flowLockState.lockedTopicId !== topicId) {
      throw new Error('Flow Lock active on another topic')
    }
  },
  onResponseComplete: async (response, context) => {
    // 检测 AI 主动发起对话的标记
    if (detectAIInitiation(response)) {
      store.dispatch(recordAIInitiation())
    }
  }
})
```

---

### 2. 动态 K 值检索 — 融合

**策略**: 融合 (扩展现有 vcpContextPlugin)

**原因**:
- 已有日记检索基础设施
- 只需扩展语法解析器
- 复用现有 IPC 通道

**架构设计**:

```
src/renderer/src/aiCore/plugins/
└── vcpContextPlugin.ts  # 修改现有
    └── parseDiaryDeclaration()  # 扩展语法解析
```

**代码修改**:

```typescript
// vcpContextPlugin.ts 扩展

// 原有模式
const DIARY_PATTERN_BASIC = /\[\[([^\]]+)\]\]/g

// 扩展支持动态 K 值和修饰符
const DIARY_PATTERN_EXTENDED = /\[\[([^:\]]+)(?::(\d+\.?\d*))?(?:::(\w+))*\]\]/g

interface DiaryDeclaration {
  name: string
  kMultiplier: number      // 默认 1.0
  modifiers: string[]      // ['Time', 'Group', 'Rerank', 'TagMemo']
}

function parseDiaryDeclaration(match: RegExpMatchArray): DiaryDeclaration {
  return {
    name: match[1],
    kMultiplier: match[2] ? parseFloat(match[2]) : 1.0,
    modifiers: match[3] ? match[3].split('::').filter(Boolean) : []
  }
}
```

---

### 3. 时间感知检索 (::Time) — 融合

**策略**: 融合 (扩展 VCPIpcHandler)

**原因**:
- 复用现有检索基础设施
- 只需添加时间解析器
- 与动态 K 值共用修饰符系统

**架构设计**:

```
src/main/services/
└── VCPIpcHandler.ts       # 修改现有
    └── parseTimeExpression()  # 新增时间解析
src/main/utils/
└── timeParser.ts          # 新增时间解析工具
```

**时间解析器设计**:

```typescript
// utils/timeParser.ts (新增)
export interface TimeRange {
  start: Date
  end: Date
}

const TIME_PATTERNS: Record<string, (now: Date) => TimeRange> = {
  '今天': (now) => ({ start: startOfDay(now), end: now }),
  '昨天': (now) => ({ start: subDays(startOfDay(now), 1), end: startOfDay(now) }),
  '本周': (now) => ({ start: startOfWeek(now), end: now }),
  '上周': (now) => ({ start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) }),
  '本月': (now) => ({ start: startOfMonth(now), end: now }),
  '上个月': (now) => ({ start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }),
  'last week': (now) => TIME_PATTERNS['上周'](now),
  'this month': (now) => TIME_PATTERNS['本月'](now),
  // 正则模式: "X天前", "X周前", "X个月前"
}

export function parseTimeExpression(expr: string): TimeRange | null {
  // 1. 精确匹配
  if (TIME_PATTERNS[expr]) {
    return TIME_PATTERNS[expr](new Date())
  }

  // 2. 正则匹配: "3天前", "2周前"
  const daysAgoMatch = expr.match(/(\d+)天前/)
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1])
    return { start: subDays(new Date(), days), end: new Date() }
  }

  // ...更多模式
  return null
}
```

---

### 4. 语义组检索 (::Group) — 扩展

**策略**: 扩展 (新增配置 + 服务)

**原因**:
- 需要新的配置 UI
- 需要存储关键词组定义
- 较独立的功能模块

**架构设计**:

```
src/renderer/src/
├── store/
│   └── knowledge.ts         # 扩展现有 slice
│       └── semanticGroups   # 新增字段
├── pages/knowledge/
│   └── components/
│       └── SemanticGroupManager.tsx  # 新增管理 UI
src/main/services/
└── VCPIpcHandler.ts         # 扩展检索逻辑
```

**Store 扩展**:

```typescript
// store/knowledge.ts 扩展
interface SemanticGroup {
  id: string
  name: string
  keywords: string[]
  weight: number  // 0.0 - 1.0
  description?: string
}

interface KnowledgeState {
  // ...现有字段
  semanticGroups: SemanticGroup[]
}
```

---

### 5. TTS 语音合成 — 扩展

**策略**: 扩展 (新独立模块)

**原因**:
- 全新功能领域
- 需要独立的服务层和 UI
- 可能需要外部依赖 (GPT-SoVITS)

**架构设计**:

```
src/renderer/src/
├── store/
│   └── tts.ts               # Redux slice (新增)
├── services/
│   └── TTSService.ts        # TTS 服务 (新增)
├── hooks/
│   └── useTTS.ts            # React Hook (新增)
└── components/
    └── TTS/
        ├── TTSPlayer.tsx     # 播放控制
        ├── TTSSettings.tsx   # 设置面板
        └── VoiceSelector.tsx # 语音选择器

src/main/services/
└── tts/
    ├── TTSBridge.ts         # IPC 桥接
    └── GPTSoVITSClient.ts   # GPT-SoVITS API 客户端
```

**服务层设计**:

```typescript
// services/TTSService.ts
class TTSService {
  private static instance: TTSService
  private audioQueue: AudioQueueItem[] = []
  private isPlaying = false
  private eventListeners: Set<TTSEventListener> = new Set()

  // 单例模式，与 TaskQueueService 一致
  static getInstance(): TTSService {...}

  // 核心方法
  async speak(text: string, voiceId: string): Promise<void> {...}
  async speakWithPreSynthesis(sentences: string[]): Promise<void> {...}
  pause(): void {...}
  resume(): void {...}
  stop(): void {...}

  // 事件系统
  addEventListener(listener: TTSEventListener): void {...}
  removeEventListener(listener: TTSEventListener): void {...}
}
```

---

### 6. 对话分支 — 融合

**策略**: 融合 (扩展现有消息系统)

**原因**:
- 需要与现有消息存储深度整合
- 涉及消息关系的数据模型变更
- 与话题管理紧密相关

**架构设计**:

```
src/renderer/src/
├── store/
│   └── newMessage.ts        # 扩展现有 slice
│       └── branchInfo       # 新增分支信息
├── types/
│   └── newMessage.ts        # 扩展类型定义
└── pages/home/Messages/
    └── components/
        └── BranchIndicator.tsx  # 分支指示器
```

**类型扩展**:

```typescript
// types/newMessage.ts 扩展
interface Message {
  // ...现有字段
  branchId?: string           // 所属分支ID
  parentMessageId?: string    // 分支起点消息ID
  isBranchRoot?: boolean      // 是否为分支起点
}

interface Topic {
  // ...现有字段
  branches: Branch[]
}

interface Branch {
  id: string
  name: string
  rootMessageId: string
  createdAt: Date
}
```

---

### 7. 全局搜索 — 扩展

**策略**: 扩展 (新独立模块)

**原因**:
- 需要构建搜索索引
- 涉及多个数据源 (消息、话题、知识库)
- 独立的 UI 模态框

**架构设计**:

```
src/renderer/src/
├── services/
│   └── GlobalSearchService.ts   # 搜索服务 (新增)
├── hooks/
│   └── useGlobalSearch.ts       # React Hook (新增)
└── components/
    └── GlobalSearch/
        ├── GlobalSearchModal.tsx  # 搜索模态框
        ├── SearchResults.tsx      # 结果列表
        └── SearchFilters.tsx      # 筛选器

src/main/services/
└── search/
    ├── SearchIndexService.ts    # 索引服务
    └── SearchEngine.ts          # 搜索引擎
```

---

## 优先级与工作量评估

| 功能 | 策略 | 优先级 | 工作量 | 依赖 |
|------|------|--------|--------|------|
| Mermaid 渲染 | — | — | — | ✅ 已实现 |
| 划词小助手 | — | — | — | ✅ 已实现 |
| 动态 K 值 | 融合 | P0 | 低 (2h) | vcpContextPlugin |
| 时间感知 | 融合 | P0 | 中 (4h) | VCPIpcHandler |
| 心流锁 | 扩展 | P0 | 中 (8h) | 无 |
| 语义组 | 扩展 | P1 | 高 (16h) | 动态K值 |
| TTS 语音 | 扩展 | P1 | 高 (24h) | 无 |
| 对话分支 | 融合 | P1 | 高 (16h) | 消息系统 |
| 全局搜索 | 扩展 | P1 | 高 (20h) | 无 |

---

## 实施顺序建议

### 第一阶段: 快速见效 (P0 融合)

```
1. 动态 K 值 → 修改 vcpContextPlugin.ts
2. 时间感知 → 新增 timeParser.ts + 扩展 VCPIpcHandler
```

### 第二阶段: 核心体验 (P0 扩展)

```
3. 心流锁模式 → 完整新模块
```

### 第三阶段: 高级功能 (P1)

```
4. 语义组检索 → 配置 UI + 检索扩展
5. TTS 语音 → 完整新模块
6. 对话分支 → 消息系统扩展
7. 全局搜索 → 完整新模块
```

---

## 架构原则

1. **遵循现有模式**
   - Store Slice: 使用 `createSlice` + `PayloadAction`
   - 服务层: 使用单例模式 + 事件驱动
   - Hooks: 使用 `useAppDispatch` + `useAppSelector`
   - IPC: 注册到 `IpcChannel.ts` + `VCPIpcHandler.ts`

2. **保持向后兼容**
   - 融合类功能不破坏现有 API
   - 扩展类功能可选开启

3. **性能优先**
   - 大数据使用 IndexedDB
   - 避免阻塞主线程
   - 使用 Transform 清理敏感数据

4. **测试覆盖**
   - 新服务需添加单元测试
   - 修改现有代码需验证回归

---

> 文档版本: 1.0.0
> 最后更新: 2024-12-28
