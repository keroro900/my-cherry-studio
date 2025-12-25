/**
 * 文本输入节点定义 v2.0
 *
 * 深度优化版本，支持：
 * - 模板变量替换
 * - 多行文本
 * - 文本列表模式
 * - 文件读取模式
 * - 字符统计
 */

import type { NodeDefinition } from '../../base/types'
import { TextInputExecutor } from './executor'

export const TextInputNode: NodeDefinition = {
  metadata: {
    type: 'text_input',
    label: '文本输入',
    icon: '📝',
    category: 'input',
    version: '2.0.0',
    description: '多功能文本输入，支持模板变量、文本列表、文件读取',
    tags: ['input', 'text', 'template', 'prompt']
  },

  inputs: [
    { id: 'var_1', label: '变量 1', dataType: 'text', description: '模板变量 {{var_1}}' },
    { id: 'var_2', label: '变量 2', dataType: 'text', description: '模板变量 {{var_2}}' },
    { id: 'var_3', label: '变量 3', dataType: 'text', description: '模板变量 {{var_3}}' }
  ],

  outputs: [
    { id: 'text', label: '文本', dataType: 'text', description: '处理后的文本' },
    { id: 'lines', label: '文本行', dataType: 'any', description: '按行分割的文本数组' },
    { id: 'lineCount', label: '行数', dataType: 'text', description: '文本行数' },
    { id: 'charCount', label: '字符数', dataType: 'text', description: '字符总数' },
    { id: 'metadata', label: '元数据', dataType: 'json', description: '文本统计信息' }
  ],

  configSchema: {
    fields: [
      // === 输入模式 ===
      {
        key: 'inputMode',
        label: '输入模式',
        type: 'select',
        default: 'text',
        options: [
          { label: '直接输入', value: 'text' },
          { label: '文本列表', value: 'list' },
          { label: '从文件读取', value: 'file' }
        ],
        description: '选择文本输入方式'
      },

      // === 直接输入模式 ===
      {
        key: 'text',
        label: '文本内容',
        type: 'textarea',
        placeholder: '输入文本内容...\n支持模板变量: {{var_1}}, {{var_2}}, {{var_3}}',
        description: '要输出的文本，支持模板变量替换',
        showWhen: { field: 'inputMode', value: 'text' }
      },

      // === 文本列表模式 ===
      {
        key: 'textList',
        label: '文本列表',
        type: 'textarea',
        placeholder: '每行一个文本项\n第一行\n第二行\n第三行',
        description: '每行作为一个独立的文本项',
        showWhen: { field: 'inputMode', value: 'list' }
      },
      {
        key: 'listSeparator',
        label: '分隔符',
        type: 'select',
        default: 'newline',
        options: [
          { label: '换行符', value: 'newline' },
          { label: '逗号', value: 'comma' },
          { label: '分号', value: 'semicolon' },
          { label: '制表符', value: 'tab' },
          { label: '自定义', value: 'custom' }
        ],
        description: '文本列表的分隔符',
        showWhen: { field: 'inputMode', value: 'list' }
      },
      {
        key: 'customSeparator',
        label: '自定义分隔符',
        type: 'text',
        placeholder: '输入分隔符',
        showWhen: { field: 'listSeparator', value: 'custom' }
      },

      // === 文件读取模式 ===
      {
        key: 'filePath',
        label: '文件路径',
        type: 'folder-selector',
        description: '选择要读取的文本文件',
        showWhen: { field: 'inputMode', value: 'file' }
      },
      {
        key: 'encoding',
        label: '文件编码',
        type: 'select',
        default: 'utf-8',
        options: [
          { label: 'UTF-8', value: 'utf-8' },
          { label: 'GBK', value: 'gbk' },
          { label: 'GB2312', value: 'gb2312' },
          { label: 'ASCII', value: 'ascii' }
        ],
        description: '文本文件的编码格式',
        showWhen: { field: 'inputMode', value: 'file' }
      },

      // === 模板选项 ===
      {
        key: 'enableTemplate',
        label: '启用模板变量',
        type: 'checkbox',
        default: true,
        description: '是否替换 {{var_1}}, {{var_2}} 等模板变量'
      },
      {
        key: 'templateSyntax',
        label: '模板语法',
        type: 'select',
        default: 'mustache',
        options: [
          { label: 'Mustache {{var}}', value: 'mustache' },
          { label: 'Dollar ${var}', value: 'dollar' },
          { label: 'Percent %var%', value: 'percent' }
        ],
        description: '模板变量的语法格式',
        showWhen: { field: 'enableTemplate', value: true }
      },

      // === 文本处理 ===
      {
        key: 'trimWhitespace',
        label: '去除首尾空白',
        type: 'checkbox',
        default: true,
        description: '去除文本首尾的空格和换行'
      },
      {
        key: 'removeEmptyLines',
        label: '移除空行',
        type: 'checkbox',
        default: false,
        description: '移除文本中的空行'
      },
      {
        key: 'maxLength',
        label: '最大长度',
        type: 'number',
        placeholder: '不限制',
        min: 0,
        description: '限制输出文本的最大字符数（0 表示不限制）'
      }
    ]
  },

  defaultConfig: {
    inputMode: 'text',
    text: '',
    textList: '',
    listSeparator: 'newline',
    customSeparator: '',
    filePath: '',
    encoding: 'utf-8',
    enableTemplate: true,
    templateSyntax: 'mustache',
    trimWhitespace: true,
    removeEmptyLines: false,
    maxLength: 0
  },

  executor: new TextInputExecutor()
}

export { TextInputExecutor }
export default TextInputNode
