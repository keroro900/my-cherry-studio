/**
 * 统一的图像生成 Hook
 *
 * 提供给绘画界面和工作流界面统一使用
 * 支持 HMR 热加载状态恢复
 */

import { getModelDefaults } from '@renderer/config/imageGenerationConfig'
import {
  createImageGenerationService,
  type ImageGenerationParams,
  type ImageGenerationResult
} from '@renderer/services/ImageGenerationService'
import type { Model, Provider } from '@renderer/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ============================================================================
// Hook 返回类型
// ============================================================================

export interface UseImageGenerationReturn {
  // 状态
  values: Record<string, any>
  isGenerating: boolean
  error: string | null
  generatedImages: string[]

  // 操作
  setValue: (key: string, value: any) => void
  setValues: (values: Record<string, any>) => void
  generate: () => Promise<ImageGenerationResult>
  cancel: () => void
  reset: () => void
  clearImages: () => void
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useImageGeneration(
  provider?: Provider,
  model?: Model,
  initialValues?: Record<string, any>
): UseImageGenerationReturn {
  // 使用 initialValues 作为初始状态，支持 HMR 热加载恢复
  // 注意：useState 的初始值只在首次渲染时使用，HMR 时会保留之前的状态
  const [values, setValuesState] = useState<Record<string, any>>(() => {
    // 如果有初始值，使用初始值；否则使用空对象
    if (initialValues && Object.keys(initialValues).length > 0) {
      return initialValues
    }
    return {}
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // 跟踪是否已初始化（用于区分首次加载和模型切换）
  // 使用 initialValues 的存在来判断是否是 HMR 恢复
  const hasInitialValues = initialValues && Object.keys(initialValues).length > 0
  const isInitialized = useRef(hasInitialValues)
  const prevModelId = useRef<string | undefined>(model?.id)

  // 创建服务实例
  const service = useMemo(() => {
    if (!provider || !model) return null
    return createImageGenerationService(provider, model)
  }, [provider, model])

  // 当模型变化时，重置为默认值（但保留初始值中的 prompt）
  useEffect(() => {
    if (model) {
      // 如果已经初始化（有初始值或已经设置过），只在模型切换时更新
      if (isInitialized.current) {
        // 模型切换时，重置为默认值但保留 prompt
        if (prevModelId.current !== model.id) {
          const defaults = getModelDefaults(model.id, provider?.id)
          const currentPrompt = values.prompt
          setValuesState({ ...defaults, prompt: currentPrompt || defaults.prompt })
          prevModelId.current = model.id
        }
        return
      }

      // 首次初始化（没有初始值的情况）
      const defaults = getModelDefaults(model.id, provider?.id)
      setValuesState(defaults)
      isInitialized.current = true
      prevModelId.current = model.id
    }
  }, [model, provider, values.prompt])

  // 组件卸载时中断正在进行的请求
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [])

  // 设置单个值
  const setValue = useCallback((key: string, value: any) => {
    setValuesState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // 批量设置值
  const setValues = useCallback((newValues: Record<string, any>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }))
  }, [])

  // 重置为默认值
  const reset = useCallback(() => {
    if (model) {
      const defaults = getModelDefaults(model.id, provider?.id)
      setValuesState(defaults)
    }
    setError(null)
  }, [model, provider])

  // 清空生成的图片
  const clearImages = useCallback(() => {
    setGeneratedImages([])
  }, [])

  // 取消生成
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  // 生成图片
  const generate = useCallback(async (): Promise<ImageGenerationResult> => {
    if (!service) {
      return { success: false, images: [], error: '服务未初始化，请选择模型' }
    }

    if (!values.prompt) {
      return { success: false, images: [], error: '请输入提示词' }
    }

    setIsGenerating(true)
    setError(null)

    try {
      // 确保同一时间只有一个有效的中断控制器
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      // 根据 mode 区分绘图和编辑模式
      // 绘图模式 (generate)：纯文生图，不传入任何参考图片
      // 编辑模式 (edit)：图生图/图片编辑，需要传入参考图片
      const isEditMode = values.mode === 'edit'

      const params: ImageGenerationParams = {
        prompt: values.prompt,
        model: model?.id || '',
        ...values
      }

      if (isEditMode) {
        // 编辑模式：如果有参考图，自动取首张作为主图
        if (!params.image && Array.isArray(params.reference_images) && params.reference_images.length > 0) {
          params.image = params.reference_images[0]
        }
      } else {
        // 绘图模式：清除所有参考图片，确保是纯文生图请求
        delete params.image
        delete params.reference_images
      }

      const result = await service.generateBatch(params, {
        signal: controller.signal
      })

      if (result.success) {
        setGeneratedImages((prev) => [...result.images, ...prev])
      } else if (result.error) {
        setError(result.error)
      }

      return result
    } catch (err) {
      const isAbortError =
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof err === 'object' && err !== null && (err as any).name === 'AbortError')

      if (isAbortError) {
        return { success: false, images: [] }
      }

      const errorMessage = (err as Error).message
      setError(errorMessage)
      return { success: false, images: [], error: errorMessage }
    } finally {
      abortControllerRef.current = null
      setIsGenerating(false)
    }
  }, [service, model, values])

  return {
    values,
    isGenerating,
    error,
    generatedImages,
    setValue,
    setValues,
    generate,
    cancel,
    reset,
    clearImages
  }
}

export default useImageGeneration
