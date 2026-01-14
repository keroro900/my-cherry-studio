/**
 * 统一知识库搜索弹窗
 *
 * 支持：
 * - 多源搜索 (日记、知识库、笔记)
 * - 数据源切换
 * - 检索模式选择
 * - TagMemo 标签增强
 * - 查询意图分析展示
 */

import { loggerService } from '@logger'
import { HStack, VStack } from '@renderer/components/Layout'
import { TopView } from '@renderer/components/TopView'
import type { DataSourceType, QueryAnalysis, UnifiedSearchResult } from '@renderer/services/UnifiedKnowledgeService'
import { analyzeQuery, unifiedSearch } from '@renderer/services/UnifiedKnowledgeService'
import type { InputRef } from 'antd'
import { Divider, Input, List, Modal, Segmented, Spin, Tag, Tooltip } from 'antd'
import { Book, Database, FileText, Lightbulb, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('UnifiedSearchPopup')

// ==================== 类型定义 ====================

interface ShowParams {
  /** 初始数据源 */
  initialSource?: DataSourceType | 'all'
  /** 知识库 ID (可选) */
  knowledgeBaseId?: string
  /** 角色名称过滤 (可选) */
  characterName?: string
}

interface Props extends ShowParams {
  resolve: (data: UnifiedSearchResult | null) => void
}

// ==================== 数据源配置 ====================

// 注意：后端 DiaryBackendAdapter 已使用 NoteService，日记和笔记数据已融合
// UI 上合并为 "日记/笔记" 选项，避免用户困惑
const SOURCE_OPTIONS = [
  { value: 'all', label: '全部', icon: <Sparkles size={14} /> },
  { value: 'knowledge', label: '知识库', icon: <Database size={14} /> },
  { value: 'diary', label: '日记/笔记', icon: <Book size={14} /> },
  { value: 'memory', label: '记忆层', icon: <FileText size={14} /> }
]

// 数据源映射：UI 选项 -> 后端数据源
const SOURCE_MAPPING: Record<string, string[]> = {
  all: ['knowledge', 'diary', 'lightmemo', 'deepmemo', 'meshmemo'],
  knowledge: ['knowledge'],
  diary: ['diary'], // diary 后端已包含笔记数据
  memory: ['lightmemo', 'deepmemo', 'meshmemo']
}

// ==================== 主组件 ====================

const PopupContainer: React.FC<Props> = ({ initialSource = 'all', knowledgeBaseId, characterName, resolve }) => {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedSource, setSelectedSource] = useState<string>(initialSource)
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysis | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const { t } = useTranslation()
  const searchInputRef = useRef<InputRef>(null)

  // 执行搜索
  const handleSearch = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setResults([])
        setSearchKeyword('')
        setQueryAnalysis(null)
        return
      }

      setSearchKeyword(value.trim())
      setLoading(true)

      try {
        // 并行执行搜索和查询分析
        // 使用 SOURCE_MAPPING 获取实际的后端数据源
        const sources = SOURCE_MAPPING[selectedSource] || SOURCE_MAPPING.all
        const [searchResults, analysis] = await Promise.all([
          unifiedSearch(value, {
            sources: sources as DataSourceType[],
            knowledgeBaseId,
            characterName,
            topK: 20,
            useRRF: selectedSource === 'all' || selectedSource === 'memory',
            tagMemoEnabled: true
          }),
          analyzeQuery(value)
        ])

        logger.debug('Unified search completed', {
          query: value.slice(0, 50),
          source: selectedSource,
          resultCount: searchResults.length
        })

        setResults(searchResults)
        setQueryAnalysis(analysis)
      } catch (error) {
        logger.error('Search failed', error as Error)
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [selectedSource, knowledgeBaseId, characterName]
  )

  // 选择搜索结果
  const handleSelectResult = (result: UnifiedSearchResult) => {
    setOpen(false)
    resolve(result)
  }

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve(null)
  }

  // 数据源切换时重新搜索
  useEffect(() => {
    if (searchKeyword) {
      handleSearch(searchKeyword)
    }
  }, [selectedSource]) // eslint-disable-line react-hooks/exhaustive-deps

  // 自动聚焦
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      width={800}
      footer={null}
      centered
      closable={false}
      transitionName="animation-move-down"
      styles={{
        content: {
          borderRadius: 20,
          padding: 0,
          overflow: 'hidden',
          paddingBottom: 12
        },
        body: {
          maxHeight: '80vh',
          overflow: 'hidden',
          padding: 0
        }
      }}>
      <VStack style={{ gap: 0 }}>
        {/* 搜索栏 */}
        <HStack style={{ padding: '12px 16px', gap: 12 }}>
          <SearchIcon>
            <Search size={15} />
          </SearchIcon>
          <Input
            ref={searchInputRef}
            value={searchKeyword}
            placeholder={t('knowledge.search_unified', '搜索知识库、日记、笔记...')}
            allowClear
            autoFocus
            spellCheck={false}
            variant="borderless"
            size="middle"
            style={{ flex: 1 }}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={() => handleSearch(searchKeyword)}
          />
          {queryAnalysis && (
            <Tooltip title="查看查询分析">
              <AnalysisToggle $active={showAnalysis} onClick={() => setShowAnalysis(!showAnalysis)}>
                <Lightbulb size={16} />
              </AnalysisToggle>
            </Tooltip>
          )}
        </HStack>

        {/* 数据源选择 */}
        <HStack style={{ padding: '0 16px', marginBottom: 8 }}>
          <Segmented
            size="small"
            value={selectedSource}
            onChange={(value) => setSelectedSource(value as string)}
            options={SOURCE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <HStack style={{ gap: 4 }}>
                  {opt.icon}
                  <span>{opt.label}</span>
                </HStack>
              )
            }))}
          />
        </HStack>

        {/* 查询分析展示 */}
        {showAnalysis && queryAnalysis && <QueryAnalysisPanel analysis={queryAnalysis} />}

        <Divider style={{ margin: 0, borderBlockStartWidth: 0.5 }} />

        {/* 搜索结果 */}
        <ResultsContainer>
          {loading ? (
            <LoadingContainer>
              <Spin size="large" />
            </LoadingContainer>
          ) : results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={(item) => (
                <ResultItem onClick={() => handleSelectResult(item)}>
                  <SearchResultCard result={item} keyword={searchKeyword} />
                </ResultItem>
              )}
            />
          ) : searchKeyword ? (
            <EmptyContainer>
              <span>{t('knowledge.no_results', '没有找到相关结果')}</span>
            </EmptyContainer>
          ) : (
            <EmptyContainer>
              <span>{t('knowledge.search_hint', '输入关键词开始搜索')}</span>
            </EmptyContainer>
          )}
        </ResultsContainer>
      </VStack>
    </Modal>
  )
}

// ==================== 查询分析面板 ====================

const QueryAnalysisPanel: React.FC<{ analysis: QueryAnalysis }> = ({ analysis }) => {
  const intentLabels: Record<string, string> = {
    search: '搜索',
    recall: '回忆',
    summary: '总结',
    comparison: '对比'
  }

  return (
    <AnalysisContainer>
      <HStack style={{ gap: 8, flexWrap: 'wrap' }}>
        {analysis.intent && <Tag color="blue">{intentLabels[analysis.intent] || analysis.intent}</Tag>}
        {analysis.isQuestion && <Tag color="green">问题</Tag>}
        {analysis.isTimeRelated && <Tag color="orange">时间相关: {analysis.timeReference}</Tag>}
        {analysis.keywords.slice(0, 5).map((keyword) => (
          <Tag key={keyword}>{keyword}</Tag>
        ))}
        {analysis.tags.map((tag) => (
          <Tag key={tag} color="purple">
            #{tag}
          </Tag>
        ))}
      </HStack>
    </AnalysisContainer>
  )
}

// ==================== 搜索结果卡片 ====================

const SearchResultCard: React.FC<{
  result: UnifiedSearchResult
  keyword: string
}> = ({ result, keyword }) => {
  // 数据源标签配置（与 SOURCE_OPTIONS 保持一致）
  const sourceLabels: Record<DataSourceType, { label: string; color: string }> = {
    knowledge: { label: '知识库', color: 'blue' },
    diary: { label: '日记/笔记', color: 'green' },
    lightmemo: { label: 'LightMemo', color: 'cyan' },
    deepmemo: { label: 'DeepMemo', color: 'purple' },
    meshmemo: { label: 'MeshMemo', color: 'magenta' },
    notes: { label: '日记/笔记', color: 'green' } // 兼容旧数据
  }

  const sourceInfo = sourceLabels[result.source] || { label: result.source, color: 'default' }

  // 高亮关键词
  const highlightContent = (content: string, keyword: string) => {
    if (!keyword) return content
    const parts = content.split(new RegExp(`(${keyword})`, 'gi'))
    return parts.map((part, i) => (part.toLowerCase() === keyword.toLowerCase() ? <mark key={i}>{part}</mark> : part))
  }

  return (
    <ResultCardContainer>
      <HStack style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <HStack style={{ gap: 8 }}>
          <Tag color={sourceInfo.color}>{sourceInfo.label}</Tag>
          {result.metadata.title && <ResultTitle>{result.metadata.title}</ResultTitle>}
          {result.metadata.characterName && <Tag>{result.metadata.characterName}</Tag>}
        </HStack>
        <ScoreBadge score={result.score}>{(result.score * 100).toFixed(0)}%</ScoreBadge>
      </HStack>

      <ResultContent>
        {highlightContent(result.pageContent.slice(0, 200), keyword)}
        {result.pageContent.length > 200 && '...'}
      </ResultContent>

      {result.metadata.tags && result.metadata.tags.length > 0 && (
        <HStack style={{ gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {result.metadata.tags.slice(0, 5).map((tag) => (
            <Tag key={tag} color="default" style={{ fontSize: 11 }}>
              #{tag}
            </Tag>
          ))}
        </HStack>
      )}

      {result.tagMemoResult && result.tagMemoResult.matchedTags.length > 0 && (
        <TagMemoInfo>
          <Sparkles size={12} />
          <span>TagMemo 匹配: {result.tagMemoResult.matchedTags.join(', ')}</span>
        </TagMemoInfo>
      )}
    </ResultCardContainer>
  )
}

// ==================== 样式组件 ====================

const SearchIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-background-soft);
  flex-shrink: 0;
`

const AnalysisToggle = styled.div<{ $active: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  background-color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  color: ${(props) => (props.$active ? 'white' : 'inherit')};

  &:hover {
    background-color: ${(props) => (props.$active ? 'var(--color-primary-hover)' : 'var(--color-background-mute)')};
  }
`

const AnalysisContainer = styled.div`
  padding: 8px 16px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
  margin: 0 16px 8px;
`

const ResultsContainer = styled.div`
  padding: 0 16px;
  overflow-y: auto;
  max-height: 60vh;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 150px;
  color: var(--color-text-3);
`

const ResultItem = styled.div`
  cursor: pointer;
  padding: 12px;
  margin: 8px 0;
  border-radius: 12px;
  background-color: var(--color-background-soft);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-background-mute);
    transform: translateY(-1px);
  }
`

const ResultCardContainer = styled.div`
  width: 100%;
`

const ResultTitle = styled.span`
  font-weight: 600;
  color: var(--color-text-1);
`

const ResultContent = styled.div`
  color: var(--color-text-2);
  font-size: 13px;
  line-height: 1.5;

  mark {
    background-color: var(--color-warning-light);
    color: var(--color-text-1);
    padding: 0 2px;
    border-radius: 2px;
  }
`

const ScoreBadge = styled.div<{ score: number }>`
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  background-color: ${(props) =>
    props.score >= 0.7
      ? 'var(--color-success-light)'
      : props.score >= 0.4
        ? 'var(--color-warning-light)'
        : 'var(--color-background-mute)'};
  color: ${(props) =>
    props.score >= 0.7 ? 'var(--color-success)' : props.score >= 0.4 ? 'var(--color-warning)' : 'var(--color-text-3)'};
`

const TagMemoInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 4px 8px;
  background-color: var(--color-primary-light);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-primary);
`

// ==================== 导出类 ====================

const TopViewKey = 'UnifiedSearchPopup'

export default class UnifiedSearchPopup {
  static topviewId = 0

  static hide() {
    TopView.hide(TopViewKey)
  }

  static show(props: ShowParams = {}) {
    return new Promise<UnifiedSearchResult | null>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
