/**
 * VCP 全局设置面板
 *
 * 整合 VCP 运行时所有设置（原生实现），包括：
 * - 模型设置（显示当前配置，链接到记忆设置）
 * - 调试设置
 * - 执行设置
 * - 日志配置
 * - 插件管理
 */

import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import Scrollbar from '@renderer/components/Scrollbar'
import { useModel } from '@renderer/hooks/useModel'
import { SettingDivider, SettingRow, SettingRowTitle } from '@renderer/pages/settings'
import { CollapsibleSettingGroup } from '@renderer/pages/settings/SettingGroup'
import { selectMemoryConfig } from '@renderer/store/memory'
import { Button, Empty, InputNumber, Select, Spin, Switch, Tag, Typography } from 'antd'
import { ExternalLink } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { PreprocessorOrderPanel } from './PreprocessorOrderPanel'

const { Title, Text } = Typography

/**
 * VCP 运行时配置接口 - 与后端 API 返回的数据结构匹配
 * 注：部分属性为扩展预留，当前 API 可能未返回
 */
interface VCPRuntimeConfig {
  // 当前 API 返回的属性
  debugMode: boolean
  showVCPOutput: boolean
  maxVCPLoopStream: number
  maxVCPLoopNonStream: number
  vcpToolCode: boolean
  defaultTimezone: string
  apiRetries: number
  apiRetryDelay: number
  knowledgeBaseRootPath: string
  vectorStorePath: string
  vectorDbDimension: number
  // 扩展属性（用于 UI 但 API 可能未返回）
  defaultTimeout?: number
  maxConcurrent?: number
  async?: {
    resultStorePath?: string
    maxWaitTime?: number
    cleanupInterval?: number
  }
  logging?: {
    enabled?: boolean
    level?: 'debug' | 'info' | 'warn' | 'error'
    maxEntries?: number
  }
}

/**
 * 全局设置面板组件
 */
const GlobalSettingsPanel: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 状态
  const [config, setConfig] = useState<VCPRuntimeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // 从 Redux 获取记忆配置（只读显示）
  const memoryConfig = useSelector(selectMemoryConfig)
  const embeddingModel = useModel(memoryConfig.embeddingModel?.id, memoryConfig.embeddingModel?.provider)
  const llmModel = useModel(memoryConfig.llmModel?.id, memoryConfig.llmModel?.provider)
  const rerankModel = useModel(memoryConfig.rerankModel?.id, memoryConfig.rerankModel?.provider)

  /**
   * 加载 VCP 运行时状态和配置
   */
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)

      // 检查是否可用
      const availableResult = await window.api.vcpToolbox.isAvailable()
      setIsAvailable(availableResult.data ?? false)

      // 检查是否已初始化
      const initializedResult = await window.api.vcpToolbox.isInitialized()
      setIsInitialized(initializedResult.data ?? false)

      // 加载配置
      if (availableResult.data) {
        const configResult = await window.api.vcpToolbox.getConfig()
        if (configResult.success && configResult.data) {
          setConfig(configResult.data as VCPRuntimeConfig)
        }
      }
    } catch (error) {
      console.debug('VCP Runtime not available:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化
  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  /**
   * 初始化 VCP 运行时
   */
  const handleInitialize = useCallback(async () => {
    try {
      const result = await window.api.vcpPlugin.initialize()
      if (result.success) {
        window.toast?.success?.('VCP 运行时初始化成功')
        await loadStatus()
      } else {
        window.toast?.error?.('VCP 运行时初始化失败: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to initialize VCP Runtime:', error)
      window.toast?.error?.('VCP 运行时初始化失败')
    }
  }, [loadStatus])

  /**
   * 更新配置
   */
  const handleUpdateConfig = useCallback(
    async (path: string, value: unknown) => {
      if (!config) return

      // 支持嵌套路径，如 'logging.level'
      const keys = path.split('.')
      const newConfig = JSON.parse(JSON.stringify(config)) as VCPRuntimeConfig

      let current: any = newConfig
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value

      setConfig(newConfig)

      try {
        // 构建更新对象
        const updateObj: Record<string, unknown> = {}
        if (keys.length === 1) {
          updateObj[path] = value
        } else {
          // 对于嵌套配置，发送整个子对象
          updateObj[keys[0]] = newConfig[keys[0] as keyof VCPRuntimeConfig]
        }
        await window.api.vcpToolbox.updateConfig(updateObj)
      } catch (error) {
        console.error('Failed to update config:', error)
        window.toast?.error?.('配置更新失败')
      }
    },
    [config]
  )

  /**
   * 清理日志
   */
  const handleCleanLogs = useCallback(async () => {
    try {
      await window.api.vcpLog.clear()
      window.toast?.success?.(t('vcp.settings.logs_cleaned', '日志已清理'))
    } catch (error) {
      console.error('Failed to clean logs:', error)
      window.toast?.error?.(t('vcp.settings.clean_failed', '清理日志失败'))
    }
  }, [t])

  /**
   * 刷新插件列表
   */
  const handleRefreshPlugins = useCallback(async () => {
    try {
      const result = await window.api.vcpPlugin.reload()
      if (result.success) {
        window.toast?.success?.(t('vcp.settings.plugins_refreshed', '插件列表已刷新'))
      } else {
        window.toast?.error?.(t('vcp.settings.refresh_failed', '刷新插件失败'))
      }
    } catch (error) {
      console.error('Failed to refresh plugins:', error)
      window.toast?.error?.(t('vcp.settings.refresh_failed', '刷新插件失败'))
    }
  }, [t])

  // 加载中
  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <Spin size="large" />
          <Text type="secondary" style={{ marginTop: 16 }}>
            加载中...
          </Text>
        </LoadingContainer>
      </Container>
    )
  }

  // VCP 运行时不可用
  if (!isAvailable) {
    return (
      <Container>
        <Header>
          <Title level={4} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8 }} />
            {t('vcp.dashboard.settings.title', '全局设置')}
          </Title>
        </Header>
        <EmptyContainer>
          <Empty
            description={
              <div>
                <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                  VCP 运行时不可用
                </Text>
                <Text type="secondary">VCP 运行时初始化失败，请重启应用</Text>
              </div>
            }
          />
        </EmptyContainer>
      </Container>
    )
  }

  return (
    <Container>
      <Header>
        <HStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <SettingOutlined style={{ marginRight: 8 }} />
              {t('vcp.dashboard.settings.title', '全局设置')}
            </Title>
            <Text type="secondary">
              {t('vcp.dashboard.settings.description', 'VCP 系统全局配置，包括默认模型、变量前缀、插件路径等。')}
            </Text>
          </div>
          <HStack gap={8}>
            {isInitialized ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                已初始化
              </Tag>
            ) : (
              <>
                <Tag icon={<ExclamationCircleOutlined />} color="warning">
                  未初始化
                </Tag>
                <Button type="primary" size="small" onClick={handleInitialize}>
                  初始化
                </Button>
              </>
            )}
          </HStack>
        </HStack>
      </Header>

      <SettingsContent>
        {/* 模型设置 - 显示当前配置，链接到记忆设置 */}
        <CollapsibleSettingGroup title={t('vcp.settings.models', '模型设置')} defaultExpanded={true}>
          <SettingGroup>
            <ModelSummaryCard>
              <ModelSummaryRow>
                <ModelLabel>LLM:</ModelLabel>
                <ModelValue configured={!!llmModel}>{llmModel?.name || '未配置'}</ModelValue>
              </ModelSummaryRow>
              <ModelSummaryRow>
                <ModelLabel>Embedding:</ModelLabel>
                <ModelValue configured={!!embeddingModel}>
                  {embeddingModel?.name || '未配置'}
                  {memoryConfig.embeddingDimensions && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      ({memoryConfig.embeddingDimensions}维)
                    </Text>
                  )}
                </ModelValue>
              </ModelSummaryRow>
              <ModelSummaryRow>
                <ModelLabel>Rerank:</ModelLabel>
                <ModelValue configured={!!rerankModel}>{rerankModel?.name || '未配置（可选）'}</ModelValue>
              </ModelSummaryRow>
            </ModelSummaryCard>
            <SettingDivider />
            <SettingRow>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('vcp.settings.model_config_hint', '模型配置在记忆设置中统一管理')}
              </Text>
              <Button
                type="primary"
                size="small"
                icon={<ExternalLink size={14} />}
                onClick={() => navigate('/settings/memory')}>
                {t('vcp.settings.go_to_memory_settings', '前往配置')}
              </Button>
            </SettingRow>
          </SettingGroup>
        </CollapsibleSettingGroup>

        {/* 调试设置 */}
        <CollapsibleSettingGroup title={t('vcp.settings.debug', '调试设置')} defaultExpanded={true}>
          <SettingGroup>
            <SettingRow>
              <div>
                <SettingRowTitleSmall>调试模式</SettingRowTitleSmall>
                <SettingHelpText>启用后将输出详细的调试日志</SettingHelpText>
              </div>
              <Switch
                checked={config?.debugMode}
                onChange={(checked) => handleUpdateConfig('debugMode', checked)}
                size="small"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>日志记录</SettingRowTitleSmall>
                <SettingHelpText>启用 VCP 调用日志记录</SettingHelpText>
              </div>
              <Switch
                checked={config?.logging?.enabled}
                onChange={(checked) => handleUpdateConfig('logging.enabled', checked)}
                size="small"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>日志级别</SettingRowTitleSmall>
                <SettingHelpText>设置日志记录的详细程度</SettingHelpText>
              </div>
              <Select
                value={config?.logging?.level || 'info'}
                onChange={(value) => handleUpdateConfig('logging.level', value)}
                style={{ width: 100 }}
                size="small"
                options={[
                  { value: 'debug', label: 'Debug' },
                  { value: 'info', label: 'Info' },
                  { value: 'warn', label: 'Warn' },
                  { value: 'error', label: 'Error' }
                ]}
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>最大日志条数</SettingRowTitleSmall>
                <SettingHelpText>保留的最大日志条数</SettingHelpText>
              </div>
              <InputNumber
                min={100}
                max={10000}
                step={100}
                value={config?.logging?.maxEntries || 1000}
                onChange={(value) => handleUpdateConfig('logging.maxEntries', value)}
                style={{ width: 100 }}
                size="small"
              />
            </SettingRow>
          </SettingGroup>
        </CollapsibleSettingGroup>

        {/* 执行设置 */}
        <CollapsibleSettingGroup title={t('vcp.settings.execution', '执行设置')} defaultExpanded={false}>
          <SettingGroup>
            <SettingRow>
              <div>
                <SettingRowTitleSmall>默认超时时间</SettingRowTitleSmall>
                <SettingHelpText>工具调用的默认超时时间（毫秒）</SettingHelpText>
              </div>
              <InputNumber
                min={5000}
                max={300000}
                step={1000}
                value={config?.defaultTimeout || 30000}
                onChange={(value) => handleUpdateConfig('defaultTimeout', value)}
                style={{ width: 120 }}
                size="small"
                formatter={(value) => `${value}ms`}
                parser={(value) => Number(value?.replace('ms', '') || 30000)}
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>最大并发数</SettingRowTitleSmall>
                <SettingHelpText>同时执行的最大工具调用数量</SettingHelpText>
              </div>
              <InputNumber
                min={1}
                max={20}
                value={config?.maxConcurrent || 5}
                onChange={(value) => handleUpdateConfig('maxConcurrent', value)}
                style={{ width: 100 }}
                size="small"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>异步任务最大等待时间</SettingRowTitleSmall>
                <SettingHelpText>异步工具调用的最大等待时间（毫秒）</SettingHelpText>
              </div>
              <InputNumber
                min={60000}
                max={600000}
                step={60000}
                value={config?.async?.maxWaitTime || 300000}
                onChange={(value) => handleUpdateConfig('async.maxWaitTime', value)}
                style={{ width: 120 }}
                size="small"
                formatter={(value) => `${Math.round((value || 300000) / 60000)}分钟`}
                parser={(value) => Number(value?.replace('分钟', '') || 5) * 60000}
              />
            </SettingRow>
          </SettingGroup>
        </CollapsibleSettingGroup>

        {/* 插件管理 */}
        <CollapsibleSettingGroup title={t('vcp.settings.plugins', '插件管理')} defaultExpanded={true}>
          <SettingGroup>
            <SettingRow>
              <div>
                <SettingRowTitleSmall>刷新插件列表</SettingRowTitleSmall>
                <SettingHelpText>重新扫描并加载所有插件</SettingHelpText>
              </div>
              <Button icon={<ReloadOutlined />} onClick={handleRefreshPlugins} size="small">
                刷新
              </Button>
            </SettingRow>
            <SettingDivider />
            <SettingRow>
              <div>
                <SettingRowTitleSmall>清理日志</SettingRowTitleSmall>
                <SettingHelpText>清除所有 VCP 调用日志</SettingHelpText>
              </div>
              <Button danger onClick={handleCleanLogs} size="small">
                清理
              </Button>
            </SettingRow>
          </SettingGroup>
        </CollapsibleSettingGroup>

        {/* 预处理器排序 */}
        <CollapsibleSettingGroup title={t('vcp.settings.preprocessors', '预处理器排序')} defaultExpanded={false}>
          <SettingGroup>
            <PreprocessorOrderPanel />
          </SettingGroup>
        </CollapsibleSettingGroup>
      </SettingsContent>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled(Scrollbar)`
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Header = styled.div`
  margin-bottom: 24px;
`

const SettingsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const SettingGroup = styled.div`
  padding: 4px 0;
`

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
`

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
`

const SettingRowTitleSmall = styled(SettingRowTitle)`
  font-size: 13px;
`

const SettingHelpText = styled(Text)`
  font-size: 12px;
  color: var(--color-text-3);
  display: block;
  margin-top: 2px;
`

// 模型摘要卡片样式
const ModelSummaryCard = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ModelSummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ModelLabel = styled.span`
  font-size: 13px;
  color: var(--color-text-2);
  min-width: 80px;
`

const ModelValue = styled.span<{ configured?: boolean }>`
  font-size: 13px;
  color: ${(props) => (props.configured ? 'var(--color-text-1)' : 'var(--color-text-3)')};
  font-weight: ${(props) => (props.configured ? 500 : 400)};
`

export default GlobalSettingsPanel
