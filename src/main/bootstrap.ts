import { occupiedDirs } from '@shared/config/constant'
import fs from 'fs'
import path from 'path'

import { initAppDataDir } from './utils/init'

// 延迟导入 electron 以确保在正确的运行时环境中
// rolldown-vite 7.3.0 对 external 模块处理有变化，顶层导入可能为 undefined
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // 非 electron 环境（如打包工具分析阶段）
}

electronApp?.isPackaged && initAppDataDir()

// 在主进程中复制 appData 中某些一直被占用的文件
// 在renderer进程还没有启动时，主进程可以复制这些文件到新的appData中
function copyOccupiedDirsInMainProcess() {
  if (!electronApp) return

  const newAppDataPath = process.argv
    .slice(1)
    .find((arg) => arg.startsWith('--new-data-path='))
    ?.split('--new-data-path=')[1]
  if (!newAppDataPath) {
    return
  }

  if (process.platform === 'win32') {
    const appDataPath = electronApp.getPath('userData')
    occupiedDirs.forEach((dir) => {
      const dirPath = path.join(appDataPath, dir)
      const newDirPath = path.join(newAppDataPath, dir)
      if (fs.existsSync(dirPath)) {
        fs.cpSync(dirPath, newDirPath, { recursive: true })
      }
    })
  }
}

copyOccupiedDirsInMainProcess()
