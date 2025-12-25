/**
 * PresetSelector - 统一的预设选择器组件
 *
 * 功能：
 * - 支持模态框形式选择预设
 * - 支持下拉框形式选择预设
 * - 统一的预设卡片样式（使用 PresetCard 组件）
 * - 支持预设分组和搜索
 *
 * @refactored Phase 1.1 - 移除重复的卡片样式，复用 PresetCard 组件
 */

import { SearchOutlined } from '@ant-design/icons'
import { Button, Input, Modal } from 'antd'
import type { FC } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import { FormSelect } from './FormComponents'
import PresetCard from './PresetCard'

// ==================== 类型定义 ====================

export interface PresetOption {
  /** 预设值 */
  value: string
  /** 显示标签 */
  label: string
  /** 预设描述 */
  description?: string
  /** 预设图标 */
  icon?: string
  /** 预设分组 */
  group?: string
  /** 预设标签 */
  tags?: string[]
}

export interface PresetSelectorProps {
  /** 当前选中值 */
  value: string
  /** 值变更回调 */
  onChange: (value: string) => void
  /** 预设选项 */
  options: PresetOption[]
  /** 选择器模式 */
  mode?: 'modal' | 'dropdown'
  /** 按钮文本（modal 模式） */
  buttonText?: string
  /** 模态框标题（modal 模式） */
  modalTitle?: string
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 是否显示分组 */
  showGroups?: boolean
  /** 占位文本 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
}

// ==================== 样式组件 ====================

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
`

const PresetIcon = styled.span`
  font-size: 20px;
  margin-right: 8px;
`

const SearchWrapper = styled.div`
  margin-bottom: 16px;
`

const GroupTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-mute);

  &:first-child {
    margin-top: 0;
  }
`

const CurrentSelection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-soft);
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
`

// ==================== 主组件 ====================

const PresetSelector: FC<PresetSelectorProps> = ({
  value,
  onChange,
  options,
  mode = 'dropdown',
  buttonText = '选择预设',
  modalTitle = '选择预设',
  showSearch = true,
  showGroups = false,
  placeholder = '请选择',
  disabled = false
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')

  // 获取当前选中的预设
  const selectedPreset = useMemo(() => options.find((opt) => opt.value === value), [options, value])

  // 过滤后的选项
  const filteredOptions = useMemo(() => {
    if (!searchText) return options
    const lower = searchText.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.description?.toLowerCase().includes(lower) ||
        opt.tags?.some((tag) => tag.toLowerCase().includes(lower))
    )
  }, [options, searchText])

  // 按分组组织选项
  const groupedOptions = useMemo(() => {
    if (!showGroups) return { '': filteredOptions }
    const groups: Record<string, PresetOption[]> = {}
    filteredOptions.forEach((opt) => {
      const group = opt.group || '其他'
      if (!groups[group]) groups[group] = []
      groups[group].push(opt)
    })
    return groups
  }, [filteredOptions, showGroups])

  // 处理选择
  const handleSelect = useCallback(
    (newValue: string) => {
      onChange(newValue)
      if (mode === 'modal') {
        setModalOpen(false)
      }
    },
    [onChange, mode]
  )

  // 下拉模式
  if (mode === 'dropdown') {
    return (
      <FormSelect
        value={value}
        onChange={onChange}
        options={options.map((opt) => ({
          label: opt.icon ? `${opt.icon} ${opt.label}` : opt.label,
          value: opt.value,
          description: opt.description
        }))}
        placeholder={placeholder}
        disabled={disabled}
      />
    )
  }

  // 模态框模式
  return (
    <>
      <Button type="default" onClick={() => setModalOpen(true)} disabled={disabled}>
        {selectedPreset ? (
          <span>
            {selectedPreset.icon && <PresetIcon>{selectedPreset.icon}</PresetIcon>}
            {selectedPreset.label}
          </span>
        ) : (
          buttonText
        )}
      </Button>

      <Modal
        open={modalOpen}
        title={modalTitle}
        width={700}
        footer={null}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden>
        {/* 当前选择 */}
        {selectedPreset && (
          <CurrentSelection>
            <span style={{ color: 'var(--color-text-3)' }}>当前选择:</span>
            {selectedPreset.icon && <PresetIcon>{selectedPreset.icon}</PresetIcon>}
            <span style={{ fontWeight: 500 }}>{selectedPreset.label}</span>
            {selectedPreset.description && (
              <span style={{ color: 'var(--color-text-3)' }}>- {selectedPreset.description}</span>
            )}
          </CurrentSelection>
        )}

        {/* 搜索框 */}
        {showSearch && (
          <SearchWrapper>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索预设..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </SearchWrapper>
        )}

        {/* 预设列表 */}
        {showGroups ? (
          // 分组显示
          Object.entries(groupedOptions).map(([group, opts]) => (
            <div key={group}>
              {group && <GroupTitle>{group}</GroupTitle>}
              <PresetGrid>
                {opts.map((opt) => (
                  <PresetCard
                    key={opt.value}
                    title={opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
                    description={opt.description}
                    tags={opt.tags?.map((tag) => ({ text: tag, color: 'blue' }))}
                    isSelected={opt.value === value}
                    onClick={() => handleSelect(opt.value)}
                  />
                ))}
              </PresetGrid>
            </div>
          ))
        ) : (
          // 平铺显示
          <PresetGrid>
            {filteredOptions.map((opt) => (
              <PresetCard
                key={opt.value}
                title={opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
                description={opt.description}
                tags={opt.tags?.map((tag) => ({ text: tag, color: 'blue' }))}
                isSelected={opt.value === value}
                onClick={() => handleSelect(opt.value)}
              />
            ))}
          </PresetGrid>
        )}

        {filteredOptions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--color-text-3)'
            }}>
            没有找到匹配的预设
          </div>
        )}
      </Modal>
    </>
  )
}

export default memo(PresetSelector)
