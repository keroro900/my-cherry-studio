/**
 * 节点模板生成器
 *
 * 提供节点创建的工厂方法和模板生成功能
 * 简化新节点的开发流程
 *
 * 注意：此文件使用 node-schema.ts 中的类型以避免循环依赖
 */

import type {
  BaseNodeDefinition,
  ConfigFieldSchema,
  ExtendedNodeDefinition,
  NodeCategory,
  NodeConfigSchema,
  SchemaDataType,
  SchemaNodeHandle
} from './node-schema'
import { createHandle, generateNodeId } from './node-schema'

// ==================== 节点模板 ====================

/**
 * 节点模板类型
 */
export interface NodeTemplate {
  /** 模板 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string
  /** 基于的节点类型 */
  baseType: string
  /** 预设配置 */
  presetConfig: Record<string, any>
  /** 自定义输入端口 */
  customInputs?: SchemaNodeHandle[]
  /** 自定义输出端口 */
  customOutputs?: SchemaNodeHandle[]
  /** 标签 */
  tags?: string[]
  /** 图标 */
  icon?: string
}

/**
 * 节点创建参数
 */
export interface CreateNodeParams {
  /** 节点类型 */
  type: string
  /** 节点位置 */
  position?: { x: number; y: number }
  /** 配置覆盖 */
  config?: Record<string, any>
  /** 自定义标签 */
  label?: string
  /** 自定义输入端口 */
  inputs?: SchemaNodeHandle[]
  /** 自定义输出端口 */
  outputs?: SchemaNodeHandle[]
}

/**
 * 创建的节点数据
 */
export interface CreatedNodeData {
  label: string
  nodeType: string
  description?: string
  inputs: SchemaNodeHandle[]
  outputs: SchemaNodeHandle[]
  config: Record<string, any>
  status: 'idle'
}

/**
 * 创建的节点
 */
export interface CreatedNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: CreatedNodeData
}

// ==================== 节点工厂 ====================

/**
 * 节点定义存储（用于工厂函数）
 */
const nodeDefinitions = new Map<string, BaseNodeDefinition>()

/**
 * 注册节点定义（供工厂使用）
 */
export function registerNodeDefinition(definition: BaseNodeDefinition): void {
  nodeDefinitions.set(definition.type, definition)
}

/**
 * 获取节点定义
 */
export function getFactoryNodeDefinition(type: string): BaseNodeDefinition | undefined {
  return nodeDefinitions.get(type)
}

/**
 * 创建工作流节点
 *
 * @param params - 创建参数
 * @returns 创建的节点
 */
export function createNode(params: CreateNodeParams): CreatedNode {
  const { type, position = { x: 100, y: 100 }, config = {}, label, inputs, outputs } = params

  // 获取节点定义
  const definition = getFactoryNodeDefinition(type)

  // 生成节点 ID
  const nodeId = generateNodeId(type)

  // 如果有定义，使用定义的默认值
  if (definition) {
    const mergedConfig = {
      ...definition.defaultConfig,
      ...config
    }

    const nodeInputs = inputs || [...definition.defaultInputs]
    const nodeOutputs = outputs || [...definition.defaultOutputs]

    const nodeData: CreatedNodeData = {
      label: label || definition.label,
      nodeType: type,
      description: definition.description,
      inputs: nodeInputs,
      outputs: nodeOutputs,
      config: mergedConfig,
      status: 'idle'
    }

    return {
      id: nodeId,
      type: 'workflowNode',
      position,
      data: nodeData
    }
  }

  // 没有定义时，使用传入的参数
  const nodeData: CreatedNodeData = {
    label: label || type,
    nodeType: type,
    inputs: inputs || [],
    outputs: outputs || [],
    config,
    status: 'idle'
  }

  return {
    id: nodeId,
    type: 'workflowNode',
    position,
    data: nodeData
  }
}

/**
 * 从模板创建节点
 *
 * @param template - 节点模板
 * @param position - 节点位置
 * @returns 创建的节点
 */
export function createNodeFromTemplate(template: NodeTemplate, position?: { x: number; y: number }): CreatedNode {
  return createNode({
    type: template.baseType,
    position,
    config: template.presetConfig,
    label: template.name,
    inputs: template.customInputs,
    outputs: template.customOutputs
  })
}

/**
 * 克隆节点
 *
 * @param node - 原节点
 * @param offset - 位置偏移
 * @returns 克隆的节点
 */
export function cloneNode(node: CreatedNode, offset: { x: number; y: number } = { x: 50, y: 50 }): CreatedNode {
  const newId = generateNodeId(node.data.nodeType)

  return {
    ...node,
    id: newId,
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y
    },
    data: {
      ...node.data,
      status: 'idle'
    }
  }
}

// ==================== 端口构建器 ====================

/**
 * 端口构建器
 * 提供链式 API 来构建端口定义
 */
export class HandleBuilder {
  private handles: SchemaNodeHandle[] = []

  /**
   * 添加图片输入
   */
  imageInput(id: string = 'image', label: string = '图片', required: boolean = true): this {
    this.handles.push(createHandle(id, label, 'image', { required }))
    return this
  }

  /**
   * 添加图片列表输入
   */
  imagesInput(id: string = 'images', label: string = '图片列表', required: boolean = false): this {
    this.handles.push(createHandle(id, label, 'images', { required }))
    return this
  }

  /**
   * 添加文本输入
   */
  textInput(id: string = 'text', label: string = '文本', required: boolean = false): this {
    this.handles.push(createHandle(id, label, 'text', { required }))
    return this
  }

  /**
   * 添加提示词输入
   */
  promptInput(id: string = 'prompt', label: string = '提示词', required: boolean = true): this {
    this.handles.push(createHandle(id, label, 'text', { required }))
    return this
  }

  /**
   * 添加 JSON 输入
   */
  jsonInput(id: string = 'data', label: string = '数据', required: boolean = false): this {
    this.handles.push(createHandle(id, label, 'json', { required }))
    return this
  }

  /**
   * 添加任意类型输入
   */
  anyInput(id: string = 'input', label: string = '输入', required: boolean = false): this {
    this.handles.push(createHandle(id, label, 'any', { required }))
    return this
  }

  /**
   * 添加视频输入
   */
  videoInput(id: string = 'video', label: string = '视频', required: boolean = false): this {
    this.handles.push(createHandle(id, label, 'video', { required }))
    return this
  }

  /**
   * 添加自定义端口
   */
  custom(id: string, label: string, dataType: SchemaDataType, options?: Partial<SchemaNodeHandle>): this {
    this.handles.push(createHandle(id, label, dataType, options))
    return this
  }

  /**
   * 添加多个图片输入（image1, image2, ...）
   */
  multiImageInputs(count: number, labelPrefix: string = '图片'): this {
    for (let i = 1; i <= count; i++) {
      this.handles.push(createHandle(`image${i}`, `${labelPrefix}${i}`, 'image', { required: i === 1 }))
    }
    return this
  }

  /**
   * 构建端口列表
   */
  build(): SchemaNodeHandle[] {
    return [...this.handles]
  }
}

/**
 * 创建输入端口构建器
 */
export function inputHandles(): HandleBuilder {
  return new HandleBuilder()
}

/**
 * 创建输出端口构建器
 */
export function outputHandles(): HandleBuilder {
  return new HandleBuilder()
}

// ==================== 配置 Schema 构建器 ====================

/**
 * 配置字段构建器
 */
export class ConfigFieldBuilder {
  private field: ConfigFieldSchema

  constructor(name: string, label: string, type: ConfigFieldSchema['type']) {
    this.field = { name, label, type }
  }

  required(): this {
    this.field.required = true
    return this
  }

  default(value: any): this {
    this.field.default = value
    return this
  }

  help(text: string): this {
    this.field.help = text
    return this
  }

  placeholder(text: string): this {
    this.field.placeholder = text
    return this
  }

  group(name: string): this {
    this.field.group = name
    return this
  }

  range(min: number, max: number, step?: number): this {
    this.field.min = min
    this.field.max = max
    if (step !== undefined) this.field.step = step
    return this
  }

  options(options: Array<{ value: string | number; label: string }>): this {
    this.field.options = options
    return this
  }

  maxLength(length: number): this {
    this.field.maxLength = length
    return this
  }

  rows(count: number): this {
    this.field.rows = count
    return this
  }

  showWhen(field: string, value: any): this {
    this.field.showWhen = { field, value }
    return this
  }

  validate(fn: (value: any, config: Record<string, any>) => string | null): this {
    this.field.validate = fn
    return this
  }

  build(): ConfigFieldSchema {
    return { ...this.field }
  }
}

/**
 * 配置 Schema 构建器
 */
export class ConfigSchemaBuilder {
  private schema: NodeConfigSchema

  constructor(nodeType: string) {
    this.schema = { nodeType, fields: [], groups: [] }
  }

  /**
   * 添加字符串字段
   */
  string(name: string, label: string): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'string')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加数字字段
   */
  number(name: string, label: string): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'number')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加布尔字段
   */
  boolean(name: string, label: string): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'boolean')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加选择字段
   */
  select(name: string, label: string, options: Array<{ value: string | number; label: string }>): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'select')
    builder.options(options)
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加文本域字段
   */
  textarea(name: string, label: string): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'textarea')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加滑块字段
   */
  slider(name: string, label: string): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'slider')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加模型选择字段
   */
  model(name: string = 'model', label: string = '模型'): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'model')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加 Provider 选择字段
   */
  provider(name: string = 'providerId', label: string = 'Provider'): ConfigFieldBuilder {
    const builder = new ConfigFieldBuilder(name, label, 'provider')
    this.schema.fields.push(builder.build())
    return builder
  }

  /**
   * 添加已构建的字段
   */
  addField(field: ConfigFieldSchema): this {
    this.schema.fields.push(field)
    return this
  }

  /**
   * 设置分组顺序
   */
  groupOrder(...groups: string[]): this {
    this.schema.groups = groups
    return this
  }

  /**
   * 构建 Schema
   */
  build(): NodeConfigSchema {
    return { ...this.schema }
  }
}

/**
 * 创建配置 Schema 构建器
 */
export function configSchema(nodeType: string): ConfigSchemaBuilder {
  return new ConfigSchemaBuilder(nodeType)
}

// ==================== 节点定义构建器 ====================

/**
 * 节点定义构建器
 * 提供链式 API 来构建节点定义
 */
export class NodeDefinitionBuilder {
  private definition: Partial<ExtendedNodeDefinition> = {}

  constructor(type: string, label: string) {
    this.definition.type = type
    this.definition.label = label
    this.definition.defaultInputs = []
    this.definition.defaultOutputs = []
    this.definition.defaultConfig = {}
  }

  /**
   * 设置图标
   */
  icon(icon: string): this {
    this.definition.icon = icon
    return this
  }

  /**
   * 设置分类
   */
  category(category: NodeCategory): this {
    this.definition.category = category
    return this
  }

  /**
   * 设置描述
   */
  description(desc: string): this {
    this.definition.description = desc
    return this
  }

  /**
   * 设置输入端口
   */
  inputs(handles: SchemaNodeHandle[] | HandleBuilder): this {
    this.definition.defaultInputs = Array.isArray(handles) ? handles : handles.build()
    return this
  }

  /**
   * 设置输出端口
   */
  outputs(handles: SchemaNodeHandle[] | HandleBuilder): this {
    this.definition.defaultOutputs = Array.isArray(handles) ? handles : handles.build()
    return this
  }

  /**
   * 设置默认配置
   */
  config(config: Record<string, any>): this {
    this.definition.defaultConfig = config
    return this
  }

  /**
   * 设置配置 Schema
   */
  configSchema(schema: NodeConfigSchema | ConfigSchemaBuilder): this {
    this.definition.configSchema = 'build' in schema ? schema.build() : schema
    return this
  }

  /**
   * 设置版本
   */
  version(v: string): this {
    this.definition.version = v
    return this
  }

  /**
   * 设置标签
   */
  tags(...tags: string[]): this {
    this.definition.tags = tags
    return this
  }

  /**
   * 标记为实验性
   */
  experimental(): this {
    this.definition.experimental = true
    return this
  }

  /**
   * 标记为已废弃
   */
  deprecated(reason?: string): this {
    this.definition.deprecated = true
    this.definition.deprecatedReason = reason
    return this
  }

  /**
   * 设置动态输入端口生成器
   */
  dynamicInputs(generator: (config: Record<string, any>) => SchemaNodeHandle[]): this {
    this.definition.inputsGenerator = generator
    return this
  }

  /**
   * 设置动态输出端口生成器
   */
  dynamicOutputs(generator: (config: Record<string, any>) => SchemaNodeHandle[]): this {
    this.definition.outputsGenerator = generator
    return this
  }

  /**
   * 设置执行前验证
   */
  validate(fn: (config: Record<string, any>, inputs: Record<string, any>) => string | null): this {
    this.definition.validateBeforeExecute = fn
    return this
  }

  /**
   * 构建节点定义
   */
  build(): ExtendedNodeDefinition {
    if (!this.definition.type) throw new Error('节点类型未设置')
    if (!this.definition.label) throw new Error('节点标签未设置')
    if (!this.definition.category) throw new Error('节点分类未设置')

    return {
      type: this.definition.type,
      label: this.definition.label,
      icon: this.definition.icon || '📦',
      category: this.definition.category,
      description: this.definition.description || '',
      defaultInputs: this.definition.defaultInputs || [],
      defaultOutputs: this.definition.defaultOutputs || [],
      defaultConfig: this.definition.defaultConfig || {},
      ...this.definition
    } as ExtendedNodeDefinition
  }
}

/**
 * 创建节点定义构建器
 */
export function defineNode(type: string, label: string): NodeDefinitionBuilder {
  return new NodeDefinitionBuilder(type, label)
}

// ==================== 预定义模板 ====================

/**
 * 常用节点模板
 */
export const NODE_TEMPLATES: Record<string, NodeTemplate> = {
  // 基础图片处理模板
  basic_image_process: {
    id: 'basic_image_process',
    name: '基础图片处理',
    description: '包含图片输入、处理和输出的基础工作流',
    baseType: 'image_input',
    presetConfig: { maxImages: 10 },
    tags: ['图片', '基础']
  },

  // 模特生成模板
  model_generation: {
    id: 'model_generation',
    name: '模特生成流程',
    description: '从服装图片生成模特展示图',
    baseType: 'gemini_generate_model',
    presetConfig: {},
    tags: ['AI', '模特', '服装']
  },

  // 电商图片模板
  ecom_generation: {
    id: 'ecom_generation',
    name: '电商图片生成',
    description: '生成符合电商平台要求的产品图',
    baseType: 'gemini_ecom',
    presetConfig: {},
    tags: ['电商', 'AI']
  },

  // 图生视频模板
  image_to_video: {
    id: 'image_to_video',
    name: '图生视频',
    description: '将静态图片转换为动态视频',
    baseType: 'kling_image2video',
    presetConfig: { duration: 5 },
    tags: ['视频', 'AI']
  }
}

/**
 * 获取模板
 */
export function getTemplate(id: string): NodeTemplate | undefined {
  return NODE_TEMPLATES[id]
}

/**
 * 获取所有模板
 */
export function getAllTemplates(): NodeTemplate[] {
  return Object.values(NODE_TEMPLATES)
}

/**
 * 根据标签搜索模板
 */
export function searchTemplates(tag: string): NodeTemplate[] {
  const lowerTag = tag.toLowerCase()
  return getAllTemplates().filter(
    (t) =>
      t.tags?.some((tt) => tt.toLowerCase().includes(lowerTag)) ||
      t.name.toLowerCase().includes(lowerTag) ||
      t.description.toLowerCase().includes(lowerTag)
  )
}
