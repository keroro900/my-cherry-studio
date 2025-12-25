import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import type { CSSProperties, FC } from 'react'

interface Props {
  count: number
  min: number
  max: number
  summary: string
  onAdd: () => void
  onRemove: () => void
  // 新增属性
  disabled?: boolean
  className?: string
  style?: CSSProperties
  /** 自定义数量标签，默认 "当前: {count} 个输入端口" */
  countLabel?: string
  /** 添加按钮 tooltip */
  addTooltip?: string
  /** 删除按钮 tooltip */
  removeTooltip?: string
}

/**
 * 图片输入端口计数器组件
 * 统一的图片输入端口增减 UI
 */
const ImageInputCountBar: FC<Props> = ({
  count,
  min,
  max,
  summary,
  onAdd,
  onRemove,
  disabled = false,
  className,
  style,
  countLabel,
  addTooltip,
  removeTooltip
}) => {
  const isMinReached = count <= min
  const isMaxReached = count >= max

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--form-bg-soft, var(--color-bg-soft))',
        borderRadius: 'var(--form-radius-large, 8px)',
        marginBottom: 'var(--form-gap-element, 8px)',
        ...style
      }}>
      <div>
        <div style={{ fontSize: 'var(--form-font-label, 13px)', fontWeight: 500 }}>
          {countLabel ?? `当前: ${count} 个输入端口`}
        </div>
        <div
          style={{ fontSize: 'var(--form-font-small, 11px)', color: 'var(--form-text-tertiary, var(--color-text-3))' }}>
          {summary}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--form-gap-element, 8px)' }}>
        <Tooltip title={removeTooltip ?? (isMinReached ? '已达最小值' : '减少输入端口')}>
          <Button size="small" icon={<MinusOutlined />} onClick={onRemove} disabled={disabled || isMinReached} />
        </Tooltip>
        <Tooltip title={addTooltip ?? (isMaxReached ? `最多 ${max} 个` : '添加输入端口')}>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={onAdd}
            disabled={disabled || isMaxReached}
          />
        </Tooltip>
      </div>
    </div>
  )
}

export default ImageInputCountBar
