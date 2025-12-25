/**
 * 图片列表节点
 * 管理图片列表，支持批量处理
 */

import type { NodeDefinition } from '../../base/types'
import { ImageListExecutor } from './executor'

export const ImageListNode: NodeDefinition = {
  metadata: {
    type: 'image_list',
    label: '图片列表',
    icon: '📋',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '管理图片列表，支持批量处理',
    tags: ['list', 'image', 'batch']
  },

  inputs: [
    { id: 'image_1', label: '图片 1', dataType: 'image' },
    { id: 'image_2', label: '图片 2', dataType: 'image' },
    { id: 'image_3', label: '图片 3', dataType: 'image' },
    { id: 'image_4', label: '图片 4', dataType: 'image' },
    { id: 'image_5', label: '图片 5', dataType: 'image' },
    { id: 'images_input', label: '图片列表输入', dataType: 'images' }
  ],

  outputs: [
    { id: 'images', label: '图片列表', dataType: 'images' },
    { id: 'count', label: '数量', dataType: 'text' },
    { id: 'image_at_0', label: '第1张', dataType: 'image' },
    { id: 'image_at_1', label: '第2张', dataType: 'image' },
    { id: 'image_at_2', label: '第3张', dataType: 'image' }
  ],

  configSchema: {
    fields: [
      {
        key: 'maxCapacity',
        label: '最大容量',
        type: 'number',
        default: 100,
        min: 1,
        max: 1000,
        description: '列表最大图片数量'
      },
      {
        key: 'dynamicAdd',
        label: '动态添加',
        type: 'checkbox',
        default: true,
        description: '是否允许动态添加图片'
      }
    ]
  },

  defaultConfig: {
    listType: 'image',
    maxCapacity: 100,
    dynamicAdd: true
  },

  executor: new ImageListExecutor()
}

export { ImageListExecutor }
export default ImageListNode
