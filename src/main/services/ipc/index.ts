/**
 * 统一 IPC 模块
 *
 * 导出 IPC Handler 工厂和相关类型
 */

export {
  createHandlerGroup,
  createIpcHandler,
  getIpcHandlerFactory,
  IpcErrorCodes,
  ipcError,
  IpcHandlerError,
  ipcSuccess,
  safeHandle,
  safeHandleResult,
  type HandlerDefinition,
  type HandlerGroup,
  type HandlerOptions,
  type IpcError,
  type IpcErrorCode,
  type IpcHandlerFactory,
  type IpcResult,
  type IpcResultMeta
} from './IpcHandlerFactory'
