/**
 * Sticker IPC Handlers
 * 贴纸/表情包相关的 IPC 处理器
 *
 * 支持本地贴纸包管理，类似 VCPChat 的表情包系统
 */

import fs from 'node:fs'
import path from 'node:path'
import { ipcMain, app } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import { loggerService } from '@logger'

const logger = loggerService.withContext('StickerIpc')

// Sticker types
export interface Sticker {
  id: string
  url: string // file:// URL
  filename: string
  packName: string
}

export interface StickerPack {
  name: string
  path: string
  count: number
}

// Get stickers directory path
function getStickersDir(): string {
  return path.join(app.getPath('userData'), 'stickers')
}

// Ensure stickers directory exists
async function ensureStickersDir(): Promise<void> {
  const dir = getStickersDir()
  try {
    await fs.promises.mkdir(dir, { recursive: true })
  } catch (error) {
    logger.error('Failed to create stickers directory', { error })
  }
}

// Check if file is an image
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)
}

// Get all stickers from all packs
async function getAllStickers(): Promise<Sticker[]> {
  await ensureStickersDir()
  const stickersDir = getStickersDir()
  const stickers: Sticker[] = []

  try {
    const entries = await fs.promises.readdir(stickersDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packPath = path.join(stickersDir, entry.name)
        const files = await fs.promises.readdir(packPath)

        for (const file of files) {
          if (isImageFile(file)) {
            const filePath = path.join(packPath, file)
            stickers.push({
              id: `${entry.name}/${file}`,
              url: `file://${filePath.replace(/\\/g, '/')}`,
              filename: file,
              packName: entry.name
            })
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to read stickers', { error })
  }

  return stickers
}

// Get all sticker packs
async function getStickerPacks(): Promise<StickerPack[]> {
  await ensureStickersDir()
  const stickersDir = getStickersDir()
  const packs: StickerPack[] = []

  try {
    const entries = await fs.promises.readdir(stickersDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packPath = path.join(stickersDir, entry.name)
        const files = await fs.promises.readdir(packPath)
        const imageCount = files.filter(isImageFile).length

        if (imageCount > 0) {
          packs.push({
            name: entry.name,
            path: packPath,
            count: imageCount
          })
        }
      }
    }
  } catch (error) {
    logger.error('Failed to read sticker packs', { error })
  }

  return packs
}

// Import a sticker pack from a folder
async function importStickerPack(sourcePath: string, packName?: string): Promise<{ success: boolean; error?: string }> {
  await ensureStickersDir()
  const stickersDir = getStickersDir()

  try {
    const stat = await fs.promises.stat(sourcePath)
    if (!stat.isDirectory()) {
      return { success: false, error: 'Source is not a directory' }
    }

    const name = packName || path.basename(sourcePath)
    const targetPath = path.join(stickersDir, name)

    // Check if pack already exists
    try {
      await fs.promises.access(targetPath)
      return { success: false, error: 'Pack already exists' }
    } catch {
      // Pack doesn't exist, proceed
    }

    // Create target directory
    await fs.promises.mkdir(targetPath, { recursive: true })

    // Copy image files
    const files = await fs.promises.readdir(sourcePath)
    let copiedCount = 0

    for (const file of files) {
      if (isImageFile(file)) {
        const srcFile = path.join(sourcePath, file)
        const destFile = path.join(targetPath, file)
        await fs.promises.copyFile(srcFile, destFile)
        copiedCount++
      }
    }

    if (copiedCount === 0) {
      await fs.promises.rmdir(targetPath)
      return { success: false, error: 'No image files found in source folder' }
    }

    logger.info('Imported sticker pack', { name, count: copiedCount })
    return { success: true }
  } catch (error) {
    logger.error('Failed to import sticker pack', { error })
    return { success: false, error: String(error) }
  }
}

// Delete a sticker pack
async function deleteStickerPack(packName: string): Promise<{ success: boolean; error?: string }> {
  const stickersDir = getStickersDir()
  const packPath = path.join(stickersDir, packName)

  try {
    await fs.promises.rm(packPath, { recursive: true, force: true })
    logger.info('Deleted sticker pack', { name: packName })
    return { success: true }
  } catch (error) {
    logger.error('Failed to delete sticker pack', { error })
    return { success: false, error: String(error) }
  }
}

/**
 * Get sticker list formatted for AI prompt injection
 * Returns a string like: "包名1: file1.gif|file2.png\n包名2: file3.jpg|file4.gif"
 * AI can reference stickers using: ![表情](file://路径/包名/文件名)
 */
async function getStickerListForPrompt(): Promise<string> {
  await ensureStickersDir()
  const stickersDir = getStickersDir()
  const lines: string[] = []

  try {
    const entries = await fs.promises.readdir(stickersDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packPath = path.join(stickersDir, entry.name)
        const files = await fs.promises.readdir(packPath)
        const imageFiles = files.filter(isImageFile)

        if (imageFiles.length > 0) {
          // Format: "包名: file1.gif|file2.png|file3.jpg"
          lines.push(`${entry.name}: ${imageFiles.join('|')}`)
        }
      }
    }
  } catch (error) {
    logger.error('Failed to generate sticker list for prompt', { error })
  }

  return lines.join('\n')
}

/**
 * Get stickers directory path (for AI to construct file:// URLs)
 */
function getStickersDirPath(): string {
  return getStickersDir().replace(/\\/g, '/')
}

/**
 * Get files for a specific sticker pack
 * Returns an array of image filenames for the specified pack
 */
async function getStickerPackFiles(packName: string): Promise<string[]> {
  await ensureStickersDir()
  const stickersDir = getStickersDir()
  const packPath = path.join(stickersDir, packName)

  try {
    const stat = await fs.promises.stat(packPath)
    if (!stat.isDirectory()) {
      return []
    }

    const files = await fs.promises.readdir(packPath)
    return files.filter(isImageFile)
  } catch (error) {
    logger.error('Failed to get sticker pack files', { packName, error })
    return []
  }
}

export function registerStickerIpcHandlers() {
  ipcMain.handle(IpcChannel.Sticker_GetAll, async () => {
    return getAllStickers()
  })

  ipcMain.handle(IpcChannel.Sticker_GetPacks, async () => {
    return getStickerPacks()
  })

  ipcMain.handle(IpcChannel.Sticker_ImportPack, async (_, sourcePath: string, packName?: string) => {
    return importStickerPack(sourcePath, packName)
  })

  ipcMain.handle(IpcChannel.Sticker_DeletePack, async (_, packName: string) => {
    return deleteStickerPack(packName)
  })

  ipcMain.handle(IpcChannel.Sticker_GetListForPrompt, async () => {
    return getStickerListForPrompt()
  })

  ipcMain.handle(IpcChannel.Sticker_GetDirPath, async () => {
    return getStickersDirPath()
  })

  ipcMain.handle(IpcChannel.Sticker_GetPackFiles, async (_, packName: string) => {
    return getStickerPackFiles(packName)
  })

  logger.info('Sticker IPC handlers registered')
}
