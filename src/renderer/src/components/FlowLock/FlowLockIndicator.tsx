/**
 * FlowLockIndicator - 话题锁定状态指示器
 *
 * 功能:
 * - 显示当前话题锁定状态
 * - 支持手动锁定/解锁
 * - 显示剩余时间
 * - 偏离警告提示
 */

import { LockOutlined, UnlockOutlined } from '@ant-design/icons'
import useFlowLock, { type DeviationResult, type FlowLock } from '@renderer/hooks/useFlowLock'
import { Badge, Button, Input, Modal, Popover, Progress, Space, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// ==================== 类型定义 ====================

interface FlowLockIndicatorProps {
  /** 会话 ID */
  sessionId: string
  /** 是否紧凑模式 */
  compact?: boolean
  /** 偏离时的回调 */
  onDeviation?: (result: DeviationResult) => void
  /** 样式类名 */
  className?: string
}

// ==================== 样式组件 ====================

const IndicatorContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const LockButton = styled(Button)<{ $isLocked: boolean }>`
  border-radius: 16px;
  padding: 4px 12px;
  height: 28px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;

  ${({ $isLocked }) =>
    $isLocked
      ? `
    background: var(--color-warning-light, #fff7e6);
    border-color: var(--color-warning, #fa8c16);
    color: var(--color-warning, #fa8c16);

    &:hover {
      background: var(--color-warning, #fa8c16) !important;
      color: white !important;
    }
  `
      : `
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text-secondary);

    &:hover {
      border-color: var(--color-primary) !important;
      color: var(--color-primary) !important;
    }
  `}
`

const PopoverContent = styled.div`
  width: 280px;
  padding: 12px;

  .lock-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);

    .lock-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-warning-light, #fff7e6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-warning, #fa8c16);
      font-size: 16px;
    }

    .lock-info {
      flex: 1;

      .lock-topic {
        font-weight: 600;
        font-size: 14px;
        color: var(--color-text);
        margin-bottom: 2px;
      }

      .lock-time {
        font-size: 12px;
        color: var(--color-text-secondary);
      }
    }
  }

  .lock-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;

    .stat-item {
      background: var(--color-background-soft);
      border-radius: 6px;
      padding: 8px;
      text-align: center;

      .stat-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text);
      }

      .stat-label {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
    }
  }

  .lock-keywords {
    margin-bottom: 12px;

    .keywords-label {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }

    .keywords-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }

  .lock-actions {
    display: flex;
    gap: 8px;
  }
`

const CreateLockModal = styled(Modal)`
  .ant-modal-body {
    padding-top: 12px;
  }

  .form-item {
    margin-bottom: 16px;

    .form-label {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }
  }
`

// ==================== 组件实现 ====================

export const FlowLockIndicator: FC<FlowLockIndicatorProps> = ({
  sessionId,
  compact = false,
  onDeviation,
  className
}) => {
  const { t } = useTranslation()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [keywords, setKeywords] = useState('')

  // 检查 API 是否可用
  const isApiAvailable = typeof window !== 'undefined' && window.api?.flowLock !== undefined

  const { lock, isLocked, loading, remainingTime, createLock, unlock, extendLock } = useFlowLock({
    sessionId,
    onDeviation: (result) => {
      onDeviation?.(result)
      // 显示警告提示
      if (result.suggestion === 'warn') {
        window.toast.warning(t('flowLock.deviation_warning') || '您的消息可能偏离了当前话题')
      } else if (result.suggestion === 'redirect') {
        window.toast.warning(t('flowLock.deviation_redirect') || '请回到当前话题讨论')
      }
    }
  })

  // 格式化剩余时间 - 必须在所有条件判断之前
  const formatRemainingTime = useCallback((ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // 处理创建锁定 - 必须在所有条件判断之前
  const handleCreateLock = useCallback(async () => {
    if (!topicName.trim()) {
      window.toast.error(t('flowLock.topic_required') || '请输入话题名称')
      return
    }

    const keywordList = keywords
      .split(/[,，\s]+/)
      .map((k) => k.trim())
      .filter(Boolean)

    const result = await createLock(topicName.trim(), keywordList)

    if (result) {
      window.toast.success(t('flowLock.lock_created') || '话题已锁定')
      setShowCreateModal(false)
      setTopicName('')
      setKeywords('')
    } else {
      window.toast.error(t('flowLock.lock_failed') || '锁定失败')
    }
  }, [topicName, keywords, createLock, t])

  // 处理解锁 - 必须在所有条件判断之前
  const handleUnlock = useCallback(async () => {
    const success = await unlock('用户手动解锁')
    if (success) {
      window.toast.success(t('flowLock.unlocked') || '已解锁')
    }
  }, [unlock, t])

  // 处理延长时间 - 必须在所有条件判断之前
  const handleExtend = useCallback(async () => {
    const success = await extendLock(5 * 60 * 1000) // 延长5分钟
    if (success) {
      window.toast.success(t('flowLock.extended') || '已延长 5 分钟')
    }
  }, [extendLock, t])

  // 渲染锁定详情弹窗
  const renderLockPopover = useCallback(
    (lockInfo: FlowLock) => {
      const progress = lockInfo.timeout > 0 ? ((lockInfo.timeout - remainingTime) / lockInfo.timeout) * 100 : 0

      return (
        <PopoverContent>
          <div className="lock-header">
            <div className="lock-icon">
              <LockOutlined />
            </div>
            <div className="lock-info">
              <div className="lock-topic">{lockInfo.topicContext.topicName}</div>
              <div className="lock-time">
                {t('flowLock.remaining') || '剩余'}: {formatRemainingTime(remainingTime)}
              </div>
            </div>
          </div>

          <Progress percent={progress} size="small" showInfo={false} strokeColor="var(--color-warning)" />

          <div className="lock-stats" style={{ marginTop: 12 }}>
            <div className="stat-item">
              <div className="stat-value">{lockInfo.deviationCount}</div>
              <div className="stat-label">{t('flowLock.deviations') || '偏离次数'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{lockInfo.maxDeviations}</div>
              <div className="stat-label">{t('flowLock.max_deviations') || '最大允许'}</div>
            </div>
          </div>

          {lockInfo.topicContext.keywords.length > 0 && (
            <div className="lock-keywords">
              <div className="keywords-label">{t('flowLock.keywords') || '关键词'}</div>
              <div className="keywords-list">
                {lockInfo.topicContext.keywords.map((kw, i) => (
                  <Tag key={i} color="blue">
                    {kw}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <div className="lock-actions">
            <Button size="small" onClick={handleExtend}>
              {t('flowLock.extend') || '延长5分钟'}
            </Button>
            <Button size="small" danger onClick={handleUnlock}>
              {t('flowLock.unlock') || '解锁'}
            </Button>
          </div>
        </PopoverContent>
      )
    },
    [remainingTime, formatRemainingTime, handleExtend, handleUnlock, t]
  )

  // 如果 API 不可用，不渲染组件 - 所有 hooks 已经调用完毕
  if (!isApiAvailable) {
    return null
  }

  // 紧凑模式
  if (compact) {
    return (
      <IndicatorContainer className={className}>
        {isLocked ? (
          <Tooltip title={lock?.topicContext.topicName}>
            <Badge status="warning" />
          </Tooltip>
        ) : null}
      </IndicatorContainer>
    )
  }

  return (
    <IndicatorContainer className={className}>
      {isLocked && lock ? (
        <Popover content={renderLockPopover(lock)} trigger="click" placement="bottomLeft">
          <LockButton $isLocked={true} size="small" loading={loading}>
            <LockOutlined />
            <span>{lock.topicContext.topicName}</span>
            <span style={{ opacity: 0.7 }}>{formatRemainingTime(remainingTime)}</span>
          </LockButton>
        </Popover>
      ) : (
        <Tooltip title={t('flowLock.click_to_lock') || '点击锁定当前话题'}>
          <LockButton $isLocked={false} size="small" onClick={() => setShowCreateModal(true)} loading={loading}>
            <UnlockOutlined />
            <span>{t('flowLock.lock_topic') || '锁定话题'}</span>
          </LockButton>
        </Tooltip>
      )}

      {/* 创建锁定对话框 */}
      <CreateLockModal
        title={t('flowLock.create_lock') || '锁定话题'}
        open={showCreateModal}
        onOk={handleCreateLock}
        onCancel={() => setShowCreateModal(false)}
        okText={t('flowLock.confirm_lock') || '锁定'}
        cancelText={t('common.cancel') || '取消'}
        width={360}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="form-item">
            <div className="form-label">{t('flowLock.topic_name') || '话题名称'}</div>
            <Input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder={t('flowLock.topic_placeholder') || '输入要锁定的话题...'}
              maxLength={50}
            />
          </div>
          <div className="form-item">
            <div className="form-label">{t('flowLock.keywords_label') || '关键词 (可选，用逗号分隔)'}</div>
            <Input.TextArea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t('flowLock.keywords_placeholder') || '输入相关关键词，如: React, 组件, 状态管理'}
              rows={2}
            />
          </div>
        </Space>
      </CreateLockModal>
    </IndicatorContainer>
  )
}

export default FlowLockIndicator
