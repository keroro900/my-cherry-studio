/**
 * ContextPicker - 上下文选择器组件
 *
 * 参考 Theia ContextVariablePicker 设计，支持：
 * - 选择文件/文件夹作为上下文
 * - 拖拽文件添加
 * - 上下文元素 Pills 显示
 * - 验证文件有效性
 */

import { FileOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Dropdown, message, Tag, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useRef } from 'react'
import styled from 'styled-components'

import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addContextElement,
  removeContextElement,
  selectContextElements,
  type ContextElement
} from '@renderer/store/canvas'

const { Text } = Typography

const logger = loggerService.withContext('ContextPicker')

interface ContextPickerProps {
  /** 额外的类名 */
  className?: string
  /** 最大显示数量 */
  maxDisplay?: number
  /** 是否紧凑模式 */
  compact?: boolean
}

/**
 * 上下文选择器组件
 */
const ContextPicker: FC<ContextPickerProps> = ({ className, maxDisplay = 5, compact = false }) => {
  const dispatch = useAppDispatch()
  const contextElements = useAppSelector(selectContextElements)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // 选择文件
  const handleSelectFile = useCallback(async () => {
    try {
      if (!window.api?.file) {
        message.warning('文件 API 未就绪')
        return
      }

      const files = await window.api.file.select({
        properties: ['openFile', 'multiSelections']
      })
      if (files && files.length > 0) {
        for (const file of files) {
          dispatch(
            addContextElement({
              type: 'file',
              uri: file.path,
              label: file.name,
              isValid: true
            })
          )
        }
        message.success(`已添加 ${files.length} 个文件`)
      }
    } catch (error) {
      logger.error('Failed to select file:', error instanceof Error ? error : new Error(String(error)))
      message.error('选择文件失败')
    }
  }, [dispatch])

  // 选择文件夹
  const handleSelectFolder = useCallback(async () => {
    try {
      if (!window.api?.file) {
        message.warning('文件 API 未就绪')
        return
      }

      const folder = await window.api.file.selectFolder()
      if (folder) {
        const folderName = folder.split('/').pop() || folder.split('\\').pop() || folder
        dispatch(
          addContextElement({
            type: 'folder',
            uri: folder,
            label: folderName,
            isValid: true
          })
        )
        message.success(`已添加文件夹: ${folderName}`)
      }
    } catch (error) {
      logger.error('Failed to select folder:', error instanceof Error ? error : new Error(String(error)))
      message.error('选择文件夹失败')
    }
  }, [dispatch])

  // 移除上下文元素
  const handleRemove = useCallback(
    (id: string) => {
      dispatch(removeContextElement(id))
    },
    [dispatch]
  )

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('drag-over')
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drag-over')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove('drag-over')
      }

      const files = e.dataTransfer.files
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          // 使用 File API 获取路径（Electron 环境）
          const filePath = (file as File & { path?: string }).path || file.name
          dispatch(
            addContextElement({
              type: 'file',
              uri: filePath,
              label: file.name,
              isValid: true
            })
          )
        }
        message.success(`已添加 ${files.length} 个文件`)
      }
    },
    [dispatch]
  )

  // 获取图标
  const getIcon = (element: ContextElement) => {
    switch (element.type) {
      case 'file':
        return <FileOutlined />
      case 'folder':
        return <FolderOutlined />
      case 'memory':
        return <span>🧠</span>
      case 'selection':
        return <span>📝</span>
      default:
        return <FileOutlined />
    }
  }

  // 添加按钮菜单
  const addMenuItems = [
    {
      key: 'file',
      icon: <FileOutlined />,
      label: '添加文件',
      onClick: handleSelectFile
    },
    {
      key: 'folder',
      icon: <FolderOpenOutlined />,
      label: '添加文件夹',
      onClick: handleSelectFolder
    }
  ]

  // 显示的元素
  const displayElements = contextElements.slice(0, maxDisplay)
  const moreCount = contextElements.length - maxDisplay

  return (
    <Container
      className={className}
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      $compact={compact}>
      {/* 添加按钮 */}
      <Dropdown menu={{ items: addMenuItems }} trigger={['click']}>
        <AddButton type="text" size="small" icon={<PlusOutlined />}>
          {!compact && '添加上下文'}
        </AddButton>
      </Dropdown>

      {/* 上下文元素列表 */}
      {displayElements.length > 0 && (
        <ElementsList>
          {displayElements.map((element) => (
            <ContextPill
              key={element.id}
              $valid={element.isValid}
              closable
              onClose={() => handleRemove(element.id)}
              icon={getIcon(element)}>
              <Tooltip title={element.uri}>
                <span>{element.label}</span>
              </Tooltip>
            </ContextPill>
          ))}

          {moreCount > 0 && <MoreTag>+{moreCount} 更多</MoreTag>}
        </ElementsList>
      )}

      {/* 空状态提示 */}
      {contextElements.length === 0 && !compact && <HintText>拖拽文件或点击添加</HintText>}
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: ${(props) => (props.$compact ? '4px' : '8px 12px')};
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px dashed var(--color-border);
  transition: all 0.2s;
  flex-wrap: wrap;

  &.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-bg);
  }
`

const AddButton = styled(Button)`
  flex-shrink: 0;
`

const ElementsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`

const ContextPill = styled(Tag)<{ $valid?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: ${(props) => (props.$valid ? 'var(--color-background)' : 'var(--color-error-bg)')};
  border-color: ${(props) => (props.$valid ? 'var(--color-border)' : 'var(--color-error)')};
  color: ${(props) => (props.$valid ? 'var(--color-text-1)' : 'var(--color-error)')};

  .ant-tag-close-icon {
    margin-left: 4px;
  }

  span {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const MoreTag = styled(Tag)`
  background: var(--color-background-mute);
  border-color: var(--color-border);
  cursor: pointer;
  font-size: 11px;

  &:hover {
    background: var(--color-background-soft);
  }
`

const HintText = styled(Text)`
  color: var(--color-text-3);
  font-size: 12px;
`

export default ContextPicker
