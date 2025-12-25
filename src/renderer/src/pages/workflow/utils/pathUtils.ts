/**
 * 跨平台路径工具函数
 */

/**
 * 检测当前平台是否为 Windows
 */
export function isWindows(): boolean {
  return navigator.platform?.toLowerCase().includes('win') || navigator.userAgent?.toLowerCase().includes('win')
}

/**
 * 获取平台对应的路径分隔符
 */
export function getPathSeparator(): string {
  return isWindows() ? '\\' : '/'
}

/**
 * 跨平台路径拼接
 * 自动使用正确的分隔符，处理混合分隔符输入
 */
export function joinPath(...segments: string[]): string {
  const sep = getPathSeparator()
  return segments
    .map((s) => s.replace(/[/\\]+$/, '')) // 移除尾部分隔符
    .filter(Boolean)
    .join(sep)
}

/**
 * 标准化路径分隔符
 */
export function normalizePath(path: string): string {
  if (isWindows()) {
    return path.replace(/\//g, '\\')
  }
  return path.replace(/\\/g, '/')
}

/**
 * 获取默认导出路径
 * 优先使用 Electron API，失败时使用平台默认路径
 */
export async function getDefaultExportPath(): Promise<string> {
  try {
    // 尝试使用 Electron API 获取 downloads 目录
    const downloadsPath = await window.api?.system?.getPath?.('downloads')
    if (downloadsPath) {
      return joinPath(downloadsPath, 'CherryStudio', 'workflow-exports')
    }
  } catch {
    // 忽略错误，使用 fallback
  }

  // 平台特定的 fallback 路径
  if (isWindows()) {
    return 'C:\\Users\\Public\\Pictures\\CherryStudio\\workflow-exports'
  }
  return '/tmp/CherryStudio/workflow-exports'
}

/**
 * 获取带时间戳的导出目录
 */
export function getTimestampedExportPath(basePath: string, prefix = ''): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const folderName = prefix ? `${prefix}-${timestamp}` : timestamp
  return joinPath(basePath, folderName)
}
