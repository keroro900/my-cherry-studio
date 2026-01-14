/**
 * FileExplorer - 文件浏览器组件
 *
 * 左侧面板的文件树组件，支持：
 * - 文件/文件夹显示
 * - 选择工作目录
 * - 拖拽文件作为上下文
 */

import {
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Empty, Input, message, Modal, Space, Tree, Typography } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import { useAppDispatch } from '@renderer/store'
import { addContextElement, addEditorTab } from '@renderer/store/canvas'
import type { NotesTreeNode } from '@renderer/types'

const { Text } = Typography
const { DirectoryTree } = Tree

const logger = loggerService.withContext('FileExplorer')

interface FileExplorerProps {
  /** 工作目录 */
  workingDirectory?: string
  /** 选择文件回调 */
  onSelectFile?: (path: string) => void
  /** 选择文件夹回调 */
  onSelectFolder?: (path: string) => void
  /** 刷新触发器，当值变化时刷新文件列表 */
  refreshTrigger?: number
}

interface FileTreeNode extends DataNode {
  path: string
  isDirectory: boolean
}

/**
 * 将 NotesTreeNode 转换为 FileTreeNode
 */
function convertToFileTreeNode(node: NotesTreeNode): FileTreeNode {
  return {
    key: node.externalPath,
    title: node.name,
    path: node.externalPath,
    isDirectory: node.type === 'folder',
    icon: node.type === 'folder' ? <FolderOutlined /> : getFileIcon(node.name),
    isLeaf: node.type !== 'folder',
    children: node.children?.map(convertToFileTreeNode)
  }
}

/**
 * 获取文件图标
 */
function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileTextOutlined style={{ color: '#3178c6' }} />
    case 'json':
      return <FileTextOutlined style={{ color: '#cbcb41' }} />
    case 'md':
      return <FileTextOutlined style={{ color: '#519aba' }} />
    case 'css':
    case 'scss':
    case 'less':
      return <FileTextOutlined style={{ color: '#563d7c' }} />
    case 'html':
      return <FileTextOutlined style={{ color: '#e34c26' }} />
    case 'py':
      return <FileTextOutlined style={{ color: '#3572A5' }} />
    default:
      return <FileOutlined />
  }
}

/**
 * 文件浏览器组件
 */
const FileExplorer: FC<FileExplorerProps> = ({ workingDirectory, onSelectFile, onSelectFolder, refreshTrigger }) => {
  const dispatch = useAppDispatch()

  const [currentDir, setCurrentDir] = useState<string>(workingDirectory || '')
  const [treeData, setTreeData] = useState<FileTreeNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  // 新建文件对话框
  const [newFileModalVisible, setNewFileModalVisible] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  // 加载目录内容
  const loadDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath) return

    try {
      // 使用 window.api.file.getDirectoryStructureGeneric 读取目录（支持所有文件类型）
      if (!window.api?.file) {
        logger.warn('File API not available')
        return
      }

      // 使用通用版本，不限制文件扩展名
      const nodes = await window.api.file.getDirectoryStructureGeneric(dirPath, {
        includeFiles: true,
        includeDirectories: true,
        fileExtensions: [], // 空数组表示不过滤，显示所有文件
        ignoreHiddenFiles: true,
        recursive: true,
        maxDepth: 3
      })
      if (!nodes) return

      // 转换为 FileTreeNode 格式
      const treeNodes: FileTreeNode[] = nodes
        .filter((node: NotesTreeNode) => !node.name.startsWith('.'))
        .sort((a: NotesTreeNode, b: NotesTreeNode) => {
          // 文件夹优先
          if (a.type === 'folder' && b.type !== 'folder') return -1
          if (a.type !== 'folder' && b.type === 'folder') return 1
          return a.name.localeCompare(b.name)
        })
        .map(convertToFileTreeNode)

      setTreeData(treeNodes)
    } catch (error) {
      logger.error('Failed to load directory:', error instanceof Error ? error : new Error(String(error)))
    }
  }, [])

  // 选择工作目录
  const handleSelectFolder = useCallback(async () => {
    try {
      if (!window.api?.file) {
        message.warning('文件 API 未就绪')
        return
      }
      const result = await window.api.file.selectFolder()
      if (result) {
        setCurrentDir(result)
        onSelectFolder?.(result)
        loadDirectory(result)
      }
    } catch (error) {
      logger.error('Failed to select folder:', error instanceof Error ? error : new Error(String(error)))
      message.error('选择文件夹失败')
    }
  }, [loadDirectory, onSelectFolder])

  // 处理树节点选择
  const handleSelect: TreeProps['onSelect'] = useCallback(
    (_selectedKeys, info) => {
      const node = info.node as unknown as FileTreeNode
      if (!node.isDirectory) {
        // 打开文件
        dispatch(
          addEditorTab({
            filePath: node.path,
            fileName: node.title as string,
            isDirty: false
          })
        )
        onSelectFile?.(node.path)
      }
    },
    [dispatch, onSelectFile]
  )

  // 处理树节点展开
  const handleExpand: TreeProps['onExpand'] = useCallback((keys) => {
    setExpandedKeys(keys)
  }, [])

  // 添加文件/文件夹到上下文
  const handleAddToContext = useCallback(
    (node: FileTreeNode) => {
      dispatch(
        addContextElement({
          type: node.isDirectory ? 'folder' : 'file',
          uri: node.path,
          label: node.title as string,
          isValid: true
        })
      )
      message.success(`已添加到上下文: ${node.title}`)
    },
    [dispatch]
  )

  // 创建新文件
  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim() || !currentDir) {
      message.warning('请输入文件名')
      return
    }

    try {
      if (!window.api?.canvas) {
        message.warning('Canvas API 未就绪')
        return
      }

      const filePath = `${currentDir}/${newFileName.trim()}`
      const result = await window.api.canvas.createFile(filePath)
      if (result?.success) {
        setNewFileModalVisible(false)
        setNewFileName('')
        loadDirectory(currentDir)
        message.success('创建成功')
      }
    } catch (error) {
      logger.error('Failed to create file:', error instanceof Error ? error : new Error(String(error)))
      message.error('创建文件失败')
    }
  }, [newFileName, currentDir, loadDirectory])

  // 初始化加载
  useEffect(() => {
    if (workingDirectory) {
      loadDirectory(workingDirectory)
    }
  }, [workingDirectory, loadDirectory])

  // 外部触发刷新
  useEffect(() => {
    if (refreshTrigger && currentDir) {
      loadDirectory(currentDir)
    }
  }, [refreshTrigger, currentDir, loadDirectory])

  // 右键菜单渲染
  const titleRender = useCallback(
    (node: DataNode) => {
      const treeNode = node as FileTreeNode
      return (
        <TreeNodeTitle
          onContextMenu={(e) => {
            e.preventDefault()
            // 可以添加右键菜单逻辑
          }}
          onDoubleClick={() => {
            if (!treeNode.isDirectory) {
              handleAddToContext(treeNode)
            }
          }}>
          {treeNode.title as string}
        </TreeNodeTitle>
      )
    },
    [handleAddToContext]
  )

  return (
    <Container>
      {/* 工具栏 */}
      <Toolbar>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={handleSelectFolder}
            title="选择文件夹"
          />
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setNewFileModalVisible(true)}
            disabled={!currentDir}
            title="新建文件"
          />
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => loadDirectory(currentDir)}
            disabled={!currentDir}
            title="刷新"
          />
        </Space>
      </Toolbar>

      {/* 当前目录 */}
      {currentDir && (
        <CurrentPath>
          <Text ellipsis title={currentDir}>
            {currentDir.split('/').pop() || currentDir.split('\\').pop()}
          </Text>
        </CurrentPath>
      )}

      {/* 文件树 */}
      <TreeContainer>
        {currentDir ? (
          treeData.length > 0 ? (
            <DirectoryTree
              treeData={treeData}
              onSelect={handleSelect}
              onExpand={handleExpand}
              expandedKeys={expandedKeys}
              titleRender={titleRender}
              showIcon
              blockNode
            />
          ) : (
            <Empty description="空目录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )
        ) : (
          <EmptyState>
            <FolderOpenOutlined style={{ fontSize: 32, color: 'var(--color-text-3)' }} />
            <Text type="secondary">选择一个文件夹开始</Text>
            <Button type="primary" size="small" icon={<FolderOpenOutlined />} onClick={handleSelectFolder}>
              选择文件夹
            </Button>
          </EmptyState>
        )}
      </TreeContainer>

      {/* 新建文件对话框 */}
      <Modal
        title="新建文件"
        open={newFileModalVisible}
        onOk={handleCreateFile}
        onCancel={() => {
          setNewFileModalVisible(false)
          setNewFileName('')
        }}
        okText="创建"
        cancelText="取消">
        <Input
          placeholder="输入文件名 (例如: script.js, note.md)"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onPressEnter={handleCreateFile}
          autoFocus
        />
      </Modal>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const CurrentPath = styled.div`
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const TreeContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 4px;

  .ant-tree {
    background: transparent;
  }

  .ant-tree-node-content-wrapper {
    display: flex;
    align-items: center;
  }

  .ant-tree-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const TreeNodeTitle = styled.span`
  cursor: pointer;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 24px;
`

export default FileExplorer
