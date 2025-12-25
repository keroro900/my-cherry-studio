/**
 * 标准模态框组件
 * 统一工作流中所有模态框的样式，确保与 Cherry Studio 主题一致
 */

import { Modal, type ModalProps } from 'antd'
import styled from 'styled-components'

const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
    box-shadow:
      0 6px 16px 0 rgba(0, 0, 0, 0.08),
      0 3px 6px -4px rgba(0, 0, 0, 0.12),
      0 9px 28px 8px rgba(0, 0, 0, 0.05);
  }

  .ant-modal-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 0;
  }

  .ant-modal-title {
    font-size: 16px;
    font-weight: 600;
  }

  .ant-modal-body {
    padding: 0;
  }

  .ant-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    margin-top: 0;
  }
`

export interface StandardModalProps extends ModalProps {
  /**
   * 是否启用标准内边距 (默认 false，适合复杂布局如编辑器；如果为 true，则添加标准 padding)
   */
  useBodyPadding?: boolean
}

export const StandardModal = ({ useBodyPadding = false, children, styles, ...props }: StandardModalProps) => {
  return (
    <StyledModal
      centered
      maskClosable
      destroyOnHidden
      width={640}
      styles={{
        ...styles,
        body: {
          ...styles?.body,
          ...(useBodyPadding ? { padding: '24px' } : {})
        }
      }}
      {...props}>
      {children}
    </StyledModal>
  )
}

export default StandardModal
