/**
 * 通用文件输入节点配置表单
 * 支持多种文件类型：视频、音频、文档等
 *
 * 特性：
 * - 可配置支持的文件类型
 * - 拖拽上传
 * - 每个文件对应一个独立输出端口
 */

import {
  AudioOutlined,
  DeleteOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Checkbox, message, Space, Tag, Tooltip } from 'antd'
import { memo, useCallback, useState } from 'react'
import styled from 'styled-components'

import type { NodeHandle, WorkflowDataType } from '../../types'
import { FormRow, FormSection } from './FormComponents'

const logger = loggerService.withContext('FileInputConfigForm')

// ==================== 类型定义 ====================

interface FileInfo {
  name: string
  path: string
  size?: number
  type: string // 文件类型：video, audio, document, other
  extension: string
}

interface FileInputConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
  onOutputsChange?: (outputs: NodeHandle[]) => void
}

// ==================== 文件类型配置 ====================

const FILE_TYPE_OPTIONS = [
  {
    value: 'video',
    label: '视频文件',
    icon: <VideoCameraOutlined />,
    extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv']
  },
  {
    value: 'audio',
    label: '音频文件',
    icon: <AudioOutlined />,
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma']
  },
  {
    value: 'document',
    label: '文档文件',
    icon: <FileTextOutlined />,
    extensions: ['txt', 'md', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts']
  },
  {
    value: 'pdf',
    label: 'PDF 文件',
    icon: <FilePdfOutlined />,
    extensions: ['pdf']
  },
  {
    value: 'other',
    label: '其他文件',
    icon: <FileOutlined />,
    extensions: ['*']
  }
]

// ==================== 样式组件 ====================

const DropZone = styled.div<{ $isDragOver: boolean }>`
  border: 2px dashed ${({ $isDragOver }) => ($isDragOver ? 'var(--ant-color-primary)' : 'var(--ant-color-border)')};
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ $isDragOver }) => ($isDragOver ? 'var(--ant-color-primary-bg)' : 'var(--color-background)')};

  &:hover {
    border-color: var(--ant-color-primary);
    background: var(--ant-color-primary-bg);
  }
`

const FileList = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FileItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--ant-color-bg-elevated);
  border: 1px solid var(--ant-color-border);
  border-radius: 6px;
  gap: 8px;

  .file-icon {
    font-size: 20px;
    color: var(--ant-color-primary);
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    font-size: 11px;
    color: var(--ant-color-text-tertiary);
  }
`

// ==================== 工具函数 ====================

const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().split('.').pop() || ''
}

const getFileType = (extension: string, allowedTypes: string[]): string => {
  for (const typeConfig of FILE_TYPE_OPTIONS) {
    if (allowedTypes.includes(typeConfig.value) && typeConfig.extensions.includes(extension)) {
      return typeConfig.value
    }
  }
  return 'other'
}

const getFileIcon = (type: string) => {
  const config = FILE_TYPE_OPTIONS.find((t) => t.value === type)
  return config?.icon || <FileOutlined />
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isFileAllowed = (extension: string, allowedTypes: string[]): boolean => {
  for (const typeConfig of FILE_TYPE_OPTIONS) {
    if (allowedTypes.includes(typeConfig.value)) {
      if (typeConfig.extensions.includes('*') || typeConfig.extensions.includes(extension)) {
        return true
      }
    }
  }
  return false
}

// ==================== 主组件 ====================

function FileInputConfigForm({ config, onUpdateConfig, onOutputsChange }: FileInputConfigFormProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  // 配置
  const allowedTypes: string[] = config.allowedTypes || ['video', 'audio', 'document']
  const files: FileInfo[] = config.files || []

  // 更新输出端口
  const updateOutputs = useCallback(
    (newFiles: FileInfo[]) => {
      if (onOutputsChange) {
        if (newFiles.length > 0) {
          const outputs: NodeHandle[] = newFiles.map((file, index) => ({
            id: `file_${index + 1}`,
            label: `文件 ${index + 1}`,
            dataType: (file.type === 'video' ? 'video' : 'any') as WorkflowDataType
          }))
          // 添加全部文件列表输出
          outputs.push({
            id: 'all_files',
            label: '全部文件',
            dataType: 'any' as WorkflowDataType
          })
          onOutputsChange(outputs)
        } else {
          onOutputsChange([{ id: 'file', label: '文件', dataType: 'any' as WorkflowDataType }])
        }
      }
    },
    [onOutputsChange]
  )

  // 处理拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      const newFiles: FileInfo[] = []

      for (const file of droppedFiles) {
        const extension = getFileExtension(file.name)

        if (!isFileAllowed(extension, allowedTypes)) {
          message.warning(`不支持的文件类型: ${file.name}`)
          continue
        }

        const filePath = window.api?.file?.getPathForFile?.(file)
        if (filePath) {
          newFiles.push({
            name: file.name,
            path: filePath.replace(/\\/g, '/'),
            size: file.size,
            type: getFileType(extension, allowedTypes),
            extension
          })
        }
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...files, ...newFiles]
        onUpdateConfig('files', updatedFiles)
        updateOutputs(updatedFiles)
        message.success(`已添加 ${newFiles.length} 个文件`)
      }
    },
    [files, allowedTypes, onUpdateConfig, updateOutputs]
  )

  // 选择文件
  const handleSelectFiles = useCallback(async () => {
    try {
      // 构建文件过滤器
      const extensions: string[] = []
      for (const typeConfig of FILE_TYPE_OPTIONS) {
        if (allowedTypes.includes(typeConfig.value) && !typeConfig.extensions.includes('*')) {
          extensions.push(...typeConfig.extensions)
        }
      }

      const selectedFiles = await window.api?.file?.select?.({
        properties: ['openFile', 'multiSelections'],
        filters: extensions.length > 0 ? [{ name: '支持的文件', extensions }] : undefined
      })

      if (selectedFiles && selectedFiles.length > 0) {
        const newFiles: FileInfo[] = selectedFiles.map((file: any) => {
          const filePath = file.path || file
          const fileName = file.name || filePath.split('/').pop() || filePath.split('\\').pop()
          const extension = getFileExtension(fileName)
          return {
            name: fileName,
            path: filePath.replace(/\\/g, '/'),
            size: file.size,
            type: getFileType(extension, allowedTypes),
            extension
          }
        })

        const updatedFiles = [...files, ...newFiles]
        onUpdateConfig('files', updatedFiles)
        updateOutputs(updatedFiles)
        message.success(`已添加 ${newFiles.length} 个文件`)
      }
    } catch (error) {
      logger.error('选择文件失败', { error })
    }
  }, [files, allowedTypes, onUpdateConfig, updateOutputs])

  // 删除文件
  const handleRemoveFile = useCallback(
    (index: number) => {
      const updatedFiles = files.filter((_, i) => i !== index)
      onUpdateConfig('files', updatedFiles)
      updateOutputs(updatedFiles)
    },
    [files, onUpdateConfig, updateOutputs]
  )

  // 清空所有文件
  const handleClearFiles = useCallback(() => {
    onUpdateConfig('files', [])
    updateOutputs([])
    message.success('已清空所有文件')
  }, [onUpdateConfig, updateOutputs])

  // 更新允许的文件类型
  const handleTypesChange = useCallback(
    (types: string[]) => {
      onUpdateConfig('allowedTypes', types)
    },
    [onUpdateConfig]
  )

  return (
    <div>
      <FormSection title="文件类型设置">
        <FormRow label="允许的文件类型" description="选择此节点支持的文件类型">
          <Checkbox.Group
            value={allowedTypes}
            onChange={handleTypesChange}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FILE_TYPE_OPTIONS.map((option) => (
              <Checkbox key={option.value} value={option.value}>
                <Space>
                  {option.icon}
                  <span>{option.label}</span>
                  <Tag style={{ fontSize: 10 }}>{option.extensions.slice(0, 3).join(', ')}...</Tag>
                </Space>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </FormRow>
      </FormSection>

      <FormSection title="文件上传">
        {/* 拖拽区域 */}
        <DropZone
          $isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleSelectFiles}>
          <InboxOutlined style={{ fontSize: 48, color: 'var(--ant-color-primary)', marginBottom: 16 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>拖拽文件到这里，或点击选择</div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)' }}>
            支持 {allowedTypes.map((t) => FILE_TYPE_OPTIONS.find((o) => o.value === t)?.label).join(', ')}
          </div>
        </DropZone>

        {/* 已添加的文件列表 */}
        {files.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16,
                marginBottom: 8
              }}>
              <span style={{ fontWeight: 500 }}>已添加 {files.length} 个文件</span>
              <Space>
                <Button size="small" icon={<PlusOutlined />} onClick={handleSelectFiles}>
                  继续添加
                </Button>
                <Button size="small" danger onClick={handleClearFiles}>
                  清空全部
                </Button>
              </Space>
            </div>

            <FileList>
              {files.map((file, index) => (
                <FileItem key={`${file.path}-${index}`}>
                  <span className="file-icon">{getFileIcon(file.type)}</span>
                  <div className="file-info">
                    <div className="file-name" title={file.name}>
                      {file.name}
                    </div>
                    <div className="file-meta">
                      <Tag color="blue" style={{ marginRight: 4, fontSize: 10 }}>
                        输出: 文件 {index + 1}
                      </Tag>
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFile(index)}
                    />
                  </Tooltip>
                </FileItem>
              ))}
            </FileList>
          </>
        )}
      </FormSection>
    </div>
  )
}

export default memo(FileInputConfigForm)
