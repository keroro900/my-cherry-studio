/**
 * Native VCP 模块功能测试
 *
 * 测试从 VCP rust-vexus-lite 迁移的模块:
 * - VexusIndex (HNSW 向量索引)
 * - CooccurrenceMatrix (NPMI 共现矩阵)
 * - SemanticGroupMatcher (语义组匹配)
 * - ChineseSearchEngine (中文全文搜索)
 */

const path = require('path')
const fs = require('fs')

// 加载原生模块
let native
try {
  native = require('./index.js')
  console.log('✅ Native module loaded successfully')
  console.log('   Version:', native.getVersion())
  console.log('   Health:', JSON.stringify(native.healthCheck(), null, 2))
} catch (error) {
  console.error('❌ Failed to load native module:', error.message)
  process.exit(1)
}

// 测试临时目录
const TEST_DIR = path.join(__dirname, '.test-temp')
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true })
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing VexusIndex (HNSW Vector Index)')
console.log('='.repeat(60))

try {
  // 创建 1536 维向量索引 (OpenAI embedding 维度)
  const vexus = new native.VexusIndex(1536, 1000)
  console.log('✅ VexusIndex created (1536 dim, 1000 capacity)')

  // 创建测试向量
  const createVector = (dim, seed = 0) => {
    const buffer = Buffer.alloc(dim * 4) // Float32 = 4 bytes
    for (let i = 0; i < dim; i++) {
      buffer.writeFloatLE(Math.sin(seed + i * 0.1), i * 4)
    }
    return buffer
  }

  // 添加向量
  vexus.add(1, createVector(1536, 0))
  vexus.add(2, createVector(1536, 1))
  vexus.add(3, createVector(1536, 2))
  console.log('✅ Added 3 vectors')

  // 批量添加
  const batchIds = [4, 5, 6]
  const batchVectors = Buffer.alloc(3 * 1536 * 4)
  for (let i = 0; i < 3; i++) {
    const vec = createVector(1536, i + 3)
    vec.copy(batchVectors, i * 1536 * 4)
  }
  vexus.addBatch(batchIds, batchVectors)
  console.log('✅ Batch added 3 more vectors')

  // 搜索
  const queryVec = createVector(1536, 0) // 应该最匹配 id=1
  const results = vexus.search(queryVec, 3)
  console.log('✅ Search results:', results)

  // 统计
  const stats = vexus.stats()
  console.log('✅ Stats:', stats)

  // 保存
  const indexPath = path.join(TEST_DIR, 'test-vexus.usearch')
  vexus.save(indexPath)
  console.log('✅ Saved to:', indexPath)

  // 重新加载
  const loaded = native.VexusIndex.load(indexPath, 1536, 1000)
  console.log('✅ Loaded from disk, size:', loaded.size())

} catch (error) {
  console.error('❌ VexusIndex test failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing CooccurrenceMatrix (NPMI Tag Cooccurrence)')
console.log('='.repeat(60))

try {
  const matrix = new native.CooccurrenceMatrix()
  console.log('✅ CooccurrenceMatrix created')

  // 从文档构建
  const documents = [
    { id: 'doc1', tags: ['红色', '正式', '西装'] },
    { id: 'doc2', tags: ['蓝色', '休闲', 'T恤'] },
    { id: 'doc3', tags: ['红色', '商务', '衬衫'] },
    { id: 'doc4', tags: ['红色', '正式', '裙子'] },
    { id: 'doc5', tags: ['蓝色', '休闲', '牛仔'] },
    { id: 'doc6', tags: ['红色', '商务', '西装'] },
  ]

  const pairCount = matrix.buildFromDocuments(documents)
  console.log('✅ Built from documents, pair count:', pairCount)

  // 查询共现权重
  const weight = matrix.getCooccurrence('红色', '正式')
  console.log('✅ Cooccurrence(红色, 正式):', weight.toFixed(4))

  // 获取相关标签
  const related = matrix.getRelatedTags('红色', 5, 0.1)
  console.log('✅ Related to 红色:', related.map(r => `${r.tag2}(${r.weight.toFixed(3)})`).join(', '))

  // 多跳扩展
  const expanded = matrix.expandTags(['红色', '西装'], 2, 0.7)
  console.log('✅ Expanded from [红色, 西装]:', expanded.length, 'tags')

  // 计算 boost
  const boost = matrix.calculateBoost(['红色', '西装'], ['正式', '商务'], 0.3, 0.1)
  console.log('✅ Boost score:', boost.toFixed(4))

  // 序列化
  const json = matrix.toJson()
  const restored = native.CooccurrenceMatrix.fromJson(json)
  console.log('✅ Serialization/deserialization OK, tag count:', restored.tagCount())

} catch (error) {
  console.error('❌ CooccurrenceMatrix test failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing SemanticGroupMatcher')
console.log('='.repeat(60))

try {
  // 使用默认服装语义组
  const matcher = native.SemanticGroupMatcher.withFashionGroups()
  console.log('✅ SemanticGroupMatcher created with fashion groups')
  console.log('   Keyword count:', matcher.keywordCount())
  console.log('   Group types:', matcher.getGroupTypes().join(', '))

  // 提取匹配
  const text = '我想要一件红色休闲的纯棉T恤，适合春夏穿'
  const matches = matcher.extractMatches(text)
  console.log('✅ Extracted matches from:', text)
  for (const m of matches) {
    console.log(`   - ${m.groupType}/${m.subGroup}: [${m.matchedKeywords.join(', ')}] (weight: ${m.weight.toFixed(2)})`)
  }

  // 扩展关键词
  const expanded = matcher.expandKeywords(matches)
  console.log('✅ Expanded keywords:', expanded.slice(0, 5).join(', '), '...')

  // 自定义组
  const custom = new native.SemanticGroupMatcher()
  custom.registerGroup('brand', 'luxury', ['LV', 'Gucci', 'Prada', 'Chanel'])
  custom.registerGroup('brand', 'sports', ['Nike', 'Adidas', 'Puma'])
  console.log('✅ Custom matcher with', custom.keywordCount(), 'keywords')

} catch (error) {
  console.error('❌ SemanticGroupMatcher test failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing ChineseSearchEngine (jieba + tantivy)')
console.log('='.repeat(60))

try {
  const searchPath = path.join(TEST_DIR, 'chinese-search-index')
  const engine = native.ChineseSearchEngine.open(searchPath)
  console.log('✅ ChineseSearchEngine opened at:', searchPath)

  // 添加文档
  const docs = [
    { id: 'doc1', title: '人工智能发展趋势', content: '深度学习和大语言模型正在改变各个行业，机器学习技术日新月异', tags: ['AI', '深度学习'] },
    { id: 'doc2', title: 'Python 编程入门', content: 'Python 是一门简单易学的编程语言，适合初学者入门', tags: ['编程', 'Python'] },
    { id: 'doc3', title: '机器学习实战', content: '机器学习是人工智能的核心技术，包括监督学习和无监督学习', tags: ['机器学习', 'AI'] },
  ]

  const added = engine.addDocuments(docs)
  engine.commit()
  console.log('✅ Added', added, 'documents')

  // 搜索
  const results = engine.search('机器学习', 10)
  console.log('✅ Search results for "机器学习":')
  for (const r of results) {
    console.log(`   - ${r.id}: ${r.title} (score: ${r.score.toFixed(2)})`)
  }

  // 分词
  const tokens = engine.tokenize('我来自北京清华大学计算机系')
  console.log('✅ Tokenize result:', tokens.join(' | '))

  // 关键词提取
  const keywords = engine.extractKeywords('深度学习是人工智能的核心技术，正在改变各个行业', 5)
  console.log('✅ Keywords:', keywords.map(k => `${k.keyword}(${k.weight})`).join(', '))

  // 统计
  const stats = engine.getStats()
  console.log('✅ Document count:', stats.documentCount)

} catch (error) {
  console.error('❌ ChineseSearchEngine test failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing Standalone jieba Functions')
console.log('='.repeat(60))

try {
  // jiebaCut
  const tokens = native.jiebaCut('我喜欢在北京清华大学读书', true)
  console.log('✅ jiebaCut:', tokens.join(' | '))

  // jiebaExtractKeywords
  const keywords = native.jiebaExtractKeywords('人工智能和机器学习是当今最热门的技术领域', 5)
  console.log('✅ jiebaExtractKeywords:', keywords.map(k => k.keyword).join(', '))

} catch (error) {
  console.error('❌ jieba functions test failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('📊 Testing Vector Operations')
console.log('='.repeat(60))

try {
  const a = [1, 2, 3, 4, 5]
  const b = [5, 4, 3, 2, 1]

  const cosine = native.cosineSimilarity(a, b)
  console.log('✅ Cosine similarity:', cosine.toFixed(4))

  const euclidean = native.euclideanDistance(a, b)
  console.log('✅ Euclidean distance:', euclidean.toFixed(4))

  const dot = native.dotProduct(a, b)
  console.log('✅ Dot product:', dot)

  const normalized = native.normalize(a)
  console.log('✅ Normalized:', normalized.map(v => v.toFixed(3)).join(', '))

  // 批量计算
  const query = [1, 0, 0, 0, 0]
  const vectors = [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0.5, 0.5, 0, 0, 0]]
  const similarities = native.batchCosineSimilarity(query, vectors)
  console.log('✅ Batch cosine:', similarities.map(s => s.toFixed(3)).join(', '))

  const topK = native.topKSimilar(query, vectors, 2)
  console.log('✅ Top-K:', topK.map(r => `idx=${r.index} score=${r.score.toFixed(3)}`).join(', '))

} catch (error) {
  console.error('❌ Vector operations test failed:', error.message)
}

// 清理
console.log('\n' + '='.repeat(60))
console.log('🧹 Cleanup')
console.log('='.repeat(60))

try {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
  console.log('✅ Cleaned up test directory')
} catch (error) {
  console.log('⚠️ Cleanup warning:', error.message)
}

console.log('\n✅ All tests completed!')
