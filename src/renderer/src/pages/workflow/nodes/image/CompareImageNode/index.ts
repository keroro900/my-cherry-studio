/**
 * 图片对比节点定义 v2.0
 *
 * 重新设计：
 * - 左右横拉对比样式（类似 Before/After 滑块）
 * - 两个输入端口（原图 + 编辑后）
 * - 无输出端口（纯展示节点）
 * - 支持在节点内直接预览对比效果
 */

import type { NodeDefinition } from '../../base/types'
import { CompareImageExecutor } from './executor'

export const CompareImageNode: NodeDefinition = {
  metadata: {
    type: 'compare_image',
    label: '图片对比',
    icon: '⚖️',
    category: 'image',
    version: '2.0.0',
    description: '左右横拉对比原图和编辑后的图片',
    tags: ['image', 'compare', 'utility', 'preview']
  },

  inputs: [
    { id: 'beforeImage', label: '原图 (Before)', dataType: 'image', required: true, description: '原始图片' },
    { id: 'afterImage', label: '编辑后 (After)', dataType: 'image', required: true, description: '编辑后的图片' }
  ],

  // 无输出端口 - 纯展示节点
  outputs: [],

  configSchema: {
    fields: [
      {
        key: 'initialPosition',
        label: '初始滑块位置',
        type: 'number',
        default: 50,
        min: 0,
        max: 100,
        description: '滑块初始位置百分比 (0-100)'
      },
      {
        key: 'showLabels',
        label: '显示标签',
        type: 'checkbox',
        default: true,
        description: '是否显示 Before/After 标签'
      },
      {
        key: 'previewSize',
        label: '预览尺寸',
        type: 'select',
        default: 'medium',
        options: [
          { label: '小 (200px)', value: 'small' },
          { label: '中 (300px)', value: 'medium' },
          { label: '大 (400px)', value: 'large' }
        ]
      }
    ]
  },

  defaultConfig: {
    initialPosition: 50,
    showLabels: true,
    previewSize: 'medium'
  },

  executor: new CompareImageExecutor()
}

export { CompareImageExecutor }
export default CompareImageNode
