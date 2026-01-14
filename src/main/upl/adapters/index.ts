/**
 * UPL 适配器模块导出
 *
 * @module upl/adapters
 */

export { MCPAdapter, MCPExecutor, createMCPAdapter, type IMCPService } from './MCPAdapter'
export {
  VCPAdapter,
  VCPExecutor,
  createVCPAdapter,
  type VCPPluginInfo,
  type VCPServerConfig,
  type VCPToolInfo
} from './VCPAdapter'
