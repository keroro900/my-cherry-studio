/**
 * JSON 转换节点
 * JSON Transform Node
 *
 * 常见的 JSON 数据转换操作：
 * - 路径提取
 * - 模板映射
 * - 数组操作
 * - 数据过滤
 */

import type { NodeDefinition } from '../../base/types'
import { JsonTransformExecutor } from './executor'

export const JsonTransformNode: NodeDefinition = {
  metadata: {
    type: 'json_transform',
    label: 'JSON 转换',
    icon: '🔄',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '对 JSON 数据进行转换、提取和映射',
    tags: ['flow', 'json', 'transform', 'map', 'filter', 'data']
  },

  inputs: [
    {
      id: 'input',
      label: '输入数据',
      dataType: 'json',
      required: true,
      description: '要转换的 JSON 数据'
    },
    {
      id: 'template',
      label: '模板',
      dataType: 'json',
      required: false,
      description: '用于映射的模板对象'
    }
  ],

  outputs: [
    {
      id: 'output',
      label: '输出',
      dataType: 'json',
      description: '转换后的数据'
    },
    {
      id: 'count',
      label: '数量',
      dataType: 'number',
      description: '数组长度或对象键数量'
    },
    {
      id: 'keys',
      label: '键列表',
      dataType: 'json',
      description: '对象的所有键'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'operation',
        label: '操作类型',
        type: 'select',
        required: true,
        default: 'extract',
        options: [
          { label: '路径提取', value: 'extract' },
          { label: '模板映射', value: 'map' },
          { label: '数组过滤', value: 'filter' },
          { label: '数组排序', value: 'sort' },
          { label: '数组扁平化', value: 'flatten' },
          { label: '对象合并', value: 'merge' },
          { label: '对象选择', value: 'pick' },
          { label: '对象排除', value: 'omit' },
          { label: '类型转换', value: 'convert' }
        ],
        description: '选择数据转换操作类型'
      },

      // 路径提取
      {
        key: 'path',
        label: 'JSON 路径',
        type: 'text',
        required: false,
        placeholder: 'data.items[0].name',
        description: '提取数据的路径（点号分隔，支持数组索引）'
      },

      // 模板映射
      {
        key: 'mapTemplate',
        label: '映射模板',
        type: 'textarea',
        required: false,
        placeholder: '{\n  "id": "{{id}}",\n  "fullName": "{{firstName}} {{lastName}}"\n}',
        description: 'JSON 模板，使用 {{path}} 引用输入数据'
      },

      // 过滤条件
      {
        key: 'filterCondition',
        label: '过滤条件',
        type: 'text',
        required: false,
        placeholder: 'status === "active" && age > 18',
        description: 'JavaScript 表达式，使用 item 引用数组元素'
      },

      // 排序
      {
        key: 'sortKey',
        label: '排序字段',
        type: 'text',
        required: false,
        placeholder: 'createdAt',
        description: '用于排序的字段名'
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
        description: '排序方向'
      },

      // 扁平化
      {
        key: 'flattenDepth',
        label: '扁平深度',
        type: 'number',
        default: 1,
        min: 1,
        max: 10,
        description: '数组扁平化的深度'
      },

      // 选择/排除字段
      {
        key: 'fields',
        label: '字段列表',
        type: 'text',
        required: false,
        placeholder: 'id, name, email',
        description: '逗号分隔的字段名列表'
      },

      // 类型转换
      {
        key: 'convertTo',
        label: '转换为',
        type: 'select',
        default: 'string',
        options: [
          { label: '字符串', value: 'string' },
          { label: '数字', value: 'number' },
          { label: '布尔值', value: 'boolean' },
          { label: '数组', value: 'array' },
          { label: '对象', value: 'object' }
        ],
        description: '目标数据类型'
      },

      // 默认值
      {
        key: 'defaultValue',
        label: '默认值',
        type: 'textarea',
        required: false,
        placeholder: 'null',
        description: '当结果为空时使用的默认值'
      }
    ]
  },

  defaultConfig: {
    operation: 'extract',
    sortOrder: 'asc',
    flattenDepth: 1,
    convertTo: 'string'
  },

  executor: new JsonTransformExecutor()
}

export { JsonTransformExecutor } from './executor'
export default JsonTransformNode
