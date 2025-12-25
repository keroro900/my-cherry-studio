# 工作流节点开发指南

本文档为开发者提供创建新工作流节点的完整指南和规范。

## 目录

1. [架构概述](#架构概述)
2. [节点组成](#节点组成)
3. [开发步骤](#开发步骤)
4. [类型系统](#类型系统)
5. [配置表单](#配置表单)
6. [执行器实现](#执行器实现)
7. [最佳实践](#最佳实践)
8. [示例代码](#示例代码)

---

## 架构概述

### 技术栈

- **React Flow**: 画布和节点渲染
- **Redux Toolkit**: 状态管理
- **Ant Design**: UI 组件库
- **TypeScript**: 类型安全
- **styled-components**: 样式方案

### 核心目录结构

```
workflow/
├── types/               # 类型定义
│   ├── index.ts         # 基础类型和 NODE_REGISTRY
│   └── advanced-nodes.ts # 高级节点类型
├── components/
│   ├── Nodes/           # 节点渲染组件
│   └── ConfigForms/     # 配置表单组件
├── engine/
│   └── WorkflowEngine.ts # 执行引擎
├── presets/
│   └── nodePrompts.ts   # 节点预设提示词
├── constants/
│   └── system-prompts.ts # 系统提示词模板
└── utils/               # 工具函数
```

### 数据流

```
用户操作 → Redux Store → 节点组件 → 配置表单
                ↓
执行引擎 ← 工作流数据 ← 节点定义
                ↓
      AI 服务调用 → 结果输出
```

---

## 节点组成

每个节点由以下部分组成：

### 1. 节点类型定义 (NodeDefinition)

```typescript
interface NodeDefinition {
  type: WorkflowNodeType        // 节点类型枚举
  label: string                 // 显示名称
  icon: string                  // 图标 emoji
  category: NodeCategory        // 分类
  description: string           // 描述
  defaultInputs: NodeHandle[]   // 默认输入端口
  defaultOutputs: NodeHandle[]  // 默认输出端口
  defaultConfig: Record<string, any>  // 默认配置
}
```

### 2. 配置类型 (Config Interface)

```typescript
interface MyNodeConfig {
  // 节点特定的配置参数
  param1: string
  param2: number
  // ...
}
```

### 3. 配置表单组件 (ConfigForm)

```tsx
function MyNodeConfigForm({ config, onChange }) {
  // 渲染配置 UI
}
```

### 4. 执行器方法 (Executor)

```typescript
async function executeMyNode(
  nodeData: WorkflowNodeData,
  inputs: Record<string, any>,
  context: WorkflowExecutionContext
): Promise<Record<string, any>> {
  // 节点执行逻辑
}
```

---

## 开发步骤

### Step 1: 定义节点类型枚举

在 `types/index.ts` 的 `WorkflowNodeType` 枚举中添加：

```typescript
export enum WorkflowNodeType {
  // ... 已有类型

  // 添加新节点类型
  MY_NEW_NODE = 'my_new_node',
}
```

### Step 2: 定义配置接口

在 `types/index.ts` 中添加配置类型：

```typescript
/**
 * 我的新节点配置
 */
export interface MyNewNodeConfig {
  /** 参数1 - 必填 */
  param1: string
  /** 参数2 - 可选 */
  param2?: number
  /** 模型选择 */
  model?: Model
  /** Provider ID */
  providerId?: string
}
```

### Step 3: 注册到 NODE_REGISTRY

在 `types/index.ts` 的 `NODE_REGISTRY` 中添加：

```typescript
export const NODE_REGISTRY: Record<WorkflowNodeType, NodeDefinition> = {
  // ... 已有节点

  [WorkflowNodeType.MY_NEW_NODE]: {
    type: WorkflowNodeType.MY_NEW_NODE,
    label: '我的新节点',
    icon: '🆕',
    category: 'ai',  // 可选: 'input' | 'ai' | 'image' | 'video' | 'flow' | 'output'
    description: '这是一个新节点的描述',
    defaultInputs: [
      { id: 'input1', label: '输入1', dataType: 'text', required: true },
      { id: 'image', label: '图片', dataType: 'image' }
    ],
    defaultOutputs: [
      { id: 'output1', label: '输出1', dataType: 'text' },
      { id: 'result', label: '结果', dataType: 'json' }
    ],
    defaultConfig: {
      param1: 'default_value',
      param2: 10
    } as MyNewNodeConfig
  }
}
```

### Step 4: 创建配置表单组件

创建 `components/ConfigForms/MyNewNodeConfigForm.tsx`：

```tsx
/**
 * 我的新节点配置表单
 */

import { Form, Input, InputNumber, Select } from 'antd'
import { memo, useCallback } from 'react'

import type { MyNewNodeConfig } from '../../types'
import { FormSection, FormLabel, HelpText } from './FormComponents'

interface MyNewNodeConfigFormProps {
  config: MyNewNodeConfig
  onChange: (config: MyNewNodeConfig) => void
}

function MyNewNodeConfigForm({ config, onChange }: MyNewNodeConfigFormProps) {
  const handleChange = useCallback((field: keyof MyNewNodeConfig, value: any) => {
    onChange({ ...config, [field]: value })
  }, [config, onChange])

  return (
    <Form layout="vertical" size="small">
      <FormSection title="基础配置">
        <Form.Item label={<FormLabel>参数1</FormLabel>} required>
          <Input
            value={config.param1}
            onChange={(e) => handleChange('param1', e.target.value)}
            placeholder="请输入参数1"
          />
          <HelpText>这是参数1的帮助说明</HelpText>
        </Form.Item>

        <Form.Item label={<FormLabel>参数2</FormLabel>}>
          <InputNumber
            value={config.param2}
            onChange={(v) => handleChange('param2', v)}
            min={1}
            max={100}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </FormSection>
    </Form>
  )
}

export default memo(MyNewNodeConfigForm)
```

### Step 5: 导出配置表单

在 `components/ConfigForms/index.ts` 中添加导出：

```typescript
export { default as MyNewNodeConfigForm } from './MyNewNodeConfigForm'
```

### Step 6: 实现执行器

在 `engine/WorkflowEngine.ts` 中添加执行方法：

```typescript
private async executeMyNewNode(
  nodeData: WorkflowNodeData,
  inputs: Record<string, any>,
  context: WorkflowExecutionContext
): Promise<Record<string, any>> {
  const config = nodeData.config as MyNewNodeConfig

  // 获取输入数据
  const input1 = inputs.input1
  const image = inputs.image

  // 执行节点逻辑
  // ...

  // 返回输出
  return {
    output1: 'result_value',
    result: { key: 'value' }
  }
}
```

### Step 7: 在 executeNode 中注册

在 `WorkflowEngine.ts` 的 `executeNode` 方法中添加 case：

```typescript
switch (nodeData.nodeType) {
  // ... 已有 case

  case WorkflowNodeType.MY_NEW_NODE:
    outputs = await this.executeMyNewNode(nodeData, inputs, context)
    break
}
```

### Step 8: 添加预设提示词（可选）

如果节点需要 AI 提示词，在 `presets/nodePrompts.ts` 中添加：

```typescript
export const MY_NODE_PROMPTS: Record<string, NodePromptPreset> = {
  my_new_node: {
    nodeType: 'my_new_node',
    displayName: '我的新节点专家',
    category: '自定义',
    description: '节点功能描述',
    systemPrompt: `你是...`,
    userPromptTemplate: '请帮我...'
  }
}
```

---

## 类型系统

### 数据类型 (WorkflowDataType)

```typescript
type WorkflowDataType = 'text' | 'image' | 'images' | 'video' | 'json' | 'any'
```

- `text`: 文本字符串
- `image`: 单张图片 (URL 或 Base64)
- `images`: 图片数组
- `video`: 视频 (URL 或 Base64)
- `json`: JSON 对象
- `any`: 任意类型

### 端口定义 (NodeHandle)

```typescript
interface NodeHandle {
  id: string           // 端口唯一ID
  label: string        // 显示标签
  dataType: WorkflowDataType  // 数据类型
  required?: boolean   // 是否必填
  multiple?: boolean   // 是否允许多连接
}
```

### 连接验证规则

- `any` 类型可以连接任何类型
- `images` 可以连接到 `image`
- 其他类型必须完全匹配

---

## 配置表单

### 通用表单组件

使用 `FormComponents.tsx` 中的基础组件：

```tsx
import {
  FormSection,      // 表单分组
  FormLabel,        // 表单标签
  HelpText,         // 帮助文字
  RequiredMark,     // 必填标记
  FieldGroup,       // 字段组
  InlineFields      // 行内字段
} from './FormComponents'
```

### 模型选择器

如果节点需要 AI 模型，使用 `AIModelConfigForm`：

```tsx
import { AIModelConfigForm } from './ConfigForms'

// 在表单中使用
<AIModelConfigForm
  providerId={config.providerId}
  modelId={config.model?.id}
  onProviderChange={(id) => handleChange('providerId', id)}
  onModelChange={(model) => handleChange('model', model)}
/>
```

### 图片输入

使用 `SmartImageInput` 或 `FolderPathInput`：

```tsx
import { SmartImageInput } from './ConfigForms'

<SmartImageInput
  images={config.images}
  onChange={(images) => handleChange('images', images)}
  maxImages={10}
/>
```

---

## 执行器实现

### 执行上下文

```typescript
interface WorkflowExecutionContext {
  workflowId: string
  startTime: number
  nodeOutputs: Map<string, Record<string, any>>
  nodeResults: Map<string, NodeExecutionResult>
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  error?: string
  abortController?: AbortController
}
```

### 访问上游输出

```typescript
// 从 context 获取任意节点的输出
const upstreamOutput = context.nodeOutputs.get(upstreamNodeId)

// 从 inputs 获取通过连线传入的数据（推荐）
const inputData = inputs.inputHandleId
```

### 错误处理

```typescript
try {
  // 执行逻辑
} catch (error) {
  throw new Error(`节点执行失败: ${error.message}`)
}
```

### 调用 AI 服务

使用 Cherry Studio 的 AiProvider：

```typescript
import AiProvider from '@renderer/aiCore'

const aiProvider = new AiProvider(provider)
let result = ''

await aiProvider.completions({
  assistant,
  messages: prompt,
  streamOutput: false,
  callType: 'generate',
  onChunk: (chunk) => {
    if (chunk.type === ChunkType.TEXT_DELTA) {
      result += chunk.text || ''
    }
  }
})
```

---

## 最佳实践

### 1. 命名规范

- 节点类型: `SNAKE_CASE` (枚举) / `snake_case` (值)
- 配置接口: `PascalCase` + `Config` 后缀
- 表单组件: `PascalCase` + `ConfigForm` 后缀
- 端口 ID: `camelCase`

### 2. 端口设计原则

- 必填端口放在前面
- 使用清晰的中文标签
- 合理设置 `required` 和 `multiple`
- 输出端口要明确数据类型

### 3. 配置表单设计

- 使用 `FormSection` 分组
- 提供 `HelpText` 说明
- 必填字段标记 `required`
- 使用合适的输入组件

### 4. 执行器设计

- 先验证必填输入
- 使用 try-catch 包装
- 返回清晰的错误信息
- 支持取消操作 (`context.abortController`)

### 5. 性能考虑

- 使用 `memo` 包装表单组件
- 避免不必要的重渲染
- 大文件使用流式处理
- 支持进度回调

---

## 示例代码

### 完整的图片处理节点示例

```typescript
// types/index.ts
export enum WorkflowNodeType {
  // ...
  IMAGE_RESIZE = 'image_resize',
}

export interface ImageResizeConfig {
  width: number
  height: number
  maintainAspectRatio: boolean
  resizeMode: 'fit' | 'fill' | 'stretch'
}

// NODE_REGISTRY 中添加
[WorkflowNodeType.IMAGE_RESIZE]: {
  type: WorkflowNodeType.IMAGE_RESIZE,
  label: '图片缩放',
  icon: '📐',
  category: 'image',
  description: '调整图片尺寸',
  defaultInputs: [
    { id: 'image', label: '输入图片', dataType: 'image', required: true }
  ],
  defaultOutputs: [
    { id: 'resizedImage', label: '缩放后图片', dataType: 'image' }
  ],
  defaultConfig: {
    width: 1024,
    height: 1024,
    maintainAspectRatio: true,
    resizeMode: 'fit'
  } as ImageResizeConfig
}
```

```tsx
// components/ConfigForms/ImageResizeConfigForm.tsx
import { Form, InputNumber, Switch, Radio } from 'antd'
import { memo, useCallback } from 'react'

import type { ImageResizeConfig } from '../../types'
import { FormSection, FormLabel, HelpText } from './FormComponents'

interface Props {
  config: ImageResizeConfig
  onChange: (config: ImageResizeConfig) => void
}

function ImageResizeConfigForm({ config, onChange }: Props) {
  const handleChange = useCallback(
    (field: keyof ImageResizeConfig, value: any) => {
      onChange({ ...config, [field]: value })
    },
    [config, onChange]
  )

  return (
    <Form layout="vertical" size="small">
      <FormSection title="尺寸设置">
        <Form.Item label={<FormLabel>宽度 (px)</FormLabel>}>
          <InputNumber
            value={config.width}
            onChange={(v) => handleChange('width', v || 1024)}
            min={1}
            max={4096}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={<FormLabel>高度 (px)</FormLabel>}>
          <InputNumber
            value={config.height}
            onChange={(v) => handleChange('height', v || 1024)}
            min={1}
            max={4096}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={<FormLabel>保持宽高比</FormLabel>}>
          <Switch
            checked={config.maintainAspectRatio}
            onChange={(v) => handleChange('maintainAspectRatio', v)}
          />
        </Form.Item>
      </FormSection>

      <FormSection title="缩放模式">
        <Radio.Group
          value={config.resizeMode}
          onChange={(e) => handleChange('resizeMode', e.target.value)}
        >
          <Radio value="fit">适应 (Fit)</Radio>
          <Radio value="fill">填充 (Fill)</Radio>
          <Radio value="stretch">拉伸 (Stretch)</Radio>
        </Radio.Group>
        <HelpText>
          适应: 保持比例，可能有留白；填充: 保持比例，可能裁切；拉伸: 不保持比例
        </HelpText>
      </FormSection>
    </Form>
  )
}

export default memo(ImageResizeConfigForm)
```

```typescript
// engine/WorkflowEngine.ts 中添加执行方法
private async executeImageResize(
  nodeData: WorkflowNodeData,
  inputs: Record<string, any>,
  _context: WorkflowExecutionContext
): Promise<Record<string, any>> {
  const config = nodeData.config as ImageResizeConfig
  const inputImage = inputs.image

  if (!inputImage) {
    throw new Error('图片缩放节点需要输入图片')
  }

  // 实际的图片缩放逻辑
  // 可以使用 Canvas API 或调用后端服务
  const resizedImage = await this.resizeImage(
    inputImage,
    config.width,
    config.height,
    config.maintainAspectRatio,
    config.resizeMode
  )

  return {
    resizedImage
  }
}

private async resizeImage(
  image: string,
  width: number,
  height: number,
  maintainAspectRatio: boolean,
  mode: 'fit' | 'fill' | 'stretch'
): Promise<string> {
  // 图片处理实现...
  return image // 占位
}
```

---

## 常见问题

### Q: 如何添加动态端口？

在节点数据中动态修改 `inputs` 和 `outputs` 数组，并触发 Redux 更新。

### Q: 如何支持批处理？

使用 `images` 数据类型，或参考 `advanced-nodes.ts` 中的 List 节点。

### Q: 如何添加自定义验证？

在执行器方法开始处添加验证逻辑，抛出明确的错误信息。

### Q: 如何支持取消操作？

检查 `context.abortController?.signal.aborted`，在长时间操作中定期检查。

---

## 版本历史

- v1.0.0 - 初始版本，基础节点架构
- v1.1.0 - 添加高级节点 (List/Pipe/Switch/Loop)
- v1.2.0 - 添加预设提示词系统
- v1.3.0 - 添加自动导出功能
