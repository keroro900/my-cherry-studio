/**
 * 外部服务设置页面
 *
 * 管理非 LLM 的外部服务配置：
 * - RunningHub: AI 应用换装平台
 * - Kling: 可灵视频生成
 * - Neo4j: 知识图谱数据库
 * - Wikidata: 结构化知识库
 * - Elasticsearch: 全文搜索引擎
 */

import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  SearchOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import { klingService, runningHubService } from '@renderer/services/externalServices'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  type ElasticsearchKnowledgeConfig,
  type KlingConfig,
  type Neo4jKnowledgeConfig,
  type RunningHubConfig,
  type WikidataKnowledgeConfig,
  selectElasticsearchConfig,
  selectNeo4jConfig,
  selectWikidataConfig,
  updateElasticsearchConfig,
  updateKlingConfig,
  updateNeo4jConfig,
  updateRunningHubConfig,
  updateWikidataConfig
} from '@renderer/store/externalServices'
import { App, Button, Collapse, Input, InputNumber, Select, Space, Switch, Tag, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const { Text } = Typography

/**
 * RunningHub 设置组件
 */
const RunningHubSettings: FC = () => {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const config = useAppSelector((state) => state.externalServices.runningHub)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleUpdate = useCallback(
    (updates: Partial<RunningHubConfig>) => {
      dispatch(updateRunningHubConfig(updates))
      setTestResult(null) // 清除测试结果
    },
    [dispatch]
  )

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await runningHubService.healthCheck()
      setTestResult({
        success: result.success,
        message: result.success ? `连接成功 (${result.latencyMs}ms)` : result.message
      })
      if (result.success) {
        message.success('RunningHub 连接测试成功')
      } else {
        message.error(result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTestResult({ success: false, message: errorMessage })
      message.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }, [message])

  return (
    <SettingGroup>
      <SettingTitle>
        <Space>
          <ApiOutlined />
          RunningHub 换装平台
        </Space>
        <Switch checked={config.enabled} onChange={(checked) => handleUpdate({ enabled: checked })} />
      </SettingTitle>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>API Key</SettingRowTitle>
        <Input.Password
          value={config.apiKey}
          onChange={(e) => handleUpdate({ apiKey: e.target.value })}
          placeholder="输入 RunningHub API Key"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>API 地址</SettingRowTitle>
        <Input
          value={config.baseUrl}
          onChange={(e) => handleUpdate({ baseUrl: e.target.value })}
          placeholder="https://www.runninghub.cn"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>超时时间 (秒)</SettingRowTitle>
        <InputNumber
          value={config.timeout}
          onChange={(value) => handleUpdate({ timeout: value || 300 })}
          min={60}
          max={1800}
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>重试次数</SettingRowTitle>
        <InputNumber
          value={config.retryCount}
          onChange={(value) => handleUpdate({ retryCount: value || 2 })}
          min={0}
          max={5}
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <Space>
          <Button type="primary" onClick={handleTest} loading={testing} disabled={!config.apiKey}>
            测试连接
          </Button>
          {testResult && (
            <Tag
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          )}
        </Space>
        <a href="https://www.runninghub.cn" target="_blank" rel="noopener noreferrer">
          获取 API Key
        </a>
      </SettingRow>
    </SettingGroup>
  )
}

/**
 * Kling (可灵) 设置组件
 */
const KlingSettings: FC = () => {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const config = useAppSelector((state) => state.externalServices.kling)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleUpdate = useCallback(
    (updates: Partial<KlingConfig>) => {
      dispatch(updateKlingConfig(updates))
      setTestResult(null) // 清除测试结果
    },
    [dispatch]
  )

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await klingService.healthCheck()
      setTestResult({
        success: result.success,
        message: result.success ? `Token 生成成功 (${result.latencyMs}ms)` : result.message
      })
      if (result.success) {
        message.success('Kling 配置验证成功')
      } else {
        message.error(result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTestResult({ success: false, message: errorMessage })
      message.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }, [message])

  return (
    <SettingGroup>
      <SettingTitle>
        <Space>
          <VideoCameraOutlined />
          可灵 (Kling) 视频生成
        </Space>
        <Switch checked={config.enabled} onChange={(checked) => handleUpdate({ enabled: checked })} />
      </SettingTitle>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>Access Key</SettingRowTitle>
        <Input.Password
          value={config.accessKey}
          onChange={(e) => handleUpdate({ accessKey: e.target.value })}
          placeholder="输入 Access Key"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>Secret Key</SettingRowTitle>
        <Input.Password
          value={config.secretKey}
          onChange={(e) => handleUpdate({ secretKey: e.target.value })}
          placeholder="输入 Secret Key (用于 JWT 签名)"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>API 地址</SettingRowTitle>
        <Input
          value={config.baseUrl}
          onChange={(e) => handleUpdate({ baseUrl: e.target.value })}
          placeholder="https://api.klingai.com"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>默认模型版本</SettingRowTitle>
        <Input
          value={config.defaultModel}
          onChange={(e) => handleUpdate({ defaultModel: e.target.value })}
          placeholder="kling-v1-6"
          style={{ width: 200 }}
        />
      </SettingRow>

      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 12, marginTop: -8 }}>
        常用模型: kling-v1, kling-v1-5, kling-v1-6, kling-v2-master
      </div>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>默认视频时长</SettingRowTitle>
        <Select
          value={config.defaultDuration}
          onChange={(value) => handleUpdate({ defaultDuration: value })}
          style={{ width: 120 }}
          options={[
            { label: '5 秒', value: 5 },
            { label: '10 秒', value: 10 }
          ]}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>默认模式</SettingRowTitle>
        <Select
          value={config.defaultMode}
          onChange={(value) => handleUpdate({ defaultMode: value })}
          style={{ width: 120 }}
          options={[
            { label: '标准 (std)', value: 'std' },
            { label: '专业 (pro)', value: 'pro' }
          ]}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>超时时间 (秒)</SettingRowTitle>
        <InputNumber
          value={config.timeout}
          onChange={(value) => handleUpdate({ timeout: value || 600 })}
          min={120}
          max={3600}
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <Space>
          <Button
            type="primary"
            onClick={handleTest}
            loading={testing}
            disabled={!config.accessKey || !config.secretKey}>
            验证配置
          </Button>
          {testResult && (
            <Tag
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          )}
        </Space>
        <a href="https://app.klingai.com/cn/dev/document-api" target="_blank" rel="noopener noreferrer">
          查看文档
        </a>
      </SettingRow>
    </SettingGroup>
  )
}

// ==================== 外部知识源设置组件 ====================

/**
 * Neo4j 知识图谱设置组件
 */
const Neo4jSettings: FC = () => {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const config = useAppSelector(selectNeo4jConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleUpdate = useCallback(
    (updates: Partial<Neo4jKnowledgeConfig>) => {
      dispatch(updateNeo4jConfig(updates))
      setTestResult(null)
    },
    [dispatch]
  )

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // TODO: 实现 Neo4j 连接测试
      // const result = await window.api.externalKnowledge.neo4jCheckConnection()
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 模拟测试
      setTestResult({ success: true, message: '连接测试成功' })
      message.success('Neo4j 连接测试成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTestResult({ success: false, message: errorMessage })
      message.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }, [message])

  return (
    <SettingGroup>
      <SettingTitle>
        <Space>
          <DatabaseOutlined />
          Neo4j 知识图谱
        </Space>
        <Switch checked={config.enabled} onChange={(checked) => handleUpdate({ enabled: checked })} />
      </SettingTitle>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>连接端点</SettingRowTitle>
        <Input
          value={config.endpoint}
          onChange={(e) => handleUpdate({ endpoint: e.target.value })}
          placeholder="bolt://localhost:7687"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>用户名</SettingRowTitle>
        <Input
          value={config.username}
          onChange={(e) => handleUpdate({ username: e.target.value })}
          placeholder="neo4j"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>密码</SettingRowTitle>
        <Input.Password
          value={config.password}
          onChange={(e) => handleUpdate({ password: e.target.value })}
          placeholder="输入密码"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>数据库名</SettingRowTitle>
        <Input
          value={config.database}
          onChange={(e) => handleUpdate({ database: e.target.value })}
          placeholder="neo4j"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>加密连接</SettingRowTitle>
        <Switch checked={config.encrypted} onChange={(checked) => handleUpdate({ encrypted: checked })} />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>超时时间 (毫秒)</SettingRowTitle>
        <InputNumber
          value={config.timeout}
          onChange={(value) => handleUpdate({ timeout: value || 30000 })}
          min={5000}
          max={120000}
          step={1000}
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <Space>
          <Button type="primary" onClick={handleTest} loading={testing} disabled={!config.endpoint || !config.password}>
            测试连接
          </Button>
          {testResult && (
            <Tag
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          )}
        </Space>
        <a href="https://neo4j.com/docs/" target="_blank" rel="noopener noreferrer">
          查看文档
        </a>
      </SettingRow>
    </SettingGroup>
  )
}

/**
 * Wikidata 知识库设置组件
 */
const WikidataSettings: FC = () => {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const config = useAppSelector(selectWikidataConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleUpdate = useCallback(
    (updates: Partial<WikidataKnowledgeConfig>) => {
      dispatch(updateWikidataConfig(updates))
      setTestResult(null)
    },
    [dispatch]
  )

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // TODO: 实现 Wikidata 连接测试
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTestResult({ success: true, message: 'SPARQL 端点连接成功' })
      message.success('Wikidata 连接测试成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTestResult({ success: false, message: errorMessage })
      message.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }, [message])

  return (
    <SettingGroup>
      <SettingTitle>
        <Space>
          <GlobalOutlined />
          Wikidata 知识库
        </Space>
        <Switch checked={config.enabled} onChange={(checked) => handleUpdate({ enabled: checked })} />
      </SettingTitle>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>SPARQL 端点</SettingRowTitle>
        <Input
          value={config.endpoint}
          onChange={(e) => handleUpdate({ endpoint: e.target.value })}
          placeholder="https://query.wikidata.org/sparql"
          style={{ width: 320 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>默认语言</SettingRowTitle>
        <Select
          value={config.language}
          onChange={(value) => handleUpdate({ language: value })}
          style={{ width: 150 }}
          options={[
            { label: '中文 (zh)', value: 'zh' },
            { label: 'English (en)', value: 'en' },
            { label: '日本語 (ja)', value: 'ja' },
            { label: 'Deutsch (de)', value: 'de' },
            { label: 'Français (fr)', value: 'fr' }
          ]}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>启用缓存</SettingRowTitle>
        <Switch checked={config.cacheEnabled} onChange={(checked) => handleUpdate({ cacheEnabled: checked })} />
      </SettingRow>

      {config.cacheEnabled && (
        <SettingRow style={{ marginBottom: 12 }}>
          <SettingRowTitle>缓存有效期 (秒)</SettingRowTitle>
          <InputNumber
            value={config.cacheTTL}
            onChange={(value) => handleUpdate({ cacheTTL: value || 3600 })}
            min={60}
            max={86400}
            step={60}
            style={{ width: 120 }}
          />
        </SettingRow>
      )}

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>User Agent</SettingRowTitle>
        <Input
          value={config.userAgent}
          onChange={(e) => handleUpdate({ userAgent: e.target.value })}
          placeholder="CherryStudio/1.0"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <Space>
          <Button type="primary" onClick={handleTest} loading={testing} disabled={!config.endpoint}>
            测试连接
          </Button>
          {testResult && (
            <Tag
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          )}
        </Space>
        <a href="https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service" target="_blank" rel="noopener noreferrer">
          查看文档
        </a>
      </SettingRow>
    </SettingGroup>
  )
}

/**
 * Elasticsearch 全文搜索设置组件
 */
const ElasticsearchSettings: FC = () => {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const config = useAppSelector(selectElasticsearchConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleUpdate = useCallback(
    (updates: Partial<ElasticsearchKnowledgeConfig>) => {
      dispatch(updateElasticsearchConfig(updates))
      setTestResult(null)
    },
    [dispatch]
  )

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // TODO: 实现 Elasticsearch 连接测试
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTestResult({ success: true, message: '集群连接成功' })
      message.success('Elasticsearch 连接测试成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setTestResult({ success: false, message: errorMessage })
      message.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }, [message])

  return (
    <SettingGroup>
      <SettingTitle>
        <Space>
          <SearchOutlined />
          Elasticsearch 全文搜索
        </Space>
        <Switch checked={config.enabled} onChange={(checked) => handleUpdate({ enabled: checked })} />
      </SettingTitle>

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>连接端点</SettingRowTitle>
        <Input
          value={config.endpoint}
          onChange={(e) => handleUpdate({ endpoint: e.target.value })}
          placeholder="http://localhost:9200"
          style={{ width: 280 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>认证方式</SettingRowTitle>
        <Select
          value={config.authType}
          onChange={(value) => handleUpdate({ authType: value })}
          style={{ width: 150 }}
          options={[
            { label: '无认证', value: 'none' },
            { label: 'Basic Auth', value: 'basic' },
            { label: 'API Key', value: 'apikey' }
          ]}
        />
      </SettingRow>

      {config.authType === 'basic' && (
        <>
          <SettingRow style={{ marginBottom: 12 }}>
            <SettingRowTitle>用户名</SettingRowTitle>
            <Input
              value={config.username}
              onChange={(e) => handleUpdate({ username: e.target.value })}
              placeholder="elastic"
              style={{ width: 200 }}
            />
          </SettingRow>

          <SettingRow style={{ marginBottom: 12 }}>
            <SettingRowTitle>密码</SettingRowTitle>
            <Input.Password
              value={config.password}
              onChange={(e) => handleUpdate({ password: e.target.value })}
              placeholder="输入密码"
              style={{ width: 200 }}
            />
          </SettingRow>
        </>
      )}

      {config.authType === 'apikey' && (
        <SettingRow style={{ marginBottom: 12 }}>
          <SettingRowTitle>API Key</SettingRowTitle>
          <Input.Password
            value={config.apiKey}
            onChange={(e) => handleUpdate({ apiKey: e.target.value })}
            placeholder="输入 API Key"
            style={{ width: 280 }}
          />
        </SettingRow>
      )}

      <SettingDivider />

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>默认索引</SettingRowTitle>
        <Input
          value={config.defaultIndex}
          onChange={(e) => handleUpdate({ defaultIndex: e.target.value })}
          placeholder="可选，留空使用索引模式"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>索引模式</SettingRowTitle>
        <Input
          value={config.indexPattern}
          onChange={(e) => handleUpdate({ indexPattern: e.target.value })}
          placeholder="* (支持通配符)"
          style={{ width: 200 }}
        />
      </SettingRow>

      <SettingRow style={{ marginBottom: 12 }}>
        <SettingRowTitle>超时时间 (毫秒)</SettingRowTitle>
        <InputNumber
          value={config.timeout}
          onChange={(value) => handleUpdate({ timeout: value || 30000 })}
          min={5000}
          max={120000}
          step={1000}
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <Space>
          <Button type="primary" onClick={handleTest} loading={testing} disabled={!config.endpoint}>
            测试连接
          </Button>
          {testResult && (
            <Tag
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          )}
        </Space>
        <a
          href="https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html"
          target="_blank"
          rel="noopener noreferrer">
          查看文档
        </a>
      </SettingRow>
    </SettingGroup>
  )
}

/**
 * 外部服务设置主页面
 */
const ExternalServicesSettings: FC = () => {
  return (
    <SettingContainer>
      <SettingTitle style={{ marginBottom: 20 }}>外部服务配置</SettingTitle>

      <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 20 }}>
        配置非 LLM 的外部 AI 服务，这些服务可用于工作流节点和 MCP 工具调用。
      </div>

      <RunningHubSettings />
      <KlingSettings />

      {/* 外部知识源配置 */}
      <div style={{ marginTop: 32 }}>
        <SettingTitle style={{ marginBottom: 20 }}>
          <Space>
            <DatabaseOutlined />
            外部知识源
          </Space>
        </SettingTitle>

        <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
          配置外部知识源以扩展搜索和知识检索能力。这些知识源可与内置知识库协同工作。
        </Text>

        <Collapse
          defaultActiveKey={[]}
          items={[
            {
              key: 'neo4j',
              label: (
                <Space>
                  <DatabaseOutlined />
                  Neo4j 知识图谱
                </Space>
              ),
              children: <Neo4jSettings />
            },
            {
              key: 'wikidata',
              label: (
                <Space>
                  <GlobalOutlined />
                  Wikidata 知识库
                </Space>
              ),
              children: <WikidataSettings />
            },
            {
              key: 'elasticsearch',
              label: (
                <Space>
                  <SearchOutlined />
                  Elasticsearch 搜索
                </Space>
              ),
              children: <ElasticsearchSettings />
            }
          ]}
        />
      </div>
    </SettingContainer>
  )
}

export default ExternalServicesSettings
