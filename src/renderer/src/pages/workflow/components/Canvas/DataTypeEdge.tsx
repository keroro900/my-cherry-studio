/**
 * 数据类型边组件 v2.0 - 根据数据类型显示不同颜色
 *
 * 新特性：
 * - 更平滑的贝塞尔曲线
 * - 数据流动粒子动画
 * - 选中时高亮 + 数据类型标签
 * - 悬停时显示删除按钮
 * - 主题适配
 *
 * 数据类型与颜色映射（使用 Ant Design 语义色）：
 * - text: 蓝色 (primary)
 * - image: 绿色 (success)
 * - images: 青色 (info/cyan)
 * - video: 粉色 (magenta)
 * - json: 紫色 (secondary/purple)
 * - any: 橙色 (warning)
 */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath, useStore } from '@xyflow/react'
import { memo, useState } from 'react'
import styled from 'styled-components'

import type { WorkflowDataType } from '../../types'

// 数据类型到颜色的映射
const DATA_TYPE_COLORS: Record<WorkflowDataType, string> = {
  text: '#1890ff', // --workflow-theme-primary - 文本数据
  image: '#52c41a', // --workflow-theme-success - 单张图片
  images: '#13c2c2', // --workflow-theme-info - 多张图片
  video: '#eb2f96', // --ant-color-magenta - 视频
  json: '#722ed1', // --workflow-theme-secondary - JSON数据
  any: '#fa8c16', // --workflow-theme-warning - 任意类型
  boolean: '#faad14', // 布尔类型 - 黄色
  number: '#2f54eb' // 数字类型 - 深蓝色
}

// 数据类型到渐变ID的映射
const DATA_TYPE_GRADIENTS: Record<WorkflowDataType, string> = {
  text: 'url(#edge-gradient-blue)',
  image: 'url(#edge-gradient-green)',
  images: 'url(#edge-gradient-cyan)',
  video: 'url(#edge-gradient-pink)',
  json: 'url(#edge-gradient-purple)',
  any: 'url(#edge-gradient-orange)',
  boolean: 'url(#edge-gradient-orange)',
  number: 'url(#edge-gradient-blue)'
}

// 数据类型图标
const DATA_TYPE_ICONS: Record<WorkflowDataType, string> = {
  text: 'T',
  image: '🖼',
  images: '📷',
  video: '▶',
  json: '{}',
  any: '◆',
  boolean: '⊙',
  number: '#'
}

/**
 * 根据 sourceHandle 获取数据类型
 */
function getDataTypeFromHandle(sourceNode: any, sourceHandleId: string | null | undefined): WorkflowDataType {
  if (!sourceNode?.data?.outputs || !sourceHandleId) {
    return 'any'
  }

  const handle = sourceNode.data.outputs.find((h: any) => h.id === sourceHandleId)
  return (handle?.dataType as WorkflowDataType) || 'any'
}

interface DataTypeEdgeProps extends EdgeProps {
  data?: {
    dataType?: WorkflowDataType
  }
}

// 样式组件
const EdgeLabel = styled.div<{ $color: string }>`
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-background);
  border: 1px solid ${(props) => props.$color}60;
  color: ${(props) => props.$color};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: all;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
`

function DataTypeEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  selected,
  animated = true,
  style = {},
  markerEnd
}: DataTypeEdgeProps) {
  const [isHovered, setIsHovered] = useState(false)

  // 从 store 获取源节点
  const sourceNode = useStore((state) => state.nodeLookup.get(source))

  // 获取数据类型
  const dataType = getDataTypeFromHandle(sourceNode, sourceHandleId)

  // 获取颜色和图标
  const color = DATA_TYPE_COLORS[dataType] || DATA_TYPE_COLORS.any
  const gradient = DATA_TYPE_GRADIENTS[dataType] || DATA_TYPE_GRADIENTS.any
  const icon = DATA_TYPE_ICONS[dataType] || DATA_TYPE_ICONS.any

  // 计算贝塞尔曲线路径（增加曲率使连线更平滑）
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25 // 稍微增加曲率
  })

  return (
    <>
      {/* 悬停检测区域（更宽的透明路径） */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      {/* 外发光效果 - 选中或悬停时显示 */}
      {(selected || isHovered) && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={selected ? 10 : 8}
          strokeOpacity={selected ? 0.35 : 0.25}
          style={{
            filter: 'blur(4px)',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 主边 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: gradient,
          strokeWidth: selected ? 4 : isHovered ? 3.5 : 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke-width 0.2s ease'
        }}
        markerEnd={markerEnd}
      />

      {/* 动画流动点 - 多个粒子 */}
      {animated && (
        <>
          <circle r="3" fill={color} opacity={0.9}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2.5" fill={color} opacity={0.7}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="0.5s" />
          </circle>
          <circle r="2" fill={color} opacity={0.5}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="1s" />
          </circle>
        </>
      )}

      {/* 数据类型标签 - 选中或悬停时显示 */}
      {(selected || isHovered) && (
        <EdgeLabelRenderer>
          <EdgeLabel
            $color={color}
            style={{
              left: labelX,
              top: labelY
            }}>
            <span>{icon}</span>
            <span>{dataType}</span>
          </EdgeLabel>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(DataTypeEdge)

/**
 * 获取数据类型颜色 - 导出供其他组件使用
 */
export { DATA_TYPE_COLORS, DATA_TYPE_GRADIENTS }
