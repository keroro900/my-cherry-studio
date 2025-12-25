# 相关组件可能受影响清单

## 直接相关
- `src/renderer/src/pages/workflow/presets/nodePrompts.ts`
  - 常量：`ECOM_FILL_TEXT`、`ECOM_NEGATIVE_PROMPT`、`ECOM_LIGHTING_TEXT`
  - 函数：`buildEcomMainPrompt`、`buildEcomBackPrompt`、`buildEcomDetailPrompt`、`buildStyleHints`

## 可能间接引用的模块
- `src/renderer/src/pages/workflow/components/ConfigForms/*`
- `src/renderer/src/pages/workflow/engine/*`
- `src/renderer/src/pages/workflow/nodes/*`
- `src/renderer/src/pages/workflow/constants/*`
- `src/renderer/src/pages/workflow/services/*`

## 测试相关
- 渲染层测试套件：`yarn test:renderer`（已通过）

## 打包与分发
- 文档文件位于 `cherry-studio/docs/`（打包配置默认排除文档，不影响构建产物）。

