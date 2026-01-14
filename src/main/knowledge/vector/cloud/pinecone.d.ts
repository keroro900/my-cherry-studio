/**
 * Pinecone SDK 类型声明
 *
 * 当 @pinecone-database/pinecone 未安装时提供基础类型
 */

declare module '@pinecone-database/pinecone' {
  export interface PineconeConfiguration {
    apiKey: string
  }

  export interface Index {
    upsert: (records: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>) => Promise<void>
    query: (options: { vector: number[]; topK: number; includeMetadata?: boolean }) => Promise<{
      matches: Array<{ id: string; score: number; metadata?: Record<string, any> }>
    }>
    deleteOne: (id: string) => Promise<void>
    deleteMany: (ids: string[]) => Promise<void>
    deleteAll: () => Promise<void>
    describeIndexStats: () => Promise<{
      totalRecordCount?: number
      dimension?: number
    }>
    namespace: (namespace: string) => Index
  }

  export class Pinecone {
    constructor(config: PineconeConfiguration)
    index(indexName: string): Index
  }
}
