/**
 * 工作流历史记录 Hook
 * 实现撤销/重做功能
 */

import { useCallback, useRef, useState } from 'react'

interface HistoryState {
  nodes: any[]
  edges: any[]
}

interface UseWorkflowHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  undo: () => HistoryState | null
  redo: () => HistoryState | null
  push: (state: HistoryState) => void
  clear: () => void
}

const MAX_HISTORY_SIZE = 50

export function useWorkflowHistory(): UseWorkflowHistoryReturn {
  const [historyIndex, setHistoryIndex] = useState(-1)
  const historyRef = useRef<HistoryState[]>([])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyRef.current.length - 1

  const push = useCallback(
    (state: HistoryState) => {
      // 如果在历史记录中间位置，删除后面的记录
      if (historyIndex < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndex + 1)
      }

      // 添加新状态
      historyRef.current.push({
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        edges: JSON.parse(JSON.stringify(state.edges))
      })

      // 限制历史记录大小
      if (historyRef.current.length > MAX_HISTORY_SIZE) {
        historyRef.current.shift()
      } else {
        setHistoryIndex(historyRef.current.length - 1)
      }
    },
    [historyIndex]
  )

  const undo = useCallback((): HistoryState | null => {
    if (!canUndo) return null

    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    return historyRef.current[newIndex]
  }, [canUndo, historyIndex])

  const redo = useCallback((): HistoryState | null => {
    if (!canRedo) return null

    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    return historyRef.current[newIndex]
  }, [canRedo, historyIndex])

  const clear = useCallback(() => {
    historyRef.current = []
    setHistoryIndex(-1)
  }, [])

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    push,
    clear
  }
}
