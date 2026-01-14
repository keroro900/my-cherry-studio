/**
 * VCP Notification Bar Component
 *
 * A floating notification bar for VCP system messages
 * Features:
 * - Multiple notification types (info, success, warning, error, tool)
 * - Auto-dismiss with configurable duration
 * - Animated entrance/exit
 * - Progress indicator for ongoing operations
 * - Queue management for multiple notifications
 */

import { CheckCircleOutlined, CloseOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { AnimatePresence, motion } from 'motion/react'
import type { FC, ReactNode } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'

import { AlertCircle, Settings, Zap } from 'lucide-react'

export type VCPNotificationType = 'info' | 'success' | 'warning' | 'error' | 'tool'

export interface VCPNotification {
  id: string
  type: VCPNotificationType
  title: string
  message?: string
  icon?: ReactNode
  duration?: number // 0 means no auto-dismiss
  progress?: number // 0-100 for progress bar
  dismissible?: boolean
  timestamp?: number
}

interface Props {
  notifications: VCPNotification[]
  onDismiss: (id: string) => void
  position?: 'top' | 'bottom'
  maxVisible?: number
}

const TYPE_CONFIG: Record<
  VCPNotificationType,
  {
    icon: ReactNode
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  info: {
    icon: <InfoCircleOutlined />,
    color: '#00d2ff',
    bgColor: 'rgba(0, 210, 255, 0.1)',
    borderColor: 'rgba(0, 210, 255, 0.3)'
  },
  success: {
    icon: <CheckCircleOutlined />,
    color: '#4caf50',
    bgColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)'
  },
  warning: {
    icon: <WarningOutlined />,
    color: '#ffc107',
    bgColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: 'rgba(255, 193, 7, 0.3)'
  },
  error: {
    icon: <AlertCircle size={16} />,
    color: '#ff5252',
    bgColor: 'rgba(255, 82, 82, 0.1)',
    borderColor: 'rgba(255, 82, 82, 0.3)'
  },
  tool: {
    icon: <Settings size={16} />,
    color: '#f1c40f',
    bgColor: 'rgba(241, 196, 15, 0.1)',
    borderColor: 'rgba(241, 196, 15, 0.3)'
  }
}

const VCPNotificationBar: FC<Props> = ({ notifications, onDismiss, position = 'top', maxVisible = 3 }) => {
  const visibleNotifications = notifications.slice(0, maxVisible)

  return (
    <NotificationContainer $position={position}>
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
      {notifications.length > maxVisible && (
        <MoreIndicator>+{notifications.length - maxVisible} more</MoreIndicator>
      )}
    </NotificationContainer>
  )
}

interface NotificationItemProps {
  notification: VCPNotification
  onDismiss: (id: string) => void
}

const NotificationItem: FC<NotificationItemProps> = ({ notification, onDismiss }) => {
  const [timeLeft, setTimeLeft] = useState(notification.duration || 0)
  const config = TYPE_CONFIG[notification.type]

  useEffect(() => {
    if (!notification.duration || notification.duration === 0) return

    setTimeLeft(notification.duration)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) {
          clearInterval(interval)
          onDismiss(notification.id)
          return 0
        }
        return prev - 100
      })
    }, 100)

    return () => clearInterval(interval)
  }, [notification.id, notification.duration, onDismiss])

  const handleDismiss = useCallback(() => {
    onDismiss(notification.id)
  }, [notification.id, onDismiss])

  const progressPercent =
    notification.progress !== undefined
      ? notification.progress
      : notification.duration
        ? ((notification.duration - timeLeft) / notification.duration) * 100
        : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}>
      <NotificationCard $type={notification.type} $config={config}>
        <IconWrapper $color={config.color}>{notification.icon || config.icon}</IconWrapper>
        <ContentWrapper>
          <Title>{notification.title}</Title>
          {notification.message && <Message>{notification.message}</Message>}
        </ContentWrapper>
        {notification.dismissible !== false && (
          <DismissButton onClick={handleDismiss}>
            <CloseOutlined />
          </DismissButton>
        )}
        {(notification.duration || notification.progress !== undefined) && (
          <ProgressBar $progress={progressPercent} $color={config.color} />
        )}
      </NotificationCard>
    </motion.div>
  )
}

// Keyframes
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`

// Styled components
const NotificationContainer = styled.div<{ $position: 'top' | 'bottom' }>`
  position: fixed;
  ${(props) => (props.$position === 'top' ? 'top: 60px;' : 'bottom: 80px;')}
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`

const NotificationCard = styled.div<{
  $type: VCPNotificationType
  $config: (typeof TYPE_CONFIG)[VCPNotificationType]
}>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: ${(props) => props.$config.bgColor};
  border: 1px solid ${(props) => props.$config.borderColor};
  border-left: 3px solid ${(props) => props.$config.color};
  border-radius: 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
`

const IconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${(props) => props.$color}20;
  color: ${(props) => props.$color};
  flex-shrink: 0;

  .anticon,
  svg {
    font-size: 16px;
  }
`

const ContentWrapper = styled.div`
  flex: 1;
  min-width: 0;
`

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.4;
`

const Message = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  margin-top: 4px;
  line-height: 1.4;
  word-break: break-word;
`

const DismissButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.2s;
  border-radius: 4px;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
  }
`

const ProgressBar = styled.div<{ $progress: number; $color: string }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: ${(props) => props.$progress}%;
  background: linear-gradient(
    90deg,
    ${(props) => props.$color}80,
    ${(props) => props.$color},
    ${(props) => props.$color}80
  );
  background-size: 200% 100%;
  animation: ${shimmer} 2s linear infinite;
  transition: width 0.1s linear;
`

const MoreIndicator = styled.div`
  text-align: center;
  font-size: 11px;
  color: var(--color-text-3);
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  backdrop-filter: blur(8px);
`

export default memo(VCPNotificationBar)

// Hook for managing notifications
export function useVCPNotifications() {
  const [notifications, setNotifications] = useState<VCPNotification[]>([])

  const addNotification = useCallback((notification: Omit<VCPNotification, 'id' | 'timestamp'>) => {
    const id = `vcp-notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setNotifications((prev) => [
      ...prev,
      {
        ...notification,
        id,
        timestamp: Date.now(),
        duration: notification.duration ?? 5000
      }
    ])
    return id
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Convenience methods
  const info = useCallback(
    (title: string, message?: string, options?: Partial<VCPNotification>) => {
      return addNotification({ type: 'info', title, message, ...options })
    },
    [addNotification]
  )

  const success = useCallback(
    (title: string, message?: string, options?: Partial<VCPNotification>) => {
      return addNotification({ type: 'success', title, message, ...options })
    },
    [addNotification]
  )

  const warning = useCallback(
    (title: string, message?: string, options?: Partial<VCPNotification>) => {
      return addNotification({ type: 'warning', title, message, ...options })
    },
    [addNotification]
  )

  const error = useCallback(
    (title: string, message?: string, options?: Partial<VCPNotification>) => {
      return addNotification({ type: 'error', title, message, ...options })
    },
    [addNotification]
  )

  const tool = useCallback(
    (title: string, message?: string, options?: Partial<VCPNotification>) => {
      return addNotification({ type: 'tool', title, message, ...options })
    },
    [addNotification]
  )

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
    info,
    success,
    warning,
    error,
    tool
  }
}
