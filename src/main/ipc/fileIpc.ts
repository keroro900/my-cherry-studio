/**
 * File IPC Handlers
 * 文件操作相关的 IPC 处理器
 *
 * 包含: 文件读写、上传下载、目录操作、文件监控等
 */

import fs from 'node:fs'
import { ipcMain, shell } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import type { FileMetadata, Provider } from '@types'
import { loggerService } from '@logger'
import { fileStorage as fileManager } from '../services/FileStorage'
import FileService from '../services/FileSystemService'
import { FileServiceManager } from '../services/remotefile/FileServiceManager'

const logger = loggerService.withContext('FileIpc')

export function registerFileIpcHandlers() {
  // File operations
  ipcMain.handle(IpcChannel.File_Open, fileManager.open.bind(fileManager))
  ipcMain.handle(IpcChannel.File_OpenPath, fileManager.openPath.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Save, fileManager.save.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Select, fileManager.selectFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Upload, fileManager.uploadFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Clear, fileManager.clear.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Read, fileManager.readFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_ReadExternal, fileManager.readExternalFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Delete, fileManager.deleteFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_DeleteDir, fileManager.deleteDir.bind(fileManager))
  ipcMain.handle(IpcChannel.File_DeleteExternalFile, fileManager.deleteExternalFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_DeleteExternalDir, fileManager.deleteExternalDir.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Move, fileManager.moveFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_MoveDir, fileManager.moveDir.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Rename, fileManager.renameFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_RenameDir, fileManager.renameDir.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Get, fileManager.getFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_SelectFolder, fileManager.selectFolder.bind(fileManager))
  ipcMain.handle(IpcChannel.File_CreateTempFile, fileManager.createTempFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Mkdir, fileManager.mkdir.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Write, fileManager.writeFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_WriteWithId, fileManager.writeFileWithId.bind(fileManager))
  ipcMain.handle(IpcChannel.File_SaveImage, fileManager.saveImage.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Base64Image, fileManager.base64Image.bind(fileManager))
  ipcMain.handle(IpcChannel.File_SaveBase64Image, fileManager.saveBase64Image.bind(fileManager))
  ipcMain.handle(IpcChannel.File_SavePastedImage, fileManager.savePastedImage.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Base64File, fileManager.base64File.bind(fileManager))
  ipcMain.handle(IpcChannel.File_GetPdfInfo, fileManager.pdfPageCount.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Download, fileManager.downloadFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_Copy, fileManager.copyFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_BinaryImage, fileManager.binaryImage.bind(fileManager))
  ipcMain.handle(IpcChannel.File_OpenWithRelativePath, fileManager.openFileWithRelativePath.bind(fileManager))
  ipcMain.handle(IpcChannel.File_IsTextFile, fileManager.isTextFile.bind(fileManager))
  ipcMain.handle(IpcChannel.File_ListDirectory, fileManager.listDirectory.bind(fileManager))
  ipcMain.handle(IpcChannel.File_GetDirectoryStructure, fileManager.getDirectoryStructure.bind(fileManager))
  ipcMain.handle(
    IpcChannel.File_GetDirectoryStructureGeneric,
    fileManager.getDirectoryStructureGeneric.bind(fileManager)
  )
  ipcMain.handle(IpcChannel.File_CheckFileName, fileManager.fileNameGuard.bind(fileManager))
  ipcMain.handle(IpcChannel.File_ValidateNotesDirectory, fileManager.validateNotesDirectory.bind(fileManager))
  ipcMain.handle(IpcChannel.File_StartWatcher, fileManager.startFileWatcher.bind(fileManager))
  ipcMain.handle(IpcChannel.File_StopWatcher, fileManager.stopFileWatcher.bind(fileManager))
  ipcMain.handle(IpcChannel.File_PauseWatcher, fileManager.pauseFileWatcher.bind(fileManager))
  ipcMain.handle(IpcChannel.File_ResumeWatcher, fileManager.resumeFileWatcher.bind(fileManager))
  ipcMain.handle(IpcChannel.File_BatchUploadMarkdown, fileManager.batchUploadMarkdownFiles.bind(fileManager))
  ipcMain.handle(IpcChannel.File_ShowInFolder, fileManager.showInFolder.bind(fileManager))

  // Remote file service
  ipcMain.handle(IpcChannel.FileService_Upload, async (_, provider: Provider, file: FileMetadata) => {
    const service = FileServiceManager.getInstance().getService(provider)
    return await service.uploadFile(file)
  })

  ipcMain.handle(IpcChannel.FileService_List, async (_, provider: Provider) => {
    const service = FileServiceManager.getInstance().getService(provider)
    return await service.listFiles()
  })

  ipcMain.handle(IpcChannel.FileService_Delete, async (_, provider: Provider, fileId: string) => {
    const service = FileServiceManager.getInstance().getService(provider)
    return await service.deleteFile(fileId)
  })

  ipcMain.handle(IpcChannel.FileService_Retrieve, async (_, provider: Provider, fileId: string) => {
    const service = FileServiceManager.getInstance().getService(provider)
    return await service.retrieveFile(fileId)
  })

  // Low-level fs operations
  ipcMain.handle(IpcChannel.Fs_Read, FileService.readFile.bind(FileService))
  ipcMain.handle(IpcChannel.Fs_ReadText, FileService.readTextFileWithAutoEncoding.bind(FileService))
  ipcMain.handle(IpcChannel.Fs_ReadBase64, async (_, filePath: string) => {
    try {
      try {
        await fs.promises.access(filePath, fs.constants.R_OK)
      } catch {
        throw new Error(`File not found or not readable: ${filePath}`)
      }
      const buffer = await fs.promises.readFile(filePath)
      return buffer.toString('base64')
    } catch (error) {
      logger.error('Failed to read file as base64', { filePath, error })
      throw error
    }
  })

  // Open path
  ipcMain.handle(IpcChannel.Open_Path, async (_, path: string) => {
    await shell.openPath(path)
  })

  logger.info('File IPC handlers registered successfully')
}
