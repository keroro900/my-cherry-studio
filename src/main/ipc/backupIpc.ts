/**
 * Backup IPC Handlers
 * 备份相关的 IPC 处理器
 *
 * 包含: WebDAV、本地备份、S3、局域网传输等备份功能
 */

import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'
import { loggerService } from '@logger'
import BackupManager from '../services/BackupManager'

const logger = loggerService.withContext('BackupIpc')

export function registerBackupIpcHandlers() {
  const backupManager = new BackupManager()

  // Local backup
  ipcMain.handle(IpcChannel.Backup_Backup, backupManager.backup.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_Restore, backupManager.restore.bind(backupManager))

  // WebDAV backup
  ipcMain.handle(IpcChannel.Backup_BackupToWebdav, backupManager.backupToWebdav.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_RestoreFromWebdav, backupManager.restoreFromWebdav.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_ListWebdavFiles, backupManager.listWebdavFiles.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_CheckConnection, backupManager.checkConnection.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_CreateDirectory, backupManager.createDirectory.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_DeleteWebdavFile, backupManager.deleteWebdavFile.bind(backupManager))

  // Local directory backup
  ipcMain.handle(IpcChannel.Backup_BackupToLocalDir, backupManager.backupToLocalDir.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_RestoreFromLocalBackup, backupManager.restoreFromLocalBackup.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_ListLocalBackupFiles, backupManager.listLocalBackupFiles.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_DeleteLocalBackupFile, backupManager.deleteLocalBackupFile.bind(backupManager))

  // S3 backup
  ipcMain.handle(IpcChannel.Backup_BackupToS3, backupManager.backupToS3.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_RestoreFromS3, backupManager.restoreFromS3.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_ListS3Files, backupManager.listS3Files.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_DeleteS3File, backupManager.deleteS3File.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_CheckS3Connection, backupManager.checkS3Connection.bind(backupManager))

  // LAN transfer backup
  ipcMain.handle(IpcChannel.Backup_CreateLanTransferBackup, backupManager.createLanTransferBackup.bind(backupManager))
  ipcMain.handle(IpcChannel.Backup_DeleteTempBackup, backupManager.deleteTempBackup.bind(backupManager))

  logger.info('Backup IPC handlers registered successfully')
}
