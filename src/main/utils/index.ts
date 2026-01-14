import fs from 'node:fs'
import fsAsync from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

export function getResourcePath() {
  if (!electronApp) {
    return path.join(process.cwd(), 'resources')
  }
  return path.join(electronApp.getAppPath(), 'resources')
}

export function getDataPath() {
  let dataPath: string
  if (electronApp) {
    dataPath = path.join(electronApp.getPath('userData'), 'Data')
  } else {
    // Fallback for pre-electron initialization
    dataPath = path.join(os.tmpdir(), 'cherry-studio-data')
  }
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return dataPath
}

export function getInstanceName(baseURL: string) {
  try {
    return new URL(baseURL).host.split('.')[0]
  } catch (error) {
    return ''
  }
}

export function debounce(func: (...args: any[]) => void, wait: number, immediate: boolean = false) {
  let timeout: NodeJS.Timeout | null = null
  return function (...args: any[]) {
    if (timeout) clearTimeout(timeout)
    if (immediate) {
      func(...args)
    } else {
      timeout = setTimeout(() => func(...args), wait)
    }
  }
}

// NOTE: It's an unused function. localStorage should not be accessed in main process.
// export function dumpPersistState() {
//   const persistState = JSON.parse(localStorage.getItem('persist:cherry-studio') || '{}')
//   for (const key in persistState) {
//     persistState[key] = JSON.parse(persistState[key])
//   }
//   return JSON.stringify(persistState)
// }

export const runAsyncFunction = async (fn: () => void) => {
  await fn()
}

export function makeSureDirExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export async function calculateDirectorySize(directoryPath: string): Promise<number> {
  let totalSize = 0
  const items = await fsAsync.readdir(directoryPath)

  for (const item of items) {
    const itemPath = path.join(directoryPath, item)
    const stats = await fsAsync.stat(itemPath)

    if (stats.isFile()) {
      totalSize += stats.size
    } else if (stats.isDirectory()) {
      totalSize += await calculateDirectorySize(itemPath)
    }
  }
  return totalSize
}

export const removeEnvProxy = (env: Record<string, string>) => {
  delete env.HTTPS_PROXY
  delete env.HTTP_PROXY
  delete env.grpc_proxy
  delete env.http_proxy
  delete env.https_proxy
}

// 时间表达式解析器
export {
  TimeExpressionParser,
  getTimeExpressionParser,
  parseTimeExpressions,
  hasTimeExpression,
  chineseToNumber,
  type TimeRange,
  type SupportedLocale
} from './TimeExpressionParser'
