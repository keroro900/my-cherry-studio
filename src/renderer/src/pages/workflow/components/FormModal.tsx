import './FormModal.css'

import { Modal } from 'antd'
import type { FC, ReactNode } from 'react'

interface FormModalProps {
  open: boolean
  title?: string
  children: ReactNode
  onClose: () => void
  width?: number | string
}

const FormModal: FC<FormModalProps> = ({ open, title, children, onClose, width = 640 }) => {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      keyboard
      maskClosable
      centered
      width={width}
      className="cherry-form-modal"
      destroyOnHidden>
      {children}
    </Modal>
  )
}

export default FormModal
