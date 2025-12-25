/**
 * 默认配置表单注册
 * Default Config Form Registrations
 *
 * 注册所有内置的配置表单组件
 *
 * **Feature: ui-prompt-optimization, Task 5.1**
 * **Validates: Requirements 11.1**
 */

import { WorkflowNodeType } from '../../types'
import AplusContentConfigForm from './AplusContentConfigForm'
import ConditionConfigForm from './ConditionConfigForm'
import { configFormRegistry } from './ConfigFormRegistry'
import EcomConfigForm from './EcomConfigForm'
import FileInputConfigForm from './FileInputConfigForm'
import GeminiEditConfigForm from './GeminiEditConfigForm'
import GeminiGenerateConfigForm from './GeminiGenerateConfigForm'
import ImageInputConfigForm from './ImageInputConfigForm'
import IndustryPhotoConfigForm from './IndustryPhotoConfigForm'
import KlingVideoConfigForm from './KlingVideoConfigForm'
import OutputConfigForm from './OutputConfigForm'
import PatternConfigForm from './PatternConfigForm'
import ProductDescriptionConfigForm from './ProductDescriptionConfigForm'
import RunningHubConfigForm from './RunningHubConfigForm'
import TextInputConfigForm from './TextInputConfigForm'
import UnifiedPromptConfigForm from './UnifiedPromptConfigForm'
import VideoPromptConfigForm from './VideoPromptConfigForm'

/**
 * 注册所有默认配置表单
 * 应在应用启动时调用一次
 */
export function registerDefaultConfigForms(): void {
  // Gemini 图像生成节点
  configFormRegistry.register({
    nodeTypes: [
      WorkflowNodeType.GEMINI_GENERATE,
      WorkflowNodeType.GEMINI_GENERATE_MODEL,
      WorkflowNodeType.GEMINI_MODEL_FROM_CLOTHES
    ],
    component: GeminiGenerateConfigForm as any,
    priority: 0,
    description: 'Gemini 图像生成节点配置表单'
  })

  // Gemini 图像编辑节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_EDIT, WorkflowNodeType.GEMINI_EDIT_CUSTOM],
    component: GeminiEditConfigForm as any,
    priority: 0,
    description: 'Gemini 图像编辑节点配置表单'
  })

  // 电商图像生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_ECOM],
    component: EcomConfigForm as any,
    priority: 0,
    description: '电商图像生成节点配置表单'
  })

  // 图案生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.GEMINI_PATTERN],
    component: PatternConfigForm as any,
    priority: 0,
    description: '图案生成节点配置表单'
  })

  // 智能提示词节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.UNIFIED_PROMPT],
    component: UnifiedPromptConfigForm as any,
    priority: 0,
    description: '智能提示词节点配置表单'
  })

  // 视频提示词节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.VIDEO_PROMPT],
    component: VideoPromptConfigForm as any,
    priority: 0,
    description: '视频提示词节点配置表单'
  })

  // ==================== 电商内容节点 ====================

  // 产品描述生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.PRODUCT_DESCRIPTION],
    component: ProductDescriptionConfigForm as any,
    priority: 0,
    description: '产品描述生成节点配置表单'
  })

  // A+ 内容生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.APLUS_CONTENT],
    component: AplusContentConfigForm as any,
    priority: 0,
    description: 'A+ 内容生成节点配置表单'
  })

  // ==================== 输入节点 ====================

  // 图片输入节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.IMAGE_INPUT],
    component: ImageInputConfigForm as any,
    priority: 0,
    description: '图片输入节点配置表单'
  })

  // 文本输入节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.TEXT_INPUT],
    component: TextInputConfigForm as any,
    priority: 0,
    description: '文本输入节点配置表单'
  })

  // 文件输入节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.FILE_INPUT],
    component: FileInputConfigForm as any,
    priority: 0,
    description: '文件输入节点配置表单'
  })

  // ==================== 视频节点 ====================

  // Kling 视频生成节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.KLING_IMAGE2VIDEO],
    component: KlingVideoConfigForm as any,
    priority: 0,
    description: 'Kling 视频生成节点配置表单'
  })

  // ==================== 外部服务节点 ====================

  // RunningHub 外部服务节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.RUNNINGHUB_APP],
    component: RunningHubConfigForm as any,
    priority: 0,
    description: 'RunningHub 外部服务节点配置表单'
  })

  // ==================== 流程控制节点 ====================

  // 条件分支节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.CONDITION],
    component: ConditionConfigForm as any,
    priority: 0,
    description: '条件分支节点配置表单'
  })

  // ==================== 行业摄影节点 ====================

  // 行业摄影节点（珠宝摄影、食品摄影、产品场景、首饰试戴、眼镜试戴、鞋类展示、美妆产品、家具场景、电子产品）
  configFormRegistry.register({
    nodeTypes: [
      WorkflowNodeType.JEWELRY_PHOTO,
      WorkflowNodeType.FOOD_PHOTO,
      WorkflowNodeType.PRODUCT_SCENE,
      WorkflowNodeType.JEWELRY_TRYON,
      WorkflowNodeType.EYEWEAR_TRYON,
      WorkflowNodeType.FOOTWEAR_DISPLAY,
      WorkflowNodeType.COSMETICS_PHOTO,
      WorkflowNodeType.FURNITURE_SCENE,
      WorkflowNodeType.ELECTRONICS_PHOTO
    ],
    component: IndustryPhotoConfigForm as any,
    priority: 0,
    description: '行业摄影节点通用配置表单'
  })

  // ==================== 输出节点 ====================

  // 输出节点
  configFormRegistry.register({
    nodeTypes: [WorkflowNodeType.OUTPUT],
    component: OutputConfigForm as any,
    priority: 0,
    description: '输出节点配置表单'
  })

  // 标记注册表已初始化
  configFormRegistry.markInitialized()
}

/**
 * 检查是否已注册
 */
let isRegistered = false

/**
 * 确保默认表单已注册（幂等操作）
 */
export function ensureDefaultFormsRegistered(): void {
  if (!isRegistered) {
    registerDefaultConfigForms()
    isRegistered = true
  }
}
