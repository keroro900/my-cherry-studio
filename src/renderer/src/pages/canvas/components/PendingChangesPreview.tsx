/**
 * PendingChangesPreview - 待处理变更预览组件
 *
 * 基于 Eclipse Theia ChangeSet 模式和 Windsurf 风格设计
 * 显示 AI 协同生成的文件变更列表，支持应用/拒绝操作和差异预览
 */

import {
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DiffOutlined,
  DownOutlined,
  EditOutlined,
  FileAddOutlined,
  FileOutlined,
  LoadingOutlined,
  RightOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  clearPendingChanges,
  removePendingChange,
  selectPendingChanges,
  setShowPendingChangesPreview,
  updatePendingChangeStatus,
  type PendingFileChange
} from '@renderer/store/canvas'
import { Badge, Button, Collapse, Empty, Space, Tag, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import DiffViewer from '../DiffViewer'

const { Text } = Typography

const logger = loggerService.withContext('PendingChangesPreview')

// ==================== 类型定义 ====================

interface PendingChangesPreviewProps {
  /** 外部传入的变更列表 (可选，默认使用 Redux) */
  changes?: PendingFileChange[]
  /** 应用单个变更 */
  onApply?: (id: string) => Promise<void>
  /** 应用所有变更 */
  onApplyAll?: () => Promise<void>
  /** 拒绝单个变更 */
  onReject?: (id: string) => void
  /** 拒绝所有变更 */
  onRejectAll?: () => void
  /** 打开差异视图 */
  onOpenDiff?: (id: string) => void
  /** 关闭面板 */
  onClose?: () => void
  /** 高度 */
  height?: string | number
  /** 是否显示头部 */
  showHeader?: boolean
  /** 是否紧凑模式 */
  compact?: boolean
}

// ==================== 工具函数 ====================

/**
 * 获取文件类型图标
 */
function getFileIcon(_filePath: string, changeType: 'add' | 'modify' | 'delete'): React.ReactNode {
  if (changeType === 'delete') {
    return <DeleteOutlined style={{ color: 'var(--color-error)' }} />
  }
  if (changeType === 'add') {
    return <FileAddOutlined style={{ color: 'var(--color-success)' }} />
  }
  return <EditOutlined style={{ color: 'var(--color-warning)' }} />
}

/**
 * 根据文件内容判断变更类型
 */
function detectChangeType(change: PendingFileChange): 'add' | 'modify' | 'delete' {
  if (!change.originalContent && change.newContent) {
    return 'add'
  }
  if (change.originalContent && !change.newContent) {
    return 'delete'
  }
  return 'modify'
}

/**
 * 获取变更类型标签颜色
 */
function getChangeTypeColor(changeType: 'add' | 'modify' | 'delete'): string {
  switch (changeType) {
    case 'add':
      return 'success'
    case 'delete':
      return 'error'
    case 'modify':
      return 'warning'
    default:
      return 'default'
  }
}

/**
 * 获取变更类型标签文本
 */
function getChangeTypeText(changeType: 'add' | 'modify' | 'delete'): string {
  switch (changeType) {
    case 'add':
      return 'A'
    case 'delete':
      return 'D'
    case 'modify':
      return 'M'
    default:
      return '?'
  }
}

/**
 * 计算变更统计
 */
function countChanges(original: string, modified: string): { additions: number; deletions: number } {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')

  const originalSet = new Set(originalLines)
  const modifiedSet = new Set(modifiedLines)

  let additions = 0
  let deletions = 0

  for (const line of modifiedLines) {
    if (!originalSet.has(line)) {
      additions++
    }
  }

  for (const line of originalLines) {
    if (!modifiedSet.has(line)) {
      deletions++
    }
  }

  return { additions, deletions }
}

// ==================== 子组件 ====================

interface ChangeItemProps {
  change: PendingFileChange
  expanded: boolean
  onToggle: () => void
  onApply: () => Promise<void>
  onReject: () => void
  compact?: boolean
}

/**
 * 单个变更项组件
 */
const ChangeItem: FC<ChangeItemProps> = ({ change, expanded, onToggle, onApply, onReject, compact }) => {
  const { t } = useTranslation()
  const [isApplying, setIsApplying] = useState(false)

  const changeType = detectChangeType(change)
  const stats = useMemo(
    () => countChanges(change.originalContent || '', change.newContent || ''),
    [change.originalContent, change.newContent]
  )

  const handleApply = useCallback(async () => {
    setIsApplying(true)
    try {
      await onApply()
    } finally {
      setIsApplying(false)
    }
  }, [onApply])

  const isPending = change.status === 'pending'
  const isApplied = change.status === 'applied'
  const isRejected = change.status === 'rejected'

  return (
    <ChangeItemContainer $status={change.status} $changeType={changeType}>
      <ChangeItemHeader onClick={onToggle}>
        <ExpandIcon>{expanded ? <DownOutlined /> : <RightOutlined />}</ExpandIcon>

        <FileInfo>
          {getFileIcon(change.filePath, changeType)}
          <FileName $status={change.status}>{change.fileName}</FileName>
          <Tag color={getChangeTypeColor(changeType)} style={{ marginLeft: 8, fontSize: 10 }}>
            {getChangeTypeText(changeType)}
          </Tag>
        </FileInfo>

        {!compact && (
          <ChangeStats>
            {stats.additions > 0 && <StatItem $type="addition">+{stats.additions}</StatItem>}
            {stats.deletions > 0 && <StatItem $type="deletion">-{stats.deletions}</StatItem>}
          </ChangeStats>
        )}

        <StatusBadge>
          {isApplied && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              {t('canvas.pending.applied', '已应用')}
            </Tag>
          )}
          {isRejected && (
            <Tag color="default" icon={<CloseCircleOutlined />}>
              {t('canvas.pending.rejected', '已拒绝')}
            </Tag>
          )}
        </StatusBadge>

        {isPending && (
          <ActionButtons onClick={(e) => e.stopPropagation()}>
            <Tooltip title={t('canvas.pending.apply', '应用')}>
              <ActionButton onClick={handleApply} disabled={isApplying} $type="apply">
                {isApplying ? <LoadingOutlined /> : <CheckOutlined />}
              </ActionButton>
            </Tooltip>
            <Tooltip title={t('canvas.pending.reject', '拒绝')}>
              <ActionButton onClick={onReject} $type="reject">
                <CloseOutlined />
              </ActionButton>
            </Tooltip>
          </ActionButtons>
        )}
      </ChangeItemHeader>

      {expanded && (
        <ChangeItemBody>
          {change.description && (
            <DescriptionText>
              <Text type="secondary">{change.description}</Text>
            </DescriptionText>
          )}

          <DiffPreview>
            <DiffViewer
              originalContent={change.originalContent || ''}
              modifiedContent={change.newContent || ''}
              originalLabel={t('canvas.diff.original', '原始')}
              modifiedLabel={t('canvas.diff.modified', '修改')}
              filePath={change.filePath}
              height={300}
            />
          </DiffPreview>

          <FilePathText>
            <FileOutlined style={{ marginRight: 4 }} />
            <Text type="secondary" copyable={{ text: change.filePath }}>
              {change.filePath}
            </Text>
          </FilePathText>
        </ChangeItemBody>
      )}
    </ChangeItemContainer>
  )
}

// ==================== 主组件 ====================

/**
 * PendingChangesPreview 组件
 *
 * 显示待处理的文件变更列表，支持：
 * - 展开/折叠查看差异
 * - 单个/批量应用变更
 * - 单个/批量拒绝变更
 * - 按来源分组 (collab/crew)
 */
const PendingChangesPreview: FC<PendingChangesPreviewProps> = ({
  changes: externalChanges,
  onApply,
  onApplyAll,
  onReject,
  onRejectAll,
  onClose,
  height = 'auto',
  showHeader = true,
  compact = false
}) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 使用外部传入的变更或 Redux 状态
  const reduxChanges = useAppSelector(selectPendingChanges)
  const changes = externalChanges || reduxChanges

  // 展开状态
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 按状态分组
  const groupedChanges = useMemo(() => {
    const pending = changes.filter((c) => c.status === 'pending')
    const applied = changes.filter((c) => c.status === 'applied')
    const rejected = changes.filter((c) => c.status === 'rejected')
    return { pending, applied, rejected }
  }, [changes])

  // 切换展开状态
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 应用单个变更
  const handleApply = useCallback(
    async (id: string) => {
      if (onApply) {
        await onApply(id)
      } else {
        // 默认行为：更新 Redux 状态
        const change = changes.find((c) => c.id === id)
        if (change && window.api?.canvas) {
          try {
            const fileName = change.fileName
            const createResult = (await window.api.canvas.createFile(fileName)) as {
              success: boolean
              data?: { path: string }
              error?: string
            }

            if (createResult?.success || createResult?.error === 'File already exists') {
              const filePath = createResult?.data?.path || fileName
              const saveResult = (await window.api.canvas.saveFile({
                path: filePath,
                content: change.newContent
              })) as { success: boolean }

              if (saveResult?.success) {
                dispatch(updatePendingChangeStatus({ id, status: 'applied' }))
                logger.info('Applied change:', { id, filePath })
              }
            }
          } catch (error) {
            logger.error('Failed to apply change:', error instanceof Error ? error : new Error(String(error)))
          }
        }
      }
    },
    [onApply, changes, dispatch]
  )

  // 拒绝单个变更
  const handleReject = useCallback(
    (id: string) => {
      if (onReject) {
        onReject(id)
      } else {
        dispatch(updatePendingChangeStatus({ id, status: 'rejected' }))
      }
    },
    [onReject, dispatch]
  )

  // 应用所有待处理变更
  const handleApplyAll = useCallback(async () => {
    if (onApplyAll) {
      await onApplyAll()
    } else {
      for (const change of groupedChanges.pending) {
        await handleApply(change.id)
      }
    }
  }, [onApplyAll, groupedChanges.pending, handleApply])

  // 拒绝所有待处理变更
  const handleRejectAll = useCallback(() => {
    if (onRejectAll) {
      onRejectAll()
    } else {
      for (const change of groupedChanges.pending) {
        dispatch(updatePendingChangeStatus({ id: change.id, status: 'rejected' }))
      }
    }
  }, [onRejectAll, groupedChanges.pending, dispatch])

  // 清除所有变更
  const handleClearAll = useCallback(() => {
    dispatch(clearPendingChanges())
  }, [dispatch])

  // 关闭面板
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    } else {
      dispatch(setShowPendingChangesPreview(false))
    }
  }, [onClose, dispatch])

  // 无变更时显示空状态
  if (changes.length === 0) {
    return (
      <Container style={{ height }}>
        {showHeader && (
          <Header>
            <HeaderTitle>
              <DiffOutlined />
              <span>{t('canvas.pending.title', '待处理变更')}</span>
            </HeaderTitle>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
          </Header>
        )}
        <EmptyState>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('canvas.pending.empty', '暂无待处理的变更')} />
        </EmptyState>
      </Container>
    )
  }

  return (
    <Container style={{ height }}>
      {showHeader && (
        <Header>
          <HeaderTitle>
            <DiffOutlined />
            <span>{t('canvas.pending.title', '待处理变更')}</span>
            <Badge count={groupedChanges.pending.length} style={{ marginLeft: 8 }} />
          </HeaderTitle>
          <Space>
            {groupedChanges.pending.length > 0 && (
              <>
                <Tooltip title={t('canvas.pending.applyAll', '全部应用')}>
                  <Button type="primary" size="small" icon={<CheckOutlined />} onClick={handleApplyAll}>
                    {t('canvas.pending.applyAll', '全部应用')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('canvas.pending.rejectAll', '全部拒绝')}>
                  <Button size="small" icon={<CloseOutlined />} onClick={handleRejectAll}>
                    {t('canvas.pending.rejectAll', '全部拒绝')}
                  </Button>
                </Tooltip>
              </>
            )}
            <Tooltip title={t('canvas.pending.clear', '清除记录')}>
              <Button type="text" size="small" icon={<UndoOutlined />} onClick={handleClearAll} />
            </Tooltip>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
          </Space>
        </Header>
      )}

      <Content>
        {/* 待处理的变更 */}
        {groupedChanges.pending.length > 0 && (
          <Section>
            <SectionTitle>
              <Text strong>{t('canvas.pending.pendingChanges', '待处理')}</Text>
              <Text type="secondary">({groupedChanges.pending.length})</Text>
            </SectionTitle>
            <ChangeList>
              {groupedChanges.pending.map((change) => (
                <ChangeItem
                  key={change.id}
                  change={change}
                  expanded={expandedIds.has(change.id)}
                  onToggle={() => toggleExpand(change.id)}
                  onApply={() => handleApply(change.id)}
                  onReject={() => handleReject(change.id)}
                  compact={compact}
                />
              ))}
            </ChangeList>
          </Section>
        )}

        {/* 已应用的变更 */}
        {groupedChanges.applied.length > 0 && (
          <Collapse
            ghost
            items={[
              {
                key: 'applied',
                label: (
                  <SectionTitle>
                    <Text type="success">{t('canvas.pending.appliedChanges', '已应用')}</Text>
                    <Text type="secondary">({groupedChanges.applied.length})</Text>
                  </SectionTitle>
                ),
                children: (
                  <ChangeList>
                    {groupedChanges.applied.map((change) => (
                      <ChangeItem
                        key={change.id}
                        change={change}
                        expanded={expandedIds.has(change.id)}
                        onToggle={() => toggleExpand(change.id)}
                        onApply={() => Promise.resolve()}
                        onReject={() => dispatch(removePendingChange(change.id))}
                        compact={compact}
                      />
                    ))}
                  </ChangeList>
                )
              }
            ]}
          />
        )}

        {/* 已拒绝的变更 */}
        {groupedChanges.rejected.length > 0 && (
          <Collapse
            ghost
            items={[
              {
                key: 'rejected',
                label: (
                  <SectionTitle>
                    <Text type="secondary">{t('canvas.pending.rejectedChanges', '已拒绝')}</Text>
                    <Text type="secondary">({groupedChanges.rejected.length})</Text>
                  </SectionTitle>
                ),
                children: (
                  <ChangeList>
                    {groupedChanges.rejected.map((change) => (
                      <ChangeItem
                        key={change.id}
                        change={change}
                        expanded={expandedIds.has(change.id)}
                        onToggle={() => toggleExpand(change.id)}
                        onApply={() => handleApply(change.id)}
                        onReject={() => dispatch(removePendingChange(change.id))}
                        compact={compact}
                      />
                    ))}
                  </ChangeList>
                )
              }
            ]}
          />
        )}
      </Content>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
`

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`

const Section = styled.div`
  margin-bottom: 16px;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
`

const ChangeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const ChangeItemContainer = styled.div<{ $status: string; $changeType?: 'add' | 'modify' | 'delete' }>`
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  background: ${(props) =>
    props.$status === 'applied'
      ? 'rgba(82, 196, 26, 0.06)'
      : props.$status === 'rejected'
        ? 'rgba(0, 0, 0, 0.02)'
        : 'var(--color-background)'};
  opacity: ${(props) => (props.$status === 'rejected' ? 0.6 : 1)};
  transition: all 0.2s;

  /* Theia-style left border indicator based on change type */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${(props) => {
      if (props.$status === 'rejected') return 'var(--color-text-4)'
      if (props.$status === 'applied') return '#52c41a'
      switch (props.$changeType) {
        case 'add':
          return '#52c41a' // Green for new files
        case 'delete':
          return '#ff4d4f' // Red for deleted files
        case 'modify':
          return '#fa8c16' // Orange for modified files
        default:
          return 'var(--color-border)'
      }
    }};
    border-radius: 6px 0 0 6px;
  }

  &:hover {
    border-color: var(--ant-color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const ChangeItemHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px 8px 16px; /* Extra left padding for the indicator */
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--color-background-soft);
  }
`

const ExpandIcon = styled.span`
  color: var(--color-text-3);
  margin-right: 8px;
  font-size: 10px;
`

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`

const FileName = styled.span<{ $status: string }>`
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: ${(props) => (props.$status === 'rejected' ? 'var(--color-text-3)' : 'var(--color-text-1)')};
  text-decoration: ${(props) => (props.$status === 'rejected' ? 'line-through' : 'none')};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ChangeStats = styled.div`
  display: flex;
  gap: 8px;
  margin-right: 12px;
`

const StatItem = styled.span<{ $type: 'addition' | 'deletion' }>`
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: ${(props) => (props.$type === 'addition' ? '#52c41a' : '#ff4d4f')};
`

const StatusBadge = styled.div`
  margin-right: 8px;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 4px;
`

const ActionButton = styled.button<{ $type: 'apply' | 'reject' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(props) => (props.$type === 'apply' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)')};
  color: ${(props) => (props.$type === 'apply' ? '#52c41a' : '#ff4d4f')};

  &:hover:not(:disabled) {
    background: ${(props) => (props.$type === 'apply' ? '#52c41a' : '#ff4d4f')};
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ChangeItemBody = styled.div`
  padding: 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-background-soft);
`

const DescriptionText = styled.div`
  margin-bottom: 12px;
  padding: 8px;
  background: var(--color-background);
  border-radius: 4px;
`

const DiffPreview = styled.div`
  margin-bottom: 12px;
`

const FilePathText = styled.div`
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-3);
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  flex: 1;
`

export default PendingChangesPreview
