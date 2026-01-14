/**
 * VCP 插件管理悬浮窗
 *
 * 提供 VCP 插件的查看、启用/禁用、执行测试等功能
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
import { TopView } from '@renderer/components/TopView'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Text, Paragraph } = Typography
const { TabPane } = Tabs

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

interface VCPPluginPopupContainerProps {
  resolve: (data: unknown) => void
}

const VCPPluginPopupContainer: FC<VCPPluginPopupContainerProps> = ({ resolve }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'vcp' | 'mcp' | 'distributed'>('all')
  const [error, setError] = useState<string | null>(null)

  // 加载插件列表
  const loadPlugins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 优先使用统一插件管理器
      const result = await window.api.vcpUnified.getAllPlugins()
      if (result.success && result.data) {
        setPlugins(
          result.data.map((p) => ({
            ...p,
            type: p.vcpType || 'unknown'
          }))
        )
      } else {
        // 回退到 VCP 插件管理器
        const vcpResult = await window.api.vcpPlugin.list()
        if (vcpResult.success && vcpResult.data) {
          setPlugins(
            vcpResult.data.map((p) => ({
              ...p,
              protocol: 'vcp' as const,
              source: p.distributed ? 'distributed' : 'vcp'
            }))
          )
        } else {
          setError(vcpResult.error || t('vcp.plugin.load_error'))
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [t])

  // 初始化
  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  // 切换插件启用状态
  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      const result = enabled
        ? await window.api.vcpPlugin.enable(pluginId)
        : await window.api.vcpPlugin.disable(pluginId)

      if (result.success) {
        setPlugins((prev) => prev.map((p) => (p.id === pluginId ? { ...p, enabled } : p)))
        window.toast?.success(enabled ? t('vcp.plugin.enabled_success') : t('vcp.plugin.disabled_success'))
      } else {
        window.toast?.error(result.error || t('vcp.plugin.toggle_error'))
      }
    } catch (err) {
      window.toast?.error(String(err))
    }
  }

  // 测试执行插件
  const testPlugin = async (plugin: PluginInfo) => {
    try {
      window.toast?.info(t('vcp.plugin.testing', { name: plugin.displayName }))
      const result = await window.api.vcpTool.execute(plugin.name, {})

      if (result.success) {
        window.toast?.success(t('vcp.plugin.test_success', { time: result.executionTimeMs || 0 }))
      } else {
        window.toast?.error(result.error || t('vcp.plugin.test_error'))
      }
    } catch (err) {
      window.toast?.error(String(err))
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

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve({})
  }

  // 渲染插件卡片
  const renderPluginCard = (plugin: PluginInfo) => (
    <PluginCard key={plugin.id}>
      <PluginHeader>
        <PluginTitle>
          <Text strong>{plugin.displayName}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            v{plugin.version}
          </Text>
        </PluginTitle>
        <Space>
          <Tag color={PLUGIN_TYPE_COLORS[plugin.type] || 'default'}>{plugin.type}</Tag>
          {plugin.protocol && <Tag color={PROTOCOL_COLORS[plugin.protocol]}>{plugin.protocol.toUpperCase()}</Tag>}
          {plugin.distributed && (
            <Tooltip title={plugin.serverEndpoint}>
              <Tag icon={<CloudServerOutlined />} color="volcano">
                {t('vcp.plugin.distributed')}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </PluginHeader>

      <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 12 }}>
        {plugin.description || t('vcp.plugin.no_description')}
      </Paragraph>

      <PluginFooter>
        <Space>
          <Tooltip title={t('vcp.plugin.test_tooltip')}>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => testPlugin(plugin)}
              disabled={!plugin.enabled}>
              {t('vcp.plugin.test')}
            </Button>
          </Tooltip>
          <Tooltip title={t('vcp.plugin.info_tooltip')}>
            <Button size="small" icon={<InfoCircleOutlined />} />
          </Tooltip>
        </Space>
        <Switch
          checked={plugin.enabled}
          onChange={(checked) => togglePlugin(plugin.id, checked)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      </PluginFooter>
    </PluginCard>
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      title={
        <ModalHeader>
          <SettingOutlined style={{ marginRight: 8 }} />
          {t('vcp.plugin.title')}
        </ModalHeader>
      }
      width={720}
      footer={null}
      centered
      transitionName="animation-move-down">
      <ModalContent>
        {/* 工具栏 */}
        <Toolbar>
          <Input
            placeholder={t('vcp.plugin.search_placeholder')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadPlugins} loading={loading}>
            {t('vcp.plugin.refresh')}
          </Button>
        </Toolbar>

        {/* 错误提示 */}
        {error && (
          <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
        )}

        {/* 标签页 */}
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as typeof activeTab)}>
          <TabPane
            tab={
              <span>
                {t('vcp.plugin.tab_all')}
                <Badge count={plugins.length} style={{ marginLeft: 8 }} />
              </span>
            }
            key="all"
          />
          <TabPane
            tab={
              <span>
                VCP
                <Badge count={plugins.filter((p) => p.protocol === 'vcp').length} style={{ marginLeft: 8 }} />
              </span>
            }
            key="vcp"
          />
          <TabPane
            tab={
              <span>
                MCP
                <Badge count={plugins.filter((p) => p.protocol === 'mcp').length} style={{ marginLeft: 8 }} />
              </span>
            }
            key="mcp"
          />
          <TabPane
            tab={
              <span>
                {t('vcp.plugin.tab_distributed')}
                <Badge count={plugins.filter((p) => p.source === 'distributed').length} style={{ marginLeft: 8 }} />
              </span>
            }
            key="distributed"
          />
        </Tabs>

        {/* 插件列表 */}
        <PluginList>
          {loading ? (
            <LoadingContainer>
              <Spin tip={t('vcp.plugin.loading')} />
            </LoadingContainer>
          ) : filteredPlugins.length > 0 ? (
            filteredPlugins.map(renderPluginCard)
          ) : (
            <Empty description={searchText ? t('vcp.plugin.no_search_results') : t('vcp.plugin.no_plugins')} />
          )}
        </PluginList>

        {/* 统计信息 */}
        <Divider style={{ margin: '16px 0' }} />
        <Statistics>
          <StatItem>
            <Text type="secondary">{t('vcp.plugin.total')}: </Text>
            <Text strong>{plugins.length}</Text>
          </StatItem>
          <StatItem>
            <Text type="secondary">{t('vcp.plugin.enabled')}: </Text>
            <Text strong style={{ color: 'var(--color-success)' }}>
              {plugins.filter((p) => p.enabled).length}
            </Text>
          </StatItem>
          <StatItem>
            <Text type="secondary">{t('vcp.plugin.disabled')}: </Text>
            <Text strong style={{ color: 'var(--color-warning)' }}>
              {plugins.filter((p) => !p.enabled).length}
            </Text>
          </StatItem>
        </Statistics>
      </ModalContent>
    </Modal>
  )
}

// Styled Components
const ModalHeader = styled.div`
  display: flex;
  align-items: center;
`

const ModalContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const PluginList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
`

const PluginCard = styled(Card)`
  .ant-card-body {
    padding: 16px;
  }
`

const PluginHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const PluginTitle = styled.div`
  display: flex;
  align-items: baseline;
`

const PluginFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const Statistics = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
`

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

// 静态方法
const TopViewKey = 'VCPPluginPopup'

export default class VCPPluginPopup {
  static hide() {
    TopView.hide(TopViewKey)
  }

  static show() {
    return new Promise<unknown>((resolve) => {
      TopView.show(
        <VCPPluginPopupContainer
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
