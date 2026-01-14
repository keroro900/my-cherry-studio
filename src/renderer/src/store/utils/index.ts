/**
 * Redux Store 工具模块
 *
 * 提供标准化的 Slice 模式和工具函数
 */

export {
  createFilterSortReducers,
  createListReducers,
  createListSelectors,
  createQueueReducers,
  createQueueSelectors,
  createTimestampedEntity,
  filterItems,
  generateId,
  SliceUtils,
  sortItems,
  type CompositeState,
  type EntityWithId,
  type EntityWithTimestamp,
  type FilterConfig,
  type ListState,
  type PaginationConfig,
  type QueueState,
  type QueueTask,
  type SortConfig,
  type TaskStatus
} from './SliceUtils'
