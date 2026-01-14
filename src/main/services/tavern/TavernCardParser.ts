/**
 * TavernCard PNG 解析器
 *
 * 从 PNG 文件的 tEXt chunk 中提取嵌入的角色卡 JSON 数据
 * 支持 TavernCard V2/V3 规范
 */

import { loggerService } from '@logger'
import * as fs from 'fs'
import * as path from 'path'

import type { CharacterCard, TavernCardV2, TavernCardV2Data, TavernCardV3, TavernCardV3Data } from './types'

const logger = loggerService.withContext('TavernCardParser')

// PNG 文件签名
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// tEXt chunk 类型标识
const TEXT_CHUNK_TYPE = 'tEXt'

// 角色卡关键词
const CHARA_KEYWORD = 'chara'

/**
 * PNG Chunk 结构
 */
interface PngChunk {
  length: number
  type: string
  data: Buffer
  crc: number
}

/**
 * 解析结果
 */
export interface ParseResult {
  success: boolean
  card?: TavernCardV2 | TavernCardV3
  error?: string
  spec?: 'chara_card_v2' | 'chara_card_v3'
}

/**
 * TavernCard PNG 解析器类
 */
export class TavernCardParser {
  /**
   * 从 PNG 文件解析角色卡
   */
  async parseFromFile(filePath: string): Promise<ParseResult> {
    try {
      logger.info('Parsing TavernCard from file', { filePath })

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` }
      }

      // 检查文件扩展名
      const ext = path.extname(filePath).toLowerCase()
      if (ext !== '.png') {
        return { success: false, error: `Invalid file extension: ${ext}, expected .png` }
      }

      // 读取文件
      const buffer = await fs.promises.readFile(filePath)

      return this.parseFromBuffer(buffer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to parse TavernCard from file', { filePath, error: message })
      return { success: false, error: message }
    }
  }

  /**
   * 从 Buffer 解析角色卡
   */
  parseFromBuffer(buffer: Buffer): ParseResult {
    try {
      // 验证 PNG 签名
      if (!this.validatePngSignature(buffer)) {
        return { success: false, error: 'Invalid PNG signature' }
      }

      // 提取所有 chunks
      const chunks = this.extractChunks(buffer)

      // 查找 tEXt chunks
      const textChunks = chunks.filter((chunk) => chunk.type === TEXT_CHUNK_TYPE)

      if (textChunks.length === 0) {
        return { success: false, error: 'No tEXt chunks found in PNG' }
      }

      // 查找角色卡数据
      for (const chunk of textChunks) {
        const result = this.parseTextChunk(chunk.data)
        if (result.keyword === CHARA_KEYWORD) {
          // 解码 base64 JSON
          const jsonStr = Buffer.from(result.text, 'base64').toString('utf-8')
          const card = JSON.parse(jsonStr) as TavernCardV2 | TavernCardV3

          // 验证并返回
          const validationResult = this.validateCard(card)
          if (!validationResult.valid) {
            return { success: false, error: validationResult.error }
          }

          logger.info('Successfully parsed TavernCard', {
            spec: card.spec,
            name: card.data.name
          })

          return {
            success: true,
            card,
            spec: card.spec as 'chara_card_v2' | 'chara_card_v3'
          }
        }
      }

      return { success: false, error: 'No character data found in PNG (missing "chara" keyword)' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to parse TavernCard from buffer', { error: message })
      return { success: false, error: message }
    }
  }

  /**
   * 从 JSON 字符串解析角色卡
   */
  parseFromJson(jsonStr: string): ParseResult {
    try {
      const card = JSON.parse(jsonStr) as TavernCardV2 | TavernCardV3

      const validationResult = this.validateCard(card)
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error }
      }

      return {
        success: true,
        card,
        spec: card.spec as 'chara_card_v2' | 'chara_card_v3'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Invalid JSON: ${message}` }
    }
  }

  /**
   * 将角色卡嵌入到 PNG 文件
   */
  async embedToPng(card: TavernCardV2 | TavernCardV3, imagePath: string, outputPath: string): Promise<boolean> {
    try {
      logger.info('Embedding TavernCard to PNG', { imagePath, outputPath })

      // 读取原始图片
      const buffer = await fs.promises.readFile(imagePath)

      // 验证 PNG 签名
      if (!this.validatePngSignature(buffer)) {
        throw new Error('Invalid PNG signature')
      }

      // 提取现有 chunks
      const chunks = this.extractChunks(buffer)

      // 移除现有的 chara tEXt chunk
      const filteredChunks = chunks.filter((chunk) => {
        if (chunk.type !== TEXT_CHUNK_TYPE) return true
        const { keyword } = this.parseTextChunk(chunk.data)
        return keyword !== CHARA_KEYWORD
      })

      // 创建新的 chara tEXt chunk
      const jsonStr = JSON.stringify(card)
      const base64 = Buffer.from(jsonStr, 'utf-8').toString('base64')
      const charaChunk = this.createTextChunk(CHARA_KEYWORD, base64)

      // 在 IEND 之前插入新 chunk
      const iendIndex = filteredChunks.findIndex((chunk) => chunk.type === 'IEND')
      if (iendIndex === -1) {
        throw new Error('Invalid PNG: missing IEND chunk')
      }

      filteredChunks.splice(iendIndex, 0, charaChunk)

      // 重建 PNG
      const newBuffer = this.rebuildPng(filteredChunks)

      // 写入文件
      await fs.promises.writeFile(outputPath, newBuffer)

      logger.info('Successfully embedded TavernCard to PNG', { outputPath })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to embed TavernCard to PNG', { error: message })
      return false
    }
  }

  /**
   * 转换解析结果为 CharacterCard 格式
   */
  toCharacterCard(parseResult: ParseResult, options?: { pngPath?: string }): CharacterCard | null {
    if (!parseResult.success || !parseResult.card) {
      return null
    }

    const card = parseResult.card
    const now = new Date()

    return {
      id: this.generateId(),
      name: card.data.name,
      spec: card.spec as 'chara_card_v2' | 'chara_card_v3',
      data: card.data,
      pngPath: options?.pngPath,
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 验证 PNG 签名
   */
  private validatePngSignature(buffer: Buffer): boolean {
    if (buffer.length < 8) return false
    return buffer.subarray(0, 8).equals(PNG_SIGNATURE)
  }

  /**
   * 提取 PNG chunks
   */
  private extractChunks(buffer: Buffer): PngChunk[] {
    const chunks: PngChunk[] = []
    let offset = 8 // Skip PNG signature

    while (offset < buffer.length) {
      // 读取 chunk 长度 (4 bytes, big endian)
      const length = buffer.readUInt32BE(offset)
      offset += 4

      // 读取 chunk 类型 (4 bytes)
      const type = buffer.toString('ascii', offset, offset + 4)
      offset += 4

      // 读取 chunk 数据
      const data = buffer.subarray(offset, offset + length)
      offset += length

      // 读取 CRC (4 bytes)
      const crc = buffer.readUInt32BE(offset)
      offset += 4

      chunks.push({ length, type, data, crc })

      // IEND 是最后一个 chunk
      if (type === 'IEND') break
    }

    return chunks
  }

  /**
   * 解析 tEXt chunk
   */
  private parseTextChunk(data: Buffer): { keyword: string; text: string } {
    // tEXt chunk 格式: keyword + null + text
    const nullIndex = data.indexOf(0)
    if (nullIndex === -1) {
      return { keyword: data.toString('latin1'), text: '' }
    }

    const keyword = data.toString('latin1', 0, nullIndex)
    const text = data.toString('latin1', nullIndex + 1)

    return { keyword, text }
  }

  /**
   * 创建 tEXt chunk
   */
  private createTextChunk(keyword: string, text: string): PngChunk {
    const keywordBuf = Buffer.from(keyword, 'latin1')
    const textBuf = Buffer.from(text, 'latin1')
    const data = Buffer.concat([keywordBuf, Buffer.from([0]), textBuf])

    return {
      length: data.length,
      type: TEXT_CHUNK_TYPE,
      data,
      crc: this.calculateCrc(TEXT_CHUNK_TYPE, data)
    }
  }

  /**
   * 计算 CRC32
   */
  private calculateCrc(type: string, data: Buffer): number {
    const crcTable = this.getCrcTable()
    let crc = 0xffffffff

    const typeBytes = Buffer.from(type, 'ascii')
    for (const byte of typeBytes) {
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }

    for (const byte of data) {
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }

    return (crc ^ 0xffffffff) >>> 0
  }

  /**
   * 获取 CRC 查找表 (懒加载)
   */
  private crcTable: number[] | null = null
  private getCrcTable(): number[] {
    if (this.crcTable) return this.crcTable

    this.crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1)
        } else {
          c = c >>> 1
        }
      }
      this.crcTable[n] = c
    }

    return this.crcTable
  }

  /**
   * 重建 PNG 文件
   */
  private rebuildPng(chunks: PngChunk[]): Buffer {
    const parts: Buffer[] = [PNG_SIGNATURE]

    for (const chunk of chunks) {
      // Length (4 bytes)
      const lengthBuf = Buffer.alloc(4)
      lengthBuf.writeUInt32BE(chunk.length)
      parts.push(lengthBuf)

      // Type (4 bytes)
      parts.push(Buffer.from(chunk.type, 'ascii'))

      // Data
      parts.push(chunk.data)

      // CRC (4 bytes)
      const crcBuf = Buffer.alloc(4)
      crcBuf.writeUInt32BE(chunk.crc)
      parts.push(crcBuf)
    }

    return Buffer.concat(parts)
  }

  /**
   * 验证卡片结构
   */
  private validateCard(card: unknown): { valid: boolean; error?: string } {
    if (!card || typeof card !== 'object') {
      return { valid: false, error: 'Card is not an object' }
    }

    const c = card as Record<string, unknown>

    // 检查 spec
    if (!c.spec || (c.spec !== 'chara_card_v2' && c.spec !== 'chara_card_v3')) {
      return { valid: false, error: `Invalid spec: ${c.spec}` }
    }

    // 检查 data
    if (!c.data || typeof c.data !== 'object') {
      return { valid: false, error: 'Missing or invalid data field' }
    }

    const data = c.data as Record<string, unknown>

    // 检查必需字段
    if (typeof data.name !== 'string' || !data.name.trim()) {
      return { valid: false, error: 'Missing or invalid name field' }
    }

    return { valid: true }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `tc_${timestamp}_${random}`
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 创建默认的 V2 角色卡数据
 */
export function createDefaultV2Data(name: string): TavernCardV2Data {
  return {
    name,
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '1.0',
    extensions: {}
  }
}

/**
 * 创建默认的 V2 角色卡
 */
export function createDefaultV2Card(name: string): TavernCardV2 {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: createDefaultV2Data(name)
  }
}

/**
 * 创建默认的 V3 角色卡数据
 */
export function createDefaultV3Data(name: string): TavernCardV3Data {
  return {
    ...createDefaultV2Data(name),
    assets: [],
    expressions: {}
  }
}

/**
 * 创建默认的 V3 角色卡
 */
export function createDefaultV3Card(name: string): TavernCardV3 {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: createDefaultV3Data(name)
  }
}

// 导出单例实例
let parserInstance: TavernCardParser | null = null

export function getTavernCardParser(): TavernCardParser {
  if (!parserInstance) {
    parserInstance = new TavernCardParser()
  }
  return parserInstance
}
