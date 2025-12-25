/**
 * 自动导出工具
 *
 * 功能特性:
 * 1. 检测未连接的输出端口
 * 2. 自动保存图片/视频/文本到指定目录
 * 3. 支持自定义命名规则
 * 4. 支持按节点类型配置导出行为
 */

import { loggerService } from '@logger'

import type { WorkflowEdge, WorkflowNode, WorkflowNodeData } from '../types'
import { getDefaultExportPath, joinPath } from './pathUtils'

const logger = loggerService.withContext('AutoExport')

// ==================== 类型定义 ====================

/**
 * 导出配置
 */
export interface AutoExportConfig {
  /** 是否启用自动导出 */
  enabled: boolean
  /** 默认导出目录 */
  defaultExportPath: string
  /** 按节点类型的导出配置 */
  nodeTypeConfigs?: Record<
    string,
    {
      enabled: boolean
      exportPath?: string
      filenamePattern?: string
    }
  >
  /** 文件名模板 (支持变量: {nodeId}, {nodeLabel}, {timestamp}, {index}, {outputHandle}) */
  filenamePattern: string
  /** 是否创建子目录 (按工作流名称) */
  createSubFolder: boolean
  /** 是否覆盖已存在的文件 */
  overwrite: boolean
}

/**
 * 导出结果
 */
export interface AutoExportResult {
  success: boolean
  exportedFiles: {
    nodeId: string
    handleId: string
    filePath: string
    fileType: 'image' | 'video' | 'text' | 'json'
  }[]
  errors: string[]
}

/**
 * 未连接的输出端口信息
 */
export interface UnconnectedOutput {
  nodeId: string
  nodeLabel: string
  nodeType: string
  handleId: string
  handleLabel: string
  dataType: string
  value: any
}

// ==================== 辅助函数 ====================

/**
 * Base64 字符串转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * 确保目录存在
 * 使用 Cherry Studio 的 mkdir API
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await window.api?.file?.mkdir?.(dirPath)
  } catch (error) {
    // 目录可能已存在，忽略错误
    logger.debug('mkdir error (may already exist):', error)
  }
}

// ==================== 默认配置 ====================

export const DEFAULT_AUTO_EXPORT_CONFIG: AutoExportConfig = {
  enabled: true,
  defaultExportPath: '',
  filenamePattern: '{nodeLabel}_{outputHandle}_{timestamp}',
  createSubFolder: true,
  overwrite: false,
  nodeTypeConfigs: {
    gemini_generate: { enabled: true },
    gemini_edit: { enabled: true },
    gemini_ecom: { enabled: true },
    gemini_pattern: { enabled: true },
    gemini_generate_model: { enabled: true },
    gemini_model_from_clothes: { enabled: true },
    kling_image2video: { enabled: true }
  }
}

// ==================== 工具函数 ====================

/**
 * 检测未连接的输出端口
 */
export function findUnconnectedOutputs(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeOutputs: Map<string, Record<string, any>>
): UnconnectedOutput[] {
  const unconnected: UnconnectedOutput[] = []

  // 构建已连接的输出端口集合
  const connectedOutputs = new Set<string>()
  edges.forEach((edge) => {
    connectedOutputs.add(`${edge.source}::${edge.sourceHandle}`)
  })

  // 遍历所有节点
  nodes.forEach((node) => {
    const nodeData = node.data as WorkflowNodeData
    const outputs = nodeOutputs.get(node.id)

    if (!outputs) return

    // 检查每个输出端口
    nodeData.outputs.forEach((output) => {
      const key = `${node.id}::${output.id}`
      const value = outputs[output.id]

      // 如果端口未连接且有值
      if (!connectedOutputs.has(key) && value !== undefined && value !== null) {
        unconnected.push({
          nodeId: node.id,
          nodeLabel: nodeData.label || node.id,
          nodeType: nodeData.nodeType,
          handleId: output.id,
          handleLabel: output.label,
          dataType: output.dataType,
          value
        })
      }
    })
  })

  return unconnected
}

/**
 * 生成导出文件名
 */
export function generateFilename(
  pattern: string,
  nodeId: string,
  nodeLabel: string,
  outputHandle: string,
  index: number = 0
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return pattern
    .replace('{nodeId}', nodeId.slice(0, 8))
    .replace('{nodeLabel}', sanitizeFilename(nodeLabel))
    .replace('{timestamp}', timestamp)
    .replace('{index}', String(index).padStart(3, '0'))
    .replace('{outputHandle}', sanitizeFilename(outputHandle))
}

/**
 * 清理文件名 (移除非法字符)
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50)
}

/**
 * 判断是否为图片 URL 或 Base64
 * 支持：data URL, http/https URL, file://, Windows路径(C:/ 或 C:\), Unix路径
 */
export function isImageData(value: any): boolean {
  if (typeof value !== 'string') return false
  return (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    /^[A-Za-z]:[/\\]/.test(value) || // Windows路径: C:\ 或 C:/
    (value.startsWith('/') && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(value)) || // Unix绝对路径
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(value)
  )
}

/**
 * 判断是否为视频 URL
 * 支持：data URL, http/https URL, file://, Windows路径(C:/ 或 C:\), Unix路径
 */
export function isVideoData(value: any): boolean {
  if (typeof value !== 'string') return false
  return (
    value.startsWith('data:video/') ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(value) ||
    (value.startsWith('http') && value.includes('video')) ||
    value.startsWith('file://') ||
    /^[A-Za-z]:[/\\].*\.(mp4|webm|mov|avi|mkv)$/i.test(value) || // Windows路径: C:\ 或 C:/
    (value.startsWith('/') && /\.(mp4|webm|mov|avi|mkv)$/i.test(value)) // Unix绝对路径
  )
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(value: string, dataType: string): string {
  // 从 Base64 中提取类型
  if (value.startsWith('data:image/')) {
    const match = value.match(/data:image\/(\w+);/)
    if (match) return match[1] === 'jpeg' ? 'jpg' : match[1]
  }
  if (value.startsWith('data:video/')) {
    const match = value.match(/data:video\/(\w+);/)
    if (match) return match[1]
  }

  // 从 URL 中提取扩展名
  const urlMatch = value.match(/\.(\w+)(?:\?|$)/)
  if (urlMatch) return urlMatch[1]

  // 根据数据类型返回默认扩展名
  switch (dataType) {
    case 'image':
      return 'png'
    case 'video':
      return 'mp4'
    case 'text':
      return 'txt'
    case 'json':
      return 'json'
    default:
      return 'bin'
  }
}

// ==================== 导出执行器 ====================

/**
 * 执行自动导出
 */
export async function executeAutoExport(
  unconnectedOutputs: UnconnectedOutput[],
  config: AutoExportConfig,
  workflowName?: string
): Promise<AutoExportResult> {
  const result: AutoExportResult = {
    success: true,
    exportedFiles: [],
    errors: []
  }

  if (!config.enabled || unconnectedOutputs.length === 0) {
    return result
  }

  // 确定导出目录
  let exportPath = config.defaultExportPath

  if (!exportPath) {
    // 使用统一的路径工具获取默认导出路径
    exportPath = await getDefaultExportPath()
    logger.debug('Got default export path', { exportPath })
  }

  if (!exportPath) {
    result.errors.push('未配置导出目录且无法获取默认路径')
    result.success = false
    return result
  }

  // 创建子目录
  if (config.createSubFolder && workflowName) {
    exportPath = joinPath(exportPath, sanitizeFilename(workflowName))
  }

  // 确保目录存在
  try {
    await ensureDirectory(exportPath)
  } catch (error) {
    logger.error('Failed to create export directory', { exportPath, error })
    result.errors.push(`创建导出目录失败: ${exportPath}`)
    result.success = false
    return result
  }

  // 导出每个未连接的输出
  for (let i = 0; i < unconnectedOutputs.length; i++) {
    const output = unconnectedOutputs[i]

    // 检查节点类型是否启用导出
    const nodeConfig = config.nodeTypeConfigs?.[output.nodeType]
    if (nodeConfig && !nodeConfig.enabled) {
      continue
    }

    try {
      const filename = generateFilename(
        nodeConfig?.filenamePattern || config.filenamePattern,
        output.nodeId,
        output.nodeLabel,
        output.handleId,
        i
      )

      let fileType: 'image' | 'video' | 'text' | 'json' = 'text'
      let filePath = ''

      if (isImageData(output.value)) {
        fileType = 'image'
        const ext = getFileExtension(output.value, 'image')
        filePath = joinPath(exportPath, `${filename}.${ext}`)
        await saveImage(output.value, filePath)
      } else if (isVideoData(output.value)) {
        fileType = 'video'
        const ext = getFileExtension(output.value, 'video')
        filePath = joinPath(exportPath, `${filename}.${ext}`)
        await saveVideo(output.value, filePath)
      } else if (typeof output.value === 'object') {
        fileType = 'json'
        filePath = joinPath(exportPath, `${filename}.json`)
        await saveJson(output.value, filePath)
      } else {
        fileType = 'text'
        filePath = joinPath(exportPath, `${filename}.txt`)
        await saveText(String(output.value), filePath)
      }

      result.exportedFiles.push({
        nodeId: output.nodeId,
        handleId: output.handleId,
        filePath,
        fileType
      })

      logger.info('Auto-exported file', { filePath, fileType, nodeId: output.nodeId })
    } catch (error) {
      const errorMsg = `导出失败 [${output.nodeLabel}/${output.handleLabel}]: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      logger.error('Auto-export failed', { output, error })
    }
  }

  if (result.errors.length > 0) {
    result.success = result.exportedFiles.length > 0
  }

  return result
}

// ==================== 保存函数 ====================

/**
 * 判断是否为本地文件路径
 * 支持：file://, C:\, C:/, /unix/path
 */
function isLocalFilePath(path: string): boolean {
  return (
    path.startsWith('file://') ||
    /^[A-Za-z]:[/\\]/.test(path) || // Windows: C:\ 或 C:/
    path.startsWith('/') // Unix: /path
  )
}

/**
 * 保存图片文件
 * 使用 Cherry Studio 的 file.write API (支持 Uint8Array)
 */
async function saveImage(data: string, filePath: string): Promise<void> {
  // 检查 API 可用性
  if (!window.api?.file?.write) {
    throw new Error('File write API not available')
  }

  if (data.startsWith('data:image/')) {
    // Base64 图片 - 转换为 Uint8Array 后写入
    const base64Data = data.split(',')[1]
    const uint8Array = base64ToUint8Array(base64Data)
    await window.api.file.write(filePath, uint8Array)
  } else if (data.startsWith('http://') || data.startsWith('https://')) {
    // URL 图片 - 下载后保存
    const response = await fetch(data)
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    await window.api.file.write(filePath, uint8Array)
  } else if (isLocalFilePath(data)) {
    // 本地文件 - 读取后复制到目标路径
    // Cherry Studio 的 copy API 需要 fileId，不是路径
    // 所以我们读取源文件内容后写入目标
    const sourcePath = data.replace('file://', '')
    try {
      // 尝试使用 fs.read 读取文件
      const content = await window.api?.fs?.read?.(sourcePath)
      if (content) {
        // content 可能是 Buffer 或 string
        if (typeof content === 'string') {
          // 如果是 base64 字符串
          const uint8Array = base64ToUint8Array(content)
          await window.api.file.write(filePath, uint8Array)
        } else {
          await window.api.file.write(filePath, content)
        }
      } else {
        throw new Error('无法读取源文件')
      }
    } catch (error) {
      logger.error('Failed to copy local file', { sourcePath, filePath, error })
      throw new Error(`复制本地文件失败: ${sourcePath}`)
    }
  } else {
    throw new Error('不支持的图片格式')
  }
}

/**
 * 保存视频文件
 * 使用 Cherry Studio 的 file.write API (支持 Uint8Array)
 */
async function saveVideo(data: string, filePath: string): Promise<void> {
  // 检查 API 可用性
  if (!window.api?.file?.write) {
    throw new Error('File write API not available')
  }

  if (data.startsWith('data:video/')) {
    // Base64 视频 - 转换为 Uint8Array 后写入
    const base64Data = data.split(',')[1]
    const uint8Array = base64ToUint8Array(base64Data)
    await window.api.file.write(filePath, uint8Array)
  } else if (data.startsWith('http://') || data.startsWith('https://')) {
    // URL 视频 - 下载后保存
    const response = await fetch(data)
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    await window.api.file.write(filePath, uint8Array)
  } else if (isLocalFilePath(data)) {
    // 本地文件 - 读取后复制到目标路径
    const sourcePath = data.replace('file://', '')
    try {
      const content = await window.api?.fs?.read?.(sourcePath)
      if (content) {
        if (typeof content === 'string') {
          const uint8Array = base64ToUint8Array(content)
          await window.api.file.write(filePath, uint8Array)
        } else {
          await window.api.file.write(filePath, content)
        }
      } else {
        throw new Error('无法读取源文件')
      }
    } catch (error) {
      logger.error('Failed to copy local video file', { sourcePath, filePath, error })
      throw new Error(`复制本地视频文件失败: ${sourcePath}`)
    }
  } else {
    throw new Error('不支持的视频格式')
  }
}

/**
 * 保存文本文件
 */
async function saveText(data: string, filePath: string): Promise<void> {
  if (!window.api?.file?.write) {
    throw new Error('File write API not available')
  }
  await window.api.file.write(filePath, data)
}

/**
 * 保存 JSON 文件
 */
async function saveJson(data: any, filePath: string): Promise<void> {
  if (!window.api?.file?.write) {
    throw new Error('File write API not available')
  }
  await window.api.file.write(filePath, JSON.stringify(data, null, 2))
}

// ==================== 批次分文件夹导出 ====================

/**
 * 输出节点配置
 */
export interface OutputNodeConfig {
  outputType: 'display' | 'file' | 'download'
  outputDirectory?: string
  fileNamePattern?: string
  batchFolderMode?: boolean
  batchFolderPattern?: string
}

/**
 * 批次导出配置
 */
export interface BatchExportConfig {
  outputDirectory: string
  fileNamePattern: string
  batchFolderMode: boolean
  batchFolderPattern: string
  batchIndex: number
}

/**
 * 生成批次文件夹名称
 */
export function generateBatchFolderName(pattern: string, batchIndex: number): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')

  return pattern.replace('{index}', String(batchIndex).padStart(3, '0')).replace('{date}', date).replace('{time}', time)
}

/**
 * 生成文件名
 */
export function generateOutputFilename(pattern: string, index: number, dataType: string): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')

  let filename = pattern
    .replace('{date}', date)
    .replace('{time}', time)
    .replace('{index}', String(index).padStart(3, '0'))
    .replace('{type}', dataType)

  // 如果文件名模板为空，生成默认名称
  if (!filename || filename === pattern) {
    filename = `output_${date}_${time}_${String(index).padStart(3, '0')}`
  }

  return sanitizeFilename(filename)
}

/**
 * 执行批次文件导出
 * 支持批次分文件夹功能
 */
export async function executeBatchExport(
  data: any,
  config: BatchExportConfig,
  itemIndex: number = 0
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    let exportPath = config.outputDirectory

    // 如果启用批次分文件夹模式，添加批次子目录
    if (config.batchFolderMode && config.batchIndex > 0) {
      const batchFolderName = generateBatchFolderName(config.batchFolderPattern || 'batch_{index}', config.batchIndex)
      exportPath = joinPath(exportPath, batchFolderName)
    }

    // 确保目录存在
    await ensureDirectory(exportPath)

    // 判断数据类型并保存
    let fileType: 'image' | 'video' | 'text' | 'json' = 'text'
    let ext = 'txt'

    if (isImageData(data)) {
      fileType = 'image'
      ext = getFileExtension(data, 'image')
    } else if (isVideoData(data)) {
      fileType = 'video'
      ext = getFileExtension(data, 'video')
    } else if (typeof data === 'object') {
      fileType = 'json'
      ext = 'json'
    }

    const filename = generateOutputFilename(config.fileNamePattern || 'output_{date}_{index}', itemIndex, fileType)
    const filePath = joinPath(exportPath, `${filename}.${ext}`)

    // 保存文件
    if (fileType === 'image') {
      await saveImage(data, filePath)
    } else if (fileType === 'video') {
      await saveVideo(data, filePath)
    } else if (fileType === 'json') {
      await saveJson(data, filePath)
    } else {
      await saveText(String(data), filePath)
    }

    logger.info('Batch export completed', { filePath, fileType })

    return { success: true, filePath }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Batch export failed', { error })
    return { success: false, error: errorMsg }
  }
}

/**
 * 批量导出多个数据项
 * 用于输出节点处理批次数据
 */
export async function executeBatchExportMultiple(
  items: any[],
  config: BatchExportConfig
): Promise<{
  success: boolean
  exportedFiles: string[]
  errors: string[]
}> {
  const result = {
    success: true,
    exportedFiles: [] as string[],
    errors: [] as string[]
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const exportResult = await executeBatchExport(item, config, i + 1)

    if (exportResult.success && exportResult.filePath) {
      result.exportedFiles.push(exportResult.filePath)
    } else if (exportResult.error) {
      result.errors.push(`项目 ${i + 1}: ${exportResult.error}`)
    }
  }

  if (result.errors.length > 0) {
    result.success = result.exportedFiles.length > 0
  }

  return result
}
