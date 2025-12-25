/**
 * 类型回退键名配置
 *
 * 当精确匹配失败时，按顺序尝试这些键名
 * 集中维护，便于扩展和测试
 */

import type { WorkflowDataType } from '../types'

/**
 * 端口数据类型到回退键名的映射
 * 键名按优先级排序，越靠前优先级越高
 */
export const TYPE_FALLBACK_KEYS: Record<WorkflowDataType, string[]> = {
  image: [
    'image',
    'image_1',
    'modelImage',
    'editedImage',
    'comparedImage',
    'patternImage',
    'ecomImage',
    'graphicImage',
    'mainImage',
    'backImage',
    'seamlessImage'
  ],
  images: ['images', 'all_images', 'detailImages', 'generatedImages'],
  text: ['text', 'caption', 'prompt', 'videoPrompt', 'full_prompt', 'content', 'output'],
  video: ['video'],
  json: ['promptJson', 'modelPromptJson', 'patternPromptJson', 'ecomPromptJson', 'json', 'data', 'result'],
  any: [], // 'any' 类型返回第一个非空值，不使用固定键名
  boolean: ['boolean', 'result', 'success', 'valid', 'enabled'],
  number: ['number', 'count', 'value', 'index', 'total']
}

/**
 * 根据数据类型获取回退值
 *
 * 尝试顺序：
 * 1. 精确匹配 handleId
 * 2. 按 TYPE_FALLBACK_KEYS 中的顺序尝试
 * 3. 如果是 'any' 类型，返回第一个非空值
 * 4. 如果只有一个输出，返回该值
 *
 * @param outputs 上游节点的输出
 * @param dataType 目标数据类型
 * @param handleId 目标端口 ID
 * @returns 匹配的值，或 undefined
 */
export function getFallbackValue(
  outputs: Record<string, unknown>,
  dataType: WorkflowDataType,
  handleId: string
): unknown {
  // 1. 精确匹配 handleId
  if (outputs[handleId] !== undefined) {
    return outputs[handleId]
  }

  // 2. 按 TYPE_FALLBACK_KEYS 中的顺序尝试
  const fallbackKeys = TYPE_FALLBACK_KEYS[dataType] || []
  for (const key of fallbackKeys) {
    if (outputs[key] !== undefined) {
      return outputs[key]
    }
  }

  // 3. 如果是 'any' 类型，返回第一个非空值
  if (dataType === 'any') {
    const keys = Object.keys(outputs)
    for (const key of keys) {
      if (outputs[key] !== undefined && outputs[key] !== null) {
        return outputs[key]
      }
    }
  }

  // 4. 如果只有一个输出，返回该值（单输出回退）
  const outputKeys = Object.keys(outputs)
  if (outputKeys.length === 1) {
    return outputs[outputKeys[0]]
  }

  return undefined
}

/**
 * 将 images 类型的数组值转换为单张图片
 * 用于 images → image 类型连接
 *
 * @param value 输入值
 * @returns 单张图片或 undefined
 */
export function extractSingleImage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && value.length > 0) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }
  return undefined
}

/**
 * 将单张图片转换为数组
 * 用于 image → images 类型连接
 *
 * @param value 输入值
 * @returns 图片数组
 */
export function wrapAsImageArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string')
  }
  if (typeof value === 'string') {
    return [value]
  }
  return []
}

/**
 * 类型兼容性检查
 * 判断源类型是否可以连接到目标类型
 *
 * @param sourceType 源端口类型
 * @param targetType 目标端口类型
 * @returns 是否兼容
 */
export function isTypeCompatible(sourceType: WorkflowDataType, targetType: WorkflowDataType): boolean {
  // 相同类型总是兼容
  if (sourceType === targetType) return true

  // 'any' 类型与所有类型兼容
  if (sourceType === 'any' || targetType === 'any') return true

  // 'images' 可以连接到 'image'（取第一张）
  if (sourceType === 'images' && targetType === 'image') return true

  // 'image' 可以连接到 'images'（包装为数组）
  if (sourceType === 'image' && targetType === 'images') return true

  return false
}
