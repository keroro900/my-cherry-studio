/**
 * 版本历史组件
 *
 * 显示项目的所有版本，支持版本切换和回滚
 */

import { RollbackOutlined, EyeOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectCurrentProject,
  setCurrentVersion,
  rollbackToVersion
} from '@renderer/store/imageStudio'
import { Tooltip, message } from 'antd'
import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'
import type { FC } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { ImageVersion } from '../../types'

interface VersionHistoryProps {
  maxHeight?: number
}

const VersionHistory: FC<VersionHistoryProps> = ({ maxHeight = 300 }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const currentProject = useAppSelector(selectCurrentProject)

  const handleSelectVersion = useCallback(
    (versionId: string) => {
      if (!currentProject) return
      dispatch(setCurrentVersion({ projectId: currentProject.id, versionId }))
    },
    [dispatch, currentProject]
  )

  const handleRollback = useCallback(
    (versionId: string) => {
      if (!currentProject) return

      const version = currentProject.versions.find((v) => v.id === versionId)
      if (!version) return

      dispatch(rollbackToVersion({ projectId: currentProject.id, versionId }))
      message.success(t('image_studio.version.rollback_success', { version: version.versionNumber }))
    },
    [dispatch, currentProject, t]
  )

  const getStatusIcon = (status: ImageVersion['status']) => {
    switch (status) {
      case 'generating':
        return <Loader2 size={14} className="spin" />
      case 'success':
        return <CheckCircle size={14} color="var(--color-success)" />
      case 'error':
        return <XCircle size={14} color="var(--color-error)" />
      default:
        return <Clock size={14} color="var(--color-text-3)" />
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  if (!currentProject || currentProject.versions.length === 0) {
    return (
      <EmptyContainer>
        <EmptyText>{t('image_studio.gallery.empty_versions')}</EmptyText>
      </EmptyContainer>
    )
  }

  // 按版本号倒序排列
  const sortedVersions = [...currentProject.versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  )

  return (
    <Container $maxHeight={maxHeight}>
      {sortedVersions.map((version, index) => {
        const isActive = version.id === currentProject.currentVersionId
        const isLatest = index === 0
        const canRollback = !isLatest && version.status === 'success'

        return (
          <VersionItem
            key={version.id}
            $active={isActive}
            $status={version.status}
            onClick={() => handleSelectVersion(version.id)}
          >
            <VersionMain>
              <VersionHeader>
                <VersionNumber $active={isActive}>
                  v{version.versionNumber}
                  {isLatest && <LatestTag>Latest</LatestTag>}
                </VersionNumber>
                <VersionStatus>{getStatusIcon(version.status)}</VersionStatus>
              </VersionHeader>

              <VersionMeta>
                <MetaItem>
                  <Clock size={12} />
                  <span>{formatTime(version.createdAt)}</span>
                </MetaItem>
                {version.mask && (
                  <EditTag>{t('image_studio.task.type.local_edit')}</EditTag>
                )}
              </VersionMeta>
            </VersionMain>

            <VersionActions onClick={(e) => e.stopPropagation()}>
              <Tooltip title={t('image_studio.version.view')}>
                <ActionButton onClick={() => handleSelectVersion(version.id)}>
                  <EyeOutlined />
                </ActionButton>
              </Tooltip>
              {canRollback && (
                <Tooltip title={t('image_studio.version.rollback')}>
                  <ActionButton onClick={() => handleRollback(version.id)}>
                    <RollbackOutlined />
                  </ActionButton>
                </Tooltip>
              )}
            </VersionActions>
          </VersionItem>
        )
      })}
    </Container>
  )
}

export default VersionHistory

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div<{ $maxHeight: number }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: ${(props) => props.$maxHeight}px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const EmptyContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
`

const EmptyText = styled.span`
  font-size: 13px;
  color: var(--color-text-3);
`

const VersionItem = styled.div<{ $active: boolean; $status: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  background-color: ${(props) =>
    props.$active ? 'var(--color-primary-soft)' : 'var(--color-background-soft)'};
  border: 1px solid
    ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background-color: ${(props) =>
      props.$active
        ? 'var(--color-primary-soft)'
        : 'var(--color-background-mute)'};
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const VersionMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
`

const VersionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const VersionNumber = styled.span<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${(props) =>
    props.$active ? 'var(--color-primary)' : 'var(--color-text-1)'};
`

const LatestTag = styled.span`
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-white);
  background: var(--color-primary);
  border-radius: 4px;
`

const VersionStatus = styled.div`
  display: flex;
  align-items: center;
`

const VersionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-3);
`

const EditTag = styled.span`
  padding: 1px 4px;
  font-size: 10px;
  color: var(--color-info);
  background: var(--color-info-bg, rgba(22, 119, 255, 0.1));
  border-radius: 3px;
`

const VersionActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  ${VersionItem}:hover & {
    opacity: 1;
  }
`

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-2);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
`
