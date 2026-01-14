/**
 * 预处理器排序面板
 *
 * 使用 @dnd-kit 实现拖拽排序：
 * - 显示所有消息预处理器插件
 * - 支持拖拽调整执行顺序
 * - 实时保存顺序变更
 * - 显示预处理器状态（启用/禁用）
 */

import type { DragEndEvent } from '@dnd-kit/core'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HStack } from '@renderer/components/Layout'
import { GripVertical, RefreshCw } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

/**
 * 预处理器项目接口
 */
interface PreprocessorItem {
  name: string
  displayName: string
  description: string
  enabled: boolean
  order: number
}

/**
 * 可排序的预处理器项目组件
 */
const SortablePreprocessorItem: FC<{ item: PreprocessorItem }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.name
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <ItemContainer ref={setNodeRef} style={style} $isDragging={isDragging} $enabled={item.enabled}>
      <DragHandle {...attributes} {...listeners}>
        <GripVertical size={16} />
      </DragHandle>
      <ItemContent>
        <HStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <ItemTitle>{item.displayName || item.name}</ItemTitle>
          <StatusBadge $enabled={item.enabled}>{item.enabled ? '已启用' : '已禁用'}</StatusBadge>
        </HStack>
        <ItemDescription>{item.description || '无描述'}</ItemDescription>
        <ItemMeta>ID: {item.name}</ItemMeta>
      </ItemContent>
    </ItemContainer>
  )
}

/**
 * 预处理器排序面板组件
 */
export const PreprocessorOrderPanel: FC = () => {
  const { t } = useTranslation()
  const [items, setItems] = useState<PreprocessorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 配置 dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  )

  /**
   * 加载预处理器列表
   */
  const loadPreprocessors = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await window.api.vcpPreprocessor.getInfo()
      if (result.success && result.data) {
        // 按 order 字段排序
        const sorted = [...result.data].sort((a, b) => a.order - b.order)
        setItems(sorted)
      } else {
        setError(result.error || '加载失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化加载
  useEffect(() => {
    loadPreprocessors()
  }, [loadPreprocessors])

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) {
        return
      }

      const oldIndex = items.findIndex((item) => item.name === active.id)
      const newIndex = items.findIndex((item) => item.name === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return
      }

      // 更新本地状态
      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // 保存到后端
      try {
        setSaving(true)
        const newOrder = newItems.map((item) => item.name)
        const result = await window.api.vcpPreprocessor.setOrder(newOrder)

        if (!result.success) {
          // 恢复原状态
          setItems(items)
          window.toast?.error?.('保存顺序失败: ' + result.error)
        } else {
          window.toast?.success?.('预处理器顺序已更新')
        }
      } catch (err) {
        // 恢复原状态
        setItems(items)
        window.toast?.error?.('保存顺序失败')
      } finally {
        setSaving(false)
      }
    },
    [items]
  )

  /**
   * 刷新预处理器列表
   */
  const handleRefresh = useCallback(async () => {
    try {
      await window.api.vcpPreprocessor.reload()
      await loadPreprocessors()
      window.toast?.success?.(t('vcp.preprocessor.refreshed', '预处理器已刷新'))
    } catch (err) {
      window.toast?.error?.(t('vcp.preprocessor.refresh_failed', '刷新失败'))
    }
  }, [loadPreprocessors, t])

  // 加载中状态
  if (loading) {
    return (
      <Container>
        <LoadingText>加载预处理器...</LoadingText>
      </Container>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Container>
        <ErrorText>{error}</ErrorText>
        <RefreshButton onClick={loadPreprocessors}>
          <RefreshCw size={14} />
          重试
        </RefreshButton>
      </Container>
    )
  }

  // 无预处理器
  if (items.length === 0) {
    return (
      <Container>
        <EmptyText>暂无消息预处理器插件</EmptyText>
        <HelpText>预处理器用于在消息发送前进行处理，如自动注入上下文、翻译等。</HelpText>
      </Container>
    )
  }

  return (
    <Container>
      <Header>
        <Title>拖拽调整预处理器执行顺序</Title>
        <RefreshButton onClick={handleRefresh} disabled={saving}>
          <RefreshCw size={14} className={saving ? 'spinning' : ''} />
          刷新
        </RefreshButton>
      </Header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.name)} strategy={verticalListSortingStrategy}>
          <ItemList>
            {items.map((item, index) => (
              <SortablePreprocessorItem key={item.name} item={{ ...item, order: index + 1 }} />
            ))}
          </ItemList>
        </SortableContext>
      </DndContext>

      {saving && <SavingOverlay>保存中...</SavingOverlay>}
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  position: relative;
  padding: 12px 0;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

const Title = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--color-background-soft);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
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

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ItemContainer = styled.div<{ $isDragging?: boolean; $enabled?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: ${(props) => (props.$isDragging ? 'var(--color-background-soft)' : 'var(--color-background-mute)')};
  border: 1px solid ${(props) => (props.$isDragging ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  opacity: ${(props) => (props.$enabled === false ? 0.6 : 1)};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary-soft);
  }
`

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: var(--color-text-3);
  cursor: grab;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-soft);
    color: var(--color-text-2);
  }

  &:active {
    cursor: grabbing;
  }
`

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`

const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`

const StatusBadge = styled.span<{ $enabled?: boolean }>`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${(props) => (props.$enabled ? 'var(--color-success-soft)' : 'var(--color-warning-soft)')};
  color: ${(props) => (props.$enabled ? 'var(--color-success)' : 'var(--color-warning)')};
`

const ItemDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  line-height: 1.4;
`

const ItemMeta = styled.div`
  font-size: 11px;
  color: var(--color-text-4);
  margin-top: 6px;
  font-family: monospace;
`

const LoadingText = styled.div`
  text-align: center;
  color: var(--color-text-3);
  padding: 20px;
`

const ErrorText = styled.div`
  text-align: center;
  color: var(--color-error);
  padding: 20px;
`

const EmptyText = styled.div`
  text-align: center;
  color: var(--color-text-3);
  padding: 20px;
`

const HelpText = styled.div`
  text-align: center;
  font-size: 12px;
  color: var(--color-text-4);
  margin-top: 8px;
`

const SavingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-background-rgb), 0.8);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-2);
`

export default PreprocessorOrderPanel
