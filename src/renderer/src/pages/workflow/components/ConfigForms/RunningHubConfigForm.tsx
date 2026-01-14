/**
 * RunningHub 换装应用配置表单 - Cherry 风格
 * 支持一键获取 WebApp 输入配置（输入端口由 API 自动配置）
 * 支持手动配置输出端口
 * API Key 从全局设置读取
 * 参考: https://www.runninghub.cn/runninghub-api-doc-cn/doc-7527911
 */

import {
  CheckCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { type RunningHubNodeInfo, runningHubService } from '@renderer/services/externalServices'
import { useAppSelector } from '@renderer/store'
import { Alert, Button, Divider, Input, message, Select, Spin, Tag, Tooltip } from 'antd'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { NodeHandle } from '../../types'
import { FormInput, FormRow, FormSection, FormSelect } from './FormComponents'

const logger = loggerService.withContext('RunningHubConfigForm')

// ==================== 类型定义 ====================

interface OutputPort {
  id: string
  label: string
  dataType: 'image' | 'video' | 'text' | 'json' | 'any'
}

interface RunningHubConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
  // 使用标准的配置表单接口
  onInputsChange?: (inputs: NodeHandle[]) => void
  onOutputsChange?: (outputs: NodeHandle[]) => void
}

// ==================== 字段类型映射 ====================

const FIELD_TYPE_TO_DATA_TYPE: Record<string, NodeHandle['dataType']> = {
  STRING: 'text',
  LIST: 'text',
  IMAGE: 'image',
  AUDIO: 'any',
  VIDEO: 'video'
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  STRING: '📝',
  LIST: '📋',
  IMAGE: '🖼️',
  AUDIO: '🔊',
  VIDEO: '🎬'
}

// 默认输出端口
const DEFAULT_OUTPUT_PORTS: OutputPort[] = [
  { id: 'output_image', label: '输出图片', dataType: 'image' },
  { id: 'output_result', label: '结果 JSON', dataType: 'json' }
]

// ==================== 组件 ====================

// 解析 LIST 类型的 fieldData JSON
// RunningHub fieldData 格式：
// 1. [["auto", "1:1", "4:3", ...], {"default": "4:3"}] - 嵌套数组，第一个是选项，第二个是默认配置
// 2. [{name: "Third-party", index: "Third-party", description: "第三方"}, ...] - 对象数组
function parseListOptions(fieldData?: string): { label: string; value: string }[] {
  if (!fieldData) return []

  try {
    const data = JSON.parse(fieldData)

    if (Array.isArray(data)) {
      // 检查是否是嵌套数组格式: [[选项...], {default: ...}]
      if (data.length >= 1 && Array.isArray(data[0])) {
        // 第一个元素是选项数组
        return data[0].map((item: any) => {
          if (typeof item === 'string' || typeof item === 'number') {
            return { label: String(item), value: String(item) }
          }
          return { label: String(item), value: String(item) }
        })
      }

      // 普通数组格式
      return data.map((item, index) => {
        // 字符串或数字
        if (typeof item === 'string' || typeof item === 'number') {
          return { label: String(item), value: String(item) }
        }
        // 对象格式: {name, index, description, ...}
        if (typeof item === 'object' && item !== null) {
          // RunningHub 用 name 作为显示文本，index 作为值
          const label = item.name || item.label || item.text || item.title || item.description || ''
          const value = item.index ?? item.value ?? item.id ?? item.key ?? label
          if (label || value) {
            return { label: String(label || value), value: String(value || label) }
          }
          return { label: String(index), value: String(index) }
        }
        return { label: String(index), value: String(index) }
      })
    }

    // 对象格式（key-value 映射）
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data).map(([key, val]) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return { label: String(val), value: String(val) }
        }
        return { label: key, value: key }
      })
    }

    return []
  } catch {
    // JSON 解析失败，尝试作为逗号分隔字符串处理
    if (typeof fieldData === 'string' && fieldData.includes(',')) {
      return fieldData.split(',').map((item) => {
        const trimmed = item.trim()
        return { label: trimmed, value: trimmed }
      })
    }
    // 单个值
    return [{ label: fieldData, value: fieldData }]
  }
}

function RunningHubConfigForm({ config, onUpdateConfig, onOutputsChange }: RunningHubConfigFormProps) {
  // 只保留真正需要的临时状态
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 直接从 config 读取 nodeInfoList（不使用 useState，确保持久化）
  const nodeInfoList: RunningHubNodeInfo[] = config.nodeInfoList || []

  // 根据 config 判断是否已有保存的配置（用于 UI 显示）
  const hasSavedConfig = useMemo(() => {
    return nodeInfoList.length > 0 && !!config.fetchedAt
  }, [nodeInfoList.length, config.fetchedAt])

  // 计算显示信息
  const savedConfigMessage = useMemo(() => {
    if (!hasSavedConfig) return ''
    const inputCount = nodeInfoList.filter((n) => n.fieldType !== 'LIST').length
    const listCount = nodeInfoList.filter((n) => n.fieldType === 'LIST').length
    return `已配置 ${nodeInfoList.length} 个节点，${inputCount} 个输入端口${listCount > 0 ? `，${listCount} 个下拉配置` : ''}`
  }, [hasSavedConfig, nodeInfoList])

  // AbortController 引用，用于取消正在进行的请求
  const abortControllerRef = useRef<AbortController | null>(null)

  // 监听 externalServices.runningHub 配置变化
  const runningHubConfig = useAppSelector((state) => (state.externalServices as any)?.runningHub)

  // 服务可用性（实时计算）
  const isServiceAvailable = useMemo(() => {
    return runningHubService.isAvailable()
  }, [runningHubConfig])

  // 配置变化时清除错误状态
  useEffect(() => {
    setFetchError(null)
  }, [runningHubConfig])

  // 组件卸载时取消正在进行的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  // 获取当前输出端口配置
  const outputPorts: OutputPort[] = config.outputPorts || DEFAULT_OUTPUT_PORTS

  // 添加输出端口
  const handleAddOutputPort = useCallback(() => {
    const newPort: OutputPort = {
      id: `output_${Date.now()}`,
      label: `输出 ${outputPorts.length + 1}`,
      dataType: 'image'
    }
    const newPorts = [...outputPorts, newPort]
    onUpdateConfig('outputPorts', newPorts)

    if (onOutputsChange) {
      const outputs: NodeHandle[] = newPorts.map((p) => ({
        id: p.id,
        label: p.label,
        dataType: p.dataType
      }))
      onOutputsChange(outputs)
    }
  }, [outputPorts, onUpdateConfig, onOutputsChange])

  // 删除输出端口
  const handleRemoveOutputPort = useCallback(
    (id: string) => {
      if (outputPorts.length <= 1) {
        message.warning('至少保留一个输出端口')
        return
      }
      const newPorts = outputPorts.filter((p) => p.id !== id)
      onUpdateConfig('outputPorts', newPorts)

      if (onOutputsChange) {
        const outputs: NodeHandle[] = newPorts.map((p) => ({
          id: p.id,
          label: p.label,
          dataType: p.dataType
        }))
        onOutputsChange(outputs)
      }
    },
    [outputPorts, onUpdateConfig, onOutputsChange]
  )

  // 更新输出端口
  const handleUpdateOutputPort = useCallback(
    (id: string, key: keyof OutputPort, value: string) => {
      const newPorts = outputPorts.map((p) => (p.id === id ? { ...p, [key]: value } : p))
      onUpdateConfig('outputPorts', newPorts)

      if (onOutputsChange) {
        const outputs: NodeHandle[] = newPorts.map((p) => ({
          id: p.id,
          label: p.label,
          dataType: p.dataType
        }))
        onOutputsChange(outputs)
      }
    },
    [outputPorts, onUpdateConfig, onOutputsChange]
  )

  // 从 API 获取 WebApp 节点信息
  const handleFetchNodeInfo = useCallback(async () => {
    const webappId = config.webappId

    if (!webappId) {
      message.warning('请先填写 Webapp ID')
      return
    }

    if (!runningHubService.isAvailable()) {
      message.error('RunningHub 服务未配置，请在设置 → 外部服务中配置 API Key')
      return
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setFetchError(null)

    try {
      // 使用全局服务获取配置
      const result = await runningHubService.getWebappConfig(webappId)

      if (result?.nodeInfoList) {
        const nodeList = result.nodeInfoList as RunningHubNodeInfo[]

        // 分离 LIST 类型和其他类型（LIST 不作为输入端口，而是在配置面板显示下拉框）
        const inputs: NodeHandle[] = []
        const initialListValues: Record<string, string> = {}

        // 按类型分组计数，用于生成统一的端口 ID（如 image_1, image_2）
        const typeCounters: Record<string, number> = {}
        // 端口 ID 到原始节点信息的映射，用于执行时查找
        const portMapping: Record<string, { nodeId: string; fieldName: string }> = {}

        nodeList.forEach((node: RunningHubNodeInfo) => {
          if (node.fieldType === 'LIST') {
            // LIST 类型不作为输入端口，而是显示为配置下拉框
            typeCounters['list'] = (typeCounters['list'] || 0) + 1
            const listPortId = `list_${typeCounters['list']}`
            // 保存 LIST 的映射关系
            portMapping[listPortId] = { nodeId: node.nodeId, fieldName: node.fieldName }
            initialListValues[listPortId] = node.fieldValue || ''
          } else {
            // 其他类型作为输入端口
            const dataType = FIELD_TYPE_TO_DATA_TYPE[node.fieldType] || 'any'
            // 使用数据类型作为前缀，按顺序编号（如 image_1, image_2, text_1）
            const typeKey = dataType === 'image' ? 'image' : dataType
            typeCounters[typeKey] = (typeCounters[typeKey] || 0) + 1
            const portId = `${typeKey}_${typeCounters[typeKey]}`

            // 保存映射关系，用于执行时查找原始节点信息
            portMapping[portId] = { nodeId: node.nodeId, fieldName: node.fieldName }

            inputs.push({
              id: portId,
              label: node.description || node.nodeName || node.fieldName,
              dataType: dataType as NodeHandle['dataType'],
              required: false
            })
          }
        })

        // 合并已有的 listValues 和新的默认值
        const mergedListValues = { ...initialListValues, ...config.listValues }

        // 【重要】使用批量更新，一次性更新所有配置
        // 这样可以避免多次调用 onUpdateConfig 导致的状态覆盖问题
        const batchUpdates = {
          nodeInfoList: nodeList,
          fetchedAt: Date.now(),
          portMapping: portMapping,
          imageInputCount: inputs.length,
          listValues: mergedListValues,
          imageInputPorts: inputs,
          inputPorts: inputs // 最后一个 key，ConfigPanel 会用它来设置 data.inputs
        }

        // 批量更新 - 传入对象而非 key-value
        onUpdateConfig(batchUpdates as any, undefined)

        const listCount = nodeList.filter((n: RunningHubNodeInfo) => n.fieldType === 'LIST').length
        message.success(
          `成功获取 ${nodeList.length} 个节点配置，${inputs.length} 个输入端口${listCount > 0 ? `，${listCount} 个下拉配置` : ''}`
        )
      } else {
        throw new Error('获取配置失败，返回数据为空')
      }
    } catch (error) {
      logger.error('RunningHub API error', { error })
      const errorMessage = error instanceof Error ? error.message : '网络请求失败'
      setFetchError(errorMessage)
      message.error('获取节点信息失败')
    } finally {
      setLoading(false)
    }
  }, [config.webappId, config.listValues, onUpdateConfig])

  // 处理 LIST 下拉框值变化
  const handleListValueChange = useCallback(
    (portId: string, value: string) => {
      const newListValues = { ...config.listValues, [portId]: value }
      onUpdateConfig('listValues', newListValues)
    },
    [config.listValues, onUpdateConfig]
  )

  // 获取 LIST 类型的节点
  const listTypeNodes = nodeInfoList.filter((node) => node.fieldType === 'LIST')

  return (
    <div>
      {/* API 配置状态提示 */}
      {!isServiceAvailable && (
        <Alert
          message="RunningHub 服务未配置"
          description={
            <div>
              请在 <a onClick={() => window.open?.('#/settings/external-services')}>设置 → 外部服务</a> 中配置
              RunningHub API Key
            </div>
          }
          type="warning"
          icon={<SettingOutlined />}
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <FormSection title="🔑 应用配置">
        {/* Webapp ID */}
        <FormRow label="Webapp ID" description="对应创建的具体 AI 应用实例" required>
          <FormInput
            value={config.webappId || ''}
            onChange={(value) => onUpdateConfig('webappId', value)}
            placeholder="输入应用实例 ID..."
          />
        </FormRow>
      </FormSection>

      {/* 一键获取配置按钮 */}
      <FormSection title="🚀 自动配置">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '12px',
            background: 'var(--color-background-soft)',
            borderRadius: '8px'
          }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-2)' }}>
            点击按钮自动从 RunningHub 获取此应用的输入端口配置
          </div>

          <Button
            type="primary"
            icon={loading ? <Spin size="small" /> : <SyncOutlined />}
            onClick={handleFetchNodeInfo}
            disabled={loading || !config.webappId || !isServiceAvailable}
            block>
            {loading ? '正在获取...' : '🔄 获取输入端口配置'}
          </Button>

          {/* 状态显示 */}
          {hasSavedConfig && !loading && (
            <Alert
              message={savedConfigMessage}
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
              style={{ fontSize: '12px' }}
            />
          )}
          {fetchError && (
            <Alert message={fetchError} type="error" icon={<WarningOutlined />} showIcon style={{ fontSize: '12px' }} />
          )}
        </div>
      </FormSection>

      {/* 显示已获取的输入端口信息（非 LIST 类型） */}
      {nodeInfoList.filter((n) => n.fieldType !== 'LIST').length > 0 && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormSection title="📥 输入端口（自动配置）">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
              {nodeInfoList
                .filter((n) => n.fieldType !== 'LIST')
                .map((node, index) => (
                  <div
                    key={`${node.nodeId}_${node.fieldName}_${index}`}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--color-background)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span>{FIELD_TYPE_ICONS[node.fieldType] || '📦'}</span>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{node.description || node.fieldName}</span>
                      <Tag
                        color={node.fieldType === 'IMAGE' ? 'purple' : node.fieldType === 'VIDEO' ? 'magenta' : 'blue'}>
                        {node.fieldType}
                      </Tag>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                      节点: {node.nodeName} | 字段: {node.fieldName}
                    </div>
                  </div>
                ))}
            </div>
          </FormSection>
        </>
      )}

      {/* LIST 类型下拉配置 */}
      {listTypeNodes.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormSection title="📋 下拉配置">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
              {listTypeNodes.map((node, index) => {
                // 使用统一格式的端口 ID（与获取配置时生成的格式一致）
                const portId = `list_${index + 1}`
                const options = parseListOptions(node.fieldData)
                const currentValue = config.listValues?.[portId] || node.fieldValue || ''

                return (
                  <div
                    key={portId}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--color-background)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span>{FIELD_TYPE_ICONS.LIST}</span>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{node.description || node.fieldName}</span>
                      <Tag color="cyan">LIST</Tag>
                    </div>
                    <Select
                      size="small"
                      value={currentValue}
                      onChange={(value) => handleListValueChange(portId, value)}
                      style={{ width: '100%' }}
                      placeholder="选择选项..."
                      options={
                        options.length > 0
                          ? options
                          : // 如果没有解析到选项，使用 fieldValue 作为唯一选项
                            node.fieldValue
                            ? [{ label: node.fieldValue, value: node.fieldValue }]
                            : []
                      }
                    />
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '4px' }}>
                      节点: {node.nodeName} | 字段: {node.fieldName}
                    </div>
                  </div>
                )
              })}
            </div>
          </FormSection>
        </>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* 输出端口管理 */}
      <FormSection title="📤 输出端口">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {outputPorts.map((port, index) => (
            <div
              key={port.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: 'var(--color-background)',
                borderRadius: '6px',
                border: '1px solid var(--ant-color-border)'
              }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-primary)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4
                }}>
                {index + 1}
              </span>
              <Input
                size="small"
                placeholder="端口标签"
                value={port.label}
                onChange={(e) => handleUpdateOutputPort(port.id, 'label', e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                size="small"
                value={port.dataType}
                onChange={(value) => handleUpdateOutputPort(port.id, 'dataType', value)}
                style={{ width: 100 }}
                options={[
                  { label: '🖼️ 图片', value: 'image' },
                  { label: '🎬 视频', value: 'video' },
                  { label: '📝 文本', value: 'text' },
                  { label: '📋 JSON', value: 'json' },
                  { label: '📦 任意', value: 'any' }
                ]}
              />
              <Tooltip title={outputPorts.length > 1 ? '删除' : '至少保留一个'}>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveOutputPort(port.id)}
                  disabled={outputPorts.length <= 1}
                />
              </Tooltip>
            </div>
          ))}

          <Button icon={<PlusOutlined />} onClick={handleAddOutputPort} style={{ borderStyle: 'dashed' }} block>
            添加输出端口
          </Button>
        </div>
      </FormSection>

      <Divider style={{ margin: '16px 0' }} />

      <FormSection title="⚙️ 执行设置">
        {/* 超时设置 */}
        <FormRow label="⏱️ 超时时间" description="任务执行超过此时间将自动取消">
          <FormSelect
            value={String(config.timeout || 300)}
            onChange={(value) => onUpdateConfig('timeout', Number(value))}
            options={[
              { label: '60 秒 (快速任务)', value: '60' },
              { label: '180 秒 (标准任务)', value: '180' },
              { label: '300 秒 (复杂任务)', value: '300' },
              { label: '600 秒 (大型任务)', value: '600' }
            ]}
          />
        </FormRow>
      </FormSection>

      {/* 文件限制提示 */}
      <Alert
        message="⚠️ 文件限制"
        description={
          <>
            <div>• 上传文件大小: 30MB 以内</div>
            <div>• 支持格式: jpg、png、webp、mp3、wav、mp4、avi、mov、zip</div>
            <div>• 任务状态: 0-成功 | 804-运行中 | 813-排队中 | 805-失败</div>
          </>
        }
        type="warning"
        showIcon
        style={{ marginTop: '16px' }}
      />
    </div>
  )
}

export default memo(RunningHubConfigForm)
