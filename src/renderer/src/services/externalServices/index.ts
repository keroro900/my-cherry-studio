/**
 * 外部服务模块索引
 *
 * 导出所有非 LLM 的外部服务客户端
 */

export { type Image2VideoRequest, type HealthCheckResult as KlingHealthCheckResult, klingService } from './KlingService'
export {
  type HealthCheckResult as RunningHubHealthCheckResult,
  type RunningHubNodeInfo,
  runningHubService
} from './RunningHubService'
