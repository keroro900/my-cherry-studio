/**
 * 图片输入端口配置区块组件
 *
 * 可复用的图片输入端口管理 UI 组件
 * 支持两种模式：
 * - simple: 简单数量模式，只管理端口数量
 * - advanced: 高级模式，支持自定义标签、拖拽排序等
 */

import { Alert, Divider } from 'antd'
import { memo, useCallback, useMemo } from 'react'

import DynamicInputPortManager, { type DynamicInputPort } from '../DynamicInputPortManager'
import { FormSection } from '../FormComponents'

export interface ImageInputPort {
  id: string
  label: string
  dataType: 'image'
  required: boolean
  description: string
}

export interface ImageInputPortSectionProps {
  /** 模式：simple=简单数量模式，advanced=高级端口管理模式 */
  mode?: 'simple' | 'advanced'
  /** 当前端口数量（simple 模式使用） */
  count?: number
  /** 当前端口列表（两种模式都可使用，simple 模式下用于显示端口列表） */
  ports?: ImageInputPort[]
  /** 最小端口数量 */
  min?: number
  /** 最大端口数量 */
  max?: number
  /** 端口数量变更回调（simple 模式使用） */
  onCountChange?: (count: number) => void
  /** 端口配置变更回调 */
  onPortsChange?: (ports: ImageInputPort[]) => void
  /** 端口 ID 前缀 */
  portPrefix?: string
  /** 区块标题 */
  title?: string
  /** 提示信息 */
  alertMessage?: string
  /** 是否显示分隔线 */
  showDivider?: boolean
  /** 是否显示提示信息 */
  showAlert?: boolean
  /** 自定义摘要文本（simple 模式使用） */
  customSummary?: string
  /** 是否禁用 */
  disabled?: boolean
  /** simple 模式下是否显示端口列表（默认 true） */
  showPortList?: boolean
}

/**
 * 生成图片输入端口配置
 */
export function generateImageInputPorts(count: number, prefix: string = 'image'): ImageInputPort[] {
  const ports: ImageInputPort[] = []
  for (let i = 1; i <= count; i++) {
    ports.push({
      id: `${prefix}_${i}`,
      label: `图片 ${i}${i === 1 ? ' (主图)' : ''}`,
      dataType: 'image' as const,
      required: i === 1,
      description: i === 1 ? '主要参考图片' : `可选参考图片 ${i}`
    })
  }
  return ports
}

function ImageInputPortSection({
  mode = 'simple',
  count = 0,
  ports = [],
  min = 0,
  max = 10,
  onCountChange,
  onPortsChange,
  portPrefix = 'image',
  title = '📷 图片输入端口',
  alertMessage = '点击 + 增加图片输入端口，连接上游图片节点',
  showDivider = true,
  showAlert = true,
  // customSummary 保留用于向后兼容，但不再使用
  customSummary: _customSummary,
  disabled = false,
  showPortList = true
}: ImageInputPortSectionProps) {
  // 忽略未使用的 customSummary
  void _customSummary
  // 计算当前端口数量（兼容两种模式）
  const currentCount = mode === 'advanced' ? ports.length : count

  // 处理添加端口（simple 模式）
  // 注意：在 simple 模式下，ConfigPanel 的 handleUpdateConfig 会根据 imageInputCount 自动生成端口
  // 所以这里只需要调用 onCountChange，不需要同时调用 onPortsChange（避免重复更新）
  const handleAdd = useCallback(() => {
    if (currentCount < max) {
      const newCount = currentCount + 1
      // 优先使用 onCountChange（ConfigPanel 会自动处理端口生成）
      if (onCountChange) {
        onCountChange(newCount)
      } else if (onPortsChange) {
        // 如果没有 onCountChange，则使用 onPortsChange
        onPortsChange(generateImageInputPorts(newCount, portPrefix))
      }
    }
  }, [currentCount, max, onCountChange, onPortsChange, portPrefix])

  // 处理移除端口（simple 模式）
  const handleRemove = useCallback(() => {
    if (currentCount > min) {
      const newCount = currentCount - 1
      // 优先使用 onCountChange（ConfigPanel 会自动处理端口生成）
      if (onCountChange) {
        onCountChange(newCount)
      } else if (onPortsChange) {
        // 如果没有 onCountChange，则使用 onPortsChange
        onPortsChange(generateImageInputPorts(newCount, portPrefix))
      }
    }
  }, [currentCount, min, onCountChange, onPortsChange, portPrefix])

  // 处理端口变更（advanced 模式）
  const handlePortsChange = useCallback(
    (newPorts: DynamicInputPort[]) => {
      // 转换为 ImageInputPort 格式
      const convertedPorts: ImageInputPort[] = newPorts.map((port) => ({
        id: port.id,
        label: port.label,
        dataType: 'image' as const,
        required: port.required ?? false,
        description: port.description ?? ''
      }))
      onPortsChange?.(convertedPorts)
      // 同时更新数量
      onCountChange?.(newPorts.length)
    },
    [onPortsChange, onCountChange]
  )

  // 转换为 DynamicInputPort 格式（advanced 模式）
  const dynamicPorts: DynamicInputPort[] = useMemo(
    () =>
      ports.map((port) => ({
        id: port.id,
        label: port.label,
        dataType: port.dataType,
        required: port.required,
        description: port.description
      })),
    [ports]
  )

  // simple 模式下，如果没有传入 ports，则根据 count 生成默认端口列表
  const displayPorts = useMemo(() => {
    if (ports.length > 0) return ports
    if (currentCount > 0) return generateImageInputPorts(currentCount, portPrefix)
    return []
  }, [ports, currentCount, portPrefix])

  return (
    <>
      <FormSection title={title}>
        {mode === 'simple' ? (
          <>
            {/* 端口数量统计和 +/- 按钮 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--form-bg-soft, var(--color-bg-soft))',
                borderRadius: 'var(--form-radius-large, 8px)',
                marginBottom: showPortList && displayPorts.length > 0 ? '8px' : '0'
              }}>
              <div style={{ fontSize: 'var(--form-font-label, 13px)', fontWeight: 500 }}>
                {currentCount}/{max} 个输入端口
              </div>
              <div style={{ display: 'flex', gap: 'var(--form-gap-element, 8px)' }}>
                <button
                  onClick={handleRemove}
                  disabled={disabled || currentCount <= min}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid var(--ant-color-border)',
                    background: 'var(--ant-color-bg-container)',
                    cursor: disabled || currentCount <= min ? 'not-allowed' : 'pointer',
                    opacity: disabled || currentCount <= min ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16
                  }}>
                  −
                </button>
                <button
                  onClick={handleAdd}
                  disabled={disabled || currentCount >= max}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid var(--ant-color-primary)',
                    background: 'var(--ant-color-primary)',
                    color: 'white',
                    cursor: disabled || currentCount >= max ? 'not-allowed' : 'pointer',
                    opacity: disabled || currentCount >= max ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16
                  }}>
                  +
                </button>
              </div>
            </div>

            {/* 端口列表（只读显示） */}
            {showPortList && displayPorts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {displayPorts.map((port, index) => (
                  <div
                    key={port.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'var(--ant-color-bg-elevated)',
                      borderRadius: 6,
                      border: '1px solid var(--ant-color-border)'
                    }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: 'var(--ant-color-primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ant-color-text)' }}>
                        {port.label}
                        {port.required && <span style={{ color: 'var(--ant-color-error)', marginLeft: 4 }}>*</span>}
                      </div>
                      {port.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--ant-color-text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                          {port.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAlert && displayPorts.length === 0 && (
              <Alert
                message={alertMessage}
                type="info"
                showIcon
                style={{ fontSize: 'var(--form-font-description, 12px)', marginTop: 8 }}
              />
            )}
          </>
        ) : (
          <DynamicInputPortManager
            value={dynamicPorts}
            onChange={handlePortsChange}
            maxPorts={max}
            minPorts={min}
            portPrefix={portPrefix}
            addButtonText="添加图片输入"
            defaultDataType="image"
            disabled={disabled}
          />
        )}
      </FormSection>
      {showDivider && <Divider style={{ margin: '16px 0' }} />}
    </>
  )
}

export default memo(ImageInputPortSection)
