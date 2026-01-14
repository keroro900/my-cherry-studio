/**
 * VCP Floating Status Component
 *
 * A floating status indicator showing:
 * - Current time
 * - Active operation duration/elapsed time
 * - System status indicators
 * - Quick action buttons
 */

import { Tooltip } from 'antd'
import { Activity, Clock, Pause, Play, RefreshCw, Zap } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

export type VCPStatusMode = 'clock' | 'timer' | 'elapsed'

export interface VCPFloatingStatusProps {
  /** Display mode */
  mode?: VCPStatusMode
  /** Whether an operation is active (for timer/elapsed mode) */
  isActive?: boolean
  /** Start time for elapsed mode (timestamp) */
  startTime?: number
  /** Timer duration in seconds (for timer mode) */
  timerDuration?: number
  /** Current operation name */
  operationName?: string
  /** Show/hide the component */
  visible?: boolean
  /** Position on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Callback when timer completes */
  onTimerComplete?: () => void
  /** Callback for pause/resume */
  onTogglePause?: () => void
  /** Callback for reset */
  onReset?: () => void
  /** Whether operation is paused */
  isPaused?: boolean
}

const VCPFloatingStatus: FC<VCPFloatingStatusProps> = ({
  mode = 'clock',
  isActive = false,
  startTime,
  timerDuration,
  operationName,
  visible = true,
  position = 'bottom-right',
  onTimerComplete,
  onTogglePause,
  onReset,
  isPaused = false
}) => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(timerDuration || 0)

  // Update current time every second (for clock mode)
  useEffect(() => {
    if (mode !== 'clock') return

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [mode])

  // Update elapsed time (for elapsed mode)
  useEffect(() => {
    if (mode !== 'elapsed' || !isActive || !startTime || isPaused) return

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [mode, isActive, startTime, isPaused])

  // Update timer countdown (for timer mode)
  useEffect(() => {
    if (mode !== 'timer' || !isActive || isPaused) return

    if (remainingSeconds <= 0) {
      onTimerComplete?.()
      return
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          onTimerComplete?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [mode, isActive, remainingSeconds, isPaused, onTimerComplete])

  // Reset remaining seconds when timerDuration changes
  useEffect(() => {
    if (timerDuration !== undefined) {
      setRemainingSeconds(timerDuration)
    }
  }, [timerDuration])

  // Format time display
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }, [])

  // Format duration display
  const formatDuration = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Get display content based on mode
  const displayContent = useMemo(() => {
    switch (mode) {
      case 'clock':
        return {
          icon: <Clock size={14} />,
          time: formatTime(currentTime),
          label: t('vcp.status.current_time', '当前时间')
        }
      case 'elapsed':
        return {
          icon: <Activity size={14} />,
          time: formatDuration(elapsedSeconds),
          label: operationName || t('vcp.status.elapsed', '已用时')
        }
      case 'timer':
        return {
          icon: <Zap size={14} />,
          time: formatDuration(remainingSeconds),
          label: operationName || t('vcp.status.remaining', '剩余时间')
        }
      default:
        return {
          icon: <Clock size={14} />,
          time: formatTime(currentTime),
          label: ''
        }
    }
  }, [mode, currentTime, elapsedSeconds, remainingSeconds, operationName, formatTime, formatDuration, t])

  if (!visible) return null

  return (
    <StatusContainer $position={position} $isActive={isActive}>
      <StatusCard $isActive={isActive} $isPaused={isPaused}>
        <IconWrapper $isActive={isActive}>{displayContent.icon}</IconWrapper>
        <ContentWrapper>
          <TimeDisplay $isActive={isActive}>{displayContent.time}</TimeDisplay>
          {displayContent.label && <LabelText>{displayContent.label}</LabelText>}
        </ContentWrapper>
        {/* Action buttons for timer/elapsed modes */}
        {(mode === 'timer' || mode === 'elapsed') && isActive && (
          <ActionsWrapper>
            {onTogglePause && (
              <Tooltip title={isPaused ? t('common.resume', '继续') : t('common.pause', '暂停')}>
                <ActionButton onClick={onTogglePause}>{isPaused ? <Play size={12} /> : <Pause size={12} />}</ActionButton>
              </Tooltip>
            )}
            {onReset && (
              <Tooltip title={t('common.reset', '重置')}>
                <ActionButton onClick={onReset}>
                  <RefreshCw size={12} />
                </ActionButton>
              </Tooltip>
            )}
          </ActionsWrapper>
        )}
        {/* Active indicator */}
        {isActive && !isPaused && <ActivePulse />}
      </StatusCard>
    </StatusContainer>
  )
}

// Keyframes
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
`

const glow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(0, 210, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(0, 210, 255, 0.5), 0 0 24px rgba(0, 210, 255, 0.3);
  }
`

// Styled components
const StatusContainer = styled.div<{ $position: string; $isActive: boolean }>`
  position: fixed;
  z-index: 999;
  pointer-events: auto;

  ${(props) => {
    switch (props.$position) {
      case 'top-right':
        return 'top: 70px; right: 20px;'
      case 'top-left':
        return 'top: 70px; left: 20px;'
      case 'bottom-left':
        return 'bottom: 90px; left: 20px;'
      case 'bottom-right':
      default:
        return 'bottom: 90px; right: 70px;'
    }
  }}
`

const StatusCard = styled.div<{ $isActive: boolean; $isPaused: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: ${(props) =>
    props.$isActive
      ? props.$isPaused
        ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.1) 100%)'
        : 'linear-gradient(135deg, rgba(0, 210, 255, 0.15) 0%, rgba(58, 123, 213, 0.1) 100%)'
      : 'rgba(0, 0, 0, 0.3)'};
  border: 1px solid
    ${(props) =>
      props.$isActive ? (props.$isPaused ? 'rgba(255, 193, 7, 0.3)' : 'rgba(0, 210, 255, 0.3)') : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 20px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  ${(props) => props.$isActive && !props.$isPaused && `animation: ${glow} 2s ease-in-out infinite;`}

  &:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }
`

const IconWrapper = styled.div<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$isActive ? '#00d2ff' : 'var(--color-text-2)')};
  transition: color 0.3s;
`

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const TimeDisplay = styled.span<{ $isActive: boolean }>`
  font-size: 14px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: ${(props) => (props.$isActive ? '#00d2ff' : 'var(--color-text)')};
  letter-spacing: 0.5px;
`

const LabelText = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  white-space: nowrap;
`

const ActionsWrapper = styled.div`
  display: flex;
  gap: 4px;
  margin-left: 4px;
`

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text);
  }
`

const ActivePulse = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d2ff;
  animation: ${pulse} 1.5s ease-in-out infinite;
`

export default memo(VCPFloatingStatus)

// Hook for managing floating status
export function useVCPFloatingStatus() {
  const [config, setConfig] = useState<VCPFloatingStatusProps>({
    mode: 'clock',
    visible: false,
    isActive: false,
    isPaused: false
  })

  const showClock = useCallback(() => {
    setConfig({
      mode: 'clock',
      visible: true,
      isActive: false
    })
  }, [])

  const startTimer = useCallback((duration: number, operationName?: string) => {
    setConfig({
      mode: 'timer',
      visible: true,
      isActive: true,
      timerDuration: duration,
      operationName,
      isPaused: false
    })
  }, [])

  const startElapsed = useCallback((operationName?: string) => {
    setConfig({
      mode: 'elapsed',
      visible: true,
      isActive: true,
      startTime: Date.now(),
      operationName,
      isPaused: false
    })
  }, [])

  const pause = useCallback(() => {
    setConfig((prev) => ({ ...prev, isPaused: true }))
  }, [])

  const resume = useCallback(() => {
    setConfig((prev) => ({ ...prev, isPaused: false }))
  }, [])

  const togglePause = useCallback(() => {
    setConfig((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  const stop = useCallback(() => {
    setConfig((prev) => ({ ...prev, isActive: false }))
  }, [])

  const hide = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: false }))
  }, [])

  const reset = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      startTime: Date.now(),
      isPaused: false
    }))
  }, [])

  return {
    config,
    showClock,
    startTimer,
    startElapsed,
    pause,
    resume,
    togglePause,
    stop,
    hide,
    reset
  }
}
