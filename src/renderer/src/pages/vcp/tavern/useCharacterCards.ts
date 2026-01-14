/**
 * useCharacterCards Hook
 *
 * 管理角色卡的状态和操作
 */

import { useCallback, useEffect, useState } from 'react'

import type { CharacterCard, CharacterCardListItem, ImportOptions, TavernIpcResponse } from './types'

interface UseCharacterCardsReturn {
  // 状态
  cards: CharacterCardListItem[]
  activeCard: CharacterCard | null
  loading: boolean
  error: string | null

  // 操作
  refreshCards: () => Promise<void>
  importCard: (options: ImportOptions) => Promise<CharacterCard | null>
  activateCard: (id: string) => Promise<boolean>
  deactivateCard: () => Promise<void>
  deleteCard: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  getCard: (id: string) => Promise<CharacterCard | null>
  updateCard: (id: string, updates: Partial<CharacterCard>) => Promise<CharacterCard | null>
  createCard: (name: string, data?: Partial<CharacterCard>) => Promise<CharacterCard | null>
}

/**
 * 角色卡管理 Hook
 */
export function useCharacterCards(): UseCharacterCardsReturn {
  const [cards, setCards] = useState<CharacterCardListItem[]>([])
  const [activeCard, setActiveCard] = useState<CharacterCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取卡片列表
   */
  const refreshCards = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response: TavernIpcResponse<CharacterCardListItem[]> =
        await window.electron.ipcRenderer.invoke('tavern:card:list')

      if (response.success && response.data) {
        setCards(response.data)
      } else {
        setError(response.error || 'Failed to load cards')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 获取活跃卡片
   */
  const refreshActiveCard = useCallback(async () => {
    try {
      const response: TavernIpcResponse<CharacterCard | null> =
        await window.electron.ipcRenderer.invoke('tavern:card:getActive')

      if (response.success) {
        setActiveCard(response.data || null)
      }
    } catch {
      // 忽略错误，可能模块未初始化
    }
  }, [])

  /**
   * 导入角色卡
   */
  const importCard = useCallback(
    async (options: ImportOptions): Promise<CharacterCard | null> => {
      setLoading(true)
      setError(null)

      try {
        const response: TavernIpcResponse<CharacterCard> = await window.electron.ipcRenderer.invoke(
          'tavern:card:import',
          options
        )

        if (response.success && response.data) {
          await refreshCards()
          return response.data
        } else {
          setError(response.error || 'Failed to import card')
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [refreshCards]
  )

  /**
   * 激活角色卡
   */
  const activateCard = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response: TavernIpcResponse<CharacterCard> = await window.electron.ipcRenderer.invoke(
          'tavern:card:activate',
          id
        )

        if (response.success && response.data) {
          setActiveCard(response.data)
          await refreshCards() // 刷新使用次数
          return true
        } else {
          setError(response.error || 'Failed to activate card')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return false
      }
    },
    [refreshCards]
  )

  /**
   * 停用角色卡
   */
  const deactivateCard = useCallback(async (): Promise<void> => {
    try {
      await window.electron.ipcRenderer.invoke('tavern:card:deactivate')
      setActiveCard(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  /**
   * 删除角色卡
   */
  const deleteCard = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response: TavernIpcResponse<boolean> = await window.electron.ipcRenderer.invoke('tavern:card:delete', id)

        if (response.success) {
          await refreshCards()
          if (activeCard?.id === id) {
            setActiveCard(null)
          }
          return true
        } else {
          setError(response.error || 'Failed to delete card')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return false
      }
    },
    [activeCard, refreshCards]
  )

  /**
   * 切换收藏
   */
  const toggleFavorite = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response: TavernIpcResponse<boolean> = await window.electron.ipcRenderer.invoke(
          'tavern:card:toggleFavorite',
          id
        )

        if (response.success) {
          await refreshCards()
          return response.data ?? false
        }
        return false
      } catch {
        return false
      }
    },
    [refreshCards]
  )

  /**
   * 获取单个角色卡
   */
  const getCard = useCallback(async (id: string): Promise<CharacterCard | null> => {
    try {
      const response: TavernIpcResponse<CharacterCard> = await window.electron.ipcRenderer.invoke('tavern:card:get', id)

      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  /**
   * 更新角色卡
   */
  const updateCard = useCallback(
    async (id: string, updates: Partial<CharacterCard>): Promise<CharacterCard | null> => {
      setLoading(true)
      setError(null)

      try {
        const response: TavernIpcResponse<CharacterCard> = await window.electron.ipcRenderer.invoke(
          'tavern:card:update',
          id,
          updates
        )

        if (response.success && response.data) {
          await refreshCards()
          // 如果更新的是活跃卡片，也更新活跃状态
          if (activeCard?.id === id) {
            setActiveCard(response.data)
          }
          return response.data
        } else {
          setError(response.error || 'Failed to update card')
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [refreshCards, activeCard]
  )

  /**
   * 创建角色卡
   */
  const createCard = useCallback(
    async (name: string, data?: Partial<CharacterCard>): Promise<CharacterCard | null> => {
      setLoading(true)
      setError(null)

      try {
        const response: TavernIpcResponse<CharacterCard> = await window.electron.ipcRenderer.invoke(
          'tavern:card:create',
          name,
          data
        )

        if (response.success && response.data) {
          await refreshCards()
          return response.data
        } else {
          setError(response.error || 'Failed to create card')
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [refreshCards]
  )

  // 初始化加载
  useEffect(() => {
    refreshCards()
    refreshActiveCard()
  }, [refreshCards, refreshActiveCard])

  return {
    cards,
    activeCard,
    loading,
    error,
    refreshCards,
    importCard,
    activateCard,
    deactivateCard,
    deleteCard,
    toggleFavorite,
    getCard,
    updateCard,
    createCard
  }
}
