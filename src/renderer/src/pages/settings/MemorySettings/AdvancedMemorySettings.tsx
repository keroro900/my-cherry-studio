/**
 * Advanced Memory Settings Component
 *
 * Provides UI for testing VCP Diary (TagMemo) backend
 * Simplified version - removed unused LightMemo/DeepMemo/MeshMemo backends
 */
import { loggerService } from '@logger'
import { HStack } from '@renderer/components/Layout'
import { Badge, Button, Collapse, Empty, Input, Slider, Space, Spin, Switch, Tag, Tooltip } from 'antd'
import { BookOpen, Search, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingHelpText, SettingRow, SettingRowTitle, SettingTitle } from '../index'

const logger = loggerService.withContext('AdvancedMemorySettings')

interface SearchResult {
  id: string
  content: string
  score: number
  backend?: string
  metadata?: Record<string, unknown>
  matchedTags?: string[]
  tagBoostInfo?: {
    boostFactor: number
    spikeCount: number
    totalSpikeScore: number
  }
  sourceFile?: string
}

interface AdvancedMemorySettingsProps {
  theme: string
}

const AdvancedMemorySettings: React.FC<AdvancedMemorySettingsProps> = ({ theme }) => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [diaryDocCount, setDiaryDocCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)

  // VCP TagMemo settings
  const [tagBoost, setTagBoost] = useState(0.5)
  const [useRRF, setUseRRF] = useState(true)
  const [diaryName, setDiaryName] = useState('')

  // Load stats for diary backend
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const integratedStats = await window.api.integratedMemory?.getStats?.().catch(() => null)
      // backends is an array, not an object - use find() to locate the diary backend
      const backends = integratedStats?.stats?.memoryStats?.backends
      const diaryBackend = Array.isArray(backends) ? backends.find((b: { backend: string }) => b.backend === 'diary') : null
      setDiaryDocCount(diaryBackend?.documentCount || 0)
    } catch (error) {
      logger.error('Failed to load diary stats', error as Error)
    } finally {
      setStatsLoading(false)
    }
  }

  // Search using diary backend
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const searchResult = await window.api.integratedMemory.intelligentSearch({
        query: searchQuery,
        options: {
          backends: ['diary'],
          topK: 10
        }
      })

      if (searchResult?.success && searchResult.results) {
        setSearchResults(
          searchResult.results.map((r) => ({
            id: r.id,
            content: r.content,
            score: r.score,
            backend: r.backend,
            matchedTags: r.matchedTags,
            metadata: r.metadata
          }))
        )
      } else {
        setSearchResults([])
      }

      logger.info('Diary search completed', {
        query: searchQuery,
        resultCount: searchResult?.results?.length || 0
      })
    } catch (error) {
      logger.error('Diary search failed', error as Error)
      window.toast.error(t('memory.advanced.search_failed') || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Clear diary backend
  const handleClearDiary = async () => {
    window.modal.confirm({
      centered: true,
      title: t('memory.advanced.clear_confirm_title') || 'Clear Memory',
      content: t('memory.advanced.clear_confirm_content', { backend: 'diary' }) || 'Are you sure you want to clear all diary data?',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.api.integratedMemory.clearBackend?.({ backend: 'diary' })
          window.toast.success(t('memory.advanced.clear_success') || 'Memory cleared')
          loadStats()
        } catch (error) {
          logger.error('Failed to clear diary', error as Error)
          window.toast.error(t('memory.advanced.clear_failed') || 'Failed to clear memory')
        }
      }
    })
  }

  return (
    <SettingGroup theme={theme}>
      <SettingTitle>{t('memory.advanced.title') || 'Advanced Memory'}</SettingTitle>
      <SettingDivider />

      {/* VCP Diary Backend Status */}
      <SettingRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SettingRowTitle>{t('memory.advanced.backends') || 'Memory Backend'}</SettingRowTitle>
          <SettingHelpText>
            {t('memory.advanced.diary_desc') || 'VCP TagMemo with co-occurrence matrix boost'}
          </SettingHelpText>
        </div>
        <Button onClick={loadStats} loading={statsLoading}>
          {t('memory.advanced.refresh_stats') || 'Refresh Stats'}
        </Button>
      </SettingRow>

      <BackendCard className="featured">
        <div className="backend-header">
          <div className="backend-icon diary">
            <BookOpen size={20} />
          </div>
          <div className="backend-info">
            <div className="backend-name">
              <HStack style={{ gap: 6, alignItems: 'center' }}>
                VCP Diary
                <Badge count="TagMemo" style={{ backgroundColor: 'var(--color-primary)' }} />
              </HStack>
            </div>
            <div className="backend-desc">{t('memory.advanced.diary_desc') || 'VCP TagMemo with co-occurrence matrix boost'}</div>
          </div>
        </div>
        <div className="backend-footer">
          <Tag color="purple">{diaryDocCount} docs</Tag>
          <Tooltip title={t('memory.advanced.clear_backend') || 'Clear'}>
            <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={handleClearDiary} />
          </Tooltip>
        </div>
      </BackendCard>

      <SettingDivider />

      {/* TagMemo Settings */}
      <SettingRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SettingRowTitle>
            <HStack style={{ gap: 8, alignItems: 'center' }}>
              <Zap size={16} />
              {t('memory.advanced.tagmemo_settings') || 'TagMemo Settings'}
            </HStack>
          </SettingRowTitle>
          <SettingHelpText>
            {t('memory.advanced.tagmemo_desc') || 'VCP TagMemo uses co-occurrence matrix for tag boost'}
          </SettingHelpText>
        </div>
      </SettingRow>

      <TagMemoContainer>
        <div className="tagmemo-row">
          <div className="tagmemo-label">
            {t('memory.advanced.tag_boost') || 'Tag Boost Factor'}
            <span className="tagmemo-value">{tagBoost.toFixed(2)}</span>
          </div>
          <Slider min={0} max={1} step={0.1} value={tagBoost} onChange={setTagBoost} style={{ flex: 1, maxWidth: 200 }} />
        </div>
        <div className="tagmemo-row">
          <div className="tagmemo-label">{t('memory.advanced.use_rrf') || 'Use RRF Fusion'}</div>
          <Switch checked={useRRF} onChange={setUseRRF} />
        </div>
        <div className="tagmemo-row">
          <div className="tagmemo-label">{t('memory.advanced.diary_name') || 'Diary Name Filter'}</div>
          <Input
            placeholder={t('memory.advanced.diary_name_placeholder') || 'Leave empty for all diaries'}
            value={diaryName}
            onChange={(e) => setDiaryName(e.target.value)}
            style={{ maxWidth: 200 }}
            allowClear
          />
        </div>
      </TagMemoContainer>

      <SettingDivider />

      {/* Search Interface */}
      <SettingRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SettingRowTitle>{t('memory.advanced.search') || 'Search Test'}</SettingRowTitle>
          <SettingHelpText>{t('memory.advanced.search_desc') || 'Test search in VCP Diary'}</SettingHelpText>
        </div>
      </SettingRow>

      <SearchContainer>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder={t('memory.advanced.search_placeholder') || 'Enter search query...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={loading}>
            {t('memory.advanced.search_btn') || 'Search'}
          </Button>
        </Space.Compact>
      </SearchContainer>

      {/* Search Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : searchResults.length > 0 ? (
        <Collapse
          defaultActiveKey={['results']}
          items={[
            {
              key: 'results',
              label: `${t('memory.advanced.results') || 'Results'} (${searchResults.length})`,
              children: (
                <ResultsContainer>
                  {searchResults.map((result, index) => (
                    <ResultItem key={result.id || index}>
                      <div className="result-header">
                        <HStack style={{ gap: 8, alignItems: 'center' }}>
                          <Tag color="green">{(result.score * 100).toFixed(1)}%</Tag>
                          {result.backend && <Tag color="blue">{result.backend}</Tag>}
                        </HStack>
                        <span className="result-id">{result.id}</span>
                      </div>
                      <div className="result-content">{result.content}</div>
                      {result.matchedTags && result.matchedTags.length > 0 && (
                        <div className="result-tags">
                          <Zap size={12} style={{ marginRight: 4 }} />
                          {result.matchedTags.map((tag, i) => (
                            <Tag key={i} color="purple" style={{ fontSize: 11 }}>
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      )}
                      {result.tagBoostInfo && (
                        <div className="result-boost">
                          <span>Boost: {result.tagBoostInfo.boostFactor.toFixed(2)}</span>
                          <span>Spikes: {result.tagBoostInfo.spikeCount}</span>
                          <span>Score: {result.tagBoostInfo.totalSpikeScore.toFixed(2)}</span>
                        </div>
                      )}
                    </ResultItem>
                  ))}
                </ResultsContainer>
              )
            }
          ]}
        />
      ) : searchQuery && !loading ? (
        <Empty description={t('memory.advanced.no_results') || 'No results found'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : null}
    </SettingGroup>
  )
}

// Styled Components
const BackendCard = styled.div`
  padding: 16px;
  margin: 16px 0;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  &.featured {
    border-color: var(--color-primary);
    background: linear-gradient(135deg, var(--color-background-soft) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
  }

  .backend-header {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .backend-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--color-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);

    &.diary {
      background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
      color: white;
    }
  }

  .backend-info {
    flex: 1;
  }

  .backend-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .backend-desc {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .backend-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`

const TagMemoContainer = styled.div`
  margin: 16px 0;
  padding: 16px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;

  .tagmemo-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--color-border);
    }
  }

  .tagmemo-label {
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tagmemo-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--color-primary);
    background: var(--color-primary-light);
    padding: 2px 6px;
    border-radius: 4px;
  }
`

const SearchContainer = styled.div`
  margin: 16px 0;
`

const ResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
`

const ResultItem = styled.div`
  padding: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .result-id {
    font-size: 12px;
    color: var(--color-text-tertiary);
    font-family: monospace;
  }

  .result-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text);
  }

  .result-tags {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .result-boost {
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-text-secondary);
    display: flex;
    gap: 12px;
    font-family: monospace;
  }
`

export default AdvancedMemorySettings
