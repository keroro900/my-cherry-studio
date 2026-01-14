/**
 * 动态 Handle 渲染组件 v5.0
 * 根据节点的 inputs/outputs 配置自动渲染对应的 Handle
 * 支持 Any-to-Any 连接验证
 *
 * v5.0 重构：
 * - 圆形端口设计 - 更现代简洁
 * - 输入端口：空心圆，输出端口：实心圆
 * - 优雅的悬停动画和发光效果
 * - 参考 YouArt / chaiNNer 的端口设计
 */

import { Handle, Position } from '@xyflow/react'
import { memo, useMemo } from 'react'
import styled, { css, keyframes } from 'styled-components'

import type { NodeHandle } from '../../types'

interface DynamicHandlesProps {
  inputs: NodeHandle[]
  outputs: NodeHandle[]
  showLabels?: boolean
}

// 数据类型颜色映射 - 与 ReactFlowStyles.css 保持一致
const DATA_TYPE_COLORS: Record<string, string> = {
  text: '#58a6ff', // 蓝色 - 与 pro-dark 主题一致
  image: '#a371f7', // 紫色
  images: '#f778ba', // 粉色
  video: '#f85149', // 红色
  json: '#3fb950', // 绿色
  any: '#8b949e', // 灰色
  prompt: '#a371f7', // 紫色
  boolean: '#d29922', // 橙黄色
  number: '#79c0ff' // 天蓝色
}

// 数据类型图标映射
const DATA_TYPE_ICONS: Record<string, string> = {
  text: 'T',
  image: '◈',
  images: '◇',
  video: '▷',
  json: '{ }',
  any: '◆',
  prompt: '✦',
  boolean: '○',
  number: '#'
}

/**
 * 计算 Handle 的垂直位置
 * 多个 Handle 时均匀分布
 */
function calculateHandleTop(index: number, total: number): string {
  if (total === 1) {
    return '50%'
  }
  // 垂直均匀分布，留出上下边距
  const spacing = 100 / (total + 1)
  return `${spacing * (index + 1)}%`
}

// ==================== 动画定义 ====================

const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 var(--handle-glow-color);
  }
  50% {
    box-shadow: 0 0 8px 2px var(--handle-glow-color);
  }
`

const tooltipFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-50%) scale(0.9) translateX(var(--tooltip-offset, 0));
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scale(1) translateX(0);
  }
`

// ==================== 样式组件 ====================

// Handle 容器 - 内嵌到节点边缘
const HandleWrapper = styled.div<{ $side: 'left' | 'right'; $top: string }>`
  position: absolute;
  ${(props) => (props.$side === 'left' ? 'left: 0' : 'right: 0')};
  top: ${(props) => props.$top};
  transform: translate(${(props) => (props.$side === 'left' ? '-50%' : '50%')}, -50%);
  z-index: 10;
  /* 性能优化 */
  will-change: transform;
`

// 共享的 Handle 样式 - 圆形设计
const handleBaseStyles = css<{ $color: string }>`
  --handle-color: ${(props) => props.$color};
  --handle-glow-color: ${(props) => props.$color}60;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  /* 圆形端口样式 - 现代简洁 */
  .react-flow__handle {
    position: relative;
    width: 10px;
    height: 10px;
    min-width: 10px;
    min-height: 10px;
    border: 2px solid var(--handle-color);
    border-radius: 50%;
    background: var(--color-background, #161b22);
    transform: none;
    cursor: crosshair;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 0 2px var(--color-background, #161b22);

    &:hover {
      width: 14px;
      height: 14px;
      background: var(--handle-color);
      border-color: var(--handle-color);
      box-shadow:
        0 0 12px var(--handle-glow-color),
        0 0 20px var(--handle-glow-color),
        0 0 0 2px var(--color-background, #161b22);
      animation: ${pulseGlow} 1.5s ease-in-out infinite;
    }

    &:active {
      transform: scale(0.85);
    }

    /* 连接中状态 */
    &.connecting,
    &.connectingfrom,
    &.connectingto {
      width: 14px;
      height: 14px;
      box-shadow:
        0 0 12px var(--handle-glow-color),
        0 0 20px var(--handle-glow-color);
    }
  }
`

// 输入端口容器
const InputHandleInner = styled.div<{ $color: string }>`
  ${handleBaseStyles}

  /* 输入端口特殊样式 - 空心圆 */
  .react-flow__handle {
    background: var(--color-background, #161b22);

    &:hover {
      background: var(--handle-color);
    }
  }
`

// 输出端口容器
const OutputHandleInner = styled.div<{ $color: string }>`
  ${handleBaseStyles}

  /* 输出端口特殊样式 - 实心圆 */
  .react-flow__handle {
    background: var(--handle-color);
    box-shadow:
      0 0 4px var(--handle-glow-color),
      0 0 0 2px var(--color-background, #161b22);

    &:hover {
      transform: scale(1.2);
      box-shadow:
        0 0 12px var(--handle-glow-color),
        0 0 20px var(--handle-glow-color),
        0 0 0 2px var(--color-background, #161b22);
    }
  }
`

// 精致的悬停 Tooltip
const HandleTooltip = styled.div<{ $side: 'left' | 'right'; $color: string }>`
  --tooltip-offset: ${(props) => (props.$side === 'left' ? '-8px' : '8px')};

  position: absolute;
  ${(props) => (props.$side === 'left' ? 'left: 16px' : 'right: 16px')};
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  pointer-events: none;
  padding: 4px 8px;
  background: var(--color-background-soft, rgba(30, 30, 46, 0.95));
  border-radius: 6px;
  border: 1px solid ${(props) => props.$color}40;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;

  /* 小三角指示器 */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    ${(props) => (props.$side === 'left' ? 'left: -4px' : 'right: -4px')};
    transform: translateY(-50%) rotate(45deg);
    width: 6px;
    height: 6px;
    background: var(--color-background-soft, rgba(30, 30, 46, 0.95));
    border-${(props) => (props.$side === 'left' ? 'left' : 'right')}: 1px solid ${(props) => props.$color}40;
    border-${(props) => (props.$side === 'left' ? 'bottom' : 'top')}: 1px solid ${(props) => props.$color}40;
  }

  ${HandleWrapper}:hover & {
    opacity: 1;
    visibility: visible;
    animation: ${tooltipFadeIn} 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
`

// Tooltip 内容
const TooltipContent = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

// 数据类型指示点 - 圆形
const TypeDot = styled.span<{ $color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  flex-shrink: 0;
`

// 标签文本
const LabelText = styled.span`
  font-weight: 500;
  color: var(--color-text-2, #a0a0a0);
`

// 必填标记
const RequiredMark = styled.span`
  color: #f87171;
  font-size: 10px;
  font-weight: bold;
  margin-left: -2px;
`

// 类型标签
const TypeBadge = styled.span<{ $color: string }>`
  font-size: 8px;
  color: ${(props) => props.$color};
  background: ${(props) => props.$color}15;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`

// ==================== Handle 组件 ====================

/**
 * 输入 Handle 组件 - 空心圆设计
 */
const InputHandle = memo(
  ({ handle, index, total, showLabels }: { handle: NodeHandle; index: number; total: number; showLabels: boolean }) => {
    const color = DATA_TYPE_COLORS[handle.dataType] || DATA_TYPE_COLORS.any
    const top = calculateHandleTop(index, total)

    return (
      <HandleWrapper $side="left" $top={top}>
        <InputHandleInner $color={color}>
          <Handle type="target" position={Position.Left} id={handle.id} />
          {showLabels && (
            <HandleTooltip $side="left" $color={color}>
              <TooltipContent>
                <TypeDot $color={color} />
                <LabelText>{handle.label}</LabelText>
                {handle.required && <RequiredMark>*</RequiredMark>}
                <TypeBadge $color={color}>{handle.dataType}</TypeBadge>
              </TooltipContent>
            </HandleTooltip>
          )}
        </InputHandleInner>
      </HandleWrapper>
    )
  }
)

InputHandle.displayName = 'InputHandle'

/**
 * 输出 Handle 组件 - 实心圆设计
 */
const OutputHandle = memo(
  ({ handle, index, total, showLabels }: { handle: NodeHandle; index: number; total: number; showLabels: boolean }) => {
    const color = DATA_TYPE_COLORS[handle.dataType] || DATA_TYPE_COLORS.any
    const top = calculateHandleTop(index, total)

    return (
      <HandleWrapper $side="right" $top={top}>
        <OutputHandleInner $color={color}>
          <Handle type="source" position={Position.Right} id={handle.id} />
          {showLabels && (
            <HandleTooltip $side="right" $color={color}>
              <TooltipContent>
                <TypeDot $color={color} />
                <LabelText>{handle.label}</LabelText>
                <TypeBadge $color={color}>{handle.dataType}</TypeBadge>
              </TooltipContent>
            </HandleTooltip>
          )}
        </OutputHandleInner>
      </HandleWrapper>
    )
  }
)

OutputHandle.displayName = 'OutputHandle'

// ==================== 主组件 ====================

/**
 * 动态 Handle 渲染组件
 */
function DynamicHandles({ inputs, outputs, showLabels: _showLabels = false }: DynamicHandlesProps) {
  // 过滤有效的 inputs 和 outputs
  const validInputs = useMemo(() => inputs.filter(Boolean), [inputs])
  const validOutputs = useMemo(() => outputs.filter(Boolean), [outputs])
  const showLabels = Boolean(_showLabels)

  return (
    <>
      {/* 渲染输入 Handles */}
      {validInputs.map((handle, index) => (
        <InputHandle key={handle.id} handle={handle} index={index} total={validInputs.length} showLabels={showLabels} />
      ))}

      {/* 渲染输出 Handles */}
      {validOutputs.map((handle, index) => (
        <OutputHandle
          key={handle.id}
          handle={handle}
          index={index}
          total={validOutputs.length}
          showLabels={showLabels}
        />
      ))}
    </>
  )
}

export default memo(DynamicHandles)

// 导出颜色映射供其他组件使用
export { DATA_TYPE_COLORS, DATA_TYPE_ICONS }
