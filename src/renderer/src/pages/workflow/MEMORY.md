# 工作流开发记忆存储

## 核心原则

### 1. API 配置原则

- **所有 AI 节点必须使用 Cherry Studio 的模型服务配置**
- 不走官方 API，走用户在"模型服务"中配置的第三方 API
- 使用 `@renderer/hooks/useProvider` 获取用户配置的 Provider
- 模型选择器应该使用 Cherry 的 `ModelSelector` 或 `SelectModelPopup` 组件

### 2. Cherry Studio API 集成方式

```typescript
// 方式1: 使用 hooks
import { useProviders, useProvider } from '@renderer/hooks/useProvider'

const { providers } = useProviders()  // 获取所有启用的 providers
const { provider, models } = useProvider(providerId)  // 获取特定 provider

// Provider 类型关键字段:
// - id: string
// - apiKey: string
// - apiHost: string (baseUrl)
// - models: Model[]

// 方式2: 直接从 store
import { useAppSelector } from '@renderer/store'
const providers = useAppSelector(state => state.llm.providers)
```

### 3. 模型选择器组件

```typescript
// 方式1: SelectModelPopup (弹窗选择)
import { SelectModelPopup } from '@renderer/components/Popups/SelectModelPopup'
const selectedModel = await SelectModelPopup.show({
  model: currentModel,
  filter: (m) => m.capabilities?.includes('vision')
})

// 方式2: ModelSelector (下拉选择)
import ModelSelector from '@renderer/components/ModelSelector'
<ModelSelector
  providers={providers}
  value={modelId}
  onChange={handleChange}
  grouped={true}
/>

// 方式3: ModelSelectButton (图标按钮)
import ModelSelectButton from '@renderer/components/ModelSelectButton'
<ModelSelectButton
  model={currentModel}
  onSelectModel={setModel}
  modelFilter={(m) => m.capabilities?.includes('vision')}
/>
```

### 4. 文件系统 API

```typescript
// 读取文件夹内容 - 返回 string[] (文件完整路径数组)
const files = await window.api.file.listDirectory(dirPath, {
  recursive: false,
  includeFiles: true,
  includeDirectories: false
})
// 注意: searchPattern 不支持复杂 glob，建议在前端过滤

// 选择文件夹
const folderPath = await window.api.file.selectFolder()

// 读取图片为 base64
const { base64, mime } = await window.api.file.base64Image(filePath)

// 读取文件内容
const content = await window.api.file.readExternal(filePath)

// 选择文件
const files = await window.api.file.select({
  filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }],
  properties: ['openFile', 'multiSelections']
})

// 获取拖拽文件的真实路径 (用于拖拽上传)
const filePath = window.api.file.getPathForFile(file)
```

## 节点类型说明

| 节点类型        | 用途                              | Provider 需求    | 状态                    |
| --------------- | --------------------------------- | ---------------- | ----------------------- |
| image_input     | 图片输入（文件夹路径 + 拖拽上传） | 无               | ✅ 完善                 |
| text_input      | 文本输入                          | 无               | ✅ 完善                 |
| file_input      | 通用文件输入（备用）              | 无               | ⚠️ 待完善             |
| qwen_prompt     | Qwen 提示词生成                   | OpenAI 兼容      | ✅ 完善                 |
| vision_prompt   | 视觉提示词生成                    | 需要 vision 能力 | ✅ 完善                 |
| gemini_generate | Gemini 图片生成                   | Google Gemini    | ✅ 使用 Cherry Provider |
| gemini_edit     | Gemini 图片编辑                   | Google Gemini    | ✅ 使用 Cherry Provider |
| gemini_ecom     | 电商实拍图                        | Google Gemini    | ✅ 使用 Cherry Provider |
| gemini_pattern  | 图案生成                          | Google Gemini    | ✅ 使用 Cherry Provider |

### 关于 file_input 节点

**当前状态**: 备用/待完善

**设计意图**:

- 最初设计为通用文件输入节点
- 由于 image_input 已支持文件夹路径和拖拽上传两种模式，file_input 的需求场景减少

**建议**:

1. 可以删除此节点类型（如果不需要非图片文件输入）
2. 或改造为支持其他文件类型（如视频、音频、文档等）的输入节点

## 文件路径参考

| 功能             | 文件路径                                                 |
| ---------------- | -------------------------------------------------------- |
| Provider 类型    | `src/renderer/src/types/provider.ts`                   |
| Model 类型       | `src/renderer/src/types/index.ts`                      |
| LLM Store        | `src/renderer/src/store/llm.ts`                        |
| Provider Hooks   | `src/renderer/src/hooks/useProvider.ts`                |
| 文件 API         | `src/preload/index.ts`                                 |
| SelectModelPopup | `src/renderer/src/components/Popups/SelectModelPopup/` |
| ModelSelector    | `src/renderer/src/components/ModelSelector.tsx`        |

## 更新日志

- 2024-12-08: 创建记忆文件
- 2024-12-08: 添加完整的 Cherry API 集成方式
- 2024-12-08: 修复 listDirectory API 调用方式 (返回 string[] 而非对象)
- 2024-12-08: 添加图片拖拽上传功能到 ImageInputConfigForm
- 2024-12-08: 改进 GeminiClient Provider 查找逻辑，支持系统内置和用户自定义 Provider
- 2024-12-08: 添加 `gemini-image` 端点类型，支持 Gemini generateContent API 图像生成
- 2024-12-08: 实现完整的 GeminiClient generateContent API 调用，支持多图片输入
- 2024-12-08: 工作流节点支持从节点配置中获取 Provider 和 Model
- 2024-12-08: 绘画功能 (NewApiPage) 支持 `gemini-image` 端点类型，自动识别并使用 Gemini generateContent API

## Gemini 图像生成 API 集成

### 端点类型

Cherry Studio 现在支持 `gemini-image` 端点类型，用于 Gemini generateContent API 的图像生成功能。

**设置方法:**

1. 在"模型服务"中添加支持 Gemini API 的 Provider（如 ai.comfly.chat, open.cherryin.ai 等）
2. 添加模型时，设置端点类型为 "图像生成 (Gemini)"
3. 工作流节点会自动查找并使用配置了 `gemini-image` 端点类型的模型

### Gemini generateContent API 格式

```typescript
// API URL 格式
const url = `${baseUrl}/models/${modelId}:generateContent?key=${apiKey}`

// 请求体格式
const payload = {
  contents: [{
    parts: [
      { text: prompt },  // 提示词
      {                  // 输入图片 (可选)
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64ImageData
        }
      }
    ]
  }],
  generationConfig: {
    temperature: 1.0,
    topP: 0.95,
    maxOutputTokens: 8192,
    responseModalities: ['IMAGE'],  // 关键：只返回图片
    imageConfig: {
      aspectRatio: '1:1',  // 支持 1:1, 16:9, 9:16, 4:3, 3:4
      imageSize: '2K'      // 支持 1K, 2K, 4K
    }
  },
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
  ]
}

// 响应解析
// 图片在 result.candidates[0].content.parts[].inlineData.data (base64)
```

### 支持的 API 服务商

| 服务商      | Base URL                               | 模型                              |
| ----------- | -------------------------------------- | --------------------------------- |
| Comfly Chat | https://ai.comfly.chat/v1beta/models   | gemini-3-pro-image-preview        |
| Cherryin AI | https://open.cherryin.ai/v1beta/models | google/gemini-3-pro-image-preview |
| AIHubMix    | https://aihubmix.com/v1beta/models     | gemini-3-pro-image-preview        |
| T8Star      | https://ai.t8star.cn/v1beta/models     | gemini-3-pro-image-preview        |

### GeminiClient 使用方式

```typescript
import { GeminiClient, type GeminiImageConfig } from '../clients'

// 方式1: 自动查找 gemini-image 端点类型的 Provider
const client = new GeminiClient()

// 方式2: 指定 Provider 和 Model
const client = new GeminiClient({
  providerId: 'my-provider-id',
  modelId: 'gemini-3-pro-image-preview',
  aspectRatio: '1:1',
  imageSize: '2K'
})

// 图片生成
const imageDataUrl = await client.generateImage({
  prompt: '生成一张图片',
  images: ['base64_or_url_1', 'base64_or_url_2'],  // 可选输入图片
  negativePrompt: '不要包含...',
  aspectRatio: '1:1',
  imageSize: '2K'
})

// 图片编辑
const editedImageDataUrl = await client.editImage({
  baseImage: 'base64_or_url',
  prompt: '编辑指令',
  additionalImages: ['other_image_1'],
  aspectRatio: '1:1',
  imageSize: '2K'
})
```

## 参考脚本

API 请求格式参考 `E:\1\ai-workflow\参考脚本\商拍.py`，该脚本包含：

- 多 API 服务商配置
- Google Vertex AI 格式和 OpenAI 兼容格式
- 图片编码和解析逻辑
- 错误处理和重试机制

## 绘画功能 Gemini 支持

### 端点类型支持

绘画功能 (`src/renderer/src/pages/paintings/NewApiPage.tsx`) 现在同时支持两种图像生成端点类型：

1. **image-generation**: OpenAI 兼容的图像生成 API
2. **gemini-image**: Gemini generateContent API

### 工作原理

1. 模型过滤：从 Provider 的模型列表中筛选 `endpoint_type` 为 `image-generation` 或 `gemini-image` 的模型
2. API 调用：根据选中模型的 `endpoint_type` 自动选择调用方式
   - `image-generation`: 使用 OpenAI `/v1/images/generations` API
   - `gemini-image`: 使用 Gemini `generateContent` API

### 使用方式

1. 在 Provider 设置中添加支持 Gemini API 的服务商（如 ai.comfly.chat）
2. 添加模型时，设置端点类型为 "图像生成 (Gemini)"
3. 在绘画功能中选择该模型即可使用 Gemini 图像生成

### 代码位置

| 功能         | 文件路径                                                 |
| ------------ | -------------------------------------------------------- |
| 绘画主页面   | `src/renderer/src/pages/paintings/NewApiPage.tsx`      |
| 端点类型选项 | `src/renderer/src/config/endpointTypes.ts`             |
| 类型定义     | `src/renderer/src/types/index.ts` (EndPointTypeSchema) |
