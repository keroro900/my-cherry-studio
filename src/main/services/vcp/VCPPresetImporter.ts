/**
 * VCPPresetImporter - VCP 预设导入服务
 *
 * 将 VCPToolBox 预设导入到 Cherry Studio 的 VCP 变量系统中。
 * 支持批量导入、冲突检测、增量更新。
 * 同时将 TVStxt 文件内容写入本地目录。
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

import {
  AGENT_PRESETS,
  ALL_VCP_PRESETS,
  PRESET_STATS,
  SAR_PRESETS,
  TAR_PRESETS,
  TVSTXT_FILE_CONTENTS,
  TVSTXT_VARIABLE_PRESETS,
  VAR_PRESETS
} from './VCPPresetData'
import { type PromptVariable, vcpVariableService } from './VCPVariableService'

const logger = loggerService.withContext('VCPPresetImporter')

/**
 * 预设变量类型（用于导入）
 */
type PresetVariable = Omit<PromptVariable, 'id' | 'createdAt' | 'updatedAt'> & {
  sarModelFilter?: string[]
}

/**
 * 导入选项
 */
export interface PresetImportOptions {
  /** 是否覆盖已存在的变量 */
  overwrite?: boolean
  /** 要导入的预设类型 */
  categories?: Array<'agents' | 'tvstxt' | 'tar' | 'var' | 'sar'>
}

/**
 * 导入结果
 */
export interface PresetImportResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: string[]
  details: Array<{
    name: string
    action: 'created' | 'updated' | 'skipped' | 'error'
    message?: string
  }>
}

/**
 * VCP 预设导入器
 */
class VCPPresetImporterImpl {
  private static instance: VCPPresetImporterImpl

  private constructor() {
    logger.info('VCPPresetImporter initialized')
  }

  static getInstance(): VCPPresetImporterImpl {
    if (!VCPPresetImporterImpl.instance) {
      VCPPresetImporterImpl.instance = new VCPPresetImporterImpl()
    }
    return VCPPresetImporterImpl.instance
  }

  /**
   * 获取预设统计信息
   */
  getStats(): typeof PRESET_STATS {
    return PRESET_STATS
  }

  /**
   * 获取所有预设
   */
  getAllPresets(): typeof ALL_VCP_PRESETS {
    return ALL_VCP_PRESETS
  }

  /**
   * 按类型获取预设
   */
  getPresetsByCategory(category: 'agents' | 'tvstxt' | 'tar' | 'var' | 'sar') {
    switch (category) {
      case 'agents':
        return AGENT_PRESETS
      case 'tvstxt':
        return TVSTXT_VARIABLE_PRESETS
      case 'tar':
        return TAR_PRESETS
      case 'var':
        return VAR_PRESETS
      case 'sar':
        return SAR_PRESETS
      default:
        return []
    }
  }

  /**
   * 检查预设是否已存在
   */
  async checkExisting(presetName: string): Promise<PromptVariable | undefined> {
    return vcpVariableService.getByName(presetName)
  }

  /**
   * 导入单个预设
   */
  async importPreset(
    preset: PresetVariable,
    overwrite: boolean = false
  ): Promise<{ action: 'created' | 'updated' | 'skipped'; message?: string }> {
    try {
      const existing = await this.checkExisting(preset.name)

      if (existing) {
        if (overwrite) {
          // 更新已存在的变量
          await vcpVariableService.update(existing.id, {
            value: preset.value,
            description: preset.description,
            category: preset.category,
            scope: preset.scope
          })
          logger.debug(`Preset updated: ${preset.name}`)
          return { action: 'updated' }
        } else {
          logger.debug(`Preset skipped (exists): ${preset.name}`)
          return { action: 'skipped', message: '变量已存在' }
        }
      }

      // 创建新变量
      await vcpVariableService.create({
        name: preset.name,
        value: preset.value,
        description: preset.description,
        category: preset.category,
        scope: preset.scope
      })
      logger.debug(`Preset created: ${preset.name}`)
      return { action: 'created' }
    } catch (error) {
      logger.error(`Failed to import preset: ${preset.name}`, error as Error)
      throw error
    }
  }

  /**
   * 批量导入预设
   */
  async importAll(options: PresetImportOptions = {}): Promise<PresetImportResult> {
    const { overwrite = false, categories } = options

    const result: PresetImportResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      details: []
    }

    // 确定要导入的预设
    let presetsToImport: PresetVariable[] = []

    if (categories && categories.length > 0) {
      for (const cat of categories) {
        presetsToImport = presetsToImport.concat(this.getPresetsByCategory(cat) as PresetVariable[])
      }
    } else {
      presetsToImport = ALL_VCP_PRESETS as PresetVariable[]
    }

    logger.info(`Starting preset import: ${presetsToImport.length} presets`, { overwrite, categories })

    for (const preset of presetsToImport) {
      try {
        const { action, message } = await this.importPreset(preset, overwrite)

        result.details.push({
          name: preset.name,
          action,
          message
        })

        switch (action) {
          case 'created':
            result.created++
            break
          case 'updated':
            result.updated++
            break
          case 'skipped':
            result.skipped++
            break
        }
      } catch (error) {
        result.errors.push(`${preset.name}: ${String(error)}`)
        result.details.push({
          name: preset.name,
          action: 'error',
          message: String(error)
        })
      }
    }

    result.success = result.errors.length === 0

    logger.info('Preset import completed', {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length
    })

    return result
  }

  /**
   * 导入 Agent 角色卡
   */
  async importAgents(overwrite: boolean = false): Promise<PresetImportResult> {
    return this.importAll({ categories: ['agents'], overwrite })
  }

  /**
   * 导入 TVStxt 预设
   */
  async importTVStxt(overwrite: boolean = false): Promise<PresetImportResult> {
    return this.importAll({ categories: ['tvstxt'], overwrite })
  }

  /**
   * 导入 Tar 模板变量
   */
  async importTar(overwrite: boolean = false): Promise<PresetImportResult> {
    return this.importAll({ categories: ['tar'], overwrite })
  }

  /**
   * 导入 Var 基础变量
   */
  async importVar(overwrite: boolean = false): Promise<PresetImportResult> {
    return this.importAll({ categories: ['var'], overwrite })
  }

  /**
   * 导入 Sar 模型条件变量
   */
  async importSar(overwrite: boolean = false): Promise<PresetImportResult> {
    return this.importAll({ categories: ['sar'], overwrite })
  }

  /**
   * 获取 TVStxt 目录路径
   */
  private getTvsTxtDir(): string {
    return path.join(app.getPath('userData'), 'vcp', 'TVStxt')
  }

  /**
   * 确保 TVStxt 目录存在
   */
  private async ensureTvsTxtDir(): Promise<void> {
    const dir = this.getTvsTxtDir()
    try {
      await fs.access(dir)
    } catch {
      await fs.mkdir(dir, { recursive: true })
      logger.info(`Created TVStxt directory: ${dir}`)
    }
  }

  /**
   * 导入 TVStxt 文件到本地目录
   */
  async importTvsTxtFiles(overwrite: boolean = false): Promise<{
    created: number
    updated: number
    skipped: number
    errors: string[]
    details: Array<{ name: string; action: 'created' | 'updated' | 'skipped' | 'error'; message?: string }>
  }> {
    await this.ensureTvsTxtDir()
    const dir = this.getTvsTxtDir()

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as Array<{ name: string; action: 'created' | 'updated' | 'skipped' | 'error'; message?: string }>
    }

    for (const [fileName, content] of Object.entries(TVSTXT_FILE_CONTENTS)) {
      const filePath = path.join(dir, fileName)
      try {
        let fileExists = false
        try {
          await fs.access(filePath)
          fileExists = true
        } catch {
          fileExists = false
        }

        if (fileExists) {
          if (overwrite) {
            await fs.writeFile(filePath, content, 'utf-8')
            result.updated++
            result.details.push({ name: fileName, action: 'updated' })
            logger.debug(`TVStxt file updated: ${fileName}`)
          } else {
            result.skipped++
            result.details.push({ name: fileName, action: 'skipped', message: '文件已存在' })
            logger.debug(`TVStxt file skipped (exists): ${fileName}`)
          }
        } else {
          await fs.writeFile(filePath, content, 'utf-8')
          result.created++
          result.details.push({ name: fileName, action: 'created' })
          logger.debug(`TVStxt file created: ${fileName}`)
        }
      } catch (error) {
        result.errors.push(`${fileName}: ${String(error)}`)
        result.details.push({ name: fileName, action: 'error', message: String(error) })
        logger.error(`Failed to import TVStxt file: ${fileName}`, error as Error)
      }
    }

    logger.info('TVStxt file import completed', {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length
    })

    return result
  }

  /**
   * 完整导入（包含变量和 TVStxt 文件）
   */
  async importAllWithFiles(options: PresetImportOptions = {}): Promise<{
    variables: PresetImportResult
    files: {
      created: number
      updated: number
      skipped: number
      errors: string[]
    }
  }> {
    const { overwrite = false, categories } = options

    // 导入变量
    const variableResult = await this.importAll(options)

    // 如果包含 tvstxt 类别或导入全部，则同时导入 TVStxt 文件
    const shouldImportFiles = !categories || categories.length === 0 || categories.includes('tvstxt')
    let fileResult = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

    if (shouldImportFiles) {
      const fullFileResult = await this.importTvsTxtFiles(overwrite)
      fileResult = {
        created: fullFileResult.created,
        updated: fullFileResult.updated,
        skipped: fullFileResult.skipped,
        errors: fullFileResult.errors
      }
    }

    return {
      variables: variableResult,
      files: fileResult
    }
  }

  /**
   * 预览 TVStxt 文件导入
   */
  async previewTvsTxtFiles(overwrite: boolean = false): Promise<{
    toCreate: string[]
    toUpdate: string[]
    toSkip: string[]
  }> {
    await this.ensureTvsTxtDir()
    const dir = this.getTvsTxtDir()

    const toCreate: string[] = []
    const toUpdate: string[] = []
    const toSkip: string[] = []

    for (const fileName of Object.keys(TVSTXT_FILE_CONTENTS)) {
      const filePath = path.join(dir, fileName)
      try {
        await fs.access(filePath)
        // 文件存在
        if (overwrite) {
          toUpdate.push(fileName)
        } else {
          toSkip.push(fileName)
        }
      } catch {
        // 文件不存在
        toCreate.push(fileName)
      }
    }

    return { toCreate, toUpdate, toSkip }
  }

  /**
   * 预览导入（不实际执行，仅返回将要进行的操作）
   */
  async previewImport(options: PresetImportOptions = {}): Promise<{
    toCreate: string[]
    toUpdate: string[]
    toSkip: string[]
  }> {
    const { overwrite = false, categories } = options

    let presetsToImport: PresetVariable[] = []

    if (categories && categories.length > 0) {
      for (const cat of categories) {
        presetsToImport = presetsToImport.concat(this.getPresetsByCategory(cat) as PresetVariable[])
      }
    } else {
      presetsToImport = ALL_VCP_PRESETS as PresetVariable[]
    }

    const toCreate: string[] = []
    const toUpdate: string[] = []
    const toSkip: string[] = []

    for (const preset of presetsToImport) {
      const existing = await this.checkExisting(preset.name)
      if (existing) {
        if (overwrite) {
          toUpdate.push(preset.name)
        } else {
          toSkip.push(preset.name)
        }
      } else {
        toCreate.push(preset.name)
      }
    }

    return { toCreate, toUpdate, toSkip }
  }

  /**
   * 完整预览导入（包含变量和文件）
   */
  async previewImportWithFiles(options: PresetImportOptions = {}): Promise<{
    variables: { toCreate: string[]; toUpdate: string[]; toSkip: string[] }
    files: { toCreate: string[]; toUpdate: string[]; toSkip: string[] }
  }> {
    const { overwrite = false, categories } = options

    // 预览变量
    const variablePreview = await this.previewImport(options)

    // 如果包含 tvstxt 类别或导入全部，则同时预览文件
    const shouldPreviewFiles = !categories || categories.length === 0 || categories.includes('tvstxt')
    let filePreview = { toCreate: [] as string[], toUpdate: [] as string[], toSkip: [] as string[] }

    if (shouldPreviewFiles) {
      filePreview = await this.previewTvsTxtFiles(overwrite)
    }

    return {
      variables: variablePreview,
      files: filePreview
    }
  }
}

export const vcpPresetImporter = VCPPresetImporterImpl.getInstance()

export default vcpPresetImporter
