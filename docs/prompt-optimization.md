# 节点提示词系统优化说明

## 修改概览
- 迁移与融合参考实现中的结构化提示词：引入“角色定义/输入说明/核心目标/布局指令/填充与立体感/造型规则/自动背景/数据一致性/光线与质感/质量检查/负面提示词/附加说明”的分段结构。
- 修复并重构 `ECOM_FILL_TEXT`：改为单一模板字符串，解决多段字符串语法错误，保证类型检查与运行期稳定。
- 引入 `buildStyleHints(garmentDesc)`：根据服装描述自动生成风格提示，提升生成结果的贴合度。
- 统一负面提示词：新增 `ECOM_NEGATIVE_PROMPT` 常量，在光影规则段落内复用，避免多处硬编码。
- 优化生成流程：在 `buildEcomMainPrompt` 中注入 `styleHints`；为背面与细节提示词加入质量检查清单。

## 代码改动要点
- 文件：`src/renderer/src/pages/workflow/presets/nodePrompts.ts`
  - 重构 `ECOM_FILL_TEXT.filled` 为单一模板字符串，去除无连接的多段字符串。
  - 新增 `ECOM_NEGATIVE_PROMPT` 常量，并上移到 `ECOM_LIGHTING_TEXT` 之前定义，避免运行期初始化错误。
  - 新增 `buildStyleHints(garmentDesc: string)` 并在 `buildEcomMainPrompt` 中拼接到生成结果。
  - 在 `buildEcomBackPrompt` 与 `buildEcomDetailPrompt` 末尾追加“质量检查（Checklist）”。

## 生成流程与步骤（对齐参考实现）
1. 角色与输入：在主图/背面/细节场景中明确角色定位与输入说明，约束模型理解范围。
2. 布局与风格：根据 `layout` 选择平铺/挂拍文案；结合 `fill` 选择立体/平铺模式；自动生成 `styleHints`。
3. 造型与背景：保留并增强造型规则与自动背景匹配段落，确保道具与主题一致。
4. 数据一致性与光影：加入严格一致性约束与光影质感要求，复用统一负面提示词。
5. 质量评估：在背面与细节场景追加明确的检查清单，提升可验证性与稳定性。

## 兼容性
- 保留原有导出结构与函数签名（未增加必填参数），现有节点调用无需变更。
- 所有新增内容均为向后兼容的字符串拼接与常量定义，不影响外部类型。

