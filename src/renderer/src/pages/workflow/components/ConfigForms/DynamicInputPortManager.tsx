/**
 * 动态图片输入端口管理组件 - Cherry 风格
 *
 * 功能特性:
 * 1. 按键添加/删除图片输入端口
 * 2. 为每个端口设置标签和说明
 * 3. 拖拽排序调整端口顺序
 * 4. 与节点的 inputs 同步更新
 */

import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import type { DragEndEvent } from '@dnd-kit/core'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Input, Switch, Tooltip } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

// ==================== 类型定义 ====================

export interface DynamicInputPort {
  id: string
  label: string // 端口标签
  description?: string // 端口说明
  required?: boolean // 是否必需
  dataType: 'image' | 'images' | 'text' | 'json' | 'any'
}

interface DynamicInputPortManagerProps {
  value?: DynamicInputPort[]
  onChange?: (ports: DynamicInputPort[]) => void
  maxPorts?: number
  minPorts?: number // 最少端口数
  disabled?: boolean
  defaultDataType?: DynamicInputPort['dataType']
  portPrefix?: string // 端口 ID 前缀，如 'image_', 'input_'
  addButtonText?: string
}

// ==================== 样式组件 ====================

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const PortList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PortItemWrapper = styled.div<{ $isDragging?: boolean; $required?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-background);
  border: 1px solid ${({ $required }) => ($required ? 'var(--ant-color-warning)' : 'var(--ant-color-border)')};
  border-radius: var(--list-item-border-radius, 6px);
  transition: all 0.2s ease;
  cursor: grab;

  ${({ $isDragging }) =>
    $isDragging &&
    `
    opacity: 0.8;
    cursor: grabbing;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    background: var(--ant-color-bg-elevated);
  `}

  &:hover {
    border-color: var(--color-primary);
    background: var(--ant-color-bg-elevated);
  }
`

const DragHandle = styled.div`
  color: var(--ant-color-text-tertiary);
  cursor: grab;
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: var(--ant-color-text-secondary);
  }
`

const PortIndex = styled.div<{ $required?: boolean }>`
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $required }) => ($required ? 'var(--ant-color-warning)' : 'var(--color-primary)')};
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
`

const PortInputGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const PortInputRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`

const LabelInput = styled(Input)`
  flex: 1;
`

const RequiredSwitch = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ant-color-text-secondary);
`

const AddButton = styled(Button)`
  width: 100%;
  border-style: dashed;
`

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
`

const PortCount = styled.div`
  font-size: 12px;
  color: var(--ant-color-text-secondary);
`

const EmptyState = styled.div`
  padding: 20px;
  text-align: center;
  color: var(--ant-color-text-tertiary);
  font-size: 13px;
  background: var(--ant-color-bg-elevated);
  border-radius: 8px;
  border: 1px dashed var(--ant-color-border);
`

// ==================== 可排序端口项组件 ====================

interface SortablePortItemProps {
  port: DynamicInputPort
  index: number
  onUpdate: (id: string, updates: Partial<DynamicInputPort>) => void
  onRemove: (id: string) => void
  disabled?: boolean
  canRemove?: boolean
}

const SortablePortItem = memo(({ port, index, onUpdate, onRemove, disabled, canRemove }: SortablePortItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: port.id,
    disabled
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <PortItemWrapper ref={setNodeRef} style={style} $isDragging={isDragging} $required={port.required}>
      <DragHandle {...attributes} {...listeners}>
        <HolderOutlined />
      </DragHandle>

      <PortIndex $required={port.required}>{index + 1}</PortIndex>

      <PortInputGroup>
        <PortInputRow>
          <LabelInput
            size="small"
            placeholder="端口标签"
            value={port.label}
            onChange={(e) => onUpdate(port.id, { label: e.target.value })}
            disabled={disabled}
          />
          <RequiredSwitch>
            <span>必需</span>
            <Switch
              size="small"
              checked={port.required}
              onChange={(checked) => onUpdate(port.id, { required: checked })}
              disabled={disabled}
            />
          </RequiredSwitch>
        </PortInputRow>
        <Input
          size="small"
          placeholder="端口说明（可选）"
          value={port.description || ''}
          onChange={(e) => onUpdate(port.id, { description: e.target.value })}
          disabled={disabled}
          style={{ fontSize: 11 }}
        />
      </PortInputGroup>

      <Tooltip title={canRemove ? '删除' : '至少保留一个端口'}>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => onRemove(port.id)}
          disabled={disabled || !canRemove}
        />
      </Tooltip>
    </PortItemWrapper>
  )
})

SortablePortItem.displayName = 'SortablePortItem'

// ==================== 工具函数 ====================

const generateId = (prefix: string = 'port') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

// ==================== 主组件 ====================

function DynamicInputPortManager({
  value = [],
  onChange,
  maxPorts = 10,
  minPorts = 0,
  disabled = false,
  defaultDataType = 'image',
  portPrefix = 'input',
  addButtonText = '添加输入端口'
}: DynamicInputPortManagerProps) {
  const [ports, setPorts] = useState<DynamicInputPort[]>(value)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 同步外部 value 变化
  useEffect(() => {
    if (value !== ports) {
      setPorts(value)
    }
  }, [value])

  // 更新 ports
  const updatePorts = useCallback(
    (newPorts: DynamicInputPort[]) => {
      setPorts(newPorts)
      onChange?.(newPorts)
    },
    [onChange]
  )

  // 添加新端口
  const handleAdd = useCallback(() => {
    if (ports.length >= maxPorts) {
      return
    }

    const newPort: DynamicInputPort = {
      id: generateId(portPrefix),
      label: `图片 ${ports.length + 1}`,
      dataType: defaultDataType,
      required: false
    }

    updatePorts([...ports, newPort])
  }, [ports, maxPorts, portPrefix, defaultDataType, updatePorts])

  // 更新单个端口
  const handleUpdate = useCallback(
    (id: string, updates: Partial<DynamicInputPort>) => {
      const newPorts = ports.map((port) => (port.id === id ? { ...port, ...updates } : port))
      updatePorts(newPorts)
    },
    [ports, updatePorts]
  )

  // 删除端口
  const handleRemove = useCallback(
    (id: string) => {
      if (ports.length <= minPorts) {
        return
      }
      const newPorts = ports.filter((port) => port.id !== id)
      updatePorts(newPorts)
    },
    [ports, minPorts, updatePorts]
  )

  // 拖拽排序
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = ports.findIndex((port) => port.id === active.id)
        const newIndex = ports.findIndex((port) => port.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newPorts = arrayMove(ports, oldIndex, newIndex)
          updatePorts(newPorts)
        }
      }
    },
    [ports, updatePorts]
  )

  const remainingSlots = maxPorts - ports.length
  const canRemove = ports.length > minPorts

  return (
    <Container>
      {/* 控制栏 */}
      {ports.length > 0 && (
        <ControlBar>
          <PortCount>
            {ports.length} / {maxPorts} 个输入端口
          </PortCount>
        </ControlBar>
      )}

      {/* 端口列表 */}
      {ports.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ports.map((port) => port.id)} strategy={verticalListSortingStrategy}>
            <PortList>
              {ports.map((port, index) => (
                <SortablePortItem
                  key={port.id}
                  port={port}
                  index={index}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  disabled={disabled}
                  canRemove={canRemove}
                />
              ))}
            </PortList>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState>
          <div style={{ marginBottom: 8 }}>📥 暂无输入端口</div>
          <div style={{ fontSize: 11, color: 'var(--ant-color-text-quaternary)' }}>点击下方按钮添加图片输入端口</div>
        </EmptyState>
      )}

      {/* 添加按钮 */}
      {remainingSlots > 0 && (
        <AddButton icon={<PlusOutlined />} onClick={handleAdd} disabled={disabled}>
          {addButtonText} ({remainingSlots} 个可用)
        </AddButton>
      )}
    </Container>
  )
}

export default memo(DynamicInputPortManager)
