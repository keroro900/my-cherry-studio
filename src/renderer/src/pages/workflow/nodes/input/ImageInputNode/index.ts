/**
 * 图片输入节点定义 v2.0
 *
 * 深度优化版本，支持：
 * - 多种输入模式（拖拽上传、文件夹、URL）
 * - 批量图片处理
 * - 图片筛选和排序
 * - 动态输出端口
 * - 图片匹配模式
 */

import type { NodeDefinition } from '../../base/types'
import { ImageInputExecutor } from './executor'

export const ImageInputNode: NodeDefinition = {
  metadata: {
    type: 'image_input',
    label: '图片输入',
    icon: '🖼️',
    category: 'input',
    version: '2.0.0',
    description: '多模式图片输入，支持拖拽上传、文件夹选择、URL 输入',
    tags: ['input', 'image', 'folder', 'batch', 'upload']
  },

  inputs: [],

  outputs: [
    { id: 'images', label: '全部图片', dataType: 'images', description: '所有输入图片数组' },
    { id: 'image_1', label: '图片 1', dataType: 'image', description: '第一张图片' },
    { id: 'image_2', label: '图片 2', dataType: 'image', description: '第二张图片' },
    { id: 'image_3', label: '图片 3', dataType: 'image', description: '第三张图片' },
    { id: 'count', label: '图片数量', dataType: 'text', description: '图片总数' },
    { id: 'metadata', label: '元数据', dataType: 'json', description: '图片信息和配置' }
  ],

  configSchema: {
    fields: [
      // === 输入模式 ===
      {
        key: 'inputMode',
        label: '输入模式',
        type: 'select',
        default: 'upload',
        options: [
          { label: '拖拽上传', value: 'upload' },
          { label: '文件夹路径', value: 'folder' },
          { label: 'URL 输入', value: 'url' }
        ],
        description: '选择图片输入方式'
      },

      // === 拖拽上传模式 ===
      {
        key: 'uploadedImages',
        label: '上传图片',
        type: 'image-upload',
        description: '拖拽或点击上传图片（支持多选）',
        showWhen: { field: 'inputMode', value: 'upload' }
      },

      // === 文件夹模式 ===
      {
        key: 'folderPaths',
        label: '文件夹路径',
        type: 'folder-selector',
        description: '选择包含图片的文件夹',
        showWhen: { field: 'inputMode', value: 'folder' }
      },
      {
        key: 'recursive',
        label: '递归扫描子文件夹',
        type: 'checkbox',
        default: false,
        description: '是否扫描子文件夹中的图片',
        showWhen: { field: 'inputMode', value: 'folder' }
      },

      // === URL 模式 ===
      {
        key: 'imageUrls',
        label: '图片 URL',
        type: 'textarea',
        placeholder: '每行一个 URL\nhttps://example.com/image1.jpg\nhttps://example.com/image2.png',
        description: '输入图片 URL，每行一个',
        showWhen: { field: 'inputMode', value: 'url' }
      },

      // === 筛选选项 ===
      {
        key: 'fileFilter',
        label: '文件筛选',
        type: 'text',
        placeholder: '*.jpg,*.png,*.webp',
        description: '文件扩展名筛选（逗号分隔），留空则包含所有图片格式'
      },
      {
        key: 'maxImages',
        label: '最大图片数',
        type: 'number',
        default: 100,
        min: 1,
        max: 1000,
        description: '限制输入的最大图片数量'
      },

      // === 排序选项 ===
      {
        key: 'sortBy',
        label: '排序方式',
        type: 'select',
        default: 'name',
        options: [
          { label: '按文件名', value: 'name' },
          { label: '按修改时间', value: 'modified' },
          { label: '按文件大小', value: 'size' },
          { label: '自然排序', value: 'natural' }
        ],
        description: '图片排序方式'
      },
      {
        key: 'sortOrder',
        label: '排序顺序',
        type: 'select',
        default: 'asc',
        options: [
          { label: '升序', value: 'asc' },
          { label: '降序', value: 'desc' }
        ],
        description: '排序顺序'
      },

      // === 匹配模式 ===
      {
        key: 'matchMode',
        label: '匹配模式',
        type: 'select',
        default: 'byOrder',
        options: [
          { label: '按顺序匹配', value: 'byOrder' },
          { label: '按文件名匹配', value: 'byName' },
          { label: '混合匹配', value: 'hybrid' }
        ],
        description: '多文件夹时的图片匹配方式'
      },

      // === 输出配置 ===
      {
        key: 'outputPorts',
        label: '输出端口数',
        type: 'number',
        default: 3,
        min: 1,
        max: 10,
        description: '生成的单图输出端口数量 (image_1, image_2, ...)'
      },
      {
        key: 'skipEmpty',
        label: '跳过空值',
        type: 'checkbox',
        default: true,
        description: '当图片不足时，跳过空的输出端口'
      }
    ]
  },

  defaultConfig: {
    inputMode: 'upload',
    uploadedImages: [],
    folderPaths: [],
    imageUrls: '',
    recursive: false,
    fileFilter: '',
    maxImages: 100,
    sortBy: 'name',
    sortOrder: 'asc',
    matchMode: 'byOrder',
    outputPorts: 3,
    skipEmpty: true
  },

  executor: new ImageInputExecutor()
}

export { ImageInputExecutor }
export default ImageInputNode
