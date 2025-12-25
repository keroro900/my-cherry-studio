/**
 * 自定义节点类型定义
 * Custom Node Type Definitions
 *
 * 支持用户在 UI 端创建和管理自定义节点：
 * - 可视化节点配置
 * - 自定义输入/输出端口
 * - JavaScript 代码执行逻辑
 * - 节点模板和分享
 */

import type { PortDataType, PortDefinition } from '../base/types'

/**
 * 自定义节点端口配置
 */
export interface CustomPortConfig {
  id: string
  label: string
  dataType: PortDataType
  required?: boolean
  description?: string
  defaultValue?: any
}

/**
 * 自定义节点配置字段
 */
export interface CustomConfigField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'color'
  required?: boolean
  default?: any
  placeholder?: string
  description?: string
  min?: number
  max?: number
  options?: Array<{ label: string; value: string }>
}

/**
 * 代码执行模式
 */
export type CodeExecutionMode = 'sync' | 'async'

/**
 * 错误处理策略
 */
export type ErrorHandlingStrategy = 'throw' | 'null' | 'default' | 'retry'

/**
 * 自定义节点定义
 */
export interface CustomNodeDefinition {
  /** 唯一标识符 */
  id: string
  /** 节点类型（用于注册，会加上 custom_ 前缀） */
  type: string
  /** 显示名称 */
  label: string
  /** 图标（emoji 或图标名称） */
  icon: string
  /** 节点颜色 */
  color?: string
  /** 描述 */
  description: string
  /** 分类 */
  category: 'custom' | 'flow' | 'image' | 'text' | 'external'
  /** 标签 */
  tags?: string[]
  /** 版本 */
  version: string
  /** 作者 */
  author?: string

  /** 输入端口配置 */
  inputs: CustomPortConfig[]
  /** 输出端口配置 */
  outputs: CustomPortConfig[]
  /** 配置字段 */
  configFields: CustomConfigField[]
  /** 默认配置 */
  defaultConfig: Record<string, any>

  /** 执行代码 */
  code: string
  /** 执行模式 */
  executionMode: CodeExecutionMode
  /** 超时时间（秒） */
  timeout: number
  /** 错误处理策略 */
  errorHandling: ErrorHandlingStrategy
  /** 默认返回值（错误时使用） */
  defaultReturnValue?: any

  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 是否启用 */
  enabled: boolean
  /** 是否公开分享 */
  isPublic?: boolean
}

/**
 * 自定义节点存储
 */
export interface CustomNodeStorage {
  /** 所有自定义节点定义 */
  nodes: CustomNodeDefinition[]
  /** 版本号 */
  version: number
  /** 最后更新时间 */
  lastUpdated: number
}

/**
 * 自定义节点模板
 */
export interface CustomNodeTemplate {
  id: string
  name: string
  description: string
  category: string
  definition: Omit<CustomNodeDefinition, 'id' | 'createdAt' | 'updatedAt'>
}

/**
 * 内置模板列表
 */
export const BUILTIN_TEMPLATES: CustomNodeTemplate[] = [
  {
    id: 'template_text_formatter',
    name: '文本格式化',
    description: '格式化和转换文本数据',
    category: 'text',
    definition: {
      type: 'text_formatter',
      label: '文本格式化',
      icon: '📝',
      description: '格式化和转换文本数据',
      category: 'custom',
      version: '1.0.0',
      inputs: [
        { id: 'text', label: '输入文本', dataType: 'text', required: true },
        { id: 'template', label: '模板', dataType: 'text' }
      ],
      outputs: [
        { id: 'result', label: '结果', dataType: 'text' },
        { id: 'length', label: '长度', dataType: 'number' }
      ],
      configFields: [
        {
          key: 'operation',
          label: '操作',
          type: 'select',
          default: 'trim',
          options: [
            { label: '去空格', value: 'trim' },
            { label: '大写', value: 'uppercase' },
            { label: '小写', value: 'lowercase' },
            { label: '首字母大写', value: 'capitalize' }
          ]
        }
      ],
      defaultConfig: { operation: 'trim' },
      code: `// 文本格式化
const text = inputs.text || '';
const operation = config.operation || 'trim';

let result = text;
switch (operation) {
  case 'trim': result = text.trim(); break;
  case 'uppercase': result = text.toUpperCase(); break;
  case 'lowercase': result = text.toLowerCase(); break;
  case 'capitalize': result = text.charAt(0).toUpperCase() + text.slice(1); break;
}

outputs.length = result.length;
return result;`,
      executionMode: 'sync',
      timeout: 10,
      errorHandling: 'throw',
      enabled: true
    }
  },
  {
    id: 'template_json_picker',
    name: 'JSON 选择器',
    description: '从 JSON 数据中提取指定字段',
    category: 'flow',
    definition: {
      type: 'json_picker',
      label: 'JSON 选择器',
      icon: '🎯',
      description: '从 JSON 数据中提取指定字段',
      category: 'custom',
      version: '1.0.0',
      inputs: [
        { id: 'data', label: '输入数据', dataType: 'json', required: true }
      ],
      outputs: [
        { id: 'value', label: '提取值', dataType: 'any' },
        { id: 'found', label: '是否找到', dataType: 'boolean' }
      ],
      configFields: [
        { key: 'path', label: '路径', type: 'text', placeholder: 'data.items[0].name', description: '点号分隔的路径' },
        { key: 'defaultValue', label: '默认值', type: 'text', description: '未找到时返回的值' }
      ],
      defaultConfig: { path: '', defaultValue: '' },
      code: `// JSON 路径提取
const data = inputs.data;
const path = config.path || '';
const defaultValue = config.defaultValue;

if (!path) {
  outputs.found = true;
  return data;
}

const parts = path.split(/[.\\[\\]]/).filter(Boolean);
let result = data;

for (const part of parts) {
  if (result === undefined || result === null) {
    outputs.found = false;
    return defaultValue;
  }
  result = result[part];
}

outputs.found = result !== undefined;
return result !== undefined ? result : defaultValue;`,
      executionMode: 'sync',
      timeout: 10,
      errorHandling: 'default',
      defaultReturnValue: null,
      enabled: true
    }
  },
  {
    id: 'template_api_caller',
    name: 'API 调用器',
    description: '简化版 API 调用节点',
    category: 'external',
    definition: {
      type: 'api_caller',
      label: 'API 调用器',
      icon: '🔗',
      description: '简化版 API 调用节点',
      category: 'custom',
      version: '1.0.0',
      inputs: [
        { id: 'url', label: 'URL', dataType: 'text', required: true },
        { id: 'payload', label: '数据', dataType: 'json' }
      ],
      outputs: [
        { id: 'data', label: '响应数据', dataType: 'json' },
        { id: 'success', label: '是否成功', dataType: 'boolean' }
      ],
      configFields: [
        {
          key: 'method',
          label: '方法',
          type: 'select',
          default: 'GET',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' }
          ]
        },
        { key: 'headers', label: '请求头', type: 'textarea', placeholder: '{"Authorization": "Bearer xxx"}' }
      ],
      defaultConfig: { method: 'GET', headers: '' },
      code: `// API 调用
const url = inputs.url;
const payload = inputs.payload;
const method = config.method || 'GET';
let headers = {};

try {
  if (config.headers) {
    headers = JSON.parse(config.headers);
  }
} catch (e) {
  console.log('Invalid headers JSON');
}

const options = {
  method,
  headers: { 'Content-Type': 'application/json', ...headers }
};

if (method !== 'GET' && payload) {
  options.body = JSON.stringify(payload);
}

const response = await fetch(url, options);
const data = await response.json();

outputs.success = response.ok;
return data;`,
      executionMode: 'async',
      timeout: 30,
      errorHandling: 'throw',
      enabled: true
    }
  },
  {
    id: 'template_data_merger',
    name: '数据合并器',
    description: '合并多个数据源',
    category: 'flow',
    definition: {
      type: 'data_merger',
      label: '数据合并器',
      icon: '🔀',
      description: '合并多个数据源',
      category: 'custom',
      version: '1.0.0',
      inputs: [
        { id: 'data1', label: '数据 1', dataType: 'any' },
        { id: 'data2', label: '数据 2', dataType: 'any' },
        { id: 'data3', label: '数据 3', dataType: 'any' }
      ],
      outputs: [
        { id: 'merged', label: '合并结果', dataType: 'json' },
        { id: 'count', label: '数量', dataType: 'number' }
      ],
      configFields: [
        {
          key: 'mergeMode',
          label: '合并模式',
          type: 'select',
          default: 'object',
          options: [
            { label: '对象合并', value: 'object' },
            { label: '数组合并', value: 'array' },
            { label: '深度合并', value: 'deep' }
          ]
        }
      ],
      defaultConfig: { mergeMode: 'object' },
      code: `// 数据合并
const data1 = inputs.data1;
const data2 = inputs.data2;
const data3 = inputs.data3;
const mode = config.mergeMode || 'object';

const items = [data1, data2, data3].filter(d => d !== undefined && d !== null);
outputs.count = items.length;

if (items.length === 0) return null;
if (items.length === 1) return items[0];

if (mode === 'array') {
  return items.flat();
}

if (mode === 'object' || mode === 'deep') {
  return items.reduce((acc, item) => {
    if (typeof item === 'object' && !Array.isArray(item)) {
      return { ...acc, ...item };
    }
    return acc;
  }, {});
}

return items;`,
      executionMode: 'sync',
      timeout: 10,
      errorHandling: 'null',
      enabled: true
    }
  },
  {
    id: 'template_delay',
    name: '延迟节点',
    description: '暂停执行指定时间',
    category: 'flow',
    definition: {
      type: 'delay',
      label: '延迟',
      icon: '⏱️',
      description: '暂停执行指定时间',
      category: 'custom',
      version: '1.0.0',
      inputs: [
        { id: 'input', label: '输入', dataType: 'any' }
      ],
      outputs: [
        { id: 'output', label: '输出', dataType: 'any' },
        { id: 'duration', label: '实际延迟', dataType: 'number' }
      ],
      configFields: [
        { key: 'delayMs', label: '延迟时间 (ms)', type: 'number', default: 1000, min: 0, max: 60000 }
      ],
      defaultConfig: { delayMs: 1000 },
      code: `// 延迟执行
const delayMs = config.delayMs || 1000;
const start = Date.now();

await new Promise(resolve => setTimeout(resolve, delayMs));

outputs.duration = Date.now() - start;
return inputs.input;`,
      executionMode: 'async',
      timeout: 120,
      errorHandling: 'throw',
      enabled: true
    }
  }
]

/**
 * 验证自定义节点定义
 */
export function validateCustomNodeDefinition(def: Partial<CustomNodeDefinition>): string[] {
  const errors: string[] = []

  if (!def.type || def.type.trim() === '') {
    errors.push('节点类型不能为空')
  } else if (!/^[a-z][a-z0-9_]*$/.test(def.type)) {
    errors.push('节点类型只能包含小写字母、数字和下划线，且必须以字母开头')
  }

  if (!def.label || def.label.trim() === '') {
    errors.push('节点名称不能为空')
  }

  if (!def.inputs || def.inputs.length === 0) {
    errors.push('至少需要一个输入端口')
  }

  if (!def.outputs || def.outputs.length === 0) {
    errors.push('至少需要一个输出端口')
  }

  if (!def.code || def.code.trim() === '') {
    errors.push('执行代码不能为空')
  }

  // 验证端口 ID 唯一性
  const inputIds = new Set<string>()
  for (const input of def.inputs || []) {
    if (inputIds.has(input.id)) {
      errors.push(`输入端口 ID "${input.id}" 重复`)
    }
    inputIds.add(input.id)
  }

  const outputIds = new Set<string>()
  for (const output of def.outputs || []) {
    if (outputIds.has(output.id)) {
      errors.push(`输出端口 ID "${output.id}" 重复`)
    }
    outputIds.add(output.id)
  }

  // 验证配置字段 key 唯一性
  const configKeys = new Set<string>()
  for (const field of def.configFields || []) {
    if (configKeys.has(field.key)) {
      errors.push(`配置字段 key "${field.key}" 重复`)
    }
    configKeys.add(field.key)
  }

  return errors
}

/**
 * 创建默认自定义节点定义
 */
export function createDefaultCustomNodeDefinition(): CustomNodeDefinition {
  const now = Date.now()
  return {
    id: `custom_${now}`,
    type: 'my_custom_node',
    label: '自定义节点',
    icon: '⚡',
    description: '自定义节点',
    category: 'custom',
    version: '1.0.0',
    inputs: [
      { id: 'input', label: '输入', dataType: 'any', required: true }
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' }
    ],
    configFields: [],
    defaultConfig: {},
    code: `// 自定义节点代码
// inputs: 所有输入数据
// config: 节点配置
// outputs: 设置额外输出
// console.log(): 记录日志

const data = inputs.input;
return data;`,
    executionMode: 'sync',
    timeout: 30,
    errorHandling: 'throw',
    createdAt: now,
    updatedAt: now,
    enabled: true
  }
}
