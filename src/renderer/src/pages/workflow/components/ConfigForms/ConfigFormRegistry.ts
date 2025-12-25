/**
 * 配置表单注册机制
 * Config Form Registry
 *
 * 提供节点类型到配置表单组件的映射机制
 * 支持通过配置而非硬编码添加表单映射
 *
 * 使用方法：
 * ```typescript
 * // 注册自定义表单
 * configFormRegistry.register({
 *   nodeTypes: ['gemini_pattern'],
 *   component: PatternConfigForm,
 *   priority: 10
 * })
 *
 * // 获取表单组件
 * const FormComponent = configFormRegistry.getForm('gemini_pattern')
 * if (FormComponent) {
 *   return <FormComponent config={config} onUpdateConfig={onUpdateConfig} />
 * }
 * ```
 */

import type React from 'react'

import type { NodeHandle } from '../../types'

/**
 * 配置表单组件的通用 Props 接口
 */
export interface ConfigFormProps {
  /** 节点类型 */
  nodeType?: string
  /** 节点配置对象 */
  config: Record<string, any>
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** 更新配置回调 - 支持单个或批量更新 */
  onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void
  /** 更新模型回调 */
  onUpdateModel?: (providerId: string, modelId: string) => void
  /** 更新输入端口回调 */
  onInputsChange?: (inputs: NodeHandle[]) => void
  /** 更新输出端口回调 */
  onOutputsChange?: (outputs: NodeHandle[]) => void
}

/**
 * 配置表单注册项
 */
export interface ConfigFormRegistration {
  /** 支持的节点类型列表 */
  nodeTypes: string[]
  /** 配置表单组件 */
  component: React.ComponentType<ConfigFormProps>
  /** 优先级（数字越大优先级越高，用于覆盖默认注册） */
  priority?: number
  /** 描述信息 */
  description?: string
}

/**
 * 配置表单注册表
 */
class ConfigFormRegistryClass {
  private registrations: ConfigFormRegistration[] = []
  private nodeTypeMap: Map<string, ConfigFormRegistration> = new Map()
  private _initialized: boolean = false

  /**
   * 注册配置表单
   * @param registration 注册项
   */
  register(registration: ConfigFormRegistration): void {
    // 设置默认优先级
    const reg = { ...registration, priority: registration.priority ?? 0 }
    this.registrations.push(reg)

    // 更新节点类型映射
    for (const nodeType of reg.nodeTypes) {
      const existing = this.nodeTypeMap.get(nodeType)
      // 只有当新注册的优先级更高时才覆盖
      if (!existing || (reg.priority ?? 0) > (existing.priority ?? 0)) {
        this.nodeTypeMap.set(nodeType, reg)
      }
    }
  }

  /**
   * 获取指定节点类型的配置表单组件
   * @param nodeType 节点类型
   * @returns 配置表单组件，如果未找到则返回 null
   */
  getForm(nodeType: string): React.ComponentType<ConfigFormProps> | null {
    const registration = this.nodeTypeMap.get(nodeType)
    return registration?.component ?? null
  }

  /**
   * 检查是否有指定节点类型的配置表单
   * @param nodeType 节点类型
   */
  hasForm(nodeType: string): boolean {
    return this.nodeTypeMap.has(nodeType)
  }

  /**
   * 获取所有注册项
   */
  getAll(): ConfigFormRegistration[] {
    return [...this.registrations]
  }

  /**
   * 获取所有已注册的节点类型
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.nodeTypeMap.keys())
  }

  /**
   * 清除所有注册（主要用于测试）
   */
  clear(): void {
    this.registrations = []
    this.nodeTypeMap.clear()
    this._initialized = false
  }

  /**
   * 标记为已初始化
   */
  markInitialized(): void {
    this._initialized = true
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this._initialized
  }

  /**
   * 获取注册表统计信息
   */
  getStats(): {
    totalRegistrations: number
    totalNodeTypes: number
    nodeTypes: string[]
  } {
    return {
      totalRegistrations: this.registrations.length,
      totalNodeTypes: this.nodeTypeMap.size,
      nodeTypes: this.getRegisteredNodeTypes()
    }
  }
}

/**
 * 配置表单注册表单例
 */
export const configFormRegistry = new ConfigFormRegistryClass()

/**
 * 需要自定义配置表单的节点类型列表
 *
 * 这些节点类型具有复杂的配置需求，无法通过 DynamicConfigForm 自动生成
 * 需要手动实现专用的配置表单组件
 */
export const CUSTOM_FORM_NODE_TYPES = [
  // 图案生成节点 - 有 100+ 风格预设和复杂的配置
  'gemini_pattern',
  // 电商图片节点 - 有多种模式和预设
  'gemini_ecom',
  // 智能提示词节点 - 有约束提示词和预设管理
  'unified_prompt',
  // 图片编辑节点 - 有预设模式和自定义模式
  'gemini_edit',
  'gemini_edit_custom',
  // 图片输入节点 - 有文件夹选择和拖拽上传
  'image_input',
  // 模特图节点 - 有服装类型和年龄预设
  'gemini_generate_model',
  'gemini_model_from_clothes',
  // 视频节点 - 有时长和提示词配置
  'kling_image2video',
  // 视频提示词节点 - 有提示词编辑器和安全约束
  'video_prompt',
  // 外部服务节点 - 有 API 配置
  'runninghub_app',
  // 行业摄影节点 - 有专业预设和提示词编辑器
  'jewelry_photo',
  'food_photo',
  'product_scene',
  'jewelry_tryon',
  'eyewear_tryon',
  'footwear_display',
  'cosmetics_photo',
  'furniture_scene',
  'electronics_photo',
  // 电商内容节点 - 有平台和语言配置
  'product_description'
] as const

/**
 * 可以使用 DynamicConfigForm 的节点类型列表
 *
 * 这些节点类型的配置较简单，可以通过 configSchema 自动生成表单
 */
export const DYNAMIC_FORM_NODE_TYPES = [
  // 文本输入
  'text_input',
  'file_input',
  // 图片生成（基础版）
  'gemini_generate',
  // 图片对比（仅展示）
  'compare_image',
  // 输出节点
  'output',
  // 流程控制节点
  'condition',
  'image_list',
  'text_list',
  'list_merge',
  'list_filter',
  'pipe',
  'pipe_router',
  'pipe_merger',
  'switch',
  'multi_switch',
  'loop',
  'loop_index',
  'loop_list'
] as const

/**
 * 检查节点类型是否需要自定义表单
 */
export function needsCustomForm(nodeType: string): boolean {
  return (CUSTOM_FORM_NODE_TYPES as readonly string[]).includes(nodeType)
}

/**
 * 检查节点类型是否可以使用动态表单
 */
export function canUseDynamicForm(nodeType: string): boolean {
  return (DYNAMIC_FORM_NODE_TYPES as readonly string[]).includes(nodeType)
}

/**
 * 注册默认配置表单
 * 在模块加载时自动执行
 */
export function registerDefaultForms(): void {
  // 延迟导入以避免循环依赖
  // 这些导入会在函数调用时执行
}

// 导出类型
export type { ConfigFormRegistryClass }
