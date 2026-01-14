/**
 * ImportConflictModal - .env 导入冲突解决对话框
 *
 * 当导入 .env 文件时发现变量名冲突，显示此对话框让用户逐个确认处理方式。
 *
 * 处理方式：
 * - keep: 保留现有值
 * - replace: 使用导入的新值
 * - skip: 跳过此变量
 */

import { CheckCircleOutlined, CloseCircleOutlined, SwapOutlined, WarningOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Radio, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

const { Text } = Typography

/**
 * 冲突信息
 */
export interface ImportConflict {
  name: string
  existingValue: string
  newValue: string
  existingId: string
}

/**
 * 冲突解决类型
 */
export type ConflictResolution = 'keep' | 'replace' | 'skip'

/**
 * 组件属性
 */
interface ImportConflictModalProps {
  /** 是否可见 */
  visible: boolean
  /** 冲突列表 */
  conflicts: ImportConflict[]
  /** 解决后的回调 */
  onResolve: (resolutions: Map<string, ConflictResolution>) => void
  /** 取消回调 */
  onCancel: () => void
  /** 是否正在处理 */
  loading?: boolean
}

/**
 * 值预览组件
 */
const ValuePreview = styled.div`
  max-width: 200px;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 12px;
  background: var(--color-background-soft);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: var(--color-background-mute);
  }
`

/**
 * 批量操作栏
 */
const BatchActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
`

/**
 * .env 导入冲突解决对话框
 */
export const ImportConflictModal: FC<ImportConflictModalProps> = ({
  visible,
  conflicts,
  onResolve,
  onCancel,
  loading = false
}) => {
  // 各冲突的解决方式
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map())

  // 初始化时设置默认值（全部跳过）
  useEffect(() => {
    if (visible && conflicts.length > 0) {
      const defaultResolutions = new Map<string, ConflictResolution>()
      conflicts.forEach((c) => defaultResolutions.set(c.name, 'skip'))
      setResolutions(defaultResolutions)
    }
  }, [visible, conflicts])

  // 更新单个冲突的解决方式
  const handleResolutionChange = useCallback((name: string, resolution: ConflictResolution) => {
    setResolutions((prev) => {
      const newMap = new Map(prev)
      newMap.set(name, resolution)
      return newMap
    })
  }, [])

  // 批量设置所有冲突的解决方式
  const handleBatchSet = useCallback(
    (resolution: ConflictResolution) => {
      const newResolutions = new Map<string, ConflictResolution>()
      conflicts.forEach((c) => newResolutions.set(c.name, resolution))
      setResolutions(newResolutions)
    },
    [conflicts]
  )

  // 确认解决
  const handleOk = useCallback(() => {
    onResolve(resolutions)
  }, [onResolve, resolutions])

  // 统计各类型数量
  const stats = useMemo(() => {
    let keep = 0
    let replace = 0
    let skip = 0

    for (const resolution of resolutions.values()) {
      if (resolution === 'keep') keep++
      else if (resolution === 'replace') replace++
      else skip++
    }

    return { keep, replace, skip }
  }, [resolutions])

  // 表格列定义
  const columns: ColumnsType<ImportConflict> = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string) => (
        <Text strong code>
          {name}
        </Text>
      )
    },
    {
      title: '现有值',
      dataIndex: 'existingValue',
      key: 'existingValue',
      width: 220,
      render: (value: string) => (
        <Tooltip title={value} placement="topLeft" overlayStyle={{ maxWidth: 400 }}>
          <ValuePreview>{value.length > 100 ? value.slice(0, 100) + '...' : value}</ValuePreview>
        </Tooltip>
      )
    },
    {
      title: '导入值',
      dataIndex: 'newValue',
      key: 'newValue',
      width: 220,
      render: (value: string) => (
        <Tooltip title={value} placement="topLeft" overlayStyle={{ maxWidth: 400 }}>
          <ValuePreview>{value.length > 100 ? value.slice(0, 100) + '...' : value}</ValuePreview>
        </Tooltip>
      )
    },
    {
      title: '处理方式',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Radio.Group
          value={resolutions.get(record.name) ?? 'skip'}
          onChange={(e) => handleResolutionChange(record.name, e.target.value)}
          size="small">
          <Radio.Button value="keep">
            <Space size={4}>
              <CheckCircleOutlined />
              保留现有
            </Space>
          </Radio.Button>
          <Radio.Button value="replace">
            <Space size={4}>
              <SwapOutlined />
              使用导入
            </Space>
          </Radio.Button>
          <Radio.Button value="skip">
            <Space size={4}>
              <CloseCircleOutlined />
              跳过
            </Space>
          </Radio.Button>
        </Radio.Group>
      )
    }
  ]

  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          导入冲突确认
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={900}
      confirmLoading={loading}
      okText="确认导入"
      cancelText="取消"
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
          确认导入
        </Button>
      ]}>
      <Alert
        type="warning"
        showIcon
        message={`发现 ${conflicts.length} 个变量存在冲突，请确认每个变量的处理方式`}
        description="保留现有：忽略导入值，保持原变量不变。使用导入：用导入的新值覆盖现有值。跳过：不处理此变量。"
        style={{ marginBottom: 16 }}
      />

      <BatchActionBar>
        <Space>
          <Text type="secondary">批量操作:</Text>
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleBatchSet('keep')}>
            全部保留现有
          </Button>
          <Button size="small" icon={<SwapOutlined />} onClick={() => handleBatchSet('replace')}>
            全部使用导入
          </Button>
          <Button size="small" icon={<CloseCircleOutlined />} onClick={() => handleBatchSet('skip')}>
            全部跳过
          </Button>
        </Space>
        <Space>
          <Tag color="green">保留: {stats.keep}</Tag>
          <Tag color="blue">导入: {stats.replace}</Tag>
          <Tag color="default">跳过: {stats.skip}</Tag>
        </Space>
      </BatchActionBar>

      <Table
        dataSource={conflicts}
        columns={columns}
        rowKey="name"
        pagination={conflicts.length > 10 ? { pageSize: 10 } : false}
        size="small"
        scroll={{ y: 400 }}
      />
    </Modal>
  )
}

export default ImportConflictModal
