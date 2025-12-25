/**
 * 图像输入节点配置表单 - Cherry 风格
 *
 * 重构版本：
 * - 支持两种输入模式：文件夹路径 / 拖拽上传
 * - 一个文件夹路径对应一个输出端口
 * - 按键添加新路径
 * - 支持拖拽排序调整端口顺序
 * - 支持匹配模式选择（按名称/按顺序/混合）
 * - 支持直接拖拽图片文件上传
 */

import {
  DeleteOutlined,
  EyeOutlined,
  FileImageOutlined,
  InboxOutlined,
  PlusOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Alert, Button, Image, message, Modal, Select, Space, Tabs, Tag, Tooltip } from 'antd'
import { memo, useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import type { ImageMatchMode, NodeHandle, WorkflowDataType } from '../../types'
import { generateImageBatches } from '../../utils/imageBatchMatcher'
import FolderPathInput, { type FolderPathItem, type ImageFileInfo } from './FolderPathInput'
import { FormNumber, FormRow, FormSection } from './FormComponents'

const logger = loggerService.withContext('ImageInputConfigForm')

// ==================== 类型定义 ====================

interface ImageInputConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
  onOutputsChange?: (outputs: NodeHandle[]) => void
}

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

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  margin-top: 16px;
`

const ImageCard = styled.div`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ant-color-bg-elevated);
  border: 1px solid var(--ant-color-border);
  aspect-ratio: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .delete-btn {
    opacity: 1;
  }
`

const ImageName = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

// ==================== 工具函数 ====================

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'].includes(ext)
}

const getBaseName = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

// ==================== 匹配模式选项 ====================

const MATCH_MODE_OPTIONS = [
  {
    value: 'byOrder',
    label: '📊 按顺序匹配',
    description: '不同文件夹的第 N 张图片组成一组'
  },
  {
    value: 'byName',
    label: '📛 按名称匹配',
    description: '文件名（不含扩展名）相同的图片组成一组'
  },
  {
    value: 'hybrid',
    label: '🔀 混合模式',
    description: '优先按名称匹配，无匹配时按顺序'
  }
]

function ImageInputConfigForm({ config, onUpdateConfig, onOutputsChange }: ImageInputConfigFormProps) {
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(config.inputMode || 'folder')

  // 拖拽上传的图片列表
  const uploadedImages: ImageFileInfo[] = config.uploadedImages || []

  // 处理文件夹路径变化
  const handleFolderPathsChange = useCallback(
    (paths: FolderPathItem[]) => {
      onUpdateConfig('folderPaths', paths)

      // 同时通知输出端口变化
      if (onOutputsChange) {
        const outputs: NodeHandle[] = paths.map((path, index) => ({
          id: `folder_${index + 1}`,
          label: path.label || `文件夹 ${index + 1}`,
          dataType: 'images' as WorkflowDataType
        }))
        // 添加总列表输出
        if (paths.length > 0) {
          outputs.push({
            id: 'all_images',
            label: '全部图片',
            dataType: 'images' as WorkflowDataType
          })
        }
        onOutputsChange(outputs)
      }
    },
    [onUpdateConfig, onOutputsChange]
  )

  // 处理拖拽上传图片变化 - 更新输出端口
  // 每张图片对应一个独立输出端口 (图1, 图2, 图3...)
  const updateUploadedImagesOutput = useCallback(
    (images: ImageFileInfo[]) => {
      if (onOutputsChange && activeTab === 'upload') {
        if (images.length > 0) {
          // 每张图片创建一个独立输出端口
          const outputs: NodeHandle[] = images.map((img, index) => ({
            id: `image_${index + 1}`,
            label: img.name || `图 ${index + 1}`,
            dataType: 'image' as WorkflowDataType
          }))
          // 添加全部图片列表输出
          outputs.push({
            id: 'all_images',
            label: '全部图片',
            dataType: 'images' as WorkflowDataType
          })
          onOutputsChange(outputs)
        } else {
          onOutputsChange([])
        }
      }
    },
    [onOutputsChange, activeTab]
  )

  // 处理拖拽进入
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  // 处理拖拽放下
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((file) => isImageFile(file.name))

      if (imageFiles.length === 0) {
        message.warning('请拖拽图片文件（支持 jpg, png, gif, webp 等格式）')
        return
      }

      // 使用 Electron 的 getPathForFile API 获取文件路径
      const newImages: ImageFileInfo[] = []
      for (const file of imageFiles) {
        const filePath = window.api?.file?.getPathForFile?.(file)
        if (filePath) {
          newImages.push({
            name: file.name,
            path: filePath.replace(/\\/g, '/'),
            baseName: getBaseName(file.name),
            size: file.size
          })
        }
      }

      if (newImages.length > 0) {
        const updatedImages = [...uploadedImages, ...newImages]
        onUpdateConfig('uploadedImages', updatedImages)
        updateUploadedImagesOutput(updatedImages)
        message.success(`已添加 ${newImages.length} 张图片`)
      }
    },
    [uploadedImages, onUpdateConfig, updateUploadedImagesOutput]
  )

  // 通过文件选择器添加图片
  const handleSelectImages = useCallback(async () => {
    try {
      const files = await window.api?.file?.select?.({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'] }]
      })

      if (files && files.length > 0) {
        const newImages: ImageFileInfo[] = files.map((file: any) => ({
          name: file.name || file.path.split('/').pop() || file.path.split('\\').pop(),
          path: (file.path || file).replace(/\\/g, '/'),
          baseName: getBaseName(file.name || file.path.split('/').pop() || ''),
          size: file.size
        }))

        const updatedImages = [...uploadedImages, ...newImages]
        onUpdateConfig('uploadedImages', updatedImages)
        updateUploadedImagesOutput(updatedImages)
        message.success(`已添加 ${newImages.length} 张图片`)
      }
    } catch (error) {
      logger.error('选择文件失败', { error })
    }
  }, [uploadedImages, onUpdateConfig, updateUploadedImagesOutput])

  // 删除单张上传的图片
  const handleRemoveImage = useCallback(
    (index: number) => {
      const updatedImages = uploadedImages.filter((_, i) => i !== index)
      onUpdateConfig('uploadedImages', updatedImages)
      updateUploadedImagesOutput(updatedImages)
    },
    [uploadedImages, onUpdateConfig, updateUploadedImagesOutput]
  )

  // 清空所有上传的图片
  const handleClearImages = useCallback(() => {
    onUpdateConfig('uploadedImages', [])
    updateUploadedImagesOutput([])
    message.success('已清空所有图片')
  }, [onUpdateConfig, updateUploadedImagesOutput])

  // Tab 切换时更新输入模式
  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key)
      onUpdateConfig('inputMode', key)

      // 切换 Tab 时更新输出端口
      if (key === 'upload') {
        updateUploadedImagesOutput(uploadedImages)
      } else {
        // 文件夹模式 - 重新计算输出端口
        const paths = config.folderPaths || []
        if (onOutputsChange) {
          const outputs: NodeHandle[] = paths.map((path: FolderPathItem, index: number) => ({
            id: `folder_${index + 1}`,
            label: path.label || `文件夹 ${index + 1}`,
            dataType: 'images' as WorkflowDataType
          }))
          if (paths.length > 0) {
            outputs.push({
              id: 'all_images',
              label: '全部图片',
              dataType: 'images' as WorkflowDataType
            })
          }
          onOutputsChange(outputs)
        }
      }
    },
    [onUpdateConfig, uploadedImages, config.folderPaths, onOutputsChange, updateUploadedImagesOutput]
  )

  // 当前匹配模式
  const matchMode: ImageMatchMode = config.matchMode || 'byOrder'
  const folderPaths: FolderPathItem[] = config.folderPaths || []

  // 计算批量匹配预览
  const batchResult = useMemo(() => {
    if (folderPaths.length === 0) return null
    const validFolders = folderPaths.filter((f) => f.status === 'valid' && f.images && f.images.length > 0)
    if (validFolders.length === 0) return null
    return generateImageBatches(validFolders, matchMode)
  }, [folderPaths, matchMode])

  return (
    <div>
      {/* 输入模式选择 */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'folder',
            label: (
              <span>
                <FileImageOutlined /> 文件夹路径
              </span>
            ),
            children: (
              <>
                <FormSection title="文件夹路径管理">
                  {/* 文件夹路径输入 */}
                  <FormRow label="📁 文件夹路径列表" description="每个路径对应一个独立的输出端口">
                    <FolderPathInput
                      value={folderPaths}
                      onChange={handleFolderPathsChange}
                      maxPaths={config.maxPaths || 10}
                    />
                  </FormRow>

                  {/* 最大路径数 */}
                  <FormRow label="🔢 最大路径数" description="限制可添加的最大文件夹数量 (1-20)">
                    <FormNumber
                      value={config.maxPaths || 10}
                      onChange={(value) => onUpdateConfig('maxPaths', value)}
                      min={1}
                      max={20}
                      placeholder="最多 20 个"
                    />
                  </FormRow>
                </FormSection>

                <FormSection title="批量处理设置">
                  {/* 匹配模式选择 */}
                  <FormRow label="🎯 图片匹配模式" description="多文件夹时如何将图片组合成批次">
                    <Select
                      value={matchMode}
                      onChange={(value) => onUpdateConfig('matchMode', value)}
                      style={{ width: '100%' }}
                      optionLabelProp="label">
                      {MATCH_MODE_OPTIONS.map((option) => (
                        <Select.Option key={option.value} value={option.value} label={option.label}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{option.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                              {option.description}
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </FormRow>

                  {/* 匹配模式说明 */}
                  <div
                    style={{
                      padding: '12px',
                      background: 'var(--ant-color-primary-bg)',
                      borderRadius: '6px',
                      marginTop: '8px'
                    }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
                      {matchMode === 'byOrder' && '📊 按顺序匹配说明'}
                      {matchMode === 'byName' && '📛 按名称匹配说明'}
                      {matchMode === 'hybrid' && '🔀 混合模式说明'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)' }}>
                      {matchMode === 'byOrder' && (
                        <>
                          <div>• 文件夹A的第1张 + 文件夹B的第1张 = 第1批</div>
                          <div>• 文件夹A的第2张 + 文件夹B的第2张 = 第2批</div>
                          <div>• 以此类推，直到最少图片数的文件夹用完</div>
                          <div style={{ marginTop: 4, color: 'var(--ant-color-warning)' }}>
                            ⚠️ 各文件夹图片数量不同时，以最少的为准
                          </div>
                        </>
                      )}
                      {matchMode === 'byName' && (
                        <>
                          <div>• 文件名（不含扩展名）相同的图片组成一组</div>
                          <div>• 例如: A/001.jpg + B/001.png → 同一批次</div>
                          <div>• 例如: A/front.jpg + B/front.webp → 同一批次</div>
                          <div style={{ marginTop: 4, color: 'var(--ant-color-warning)' }}>
                            ⚠️ 只有所有文件夹都有同名文件时才会组成批次
                          </div>
                        </>
                      )}
                      {matchMode === 'hybrid' && (
                        <>
                          <div>• 先尝试按文件名匹配</div>
                          <div>• 找不到同名文件时，按顺序补位</div>
                          <div>• 灵活处理部分命名、部分无命名的场景</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 批量预览 */}
                  {batchResult && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'var(--color-background)',
                        borderRadius: '6px',
                        border: '1px solid var(--ant-color-border)'
                      }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8
                        }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>
                          <ThunderboltOutlined style={{ marginRight: 6, color: 'var(--ant-color-warning)' }} />
                          批量预览
                        </span>
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => setPreviewModalVisible(true)}>
                          查看详情
                        </Button>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <Space wrap>
                          <Tag color="blue">共 {batchResult.stats.totalBatches} 个批次</Tag>
                          {batchResult.stats.unmatchedCount > 0 && (
                            <Tag color="orange">{batchResult.stats.unmatchedCount} 张未匹配</Tag>
                          )}
                        </Space>
                      </div>
                      {batchResult.warnings.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ant-color-warning)' }}>
                          {batchResult.warnings[0]}
                        </div>
                      )}
                    </div>
                  )}
                </FormSection>
              </>
            )
          },
          {
            key: 'upload',
            label: (
              <span>
                <InboxOutlined /> 拖拽上传
              </span>
            ),
            children: (
              <FormSection title="图片拖拽上传">
                {/* 拖拽区域 */}
                <DropZone
                  $isDragOver={isDragOver}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleSelectImages}>
                  <InboxOutlined style={{ fontSize: 48, color: 'var(--ant-color-primary)', marginBottom: 16 }} />
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>拖拽图片到这里，或点击选择文件</div>
                  <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)' }}>
                    支持 jpg, png, gif, webp 等格式，可多选
                  </div>
                </DropZone>

                {/* 已上传图片列表 */}
                {uploadedImages.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 16,
                        marginBottom: 8
                      }}>
                      <span style={{ fontWeight: 500 }}>已添加 {uploadedImages.length} 张图片</span>
                      <Space>
                        <Button size="small" icon={<PlusOutlined />} onClick={handleSelectImages}>
                          继续添加
                        </Button>
                        <Button size="small" danger onClick={handleClearImages}>
                          清空全部
                        </Button>
                      </Space>
                    </div>

                    <Image.PreviewGroup
                      items={uploadedImages.map((img) => ({ src: `file://${img.path}` }))}
                      preview={{
                        countRender: (current, total) => `${current} / ${total}`
                      }}>
                      <ImageGrid>
                        {uploadedImages.map((image, index) => (
                          <ImageCard key={`${image.path}-${index}`}>
                            <Image
                              src={`file://${image.path}`}
                              alt={image.name}
                              loading="lazy"
                              preview={{ mask: <span style={{ fontSize: 12 }}>🔍 放大</span> }}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <ImageName title={image.name}>{image.name}</ImageName>
                            <Tooltip title="删除">
                              <Button
                                className="delete-btn"
                                type="primary"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveImage(index)
                                }}
                                style={{ padding: '2px 6px' }}
                              />
                            </Tooltip>
                          </ImageCard>
                        ))}
                      </ImageGrid>
                    </Image.PreviewGroup>
                  </>
                )}

                {/* 使用说明 */}
                <Alert
                  message="💡 拖拽上传模式"
                  description={
                    <div>
                      <div>• 直接拖拽图片文件到上方区域</div>
                      <div>• 支持一次拖拽多张图片</div>
                      <div>• 也可以点击区域使用文件选择器</div>
                      <div>• 所有图片将作为一个列表输出</div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </FormSection>
            )
          }
        ]}
      />

      {/* 批量预览弹窗 */}
      <Modal
        title="📋 批量匹配预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={700}>
        {batchResult && (
          <div>
            {/* 统计信息 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 16
              }}>
              <div
                style={{
                  padding: 12,
                  background: 'var(--ant-color-primary-bg)',
                  borderRadius: 6,
                  textAlign: 'center'
                }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-primary)' }}>
                  {batchResult.stats.totalBatches}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>批次数量</div>
              </div>
              <div
                style={{
                  padding: 12,
                  background: 'var(--ant-color-success-bg)',
                  borderRadius: 6,
                  textAlign: 'center'
                }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--ant-color-success)' }}>
                  {batchResult.stats.folderCounts.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>文件夹数</div>
              </div>
              <div
                style={{
                  padding: 12,
                  background:
                    batchResult.stats.unmatchedCount > 0
                      ? 'var(--ant-color-warning-bg)'
                      : 'var(--ant-color-bg-elevated)',
                  borderRadius: 6,
                  textAlign: 'center'
                }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color:
                      batchResult.stats.unmatchedCount > 0
                        ? 'var(--ant-color-warning)'
                        : 'var(--ant-color-text-tertiary)'
                  }}>
                  {batchResult.stats.unmatchedCount}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>未匹配</div>
              </div>
            </div>

            {/* 警告信息 */}
            {batchResult.warnings.length > 0 && (
              <Alert type="warning" message={batchResult.warnings.join('\n')} style={{ marginBottom: 16 }} />
            )}

            {/* 批次列表 */}
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--ant-color-bg-elevated)' }}>
                    <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--ant-color-border)' }}>
                      批次
                    </th>
                    <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--ant-color-border)' }}>
                      匹配键
                    </th>
                    {batchResult.stats.folderCounts.map((fc) => (
                      <th
                        key={fc.folderId}
                        style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--ant-color-border)' }}>
                        {fc.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batchResult.batches.slice(0, 50).map((batch) => (
                    <tr key={batch.index}>
                      <td style={{ padding: 8, borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
                        <Tag color="blue">{batch.index + 1}</Tag>
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
                        <code>{batch.matchKey}</code>
                      </td>
                      {batch.images.map((img) => (
                        <td
                          key={img.folderId}
                          style={{ padding: 8, borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
                          <span title={img.image.path}>{img.image.name}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {batchResult.batches.length > 50 && (
                <div style={{ textAlign: 'center', padding: 12, color: 'var(--ant-color-text-tertiary)' }}>
                  ...还有 {batchResult.batches.length - 50} 个批次
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default memo(ImageInputConfigForm)
