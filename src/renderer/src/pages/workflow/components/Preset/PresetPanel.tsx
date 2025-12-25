/**
 * 节点配置预设面板
 * 用于管理和加载节点配置预设
 */

import { CopyOutlined, DeleteOutlined, EditOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import type { NodePreset } from '@renderer/pages/workflow/types'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addPreset, removePreset, updatePreset } from '@renderer/store/workflow'
import { Button, Card, Empty, Input, message, Modal, Space, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'

interface PresetPanelProps {
  selectedNodeId: string | null
  onApplyPreset: (preset: NodePreset) => void
}

/**
 * 预设卡片组件
 */
const PresetCard: FC<{
  preset: NodePreset
  onApply: () => void
  onEdit: () => void
  onDelete: () => void
}> = ({ preset, onApply, onEdit, onDelete }) => {
  return (
    <Card
      size="small"
      title={preset.name}
      extra={
        <Space size="small">
          <Tooltip title="应用预设">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={onApply} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
          </Tooltip>
        </Space>
      }
      style={{ marginBottom: 12 }}>
      {preset.description && (
        <p style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)', marginBottom: 8 }}>{preset.description}</p>
      )}
      <Space wrap size="small">
        <Tag color="blue">{preset.nodeType}</Tag>
        {preset.tags?.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </Space>
      <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', marginTop: 8 }}>
        {new Date(preset.updatedAt).toLocaleString()}
      </div>
    </Card>
  )
}

const PresetPanel: FC<PresetPanelProps> = ({ selectedNodeId, onApplyPreset }) => {
  const dispatch = useAppDispatch()
  const [searchQuery, setSearchQuery] = useState('')
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [editingPreset, setEditingPreset] = useState<NodePreset | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')
  const [presetTags, setPresetTags] = useState('')

  // 从 store 获取预设数据
  const allPresets = useAppSelector((state) => state.workflow.presets)
  const presets: NodePreset[] = useMemo(() => Object.values(allPresets), [allPresets])

  // 获取当前选中节点
  const selectedNode = useAppSelector((state) => state.workflow.nodes.find((n) => n.id === selectedNodeId))

  // 过滤预设
  const filteredPresets = useMemo(() => {
    if (!searchQuery) return presets

    const query = searchQuery.toLowerCase()
    return presets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(query) ||
        preset.description?.toLowerCase().includes(query) ||
        preset.nodeType.toLowerCase().includes(query) ||
        preset.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [presets, searchQuery])

  // 保存当前节点配置为预设
  const handleSavePreset = useCallback(() => {
    if (!selectedNode) {
      message.warning('请先选择一个节点')
      return
    }

    setPresetName(`${selectedNode.data.label} 配置`)
    setPresetDescription('')
    setPresetTags('')
    setSaveModalVisible(true)
  }, [selectedNode])

  // 确认保存预设
  const handleConfirmSave = useCallback(() => {
    if (!selectedNode || !presetName.trim()) {
      message.error('预设名称不能为空')
      return
    }

    if (editingPreset) {
      // 更新现有预设
      dispatch(
        updatePreset({
          id: editingPreset.id,
          name: presetName,
          description: presetDescription || undefined,
          config: selectedNode.data.config,
          tags: presetTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        })
      )
      message.success('预设更新成功')
    } else {
      // 添加新预设
      dispatch(
        addPreset({
          name: presetName,
          nodeType: selectedNode.data.nodeType,
          config: selectedNode.data.config,
          description: presetDescription || undefined,
          tags: presetTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        })
      )
      message.success('预设保存成功')
    }

    setSaveModalVisible(false)
    setEditingPreset(null)
    setPresetName('')
    setPresetDescription('')
    setPresetTags('')
  }, [selectedNode, presetName, presetDescription, presetTags, editingPreset, dispatch])

  // 应用预设
  const handleApplyPreset = useCallback(
    (preset: NodePreset) => {
      if (!selectedNode) {
        message.warning('请先选择一个节点')
        return
      }

      if (selectedNode.data.nodeType !== preset.nodeType) {
        message.error(`预设类型 (${preset.nodeType}) 与节点类型 (${selectedNode.data.nodeType}) 不匹配`)
        return
      }

      onApplyPreset(preset)
      message.success(`已应用预设: ${preset.name}`)
    },
    [selectedNode, onApplyPreset]
  )

  // 编辑预设
  const handleEditPreset = useCallback((preset: NodePreset) => {
    setEditingPreset(preset)
    setPresetName(preset.name)
    setPresetDescription(preset.description || '')
    setPresetTags(preset.tags?.join(', ') || '')
    setSaveModalVisible(true)
  }, [])

  // 删除预设
  const handleDeletePreset = useCallback(
    (presetId: string) => {
      window.modal.confirm({
        title: '确认删除',
        content: '确定要删除这个预设吗？此操作不可恢复。',
        onOk: () => {
          dispatch(removePreset(presetId))
          message.success('预设已删除')
        }
      })
    },
    [dispatch]
  )

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索栏和保存按钮 */}
      <Space direction="vertical" size="middle" style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索预设..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
        <Button type="primary" icon={<SaveOutlined />} block onClick={handleSavePreset} disabled={!selectedNode}>
          保存当前节点配置为预设
        </Button>
      </Space>

      {/* 预设列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredPresets.length === 0 ? (
          <Empty description={searchQuery ? '没有找到匹配的预设' : '暂无预设配置'} style={{ marginTop: 60 }} />
        ) : (
          filteredPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onApply={() => handleApplyPreset(preset)}
              onEdit={() => handleEditPreset(preset)}
              onDelete={() => handleDeletePreset(preset.id)}
            />
          ))
        )}
      </div>

      {/* 保存/编辑预设对话框 */}
      <Modal
        title={editingPreset ? '编辑预设' : '保存预设'}
        open={saveModalVisible}
        onOk={handleConfirmSave}
        onCancel={() => {
          setSaveModalVisible(false)
          setEditingPreset(null)
          setPresetName('')
          setPresetDescription('')
          setPresetTags('')
        }}
        okText="保存"
        cancelText="取消">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>预设名称 *</label>
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="输入预设名称" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>描述</label>
            <Input.TextArea
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="输入描述（可选）"
              rows={3}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>标签</label>
            <Input
              value={presetTags}
              onChange={(e) => setPresetTags(e.target.value)}
              placeholder="输入标签，用逗号分隔（可选）"
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default PresetPanel
