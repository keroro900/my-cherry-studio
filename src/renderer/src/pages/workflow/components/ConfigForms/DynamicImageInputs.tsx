/**
 * 动态图片输入端口组件
 * 为需要图片输入的节点提供 "+" 按钮来动态添加/删除输入端口
 *
 * 使用方法:
 * - 点击 "+" 按钮增加一个图片输入端口
 * - 点击 "-" 按钮删除最后一个输入端口
 * - 每个端口都有唯一的 ID: image_input_1, image_input_2, ...
 */

import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Handle, Position } from '@xyflow/react'
import { Button, Tooltip } from 'antd'
import { memo, useCallback } from 'react'
import styled from 'styled-components'

// ==================== 类型定义 ====================

export interface DynamicImageInput {
  id: string
  label: string
  connected?: boolean
}

interface DynamicImageInputsProps {
  inputs: DynamicImageInput[]
  onInputsChange: (inputs: DynamicImageInput[]) => void
  maxInputs?: number
  minInputs?: number
  disabled?: boolean
  position?: 'left' | 'right'
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--ant-color-bg-elevated);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ant-color-text-secondary);
  position: relative;
`

const InputLabel = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const InputStatus = styled.span<{ $connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $connected }) => ($connected ? '#52c41a' : '#d9d9d9')};
`

const ControlButtons = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;
`

const HandleWrapper = styled.div<{ $position: 'left' | 'right' }>`
  position: absolute;
  ${({ $position }) => ($position === 'left' ? 'left: -14px;' : 'right: -14px;')}
  top: 50%;
  transform: translateY(-50%);
`

// ==================== 组件实现 ====================

/**
 * 生成输入端口 ID
 */
const generateInputId = (index: number) => `image_input_${index + 1}`

/**
 * 动态图片输入端口组件
 */
function DynamicImageInputs({
  inputs,
  onInputsChange,
  maxInputs = 10,
  minInputs = 1,
  disabled = false,
  position = 'left'
}: DynamicImageInputsProps) {
  // 添加输入端口
  const handleAddInput = useCallback(() => {
    if (inputs.length >= maxInputs) return

    const newInput: DynamicImageInput = {
      id: generateInputId(inputs.length),
      label: `图片 ${inputs.length + 1}`,
      connected: false
    }

    onInputsChange([...inputs, newInput])
  }, [inputs, maxInputs, onInputsChange])

  // 移除最后一个输入端口
  const handleRemoveInput = useCallback(() => {
    if (inputs.length <= minInputs) return

    onInputsChange(inputs.slice(0, -1))
  }, [inputs, minInputs, onInputsChange])

  return (
    <Container className="nodrag">
      {/* 输入端口列表 */}
      {inputs.map((input, index) => (
        <InputRow key={input.id}>
          <HandleWrapper $position={position}>
            <Handle
              type="target"
              position={position === 'left' ? Position.Left : Position.Right}
              id={input.id}
              style={{
                width: 10,
                height: 10,
                background: input.connected ? '#52c41a' : '#1890ff',
                border: '2px solid white',
                position: 'static',
                transform: 'none'
              }}
            />
          </HandleWrapper>
          <InputStatus $connected={!!input.connected} />
          <InputLabel title={input.label}>📷 {input.label}</InputLabel>
          <span style={{ fontSize: 10, color: 'var(--ant-color-text-quaternary)' }}>#{index + 1}</span>
        </InputRow>
      ))}

      {/* 控制按钮 */}
      <ControlButtons>
        <Tooltip title={inputs.length >= maxInputs ? `最多 ${maxInputs} 个输入` : '添加图片输入'}>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddInput}
            disabled={disabled || inputs.length >= maxInputs}
            style={{ flex: 1 }}>
            添加输入
          </Button>
        </Tooltip>
        <Tooltip title={inputs.length <= minInputs ? `最少 ${minInputs} 个输入` : '移除最后一个'}>
          <Button
            size="small"
            icon={<MinusOutlined />}
            onClick={handleRemoveInput}
            disabled={disabled || inputs.length <= minInputs}
          />
        </Tooltip>
      </ControlButtons>
    </Container>
  )
}

export default memo(DynamicImageInputs)

// ==================== 辅助函数 ====================

/**
 * 创建初始输入端口列表
 */
export function createInitialInputs(count: number = 1): DynamicImageInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateInputId(i),
    label: `图片 ${i + 1}`,
    connected: false
  }))
}

/**
 * 从节点数据中获取图片输入端口
 */
export function getImageInputsFromNode(nodeConfig: any): DynamicImageInput[] {
  if (nodeConfig?.imageInputs && Array.isArray(nodeConfig.imageInputs)) {
    return nodeConfig.imageInputs
  }
  // 默认返回一个输入端口
  return createInitialInputs(1)
}
