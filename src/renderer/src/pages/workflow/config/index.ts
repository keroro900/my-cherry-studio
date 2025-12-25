/**
 * 工作流配置模块统一导出
 * Workflow Configuration Module Exports
 *
 * @version 1.0.0
 * @created 2024-12-19
 */

// 端口配置
export {
  DYNAMIC_IMAGE_INPUT_NODES,
  generateDynamicImagePorts,
  getNodePortConfig,
  getPortRange,
  isValidPortCount,
  mergeImagePorts,
  NODE_PORT_CONFIGS,
  supportsDynamicImagePorts
} from './portConfig'

// 类型导出
export type {
  ImagePortDefinition,
  NodePortConfig,
  PortDataType
} from './portConfig'
