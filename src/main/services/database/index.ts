/**
 * 统一数据库服务模块
 *
 * 提供统一的数据库连接管理和生命周期控制
 */

export {
  createDatabaseAdapter,
  getUnifiedDatabaseService,
  UnifiedDatabaseService,
  type DatabaseAdapter,
  type DatabaseStats
} from './UnifiedDatabaseService'
