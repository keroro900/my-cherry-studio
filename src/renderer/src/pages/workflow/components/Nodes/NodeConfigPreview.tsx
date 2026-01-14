/**
 * 节点配置预览组件 v2.0
 * 在节点内显示关键配置项的可交互标签
 *
 * 特性：
 * - 根据节点类型显示不同的配置项
 * - 点击标签可直接修改配置值
 * - 支持下拉选择和循环切换
 * - 支持自定义显示规则
 */

import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { ChevronDown } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

interface NodeConfigPreviewProps {
  config: Record<string, any>
  nodeType: string
  /** 最多显示几个标签 */
  maxItems?: number
  /** 配置变更回调 */
  onConfigChange?: (key: string, value: any) => void
}

// 配置项选项定义
interface ConfigOption {
  value: any
  label: string
}

// 配置项显示规则
interface ConfigRule {
  key: string
  label: string
  format?: (v: any) => string
  options?: ConfigOption[]
  /** 是否只读（不可点击修改） */
  readonly?: boolean
}

// 配置项显示规则 - 按节点类型定义要显示的配置项
const CONFIG_DISPLAY_RULES: Record<string, ConfigRule[]> = {
  // AI 提示词节点
  unified_prompt: [
    {
      key: 'styleMode',
      label: '风格',
      format: (v) => (v === 'commercial' ? '商拍感' : '日常感'),
      options: [
        { value: 'daily', label: '日常感' },
        { value: 'commercial', label: '商拍感' }
      ]
    },
    {
      key: 'ageGroup',
      label: '年龄',
      format: (v) => ({ small_kid: '小童', big_kid: '大童', adult: '成人' }[v] || v),
      options: [
        { value: 'small_kid', label: '小童' },
        { value: 'big_kid', label: '大童' },
        { value: 'adult', label: '成人' }
      ]
    },
    {
      key: 'gender',
      label: '性别',
      format: (v) => (v === 'male' ? '男' : '女'),
      options: [
        { value: 'female', label: '女' },
        { value: 'male', label: '男' }
      ]
    }
  ],
  video_prompt: [
    {
      key: 'duration',
      label: '时长',
      format: (v) => `${v}秒`,
      options: [
        { value: 5, label: '5秒' },
        { value: 10, label: '10秒' }
      ]
    },
    {
      key: 'aspectRatio',
      label: '比例',
      options: [
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
        { value: '1:1', label: '1:1' }
      ]
    }
  ],

  // Gemini 节点
  gemini_generate: [
    {
      key: 'imageSize',
      label: '尺寸',
      options: [
        { value: '1024x1024', label: '1K' },
        { value: '2048x2048', label: '2K' },
        { value: '4096x4096', label: '4K' }
      ]
    },
    {
      key: 'aspectRatio',
      label: '比例',
      options: [
        { value: '1:1', label: '1:1' },
        { value: '3:4', label: '3:4' },
        { value: '4:3', label: '4:3' },
        { value: '9:16', label: '9:16' },
        { value: '16:9', label: '16:9' }
      ]
    },
    {
      key: 'numberOfImages',
      label: '数量',
      format: (v) => `${v}张`,
      options: [
        { value: 1, label: '1张' },
        { value: 2, label: '2张' },
        { value: 4, label: '4张' }
      ]
    }
  ],
  gemini_edit: [
    {
      key: 'editMode',
      label: '模式',
      options: [
        { value: 'inpaint', label: '局部重绘' },
        { value: 'outpaint', label: '扩展画布' },
        { value: 'remove', label: '移除对象' }
      ]
    },
    { key: 'mask', label: '蒙版', format: (v) => (v ? '有' : '无'), readonly: true }
  ],
  gemini_ecom: [
    {
      key: 'enableBack',
      label: '背面',
      format: (v) => (v ? '开启' : '关闭'),
      options: [
        { value: true, label: '开启' },
        { value: false, label: '关闭' }
      ]
    },
    {
      key: 'sceneType',
      label: '场景',
      options: [
        { value: 'studio', label: '影棚' },
        { value: 'lifestyle', label: '生活' },
        { value: 'outdoor', label: '户外' }
      ]
    }
  ],
  gemini_pattern: [
    {
      key: 'generationMode',
      label: '模式',
      options: [
        { value: 'mode_a', label: '元素重组' },
        { value: 'mode_b', label: '纯无缝化' },
        { value: 'mode_c', label: '设计大师' }
      ]
    },
    {
      key: 'patternType',
      label: '类型',
      options: [
        { value: 'seamless', label: '无缝拼贴' },
        { value: 'placement', label: '定位印花' },
        { value: 'allover', label: '满印图案' }
      ]
    },
    {
      key: 'density',
      label: '密度',
      options: [
        { value: 'sparse', label: '稀疏' },
        { value: 'medium', label: '适中' },
        { value: 'dense', label: '密集' }
      ]
    }
  ],

  // 视频节点
  kling_image2video: [
    {
      key: 'duration',
      label: '时长',
      format: (v) => `${v}秒`,
      options: [
        { value: 5, label: '5秒' },
        { value: 10, label: '10秒' }
      ]
    },
    {
      key: 'aspectRatio',
      label: '比例',
      options: [
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
        { value: '1:1', label: '1:1' }
      ]
    },
    {
      key: 'mode',
      label: '模式',
      options: [
        { value: 'std', label: '标准' },
        { value: 'pro', label: '专业' }
      ]
    }
  ],

  // 行业摄影节点
  jewelry_photo: [
    {
      key: 'jewelryType',
      label: '类型',
      options: [
        { value: 'ring', label: '戒指' },
        { value: 'necklace', label: '项链' },
        { value: 'earring', label: '耳环' },
        { value: 'bracelet', label: '手链' }
      ]
    },
    {
      key: 'lighting',
      label: '光线',
      options: [
        { value: 'soft', label: '柔光' },
        { value: 'dramatic', label: '戏剧' },
        { value: 'studio', label: '影棚' }
      ]
    }
  ],
  food_photo: [
    {
      key: 'dishType',
      label: '菜品',
      options: [
        { value: 'western', label: '西餐' },
        { value: 'chinese', label: '中餐' },
        { value: 'dessert', label: '甜点' },
        { value: 'drink', label: '饮品' }
      ]
    },
    {
      key: 'style',
      label: '风格',
      options: [
        { value: 'minimal', label: '简约' },
        { value: 'rustic', label: '田园' },
        { value: 'modern', label: '现代' }
      ]
    }
  ],

  // 流程控制
  condition: [{ key: 'condition', label: '条件', format: (v) => (v ? v.slice(0, 10) + '...' : '未设置'), readonly: true }],
  loop: [
    {
      key: 'maxIterations',
      label: '次数',
      format: (v) => `${v}次`,
      options: [
        { value: 1, label: '1次' },
        { value: 3, label: '3次' },
        { value: 5, label: '5次' },
        { value: 10, label: '10次' }
      ]
    }
  ]
}

// 通用配置项（适用于所有节点）
const COMMON_CONFIG_ITEMS: ConfigRule[] = [
  {
    key: 'temperature',
    label: 'Temp',
    format: (v: number) => v?.toFixed(1),
    options: [
      { value: 0.3, label: '0.3' },
      { value: 0.5, label: '0.5' },
      { value: 0.7, label: '0.7' },
      { value: 1.0, label: '1.0' },
      { value: 1.5, label: '1.5' }
    ]
  }
]

/**
 * 节点配置预览
 */
function NodeConfigPreview({ config, nodeType, maxItems = 3, onConfigChange }: NodeConfigPreviewProps) {
  const displayItems = useMemo(() => {
    const items: Array<{ key: string; label: string; value: string; options?: ConfigOption[]; readonly?: boolean }> = []

    // 获取该节点类型的显示规则
    const rules = CONFIG_DISPLAY_RULES[nodeType] || []

    // 先处理节点特定的配置
    for (const rule of rules) {
      if (config[rule.key] !== undefined && config[rule.key] !== null && config[rule.key] !== '') {
        const value = rule.format ? rule.format(config[rule.key]) : String(config[rule.key])
        items.push({
          key: rule.key,
          label: rule.label,
          value,
          options: rule.options,
          readonly: rule.readonly
        })
      }
      if (items.length >= maxItems) break
    }

    // 如果还有空位，添加通用配置
    if (items.length < maxItems) {
      for (const item of COMMON_CONFIG_ITEMS) {
        if (config[item.key] !== undefined && items.length < maxItems) {
          const value = item.format ? item.format(config[item.key]) : String(config[item.key])
          items.push({
            key: item.key,
            label: item.label,
            value,
            options: item.options,
            readonly: item.readonly
          })
        }
      }
    }

    return items
  }, [config, nodeType, maxItems])

  // 处理配置项点击
  const handleConfigClick = useCallback(
    (key: string, newValue: any) => {
      if (onConfigChange) {
        onConfigChange(key, newValue)
      }
    },
    [onConfigChange]
  )

  // 生成下拉菜单项
  const getMenuItems = useCallback(
    (item: { key: string; options?: ConfigOption[] }): MenuProps['items'] => {
      if (!item.options) return []
      return item.options.map((opt) => ({
        key: String(opt.value),
        label: opt.label,
        onClick: () => handleConfigClick(item.key, opt.value)
      }))
    },
    [handleConfigClick]
  )

  if (displayItems.length === 0) {
    return null
  }

  return (
    <PreviewContainer className="nodrag">
      {displayItems.map((item, index) => {
        // 只读标签不可点击
        if (item.readonly || !item.options || !onConfigChange) {
          return (
            <ConfigTag key={index} $clickable={false}>
              <TagLabel>{item.label}</TagLabel>
              <TagValue>{item.value}</TagValue>
            </ConfigTag>
          )
        }

        // 可交互标签 - 使用下拉菜单
        return (
          <Dropdown
            key={index}
            menu={{ items: getMenuItems(item), selectedKeys: [String(config[item.key])] }}
            trigger={['click']}
            placement="bottom">
            <ConfigTag $clickable={true}>
              <TagLabel>{item.label}</TagLabel>
              <TagValue>{item.value}</TagValue>
              <TagArrow>
                <ChevronDown size={10} />
              </TagArrow>
            </ConfigTag>
          </Dropdown>
        )
      })}
    </PreviewContainer>
  )
}

export default memo(NodeConfigPreview)

// ==================== 样式 ====================

const PreviewContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 14px 10px;
`

const ConfigTag = styled.div<{ $clickable?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border-mute);
  font-size: 11px;
  cursor: ${(props) => (props.$clickable ? 'pointer' : 'default')};
  transition: all 0.15s ease;
  user-select: none;

  ${(props) =>
    props.$clickable &&
    `
    &:hover {
      border-color: var(--color-primary);
      background: var(--color-primary-mute);
    }

    &:active {
      transform: scale(0.97);
    }
  `}
`

const TagLabel = styled.span`
  color: var(--color-text-3);
`

const TagValue = styled.span`
  color: var(--color-text);
  font-weight: 600;
`

const TagArrow = styled.span`
  display: flex;
  align-items: center;
  color: var(--color-text-3);
  margin-left: 2px;
`
