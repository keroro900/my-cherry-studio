import {
  isEmbeddingModel,
  isFunctionCallingModel,
  isGenerateImageModel,
  isImageEnhancementModel,
  isReasoningModel,
  isRerankModel,
  isVideoGenerationModel,
  isVisionModel,
  isWebSearchModel
} from '@renderer/config/models'
import type { AdaptedApiModel, ApiModel, Model, ModelTag } from '@renderer/types'
import { objectKeys } from '@renderer/types'

/**
 * 获取模型标签的状态
 * @param models - 模型列表
 * @returns 包含各个标签布尔值的对象，表示是否存在具有该标签的模型
 */
export const getModelTags = (models: Model[]): Record<ModelTag, boolean> => {
  const result: Record<ModelTag, boolean> = {
    vision: false,
    embedding: false,
    reasoning: false,
    image_edit: false,
    image_generation: false,
    function_calling: false,
    web_search: false,
    rerank: false,
    free: false,
    video_generation: false
  }
  const total = objectKeys(result).length
  let satisfied = 0

  for (const model of models) {
    // 如果所有标签都已满足，提前退出
    if (satisfied === total) break

    if (!result.vision && isVisionModel(model)) {
      satisfied += 1
      result.vision = true
    }
    if (!result.embedding && isEmbeddingModel(model)) {
      satisfied += 1
      result.embedding = true
    }
    if (!result.reasoning && isReasoningModel(model)) {
      satisfied += 1
      result.reasoning = true
    }
    if (!result.image_edit && isImageEnhancementModel(model)) {
      satisfied += 1
      result.image_edit = true
    }
    if (!result.image_generation && isGenerateImageModel(model)) {
      satisfied += 1
      result.image_generation = true
    }
    if (!result.function_calling && isFunctionCallingModel(model)) {
      satisfied += 1
      result.function_calling = true
    }
    if (!result.web_search && isWebSearchModel(model)) {
      satisfied += 1
      result.web_search = true
    }
    if (!result.rerank && isRerankModel(model)) {
      satisfied += 1
      result.rerank = true
    }
    if (!result.free && isFreeModel(model)) {
      satisfied += 1
      result.free = true
    }
    if (!result.video_generation && isVideoGenerationModel(model)) {
      satisfied += 1
      result.video_generation = true
    }
  }

  return result
}

export function isFreeModel(model: Model) {
  if (model.provider === 'cherryai') {
    return true
  }

  return (model.id + model.name).toLocaleLowerCase().includes('free')
}

export const apiModelAdapter = (model: ApiModel): AdaptedApiModel => {
  return {
    id: model.provider_model_id ?? model.id,
    provider: model.provider ?? '',
    name: model.name,
    group: '',
    origin: model
  }
}
