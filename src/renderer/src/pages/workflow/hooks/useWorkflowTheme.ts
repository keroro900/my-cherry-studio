/**
 * 工作流主题 Hook
 * Workflow Theme Hook
 *
 * 用于管理工作流节点主题
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setWorkflowThemeId } from '@renderer/store/settings'
import { useCallback, useEffect, useMemo } from 'react'

import { getDefaultWorkflowTheme, getWorkflowThemeById, WORKFLOW_THEMES } from '../config/workflowThemes'

/**
 * 工作流主题 Hook
 */
export function useWorkflowTheme() {
  const dispatch = useAppDispatch()
  const workflowThemeId = useAppSelector((state) => state.settings.workflowThemeId) || 'cherry-default'

  // 当前主题
  const currentTheme = useMemo(() => {
    return getWorkflowThemeById(workflowThemeId) || getDefaultWorkflowTheme()
  }, [workflowThemeId])

  // 应用主题到 DOM
  useEffect(() => {
    const workflowRoot = document.querySelector('.workflow-root')
    if (workflowRoot) {
      workflowRoot.setAttribute('data-workflow-theme', currentTheme.id)
    }
  }, [currentTheme])

  // 设置主题
  const setTheme = useCallback(
    (themeId: string) => {
      dispatch(setWorkflowThemeId(themeId))
    },
    [dispatch]
  )

  // 获取所有主题
  const allThemes = useMemo(() => WORKFLOW_THEMES, [])

  return {
    // 状态
    currentThemeId: workflowThemeId,
    currentTheme,
    allThemes,

    // 操作
    setTheme,

    // 工具函数
    getThemeById: getWorkflowThemeById
  }
}

export default useWorkflowTheme
