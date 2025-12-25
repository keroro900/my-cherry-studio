# 🚀 Cherry Studio Workflow 全面进化路线图

> **目标**: 将 Cherry Studio 的工作流编辑器打造成**国内最好用的 AI 工作流编辑器**
> **策略**: Cherry Studio 原生设计 + React Flow 最佳实践 + ComfyUI/n8n 优秀特性

---

## 📋 总体架构

### 核心原则
1. **完全同步 Cherry Studio 设置** - 主题、颜色、字体等全部跟随 Cherry 设置
2. **遵循 React Flow 最佳实践** - 性能优化、TypeScript 类型安全
3. **借鉴优秀项目** - ComfyUI 的节点体验、n8n 的批量操作、Flowise 的智能连线
4. **简约而不简单** - Cherry 风格的极简设计，功能强大但不复杂

### 技术栈
- **UI 框架**: React + styled-components (Cherry 风格)
- **工作流引擎**: React Flow 11.x (最新版本)
- **状态管理**: Redux Toolkit (与 Cherry 统一)
- **UI 组件**: Ant Design 5.x (Cherry 使用的组件库)
- **自动布局**: ELK.js / Dagre (可选)

---

## ✅ 已完成 (Phase 1-3)

### Phase 1: MCP Server 优化
- ✅ 优化 MCP Server 启动性能
- ✅ 修复 prompt() 错误，使用 Ant Design Modal

### Phase 2: ComfyUI 高级节点
- ✅ 实现 List 节点 (image_list, text_list)
- ✅ 实现 Pipe 节点 (数据路由)
- ✅ 实现 Switch 节点 (条件分支)
- ✅ 实现 Loop 节点 (循环迭代)
- ✅ 实现高级节点执行引擎 (500+ 行核心逻辑)

### Phase 3: Turbo Flow 视觉升级 (已废弃)
- ~~❌ Conic-gradient 旋转边框~~ (太花哨，已移除)
- ~~❌ 渐变发光效果~~ (不符合 Cherry 风格，已移除)

---

## 🔥 Phase 4: Cherry + React Flow 深度集成 (进行中)

### 4.1 ✅ 研究 Cherry + React Flow 最佳实践
**完成内容:**
- ✅ 研究 Cherry Studio 设计系统 ([color.css](src/renderer/src/assets/styles/color.css))
- ✅ 学习 React Flow 核心概念 (Nodes, Edges, Handles, Viewport)
- ✅ 了解 Cherry 的 styled-components 模式
- ✅ 掌握 Cherry 的 CSS 变量系统

**文件参考:**
- `src/renderer/src/assets/styles/color.css` - Cherry 颜色系统
- `src/renderer/src/components/ListItem/index.tsx` - Cherry 组件模式
- `src/renderer/src/store/settings.ts` - Cherry 设置系统

---

### 4.2 ✅ 创建 CherryWorkflowNode 组件
**完成内容:**
- ✅ 使用 styled-components 重写节点组件
- ✅ 完全使用 Cherry CSS 变量 (`--color-primary`, `--color-background` 等)
- ✅ 简约设计，无花哨动画
- ✅ 支持所有 30+ 节点类型图标

**文件位置:**
- `src/renderer/src/pages/workflow/components/Nodes/CherryWorkflowNode.tsx`

**设计特点:**
- 10px 圆角 (`var(--list-item-border-radius)`)
- 2px 边框 (`var(--color-border)`)
- 简单 transition，无复杂动画
- 状态驱动的视觉反馈 (running/success/error)

---

### 4.3 🔄 完善主题同步 (进行中)
**目标**: 工作流编辑器完全跟随 Cherry Studio 设置

#### 已实现
✅ **WorkflowThemeProvider 增强**
- 同步 `settings.theme` (light/dark/system)
- 同步 `settings.userTheme.colorPrimary` (用户自定义主色)
- 支持 Keroro 军曹预设主题
- 实时响应 Cherry 设置变化

**文件位置:**
- `src/renderer/src/pages/workflow/components/WorkflowThemeProvider.tsx`

#### 待实现
⏳ **其他设置同步**
- [ ] 同步 `settings.fontSize` (全局字体大小)
- [ ] 同步 `settings.userTheme.userFontFamily` (全局字体)
- [ ] 同步 `settings.windowStyle` (透明/不透明)
- [ ] 响应 `settings.customCss` (用户自定义 CSS)

**实现方式:**
```typescript
// 在 WorkflowThemeProvider 中订阅更多设置
const fontSize = useAppSelector((state) => state.settings.fontSize)
const userFontFamily = useAppSelector((state) => state.settings.userTheme.userFontFamily)

useEffect(() => {
  // 动态注入字体和大小
  themeCSS += `
.react-flow {
  font-size: ${fontSize}px;
  font-family: ${userFontFamily || 'inherit'};
}
`
}, [fontSize, userFontFamily])
```

---

### 4.4 ⏳ 优化节点配置面板
**目标**: 使用 Ant Design 表单组件，与 Cherry 风格一致

#### 需要改进的配置
1. **Vision Prompt 配置**
   - 当前: 自定义 UI
   - 改进: 使用 Ant Design Select, Radio, Switch

2. **Gemini 节点配置**
   - 当前: 基础表单
   - 改进: 使用 Ant Design Form.Item 布局

3. **通用表单组件**
   - 创建 `WorkflowFormGroup` 组件 (styled-components)
   - 使用 Cherry 的 `SettingRow` / `SettingRowTitle` 样式
   - 保持与 Cherry 设置面板一致的视觉

**参考文件:**
- `src/renderer/src/pages/settings/DisplaySettings/DisplaySettings.tsx`
- `src/renderer/src/pages/settings/index.tsx` (SettingRow, SettingGroup)

**实现示例:**
```typescript
import { SettingRow, SettingRowTitle } from '@renderer/pages/settings'

<SettingRow>
  <SettingRowTitle>风格模式</SettingRowTitle>
  <Segmented
    options={[
      { label: '📸 商拍感', value: 'commercial' },
      { label: '📱 日常感', value: 'casual' }
    ]}
    value={config.styleMode}
    onChange={(value) => updateConfig({ styleMode: value })}
  />
</SettingRow>
```

---

### 4.5 ⏳ 重构图片输入
**目标**: 图片输入体验媲美 Cherry 的图片消息

#### 当前问题
- 简陋的文件选择界面
- 无图片预览
- 不支持拖拽上传

#### 改进方案
1. **参考 Cherry 的图片选择器**
   - 文件: `src/renderer/src/components/Avatar/EditableAvatar.tsx`
   - 拖拽上传支持
   - 图片预览
   - 裁剪功能 (可选)

2. **图片列表管理**
   - 缩略图网格显示
   - 支持批量上传
   - 拖拽排序

3. **集成 Cherry 的图片工具**
   - 使用 `window.api.file.selectFile()` API
   - 使用 Cherry 的图片缓存机制

**实现组件:**
```typescript
// src/renderer/src/pages/workflow/components/ImageInput/ImageSelector.tsx
import { Upload, Image } from 'antd'

const ImageSelector: FC<Props> = ({ images, onChange }) => {
  return (
    <Upload.Dragger
      listType="picture-card"
      fileList={images}
      onChange={onChange}
      beforeUpload={() => false} // 不自动上传
    >
      <div>
        <InboxOutlined style={{ fontSize: 32 }} />
        <div>点击或拖拽上传图片</div>
      </div>
    </Upload.Dragger>
  )
}
```

---

### 4.6 ⏳ 实现批量操作
**目标**: 多节点选择、复制、粘贴、分组

#### 参考项目: n8n
n8n 的批量操作非常优秀，值得借鉴:
- 框选多个节点 (React Flow 已支持)
- Ctrl+C / Ctrl+V 复制粘贴
- 多节点对齐 (左对齐、右对齐、居中对齐)
- 多节点删除
- 节点分组 (Group Node)

#### 实现清单
- [ ] 复制粘贴功能 (保存到剪贴板)
- [ ] 多节点对齐工具
- [ ] 节点分组 (Group Node)
- [ ] 快捷键支持 (Ctrl+C/V/X/A)
- [ ] 右键菜单扩展

**实现方式:**
```typescript
// 复制节点
const handleCopy = () => {
  const selectedNodes = nodes.filter(n => n.selected)
  const clipboardData = JSON.stringify(selectedNodes)
  navigator.clipboard.writeText(clipboardData)
}

// 粘贴节点
const handlePaste = async () => {
  const clipboardData = await navigator.clipboard.readText()
  const copiedNodes = JSON.parse(clipboardData)
  // 偏移位置后添加
  const newNodes = copiedNodes.map(n => ({
    ...n,
    id: uuid(),
    position: { x: n.position.x + 50, y: n.position.y + 50 }
  }))
  dispatch(addNodes(newNodes))
}
```

---

### 4.7 ⏳ 优化连线体验
**目标**: 智能连线建议、快捷连接

#### 参考项目: Flowise
Flowise 的连线体验非常好:
- 拖拽 Handle 时，兼容的 Handle 高亮显示
- 不兼容的 Handle 变灰
- 智能连线建议 (基于节点类型)

#### 已实现
✅ **实时连线预览** (WorkflowCanvas.tsx)
- 拖拽时兼容 Handle 绿色高亮 + 脉冲动画
- 不兼容 Handle 灰色淡出
- 自己连自己的 Handle 禁用

#### 待实现
- [ ] 智能连线建议 (根据节点类型推荐下一个节点)
- [ ] 快捷连接按钮 (节点上显示 + 按钮，点击自动连接)
- [ ] 连线路径优化 (避免重叠)
- [ ] 连线标签 (显示数据类型)

**实现方式:**
```typescript
// 智能连线建议
const suggestNextNodes = (sourceNode: WorkflowNode): WorkflowNodeType[] => {
  const def = NODE_REGISTRY[sourceNode.data.nodeType]

  // 根据节点输出类型推荐
  if (def.outputs.some(o => o.type === 'image')) {
    return ['compare_image', 'gemini_edit', 'kling_image2video']
  }

  if (def.outputs.some(o => o.type === 'text')) {
    return ['qwen_prompt', 'vision_prompt', 'output']
  }

  return []
}
```

---

### 4.8 ⏳ 文件管理系统
**目标**: 工作流导入导出、模板库

#### 功能清单
- [ ] 工作流导出为 JSON
- [ ] 工作流导入 (拖拽 JSON 文件)
- [ ] 工作流模板库 (内置 10+ 模板)
- [ ] 工作流分享 (导出为 .cherry-workflow 文件)
- [ ] 工作流版本管理 (自动保存历史)

#### 文件格式
```json
{
  "version": "1.0",
  "name": "图片生成工作流",
  "description": "使用 Gemini 生成图片",
  "nodes": [...],
  "edges": [...],
  "createdAt": 1234567890,
  "updatedAt": 1234567890,
  "tags": ["图片", "Gemini"]
}
```

#### 模板库
内置模板示例:
1. **图片生成工作流** - Gemini Generate + Kling Image2Video
2. **图片编辑工作流** - Gemini Edit + Compare Image
3. **文本生成工作流** - Qwen Prompt + Output
4. **批量处理工作流** - Image List + Gemini Model From Clothes
5. **条件分支工作流** - Switch Node + Multiple Outputs

**实现位置:**
- `src/renderer/src/pages/workflow/templates/` (模板目录)
- `src/renderer/src/pages/workflow/components/TemplateLibrary.tsx` (模板库 UI)

---

### 4.9 ⏳ 性能优化
**目标**: 支持 500+ 节点的大型工作流

#### React Flow 性能优化
参考官方文档: [Performance](https://reactflow.dev/learn/advanced-use/performance)

1. **节点虚拟化**
   - 使用 `onlyRenderVisibleElements` prop
   - 超出视口的节点不渲染

2. **节点 Memo 化**
   - 所有节点组件使用 `React.memo()`
   - 避免不必要的重新渲染

3. **边缘优化**
   - 使用 `EdgeLabelRenderer` 替代 SVG text
   - 减少边缘样式复杂度

4. **状态优化**
   - 使用 `useNodesState` / `useEdgesState`
   - 避免频繁的 Redux dispatch

**实现示例:**
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onlyRenderVisibleElements={true} // 启用虚拟化
  // ...
>
```

---

### 4.10 ⏳ 高级布局
**目标**: 自动布局，一键整理工作流

#### 布局算法选择
1. **Dagre** - 层次化布局 (适合有向无环图)
   - 文档: https://github.com/dagrejs/dagre
   - React Flow 示例: https://reactflow.dev/examples/layout/dagre

2. **ELK.js** - 高级布局引擎 (支持多种算法)
   - 文档: https://eclipse.dev/elk/
   - React Flow 示例: https://reactflow.dev/examples/layout/elkjs

#### 实现清单
- [ ] 安装 `elkjs` 或 `dagre`
- [ ] 实现 `autoLayout()` 函数
- [ ] 工具栏添加"自动布局"按钮
- [ ] 支持水平/垂直布局切换
- [ ] 保存布局偏好设置

**实现示例 (ELK.js):**
```typescript
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

const autoLayout = async (nodes: Node[], edges: Edge[]) => {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT'
    },
    children: nodes.map(n => ({
      id: n.id,
      width: 280,
      height: 150
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target]
    }))
  }

  const layout = await elk.layout(graph)

  // 更新节点位置
  return nodes.map(n => {
    const layoutNode = layout.children?.find(ln => ln.id === n.id)
    return {
      ...n,
      position: {
        x: layoutNode?.x || n.position.x,
        y: layoutNode?.y || n.position.y
      }
    }
  })
}
```

---

### 4.11 ⏳ 研究优秀项目
**目标**: 学习 ComfyUI、n8n、Flowise 的优秀特性

#### ComfyUI
**GitHub**: https://github.com/comfyanonymous/ComfyUI
**优点**:
- 节点连接体验非常好
- 节点配置面板设计精良
- 支持复杂的图像处理流程

**借鉴特性**:
- [ ] 节点预览功能 (显示输出结果)
- [ ] 节点搜索面板 (快速添加节点)
- [ ] 节点右键菜单 (复制、删除、转换)

#### n8n
**GitHub**: https://github.com/n8n-io/n8n
**优点**:
- 批量操作非常强大
- 节点分组管理
- 工作流版本控制

**借鉴特性**:
- [ ] 节点分组 (Group Node)
- [ ] 多节点对齐工具
- [ ] 工作流模板市场

#### Flowise
**GitHub**: https://github.com/FlowiseAI/Flowise
**优点**:
- 智能连线建议
- UI 设计简洁
- 节点类型分类清晰

**借鉴特性**:
- [ ] 智能连线建议
- [ ] 节点类型分类 (输入/AI/输出/工具)
- [ ] 实时预览功能

---

## 🎯 Phase 5: 高级功能 (未来规划)

### 5.1 节点市场
- 用户自定义节点
- 节点插件系统
- 社区节点分享

### 5.2 协作功能
- 多人同时编辑工作流
- 工作流评论和标注
- 工作流分享链接

### 5.3 调试工具
- 节点断点调试
- 数据流追踪
- 性能分析工具

### 5.4 AI 辅助
- AI 生成工作流
- 自然语言转工作流
- 工作流优化建议

---

## 📊 开发进度追踪

### 完成度统计
- **Phase 1**: ✅ 100% (MCP Server 优化)
- **Phase 2**: ✅ 100% (ComfyUI 高级节点)
- **Phase 3**: ❌ 已废弃 (Turbo Flow)
- **Phase 4**: 🔄 30% (Cherry + React Flow 深度集成)
  - 4.1: ✅ 100%
  - 4.2: ✅ 100%
  - 4.3: 🔄 70%
  - 4.4: ⏳ 0%
  - 4.5: ⏳ 0%
  - 4.6: ⏳ 0%
  - 4.7: 🔄 40%
  - 4.8: ⏳ 0%
  - 4.9: ⏳ 0%
  - 4.10: ⏳ 0%
  - 4.11: ⏳ 0%
- **Phase 5**: ⏳ 0% (高级功能规划)

### 下一步工作
1. **优先级 P0** (必须完成)
   - [x] 4.3 完善主题同步
   - [ ] 4.4 优化节点配置面板
   - [ ] 4.7 优化连线体验

2. **优先级 P1** (重要)
   - [ ] 4.5 重构图片输入
   - [ ] 4.6 实现批量操作
   - [ ] 4.8 文件管理系统

3. **优先级 P2** (可选)
   - [ ] 4.9 性能优化
   - [ ] 4.10 高级布局
   - [ ] 4.11 研究优秀项目

---

## 🔗 相关资源

### 官方文档
- [React Flow 文档](https://reactflow.dev/)
- [Ant Design 文档](https://ant.design/)
- [Redux Toolkit 文档](https://redux-toolkit.js.org/)

### 参考项目
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [n8n](https://github.com/n8n-io/n8n)
- [Flowise](https://github.com/FlowiseAI/Flowise)

### 关键文件
- **设计系统**: `src/renderer/src/assets/styles/color.css`
- **设置管理**: `src/renderer/src/store/settings.ts`
- **工作流状态**: `src/renderer/src/pages/workflow/store/workflowSlice.ts`
- **节点定义**: `src/renderer/src/pages/workflow/types/node-definitions.ts`
- **主题系统**: `src/renderer/src/pages/workflow/styles/themes.ts`

---

## 💡 贡献指南

### 代码风格
1. **使用 styled-components** (Cherry 标准)
2. **使用 Cherry CSS 变量** (`var(--color-primary)`)
3. **遵循 React Flow 最佳实践** (TypeScript, Hooks)
4. **保持简约设计** (不要过度动画)

### 提交规范
```
feat(workflow): 实现节点批量操作
fix(workflow): 修复连线预览问题
refactor(workflow): 重构节点配置面板
docs(workflow): 更新工作流文档
```

### 测试要求
- 每个新功能必须有手动测试步骤
- 关键功能需要单元测试
- 性能优化需要基准测试

---

## 📝 更新日志

### 2025-01-15
- ✅ 完成 Phase 4.1: 研究 Cherry + React Flow 最佳实践
- ✅ 完成 Phase 4.2: 创建 CherryWorkflowNode 组件
- 🔄 进行 Phase 4.3: 完善主题同步 (WorkflowThemeProvider 增强)
- 📄 创建本路线图文档

### 2025-01-10
- ✅ 完成 Phase 2: ComfyUI 高级节点
- ❌ 废弃 Phase 3: Turbo Flow (用户反馈太花哨)

### 2025-01-05
- ✅ 完成 Phase 1: MCP Server 优化

---

**维护者**: Claude + 用户
**最后更新**: 2025-01-15
**版本**: v1.0
