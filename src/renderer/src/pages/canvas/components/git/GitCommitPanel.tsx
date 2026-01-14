/**
 * GitCommitPanel - Git 提交面板组件
 *
 * 提交消息输入和提交操作：
 * - 提交消息输入框
 * - 提交按钮
 * - 修订提交选项
 * - 快捷提交模板
 */

import { CheckOutlined, EditOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import { Button, Checkbox, Dropdown, Input, Tooltip, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

const { TextArea } = Input
const { Text } = Typography

// ==================== 类型定义 ====================

interface Props {
  workingDirectory: string | null
  stagedCount: number
  onCommit?: (hash: string, message: string) => void
  onRefresh?: () => void
}

// ==================== 快捷模板 ====================

const COMMIT_TEMPLATES = [
  { key: 'feat', label: 'feat: 新功能', prefix: 'feat: ' },
  { key: 'fix', label: 'fix: 修复 Bug', prefix: 'fix: ' },
  { key: 'docs', label: 'docs: 文档更新', prefix: 'docs: ' },
  { key: 'style', label: 'style: 代码格式', prefix: 'style: ' },
  { key: 'refactor', label: 'refactor: 重构', prefix: 'refactor: ' },
  { key: 'perf', label: 'perf: 性能优化', prefix: 'perf: ' },
  { key: 'test', label: 'test: 测试', prefix: 'test: ' },
  { key: 'chore', label: 'chore: 杂项', prefix: 'chore: ' },
  { key: 'wip', label: 'WIP: 进行中', prefix: 'WIP: ' }
]

// ==================== 组件实现 ====================

export const GitCommitPanel: FC<Props> = ({ workingDirectory, stagedCount, onCommit, onRefresh }) => {
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [committing, setCommitting] = useState(false)

  /**
   * 处理提交
   */
  const handleCommit = useCallback(async () => {
    if (!workingDirectory || committing) return

    const trimmedMessage = message.trim()
    if (!trimmedMessage && !amend) {
      window.toast?.warning?.('请输入提交消息')
      return
    }

    if (stagedCount === 0 && !amend) {
      window.toast?.warning?.('没有已暂存的文件')
      return
    }

    try {
      setCommitting(true)
      const result = await window.api.git.commit(workingDirectory, trimmedMessage, { amend })

      window.toast?.success?.(`提交成功: ${result.hash.slice(0, 7)}`)
      setMessage('')
      setAmend(false)
      onCommit?.(result.hash, result.message)
      onRefresh?.()
    } catch (error) {
      console.error('Commit failed:', error)
      window.toast?.error?.('提交失败')
    } finally {
      setCommitting(false)
    }
  }, [workingDirectory, message, amend, stagedCount, committing, onCommit, onRefresh])

  /**
   * 快捷模板菜单
   */
  const templateMenuItems: MenuProps['items'] = useMemo(
    () =>
      COMMIT_TEMPLATES.map((t) => ({
        key: t.key,
        label: t.label,
        onClick: () => {
          setMessage((prev) => {
            // 如果已有前缀，替换；否则添加
            const hasPrefix = COMMIT_TEMPLATES.some((template) => prev.startsWith(template.prefix))
            if (hasPrefix) {
              const content = prev.replace(/^[a-z]+:\s*/i, '')
              return t.prefix + content
            }
            return t.prefix + prev
          })
        }
      })),
    []
  )

  /**
   * 处理快捷键
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter 提交
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCommit()
      }
    },
    [handleCommit]
  )

  const canCommit = (message.trim().length > 0 || amend) && (stagedCount > 0 || amend)

  return (
    <Container>
      {/* 提交消息输入 */}
      <MessageWrapper>
        <StyledTextArea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={amend ? '留空使用上次提交消息...' : '提交消息 (Ctrl+Enter 提交)'}
          autoSize={{ minRows: 2, maxRows: 6 }}
          disabled={committing}
        />
      </MessageWrapper>

      {/* 操作栏 */}
      <ActionBar>
        <HStack gap={8} style={{ alignItems: 'center' }}>
          {/* 修订提交 */}
          <Tooltip title="修订上次提交">
            <Checkbox checked={amend} onChange={(e) => setAmend(e.target.checked)} disabled={committing}>
              <Text style={{ fontSize: 12 }}>修订</Text>
            </Checkbox>
          </Tooltip>

          {/* 已暂存数量 */}
          <StagedCount>
            <CheckOutlined />
            {stagedCount} 已暂存
          </StagedCount>
        </HStack>

        <HStack gap={8}>
          {/* 快捷模板 */}
          <Dropdown menu={{ items: templateMenuItems }} trigger={['click']}>
            <Button size="small" icon={<ThunderboltOutlined />} disabled={committing}>
              模板
            </Button>
          </Dropdown>

          {/* 提交按钮 */}
          <Button
            type="primary"
            size="small"
            icon={amend ? <EditOutlined /> : <SendOutlined />}
            onClick={handleCommit}
            loading={committing}
            disabled={!canCommit}>
            {amend ? '修订' : '提交'}
          </Button>
        </HStack>
      </ActionBar>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const MessageWrapper = styled.div`
  .ant-input {
    font-size: 13px;
  }
`

const StyledTextArea = styled(TextArea)`
  resize: none;
`

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const StagedCount = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-2);

  .anticon {
    color: var(--color-success);
  }
`

export default GitCommitPanel
