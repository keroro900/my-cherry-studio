/**
 * SVG Gradient Definitions for Turbo Flow Edges
 *
 * 提供边缘渐变效果的 SVG 定义
 *
 * 颜色与 --workflow-theme-* CSS 变量保持一致：
 * - blue: --workflow-theme-primary (#1890ff)
 * - purple: --workflow-theme-secondary (#722ed1)
 * - green: --workflow-theme-success (#52c41a)
 * - orange: --workflow-theme-warning (#fa8c16)
 * - red: --workflow-theme-error (#ff4d4f)
 * - cyan: --workflow-theme-info (#13c2c2)
 * - pink: --ant-color-magenta (#eb2f96)
 *
 * 注意：SVG 中需要使用具体颜色值，因为 CSS 变量在 SVG 属性中不能直接使用
 */

export function EdgeGradientDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* 蓝色渐变 - 默认边 (--workflow-theme-primary) */}
        <linearGradient id="edge-gradient-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1890ff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#40a9ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#1890ff" stopOpacity="0.8" />
        </linearGradient>

        {/* 紫色渐变 - Hover 边 (--workflow-theme-secondary) */}
        <linearGradient id="edge-gradient-purple" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#722ed1" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#9254de" stopOpacity="1" />
          <stop offset="100%" stopColor="#722ed1" stopOpacity="0.8" />
        </linearGradient>

        {/* 绿色渐变 - 选中边 (--workflow-theme-success) */}
        <linearGradient id="edge-gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#52c41a" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#73d13d" stopOpacity="1" />
          <stop offset="100%" stopColor="#52c41a" stopOpacity="0.8" />
        </linearGradient>

        {/* 橙色渐变 - 拖动连接时 (--workflow-theme-warning) */}
        <linearGradient id="edge-gradient-orange" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fa8c16" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ffa940" stopOpacity="1" />
          <stop offset="100%" stopColor="#fa8c16" stopOpacity="0.8" />
        </linearGradient>

        {/* 红色渐变 - 错误状态 (--workflow-theme-error) */}
        <linearGradient id="edge-gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff4d4f" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ff7875" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff4d4f" stopOpacity="0.8" />
        </linearGradient>

        {/* 青色渐变 - 流程控制节点 (--workflow-theme-info) */}
        <linearGradient id="edge-gradient-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#13c2c2" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#36cfc9" stopOpacity="1" />
          <stop offset="100%" stopColor="#13c2c2" stopOpacity="0.8" />
        </linearGradient>

        {/* 粉色渐变 - 图片处理节点 (--ant-color-magenta) */}
        <linearGradient id="edge-gradient-pink" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#eb2f96" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#f759ab" stopOpacity="1" />
          <stop offset="100%" stopColor="#eb2f96" stopOpacity="0.8" />
        </linearGradient>

        {/* 箭头标记 - 蓝色 (--workflow-theme-primary) */}
        <marker
          id="arrowhead-blue"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#1890ff" />
        </marker>

        {/* 箭头标记 - 紫色 (--workflow-theme-secondary) */}
        <marker
          id="arrowhead-purple"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#722ed1" />
        </marker>

        {/* 箭头标记 - 绿色 (--workflow-theme-success) */}
        <marker
          id="arrowhead-green"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#52c41a" />
        </marker>
      </defs>
    </svg>
  )
}
