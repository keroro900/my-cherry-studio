/**
 * WorkspaceSelector - 工作区选择器组件
 *
 * 提供 Claude Code 风格的工作目录选择和管理界面
 */

import {
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  GitlabOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { Badge, Button, Dropdown, Empty, Space, Spin, Tag, Tooltip, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SandboxManager } from '../sandbox'
import type { FileTreeNode, ProjectType, WorkspaceInfo } from '../sandbox/types'

const { Text } = Typography

// ==================== 类型定义 ====================

interface Props {
  onWorkspaceChange?: (workspace: WorkspaceInfo | null) => void
  compact?: boolean
}

// ==================== 辅助函数 ====================

const getProjectTypeIcon = (type: ProjectType): React.ReactNode => {
  const icons: Record<ProjectType, string> = {
    nodejs: '📦',
    typescript: '🔷',
    react: '⚛️',
    vue: '💚',
    python: '🐍',
    rust: '🦀',
    go: '🐹',
    java: '☕',
    unknown: '📁'
  }
  return icons[type] || icons.unknown
}

const getProjectTypeLabel = (type: ProjectType): string => {
  const labels: Record<ProjectType, string> = {
    nodejs: 'Node.js',
    typescript: 'TypeScript',
    react: 'React',
    vue: 'Vue',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    unknown: '未知'
  }
  return labels[type] || labels.unknown
}

const convertToTreeData = (nodes: FileTreeNode[]): DataNode[] => {
  return nodes.map((node) => ({
    key: node.path,
    title: node.name,
    icon: node.type === 'directory' ? <FolderOutlined /> : <CodeOutlined />,
    isLeaf: node.type === 'file',
    children: node.children ? convertToTreeData(node.children) : undefined
  }))
}

// ==================== 主组件 ====================

const WorkspaceSelector: FC<Props> = ({ onWorkspaceChange, compact = false }) => {
  const { t } = useTranslation()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [treeExpanded, setTreeExpanded] = useState<string[]>([])

  // 初始化
  useEffect(() => {
    const current = SandboxManager.getCurrentWorkspace()
    if (current) {
      setWorkspace(current)
      loadFileTree()
    }
  }, [])

  // 加载文件树
  const loadFileTree = useCallback(async () => {
    setLoading(true)
    try {
      const tree = await SandboxManager.getFileTree(3)
      setFileTree(tree)
      // 默认展开第一层
      if (tree.length > 0) {
        setTreeExpanded([tree[0].path])
      }
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 选择工作目录
  const handleSelectWorkspace = useCallback(async () => {
    setLoading(true)
    try {
      const path = await SandboxManager.selectWorkspace()
      if (path) {
        const newWorkspace = SandboxManager.getCurrentWorkspace()
        setWorkspace(newWorkspace)
        onWorkspaceChange?.(newWorkspace)
        await loadFileTree()
      }
    } catch (error) {
      console.error('Failed to select workspace:', error)
    } finally {
      setLoading(false)
    }
  }, [onWorkspaceChange, loadFileTree])

  // 设置最近的工作区
  const handleSetRecentWorkspace = useCallback(
    async (path: string) => {
      setLoading(true)
      try {
        await SandboxManager.setWorkspace(path)
        const newWorkspace = SandboxManager.getCurrentWorkspace()
        setWorkspace(newWorkspace)
        onWorkspaceChange?.(newWorkspace)
        await loadFileTree()
      } catch (error) {
        console.error('Failed to set workspace:', error)
      } finally {
        setLoading(false)
      }
    },
    [onWorkspaceChange, loadFileTree]
  )

  // 清除工作区
  const handleClearWorkspace = useCallback(() => {
    SandboxManager.clearWorkspace()
    setWorkspace(null)
    setFileTree([])
    onWorkspaceChange?.(null)
  }, [onWorkspaceChange])

  // 刷新
  const handleRefresh = useCallback(async () => {
    if (workspace) {
      await SandboxManager.setWorkspace(workspace.path)
      setWorkspace(SandboxManager.getCurrentWorkspace())
      await loadFileTree()
    }
  }, [workspace, loadFileTree])

  // 最近工作区菜单
  const recentWorkspaces = SandboxManager.getRecentWorkspaces()
  const recentMenu = useMemo(
    () => ({
      items: recentWorkspaces.map((path) => ({
        key: path,
        label: path.split(/[\\/]/).pop() || path,
        icon: <FolderOutlined />,
        onClick: () => handleSetRecentWorkspace(path)
      }))
    }),
    [recentWorkspaces, handleSetRecentWorkspace]
  )

  // 树数据
  const treeData = useMemo(() => convertToTreeData(fileTree), [fileTree])

  // 紧凑模式
  if (compact) {
    return (
      <CompactContainer>
        {workspace ? (
          <Dropdown menu={recentMenu} trigger={['click']}>
            <WorkspaceButton type="text">
              <Space>
                {getProjectTypeIcon(workspace.projectType || 'unknown')}
                <Text strong ellipsis style={{ maxWidth: 120 }}>
                  {workspace.name}
                </Text>
                {workspace.isGitRepo && (
                  <Tag color="purple" style={{ marginRight: 0, fontSize: 10 }}>
                    <GitlabOutlined /> {workspace.gitInfo?.branch}
                  </Tag>
                )}
                <DownOutlined style={{ fontSize: 10 }} />
              </Space>
            </WorkspaceButton>
          </Dropdown>
        ) : (
          <Button
            type="dashed"
            icon={<FolderOpenOutlined />}
            onClick={handleSelectWorkspace}
            loading={loading}
            size="small">
            {t('crew.workspace.select', '选择工作目录')}
          </Button>
        )}
      </CompactContainer>
    )
  }

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <Space>
          <FolderOpenOutlined />
          <Text strong>{t('crew.workspace.title', '工作区')}</Text>
        </Space>
        <Space size={4}>
          {workspace && (
            <>
              <Tooltip title={t('crew.workspace.refresh', '刷新')}>
                <Button type="text" size="small" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} />
              </Tooltip>
              <Tooltip title={t('crew.workspace.clear', '清除')}>
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={handleClearWorkspace} danger />
              </Tooltip>
            </>
          )}
        </Space>
      </Header>

      {/* 工作区信息 */}
      {workspace ? (
        <WorkspaceInfoSection>
          <WorkspaceInfoRow>
            <Space>
              {getProjectTypeIcon(workspace.projectType || 'unknown')}
              <Text strong>{workspace.name}</Text>
            </Space>
            <Tag color="blue">{getProjectTypeLabel(workspace.projectType || 'unknown')}</Tag>
          </WorkspaceInfoRow>

          <WorkspacePath type="secondary" ellipsis>
            {workspace.path}
          </WorkspacePath>

          {workspace.isGitRepo && workspace.gitInfo && (
            <GitInfoRow>
              <Space size={4}>
                <GitlabOutlined />
                <Tag color="purple">{workspace.gitInfo.branch}</Tag>
                {workspace.gitInfo.isDirty && (
                  <Badge status="warning" text={`${workspace.gitInfo.uncommittedChanges} 个未提交`} />
                )}
              </Space>
            </GitInfoRow>
          )}

          {workspace.packageManager && <PackageManagerTag>📦 {workspace.packageManager}</PackageManagerTag>}
        </WorkspaceInfoSection>
      ) : (
        <EmptySection>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crew.workspace.noWorkspace', '未选择工作目录')}>
            <Button type="primary" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace} loading={loading}>
              {t('crew.workspace.selectFolder', '选择文件夹')}
            </Button>
          </Empty>
        </EmptySection>
      )}

      {/* 最近工作区 */}
      {!workspace && recentWorkspaces.length > 0 && (
        <RecentSection>
          <SectionTitle>
            <ClockCircleOutlined />
            <Text type="secondary">{t('crew.workspace.recent', '最近')}</Text>
          </SectionTitle>
          <RecentList>
            {recentWorkspaces.slice(0, 5).map((path) => (
              <RecentItem key={path} onClick={() => handleSetRecentWorkspace(path)}>
                <FolderOutlined />
                <Text ellipsis>{path.split(/[\\/]/).pop()}</Text>
              </RecentItem>
            ))}
          </RecentList>
        </RecentSection>
      )}

      {/* 文件树 */}
      {workspace && (
        <FileTreeSection>
          <SectionTitle>
            <FolderOutlined />
            <Text type="secondary">{t('crew.workspace.files', '文件')}</Text>
          </SectionTitle>
          {loading ? (
            <LoadingContainer>
              <Spin size="small" />
            </LoadingContainer>
          ) : treeData.length > 0 ? (
            <Tree
              treeData={treeData}
              expandedKeys={treeExpanded}
              onExpand={(keys) => setTreeExpanded(keys as string[])}
              showIcon
              height={300}
              virtual
            />
          ) : (
            <Text type="secondary">{t('crew.workspace.noFiles', '无文件')}</Text>
          )}
        </FileTreeSection>
      )}
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius-lg);
  overflow: hidden;
`

const CompactContainer = styled.div`
  display: flex;
  align-items: center;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const WorkspaceInfoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
`

const WorkspaceInfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const WorkspacePath = styled(Text)`
  font-size: 11px;
  font-family: monospace;
`

const GitInfoRow = styled.div`
  display: flex;
  align-items: center;
`

const PackageManagerTag = styled.span`
  font-size: 11px;
  color: var(--ant-color-text-secondary);
`

const EmptySection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
`

const RecentSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
`

const RecentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const RecentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--ant-border-radius);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--ant-color-bg-elevated);
  }
`

const FileTreeSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  overflow: hidden;

  .ant-tree {
    background: transparent;
  }
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 24px;
`

const WorkspaceButton = styled(Button)`
  padding: 4px 8px;
  height: auto;
  border: 1px solid var(--ant-color-border);
  border-radius: var(--ant-border-radius);

  &:hover {
    border-color: var(--ant-color-primary);
  }
`

export default WorkspaceSelector
