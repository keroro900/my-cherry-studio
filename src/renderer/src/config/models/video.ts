/**
 * Video generation model detection and utilities
 */
import type { Model } from '@renderer/types'
import { getLowerBaseModelName, isUserSelectedModelType } from '@renderer/utils'

import { isEmbeddingModel, isRerankModel } from './embedding'

// Video generation models patterns
const VIDEO_GENERATION_MODELS = [
  // Google Veo series
  'veo',
  'veo2',
  'veo3',
  // OpenAI Sora
  'sora',
  'sora-2',
  // Kling AI
  'kling(?:-[\\w-]+)?',
  // Runway
  'runway',
  'gen-2',
  'gen-3',
  'gen3',
  // Pika Labs
  'pika',
  // MiniMax
  'minimax-video',
  'video-01',
  // CogVideo
  'cogvideo',
  'cogvideox',
  // Luma Dream Machine
  'luma',
  'dream-machine',
  // Hailuo AI / MiniMax
  'hailuo',
  'i2v-01',
  't2v-01',
  // Stability AI
  'stable-video',
  'svd',
  // Other video models
  'hunyuan-video',
  'wan-video',
  'mochi',
  'ltx-video'
]

const VIDEO_GENERATION_REGEX = new RegExp(VIDEO_GENERATION_MODELS.join('|'), 'i')

/**
 * Check if model is a video generation model
 */
export function isVideoGenerationModel(model: Model): boolean {
  if (!model || isEmbeddingModel(model) || isRerankModel(model)) {
    return false
  }

  // Check user-selected capability first
  if (isUserSelectedModelType(model, 'video_generation') !== undefined) {
    return isUserSelectedModelType(model, 'video_generation')!
  }

  // Check by endpoint_type
  if (model.endpoint_type === 'video-generation') {
    return true
  }

  // Check by model name pattern
  const modelId = getLowerBaseModelName(model.id)
  return VIDEO_GENERATION_REGEX.test(modelId)
}

/**
 * Check if model supports image-to-video generation
 */
export function isImage2VideoModel(model: Model): boolean {
  if (!isVideoGenerationModel(model)) {
    return false
  }

  const modelId = getLowerBaseModelName(model.id)
  // Most video models support image-to-video, exclude pure text-to-video models
  const TEXT_ONLY_VIDEO_MODELS = /sora(?!.*img)/i
  return !TEXT_ONLY_VIDEO_MODELS.test(modelId)
}

/**
 * Check if model supports text-to-video generation
 */
export function isText2VideoModel(model: Model): boolean {
  // All video generation models support text-to-video
  return isVideoGenerationModel(model)
}

/**
 * Get default video duration options for a model
 */
export function getVideoModelDurationOptions(model: Model): number[] {
  if (!model) return [5]

  const modelId = getLowerBaseModelName(model.id)

  // Sora supports 4, 8, 12 seconds
  if (/sora/i.test(modelId)) {
    return [4, 8, 12]
  }

  // Kling supports 5, 10 seconds
  if (/kling/i.test(modelId)) {
    return [5, 10]
  }

  // Default durations
  return [5, 10]
}

/**
 * Get default resolution options for a model
 */
export function getVideoModelResolutionOptions(model: Model): { label: string; value: string; aspectRatio: string }[] {
  if (!model) {
    return [{ label: '1080p (16:9)', value: '1920x1080', aspectRatio: '16:9' }]
  }

  const modelId = getLowerBaseModelName(model.id)

  // Sora resolutions
  if (/sora/i.test(modelId)) {
    return [
      { label: '720p Portrait (9:16)', value: '720x1280', aspectRatio: '9:16' },
      { label: '720p Landscape (16:9)', value: '1280x720', aspectRatio: '16:9' },
      { label: '1024p Portrait (9:16)', value: '1024x1792', aspectRatio: '9:16' },
      { label: '1024p Landscape (16:9)', value: '1792x1024', aspectRatio: '16:9' }
    ]
  }

  // Default resolutions
  return [
    { label: '720p (16:9)', value: '1280x720', aspectRatio: '16:9' },
    { label: '1080p (16:9)', value: '1920x1080', aspectRatio: '16:9' },
    { label: '720p Portrait (9:16)', value: '720x1280', aspectRatio: '9:16' },
    { label: '1080p Portrait (9:16)', value: '1080x1920', aspectRatio: '9:16' },
    { label: 'Square (1:1)', value: '1080x1080', aspectRatio: '1:1' }
  ]
}
