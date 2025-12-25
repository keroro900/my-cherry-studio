# 差异化预设与随机回退规则

## 差异化预设策略
- UnifiedPromptNode：全面复用共享预设（年龄、人种、姿态、场景、风格），提供丰富“随机选择”
- EcomConfigForm：复用布局与填充模式共享预设，保留“自由发挥”，平台风格与参数按节点自定义
- PatternConfigForm：复用图案类型共享预设，保留节点专属 `derived`

## 随机回退规则
- 模型提示词（用户提示词）层统一做字符串回退：
  - Pattern：`patternType=random` → `seamless`
  - Ecom：`layoutMode=random` → `flat_lay`；`fillMode=random` → `filled`；`platformStyle=random` → `shein`
- 样式层：共享常量支持 `random` 选项，辅助函数 `get*Preset` 随机挑选具体预设

## 版本标识
- `PRESETS_VERSION = v2`：表单渲染时写入 `presetsVersion` 到配置，便于追踪节点更新状态

## 可访问性
- 模态框使用清晰 `title` 标注，支持 ESC 与遮罩关闭
- 打开按钮添加 `aria-label`，便于辅助技术识别
