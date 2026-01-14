/**
 * Flow Module - 对话流控制
 *
 * 提供对话流锁定和话题管理功能
 */

export {
  createFlowLockService,
  type DeviationResult,
  type FlowLock,
  type FlowLockConfig,
  FlowLockService,
  getFlowLockService,
  type LockReason,
  type LockStatus,
  type LockType,
  type TopicContext
} from './FlowLockService'
