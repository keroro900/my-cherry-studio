/**
 * 统一图片端口配置
 * Unified Image Port Configuration
 *
 * 集中管理所有节点的图片输入端口配置
 * 避免在 CherryWorkflowNode.tsx 中硬编码端口定义
 *
 * @version 1.0.0
 * @created 2024-12-19
 *
 * **Feature: unified-port-config, Phase 6.1**
 */

import type { PortDataType } from '../nodes/base/types'

// ==================== 端口定义类型 ====================

/**
 * 图片端口定义
 */
export interface ImagePortDefinition {
  /** 端口 ID */
  id: string
  /** 端口标签 */
  label: string
  /** 数据类型 */
  dataType: PortDataType
  /** 是否必需 */
  required?: boolean
  /** 是否允许多连接 */
  multiple?: boolean
  /** 端口描述 */
  description?: string
}

/**
 * 节点端口配置
 */
export interface NodePortConfig {
  /** 节点类型 */
  nodeType: string
  /** 是否支持动态图片端口 */
  supportsDynamicPorts: boolean
  /** 默认图片端口定义 */
  defaultImagePorts: ImagePortDefinition[]
  /** 端口数量范围（用于动态端口） */
  portRange?: {
    min: number
    max: number
  }
  /** 端口命名模板 */
  portNamingTemplate?: {
    /** ID 模板，如 'image_{index}' */
    idTemplate: string
    /** 标签模板，如 '图片 {index}' */
    labelTemplate: string
  }
}

// ==================== 支持动态端口的节点类型 ====================

/**
 * 支持动态图片输入的节点类型列表
 */
export const DYNAMIC_IMAGE_INPUT_NODES: readonly string[] = [
  'gemini_generate',
  'gemini_generate_model',
  'gemini_model_from_clothes',
  'gemini_ecom',
  'gemini_pattern',
  'gemini_edit',
  'gemini_edit_custom',
  'kling_image2video',
  'compare_image',
  'runninghub_app',
  // 行业摄影节点
  'jewelry_photo',
  'food_photo',
  'product_scene',
  'jewelry_tryon',
  'eyewear_tryon',
  'footwear_display',
  'cosmetics_photo',
  'furniture_scene',
  'electronics_photo',
  // 文本/内容节点
  'aplus_content',
  'product_description'
] as const

/**
 * 检查节点是否支持动态图片端口
 */
export function supportsDynamicImagePorts(nodeType: string): boolean {
  return DYNAMIC_IMAGE_INPUT_NODES.includes(nodeType)
}

// ==================== 节点端口配置定义 ====================

/**
 * 节点端口配置映射
 */
export const NODE_PORT_CONFIGS: Record<string, NodePortConfig> = {
  /**
   * Gemini 图片生成节点
   * 支持 0-5 张参考图片输入
   */
  gemini_generate: {
    nodeType: 'gemini_generate',
    supportsDynamicPorts: true,
    defaultImagePorts: [],
    portRange: { min: 0, max: 5 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图片 {index}'
    }
  },

  /**
   * Gemini 模特图生成节点
   * 支持 0-3 张参考图片输入
   */
  gemini_generate_model: {
    nodeType: 'gemini_generate_model',
    supportsDynamicPorts: true,
    defaultImagePorts: [],
    portRange: { min: 0, max: 3 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图片 {index}'
    }
  },

  /**
   * 从衣服生成模特图节点
   * 第一个端口固定为服装图片（必填），其余为可选参考图片
   */
  gemini_model_from_clothes: {
    nodeType: 'gemini_model_from_clothes',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'clothesImage',
        label: '服装图片',
        dataType: 'image',
        required: true,
        description: '需要生成模特的服装图片'
      }
    ],
    portRange: { min: 1, max: 4 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图片 {index}'
    }
  },

  /**
   * Gemini 电商图节点
   * 主图端口 + 可选背面图端口
   */
  gemini_ecom: {
    nodeType: 'gemini_ecom',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'image',
        label: '主图',
        dataType: 'image',
        required: true,
        description: '服装正面图片'
      }
    ],
    portRange: { min: 1, max: 2 }
  },

  /**
   * Gemini 图案生成节点
   * 支持 0-4 张参考图片
   */
  gemini_pattern: {
    nodeType: 'gemini_pattern',
    supportsDynamicPorts: true,
    defaultImagePorts: [],
    portRange: { min: 0, max: 4 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图案 {index}'
    }
  },

  /**
   * Gemini 图片编辑节点
   * 至少 1 张源图片，支持最多 5 张
   */
  gemini_edit: {
    nodeType: 'gemini_edit',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'image',
        label: '源图片',
        dataType: 'image',
        required: true,
        description: '需要编辑的图片'
      }
    ],
    portRange: { min: 1, max: 5 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图片 {index}'
    }
  },

  /**
   * Gemini 自定义编辑节点
   */
  gemini_edit_custom: {
    nodeType: 'gemini_edit_custom',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'image',
        label: '源图片',
        dataType: 'image',
        required: true,
        description: '需要编辑的图片'
      }
    ],
    portRange: { min: 1, max: 5 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '参考图片 {index}'
    }
  },

  /**
   * Kling 图片转视频节点
   * 固定 1 张图片输入
   */
  kling_image2video: {
    nodeType: 'kling_image2video',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'image',
        label: '图片',
        dataType: 'image',
        required: true,
        description: '用于生成视频的图片'
      }
    ],
    portRange: { min: 1, max: 2 }
  },

  /**
   * 图片对比节点
   * 固定 2 张图片输入
   */
  compare_image: {
    nodeType: 'compare_image',
    supportsDynamicPorts: true,
    defaultImagePorts: [
      {
        id: 'beforeImage',
        label: '之前',
        dataType: 'image',
        required: true,
        description: '对比前的图片'
      },
      {
        id: 'afterImage',
        label: '之后',
        dataType: 'image',
        required: true,
        description: '对比后的图片'
      }
    ],
    portRange: { min: 2, max: 2 }
  },

  /**
   * RunningHub 应用节点
   * 支持多张图片输入
   */
  runninghub_app: {
    nodeType: 'runninghub_app',
    supportsDynamicPorts: true,
    defaultImagePorts: [],
    portRange: { min: 0, max: 10 },
    portNamingTemplate: {
      idTemplate: 'image_{index}',
      labelTemplate: '图片 {index}'
    }
  }
}

// ==================== 工具函数 ====================

/**
 * 获取节点的端口配置
 */
export function getNodePortConfig(nodeType: string): NodePortConfig | undefined {
  return NODE_PORT_CONFIGS[nodeType]
}

/**
 * 生成动态图片端口
 *
 * @param nodeType 节点类型
 * @param count 端口数量
 * @returns 图片端口定义列表
 */
export function generateDynamicImagePorts(nodeType: string, count: number): ImagePortDefinition[] {
  const config = NODE_PORT_CONFIGS[nodeType]
  if (!config || !config.supportsDynamicPorts) {
    return []
  }

  // 验证数量范围
  const { portRange, defaultImagePorts, portNamingTemplate } = config
  const effectiveCount = portRange ? Math.min(Math.max(count, portRange.min), portRange.max) : count

  // 如果请求的数量小于等于默认端口数量，直接返回默认端口
  if (effectiveCount <= defaultImagePorts.length) {
    return defaultImagePorts.slice(0, effectiveCount)
  }

  // 从默认端口开始，添加动态端口
  const ports: ImagePortDefinition[] = [...defaultImagePorts]

  // 计算需要添加的动态端口数量
  const dynamicPortCount = effectiveCount - defaultImagePorts.length

  if (portNamingTemplate && dynamicPortCount > 0) {
    const startIndex = defaultImagePorts.length + 1
    for (let i = 0; i < dynamicPortCount; i++) {
      const index = startIndex + i
      ports.push({
        id: portNamingTemplate.idTemplate.replace('{index}', String(index)),
        label: portNamingTemplate.labelTemplate.replace('{index}', String(index)),
        dataType: 'image',
        required: false
      })
    }
  }

  return ports
}

/**
 * 合并静态端口和动态端口
 *
 * @param staticPorts 静态端口列表
 * @param dynamicPorts 动态端口列表
 * @returns 合并后的端口列表
 */
export function mergeImagePorts(
  staticPorts: ImagePortDefinition[],
  dynamicPorts: ImagePortDefinition[]
): ImagePortDefinition[] {
  // 创建动态端口 ID 集合，用于过滤静态端口中的重复项
  const dynamicPortIds = new Set(dynamicPorts.map((p) => p.id))

  // 过滤掉静态端口中被动态端口覆盖的图片端口
  const filteredStatic = staticPorts.filter((p) => !dynamicPortIds.has(p.id) && p.dataType !== 'image')

  // 动态端口在前，其他静态端口在后
  return [...dynamicPorts, ...filteredStatic]
}

/**
 * 验证端口数量是否在有效范围内
 */
export function isValidPortCount(nodeType: string, count: number): boolean {
  const config = NODE_PORT_CONFIGS[nodeType]
  if (!config || !config.portRange) {
    return true
  }

  return count >= config.portRange.min && count <= config.portRange.max
}

/**
 * 获取节点的端口数量范围
 */
export function getPortRange(nodeType: string): { min: number; max: number } | undefined {
  return NODE_PORT_CONFIGS[nodeType]?.portRange
}

// ==================== 导出类型 ====================

export type { PortDataType }
