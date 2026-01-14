/**
 * GroupAgentSelector - Agent 选择器组件
 *
 * 用于选择要添加到群聊的 Assistants
 * 支持搜索、过滤和批量选择
 */

import { SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { Avatar, Button, Checkbox, Empty, Input, List, Modal, Space, Tag, Tooltip } from 'antd'
import React, { useCallback, useMemo, useState } from 'react'

import styles from './GroupAgentSelector.module.css'

/**
 * Assistant 类型
 */
export interface AssistantItem {
  id: string
  name: string
  prompt: string
  emoji?: string
  description?: string
  model?: { id: string }
  tags?: string[]
  enableMemory?: boolean
}

export interface GroupAgentSelectorProps {
  /** 是否显示 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 确认回调 */
  onConfirm: (selectedIds: string[]) => void
  /** 可用的 Assistants */
  assistants: AssistantItem[]
  /** 已选择的 IDs */
  selectedIds?: string[]
  /** 最大选择数量 */
  maxSelection?: number
  /** 标题 */
  title?: string
}

/**
 * Agent 选择器组件
 */
export const GroupAgentSelector: React.FC<GroupAgentSelectorProps> = ({
  open,
  onClose,
  onConfirm,
  assistants,
  selectedIds = [],
  maxSelection = 10,
  title = '选择参与者'
}) => {
  // 状态
  const [searchText, setSearchText] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds))
  const [activeTag, setActiveTag] = useState<string | null>(null)

  /**
   * 获取所有标签
   */
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    assistants.forEach((a) => {
      a.tags?.forEach((t) => tags.add(t))
    })
    return Array.from(tags)
  }, [assistants])

  /**
   * 过滤后的 Assistants
   */
  const filteredAssistants = useMemo(() => {
    let result = assistants

    // 搜索过滤
    if (searchText) {
      const lowerSearch = searchText.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(lowerSearch) ||
          a.description?.toLowerCase().includes(lowerSearch) ||
          a.tags?.some((t) => t.toLowerCase().includes(lowerSearch))
      )
    }

    // 标签过滤
    if (activeTag) {
      result = result.filter((a) => a.tags?.includes(activeTag))
    }

    return result
  }, [assistants, searchText, activeTag])

  /**
   * 切换选择
   */
  const toggleSelection = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(id)) {
          newSet.delete(id)
        } else if (newSet.size < maxSelection) {
          newSet.add(id)
        }
        return newSet
      })
    },
    [maxSelection]
  )

  /**
   * 全选/取消全选
   */
  const toggleAll = useCallback(() => {
    if (selected.size === filteredAssistants.length) {
      setSelected(new Set())
    } else {
      const newIds = filteredAssistants.slice(0, maxSelection).map((a) => a.id)
      setSelected(new Set(newIds))
    }
  }, [filteredAssistants, maxSelection, selected.size])

  /**
   * 确认选择
   */
  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selected))
    onClose()
  }, [selected, onConfirm, onClose])

  /**
   * 关闭时重置
   */
  const handleClose = useCallback(() => {
    setSearchText('')
    setActiveTag(null)
    setSelected(new Set(selectedIds))
    onClose()
  }, [selectedIds, onClose])

  /**
   * 渲染 Assistant 项
   */
  const renderAssistantItem = (assistant: AssistantItem) => {
    const isSelected = selected.has(assistant.id)
    const isDisabled = !isSelected && selected.size >= maxSelection

    return (
      <List.Item
        key={assistant.id}
        className={`${styles.listItem} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}
        onClick={() => !isDisabled && toggleSelection(assistant.id)}>
        <Checkbox checked={isSelected} disabled={isDisabled} />
        <Avatar className={styles.avatar}>{assistant.emoji || assistant.name[0]}</Avatar>
        <div className={styles.itemContent}>
          <div className={styles.itemName}>{assistant.name}</div>
          {assistant.description && <div className={styles.itemDesc}>{assistant.description}</div>}
          {assistant.tags && assistant.tags.length > 0 && (
            <div className={styles.itemTags}>
              {assistant.tags.slice(0, 3).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
        </div>
      </List.Item>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined />
          {title}
          <Tag color="blue">
            {selected.size}/{maxSelection}
          </Tag>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      onOk={handleConfirm}
      okText="确认添加"
      cancelText="取消"
      okButtonProps={{ disabled: selected.size === 0 }}
      width={600}
      className={styles.modal}>
      {/* 搜索和过滤 */}
      <div className={styles.searchSection}>
        <Input
          placeholder="搜索助手..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      {/* 标签过滤 */}
      {allTags.length > 0 && (
        <div className={styles.tagsSection}>
          <Tag
            color={activeTag === null ? 'blue' : 'default'}
            onClick={() => setActiveTag(null)}
            className={styles.tagFilter}>
            全部
          </Tag>
          {allTags.slice(0, 8).map((tag) => (
            <Tag
              key={tag}
              color={activeTag === tag ? 'blue' : 'default'}
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={styles.tagFilter}>
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* 操作栏 */}
      <div className={styles.actionsBar}>
        <Button type="link" size="small" onClick={toggleAll}>
          {selected.size === filteredAssistants.length ? '取消全选' : '全选'}
        </Button>
        <span className={styles.countText}>已选择 {selected.size} 个助手</span>
      </div>

      {/* 列表 */}
      <div className={styles.listContainer}>
        {filteredAssistants.length === 0 ? (
          <Empty description={searchText ? '未找到匹配的助手' : '暂无可用助手'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List dataSource={filteredAssistants} renderItem={renderAssistantItem} split={false} />
        )}
      </div>

      {/* 已选择预览 */}
      {selected.size > 0 && (
        <div className={styles.selectedPreview}>
          <span className={styles.previewLabel}>已选择：</span>
          <div className={styles.previewList}>
            {Array.from(selected).map((id) => {
              const assistant = assistants.find((a) => a.id === id)
              return assistant ? (
                <Tooltip key={id} title={assistant.name}>
                  <Avatar size="small" className={styles.previewAvatar}>
                    {assistant.emoji || assistant.name[0]}
                  </Avatar>
                </Tooltip>
              ) : null
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default GroupAgentSelector
