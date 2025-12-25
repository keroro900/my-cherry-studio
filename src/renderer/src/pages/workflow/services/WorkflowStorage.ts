/**
 * 工作流本地存储服务 - Cherry 本土化
 *
 * 使用 localStorage 保存工作流模板
 * 替代后端 API，实现完全前端化
 */

import { loggerService } from '@logger'
import { uuid } from '@renderer/utils'

import type { WorkflowEdge, WorkflowNode } from '../types'

const logger = loggerService.withContext('WorkflowStorage')

// ==================== 类型定义 ====================

/**
 * 保存的工作流模板
 */
export interface SavedWorkflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: number
  updatedAt: number
}

/**
 * 工作流模板列表项
 */
export interface WorkflowTemplateItem {
  id: string
  name: string
  description: string
  nodeCount: number
  updatedAt: number
}

// ==================== 存储键 ====================

const STORAGE_KEY = 'cherry_workflow_templates'
const DRAFT_KEY = 'cherry_workflow_draft'

// ==================== 草稿类型 ====================

/**
 * 工作流草稿
 */
export interface WorkflowDraft {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  workflowId?: string
  workflowName?: string
  savedAt: number
}

// ==================== 工作流存储服务 ====================

class WorkflowStorageService {
  /**
   * 获取所有工作流模板列表
   */
  listTemplates(): WorkflowTemplateItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []

      const templates: SavedWorkflow[] = JSON.parse(data)
      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        nodeCount: t.nodes.length,
        updatedAt: t.updatedAt
      }))
    } catch (error) {
      logger.error('Failed to list templates', { error })
      return []
    }
  }

  /**
   * 获取工作流模板详情
   */
  getTemplate(id: string): SavedWorkflow | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null

      const templates: SavedWorkflow[] = JSON.parse(data)
      return templates.find((t) => t.id === id) || null
    } catch (error) {
      logger.error('Failed to get template', { error, id })
      return null
    }
  }

  /**
   * 保存工作流模板
   */
  saveTemplate(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    name: string,
    description: string = '',
    existingId?: string
  ): SavedWorkflow {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      const templates: SavedWorkflow[] = data ? JSON.parse(data) : []

      const now = Date.now()
      const id = existingId || uuid()

      // 查找是否存在同名或同 ID 的模板
      const existingIndex = templates.findIndex((t) => t.id === id || t.name === name)

      const workflow: SavedWorkflow = {
        id,
        name,
        description,
        nodes,
        edges,
        createdAt: existingIndex >= 0 ? templates[existingIndex].createdAt : now,
        updatedAt: now
      }

      if (existingIndex >= 0) {
        templates[existingIndex] = workflow
      } else {
        templates.push(workflow)
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
      return workflow
    } catch (error) {
      logger.error('Failed to save template', { error, name, existingId })
      throw new Error('保存失败')
    }
  }

  /**
   * 删除工作流模板
   */
  deleteTemplate(id: string): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return false

      const templates: SavedWorkflow[] = JSON.parse(data)
      const filtered = templates.filter((t) => t.id !== id)

      if (filtered.length === templates.length) return false

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      return true
    } catch (error) {
      logger.error('Failed to delete template', { error, id })
      return false
    }
  }

  /**
   * 导出工作流为 JSON
   */
  exportToJson(workflow: SavedWorkflow): string {
    return JSON.stringify(workflow, null, 2)
  }

  /**
   * 从 JSON 导入工作流
   */
  importFromJson(json: string): SavedWorkflow | null {
    try {
      const workflow = JSON.parse(json) as SavedWorkflow
      // 验证基本结构
      if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        throw new Error('无效的工作流格式')
      }
      // 重新生成 ID 避免冲突
      workflow.id = uuid()
      workflow.name = workflow.name + ' (导入)'
      workflow.createdAt = Date.now()
      workflow.updatedAt = Date.now()
      return workflow
    } catch (error) {
      logger.error('Failed to import workflow', { error })
      return null
    }
  }

  // ==================== 草稿管理 ====================

  /**
   * 保存工作流草稿（自动保存）
   * 只保留最新的草稿，清理大型数据避免配额超限
   */
  saveDraft(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    workflowId?: string,
    workflowName?: string
  ): boolean {
    try {
      // 清理节点中的大型数据（图片 base64 等）
      const cleanedNodes = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          // 清理节点结果中的大型数据
          result: undefined
        }
      }))

      const draft: WorkflowDraft = {
        nodes: cleanedNodes,
        edges,
        workflowId,
        workflowName,
        savedAt: Date.now()
      }

      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      logger.debug('Draft saved', { nodeCount: nodes.length, workflowName })
      return true
    } catch (error) {
      // 可能是配额超限，尝试清除旧草稿后重试
      logger.warn('Failed to save draft, clearing old draft', { error })
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        // ignore
      }
      return false
    }
  }

  /**
   * 加载工作流草稿
   */
  loadDraft(): WorkflowDraft | null {
    try {
      const data = localStorage.getItem(DRAFT_KEY)
      if (!data) return null

      const draft: WorkflowDraft = JSON.parse(data)
      // 验证基本结构
      if (!draft.nodes || !Array.isArray(draft.nodes)) {
        return null
      }
      return draft
    } catch (error) {
      logger.error('Failed to load draft', { error })
      return null
    }
  }

  /**
   * 检查是否有未保存的草稿
   */
  hasDraft(): boolean {
    try {
      const data = localStorage.getItem(DRAFT_KEY)
      return !!data
    } catch {
      return false
    }
  }

  /**
   * 清除草稿
   */
  clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY)
      logger.debug('Draft cleared')
    } catch (error) {
      logger.error('Failed to clear draft', { error })
    }
  }

  /**
   * 获取草稿信息（不加载完整数据）
   */
  getDraftInfo(): { savedAt: number; nodeCount: number; workflowName?: string } | null {
    try {
      const data = localStorage.getItem(DRAFT_KEY)
      if (!data) return null

      const draft: WorkflowDraft = JSON.parse(data)
      return {
        savedAt: draft.savedAt,
        nodeCount: draft.nodes?.length || 0,
        workflowName: draft.workflowName
      }
    } catch {
      return null
    }
  }
}

// 导出单例
export const workflowStorage = new WorkflowStorageService()
