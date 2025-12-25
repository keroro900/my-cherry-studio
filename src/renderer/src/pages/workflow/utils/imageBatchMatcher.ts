/**
 * 批量图片对生成工具
 *
 * 根据匹配模式将多个文件夹中的图片组合成批次
 * 支持三种匹配模式:
 * - byOrder: 按顺序匹配（第N张对第N张）
 * - byName: 按名称匹配（文件名相同的组成一组）
 * - hybrid: 混合模式（优先按名称，无匹配时按顺序）
 */

import type { FolderPathItem, ImageFileInfo, ImageMatchMode } from '../types'

// ==================== 类型定义 ====================

/**
 * 单个批次（一组匹配的图片）
 */
export interface ImageBatch {
  /** 批次索引（从0开始） */
  index: number
  /** 匹配键（名称或索引） */
  matchKey: string
  /** 各文件夹对应的图片 */
  images: {
    folderId: string
    folderLabel: string
    image: ImageFileInfo
  }[]
}

/**
 * 批量匹配结果
 */
export interface BatchMatchResult {
  /** 成功匹配的批次列表 */
  batches: ImageBatch[]
  /** 匹配统计 */
  stats: {
    totalBatches: number
    matchMode: ImageMatchMode
    /** 各文件夹的图片数量 */
    folderCounts: { folderId: string; label: string; count: number }[]
    /** 未匹配的图片数量 */
    unmatchedCount: number
  }
  /** 警告信息 */
  warnings: string[]
}

// ==================== 匹配器实现 ====================

/**
 * 按顺序匹配
 * 不同文件夹的第 N 张图片组成一组
 */
function matchByOrder(folders: FolderPathItem[]): BatchMatchResult {
  const warnings: string[] = []
  const batches: ImageBatch[] = []

  // 获取有效的文件夹（有图片的）
  const validFolders = folders.filter((f) => f.images && f.images.length > 0)

  if (validFolders.length === 0) {
    return {
      batches: [],
      stats: {
        totalBatches: 0,
        matchMode: 'byOrder',
        folderCounts: [],
        unmatchedCount: 0
      },
      warnings: ['没有找到任何有效的文件夹']
    }
  }

  // 找出最小图片数量
  const minCount = Math.min(...validFolders.map((f) => f.images!.length))
  const maxCount = Math.max(...validFolders.map((f) => f.images!.length))

  if (minCount !== maxCount) {
    warnings.push(`各文件夹图片数量不一致（${minCount} ~ ${maxCount}），将按最少数量 ${minCount} 生成批次`)
  }

  // 按顺序生成批次
  for (let i = 0; i < minCount; i++) {
    const batch: ImageBatch = {
      index: i,
      matchKey: `#${i + 1}`,
      images: validFolders.map((folder) => ({
        folderId: folder.id,
        folderLabel: folder.label,
        image: folder.images![i]
      }))
    }
    batches.push(batch)
  }

  // 计算未匹配数量
  const totalImages = validFolders.reduce((sum, f) => sum + f.images!.length, 0)
  const matchedImages = batches.length * validFolders.length
  const unmatchedCount = totalImages - matchedImages

  return {
    batches,
    stats: {
      totalBatches: batches.length,
      matchMode: 'byOrder',
      folderCounts: validFolders.map((f) => ({
        folderId: f.id,
        label: f.label,
        count: f.images!.length
      })),
      unmatchedCount
    },
    warnings
  }
}

/**
 * 按名称匹配
 * 文件名（不含扩展名）相同的图片组成一组
 */
function matchByName(folders: FolderPathItem[]): BatchMatchResult {
  const warnings: string[] = []
  const batches: ImageBatch[] = []

  // 获取有效的文件夹（有图片的）
  const validFolders = folders.filter((f) => f.images && f.images.length > 0)

  if (validFolders.length === 0) {
    return {
      batches: [],
      stats: {
        totalBatches: 0,
        matchMode: 'byName',
        folderCounts: [],
        unmatchedCount: 0
      },
      warnings: ['没有找到任何有效的文件夹']
    }
  }

  // 构建每个文件夹的 baseName -> image 映射
  const folderMaps = validFolders.map((folder) => {
    const map = new Map<string, ImageFileInfo>()
    folder.images!.forEach((img) => {
      map.set(img.baseName, img)
    })
    return { folder, map }
  })

  // 收集所有唯一的 baseName
  const allBaseNames = new Set<string>()
  folderMaps.forEach(({ map }) => {
    map.forEach((_, baseName) => allBaseNames.add(baseName))
  })

  // 对于每个 baseName，检查是否所有文件夹都有该名称的图片
  const matchedBaseNames: string[] = []
  const partialMatches: { baseName: string; foundIn: string[] }[] = []

  allBaseNames.forEach((baseName) => {
    const foundFolders = folderMaps.filter(({ map }) => map.has(baseName))
    if (foundFolders.length === validFolders.length) {
      matchedBaseNames.push(baseName)
    } else if (foundFolders.length > 0) {
      partialMatches.push({
        baseName,
        foundIn: foundFolders.map(({ folder }) => folder.label)
      })
    }
  })

  // 排序 baseName（自然排序）
  matchedBaseNames.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))

  // 生成批次
  matchedBaseNames.forEach((baseName, index) => {
    const batch: ImageBatch = {
      index,
      matchKey: baseName,
      images: folderMaps.map(({ folder, map }) => ({
        folderId: folder.id,
        folderLabel: folder.label,
        image: map.get(baseName)!
      }))
    }
    batches.push(batch)
  })

  // 生成警告
  if (partialMatches.length > 0) {
    const limitedMatches = partialMatches.slice(0, 5)
    warnings.push(
      `${partialMatches.length} 个文件名仅在部分文件夹中存在，已跳过：${limitedMatches
        .map((m) => `"${m.baseName}"`)
        .join(', ')}${partialMatches.length > 5 ? '...' : ''}`
    )
  }

  // 计算未匹配数量
  const totalImages = validFolders.reduce((sum, f) => sum + f.images!.length, 0)
  const matchedImages = batches.length * validFolders.length
  const unmatchedCount = totalImages - matchedImages

  return {
    batches,
    stats: {
      totalBatches: batches.length,
      matchMode: 'byName',
      folderCounts: validFolders.map((f) => ({
        folderId: f.id,
        label: f.label,
        count: f.images!.length
      })),
      unmatchedCount
    },
    warnings
  }
}

/**
 * 混合模式匹配
 * 优先按名称匹配，无匹配时按顺序补位
 */
function matchHybrid(folders: FolderPathItem[]): BatchMatchResult {
  const warnings: string[] = []
  const batches: ImageBatch[] = []

  // 获取有效的文件夹（有图片的）
  const validFolders = folders.filter((f) => f.images && f.images.length > 0)

  if (validFolders.length === 0) {
    return {
      batches: [],
      stats: {
        totalBatches: 0,
        matchMode: 'hybrid',
        folderCounts: [],
        unmatchedCount: 0
      },
      warnings: ['没有找到任何有效的文件夹']
    }
  }

  // 构建每个文件夹的 baseName -> image 映射和剩余队列
  const folderData = validFolders.map((folder) => {
    const map = new Map<string, ImageFileInfo>()
    const remaining = [...folder.images!]
    folder.images!.forEach((img) => {
      map.set(img.baseName, img)
    })
    return { folder, map, remaining }
  })

  // 第一步：按名称匹配
  const allBaseNames = new Set<string>()
  folderData.forEach(({ map }) => {
    map.forEach((_, baseName) => allBaseNames.add(baseName))
  })

  const usedImages = new Set<string>() // 记录已使用的图片路径

  // 按名称匹配
  const sortedBaseNames = Array.from(allBaseNames).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))

  sortedBaseNames.forEach((baseName) => {
    const foundAll = folderData.every(({ map }) => map.has(baseName))
    if (foundAll) {
      const batch: ImageBatch = {
        index: batches.length,
        matchKey: baseName,
        images: folderData.map(({ folder, map }) => {
          const img = map.get(baseName)!
          usedImages.add(img.path)
          return {
            folderId: folder.id,
            folderLabel: folder.label,
            image: img
          }
        })
      }
      batches.push(batch)
    }
  })

  const nameMatchedCount = batches.length

  // 第二步：对剩余图片按顺序匹配
  // 更新剩余队列（移除已匹配的图片）
  folderData.forEach((fd) => {
    fd.remaining = fd.remaining.filter((img) => !usedImages.has(img.path))
  })

  // 找出剩余最小数量
  const minRemaining = Math.min(...folderData.map((fd) => fd.remaining.length))

  if (minRemaining > 0) {
    for (let i = 0; i < minRemaining; i++) {
      const batch: ImageBatch = {
        index: batches.length,
        matchKey: `#${batches.length + 1}`,
        images: folderData.map((fd) => ({
          folderId: fd.folder.id,
          folderLabel: fd.folder.label,
          image: fd.remaining[i]
        }))
      }
      batches.push(batch)
    }

    warnings.push(`混合模式：${nameMatchedCount} 个按名称匹配，${batches.length - nameMatchedCount} 个按顺序补位`)
  }

  // 计算未匹配数量
  const totalImages = validFolders.reduce((sum, f) => sum + f.images!.length, 0)
  const matchedImages = batches.length * validFolders.length
  const unmatchedCount = totalImages - matchedImages

  return {
    batches,
    stats: {
      totalBatches: batches.length,
      matchMode: 'hybrid',
      folderCounts: validFolders.map((f) => ({
        folderId: f.id,
        label: f.label,
        count: f.images!.length
      })),
      unmatchedCount
    },
    warnings
  }
}

// ==================== 主函数 ====================

/**
 * 生成批量图片对
 *
 * @param folders 文件夹路径列表
 * @param matchMode 匹配模式
 * @returns 批量匹配结果
 */
export function generateImageBatches(
  folders: FolderPathItem[],
  matchMode: ImageMatchMode = 'byOrder'
): BatchMatchResult {
  switch (matchMode) {
    case 'byName':
      return matchByName(folders)
    case 'hybrid':
      return matchHybrid(folders)
    case 'byOrder':
    default:
      return matchByOrder(folders)
  }
}

/**
 * 获取匹配模式的描述
 */
export function getMatchModeDescription(mode: ImageMatchMode): string {
  switch (mode) {
    case 'byOrder':
      return '按顺序匹配：不同文件夹的第 N 张图片组成一组'
    case 'byName':
      return '按名称匹配：文件名（不含扩展名）相同的图片组成一组'
    case 'hybrid':
      return '混合模式：优先按名称匹配，无匹配时按顺序补位'
    default:
      return '未知模式'
  }
}

/**
 * 预览批量匹配结果
 * 返回人类可读的摘要
 */
export function previewBatchResult(result: BatchMatchResult): string {
  const { batches, stats, warnings } = result
  const lines: string[] = []

  lines.push(`匹配模式: ${getMatchModeDescription(stats.matchMode)}`)
  lines.push(`生成批次: ${stats.totalBatches} 个`)
  lines.push(`文件夹统计:`)
  stats.folderCounts.forEach((fc) => {
    lines.push(`  - ${fc.label}: ${fc.count} 张图片`)
  })

  if (stats.unmatchedCount > 0) {
    lines.push(`未匹配图片: ${stats.unmatchedCount} 张`)
  }

  if (warnings.length > 0) {
    lines.push(`警告:`)
    warnings.forEach((w) => lines.push(`  - ${w}`))
  }

  if (batches.length > 0 && batches.length <= 5) {
    lines.push(`批次详情:`)
    batches.forEach((batch) => {
      const imageNames = batch.images.map((i) => i.image.name).join(' + ')
      lines.push(`  [${batch.matchKey}]: ${imageNames}`)
    })
  } else if (batches.length > 5) {
    lines.push(`批次示例 (前3个):`)
    batches.slice(0, 3).forEach((batch) => {
      const imageNames = batch.images.map((i) => i.image.name).join(' + ')
      lines.push(`  [${batch.matchKey}]: ${imageNames}`)
    })
    lines.push(`  ...还有 ${batches.length - 3} 个批次`)
  }

  return lines.join('\n')
}
