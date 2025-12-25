/**
 * 电商预设选择器区块组件
 *
 * 可复用的电商风格预设选择 UI 组件
 *
 * 【Single Source of Truth】
 * 预设选项从 presets/ecomStyle.ts 自动生成
 * 添加/删除预设时 UI 自动同步
 */

import { ShopOutlined } from '@ant-design/icons'
import { Collapse } from 'antd'
import { memo, useMemo } from 'react'

import { ECOM_STYLE_PRESETS } from '../../../presets'

export interface EcomPresetSectionProps {
  /** 当前选中的预设 ID */
  selectedPresetId?: string
  /** 预设变更回调 */
  onPresetChange: (presetId: string, presetName: string) => void
  /** 是否默认折叠 */
  defaultCollapsed?: boolean
  /** 自定义标题 */
  title?: string
}

function EcomPresetSection({
  selectedPresetId,
  onPresetChange,
  defaultCollapsed = true,
  title = '电商风格预设'
}: EcomPresetSectionProps) {
  // 从注册表获取预设选项 - 添加/删除预设时自动同步
  const presetOptions = useMemo(() => ECOM_STYLE_PRESETS.getOptions(), [])

  return (
    <Collapse
      ghost
      defaultActiveKey={defaultCollapsed ? [] : ['ecom-presets']}
      style={{ marginTop: '8px' }}
      items={[
        {
          key: 'ecom-presets',
          label: (
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              <ShopOutlined style={{ marginRight: 8 }} />
              {title}
            </span>
          ),
          children: (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {presetOptions.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => onPresetChange(preset.id, preset.name)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border:
                        selectedPresetId === preset.id
                          ? '2px solid var(--ant-color-primary)'
                          : '1px solid var(--ant-color-border)',
                      backgroundColor:
                        selectedPresetId === preset.id ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-bg-elevated)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all 0.2s'
                    }}>
                    <div style={{ fontWeight: 500 }}>{preset.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ant-color-text-tertiary)', marginTop: '2px' }}>
                      {preset.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      ]}
    />
  )
}

export default memo(EcomPresetSection)
