/**
 * AgentThinkingBubble - Agent 思考气泡组件
 *
 * VCPChat 风格的思考状态指示器
 * 显示 Agent 正在思考/准备响应的动画
 * Features:
 * - Subtle background with accent color
 * - Primary color accent glow animation
 * - Animated typing indicator dots
 * - Theme-aware styling
 */

import { Avatar } from 'antd'
import { BrainCircuit } from 'lucide-react'
import { memo, useMemo } from 'react'
import styled, { keyframes } from 'styled-components'

interface Props {
  /** Agent ID */
  agentId: string
  /** Agent 显示名称 */
  agentName: string
  /** Agent 头像 */
  avatar?: string
  /** 自定义思考文本 */
  thinkingText?: string
}

/**
 * Agent 思考气泡组件
 */
const AgentThinkingBubble: React.FC<Props> = ({ agentId, agentName, avatar, thinkingText }) => {
  // 获取头像显示
  const avatarDisplay = useMemo(() => {
    return avatar || agentName?.charAt(0) || '🤖'
  }, [avatar, agentName])

  const displayText = thinkingText || `${agentName} 正在思考`

  return (
    <BubbleContainer id={`thinking-${agentId}`}>
      <AvatarWrapper>
        <Avatar size={36} style={{ backgroundColor: 'var(--color-primary)', flexShrink: 0 }}>
          {avatarDisplay}
        </Avatar>
        <StatusRing />
      </AvatarWrapper>
      <ThinkingContent>
        <AgentLabel>
          <BrainIcon size={14} />
          <span>{agentName}</span>
        </AgentLabel>
        <ThinkingRow>
          <ThinkingText>{displayText}</ThinkingText>
          <DotsContainer className="flowlock-thinking-dots">
            <Dot $delay={0} />
            <Dot $delay={0.2} />
            <Dot $delay={0.4} />
          </DotsContainer>
        </ThinkingRow>
      </ThinkingContent>
    </BubbleContainer>
  )
}

// 动画
const bounce = keyframes`
  0%, 80%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-6px) scale(1.1);
    opacity: 1;
  }
`

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 4px var(--color-primary);
    opacity: 0.8;
  }
  50% {
    box-shadow: 0 0 12px var(--color-primary), 0 0 20px rgba(var(--color-primary-rgb, 24, 144, 255), 0.3);
    opacity: 1;
  }
`

const ringRotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

// Styled Components
const BubbleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  margin: 10px 0;
  background: var(--color-background-soft);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  animation: ${fadeIn} 0.3s ease-out, ${glowPulse} 3s ease-in-out infinite;
  max-width: 360px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 16px rgba(var(--color-primary-rgb, 24, 144, 255), 0.15);
  }
`

const AvatarWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`

const StatusRing = styled.div`
  position: absolute;
  top: -4px;
  left: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--color-primary);
  border-right-color: var(--color-primary);
  animation: ${ringRotate} 1.5s linear infinite;
`

const ThinkingContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
`

const AgentLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  letter-spacing: 0.3px;
`

const BrainIcon = styled(BrainCircuit)`
  color: var(--color-primary);
  animation: ${glowPulse} 2s ease-in-out infinite;
`

const ThinkingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const ThinkingText = styled.span`
  font-size: 13px;
  color: var(--color-text-2);
  font-style: italic;
`

const DotsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const Dot = styled.span<{ $delay: number }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: ${bounce} 1.4s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
  box-shadow: 0 0 4px var(--color-primary);
`

export default memo(AgentThinkingBubble)
