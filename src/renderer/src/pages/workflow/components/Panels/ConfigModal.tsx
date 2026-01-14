/**
 * 配置弹窗组件 v1.0
 * 将 ConfigPanel 内容包装在 Modal 中显示
 * 点击节点的设置按钮或双击节点打开
 */

import { useAppSelector } from '@renderer/store'
import { Modal } from 'antd'
import { memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

import { NodeRegistryAdapter } from '../../nodes/base/NodeRegistryAdapter'
import type { WorkflowNodeType } from '../../types'
import ConfigPanel from './ConfigPanel'

interface ConfigModalProps {
  open: boolean
  onClose: () => void
}

// 辅助函数：兼容新旧节点定义格式
function getNodeDefProperty(nodeDef: any, key: string): any {
  if (nodeDef?.metadata && nodeDef.metadata[key] !== undefined) {
    return nodeDef.metadata[key]
  }
  return nodeDef?.[key]
}

/**
 * 配置弹窗
 * 使用 Ant Design Modal 包装 ConfigPanel
 */
function ConfigModal({ open, onClose }: ConfigModalProps) {
  const selectedNodeId = useAppSelector((state) => state.workflow.selectedNodeId)
  const selectedNode = useAppSelector((state) => {
    const nodes = state.workflow.nodes
    return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined
  })

  // 获取节点定义
  const nodeDef = useMemo(() => {
    if (!selectedNode?.data?.nodeType) return null
    return NodeRegistryAdapter.getNodeDefinition(selectedNode.data.nodeType as WorkflowNodeType)
  }, [selectedNode?.data?.nodeType])

  // 获取节点图标
  const nodeIcon = useMemo(() => {
    if (!nodeDef) return '⚙️'
    return getNodeDefProperty(nodeDef, 'icon') || '⚙️'
  }, [nodeDef])

  // 关闭弹窗
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // 删除节点后关闭弹窗
  const handleAfterDelete = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <StyledModal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={400}
      centered
      destroyOnClose={false}
      maskClosable={true}
      title={
        <ModalTitle>
          <TitleIcon>{nodeIcon}</TitleIcon>
          <TitleText>{selectedNode?.data.label || '节点配置'}</TitleText>
        </ModalTitle>
      }
      styles={{
        body: {
          padding: 0,
          maxHeight: '70vh',
          overflow: 'hidden'
        },
        content: {
          borderRadius: '12px',
          overflow: 'hidden'
        }
      }}>
      <ModalContent>
        <ConfigPanel isModal onDelete={handleAfterDelete} />
      </ModalContent>
    </StyledModal>
  )
}

export default memo(ConfigModal)

// Styled Components
const StyledModal = styled(Modal)`
  .ant-modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--ant-color-border);
    margin-bottom: 0;
  }

  .ant-modal-close {
    top: 16px;
    right: 16px;
  }

  .ant-modal-body {
    padding: 0 !important;
  }
`

const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const TitleIcon = styled.span`
  font-size: 18px;
`

const TitleText = styled.span`
  font-weight: 600;
  font-size: 15px;
  color: var(--ant-color-text);
`

const ModalContent = styled.div`
  max-height: calc(70vh - 60px);
  overflow: auto;

  /* 隐藏 ConfigPanel 的头部（因为 Modal 已有标题） */
  & > div > div:first-child {
    display: none;
  }
`
