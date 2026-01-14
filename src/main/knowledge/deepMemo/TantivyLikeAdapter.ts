/**
 * TantivyLikeAdapter - Enhanced full-text search adapter
 *
 * Provides Tantivy-like functionality using enhanced BM25+ scoring:
 * - Chinese/Japanese/Korean tokenization
 * - Term frequency normalization
 * - Document length normalization
 * - Positional indexing for phrase queries
 * - Inverted index for fast lookups
 * - **NEW: Index persistence (usearch binary compatible format)**
 *
 * Based on VCPToolBox's rust-vexus-lite persistence model.
 *
 * @version 2.0.0
 * @see external/VCPToolBox/KnowledgeBaseManager.js:983-1015
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import type { TantivyAdapter } from './DeepMemoService'

const logger = loggerService.withContext('TantivyLikeAdapter')

// ==================== Types ====================

interface IndexedDocument {
  id: string
  content: string
  metadata?: Record<string, unknown>
  /** Term frequencies */
  termFreqs: Map<string, number>
  /** Term positions for phrase queries */
  termPositions: Map<string, number[]>
  /** Document length (term count) */
  length: number
  /** Timestamp */
  indexedAt: Date
}

interface PostingEntry {
  docId: string
  frequency: number
  positions: number[]
}

/**
 * Serializable index format for persistence
 */
interface SerializableIndex {
  version: string
  documents: Array<{
    id: string
    content: string
    metadata?: Record<string, unknown>
    termFreqs: Array<[string, number]>
    termPositions: Array<[string, number[]]>
    length: number
    indexedAt: string
  }>
  invertedIndex: Array<[string, PostingEntry[]]>
  avgDocLength: number
  docCount: number
  savedAt: string
}

/**
 * Persistence configuration
 */
interface PersistenceConfig {
  /** Index name for file storage */
  indexName: string
  /** Enable auto-save */
  autoSave: boolean
  /** Auto-save delay in milliseconds */
  autoSaveDelay: number
  /** Data directory */
  dataDir?: string
}

// ==================== BM25+ Parameters ====================

const BM25_PARAMS = {
  /** Term frequency saturation */
  k1: 1.2,
  /** Document length normalization */
  b: 0.75,
  /** BM25+ delta (added to IDF to handle zero-frequency terms) */
  delta: 1.0
}

// ==================== Tokenizer ====================

/**
 * Multi-language tokenizer supporting CJK characters
 */
class MultiLangTokenizer {
  private stopWords: Set<string>

  constructor() {
    // Common stopwords for English and Chinese
    this.stopWords = new Set([
      // English
      'a',
      'an',
      'and',
      'are',
      'as',
      'at',
      'be',
      'by',
      'for',
      'from',
      'has',
      'he',
      'in',
      'is',
      'it',
      'its',
      'of',
      'on',
      'that',
      'the',
      'to',
      'was',
      'were',
      'will',
      'with',
      // Chinese
      '的',
      '了',
      '和',
      '是',
      '在',
      '有',
      '我',
      '你',
      '他',
      '她',
      '它',
      '们',
      '这',
      '那',
      '就',
      '也',
      '都',
      '而',
      '及',
      '与',
      '或',
      '个',
      '等'
    ])
  }

  /**
   * Tokenize text into terms
   */
  tokenize(text: string): string[] {
    const tokens: string[] = []

    // Normalize text
    const normalized = text.toLowerCase().normalize('NFKC')

    // Split by whitespace and punctuation first
    const segments = normalized.split(/[\s,.!?;:'"()[\]{}|\\/<>\-_=+*&^%$#@~`]+/)

    for (const segment of segments) {
      if (!segment) continue

      // Check if segment contains CJK characters
      if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(segment)) {
        // CJK: character-based tokenization with bigrams
        const chars = Array.from(segment)

        // Add individual characters
        for (const char of chars) {
          if (this.isValidTerm(char)) {
            tokens.push(char)
          }
        }

        // Add bigrams for better phrase matching
        for (let i = 0; i < chars.length - 1; i++) {
          const bigram = chars[i] + chars[i + 1]
          tokens.push(bigram)
        }
      } else {
        // Non-CJK: word-based tokenization
        if (this.isValidTerm(segment)) {
          tokens.push(segment)
        }
      }
    }

    return tokens
  }

  /**
   * Check if term is valid (not stopword, not too short)
   */
  private isValidTerm(term: string): boolean {
    if (term.length === 0) return false
    if (this.stopWords.has(term)) return false
    // Allow single CJK characters, but require at least 2 chars for non-CJK
    if (!/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(term) && term.length < 2) {
      return false
    }
    return true
  }
}

// ==================== TantivyLike Adapter ====================

const INDEX_VERSION = '2.0.0'

const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  indexName: 'default',
  autoSave: true,
  autoSaveDelay: 5000
}

export class TantivyLikeAdapter implements TantivyAdapter {
  private documents: Map<string, IndexedDocument> = new Map()
  private invertedIndex: Map<string, PostingEntry[]> = new Map()
  private tokenizer: MultiLangTokenizer
  private avgDocLength: number = 0
  private docCount: number = 0
  private pendingCommit: boolean = false

  // Persistence fields
  private persistenceConfig: PersistenceConfig
  private dataDir: string
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private isDirty: boolean = false
  private initialized: boolean = false

  constructor(config?: Partial<PersistenceConfig>) {
    this.tokenizer = new MultiLangTokenizer()
    this.persistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...config }
    this.dataDir = this.persistenceConfig.dataDir || path.join(app.getPath('userData'), 'tantivy-indices')
    this.ensureDataDir()
    logger.info('TantivyLikeAdapter initialized', { indexName: this.persistenceConfig.indexName })
  }

  // ==================== Persistence Methods ====================

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  private getIndexPath(): string {
    return path.join(this.dataDir, `${this.persistenceConfig.indexName}.json`)
  }

  /**
   * Initialize adapter and load existing index from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.loadFromDisk()
      this.initialized = true
      logger.info('TantivyLikeAdapter initialized from disk', {
        docCount: this.docCount,
        termCount: this.invertedIndex.size
      })
    } catch (error) {
      logger.warn('Failed to load index from disk, starting fresh', error as Error)
      this.initialized = true
    }
  }

  /**
   * Load index from disk
   * Based on VCPToolBox's _loadIndexFromDisk pattern
   */
  async loadFromDisk(): Promise<boolean> {
    const indexPath = this.getIndexPath()
    if (!fs.existsSync(indexPath)) {
      logger.debug('No existing index found', { path: indexPath })
      return false
    }

    try {
      const data = fs.readFileSync(indexPath, 'utf8')
      const serialized: SerializableIndex = JSON.parse(data)

      // Version check
      if (serialized.version !== INDEX_VERSION) {
        logger.warn('Index version mismatch, rebuilding', {
          expected: INDEX_VERSION,
          found: serialized.version
        })
        return false
      }

      // Restore documents
      this.documents.clear()
      for (const doc of serialized.documents) {
        this.documents.set(doc.id, {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          termFreqs: new Map(doc.termFreqs),
          termPositions: new Map(doc.termPositions),
          length: doc.length,
          indexedAt: new Date(doc.indexedAt)
        })
      }

      // Restore inverted index
      this.invertedIndex.clear()
      for (const [term, postings] of serialized.invertedIndex) {
        this.invertedIndex.set(term, postings)
      }

      // Restore statistics
      this.avgDocLength = serialized.avgDocLength
      this.docCount = serialized.docCount

      logger.info('Index loaded from disk', {
        docCount: this.docCount,
        termCount: this.invertedIndex.size,
        savedAt: serialized.savedAt
      })

      return true
    } catch (error) {
      logger.error('Failed to load index from disk', error as Error)
      return false
    }
  }

  /**
   * Save index to disk
   * Based on VCPToolBox's _saveIndexToDisk pattern
   */
  async saveToDisk(): Promise<void> {
    if (!this.isDirty) return

    try {
      // Serialize documents
      const documents = Array.from(this.documents.values()).map((doc) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        termFreqs: Array.from(doc.termFreqs.entries()),
        termPositions: Array.from(doc.termPositions.entries()),
        length: doc.length,
        indexedAt: doc.indexedAt.toISOString()
      }))

      // Serialize inverted index
      const invertedIndex = Array.from(this.invertedIndex.entries())

      const serialized: SerializableIndex = {
        version: INDEX_VERSION,
        documents,
        invertedIndex,
        avgDocLength: this.avgDocLength,
        docCount: this.docCount,
        savedAt: new Date().toISOString()
      }

      const indexPath = this.getIndexPath()
      fs.writeFileSync(indexPath, JSON.stringify(serialized))

      this.isDirty = false
      logger.debug('Index saved to disk', {
        path: indexPath,
        docCount: this.docCount
      })
    } catch (error) {
      logger.error('Failed to save index to disk', error as Error)
    }
  }

  /**
   * Schedule auto-save (debounced)
   */
  private scheduleSave(): void {
    if (!this.persistenceConfig.autoSave) return

    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(() => {
      this.saveToDisk()
      this.saveTimer = null
    }, this.persistenceConfig.autoSaveDelay)
  }

  /**
   * Add document to index
   */
  async addDocument(id: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    const tokens = this.tokenizer.tokenize(content)
    const termFreqs = new Map<string, number>()
    const termPositions = new Map<string, number[]>()

    // Calculate term frequencies and positions
    tokens.forEach((term, position) => {
      termFreqs.set(term, (termFreqs.get(term) || 0) + 1)

      const positions = termPositions.get(term) || []
      positions.push(position)
      termPositions.set(term, positions)
    })

    const doc: IndexedDocument = {
      id,
      content,
      metadata,
      termFreqs,
      termPositions,
      length: tokens.length,
      indexedAt: new Date()
    }

    // Remove old version if exists
    if (this.documents.has(id)) {
      await this.deleteDocument(id)
    }

    this.documents.set(id, doc)
    this.pendingCommit = true
    this.isDirty = true

    // Update inverted index
    for (const [term, freq] of termFreqs) {
      const postings = this.invertedIndex.get(term) || []
      postings.push({
        docId: id,
        frequency: freq,
        positions: termPositions.get(term) || []
      })
      this.invertedIndex.set(term, postings)
    }

    // Schedule auto-save
    this.scheduleSave()

    logger.debug('Document added', { id, termCount: tokens.length })
  }

  /**
   * Search documents using BM25+ scoring
   */
  async search(query: string, limit: number): Promise<Array<{ id: string; score: number }>> {
    if (this.docCount === 0) {
      return []
    }

    const queryTerms = this.tokenizer.tokenize(query)
    if (queryTerms.length === 0) {
      return []
    }

    const scores = new Map<string, number>()

    for (const term of queryTerms) {
      const postings = this.invertedIndex.get(term)
      if (!postings) continue

      // Calculate IDF with BM25+ delta
      const df = postings.length
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1) + BM25_PARAMS.delta

      for (const posting of postings) {
        const doc = this.documents.get(posting.docId)
        if (!doc) continue

        // Calculate TF component with saturation
        const tf = posting.frequency
        const docLen = doc.length
        const numerator = tf * (BM25_PARAMS.k1 + 1)
        const denominator = tf + BM25_PARAMS.k1 * (1 - BM25_PARAMS.b + BM25_PARAMS.b * (docLen / this.avgDocLength))

        const termScore = idf * (numerator / denominator)

        scores.set(posting.docId, (scores.get(posting.docId) || 0) + termScore)
      }
    }

    // Apply phrase boost if query has multiple terms
    if (queryTerms.length > 1) {
      this.applyPhraseBoost(queryTerms, scores)
    }

    // Sort by score and return top results
    const results = Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    logger.debug('Search completed', {
      query: query.substring(0, 50),
      resultCount: results.length,
      topScore: results[0]?.score
    })

    return results
  }

  /**
   * Apply phrase proximity boost
   */
  private applyPhraseBoost(queryTerms: string[], scores: Map<string, number>): void {
    for (const [docId, score] of scores) {
      const doc = this.documents.get(docId)
      if (!doc) continue

      let phraseBoost = 1.0

      // Check for consecutive terms (phrase match)
      for (let i = 0; i < queryTerms.length - 1; i++) {
        const term1Positions = doc.termPositions.get(queryTerms[i])
        const term2Positions = doc.termPositions.get(queryTerms[i + 1])

        if (term1Positions && term2Positions) {
          // Check if any positions are adjacent
          for (const pos1 of term1Positions) {
            if (term2Positions.includes(pos1 + 1)) {
              phraseBoost += 0.2
              break
            }
          }

          // Check for proximity (within 3 words)
          for (const pos1 of term1Positions) {
            for (const pos2 of term2Positions) {
              if (Math.abs(pos2 - pos1) <= 3) {
                phraseBoost += 0.05
                break
              }
            }
          }
        }
      }

      scores.set(docId, score * phraseBoost)
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(id: string): Promise<void> {
    const doc = this.documents.get(id)
    if (!doc) return

    // Remove from inverted index
    for (const term of doc.termFreqs.keys()) {
      const postings = this.invertedIndex.get(term)
      if (postings) {
        const filtered = postings.filter((p) => p.docId !== id)
        if (filtered.length === 0) {
          this.invertedIndex.delete(term)
        } else {
          this.invertedIndex.set(term, filtered)
        }
      }
    }

    this.documents.delete(id)
    this.pendingCommit = true
    this.isDirty = true

    // Schedule auto-save
    this.scheduleSave()

    logger.debug('Document deleted', { id })
  }

  /**
   * Commit changes and update statistics
   */
  async commit(): Promise<void> {
    if (!this.pendingCommit) return

    // Update document count
    this.docCount = this.documents.size

    // Update average document length
    if (this.docCount > 0) {
      let totalLength = 0
      for (const doc of this.documents.values()) {
        totalLength += doc.length
      }
      this.avgDocLength = totalLength / this.docCount
    } else {
      this.avgDocLength = 0
    }

    this.pendingCommit = false
    this.isDirty = true

    // Schedule auto-save after commit
    this.scheduleSave()

    logger.debug('Index committed', {
      docCount: this.docCount,
      avgDocLength: this.avgDocLength.toFixed(2),
      termCount: this.invertedIndex.size
    })
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.documents.clear()
    this.invertedIndex.clear()
    this.docCount = 0
    this.avgDocLength = 0
    this.pendingCommit = false
    this.isDirty = true

    // Save immediately to clear persisted data
    await this.saveToDisk()

    logger.info('Index cleared')
  }

  /**
   * Dispose and cleanup resources
   */
  async dispose(): Promise<void> {
    // Cancel pending save timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }

    // Force save before disposal
    await this.saveToDisk()

    logger.info('TantivyLikeAdapter disposed', {
      indexName: this.persistenceConfig.indexName
    })
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.size
  }

  /**
   * Get term count (vocabulary size)
   */
  getTermCount(): number {
    return this.invertedIndex.size
  }

  /**
   * Get index statistics
   */
  getStats(): {
    docCount: number
    termCount: number
    avgDocLength: number
    indexName: string
    dataDir: string
  } {
    return {
      docCount: this.docCount,
      termCount: this.invertedIndex.size,
      avgDocLength: this.avgDocLength,
      indexName: this.persistenceConfig.indexName,
      dataDir: this.dataDir
    }
  }
}

// ==================== Factory ====================

let adapterInstance: TantivyLikeAdapter | null = null

/**
 * Get TantivyLike adapter singleton
 */
export function getTantivyLikeAdapter(config?: Partial<PersistenceConfig>): TantivyLikeAdapter {
  if (!adapterInstance) {
    adapterInstance = new TantivyLikeAdapter(config)
  }
  return adapterInstance
}

/**
 * Create new TantivyLike adapter instance with configuration
 */
export function createTantivyLikeAdapter(config?: Partial<PersistenceConfig>): TantivyLikeAdapter {
  return new TantivyLikeAdapter(config)
}

/**
 * Get adapter for specific index name (creates separate instance)
 */
export function getTantivyAdapterForIndex(indexName: string): TantivyLikeAdapter {
  return new TantivyLikeAdapter({ indexName })
}
