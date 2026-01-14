/**
 * MemoryContextPanel - 记忆上下文面板
 *
 * 显示 Crew 记忆检索结果，用于：
 * - 展示相关知识上下文
 * - 显示历史执行记录
 * - 提供记忆搜索功能
 */

import {
  BookOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Badge, Button, Empty, Input, List, Skeleton, Space, Tag, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useCrewMemory, type CrewMemoryContext } from '../../hooks/useCrewMemory'

const { Text, Paragraph } = Typography
const { Search } = Input

interface MemoryContextPanelProps {
  /** 项目路径 */
  projectPath?: string
  /** Agent 角色 */
  agentRole?: string
  /** 是否紧凑模式 */
  compact?: boolean
}

/**
 * 记忆上下文面板组件
 */
const MemoryContextPanel: FC<MemoryContextPanelProps> = ({ projectPath, agentRole, compact = false }) => {
  const { t } = useTranslation()
  const { loading, error, searchResults, searchProjectContext } = useCrewMemory()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // 处理搜索
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return

      await searchProjectContext({
        query: query.trim(),
        projectPath,
        agentRole,
        topK: 10,
        minScore: 0.3
      })
    },
    [searchProjectContext, projectPath, agentRole]
  )

  // 处理刷新
  const handleRefresh = useCallback(() => {
    if (searchQuery) {
      handleSearch(searchQuery)
    }
  }, [searchQuery, handleSearch])

  // 切换选择
  const toggleSelect = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 清除选择
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  // 获取类型图标
  const getTypeIcon = (type: CrewMemoryContext['type']) => {
    switch (type) {
      case 'code':
        return <CodeOutlined />
      case 'doc':
        return <FileTextOutlined />
      case 'requirement':
        return <BookOutlined />
      case 'solution':
        return <BulbOutlined />
      case 'error':
        return <ExclamationCircleOutlined />
      default:
        return <FileTextOutlined />
    }
  }

  // 获取类型颜色
  const getTypeColor = (type: CrewMemoryContext['type']) => {
    switch (type) {
      case 'code':
        return 'blue'
      case 'doc':
        return 'cyan'
      case 'requirement':
        return 'purple'
      case 'solution':
        return 'green'
      case 'error':
        return 'red'
      default:
        return 'default'
    }
  }

  // 获取类型标签
  const getTypeLabel = (type: CrewMemoryContext['type']) => {
    switch (type) {
      case 'code':
        return t('canvas.memory.type.code', '代码')
      case 'doc':
        return t('canvas.memory.type.doc', '文档')
      case 'requirement':
        return t('canvas.memory.type.requirement', '需求')
      case 'solution':
        return t('canvas.memory.type.solution', '方案')
      case 'error':
        return t('canvas.memory.type.error', '错误')
      default:
        return type
    }
  }

  // 渲染记忆项
  const renderMemoryItem = (item: CrewMemoryContext) => {
    const isSelected = selectedItems.has(item.id)

    return (
      <MemoryItem $selected={isSelected} $compact={compact} onClick={() => toggleSelect(item.id)}>
        <MemoryItemHeader>
          <Space size={4}>
            <Tag color={getTypeColor(item.type)} icon={getTypeIcon(item.type)}>
              {getTypeLabel(item.type)}
            </Tag>
            <RelevanceScore $score={item.relevanceScore}>{(item.relevanceScore * 100).toFixed(0)}%</RelevanceScore>
          </Space>
          {isSelected && (
            <Badge status="processing" text={t('canvas.memory.selected', '已选中')} style={{ fontSize: 12 }} />
          )}
        </MemoryItemHeader>

        <MemoryItemContent $compact={compact}>
          <Paragraph
            ellipsis={{ rows: compact ? 2 : 3, expandable: !compact, symbol: t('common.more', '更多') }}
            style={{ margin: 0 }}>
            {item.content}
          </Paragraph>
        </MemoryItemContent>

        {item.tags.length > 0 && (
          <MemoryItemTags>
            {item.tags.slice(0, compact ? 3 : 5).map((tag) => (
              <Tag key={tag} style={{ fontSize: 11 }}>
                {tag}
              </Tag>
            ))}
            {item.tags.length > (compact ? 3 : 5) && (
              <Tooltip title={item.tags.slice(compact ? 3 : 5).join(', ')}>
                <Tag style={{ fontSize: 11 }}>+{item.tags.length - (compact ? 3 : 5)}</Tag>
              </Tooltip>
            )}
          </MemoryItemTags>
        )}

        <MemoryItemSource>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {item.source === 'search' && t('canvas.memory.source.search', '搜索')}
            {item.source === 'context' && t('canvas.memory.source.context', '上下文')}
            {item.source === 'history' && t('canvas.memory.source.history', '历史')}
          </Text>
        </MemoryItemSource>
      </MemoryItem>
    )
  }

  return (
    <PanelContainer $compact={compact}>
      {/* 搜索栏 */}
      <SearchSection>
        <Search
          placeholder={t('canvas.memory.searchPlaceholder', '搜索项目知识...')}
          allowClear
          enterButton={<SearchOutlined />}
          size={compact ? 'small' : 'middle'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          loading={loading}
        />
        <ActionButtons>
          <Tooltip title={t('canvas.memory.refresh', '刷新')}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={handleRefresh}
              disabled={!searchQuery || loading}
            />
          </Tooltip>
          {selectedItems.size > 0 && (
            <Tooltip title={t('canvas.memory.clearSelection', '清除选择')}>
              <Button type="text" size="small" icon={<DeleteOutlined />} onClick={clearSelection} />
            </Tooltip>
          )}
        </ActionButtons>
      </SearchSection>

      {/* 选择统计 */}
      {selectedItems.size > 0 && (
        <SelectionInfo>
          <Text type="secondary">
            {t('canvas.memory.selectedCount', '已选择 {{count}} 项', { count: selectedItems.size })}
          </Text>
        </SelectionInfo>
      )}

      {/* 错误提示 */}
      {error && (
        <ErrorMessage>
          <Text type="danger">{error}</Text>
        </ErrorMessage>
      )}

      {/* 结果列表 */}
      <ResultsSection>
        {loading && searchResults.length === 0 ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : searchResults.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchQuery
                ? t('canvas.memory.noResults', '未找到相关记忆')
                : t('canvas.memory.emptyPrompt', '输入关键词搜索项目知识')
            }
          />
        ) : (
          <List
            dataSource={searchResults}
            renderItem={renderMemoryItem}
            split={false}
            size={compact ? 'small' : 'default'}
          />
        )}
      </ResultsSection>

      {/* 底部提示 */}
      {searchResults.length > 0 && (
        <Footer>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('canvas.memory.foundCount', '找到 {{count}} 条相关记忆', { count: searchResults.length })}
          </Text>
        </Footer>
      )}
    </PanelContainer>
  )
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: ${(props) => (props.$compact ? '8px' : '12px')};
  overflow: hidden;
`

const SearchSection = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
`

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const SelectionInfo = styled.div`
  padding: 4px 8px;
  margin-bottom: 8px;
  background: var(--color-primary-bg);
  border-radius: 4px;
  flex-shrink: 0;
`

const ErrorMessage = styled.div`
  padding: 8px;
  margin-bottom: 8px;
  background: var(--color-error-bg);
  border-radius: 4px;
  flex-shrink: 0;
`

const ResultsSection = styled.div`
  flex: 1;
  overflow-y: auto;

  .ant-list-item {
    padding: 0;
    margin-bottom: 8px;
  }
`

const MemoryItem = styled.div<{ $selected?: boolean; $compact?: boolean }>`
  padding: ${(props) => (props.$compact ? '8px' : '12px')};
  background: ${(props) => (props.$selected ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`

const MemoryItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const RelevanceScore = styled.span<{ $score: number }>`
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => (props.$score >= 0.7 ? 'var(--color-success)' : props.$score >= 0.5 ? 'var(--color-warning)' : 'var(--color-text-3)')};
`

const MemoryItemContent = styled.div<{ $compact?: boolean }>`
  margin-bottom: 8px;
  font-size: ${(props) => (props.$compact ? '12px' : '13px')};
  line-height: 1.5;
  color: var(--color-text-1);
`

const MemoryItemTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
`

const MemoryItemSource = styled.div`
  display: flex;
  align-items: center;
`

const Footer = styled.div`
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  text-align: center;
`

export default MemoryContextPanel
