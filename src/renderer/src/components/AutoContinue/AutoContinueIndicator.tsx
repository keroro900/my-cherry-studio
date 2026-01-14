/**
 * AutoContinueIndicator - 自动续写状态指示器（心流锁 UI）
 *
 * 功能:
 * - 显示 AI 自动续写状态
 * - 发光动画效果（参考 VCPChat flowlock.css）
 * - 支持启动/停止/暂停/恢复
 * - 显示续写次数
 * - 自定义提示词设置
 */

import './AutoContinueIndicator.css'

import { PauseCircleOutlined, PlayCircleOutlined, SettingOutlined, StopOutlined } from '@ant-design/icons'
import useAutoContinue, { type AutoContinueOptions, type AutoContinueStatus } from '@renderer/hooks/useAutoContinue'
import { Badge, Button, Input, Popover, Space, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ==================== 类型定义 ====================

interface AutoContinueIndicatorProps {
  /** Agent ID */
  agentId: string
  /** Topic ID */
  topicId: string
  /** 是否紧凑模式 */
  compact?: boolean
  /** 续写触发回调 - 由父组件处理实际的消息发送 */
  onTrigger?: (prompt: string) => void
  /** 样式类名 */
  className?: string
}

// ==================== 状态图标映射 ====================

const statusConfig: Record<
  AutoContinueStatus,
  {
    icon: React.ReactNode
    color: string
    dotClass: string
    label: string
  }
> = {
  idle: {
    icon: <PlayCircleOutlined />,
    color: 'default',
    dotClass: 'auto-continue-dot-idle',
    label: '启动续写'
  },
  active: {
    icon: <span className="auto-continue-emoji">▶️</span>,
    color: 'processing',
    dotClass: 'auto-continue-dot-active',
    label: '续写中'
  },
  paused: {
    icon: <PauseCircleOutlined />,
    color: 'warning',
    dotClass: 'auto-continue-dot-paused',
    label: '已暂停'
  },
  processing: {
    icon: <span className="auto-continue-emoji">⏳</span>,
    color: 'processing',
    dotClass: 'auto-continue-dot-processing',
    label: '处理中'
  }
}

// ==================== 组件实现 ====================

export const AutoContinueIndicator: FC<AutoContinueIndicatorProps> = ({
  agentId,
  topicId,
  compact = false,
  onTrigger,
  className
}) => {
  const { t } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [maxContinues, setMaxContinues] = useState(0)
  const [continueDelay, setContinueDelay] = useState(1000)
  const [isHeartbeat, setIsHeartbeat] = useState(false)

  const { session, status, isActive, continueCount, start, stop, pause, resume, setCustomPrompt: updatePrompt } =
    useAutoContinue({
      agentId,
      topicId,
      onTrigger: (event) => {
        // 触发心跳动画
        setIsHeartbeat(true)
        setTimeout(() => setIsHeartbeat(false), 800)

        // 调用父组件的续写回调
        if (onTrigger) {
          onTrigger(event.customPrompt || t('autoContinue.default_prompt', '请继续'))
        }
      },
      onStatusChange: (_newStatus, _session) => {
        // 状态变化时更新本地状态
      }
    })

  // 同步 session 的 customPrompt
  useEffect(() => {
    if (session?.customPrompt) {
      setCustomPrompt(session.customPrompt)
    }
  }, [session?.customPrompt])

  // 处理启动
  const handleStart = useCallback(async () => {
    const options: AutoContinueOptions = {
      customPrompt: customPrompt || undefined,
      maxContinues: maxContinues > 0 ? maxContinues : 0,
      continueDelay,
      startImmediately: false
    }

    const newSession = await start(options)
    if (newSession) {
      window.toast?.success?.(t('autoContinue.started', '自动续写已启动'))
      setShowSettings(false)
    }
  }, [customPrompt, maxContinues, continueDelay, start, t])

  // 处理停止
  const handleStop = useCallback(async () => {
    const success = await stop('用户停止')
    if (success) {
      window.toast?.success?.(t('autoContinue.stopped', '自动续写已停止'))
    }
  }, [stop, t])

  // 处理暂停
  const handlePause = useCallback(async () => {
    const success = await pause()
    if (success) {
      window.toast?.info?.(t('autoContinue.paused', '自动续写已暂停'))
    }
  }, [pause, t])

  // 处理恢复
  const handleResume = useCallback(async () => {
    const success = await resume()
    if (success) {
      window.toast?.info?.(t('autoContinue.resumed', '自动续写已恢复'))
    }
  }, [resume, t])

  // 保存自定义提示词
  const handleSavePrompt = useCallback(async () => {
    if (session) {
      await updatePrompt(customPrompt || undefined)
      window.toast?.success?.(t('autoContinue.prompt_saved', '提示词已保存'))
    }
  }, [session, customPrompt, updatePrompt, t])

  // 获取当前状态配置
  const currentConfig = statusConfig[status]

  // 渲染设置弹窗内容
  const renderSettingsPopover = () => (
    <div className="auto-continue-popover">
      <div className="auto-continue-popover-header">
        <div className="auto-continue-popover-icon">
          <PlayCircleOutlined />
        </div>
        <div className="auto-continue-popover-info">
          <div className="auto-continue-popover-title">{t('autoContinue.title', '自动续写')}</div>
          <div className="auto-continue-popover-subtitle">
            {isActive
              ? t('autoContinue.status_active', '运行中')
              : status === 'paused'
                ? t('autoContinue.status_paused', '已暂停')
                : t('autoContinue.status_idle', '未启动')}
          </div>
        </div>
      </div>

      {isActive && (
        <div className="auto-continue-popover-stats">
          <div className="auto-continue-popover-stat">
            <div className="auto-continue-popover-stat-value">{continueCount}</div>
            <div className="auto-continue-popover-stat-label">{t('autoContinue.continue_count', '续写次数')}</div>
          </div>
          <div className="auto-continue-popover-stat">
            <div className="auto-continue-popover-stat-value">
              {session?.maxContinues === 0 ? '∞' : session?.maxContinues}
            </div>
            <div className="auto-continue-popover-stat-label">{t('autoContinue.max_continues', '最大次数')}</div>
          </div>
        </div>
      )}

      <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
        <div className="auto-continue-popover-prompt">
          <div className="auto-continue-popover-prompt-label">{t('autoContinue.custom_prompt', '续写提示词')}</div>
          <Input.TextArea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t('autoContinue.prompt_placeholder', '请继续...')}
            rows={2}
            disabled={isActive}
          />
        </div>

        {!isActive && (
          <>
            <div>
              <div className="auto-continue-popover-prompt-label">
                {t('autoContinue.max_continues_label', '最大续写次数 (0=无限)')}
              </div>
              <Input
                type="number"
                min={0}
                value={maxContinues}
                onChange={(e) => setMaxContinues(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div className="auto-continue-popover-prompt-label">
                {t('autoContinue.delay_label', '续写间隔 (毫秒)')}
              </div>
              <Input
                type="number"
                min={500}
                step={500}
                value={continueDelay}
                onChange={(e) => setContinueDelay(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </>
        )}
      </Space>

      <div className="auto-continue-popover-actions">
        {!isActive && status !== 'paused' && (
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleStart}>
            {t('autoContinue.start', '启动')}
          </Button>
        )}

        {status === 'active' && (
          <Button size="small" icon={<PauseCircleOutlined />} onClick={handlePause}>
            {t('autoContinue.pause', '暂停')}
          </Button>
        )}

        {status === 'paused' && (
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleResume}>
            {t('autoContinue.resume', '恢复')}
          </Button>
        )}

        {(isActive || status === 'paused') && (
          <Button size="small" danger icon={<StopOutlined />} onClick={handleStop}>
            {t('autoContinue.stop', '停止')}
          </Button>
        )}

        {isActive && (
          <Button size="small" icon={<SettingOutlined />} onClick={handleSavePrompt}>
            {t('autoContinue.save_prompt', '保存提示词')}
          </Button>
        )}
      </div>
    </div>
  )

  // 紧凑模式
  if (compact) {
    return (
      <div className={`auto-continue-container ${className || ''}`}>
        {isActive && (
          <Tooltip title={`${t('autoContinue.title', '自动续写')}: ${continueCount}`}>
            <Badge status={currentConfig.color as any} />
          </Tooltip>
        )}
      </div>
    )
  }

  // 完整模式
  const buttonClass = `
    ${isActive ? 'auto-continue-button-active' : ''}
    ${isHeartbeat ? 'auto-continue-heartbeat' : ''}
  `.trim()

  return (
    <div className={`auto-continue-container ${className || ''}`}>
      <Popover
        content={renderSettingsPopover()}
        trigger="click"
        placement="bottomLeft"
        open={showSettings}
        onOpenChange={setShowSettings}>
        <Button
          size="small"
          type={isActive ? 'primary' : 'default'}
          ghost={isActive}
          className={buttonClass}
          style={{
            borderRadius: 16,
            padding: '4px 12px',
            height: 28,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
          <span className={currentConfig.dotClass}></span>
          <span>{isActive ? t('autoContinue.running', '续写中') : t('autoContinue.auto', '自动续写')}</span>
          {isActive && continueCount > 0 && <span className="auto-continue-count">{continueCount}</span>}
        </Button>
      </Popover>
    </div>
  )
}

export default AutoContinueIndicator
