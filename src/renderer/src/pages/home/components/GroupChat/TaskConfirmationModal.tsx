/**
 * TaskConfirmationModal - 任务确认模态框
 *
 * 当 Agent 准备执行任务时，显示确认对话框
 * 让用户决定是否允许该 Agent 执行任务
 */

import { CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined, RobotOutlined } from '@ant-design/icons'
import type { TaskConfirmation } from '@renderer/services/GroupAgentRunner'
import { Avatar, Modal, Progress, Space, Tag, Typography } from 'antd'
import React from 'react'

const { Text, Paragraph } = Typography

/**
 * 动作类型颜色和标签
 */
const ACTION_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  respond: { color: 'blue', label: '回复', icon: <RobotOutlined /> },
  ask: { color: 'orange', label: '提问', icon: <QuestionCircleOutlined /> },
  summarize: { color: 'green', label: '总结', icon: <CheckCircleOutlined /> },
  delegate: { color: 'purple', label: '委派', icon: <RobotOutlined /> },
  conclude: { color: 'cyan', label: '结论', icon: <CheckCircleOutlined /> }
}

interface TaskConfirmationModalProps {
  /** 当前待确认的任务 */
  confirmation: TaskConfirmation | null
  /** 确认回调 */
  onConfirm: () => void
  /** 拒绝回调 */
  onReject: () => void
  /** 是否显示 */
  visible: boolean
}

/**
 * 任务确认模态框
 */
export const TaskConfirmationModal: React.FC<TaskConfirmationModalProps> = ({
  confirmation,
  onConfirm,
  onReject,
  visible
}) => {
  if (!confirmation) return null

  const actionConfig = ACTION_CONFIG[confirmation.estimatedAction] || ACTION_CONFIG.respond

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>任务确认</span>
        </Space>
      }
      open={visible}
      onOk={onConfirm}
      onCancel={onReject}
      okText="允许"
      cancelText="拒绝"
      okButtonProps={{ icon: <CheckCircleOutlined /> }}
      cancelButtonProps={{ icon: <CloseCircleOutlined />, danger: true }}
      centered
      width={400}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Agent 信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="large" style={{ backgroundColor: '#1890ff' }}>
            {confirmation.agentName[0]}
          </Avatar>
          <div>
            <Text strong>{confirmation.agentName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              请求执行任务
            </Text>
          </div>
        </div>

        {/* 任务描述 */}
        <div
          style={{
            background: 'var(--color-background-soft)',
            padding: 12,
            borderRadius: 8
          }}>
          <Paragraph style={{ margin: 0 }}>{confirmation.taskDescription}</Paragraph>
        </div>

        {/* 动作类型 */}
        <Space>
          <Text type="secondary">预计动作：</Text>
          <Tag color={actionConfig.color} icon={actionConfig.icon}>
            {actionConfig.label}
          </Tag>
        </Space>

        {/* 优先级 */}
        <div>
          <Text type="secondary">优先级：</Text>
          <Progress
            percent={confirmation.priority}
            size="small"
            status={confirmation.priority > 70 ? 'active' : 'normal'}
            style={{ width: 200, marginLeft: 8, display: 'inline-block' }}
          />
        </div>
      </Space>
    </Modal>
  )
}

export default TaskConfirmationModal
