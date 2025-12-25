/**
 * 外部服务设置页面
 *
 * 管理非 LLM 的外部服务配置：
 * - RunningHub: AI 应用换装平台
 * - Kling: 可灵视频生成
 */

import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { klingService, runningHubService } from '@renderer/services/externalServices'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  type KlingConfig,
  type RunningHubConfig,
  updateKlingConfig,
  updateRunningHubConfig
} from '@renderer/store/externalServices'
import { Button, Input, InputNumber, message, Select, Space, Switch, Tag } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

/**
 * RunningHub 设置组件
 */
const RunningHubSettings: FC = () => {
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
  }, [])

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
  }, [])

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
    </SettingContainer>
  )
}

export default ExternalServicesSettings
