/**
 * External Knowledge Module
 *
 * 外部知识源集成模块：
 * - Neo4j 知识图谱
 * - Wikidata SPARQL
 * - Elasticsearch 全文搜索
 *
 * @author Cherry Studio Team
 */

// 抽象接口
export {
  ExternalKnowledgeBackend,
  GraphKnowledgeBackend,
  SparqlKnowledgeBackend,
  FulltextKnowledgeBackend,
  type ExternalSourceType,
  type ExternalSearchResult,
  type ExternalSearchOptions,
  type BackendConnectionConfig,
  type BackendStatus,
  type GraphNode,
  type GraphRelation,
  type GraphTraversalResult,
  type WikidataEntity
} from './ExternalKnowledgeBackend'

// Neo4j 后端
export {
  Neo4jBackend,
  getNeo4jBackend,
  resetNeo4jBackend,
  type Neo4jConfig
} from './Neo4jBackend'

// Wikidata 后端
export {
  WikidataBackend,
  getWikidataBackend,
  resetWikidataBackend,
  type WikidataConfig
} from './WikidataBackend'

// Elasticsearch 后端
export {
  ElasticsearchBackend,
  getElasticsearchBackend,
  resetElasticsearchBackend,
  type ElasticsearchConfig
} from './ElasticsearchBackend'

// 统一管理器
export {
  ExternalKnowledgeManager,
  getExternalKnowledgeManager,
  type ExternalKnowledgeConfig,
  type AggregatedSearchOptions,
  type AggregatedSearchResult
} from './ExternalKnowledgeManager'
