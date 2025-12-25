# 工作流节点开发指南

本指南介绍如何为 Cherry Studio 工作流模块开发自定义节点。

## 目录结构

```
nodes/
├── base/                          # 基础模块
│   ├── types.ts                   # 类型定义
│   ├── BaseNodeExecutor.ts        # 节点执行器基类
│   ├── NodeRegistry.ts            # 节点注册中心
│   └── index.ts                   # 导出
├── input/                         # 输入节点
├── ai/                            # AI 节点
│   └── VisionPromptNode/          # 示例：视觉提示词节点
│       ├── index.ts               # 节点定义
│       ├── executor.ts            # 执行器
│       └── prompts.ts             # 提示词模板
├── image/                         # 图像处理节点
├── video/                         # 视频节点
├── flow/                          # 流程控制节点
├── output/                        # 输出节点
└── custom/                        # 用户自定义节点
```

## 快速开始

### 1. 创建节点文件夹

在对应分类目录下创建节点文件夹：

```
nodes/ai/MyCustomNode/
├── index.ts      # 节点定义（必需）
├── executor.ts   # 执行器（必需）
└── prompts.ts    # 提示词模板（可选，AI 节点）
```

### 2. 定义节点执行器

```typescript
// executor.ts
import { BaseNodeExecutor } from '../../base/BaseNodeExecutor'
import type { NodeExecutionContext, NodeExecutionResult } from '../../base/types'

export class MyCustomExecutor extends BaseNodeExecutor {
  constructor() {
    super('my_custom_node') // 节点类型标识符
  }

  async execute(
    inputs: Record<string, any>,
    config: Record<string, any>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      // 1. 记录日志
      this.log(context, '开始执行节点')

      // 2. 验证输入
      const validation = this.validateRequiredInputs(inputs, ['image'])
      if (!validation.valid) {
        return this.error(`缺少必需输入: ${validation.missing.join(', ')}`)
      }

      // 3. 获取输入数据
      const image = this.getInput<string>(inputs, ['image', 'baseImage'])

      // 4. 执行业务逻辑
      const result = await this.processImage(image, config)

      // 5. 返回成功结果
      return this.success({
        output: result
      }, Date.now() - startTime)

    } catch (error) {
      this.logError(context, '节点执行失败', error)
      return this.error(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      )
    }
  }

  private async processImage(image: string, config: any): Promise<string> {
    // 实现业务逻辑
    return image
  }
}
```

### 3. 定义节点

```typescript
// index.ts
import type { NodeDefinition } from '../../base/types'
import { MyCustomExecutor } from './executor'

export const MyCustomNode: NodeDefinition = {
  metadata: {
    type: 'my_custom_node',        // 唯一标识符
    label: '我的自定义节点',         // 显示名称
    icon: '🎨',                     // 图标
    category: 'ai',                 // 分类
    version: '1.0.0',
    author: 'Your Name',
    description: '节点功能描述',
    tags: ['custom', 'image']
  },

  inputs: [
    {
      id: 'image',
      label: '输入图片',
      dataType: 'image',
      required: true,
      description: '需要处理的图片'
    }
  ],

  outputs: [
    {
      id: 'output',
      label: '输出结果',
      dataType: 'image',
      description: '处理后的图片'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'quality',
        label: '质量',
        type: 'select',
        default: 'high',
        options: [
          { label: '高', value: 'high' },
          { label: '中', value: 'medium' },
          { label: '低', value: 'low' }
        ]
      },
      {
        key: 'customPrompt',
        label: '自定义提示词',
        type: 'textarea',
        placeholder: '输入自定义提示词...'
      }
    ]
  },

  defaultConfig: {
    quality: 'high'
  },

  executor: new MyCustomExecutor()
}

export default MyCustomNode
```

### 4. 注册节点

在 `nodes/index.ts` 中注册节点：

```typescript
import { nodeRegistry } from './base'
import { MyCustomNode } from './ai/MyCustomNode'

export async function registerBuiltinNodes(): Promise<void> {
  nodeRegistry.register(MyCustomNode, 'builtin')
}
```

## 类型定义

### 端口数据类型

```typescript
type PortDataType = 'image' | 'video' | 'text' | 'json' | 'any' | 'boolean' | 'number'
```

### 节点分类

```typescript
type NodeCategory = 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output' | 'custom'
```

### 配置字段类型

```typescript
type ConfigFieldType =
  | 'text'           // 单行文本
  | 'textarea'       // 多行文本
  | 'number'         // 数字
  | 'select'         // 下拉选择
  | 'checkbox'       // 复选框
  | 'model-selector' // 模型选择器
  | 'image-upload'   // 图片上传
  | 'folder-selector' // 文件夹选择
```

## 使用 WorkflowAiService

对于 AI 节点，使用 `WorkflowAiService` 进行 AI 调用：

```typescript
import { WorkflowAiService } from '../../../services/WorkflowAiService'

// 文本生成
const text = await WorkflowAiService.generateText(provider, model, {
  systemPrompt: '...',
  userPrompt: '...',
  temperature: 0.7
})

// 视觉分析
const result = await WorkflowAiService.visionAnalysis(provider, model, {
  systemPrompt: '...',
  userPrompt: '...',
  images: ['base64...']
})

// Gemini 图片生成
const image = await WorkflowAiService.generateImageWithGemini(provider, model, {
  prompt: '...',
  images: ['base64...'],
  aspectRatio: '1:1'
})

// 加载图片为 base64
const base64List = await WorkflowAiService.loadImagesAsBase64(imagePaths)
```

## BaseNodeExecutor 工具方法

```typescript
// 创建结果
this.success(outputs, duration)
this.error(message, duration)
this.skipped(reason)

// 日志
this.log(context, message, data)
this.logError(context, message, error)

// 输入处理
this.validateRequiredInputs(inputs, ['key1', 'key2'])
this.getInput<T>(inputs, ['key1', 'key2'], defaultValue)
this.collectImageInputs(inputs)

// 其他
this.shouldAbort(context)
this.sleep(ms)
```

## 约束提示词

AI 节点支持用户自定义约束提示词：

```typescript
configSchema: {
  fields: [
    {
      key: 'constraintPrompt',
      label: '约束提示词',
      type: 'textarea',
      placeholder: '例如：双手叉腰、眼神看向镜头...',
      description: '自定义约束条件'
    }
  ]
}
```

在执行器中使用：

```typescript
let systemPrompt = baseSystemPrompt
if (config.constraintPrompt) {
  systemPrompt += `\n\nAdditional constraints:\n${config.constraintPrompt}`
}
```

## 电商预设

为电商场景提供预设：

```typescript
const ECOM_STYLE_PRESETS = [
  { id: 'shein', name: 'SHEIN 风格', prompt: '...' },
  { id: 'temu', name: 'TEMU 风格', prompt: '...' },
  { id: 'amazon', name: 'Amazon 风格', prompt: '...' }
]
```

## 最佳实践

1. **错误处理**: 始终使用 try-catch 包装执行逻辑
2. **日志记录**: 使用 `this.log()` 记录关键步骤
3. **输入验证**: 在执行前验证必需输入
4. **类型安全**: 使用 TypeScript 类型定义
5. **模块化**: 将提示词、配置等分离到独立文件
6. **文档**: 为节点添加清晰的描述和标签

## 热加载自定义节点

```typescript
// 加载自定义节点
await nodeRegistry.loadCustomNode('/path/to/MyNode/index.ts')

// 重新加载
await nodeRegistry.reloadCustomNode('my_node_type')
```

## 配置表单组件

### 使用 EcomPresetSelector

为 AI 节点快速添加电商预设和约束提示词：

```tsx
import EcomPresetSelector from '../ConfigForms/EcomPresetSelector'

function MyNodeConfigForm({ config, onUpdateConfig }) {
  return (
    <div>
      {/* 其他配置项 */}

      <EcomPresetSelector
        config={config}
        onUpdateConfig={onUpdateConfig}
        showConstraintPrompt={true}
        showEcomPresets={true}
        showModelPresets={true}
        showScenePresets={true}
        constraintPlaceholder="输入约束条件..."
      />
    </div>
  )
}
```

### 可用的表单组件

```tsx
import {
  FormRow,
  FormSection,
  FormSelect,
  FormSlider,
  FormSwitch,
  FormTextArea
} from '../ConfigForms/FormComponents'

// 使用示例
<FormSection title="基础设置">
  <FormRow label="选项" description="选择一个选项">
    <FormSelect
      value={config.option}
      onChange={(value) => onUpdateConfig('option', value)}
      options={[
        { label: '选项1', value: 'opt1' },
        { label: '选项2', value: 'opt2' }
      ]}
    />
  </FormRow>
</FormSection>
```

## 电商风格预设详解

### 支持的平台

| 平台 | ID | 特点 |
|------|-----|------|
| SHEIN | `shein` | 年轻时尚、色彩鲜艳、Instagram 风格 |
| TEMU | `temu` | 实惠亲民、清晰展示、产品聚焦 |
| Amazon | `amazon` | 专业标准、纯白背景、高质量 |
| 淘宝 | `taobao` | 生活化场景、亲和力强 |
| 小红书 | `xiaohongshu` | 精致美学、氛围感、高级感 |

### 使用电商预设

```typescript
import { getEcomPreset, buildEcomPrompt } from '../../constants/presets'

// 获取预设
const preset = getEcomPreset('shein')

// 构建完整提示词
const prompt = buildEcomPrompt(preset, '额外约束条件')
```

## 完整节点示例

### 图片风格转换节点

```typescript
// nodes/image/StyleTransferNode/index.ts
import type { NodeDefinition } from '../../base/types'
import { StyleTransferExecutor } from './executor'

export const StyleTransferNode: NodeDefinition = {
  metadata: {
    type: 'style_transfer',
    label: '风格转换',
    icon: '🎨',
    category: 'image',
    version: '1.0.0',
    description: '将图片转换为指定风格',
    tags: ['image', 'style', 'transfer']
  },

  inputs: [
    { id: 'image', label: '输入图片', dataType: 'image', required: true },
    { id: 'style_ref', label: '风格参考', dataType: 'image', required: false }
  ],

  outputs: [
    { id: 'result', label: '转换结果', dataType: 'image' }
  ],

  configSchema: {
    fields: [
      {
        key: 'style',
        label: '风格',
        type: 'select',
        default: 'anime',
        options: [
          { label: '动漫风格', value: 'anime' },
          { label: '油画风格', value: 'oil_painting' },
          { label: '水彩风格', value: 'watercolor' },
          { label: '素描风格', value: 'sketch' }
        ]
      },
      {
        key: 'strength',
        label: '转换强度',
        type: 'number',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.1
      },
      {
        key: 'constraintPrompt',
        label: '约束提示词',
        type: 'textarea',
        placeholder: '保持人物面部特征...'
      }
    ]
  },

  defaultConfig: {
    style: 'anime',
    strength: 0.7
  },

  executor: new StyleTransferExecutor()
}
```

## 调试技巧

### 1. 使用日志

```typescript
this.log(context, '步骤1: 开始处理', { inputCount: inputs.length })
this.log(context, '步骤2: 调用 API', { model: config.modelId })
this.logError(context, '处理失败', error)
```

### 2. 检查输入数据

```typescript
console.log('[MyNode] 收到的输入:', {
  keys: Object.keys(inputs),
  values: Object.fromEntries(
    Object.entries(inputs).map(([k, v]) => [
      k,
      typeof v === 'string' ? v.substring(0, 50) : typeof v
    ])
  )
})
```

### 3. 验证配置

```typescript
if (!config.modelId) {
  return this.error('请选择 AI 模型')
}
```

## 常见问题

### Q: 如何获取 Provider 和 Model？

```typescript
import { WorkflowAiService } from '../../../services/WorkflowAiService'

// 方法1: 从配置获取
const { provider, model } = WorkflowAiService.getProviderAndModel(
  config.providerId,
  config.modelId
)

// 方法2: 自动查找视觉模型
const visionModel = await WorkflowAiService.findVisionModel()

// 方法3: 查找 Gemini 图片生成模型
const geminiModel = await WorkflowAiService.findGeminiImageProvider()
```

### Q: 如何处理图片输入？

```typescript
// 收集所有图片输入
const images = this.collectImageInputs(inputs)

// 加载为 base64
const base64Images = await WorkflowAiService.loadImagesAsBase64(images)
```

### Q: 如何支持取消操作？

```typescript
async execute(inputs, config, context) {
  // 在长时间操作前检查
  if (this.shouldAbort(context)) {
    return this.skipped('用户取消')
  }

  // 执行操作...
}
```

## 版本历史

- **v1.0.0** (2024-01): 初始版本
  - 基础节点架构
  - WorkflowAiService 集成
  - 电商预设支持
  - 约束提示词功能
