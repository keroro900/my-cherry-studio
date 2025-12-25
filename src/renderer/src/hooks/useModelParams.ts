/**
 * 模型参数动态获取 Hook
 *
 * 从中转服务动态获取模型参数定义
 * 支持缓存、加载状态、错误处理
 */

import { loggerService } from '@logger'
import modelParamsService, {
  type RemoteFieldSchema,
  type RemoteModelParamsSchema
} from '@renderer/services/ModelParamsService'
import type { Model, Provider } from '@renderer/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

const logger = loggerService.withContext('useModelParams')

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 转换后的字段配置（用于 UI 渲染）
 */
export interface DynamicFieldConfig {
  key: string
  type: 'text' | 'textarea' | 'number' | 'slider' | 'select' | 'switch' | 'seed' | 'aspectRatio' | 'images'
  label: string
  description?: string
  placeholder?: string
  tooltip?: string
  defaultValue?: any
  group: 'basic' | 'advanced' | 'style' | 'output' | 'controlnet'
  order: number
  hidden: boolean
  disabled: boolean

  // 数值约束
  min?: number
  max?: number
  step?: number

  // 枚举选项
  options?: Array<{ label: string; value: string | number }>

  // 依赖关系
  dependsOn?: {
    field: string
    values?: any[]
    condition?: (value: any, allValues: Record<string, any>) => boolean
  }

  // 动态范围
  dynamicRange?: {
    min?: (allValues: Record<string, any>) => number
    max?: (allValues: Record<string, any>) => number
  }

  // 验证规则
  validation?: {
    required?: boolean
    validate?: (value: any, allValues: Record<string, any>) => string | null
  }
}

/**
 * Hook 返回值
 */
export interface UseModelParamsReturn {
  // 状态
  isLoading: boolean
  error: string | null
  schema: RemoteModelParamsSchema | null

  // 转换后的字段配置
  fields: DynamicFieldConfig[]
  fieldsByGroup: Record<string, DynamicFieldConfig[]>

  // 模型能力
  capabilities: RemoteModelParamsSchema['capabilities'] | null

  // 预设配置
  presets: RemoteModelParamsSchema['presets'] | null

  // 默认值
  defaultValues: Record<string, any>

  // 操作
  refresh: () => Promise<void>
  getFieldConfig: (fieldKey: string) => DynamicFieldConfig | undefined
  isFieldVisible: (fieldKey: string, values: Record<string, any>) => boolean
  getFieldRange: (fieldKey: string, values: Record<string, any>) => { min?: number; max?: number }
  validateField: (fieldKey: string, value: any, allValues: Record<string, any>) => string | null
  validateAll: (values: Record<string, any>) => Record<string, string>
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useModelParams(provider?: Provider, model?: Model): UseModelParamsReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schema, setSchema] = useState<RemoteModelParamsSchema | null>(null)

  // 获取参数
  const fetchParams = useCallback(async () => {
    if (!provider || !model) {
      setSchema(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await modelParamsService.getModelParams(provider, model.id)

      if (result.success && result.schema) {
        setSchema(result.schema)
        logger.info(`Loaded params for ${provider.id}/${model.id}`, {
          fromCache: result.fromCache,
          fieldCount: Object.keys(result.schema.properties).length
        })
      } else {
        setError(result.error || 'Failed to load model params')
        logger.error(`Failed to load params for ${provider.id}/${model.id}: ${result.error}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      logger.error(`Error loading params for ${provider.id}/${model.id}: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [provider, model])

  // 当 provider 或 model 变化时重新获取
  useEffect(() => {
    fetchParams()
  }, [fetchParams])

  // 转换 Schema 为字段配置
  const fields = useMemo((): DynamicFieldConfig[] => {
    if (!schema?.properties) return []

    return Object.entries(schema.properties)
      .map(([key, fieldSchema]) => convertToFieldConfig(key, fieldSchema))
      .sort((a, b) => a.order - b.order)
  }, [schema])

  // 按分组组织字段
  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, DynamicFieldConfig[]> = {
      basic: [],
      advanced: [],
      style: [],
      output: [],
      controlnet: []
    }

    for (const field of fields) {
      const group = field.group || 'basic'
      if (!groups[group]) groups[group] = []
      groups[group].push(field)
    }

    return groups
  }, [fields])

  // 提取默认值
  const defaultValues = useMemo(() => {
    const values: Record<string, any> = {}
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        values[field.key] = field.defaultValue
      }
    }
    return values
  }, [fields])

  // 获取字段配置
  const getFieldConfig = useCallback(
    (fieldKey: string): DynamicFieldConfig | undefined => {
      return fields.find((f) => f.key === fieldKey)
    },
    [fields]
  )

  // 检查字段是否可见
  const isFieldVisible = useCallback(
    (fieldKey: string, values: Record<string, any>): boolean => {
      const field = getFieldConfig(fieldKey)
      if (!field) return false
      if (field.hidden) return false

      if (field.dependsOn) {
        const { field: depField, values: depValues, condition } = field.dependsOn
        const currentValue = values[depField]

        if (condition) {
          return condition(currentValue, values)
        }

        if (depValues) {
          return depValues.includes(currentValue)
        }
      }

      return true
    },
    [getFieldConfig]
  )

  // 获取字段动态范围
  const getFieldRange = useCallback(
    (fieldKey: string, values: Record<string, any>): { min?: number; max?: number } => {
      const field = getFieldConfig(fieldKey)
      if (!field) return {}

      let min = field.min
      let max = field.max

      if (field.dynamicRange) {
        if (field.dynamicRange.min) {
          min = field.dynamicRange.min(values)
        }
        if (field.dynamicRange.max) {
          max = field.dynamicRange.max(values)
        }
      }

      return { min, max }
    },
    [getFieldConfig]
  )

  // 验证单个字段
  const validateField = useCallback(
    (fieldKey: string, value: any, allValues: Record<string, any>): string | null => {
      const field = getFieldConfig(fieldKey)
      if (!field) return null

      // 必填验证
      if (field.validation?.required) {
        if (value === undefined || value === null || value === '') {
          return `${field.label} 是必填项`
        }
      }

      // 数值范围验证
      if (typeof value === 'number') {
        const { min, max } = getFieldRange(fieldKey, allValues)
        if (min !== undefined && value < min) {
          return `${field.label} 不能小于 ${min}`
        }
        if (max !== undefined && value > max) {
          return `${field.label} 不能大于 ${max}`
        }
      }

      // 自定义验证
      if (field.validation?.validate) {
        return field.validation.validate(value, allValues)
      }

      return null
    },
    [getFieldConfig, getFieldRange]
  )

  // 验证所有字段
  const validateAll = useCallback(
    (values: Record<string, any>): Record<string, string> => {
      const errors: Record<string, string> = {}

      for (const field of fields) {
        if (!isFieldVisible(field.key, values)) continue

        const error = validateField(field.key, values[field.key], values)
        if (error) {
          errors[field.key] = error
        }
      }

      return errors
    },
    [fields, isFieldVisible, validateField]
  )

  return {
    isLoading,
    error,
    schema,
    fields,
    fieldsByGroup,
    capabilities: schema?.capabilities || null,
    presets: schema?.presets || null,
    defaultValues,
    refresh: fetchParams,
    getFieldConfig,
    isFieldVisible,
    getFieldRange,
    validateField,
    validateAll
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将远程 Schema 转换为字段配置
 */
function convertToFieldConfig(key: string, schema: RemoteFieldSchema): DynamicFieldConfig {
  const config: DynamicFieldConfig = {
    key,
    type: mapSchemaToFieldType(schema),
    label: schema.title || key,
    description: schema.description,
    placeholder: schema['x-ui-placeholder'],
    tooltip: schema['x-ui-tooltip'],
    defaultValue: schema.default,
    group: (schema['x-ui-group'] as DynamicFieldConfig['group']) || 'basic',
    order: schema['x-ui-order'] ?? 999,
    hidden: schema['x-ui-hidden'] ?? false,
    disabled: schema['x-ui-disabled'] ?? false
  }

  // 数值约束
  if (schema.minimum !== undefined) config.min = schema.minimum
  if (schema.maximum !== undefined) config.max = schema.maximum
  if (schema.multipleOf !== undefined) config.step = schema.multipleOf

  // 枚举选项
  if (schema.enum) {
    config.options = schema.enum.map((value, index) => ({
      label: schema.enumNames?.[index] || String(value),
      value
    }))
  }

  // 依赖关系
  if (schema['x-depends-on']) {
    const dep = schema['x-depends-on']
    config.dependsOn = {
      field: dep.field,
      values: dep.values
    }

    // 如果有条件表达式，转换为函数
    if (dep.condition) {
      try {
        config.dependsOn.condition = new Function('value', 'allValues', `return ${dep.condition}`) as any
      } catch (e) {
        logger.warn(`Invalid condition expression for field ${key}: ${dep.condition}`)
      }
    }
  }

  // 动态范围
  if (schema['x-dynamic-range']) {
    const range = schema['x-dynamic-range']
    config.dynamicRange = {}

    if (range.min) {
      try {
        config.dynamicRange.min = new Function('allValues', `return ${range.min}`) as any
      } catch (e) {
        logger.warn(`Invalid min expression for field ${key}: ${range.min}`)
      }
    }

    if (range.max) {
      try {
        config.dynamicRange.max = new Function('allValues', `return ${range.max}`) as any
      } catch (e) {
        logger.warn(`Invalid max expression for field ${key}: ${range.max}`)
      }
    }
  }

  // 验证规则
  if (schema['x-validation']) {
    const validation = schema['x-validation']
    config.validation = {
      required: validation.required
    }

    if (validation.custom) {
      try {
        const customFn = new Function('value', 'allValues', `return ${validation.custom}`) as any
        config.validation.validate = (value, allValues) => {
          const result = customFn(value, allValues)
          return result === true ? null : validation.message || '验证失败'
        }
      } catch (e) {
        logger.warn(`Invalid validation expression for field ${key}: ${validation.custom}`)
      }
    }
  }

  return config
}

/**
 * 映射 Schema 类型到字段类型
 */
function mapSchemaToFieldType(schema: RemoteFieldSchema): DynamicFieldConfig['type'] {
  // 优先使用 UI 控件类型
  if (schema['x-ui-widget']) {
    const widgetMap: Record<string, DynamicFieldConfig['type']> = {
      slider: 'slider',
      select: 'select',
      radio: 'select',
      switch: 'switch',
      textarea: 'textarea',
      upload: 'images',
      aspectRatio: 'aspectRatio',
      seed: 'seed'
    }
    return widgetMap[schema['x-ui-widget']] || 'text'
  }

  // 根据类型推断
  switch (schema.type) {
    case 'boolean':
      return 'switch'
    case 'integer':
      return schema.enum ? 'select' : 'number'
    case 'number':
      return schema.minimum !== undefined && schema.maximum !== undefined ? 'slider' : 'number'
    case 'array':
      return 'images'
    case 'seed':
      return 'seed'
    case 'aspectRatio':
      return 'aspectRatio'
    case 'string':
    default:
      if (schema.enum) return 'select'
      if (schema.maxLength && schema.maxLength > 100) return 'textarea'
      return 'text'
  }
}

export default useModelParams
