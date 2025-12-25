/**
 * 工作流配置表单公共选项
 *
 * 统一管理各配置表单中重复使用的选项定义
 * 避免在多个文件中重复定义相同的选项
 */

/**
 * 图片尺寸选项
 * 用于 GeminiEditConfigForm, EcomConfigForm, PatternConfigForm 等
 */
export const IMAGE_SIZE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '1K (1024px)', value: '1K' },
  { label: '2K (2048px) 推荐', value: '2K' },
  { label: '4K (4096px) 高清', value: '4K' }
]

/**
 * 宽高比选项
 * 用于图像生成节点
 */
export const ASPECT_RATIO_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '3:4 (电商标准)', value: '3:4' },
  { label: '1:1 (正方形)', value: '1:1' },
  { label: '4:3 (横向)', value: '4:3' },
  { label: '9:16 (竖屏)', value: '9:16' },
  { label: '16:9 (宽屏)', value: '16:9' }
]

/**
 * 视频宽高比选项
 */
export const VIDEO_ASPECT_RATIO_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '16:9 (横屏)', value: '16:9' },
  { label: '9:16 (竖屏)', value: '9:16' },
  { label: '1:1 (正方形)', value: '1:1' }
]

/**
 * 视频时长选项
 */
export const VIDEO_DURATION_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '5秒', value: '5' },
  { label: '10秒', value: '10' }
]

/**
 * 通用质量选项
 */
export const QUALITY_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '标准', value: 'standard' },
  { label: '高清', value: 'hd' }
]

/**
 * 布尔选项 (是/否)
 */
export const BOOLEAN_OPTIONS: Array<{ label: string; value: boolean }> = [
  { label: '是', value: true },
  { label: '否', value: false }
]

// 类型导出
export type ImageSizeOption = '1K' | '2K' | '4K'
export type AspectRatioOption = '3:4' | '1:1' | '4:3' | '9:16' | '16:9'
export type VideoAspectRatioOption = '16:9' | '9:16' | '1:1'
export type VideoDurationOption = '5' | '10'
