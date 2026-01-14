/**
 * 统一插件视图 - MCP + VCP 融合展示
 *
 * 在同一视图中统一展示：
 * - MCP 服务器
 * - VCP 插件
 * - MCP 桥接插件
 *
 * 配置更改实时同步到后端
 */

import {
  CheckOutlined,
  CloudServerOutlined,
  CloudSyncOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import type { MCPServer } from '@renderer/types'
import { Button, Empty, Input, Popover, Select, Spin, Switch, Tag, Tooltip } from 'antd'
import { Box, Puzzle, Server } from 'lucide-react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import styled from 'styled-components'

import { SettingTitle } from '..'
import PluginConfigEditor from './PluginConfigEditor'

// 统一插件项
interface UnifiedPlugin {
  id: string
  name: string
  displayName: string
  description: string
  source: 'mcp' | 'vcp' | 'mcp_bridge'
  type: string
  enabled: boolean
  isActive?: boolean
  version?: string
  serverId?: string
  category?: string
  requiresConfig?: boolean
  serverEndpoint?: string
  tags?: string[]
}

// 类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  stdio: 'blue',
  sse: 'orange',
  inMemory: 'green',
  static: 'cyan',
  synchronous: 'purple',
  asynchronous: 'magenta',
  service: 'geekblue',
  hybridservice: 'geekblue',
  mcp_bridge: 'volcano'
}

// 来源颜色映射
const SOURCE_COLORS: Record<string, string> = {
  mcp: '#1890ff',
  vcp: '#722ed1',
  mcp_bridge: '#fa541c'
}

const UnifiedPluginView: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mcpServers, setMCPServerActive } = useMCPServers()

  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [vcpPlugins, setVcpPlugins] = useState<UnifiedPlugin[]>([])
  const [searchText, setSearchText] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [syncStatus, setSyncStatus] = useState<{ needsSync: boolean; syncedCount: number }>({
    needsSync: false,
    syncedCount: 0
  })

  // 配置编辑器状态
  const [configEditorVisible, setConfigEditorVisible] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<UnifiedPlugin | null>(null)

  // 加载 VCP 插件
  const loadVCPPlugins = useCallback(async () => {
    try {
      const result = await window.api.vcpPlugin?.list()
      if (result?.success && result.data) {
        const plugins: UnifiedPlugin[] = result.data.map((p: any) => ({
          id: `vcp:${p.name}`,
          name: p.name,
          displayName: p.displayName || p.name,
          description: p.description || '',
          source: p.type === 'mcp_bridge' ? 'mcp_bridge' : 'vcp',
          type: p.type,
          enabled: p.enabled,
          version: p.version,
          category: p.category,
          requiresConfig: p.requiresConfig,
          serverEndpoint: p.serverEndpoint,
          tags: p.tags
        }))
        setVcpPlugins(plugins)
      }
    } catch (error) {
      console.error('Failed to load VCP plugins:', error)
    }
  }, [])

  // 检查同步状态
  const checkSyncStatus = useCallback(async () => {
    try {
      const result = await window.api.vcpPlugin?.getSyncStatus()
      if (result?.success && result.data) {
        setSyncStatus({
          needsSync: result.data.needsSync,
          syncedCount: result.data.syncedCount
        })
      }
    } catch (error) {
      console.error('Failed to check sync status:', error)
    }
  }, [])

  // 执行同步
  const handleSync = useCallback(
    async (forceSync = false) => {
      setSyncing(true)
      try {
        const result = await window.api.vcpPlugin?.sync(forceSync)
        if (result?.success) {
          const { syncedCount, errorCount } = result.data || {}
          if (syncedCount && syncedCount > 0) {
            window.toast.success(t('settings.mcp.sync_success', { count: syncedCount }))
            // 重新加载插件列表
            await loadVCPPlugins()
          } else if (errorCount && errorCount > 0) {
            window.toast.warning(t('settings.mcp.sync_partial', { errorCount }))
          } else {
            window.toast.info(t('settings.mcp.sync_no_change', '插件已是最新'))
          }
          // 更新同步状态
          await checkSyncStatus()
        } else {
          window.toast.error(result?.error || t('settings.mcp.sync_failed', '同步失败'))
        }
      } catch (error) {
        console.error('Failed to sync plugins:', error)
        window.toast.error(String(error))
      } finally {
        setSyncing(false)
      }
    },
    [t, loadVCPPlugins, checkSyncStatus]
  )

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await window.api.vcpPlugin?.initialize()
      await checkSyncStatus()
      await loadVCPPlugins()
      setLoading(false)
    }
    init()
  }, [loadVCPPlugins, checkSyncStatus])

  // 转换 MCP 服务器为统一格式
  const mcpPlugins = useMemo<UnifiedPlugin[]>(() => {
    return mcpServers.map((server: MCPServer) => ({
      id: `mcp:${server.id}`,
      name: server.name,
      displayName: server.name,
      description: server.description || '',
      source: 'mcp',
      type: server.type || 'stdio',
      enabled: true,
      isActive: server.isActive,
      serverId: server.id
    }))
  }, [mcpServers])

  // 合并所有插件（去重，防止重复 key 错误）
  const allPlugins = useMemo(() => {
    const merged = [...mcpPlugins, ...vcpPlugins]
    // 按 source-name 去重，保留第一个
    const seen = new Set<string>()
    return merged.filter((p) => {
      const key = `${p.source}-${p.name}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [mcpPlugins, vcpPlugins])

  // 过滤插件
  const filteredPlugins = useMemo(() => {
    let result = allPlugins

    // 来源过滤
    if (sourceFilter !== 'all') {
      result = result.filter((p) => p.source === sourceFilter)
    }

    // 搜索过滤
    if (searchText) {
      const s = searchText.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.displayName.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s)
      )
    }

    return result
  }, [allPlugins, sourceFilter, searchText])

  // 统计
  const stats = useMemo(
    () => ({
      total: allPlugins.length,
      mcp: allPlugins.filter((p) => p.source === 'mcp').length,
      vcp: allPlugins.filter((p) => p.source === 'vcp').length,
      mcpBridge: allPlugins.filter((p) => p.source === 'mcp_bridge').length,
      active: allPlugins.filter((p) => (p.source === 'mcp' ? p.isActive : p.enabled)).length
    }),
    [allPlugins]
  )

  // 切换 MCP 服务器状态 - 同步到后端
  const handleToggleMCP = async (serverId: string, currentActive: boolean) => {
    try {
      const server = mcpServers.find((s) => s.id === serverId)
      if (server) {
        setMCPServerActive(server, !currentActive)
        window.toast.success(currentActive ? t('settings.mcp.stopped') : t('settings.mcp.started'))
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 切换 VCP 插件状态 - 同步到后端
  const handleToggleVCP = async (pluginId: string, enabled: boolean) => {
    try {
      const result = enabled
        ? await window.api.vcpPlugin.enable(pluginId)
        : await window.api.vcpPlugin.disable(pluginId)

      if (result.success) {
        setVcpPlugins((prev) => prev.map((p) => (p.id === `vcp:${pluginId}` ? { ...p, enabled } : p)))
        window.toast.success(enabled ? t('vcp.plugin.enabled_success') : t('vcp.plugin.disabled_success'))
      } else {
        window.toast.error(result.error || t('vcp.plugin.toggle_error'))
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 点击插件卡片
  const handlePluginClick = (plugin: UnifiedPlugin) => {
    if (plugin.source === 'mcp' && plugin.serverId) {
      navigate(`/settings/mcp/settings/${plugin.serverId}`)
    }
  }

  // 打开配置编辑器
  const handleOpenConfig = (plugin: UnifiedPlugin) => {
    setSelectedPlugin(plugin)
    setConfigEditorVisible(true)
  }

  // 关闭配置编辑器
  const handleCloseConfig = () => {
    setConfigEditorVisible(false)
    setSelectedPlugin(null)
  }

  // 获取插件图标
  const getPluginIcon = (plugin: UnifiedPlugin) => {
    if (plugin.source === 'mcp') {
      return plugin.type === 'inMemory' ? <Box size={16} /> : <Server size={16} />
    }
    return <Puzzle size={16} />
  }

  // 来源过滤选项
  const sourceOptions = [
    { value: 'all', label: `全部 (${stats.total})` },
    { value: 'mcp', label: `MCP (${stats.mcp})` },
    { value: 'vcp', label: `VCP (${stats.vcp})` },
    { value: 'mcp_bridge', label: `桥接 (${stats.mcpBridge})` }
  ]

  if (loading) {
    return (
      <LoadingContainer>
        <Spin tip={t('common.loading')} />
      </LoadingContainer>
    )
  }

  return (
    <>
      <HeaderContainer>
        <SettingTitle style={{ gap: 3, marginBottom: 0 }}>
          {t('settings.mcp.unified_view', '统一插件视图')}
        </SettingTitle>
        <ToolBar>
          <Input
            placeholder={t('common.search')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select value={sourceFilter} onChange={setSourceFilter} options={sourceOptions} style={{ width: 140 }} />
          <Tooltip
            title={
              syncStatus.needsSync
                ? t('settings.mcp.sync_available', '有新插件可同步')
                : t('settings.mcp.sync_tooltip', '同步 VCPToolBox 插件')
            }>
            <Button
              icon={<CloudSyncOutlined spin={syncing} />}
              onClick={() => handleSync(false)}
              loading={syncing}
              type={syncStatus.needsSync ? 'primary' : 'default'}>
              {syncing ? t('settings.mcp.syncing', '同步中...') : t('settings.mcp.sync', '同步插件')}
            </Button>
          </Tooltip>
          <Button onClick={loadVCPPlugins}>{t('common.refresh')}</Button>
        </ToolBar>
      </HeaderContainer>

      <StatsBar>
        <StatItem>
          <StatDot style={{ background: '#1890ff' }} />
          <StatLabel>MCP:</StatLabel>
          <StatValue>{stats.mcp}</StatValue>
        </StatItem>
        <StatItem>
          <StatDot style={{ background: '#722ed1' }} />
          <StatLabel>VCP:</StatLabel>
          <StatValue>{stats.vcp}</StatValue>
        </StatItem>
        <StatItem>
          <StatDot style={{ background: '#fa541c' }} />
          <StatLabel>{t('settings.mcp.bridge', '桥接')}:</StatLabel>
          <StatValue>{stats.mcpBridge}</StatValue>
        </StatItem>
        <StatItem>
          <StatDot style={{ background: 'var(--color-success)' }} />
          <StatLabel>{t('common.active', '活跃')}:</StatLabel>
          <StatValue style={{ color: 'var(--color-success)' }}>{stats.active}</StatValue>
        </StatItem>
      </StatsBar>

      {filteredPlugins.length === 0 ? (
        <Empty description={searchText ? t('common.no_results') : t('common.no_data')} style={{ marginTop: 40 }} />
      ) : (
        <PluginsGrid>
          {filteredPlugins.map((plugin, index) => (
            <PluginCard
              key={`${plugin.source}-${plugin.id}-${index}`}
              onClick={() => handlePluginClick(plugin)}
              style={{ cursor: plugin.source === 'mcp' ? 'pointer' : 'default' }}>
              <PluginHeader>
                <IconWrapper source={plugin.source}>{getPluginIcon(plugin)}</IconWrapper>
                <PluginInfo>
                  <PluginName>
                    <PluginNameText>{plugin.displayName}</PluginNameText>
                    {plugin.version && <VersionTag>v{plugin.version}</VersionTag>}
                  </PluginName>
                  <PluginMeta>
                    <SourceBadge source={plugin.source}>
                      {plugin.source === 'mcp_bridge' ? 'MCP→VCP' : plugin.source.toUpperCase()}
                    </SourceBadge>
                  </PluginMeta>
                </PluginInfo>
                <StatusSwitch>
                  {plugin.source === 'mcp' ? (
                    <Switch
                      size="small"
                      checked={plugin.isActive}
                      onChange={(_, e) => {
                        e.stopPropagation()
                        handleToggleMCP(plugin.serverId!, plugin.isActive!)
                      }}
                    />
                  ) : (
                    <ActionButtons>
                      <Tooltip title={t('settings.mcp.plugin_config', '配置')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenConfig(plugin)
                          }}
                        />
                      </Tooltip>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          plugin.enabled ? (
                            <CheckOutlined style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <PlusOutlined />
                          )
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleVCP(plugin.name, !plugin.enabled)
                        }}
                      />
                    </ActionButtons>
                  )}
                </StatusSwitch>
              </PluginHeader>

              <Popover
                content={
                  <PopoverContent>
                    {plugin.description || t('common.no_description')}
                    {plugin.serverEndpoint && (
                      <ServerEndpoint>
                        <CloudServerOutlined /> {plugin.serverEndpoint}
                      </ServerEndpoint>
                    )}
                  </PopoverContent>
                }
                title={plugin.displayName}
                trigger="hover"
                placement="topLeft"
                overlayStyle={{ maxWidth: 400 }}>
                <PluginDescription>{plugin.description || t('common.no_description')}</PluginDescription>
              </Popover>

              <PluginFooter>
                <Tag color={TYPE_COLORS[plugin.type] || 'default'} style={{ borderRadius: 20, margin: 0 }}>
                  {plugin.type}
                </Tag>
                {plugin.category && (
                  <Tag color="geekblue" style={{ borderRadius: 20, margin: 0 }}>
                    {plugin.category}
                  </Tag>
                )}
                {plugin.requiresConfig && (
                  <Tag color="gold" style={{ borderRadius: 20, margin: 0 }}>
                    {t('vcp.plugin.requires_config', '需配置')}
                  </Tag>
                )}
              </PluginFooter>
            </PluginCard>
          ))}
        </PluginsGrid>
      )}

      {/* 插件配置编辑器 */}
      <PluginConfigEditor
        pluginId={selectedPlugin?.name || null}
        pluginName={selectedPlugin?.displayName}
        visible={configEditorVisible}
        onClose={handleCloseConfig}
        onConfigSaved={loadVCPPlugins}
      />
    </>
  )
}

// 样式组件
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`

const ToolBar = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`

const StatsBar = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const StatDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
`

const StatLabel = styled.span`
  color: var(--color-text-2);
  font-size: 13px;
`

const StatValue = styled.span`
  font-weight: 600;
  font-size: 14px;
`

const PluginsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`

const PluginCard = styled.div`
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--color-border);
  border-radius: var(--list-item-border-radius);
  padding: 12px 16px;
  transition: all 0.2s ease;
  background-color: var(--color-background);
  min-height: 130px;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
`

const PluginHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
`

const IconWrapper = styled.div<{ source: string }>`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => `${SOURCE_COLORS[p.source] || '#666'}15`};
  color: ${(p) => SOURCE_COLORS[p.source] || '#666'};
  flex-shrink: 0;
`

const PluginInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const PluginName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
`

const PluginNameText = styled.span`
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const VersionTag = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  background: var(--color-background-soft);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
`

const PluginMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const SourceBadge = styled.span<{ source: string }>`
  font-size: 10px;
  font-weight: 500;
  color: ${(p) => SOURCE_COLORS[p.source] || '#666'};
  background: ${(p) => `${SOURCE_COLORS[p.source] || '#666'}15`};
  padding: 1px 6px;
  border-radius: 4px;
`

const StatusSwitch = styled.div`
  flex-shrink: 0;
`

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`

const PluginDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  max-height: calc(1.4em * 2);
  cursor: pointer;
  margin-bottom: 10px;

  &:hover {
    color: var(--color-text-1);
  }
`

const PopoverContent = styled.div`
  max-width: 350px;
  line-height: 1.5;
  font-size: 14px;
  color: var(--color-text-1);
  white-space: pre-wrap;
  word-break: break-word;
`

const ServerEndpoint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  gap: 4px;
`

const PluginFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
`

export default UnifiedPluginView
