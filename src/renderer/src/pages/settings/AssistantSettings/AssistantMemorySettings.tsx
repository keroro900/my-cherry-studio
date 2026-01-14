import { InfoCircleOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Box } from '@renderer/components/Layout'
import MemoriesSettingsModal from '@renderer/pages/settings/MemorySettings/MemorySettingsModal'
import MemoryService from '@renderer/services/MemoryService'
import { selectGlobalMemoryEnabled, selectMemoryConfig } from '@renderer/store/memory'
import type { Assistant, AssistantSettings } from '@renderer/types'
import { Alert, Button, Card, Checkbox, Divider, Space, Switch, Tooltip, Typography } from 'antd'
import { useForm } from 'antd/es/form/Form'
import { Brain, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

const logger = loggerService.withContext('AssistantMemorySettings')

const { Text } = Typography

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  updateAssistantSettings: (settings: AssistantSettings) => void
  onClose?: () => void // Add optional close callback
}

// 记忆后端类型
type MemoryBackend = 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'unified'

// 助手统一记忆配置
interface AssistantMemoryConfig {
  unifiedMemoryEnabled?: boolean
  includeInSearch?: boolean
  applyLearning?: boolean
  backends?: MemoryBackend[]
}

const AssistantMemorySettings: React.FC<Props> = ({ assistant, updateAssistant, onClose }) => {
  const { t } = useTranslation()
  const memoryConfig = useSelector(selectMemoryConfig)
  const globalMemoryEnabled = useSelector(selectGlobalMemoryEnabled)
  const [memoryStats, setMemoryStats] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: true
  })
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const memoryService = MemoryService.getInstance()
  const form = useForm()

  // 获取助手的统一记忆配置
  const unifiedMemoryConfig: AssistantMemoryConfig = (assistant as any).unifiedMemoryConfig || {
    unifiedMemoryEnabled: false,
    includeInSearch: true,
    applyLearning: true,
    backends: ['diary', 'memory', 'lightmemo', 'deepmemo']
  }

  // 更新统一记忆配置
  const updateUnifiedMemoryConfig = (updates: Partial<AssistantMemoryConfig>) => {
    updateAssistant({
      ...assistant,
      unifiedMemoryConfig: {
        ...unifiedMemoryConfig,
        ...updates
      }
    } as Assistant)
  }

  // Load memory statistics for this assistant
  const loadMemoryStats = useCallback(async () => {
    setMemoryStats((prev) => ({ ...prev, loading: true }))
    try {
      const result = await memoryService.list({
        agentId: assistant.id,
        limit: 1000
      })
      setMemoryStats({ count: result.results.length, loading: false })
    } catch (error) {
      logger.error('Failed to load memory stats:', error as Error)
      setMemoryStats({ count: 0, loading: false })
    }
  }, [assistant.id, memoryService])

  useEffect(() => {
    loadMemoryStats()
  }, [loadMemoryStats])

  const handleMemoryToggle = (enabled: boolean) => {
    updateAssistant({ ...assistant, enableMemory: enabled })
  }

  const handleNavigateToMemory = () => {
    // Close current modal/page first
    if (onClose) {
      onClose()
    }
    // Then navigate to memory settings page
    window.location.hash = '#/settings/memory'
  }

  const isMemoryConfigured = memoryConfig.embeddingModel && memoryConfig.llmModel
  const isMemoryEnabled = globalMemoryEnabled && isMemoryConfigured

  // 后端标签
  const backendLabels: Record<MemoryBackend, string> = {
    diary: t('memory.backend.diary', '日记'),
    memory: t('memory.backend.memory', '全局记忆'),
    lightmemo: t('memory.backend.lightmemo', '轻量记忆'),
    deepmemo: t('memory.backend.deepmemo', '深度记忆'),
    meshmemo: t('memory.backend.meshmemo', '网格记忆'),
    unified: t('memory.backend.unified', '统一存储')
  }

  return (
    <Container>
      <HeaderContainer>
        <Box style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {t('memory.title')}
          <Tooltip title={t('memory.description')}>
            <InfoIcon />
          </Tooltip>
        </Box>
        <Space>
          <Button type="text" icon={<Settings2 size={15} />} onClick={handleNavigateToMemory} />
          <Tooltip
            title={
              !globalMemoryEnabled
                ? t('memory.enable_global_memory_first')
                : !isMemoryConfigured
                  ? t('memory.configure_memory_first')
                  : ''
            }>
            <Switch
              checked={assistant.enableMemory || false}
              onChange={handleMemoryToggle}
              disabled={!isMemoryEnabled}
            />
          </Tooltip>
        </Space>
      </HeaderContainer>

      {!globalMemoryEnabled && (
        <Alert
          type="warning"
          message={t('memory.global_memory_disabled_title')}
          description={t('memory.global_memory_disabled_desc')}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={handleNavigateToMemory}>
              {t('memory.go_to_memory_page')}
            </Button>
          }
        />
      )}

      {globalMemoryEnabled && !isMemoryConfigured && (
        <Alert
          type="warning"
          message={t('memory.not_configured_title')}
          description={t('memory.not_configured_desc')}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>{t('memory.stored_memories')}: </Text>
            <Text>{memoryStats.loading ? t('common.loading') : memoryStats.count}</Text>
          </div>
          {memoryConfig.embeddingModel && (
            <div>
              <Text strong>{t('memory.embedding_model')}: </Text>
              <Text code>{memoryConfig.embeddingModel.id}</Text>
            </div>
          )}
          {memoryConfig.llmModel && (
            <div>
              <Text strong>{t('memory.llm_model')}: </Text>
              <Text code>{memoryConfig.llmModel.id}</Text>
            </div>
          )}
        </Space>
      </Card>

      {/* 统一记忆协调器配置 */}
      <Divider style={{ margin: '12px 0' }} />

      <SectionHeader>
        <Brain size={16} />
        <Text strong>{t('memory.unified.title', '统一记忆检索')}</Text>
        <Tooltip title={t('memory.unified.description', '启用后，助手将自动搜索日记、轻量记忆等多个后端')}>
          <InfoIcon style={{ marginLeft: 4 }} />
        </Tooltip>
      </SectionHeader>

      <SettingRow>
        <Text>{t('memory.unified.enable', '启用统一记忆')}</Text>
        <Switch
          size="small"
          checked={unifiedMemoryConfig.unifiedMemoryEnabled}
          onChange={(checked) => updateUnifiedMemoryConfig({ unifiedMemoryEnabled: checked })}
        />
      </SettingRow>

      {unifiedMemoryConfig.unifiedMemoryEnabled && (
        <>
          <SettingRow>
            <Text>{t('memory.unified.include_in_search', '合并知识库搜索')}</Text>
            <Switch
              size="small"
              checked={unifiedMemoryConfig.includeInSearch}
              onChange={(checked) => updateUnifiedMemoryConfig({ includeInSearch: checked })}
            />
          </SettingRow>

          <SettingRow>
            <Text>{t('memory.unified.apply_learning', '应用学习权重')}</Text>
            <Tooltip title={t('memory.unified.apply_learning_tip', '基于用户反馈自动优化搜索结果')}>
              <Switch
                size="small"
                checked={unifiedMemoryConfig.applyLearning}
                onChange={(checked) => updateUnifiedMemoryConfig({ applyLearning: checked })}
              />
            </Tooltip>
          </SettingRow>

          <SettingRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <Text>{t('memory.unified.backends', '记忆来源')}</Text>
            <Checkbox.Group
              value={unifiedMemoryConfig.backends || []}
              onChange={(values) => updateUnifiedMemoryConfig({ backends: values as MemoryBackend[] })}>
              <Space wrap>
                {(Object.keys(backendLabels) as MemoryBackend[]).map((backend) => (
                  <Checkbox key={backend} value={backend}>
                    {backendLabels[backend]}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </SettingRow>
        </>
      )}

      <MemoriesSettingsModal
        visible={settingsModalVisible}
        onSubmit={() => setSettingsModalVisible(false)}
        onCancel={() => setSettingsModalVisible(false)}
        form={form}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const InfoIcon = styled(InfoCircleOutlined)`
  margin-left: 6px;
  font-size: 14px;
  color: var(--color-text-2);
  cursor: help;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
`

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
`

export default AssistantMemorySettings
