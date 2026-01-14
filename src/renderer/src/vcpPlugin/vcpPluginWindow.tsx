/**
 * VCP 插件管理独立窗口
 *
 * 提供 VCP 插件的完整管理界面
 * 支持 VCP + MCP 双协议
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons'
import i18n from '@renderer/i18n'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Divider,
  Empty,
  Input,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  theme,
  Tooltip,
  Typography
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const { Text, Paragraph } = Typography

// 插件信息类型
interface PluginInfo {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  type: string
  enabled: boolean
  distributed?: boolean
  serverEndpoint?: string
  protocol?: 'vcp' | 'mcp' | 'hybrid'
  source?: 'vcp' | 'mcp' | 'distributed'
}

// 插件类型颜色映射
const PLUGIN_TYPE_COLORS: Record<string, string> = {
  static: 'blue',
  synchronous: 'green',
  asynchronous: 'orange',
  messagePreprocessor: 'purple',
  service: 'cyan',
  hybridservice: 'magenta'
}

// 协议颜色映射
const PROTOCOL_COLORS: Record<string, string> = {
  vcp: 'green',
  mcp: 'blue',
  hybrid: 'purple'
}

const VCPPluginWindowApp = () => {
  const [loading, setLoading] = useState(false)
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'vcp' | 'mcp' | 'distributed'>('all')
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)

  // 加载插件列表
  const loadPlugins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 优先使用统一插件管理器
      const result = await window.api.vcpUnified.getAllPlugins()
      if (result.success && result.data) {
        setPlugins(
          result.data.map((p: any) => ({
            ...p,
            type: p.vcpType || 'unknown'
          }))
        )
      } else {
        // 回退到 VCP 插件管理器
        const vcpResult = await window.api.vcpPlugin.list()
        if (vcpResult.success && vcpResult.data) {
          setPlugins(
            vcpResult.data.map((p: any) => ({
              ...p,
              protocol: 'vcp' as const,
              source: p.distributed ? 'distributed' : 'vcp'
            }))
          )
        } else {
          setError(vcpResult.error || i18n.t('vcp.plugin.load_error'))
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化
  useEffect(() => {
    // 初始化统一插件管理器
    window.api.vcpUnified.initialize().then(() => loadPlugins())

    // 监听语言变化
    const setLangHandler = (_: any, data: { lang: string }) => {
      i18n.changeLanguage(data.lang)
    }

    // 监听主题变化
    const setThemeHandler = (_: any, data: { isDark: boolean }) => {
      setIsDark(data.isDark)
    }

    const removeLangHandler = window.electron.ipcRenderer.on('set-language', setLangHandler)
    const removeThemeHandler = window.electron.ipcRenderer.on('set-theme', setThemeHandler)

    return () => {
      removeLangHandler()
      removeThemeHandler()
    }
  }, [loadPlugins])

  // 切换插件启用状态
  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      const result = enabled
        ? await window.api.vcpPlugin.enable(pluginId)
        : await window.api.vcpPlugin.disable(pluginId)

      if (result.success) {
        setPlugins((prev) => prev.map((p) => (p.id === pluginId ? { ...p, enabled } : p)))
      } else {
        setError(result.error || i18n.t('vcp.plugin.toggle_error'))
      }
    } catch (err) {
      setError(String(err))
    }
  }

  // 测试执行插件
  const testPlugin = async (plugin: PluginInfo) => {
    try {
      const result = await window.api.vcpTool.execute(plugin.name, {})
      if (result.success) {
        alert(i18n.t('vcp.plugin.test_success', { time: result.executionTimeMs || 0 }))
      } else {
        alert(result.error || i18n.t('vcp.plugin.test_error'))
      }
    } catch (err) {
      alert(String(err))
    }
  }

  // 过滤插件
  const filteredPlugins = plugins.filter((p) => {
    // 搜索过滤
    if (searchText) {
      const search = searchText.toLowerCase()
      if (
        !p.name.toLowerCase().includes(search) &&
        !p.displayName.toLowerCase().includes(search) &&
        !p.description.toLowerCase().includes(search)
      ) {
        return false
      }
    }

    // 标签页过滤
    if (activeTab === 'vcp' && p.protocol !== 'vcp') return false
    if (activeTab === 'mcp' && p.protocol !== 'mcp') return false
    if (activeTab === 'distributed' && p.source !== 'distributed') return false

    return true
  })

  // 渲染插件卡片
  const renderPluginCard = (plugin: PluginInfo) => (
    <Card key={plugin.id} size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <Text strong>{plugin.displayName}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            v{plugin.version}
          </Text>
        </div>
        <Space>
          <Tag color={PLUGIN_TYPE_COLORS[plugin.type] || 'default'}>{plugin.type}</Tag>
          {plugin.protocol && <Tag color={PROTOCOL_COLORS[plugin.protocol]}>{plugin.protocol.toUpperCase()}</Tag>}
          {plugin.distributed && (
            <Tooltip title={plugin.serverEndpoint}>
              <Tag icon={<CloudServerOutlined />} color="volcano">
                {i18n.t('vcp.plugin.distributed')}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </div>

      <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 12 }}>
        {plugin.description || i18n.t('vcp.plugin.no_description')}
      </Paragraph>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Tooltip title={i18n.t('vcp.plugin.test_tooltip')}>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => testPlugin(plugin)}
              disabled={!plugin.enabled}>
              {i18n.t('vcp.plugin.test')}
            </Button>
          </Tooltip>
          <Tooltip title={i18n.t('vcp.plugin.info_tooltip')}>
            <Button size="small" icon={<InfoCircleOutlined />} />
          </Tooltip>
        </Space>
        <Switch
          checked={plugin.enabled}
          onChange={(checked) => togglePlugin(plugin.id, checked)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      </div>
    </Card>
  )

  // 标签页项目
  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          {i18n.t('vcp.plugin.tab_all')}
          <Badge count={plugins.length} style={{ marginLeft: 8 }} />
        </span>
      )
    },
    {
      key: 'vcp',
      label: (
        <span>
          VCP
          <Badge count={plugins.filter((p) => p.protocol === 'vcp').length} style={{ marginLeft: 8 }} />
        </span>
      )
    },
    {
      key: 'mcp',
      label: (
        <span>
          MCP
          <Badge count={plugins.filter((p) => p.protocol === 'mcp').length} style={{ marginLeft: 8 }} />
        </span>
      )
    },
    {
      key: 'distributed',
      label: (
        <span>
          {i18n.t('vcp.plugin.tab_distributed')}
          <Badge count={plugins.filter((p) => p.source === 'distributed').length} style={{ marginLeft: 8 }} />
        </span>
      )
    }
  ]

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm
      }}>
      <div
        style={{
          padding: 20,
          height: '100vh',
          overflow: 'auto',
          background: isDark ? '#141414' : '#fff'
        }}>
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <SettingOutlined style={{ marginRight: 8, fontSize: 20 }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {i18n.t('vcp.plugin.title')}
            </Typography.Title>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadPlugins} loading={loading}>
            {i18n.t('vcp.plugin.refresh')}
          </Button>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder={i18n.t('vcp.plugin.search_placeholder')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text type="secondary">{i18n.t('vcp.plugin.total')}: </Text>
              <Text strong>{plugins.length}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text type="secondary">{i18n.t('vcp.plugin.enabled')}: </Text>
              <Text strong style={{ color: '#52c41a' }}>
                {plugins.filter((p) => p.enabled).length}
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text type="secondary">{i18n.t('vcp.plugin.disabled')}: </Text>
              <Text strong style={{ color: '#faad14' }}>
                {plugins.filter((p) => !p.enabled).length}
              </Text>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
        )}

        {/* 标签页 */}
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as typeof activeTab)} items={tabItems} />

        {/* 插件列表 */}
        <div style={{ minHeight: 300 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <Spin tip={i18n.t('vcp.plugin.loading')} />
            </div>
          ) : filteredPlugins.length > 0 ? (
            filteredPlugins.map(renderPluginCard)
          ) : (
            <Empty
              description={searchText ? i18n.t('vcp.plugin.no_search_results') : i18n.t('vcp.plugin.no_plugins')}
            />
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<VCPPluginWindowApp />)
