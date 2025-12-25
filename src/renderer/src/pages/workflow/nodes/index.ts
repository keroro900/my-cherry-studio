/**
 * 工作流节点模块
 *
 * 提供类似 ComfyUI 的模块化节点架构
 * 支持内置节点和自定义节点的热加载
 */

import { loggerService } from '@logger'

// 导出基础模块
export * from './base'

// 显式导出节点定义（避免与 ./base 的 NodeDefinition 冲突）
export {
  getAllNodeTypes,
  getNodeDefinition,
  getNodesByCategory,
  isValidNodeType,
  /**
   * @deprecated 请使用 NodeRegistryAdapter 或 nodeRegistry 代替
   * NODE_REGISTRY 是静态对象，不支持动态注册的节点
   * @see NodeRegistryAdapter.getNodeDefinition()
   * @see nodeRegistry.get()
   */
  NODE_REGISTRY,
  WorkflowNodeType
} from './definitions'

// 推荐使用的现代 API
export { NodeRegistryAdapter } from './base/NodeRegistryAdapter'

// 导出 AI 节点
export { UnifiedPromptNode } from './ai/UnifiedPromptNode'
export { VideoPromptExecutor, VideoPromptNode } from './ai/VideoPromptNode'

// 导出文本/内容节点
export { AplusContentExecutor, AplusContentNode } from './text/AplusContentNode'
export { ProductDescriptionExecutor, ProductDescriptionNode } from './text/ProductDescriptionNode'

// 导出输入节点
export { FileInputExecutor, FileInputNode } from './input/FileInputNode'
export { ImageInputExecutor, ImageInputNode } from './input/ImageInputNode'
export { TextInputExecutor, TextInputNode } from './input/TextInputNode'

// 导出图像处理节点
export { CompareImageExecutor, CompareImageNode } from './image/CompareImageNode'
export { CosmeticsPhotoExecutor, CosmeticsPhotoNode } from './image/CosmeticsPhotoNode'
export { ElectronicsPhotoExecutor, ElectronicsPhotoNode } from './image/ElectronicsPhotoNode'
export { EyewearTryonExecutor, EyewearTryonNode } from './image/EyewearTryonNode'
export { FoodPhotoExecutor, FoodPhotoNode } from './image/FoodPhotoNode'
export { FootwearDisplayExecutor, FootwearDisplayNode } from './image/FootwearDisplayNode'
export { FurnitureSceneExecutor, FurnitureSceneNode } from './image/FurnitureSceneNode'
export { GeminiEcomExecutor, GeminiEcomNode } from './image/GeminiEcomNode'
export { GeminiEditCustomNode, GeminiEditExecutor, GeminiEditNode } from './image/GeminiEditNode'
export { GeminiGenerateExecutor, GeminiGenerateNode } from './image/GeminiGenerateNode'
export {
  GeminiGenerateModelNode,
  GeminiModelExecutor,
  GeminiModelFromClothesNode
} from './image/GeminiModelNode'
export { GeminiPatternExecutor, GeminiPatternNode } from './image/GeminiPatternNode'
export { JewelryPhotoExecutor, JewelryPhotoNode } from './image/JewelryPhotoNode'
export { JewelryTryonExecutor, JewelryTryonNode } from './image/JewelryTryonNode'
export { PlatformResizeExecutor, PlatformResizeNode } from './image/PlatformResizeNode'
export { ProductSceneExecutor, ProductSceneNode } from './image/ProductSceneNode'

// 导出视频节点
export { KlingImage2VideoExecutor, KlingImage2VideoNode } from './video/KlingImage2VideoNode'
export { UnifiedVideoGenerationExecutor, UnifiedVideoGenerationNode } from './video/UnifiedVideoGenerationNode'

// 导出外部服务节点
export { HttpRequestExecutor, HttpRequestNode } from './external/HttpRequestNode'
export { RunningHubExecutor, RunningHubNode } from './external/RunningHubNode'

// 导出流程控制节点（包含高级节点）
export {
  // 代码执行
  CodeExecutorExecutor,
  CodeExecutorNode,
  // 条件分支
  ConditionExecutor,
  ConditionNode,
  // List 节点
  ImageListExecutor,
  ImageListNode,
  // JSON 转换
  JsonTransformExecutor,
  JsonTransformNode,
  ListFilterExecutor,
  ListFilterNode,
  ListMergeExecutor,
  ListMergeNode,
  // Loop 节点
  LoopExecutor,
  LoopIndexExecutor,
  LoopIndexNode,
  LoopListExecutor,
  LoopListNode,
  LoopNode,
  MultiSwitchExecutor,
  MultiSwitchNode,
  // Pipe 节点
  PipeExecutor,
  PipeMergerExecutor,
  PipeMergerNode,
  PipeNode,
  PipeRouterExecutor,
  PipeRouterNode,
  // Switch 节点
  SwitchExecutor,
  SwitchNode,
  TextListExecutor,
  TextListNode
} from './flow'

// 导出输出节点
export { OutputExecutor, OutputNode } from './output/OutputNode'

// 导出 Fashion 节点
export {
  FashionKnowledgeExecutor,
  FashionKnowledgeNode,
  GarmentAnalysisExecutor,
  GarmentAnalysisNode,
  TrendAnalysisExecutor,
  TrendAnalysisNode
} from './fashion'

// 导出自定义节点模块
export {
  BUILTIN_TEMPLATES,
  createDefaultCustomNodeDefinition,
  CustomNodeExecutor,
  customNodeRegistry,
  validateCustomNodeDefinition
} from './custom'
export type {
  CodeExecutionMode,
  CustomConfigField,
  CustomNodeDefinition,
  CustomNodeStorage,
  CustomNodeTemplate,
  CustomPortConfig,
  ErrorHandlingStrategy
} from './custom'

// 节点注册函数
import { UnifiedPromptNode } from './ai/UnifiedPromptNode'
import { VideoPromptNode } from './ai/VideoPromptNode'
import { nodeRegistry } from './base'
import { HttpRequestNode } from './external/HttpRequestNode'
import { RunningHubNode } from './external/RunningHubNode'
import {
  CodeExecutorNode,
  ConditionNode,
  ImageListNode,
  JsonTransformNode,
  ListFilterNode,
  ListMergeNode,
  LoopIndexNode,
  LoopListNode,
  LoopNode,
  MultiSwitchNode,
  PipeMergerNode,
  PipeNode,
  PipeRouterNode,
  SwitchNode,
  TextListNode
} from './flow'
import { CompareImageNode } from './image/CompareImageNode'
import { CosmeticsPhotoNode } from './image/CosmeticsPhotoNode'
import { ElectronicsPhotoNode } from './image/ElectronicsPhotoNode'
import { EyewearTryonNode } from './image/EyewearTryonNode'
import { FoodPhotoNode } from './image/FoodPhotoNode'
import { FootwearDisplayNode } from './image/FootwearDisplayNode'
import { FurnitureSceneNode } from './image/FurnitureSceneNode'
import { GeminiEcomNode } from './image/GeminiEcomNode'
import { GeminiEditCustomNode, GeminiEditNode } from './image/GeminiEditNode'
import { GeminiGenerateNode } from './image/GeminiGenerateNode'
import { GeminiGenerateModelNode, GeminiModelFromClothesNode } from './image/GeminiModelNode'
import { GeminiPatternNode } from './image/GeminiPatternNode'
import { JewelryPhotoNode } from './image/JewelryPhotoNode'
import { JewelryTryonNode } from './image/JewelryTryonNode'
import { PlatformResizeNode } from './image/PlatformResizeNode'
import { ProductSceneNode } from './image/ProductSceneNode'
import { FileInputNode } from './input/FileInputNode'
import { ImageInputNode } from './input/ImageInputNode'
import { TextInputNode } from './input/TextInputNode'
import { OutputNode } from './output/OutputNode'
import { AplusContentNode } from './text/AplusContentNode'
import { ProductDescriptionNode } from './text/ProductDescriptionNode'
import { KlingImage2VideoNode } from './video/KlingImage2VideoNode'
import { UnifiedVideoGenerationNode } from './video/UnifiedVideoGenerationNode'

// Fashion 节点导入
import { FashionKnowledgeNode, GarmentAnalysisNode, TrendAnalysisNode } from './fashion'

// 初始化标记，防止 HMR 时重复注册
let _nodeSystemInitialized = false

const logger = loggerService.withContext('NodeSystem')

/**
 * 注册所有内置节点
 */
export async function registerBuiltinNodes(): Promise<void> {
  // 输入节点
  nodeRegistry.register(ImageInputNode, 'builtin')
  nodeRegistry.register(TextInputNode, 'builtin')
  nodeRegistry.register(FileInputNode, 'builtin')

  // AI 节点
  nodeRegistry.register(UnifiedPromptNode, 'builtin')
  nodeRegistry.register(VideoPromptNode, 'builtin')

  // 电商内容节点
  nodeRegistry.register(ProductDescriptionNode, 'builtin')
  nodeRegistry.register(AplusContentNode, 'builtin')

  // 图像处理节点
  nodeRegistry.register(GeminiGenerateNode, 'builtin')
  nodeRegistry.register(GeminiEditNode, 'builtin')
  nodeRegistry.register(GeminiEditCustomNode, 'builtin')
  nodeRegistry.register(CompareImageNode, 'builtin')
  nodeRegistry.register(GeminiGenerateModelNode, 'builtin')
  nodeRegistry.register(GeminiModelFromClothesNode, 'builtin')
  nodeRegistry.register(GeminiPatternNode, 'builtin')
  nodeRegistry.register(GeminiEcomNode, 'builtin')

  // 行业摄影节点
  nodeRegistry.register(JewelryPhotoNode, 'builtin')
  nodeRegistry.register(FoodPhotoNode, 'builtin')
  nodeRegistry.register(ProductSceneNode, 'builtin')
  nodeRegistry.register(JewelryTryonNode, 'builtin')
  nodeRegistry.register(EyewearTryonNode, 'builtin')
  nodeRegistry.register(FootwearDisplayNode, 'builtin')
  nodeRegistry.register(CosmeticsPhotoNode, 'builtin')
  nodeRegistry.register(FurnitureSceneNode, 'builtin')
  nodeRegistry.register(ElectronicsPhotoNode, 'builtin')

  // 图像工具节点
  nodeRegistry.register(PlatformResizeNode, 'builtin')

  // 视频节点
  nodeRegistry.register(KlingImage2VideoNode, 'builtin')
  nodeRegistry.register(UnifiedVideoGenerationNode, 'builtin')

  // 外部服务节点
  nodeRegistry.register(RunningHubNode, 'builtin')
  nodeRegistry.register(HttpRequestNode, 'builtin')

  // 流程控制节点
  nodeRegistry.register(ConditionNode, 'builtin')
  nodeRegistry.register(CodeExecutorNode, 'builtin')
  nodeRegistry.register(JsonTransformNode, 'builtin')

  // 高级节点 - List
  nodeRegistry.register(ImageListNode, 'builtin')
  nodeRegistry.register(TextListNode, 'builtin')
  nodeRegistry.register(ListMergeNode, 'builtin')
  nodeRegistry.register(ListFilterNode, 'builtin')

  // 高级节点 - Pipe
  nodeRegistry.register(PipeNode, 'builtin')
  nodeRegistry.register(PipeRouterNode, 'builtin')
  nodeRegistry.register(PipeMergerNode, 'builtin')

  // 高级节点 - Switch
  nodeRegistry.register(SwitchNode, 'builtin')
  nodeRegistry.register(MultiSwitchNode, 'builtin')

  // 高级节点 - Loop
  nodeRegistry.register(LoopNode, 'builtin')
  nodeRegistry.register(LoopIndexNode, 'builtin')
  nodeRegistry.register(LoopListNode, 'builtin')

  // Fashion 节点
  nodeRegistry.register(GarmentAnalysisNode, 'builtin')
  nodeRegistry.register(FashionKnowledgeNode, 'builtin')
  nodeRegistry.register(TrendAnalysisNode, 'builtin')

  // 输出节点
  nodeRegistry.register(OutputNode, 'builtin')
}

/**
 * 初始化节点系统
 * 包含防重复初始化保护
 */
export async function initializeNodeSystem(): Promise<void> {
  if (_nodeSystemInitialized) {
    return
  }

  // 注册内置节点
  await registerBuiltinNodes()

  // 加载自定义节点
  const { customNodeRegistry } = await import('./custom')
  await customNodeRegistry.initialize()

  _nodeSystemInitialized = true
  logger.info('初始化完成', { registeredNodes: nodeRegistry.getAllTypes().length })
}

/**
 * 获取节点执行器
 * 用于 WorkflowEngine 调用
 */
export function getNodeExecutor(nodeType: string) {
  const definition = nodeRegistry.get(nodeType)
  return definition?.executor
}
