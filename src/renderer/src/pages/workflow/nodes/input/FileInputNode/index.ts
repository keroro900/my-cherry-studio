/**
 * 文件输入节点
 *
 * 支持视频、音频、文档等多种文件类型输入
 */

import type { NodeDefinition } from '../../base/types'
import { FileInputExecutor } from './executor'

export const FileInputNode: NodeDefinition = {
  metadata: {
    type: 'file_input',
    label: '文件输入',
    icon: '📁',
    category: 'input',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '支持视频、音频、文档等多种文件类型输入',
    tags: ['input', 'file', 'video', 'audio', 'document']
  },

  inputs: [],

  outputs: [
    {
      id: 'file',
      label: '文件',
      dataType: 'any',
      description: '输出的文件路径或数据'
    },
    {
      id: 'fileInfo',
      label: '文件信息',
      dataType: 'json',
      description: '文件的元信息（名称、大小、类型等）'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'allowedTypes',
        label: '允许的文件类型',
        type: 'select',
        required: false,
        default: ['video', 'audio', 'document'],
        options: [
          { label: '视频', value: 'video' },
          { label: '音频', value: 'audio' },
          { label: '文档', value: 'document' },
          { label: '图片', value: 'image' },
          { label: '全部', value: 'all' }
        ],
        description: '选择允许上传的文件类型'
      },
      {
        key: 'maxFileSize',
        label: '最大文件大小 (MB)',
        type: 'number',
        required: false,
        default: 100,
        min: 1,
        max: 1000,
        description: '单个文件的最大大小限制'
      },
      {
        key: 'multiple',
        label: '允许多文件',
        type: 'checkbox',
        required: false,
        default: false,
        description: '是否允许选择多个文件'
      }
    ]
  },

  defaultConfig: {
    allowedTypes: ['video', 'audio', 'document'],
    maxFileSize: 100,
    multiple: false,
    files: []
  },

  executor: new FileInputExecutor()
}

export { FileInputExecutor }
export default FileInputNode
