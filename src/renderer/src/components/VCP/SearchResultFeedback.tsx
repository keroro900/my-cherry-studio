/**
 * SearchResultFeedback - 搜索结果反馈组件
 *
 * 功能:
 * - 提供正/负反馈按钮
 * - 调用 SelfLearningService 记录反馈
 * - 支持反馈状态显示
 * - 支持撤销反馈
 *
 * 使用场景:
 * - DailyNotePanel 搜索结果
 * - KnowledgeSearchPopup 搜索结果
 * - RAGObserverPanel 检索结果
 */

import {
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleFilled,
  CloseCircleOutlined,
  LoadingOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { Button, Space, Tooltip, message } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 反馈状态类型
type FeedbackStatus = 'none' | 'positive' | 'negative' | 'loading'

// 搜索结果元数据
export interface SearchResultMeta {
  id: string // 结果 ID (chunk ID 或 document ID)
  query: string // 原始查询
  searchId?: string // 搜索会话 ID (可选)
  score?: number // 相似度分数
  source?: string // 来源 (diary, knowledge, memory)
  tags?: string[] // 关联标签
  characterName?: string // 角色名 (日记场景)
}

// 组件属性
export interface SearchResultFeedbackProps {
  /** 搜索结果元数据 */
  result: SearchResultMeta
  /** 紧凑模式 (只显示图标) */
  compact?: boolean
  /** 禁用状态 */
  disabled?: boolean
  /** 反馈成功回调 */
  onFeedbackSuccess?: (type: 'positive' | 'negative', result: SearchResultMeta) => void
  /** 反馈失败回调 */
  onFeedbackError?: (error: Error, result: SearchResultMeta) => void
  /** 自定义样式 */
  className?: string
}

/**
 * 搜索结果反馈组件
 */
export const SearchResultFeedback: FC<SearchResultFeedbackProps> = ({
  result,
  compact = false,
  disabled = false,
  onFeedbackSuccess,
  onFeedbackError,
  className
}) => {
  const { t } = useTranslation()
  const [status, setStatus] = useState<FeedbackStatus>('none')
  const [lastFeedback, setLastFeedback] = useState<'positive' | 'negative' | null>(null)

  // 记录正向反馈
  const handlePositiveFeedback = useCallback(async () => {
    if (status === 'loading' || status === 'positive' || disabled) return

    setStatus('loading')
    try {
      // 调用 integratedMemory 记录正向反馈
      const response = await window.api.integratedMemory?.recordPositiveFeedback?.({
        searchId: result.searchId || result.id,
        selectedResultId: result.id,
        query: result.query
      })

      if (response?.success) {
        setStatus('positive')
        setLastFeedback('positive')
        onFeedbackSuccess?.('positive', result)
        message.success(t('vcp.feedback.positive_success', '感谢反馈，已记录为有用结果'))
      } else {
        throw new Error(response?.error || 'Unknown error')
      }
    } catch (error) {
      setStatus('none')
      const err = error instanceof Error ? error : new Error(String(error))
      onFeedbackError?.(err, result)
      message.error(t('vcp.feedback.error', '反馈记录失败: {{error}}', { error: err.message }))
    }
  }, [result, status, disabled, onFeedbackSuccess, onFeedbackError, t])

  // 记录负向反馈
  const handleNegativeFeedback = useCallback(async () => {
    if (status === 'loading' || status === 'negative' || disabled) return

    setStatus('loading')
    try {
      // 调用 integratedMemory 记录负向反馈
      const response = await window.api.integratedMemory?.recordNegativeFeedback?.({
        searchId: result.searchId || result.id,
        ignoredResultId: result.id,
        query: result.query
      })

      if (response?.success) {
        setStatus('negative')
        setLastFeedback('negative')
        onFeedbackSuccess?.('negative', result)
        message.info(t('vcp.feedback.negative_success', '已记录，我们会改进搜索结果'))
      } else {
        throw new Error(response?.error || 'Unknown error')
      }
    } catch (error) {
      setStatus('none')
      const err = error instanceof Error ? error : new Error(String(error))
      onFeedbackError?.(err, result)
      message.error(t('vcp.feedback.error', '反馈记录失败: {{error}}', { error: err.message }))
    }
  }, [result, status, disabled, onFeedbackSuccess, onFeedbackError, t])

  // 撤销反馈 (重置状态，下次可以重新选择)
  const handleUndo = useCallback(async () => {
    if (!lastFeedback) return

    // 简单重置本地状态，实际权重会在下次反馈时调整
    setStatus('none')
    setLastFeedback(null)
    message.info(t('vcp.feedback.undo_success', '已撤销反馈'))
  }, [lastFeedback, t])

  // 紧凑模式
  if (compact) {
    return (
      <CompactContainer className={className}>
        {status === 'loading' ? (
          <LoadingOutlined spin style={{ fontSize: 14 }} />
        ) : status === 'positive' ? (
          <Tooltip title={t('vcp.feedback.already_positive', '已标记为有用')}>
            <CheckCircleFilled style={{ fontSize: 14, color: '#52c41a' }} />
          </Tooltip>
        ) : status === 'negative' ? (
          <Tooltip title={t('vcp.feedback.already_negative', '已标记为无用')}>
            <CloseCircleFilled style={{ fontSize: 14, color: '#ff4d4f' }} />
          </Tooltip>
        ) : (
          <Space size={4}>
            <Tooltip title={t('vcp.feedback.positive_tip', '这个结果有帮助')}>
              <FeedbackButton
                $type="positive"
                onClick={handlePositiveFeedback}
                disabled={disabled}>
                <CheckCircleOutlined />
              </FeedbackButton>
            </Tooltip>
            <Tooltip title={t('vcp.feedback.negative_tip', '这个结果不相关')}>
              <FeedbackButton
                $type="negative"
                onClick={handleNegativeFeedback}
                disabled={disabled}>
                <CloseCircleOutlined />
              </FeedbackButton>
            </Tooltip>
          </Space>
        )}
      </CompactContainer>
    )
  }

  // 标准模式
  return (
    <Container className={className}>
      {status === 'loading' ? (
        <LoadingState>
          <LoadingOutlined spin />
          <span>{t('vcp.feedback.submitting', '提交中...')}</span>
        </LoadingState>
      ) : status === 'positive' || status === 'negative' ? (
        <FeedbackDone $type={status}>
          {status === 'positive' ? (
            <>
              <CheckCircleFilled />
              <span>{t('vcp.feedback.marked_positive', '已标记为有用')}</span>
            </>
          ) : (
            <>
              <CloseCircleFilled />
              <span>{t('vcp.feedback.marked_negative', '已标记为无用')}</span>
            </>
          )}
          <Tooltip title={t('vcp.feedback.undo', '撤销')}>
            <UndoButton onClick={handleUndo}>
              <UndoOutlined />
            </UndoButton>
          </Tooltip>
        </FeedbackDone>
      ) : (
        <FeedbackButtons>
          <FeedbackLabel>{t('vcp.feedback.label', '这个结果有帮助吗?')}</FeedbackLabel>
          <Space size={8}>
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={handlePositiveFeedback}
              disabled={disabled}
              style={{ color: '#52c41a' }}>
              {t('vcp.feedback.yes', '有用')}
            </Button>
            <Button
              type="text"
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={handleNegativeFeedback}
              disabled={disabled}
              style={{ color: '#ff4d4f' }}>
              {t('vcp.feedback.no', '无用')}
            </Button>
          </Space>
        </FeedbackButtons>
      )}
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  margin-top: 8px;
`

const CompactContainer = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const FeedbackButton = styled.button<{ $type: 'positive' | 'negative' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-3);

  &:hover:not(:disabled) {
    background: ${({ $type }) => ($type === 'positive' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)')};
    color: ${({ $type }) => ($type === 'positive' ? '#52c41a' : '#ff4d4f')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 14px;
  }
`

const FeedbackButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
`

const FeedbackLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  flex-shrink: 0;
`

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-2);
`

const FeedbackDone = styled.div<{ $type: 'positive' | 'negative' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ $type }) => ($type === 'positive' ? '#52c41a' : '#ff4d4f')};

  svg {
    font-size: 14px;
  }
`

const UndoButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-3);
  margin-left: 8px;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-mute);
    color: var(--color-text);
  }

  svg {
    font-size: 12px;
  }
`

// ==================== 导出 ====================

export default SearchResultFeedback
