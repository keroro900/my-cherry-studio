# 提示词系统架构文档

> **文档版本**: 1.1.0
> **最后更新**: 2024-12
> **维护者**: 开发团队
> **状态**: 活跃维护中

---

## 一、系统概述

Cherry Studio 工作流提示词系统是一个多层次、模块化的架构，用于生成童装电商 AI 图像提示词。

### 1.1 核心组件

```
┌─────────────────────────────────────────────────────────────────────┐
│                         工作流画布 (Canvas)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    promptJson    ┌──────────────────┐             │
│  │ Unified      │ ─────────────────▶ │ Gemini          │             │
│  │ PromptNode   │                   │ GenerateNode    │             │
│  │ (视觉分析)   │                   │ (图片生成)      │             │
│  └──────────────┘                   └──────────────────┘             │
│         │                                    │                       │
│         ▼                                    ▼                       │
│  ┌──────────────┐                   ┌──────────────────┐             │
│  │ prompts.ts   │                   │ EcomPromptBuilder│             │
│  │ 构建系统/用户│                   │ 构建最终提示词   │             │
│  │ 提示词模板   │                   │                  │             │
│  └──────────────┘                   └──────────────────┘             │
│                                              │                       │
│                                              ▼                       │
│                                     ┌──────────────────┐             │
│                                     │ presets/         │             │
│                                     │ 预设注册表       │             │
│                                     │ (Single Source)  │             │
│                                     └──────────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 组件职责

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **UnifiedPromptNode** | 分析图片，生成结构化 JSON | 图片 + 配置 | promptJson |
| **GeminiGenerateNode** | 调用 Gemini API 生成图片 | promptJson + 图片 | 生成的图片 |
| **EcomPromptBuilder** | 构建电商图提示词 | promptJson + config | system/user prompt |
| **presets/** | 预设注册表，单一事实来源 | 原始配置值 | 解析后的值 + 提示词片段 |

---

## 二、数据流详解

### 2.1 完整数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: UI 配置                                                     │
│  ━━━━━━━━━━━━━━━━                                                    │
│  用户在节点配置面板选择:                                              │
│  • layoutMode: 'none' | 'random' | 'flat_lay' | 'hanging'           │
│  • fillMode: 'none' | 'random' | 'filled' | 'flat'                  │
│  • platformStyle: 'shein' | 'temu' | ...                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: UnifiedPromptNode 执行                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│  executor.ts:                                                        │
│  1. collectImageInputs() - 收集输入图片                              │
│  2. buildPrompts(outputMode, config) - 构建提示词                    │
│     └─ prompts.ts: buildEcomSystemPrompt() / buildEcomUserPrompt()  │
│  3. visionAnalysis() - 调用 AI 视觉分析                              │
│  4. parseJsonResponse() - 解析 JSON 响应                             │
│                                                                      │
│  输出 promptJson:                                                    │
│  {                                                                   │
│    "type": "ecom",                                                   │
│    "layout_mode": "none|random|flat_lay|hanging",  ← 原样保留       │
│    "fill_mode": "none|random|filled|flat",         ← 原样保留       │
│    "garment_type": "set",                                           │
│    "full_prompt": "..."                                             │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 通过工作流边连接传递
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: GeminiGenerateNode 执行                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                       │
│  executor.ts:                                                        │
│  1. 获取 inputs.promptJson                                          │
│  2. resolveLayoutMode(promptJson.layout_mode || config.layout)      │
│     • 'none' → 返回 'none'                                          │
│     • 'random' → 随机选择 'flat_lay' 或 'hanging' ← 此时随机        │
│     • 其他 → 标准化映射                                              │
│  3. resolveFillMode(promptJson.fill_mode || config.fillMode)        │
│     • 'none' → 返回 'none'                                          │
│     • 'random' → 随机选择 'filled' 或 'flat' ← 此时随机             │
│  4. 创建 EcomPromptBuilder                                          │
│     config.layout = resolved === 'none' ? undefined : resolved      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: EcomPromptBuilder 构建                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│  initializeModules():                                                │
│  • config.layout === undefined → 不添加 LayoutModule                │
│  • config.fillMode === undefined → 不添加 FillModule                │
│                                                                      │
│  buildSystemPrompt():                                                │
│  • !config.layout → "AI decides the best layout..."                 │
│  • !config.fillMode → "[Styling Guidance - AI DECIDES]..."          │
│                                                                      │
│  buildUserPrompt():                                                  │
│  • 生成自然语言叙事性提示词                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Gemini API 调用                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━                                              │
│  WorkflowAiService.generateImage({                                  │
│    systemInstruction: systemPrompt,                                 │
│    prompt: userPrompt,                                              │
│    images: imageBase64List                                          │
│  })                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 配置优先级

```
promptJson (上游节点生成) > 节点自身配置 > 默认值
```

**代码体现**:
```typescript
// GeminiGenerateExecutor.buildPrompts()
const resolvedLayout = resolveLayoutMode(
  ecomJson?.layout_mode ||     // 优先: promptJson
  (config as any).layout       // 其次: 节点配置
)
```

---

## 三、核心文件清单

### 3.1 UnifiedPromptNode

| 文件 | 路径 | 职责 |
|------|------|------|
| `types.ts` | `nodes/ai/UnifiedPromptNode/types.ts` | 类型定义 (LayoutMode, FillMode, UnifiedPromptNodeConfig) |
| `executor.ts` | `nodes/ai/UnifiedPromptNode/executor.ts` | 执行逻辑 (buildPrompts, visionAnalysis) |
| `prompts.ts` | `nodes/ai/UnifiedPromptNode/prompts.ts` | 提示词模板 (buildEcomSystemPrompt, buildEcomUserPrompt) |
| `index.ts` | `nodes/ai/UnifiedPromptNode/index.ts` | 节点定义导出 |

### 3.2 GeminiGenerateNode

| 文件 | 路径 | 职责 |
|------|------|------|
| `executor.ts` | `nodes/image/GeminiGenerateNode/executor.ts` | 执行逻辑 (buildPrompts, 调用 EcomPromptBuilder) |
| `index.ts` | `nodes/image/GeminiGenerateNode/index.ts` | 节点定义 |

### 3.3 提示词构建器

| 文件 | 路径 | 职责 |
|------|------|------|
| `EcomPromptBuilder.ts` | `prompts/builders/EcomPromptBuilder.ts` | 电商图提示词构建 |
| `ModelPromptBuilder.ts` | `prompts/builders/ModelPromptBuilder.ts` | 模特图提示词构建 |
| `PatternPromptBuilder.ts` | `prompts/builders/PatternPromptBuilder.ts` | 图案提示词构建 |
| `PromptBuilder.ts` | `prompts/builders/PromptBuilder.ts` | 基类，模板处理 |

### 3.4 预设注册表 [v1.1.0 新增]

| 文件 | 路径 | 职责 |
|------|------|------|
| `types.ts` | `presets/types.ts` | PresetDefinition 接口、类型定义 |
| `ecom.ts` | `presets/ecom.ts` | 布局/填充预设 + 解析函数 + 提示词片段 |
| `model.ts` | `presets/model.ts` | 年龄/性别/场景/人种/姿态/风格预设 |
| `pattern.ts` | `presets/pattern.ts` | 图案类型/风格预设 |
| `index.ts` | `presets/index.ts` | 统一导出 |

### 3.5 配置表单

| 文件 | 路径 | 职责 |
|------|------|------|
| `UnifiedPromptNodeForm.tsx` | `components/ConfigForms/UnifiedPromptNodeForm.tsx` | UI 配置表单 |

---

## 四、关键类型定义

### 4.1 布局/填充模式类型

```typescript
// constants/presets.ts
export type LayoutMode = 'none' | 'flat_lay' | 'hanging' | 'random'
export type ResolvedLayoutMode = 'none' | 'flat_lay' | 'hanging'

export type FillMode = 'none' | 'filled' | 'flat' | 'random'
export type ResolvedFillMode = 'none' | 'filled' | 'flat'
```

### 4.2 选项值语义

| 值 | 语义 | 在 UnifiedPromptNode | 在 GeminiGenerateNode |
|----|------|---------------------|----------------------|
| `'none'` | AI 自由发挥 | 传递 `"none"` 到 promptJson | 转为 `undefined` 给 Builder |
| `'random'` | 随机选择 | 传递 `"random"` 到 promptJson | 随机选择具体值 |
| `'flat_lay'` | 平铺图 | 传递 `"flat_lay"` | 传递 `'flat_lay'` 给 Builder |
| `'hanging'` | 挂拍图 | 传递 `"hanging"` | 传递 `'hanging'` 给 Builder |
| `'filled'` | 立体填充 | 传递 `"filled"` | 传递 `'filled'` 给 Builder |
| `'flat'` | 自然平铺 | 传递 `"flat"` | 传递 `'flat'` 给 Builder |

### 4.3 promptJson 结构 (电商模式)

```typescript
interface EcomPromptJson {
  type: 'ecom'
  version: string
  layout_mode: 'none' | 'random' | 'flat_lay' | 'hanging'
  fill_mode: 'none' | 'random' | 'filled' | 'flat'
  platform_style: string
  garment_type: string
  garment_style: string
  garment_colors: string[]
  garment_patterns: string[]
  has_print: boolean
  print_description: string
  ip_character: string | null
  ip_description: string | null
  background_type: string
  background_color: string
  background_material: string
  suggested_props: string[]
  prop_placement: string
  prop_theme: string
  lighting_style: string
  shadow_style: string
  composition: string
  garment_angle: number
  styling_notes: string
  background_prompt: string
  props_prompt: string
  lighting_prompt: string
  composition_prompt: string
  full_prompt: string
  hpsv3_score: number
}
```

---

## 五、关键函数详解

### 5.1 resolveLayoutMode / resolveFillMode

**位置**: `constants/presets.ts:1645-1705`

**作用**: 将原始配置值解析为最终使用的值

```typescript
export function resolveLayoutMode(mode: LayoutMode | string | undefined | null): ResolvedLayoutMode {
  // 1. 'none' 或 falsy → 返回 'none'（AI 自由发挥）
  if (!mode || mode === 'none') {
    return 'none'
  }

  // 2. 'random' → 随机选择（延迟决策点）
  if (mode === 'random') {
    const options: ResolvedLayoutMode[] = ['flat_lay', 'hanging']
    return options[Math.floor(Math.random() * options.length)]
  }

  // 3. 标准化映射
  const normalizeMap: Record<string, ResolvedLayoutMode> = {
    flat_lay: 'flat_lay',
    flatlay: 'flat_lay',
    hanging: 'hanging',
    hanger: 'hanging'
  }
  return normalizeMap[mode] || 'none'
}
```

### 5.2 buildEcomSystemPrompt

**位置**: `nodes/ai/UnifiedPromptNode/prompts.ts:1044-1129`

**作用**: 根据配置构建视觉分析的系统提示词

```typescript
export function buildEcomSystemPrompt(config: UnifiedPromptNodeConfig): string {
  let fullPrompt = ECOM_SYSTEM_PROMPT

  // 布局模式指引 - 根据 layoutMode 生成不同的指导文字
  const layoutModeValue = config.layoutMode || 'none'
  const layoutModeGuide = layoutModeValue === 'none'
    ? `[Layout Mode: AI DECIDES]
       You have creative freedom to choose the best layout...`
    : layoutModeValue === 'random'
      ? `[Layout Mode: RANDOM]
         Either Flat Lay or Hanging Shot will be randomly selected...`
      : { flat_lay: '...', hanging: '...' }[layoutModeValue]

  fullPrompt += `\n\n${layoutModeGuide}`

  // 填充模式类似处理...
  return fullPrompt
}
```

### 5.3 EcomPromptBuilder.initializeModules

**位置**: `prompts/builders/EcomPromptBuilder.ts:106-144`

**作用**: 根据配置初始化模块（跳过 undefined 的模块）

```typescript
private initializeModules(): void {
  const config = this.config

  // 只有在 layout 有值时才添加布局模块
  // undefined = AI 自由发挥，不添加约束
  if (config.layout) {
    this.withModule(LayoutModule.get(config.layout))
  }

  // 只有在 fillMode 有值时才添加填充模块
  if (config.fillMode) {
    const fillType = config.fillMode === 'flat' ? 'natural_flat' : 'ghost_mannequin'
    this.withModule(FillModule.get(fillType))
  }
}
```

### 5.4 EcomPromptBuilder.buildSystemPrompt

**位置**: `prompts/builders/EcomPromptBuilder.ts:442-527`

**作用**: 构建发送给 Gemini 的系统提示词

```typescript
buildSystemPrompt(): string {
  const config = this.config

  // 布局描述：undefined 时让 AI 自行判断
  const layoutDesc = !config.layout
    ? 'product photography (you decide the best layout based on garment analysis)'
    : config.layout === 'flat_lay' ? 'flat lay product photography'
    : config.layout === 'hanging' ? 'hanging/hanger product photography'
    : 'product photography'

  // 填充描述：undefined 时让 AI 自行判断
  const fillDesc = !config.fillMode
    ? 'appropriate styling technique (you decide based on garment type)'
    : config.fillMode === 'filled' ? 'Ghost Mannequin (3D filled) technique'
    : 'natural flat lay styling'

  // 技术要求段落：根据 fillMode 生成不同内容
  const ghostMannequinSection = config.fillMode === 'filled'
    ? `[Ghost Mannequin Technical Requirements]...`
    : config.fillMode === 'flat'
    ? `[Natural Flat Styling Requirements]...`
    : `[Styling Guidance - AI DECIDES]...`

  return `[Role: Senior E-commerce Visual Director]
Your specialty: ${layoutDesc} using ${fillDesc}.
...
${ghostMannequinSection}
...`
}
```

---

## 六、配置表单 → 提示词 映射

### 6.1 UI 选项定义

```typescript
// constants/presets.ts
export const LAYOUT_MODE_OPTIONS = [
  { id: 'none', name: '无（自由发挥）', description: 'AI decides the best layout' },
  { id: 'random', name: '随机选择', description: '随机布局模式' },
  { id: 'flat_lay', name: '平铺图', description: 'Top-down flat lay main image' },
  { id: 'hanging', name: '挂拍图', description: 'Hanger hanging main image' }
]

export const FILL_MODE_OPTIONS = [
  { id: 'none', name: '无（自由发挥）', description: 'AI decides the best styling technique' },
  { id: 'random', name: '随机选择', description: '随机填充模式' },
  { id: 'filled', name: '立体填充', description: 'Ghost mannequin effect' },
  { id: 'flat', name: '自然平铺', description: 'Garment naturally flat' }
]
```

### 6.2 映射关系表

| UI 选项 | config 值 | promptJson 值 | resolve 后 | Builder config | 提示词效果 |
|---------|----------|--------------|-----------|----------------|-----------|
| 无（自由发挥）| `'none'` | `"none"` | `'none'` | `undefined` | AI DECIDES |
| 随机选择 | `'random'` | `"random"` | `'flat_lay'`或`'hanging'` | 具体值 | 具体约束 |
| 平铺图 | `'flat_lay'` | `"flat_lay"` | `'flat_lay'` | `'flat_lay'` | Flat Lay 约束 |
| 挂拍图 | `'hanging'` | `"hanging"` | `'hanging'` | `'hanging'` | Hanging 约束 |

---

## 七、测试要点

### 7.1 验证清单

- [ ] UI 选择 "无（自由发挥）" → 提示词包含 "AI DECIDES"
- [ ] UI 选择 "随机选择" → 每次执行随机选择一个具体值
- [ ] UI 选择 "平铺图" → 提示词包含 Flat Lay 具体约束
- [ ] promptJson 优先级高于节点配置
- [ ] 背面图/细节图继承主图场景风格

### 7.2 测试文件

- `prompts.test.ts` - 提示词构建测试
- `promptsRandomFallback.test.ts` - random 回退测试
- `EcomPromptBuilder.test.ts` - Builder 测试

---

## 八、修改指南

### 8.1 添加新的布局模式

1. **更新类型** (`constants/presets.ts`):
   ```typescript
   export type LayoutMode = 'none' | 'flat_lay' | 'hanging' | 'new_mode' | 'random'
   ```

2. **添加选项** (`constants/presets.ts`):
   ```typescript
   export const LAYOUT_MODE_OPTIONS = [
     // ...existing
     { id: 'new_mode', name: '新模式', description: '描述' }
   ]
   ```

3. **更新解析函数** (`constants/presets.ts`):
   ```typescript
   const normalizeMap: Record<string, ResolvedLayoutMode> = {
     // ...existing
     new_mode: 'new_mode'
   }
   ```

4. **更新 UnifiedPromptNode 提示词** (`prompts.ts`):
   ```typescript
   const layoutModeGuide = {
     // ...existing
     new_mode: `[Layout Mode: New Mode]...`
   }[layoutModeValue]
   ```

5. **更新 EcomPromptBuilder** (`EcomPromptBuilder.ts`):
   ```typescript
   const layoutDesc = config.layout === 'new_mode' ? 'new mode photography' : ...
   ```

6. **更新架构文档** - 本文件

### 8.2 修改配置处理逻辑

**关键修改点**:
1. `constants/presets.ts` - resolveLayoutMode / resolveFillMode
2. `GeminiGenerateNode/executor.ts` - buildPrompts 方法
3. `EcomPromptBuilder.ts` - initializeModules, buildSystemPrompt, buildUserPrompt

---

## 九、预设注册表系统 [v1.1.0 新增]

### 9.1 架构概述

预设注册表是"单一事实来源"（Single Source of Truth），确保 UI 选项与提示词模板的一致性。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        presets/ 目录结构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  types.ts          → PresetDefinition 接口                          │
│  ├── id            → 唯一标识                                        │
│  ├── label         → UI 显示名                                       │
│  ├── description   → 悬停提示                                        │
│  ├── systemPromptBlock → 系统提示词片段                              │
│  └── userPromptBlock   → 用户提示词片段                              │
│                                                                      │
│  ecom.ts           → 电商预设                                        │
│  ├── LAYOUT_PRESETS       (none, random, flat_lay, hanging)         │
│  ├── FILL_MODE_PRESETS    (none, random, filled, flat)              │
│  ├── resolveLayoutMode()                                            │
│  ├── resolveFillMode()                                              │
│  └── getLayoutSystemPromptBlock() / getUserPromptBlock()            │
│                                                                      │
│  model.ts          → 模特预设                                        │
│  ├── AGE_PRESETS          (small_kid, big_kid, teen, ...)           │
│  ├── GENDER_PRESETS       (female, male, unisex)                    │
│  ├── SCENE_PRESETS        (studio, home, outdoor, ...)              │
│  ├── ETHNICITY_PRESETS    (asian, caucasian, ...)                   │
│  ├── POSE_PRESETS         (natural, sitting, playing, ...)         │
│  └── STYLE_MODE_PRESETS   (daily, commercial)                       │
│                                                                      │
│  pattern.ts        → 图案预设                                        │
│  ├── PATTERN_TYPE_PRESETS   (seamless, placement, allover)          │
│  └── PATTERN_STYLE_PRESETS  (kawaii, sporty, preppy, ...)           │
│                                                                      │
│  index.ts          → 统一导出                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 使用示例

```typescript
// 从预设注册表导入
import {
  LAYOUT_PRESETS,
  resolveLayoutMode,
  getLayoutSystemPromptBlock,
  getGhostMannequinSection
} from '../../presets'

// 获取 UI 下拉选项
const layoutOptions = LAYOUT_PRESETS.getOptions()
// [{ id: 'none', name: '无（自由发挥）', description: '...' }, ...]

// 解析配置值（处理 random）
const resolved = resolveLayoutMode('random')  // → 'flat_lay' 或 'hanging'

// 获取提示词片段
const systemBlock = getLayoutSystemPromptBlock('flat_lay')
// → 'flat lay product photography'

// 获取 Ghost Mannequin 技术段落
const gmSection = getGhostMannequinSection('filled')
// → '[Ghost Mannequin Technical Requirements]...'
```

### 9.3 添加新预设

1. **在类型文件中添加类型** (`presets/types.ts`):
   ```typescript
   export type LayoutModeId = 'none' | 'random' | 'flat_lay' | 'hanging' | 'new_mode'
   ```

2. **在预设文件中添加定义** (`presets/ecom.ts`):
   ```typescript
   const LAYOUT_PRESET_DEFINITIONS: Record<LayoutModeId, PresetDefinition> = {
     // ...existing
     new_mode: {
       id: 'new_mode',
       label: '新模式',
       description: 'New mode description',
       systemPromptBlock: 'new mode photography',
       userPromptBlock: '**Layout: NEW MODE**\n...'
     }
   }
   ```

3. **更新解析函数** (`presets/ecom.ts`):
   ```typescript
   const normalizeMap: Record<string, ResolvedLayoutModeId> = {
     // ...existing
     new_mode: 'new_mode'
   }
   ```

4. UI 表单会自动从 `LAYOUT_PRESETS.getOptions()` 获取新选项

---

## 十、已完成的优化

### 10.1 阶段零：基础联动优化 [已完成 ✅]

| 任务 | 文件 | 状态 |
|------|------|------|
| 添加 resolveLayoutMode / resolveFillMode | `constants/presets.ts` | ✅ |
| 使用解析函数 | `GeminiGenerateNode/executor.ts` | ✅ |
| initializeModules 支持跳过模块 | `EcomPromptBuilder.ts` | ✅ |
| buildSystemPrompt 支持 'none' 模式 | `EcomPromptBuilder.ts` | ✅ |
| buildUserPrompt 支持 'none' 模式 | `EcomPromptBuilder.ts` | ✅ |
| buildEcomUserPrompt 传递 'none' | `UnifiedPromptNode/prompts.ts` | ✅ |
| LayoutMode/FillMode 类型更新 | `UnifiedPromptNode/types.ts` | ✅ |

### 10.2 阶段一：中央预设注册表 [已完成 ✅]

| 任务 | 文件 | 状态 |
|------|------|------|
| 创建 PresetDefinition 接口 | `presets/types.ts` | ✅ |
| 创建电商预设注册表 | `presets/ecom.ts` | ✅ |
| 创建模特预设注册表 | `presets/model.ts` | ✅ |
| 创建图案预设注册表 | `presets/pattern.ts` | ✅ |
| 统一导出 | `presets/index.ts` | ✅ |
| 重构 EcomPromptBuilder 使用 Registry | `EcomPromptBuilder.ts` | ✅ |

---

## 十一、后续计划

### 11.1 阶段二：UI 表单集成 [待实施]

目标：更新 UI 配置表单，从预设注册表动态获取选项。

### 11.2 阶段三：提示词质量优化 [待实施]

目标：优化 Ghost Mannequin、Flat Lay 等效果的提示词。

### 11.3 阶段四：测试覆盖 [待实施]

目标：编写完整的单元测试覆盖所有配置组合。

---

## 文档更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2024-12 | 1.0.0 | 初始架构文档，覆盖完整数据流和关键函数 |
| 2024-12 | 1.1.0 | 添加预设注册表系统（presets/），EcomPromptBuilder 使用 Registry |
