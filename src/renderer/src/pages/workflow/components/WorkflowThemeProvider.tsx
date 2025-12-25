/**
 * 工作流主题提供者 - Cherry Studio 深度集成版
 *
 * 核心功能:
 * 1. 完全跟随 Cherry Studio 全局主题 (settings.theme)
 * 2. 同步 Cherry Studio 主色调 (settings.userTheme.colorPrimary)
 * 3. 实时响应 Cherry 设置变化
 *
 * CSS 变量优先级:
 * - Cherry 全局 CSS 变量 (--ant-color-primary, --ant-color-bg-* 等)
 * - 工作流专属 CSS 变量 (--workflow-theme-primary 等) 从 Ant 变量派生
 *
 * 作用域:
 * - 主题 CSS 变量限定在 .workflow-root 作用域内
 */

import { useTheme } from '@renderer/context/ThemeProvider'
import { useAppSelector } from '@renderer/store'
import { useEffect } from 'react'

/**
 * 主题提供者组件
 * 完全跟随 Cherry Studio 全局设置，不再有独立的工作流主题选择
 */
export default function WorkflowThemeProvider({ children }: { children: React.ReactNode }) {
  // Cherry Studio 全局主题和颜色
  const { theme } = useTheme() // 'light' | 'dark' | 'system'
  const userTheme = useAppSelector((state) => state.settings.userTheme)

  useEffect(() => {
    // 生成与 Cherry Studio 主色调同步的工作流主题 CSS
    const colorPrimary = userTheme?.colorPrimary || '#1890ff'

    const themeCSS = `
/* 工作流主题 - 完全跟随 Cherry Studio 全局设置 */
.workflow-root {
  /* 主题色从 Cherry Studio 主色调派生 */
  --workflow-theme-primary: ${colorPrimary};
  --workflow-theme-secondary: #722ed1;
  --workflow-theme-success: #52c41a;
  --workflow-theme-warning: #faad14;
  --workflow-theme-error: #ff4d4f;
  --workflow-theme-info: #13c2c2;

  /* 节点样式 */
  --workflow-node-border-radius: 8px;
  --workflow-node-border-width: 2px;
  --workflow-node-padding: 12px 16px;
  --workflow-node-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  /* Handle 样式 */
  --workflow-handle-size: 12px;
  --workflow-handle-border-width: 2px;

  /* 同步 Cherry 主色调到 color-primary 变量 */
  --color-primary: ${colorPrimary};
}

/* 连线颜色同步主色调 */
.workflow-root .react-flow__edge-path {
  stroke: ${colorPrimary} !important;
}

.workflow-root .react-flow__edge .react-flow__arrowhead {
  fill: ${colorPrimary} !important;
}

/* 连接线预览 */
.workflow-root .react-flow__connection-path {
  stroke: var(--workflow-theme-warning, #faad14);
}

/* 节点选中状态使用主色调 */
.workflow-root .react-flow__node.selected {
  box-shadow: 0 0 0 2px ${colorPrimary}40;
}

/* Handle 连接时使用主色调 */
.workflow-root .react-flow__handle.connecting,
.workflow-root .react-flow__handle.connectingfrom,
.workflow-root .react-flow__handle.connectingto {
  border-color: ${colorPrimary};
  background: linear-gradient(135deg, ${colorPrimary} 0%, ${colorPrimary}cc 100%);
}
`

    // 查找或创建主题样式标签
    let styleTag = document.getElementById('workflow-theme-styles') as HTMLStyleElement
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = 'workflow-theme-styles'
      document.head.appendChild(styleTag)
    }

    // 注入主题 CSS
    styleTag.textContent = themeCSS
  }, [theme, userTheme])

  // 清理：组件卸载时移除样式标签
  useEffect(() => {
    return () => {
      const themeTag = document.getElementById('workflow-theme-styles')
      themeTag?.remove()
    }
  }, [])

  return <>{children}</>
}
