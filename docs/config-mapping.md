# 配置项前后端映射关系

## UnifiedPromptNode
- 前端：`UnifiedPromptConfigForm.tsx`
- 关键配置：
  - `ageGroup` → `buildModelUserPrompt` 年龄英文映射
  - `gender` → `buildModelUserPrompt` 性别英文映射
  - `scenePreset` → `buildModelUserPrompt` 场景英文映射
  - `ethnicityPreset` → `buildModelUserPrompt` 人种英文映射
  - `posePreset` → `buildModelUserPrompt` 姿态英文映射
  - `outputMode`/`outputPorts` → 节点 outputs 定义
- 后端/生成层：`nodes/ai/UnifiedPromptNode/prompts.ts`

## Pattern 图案生成
- 前端：`PatternConfigForm.tsx`
- 关键配置：
  - `generationMode` → 决定最小 `imageInputCount` 与端口生成
  - `outputType` → 仅图案/套装
  - `patternType` → `buildPatternUserPrompt` 字段 `pattern_type`
  - `imageInputCount`/`imageInputPorts` → 参考图输入端口
  - `customPrompt`/`negativePrompt` → 追加描述与禁用元素
  - `density`/`colorTone`/`imageSize`/`aspectRatio` → 图案参数
- 后端/生成层：`nodes/ai/UnifiedPromptNode/prompts.ts::buildPatternUserPrompt`

## Ecom 电商图
- 前端：`EcomConfigForm.tsx`
- 关键配置：
  - `layout`/`fillMode` → `buildEcomUserPrompt` 中 `layout_mode`/`fill_mode`
  - `stylePreset`/`styleConstraint` → 风格与约束
  - `imageSize`/`aspectRatio` → 输出尺寸与比例
  - `enableBack`/`detailTypes` → 生成背面/细节图控制
- 后端/生成层：`nodes/ai/UnifiedPromptNode/prompts.ts::buildEcomUserPrompt`

## 兼容性与版本
- `presetsVersion`：前端元字段，用于追踪预设版本，不参与生成逻辑
- 所有字段与旧版本保持一致，新增字段仅为 UI 元数据
