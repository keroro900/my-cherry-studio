/**
 * GlobalPluginSearch - 全局插件搜索组件
 *
 * 提供全局快捷键 (Ctrl+Shift+P / Cmd+Shift+P) 快速搜索和管理插件
 * 支持:
 * - MCP 服务器搜索
 * - VCP 插件搜索
 * - MCP 桥接插件搜索
 * - 快速启用/禁用
 * - 跳转到设置页面
 */

import { SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import type { MCPServer } from '@renderer/types'
import { Empty, Input, List, Modal, Spin, Switch, Tag, Tooltip } from 'antd'
import { Box, Puzzle, Server } from 'lucide-react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UNSAFE_NavigationContext } from 'react-router'
import { useContext } from 'react'
import styled from 'styled-components'

/**
 * Safe navigation hook that doesn't throw when outside Router context
 */
function useSafeNavigate() {
  const navContext = useContext(UNSAFE_NavigationContext)
  if (!navContext || !navContext.navigator) {
    return null
  }
  return navContext.navigator
}

// 统一插件项类型
interface UnifiedPlugin {
  id: string
  name: string
  displayName: string
  description: string
  source: 'mcp' | 'vcp' | 'mcp_bridge'
  type: string
  enabled: boolean
  isActive?: boolean
  serverId?: string
  category?: string
}

// 来源颜色映射
const SOURCE_COLORS: Record<string, string> = {
  mcp: '#1890ff',
  vcp: '#722ed1',
  mcp_bridge: '#fa541c'
}

// 类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  stdio: 'blue',
  sse: 'orange',
  inMemory: 'green',
  static: 'cyan',
  synchronous: 'purple',
  asynchronous: 'magenta',
  service: 'geekblue'
}

const GlobalPluginSearch: FC = () => {
  const { t } = useTranslation()
  const navigator = useSafeNavigate()
  const { mcpServers, setMCPServerActive } = useMCPServers()

  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [vcpPlugins, setVcpPlugins] = useState<UnifiedPlugin[]>([])

  // 注册全局快捷键
  useShortcut(
    'global_plugin_search',
    () => {
      setVisible(true)
    },
    {
      preventDefault: true,
      enableOnFormTags: true
    }
  )

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
          category: p.category
        }))
        setVcpPlugins(plugins)
      }
    } catch (error) {
      console.error('Failed to load VCP plugins:', error)
    }
  }, [])

  // 打开时加载数据
  useEffect(() => {
    if (visible) {
      setLoading(true)
      loadVCPPlugins().finally(() => setLoading(false))
      setSearchText('')
    }
  }, [visible, loadVCPPlugins])

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

  // 合并所有插件
  const allPlugins = useMemo(() => {
    const merged = [...mcpPlugins, ...vcpPlugins]
    // 按 source-name 去重
    const seen = new Set<string>()
    return merged.filter((p) => {
      const key = `${p.source}-${p.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [mcpPlugins, vcpPlugins])

  // 过滤插件
  const filteredPlugins = useMemo(() => {
    if (!searchText) return allPlugins

    const s = searchText.toLowerCase()
    return allPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.displayName.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s) ||
        p.source.toLowerCase().includes(s) ||
        p.type.toLowerCase().includes(s)
    )
  }, [allPlugins, searchText])

  // 切换 MCP 服务器状态
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

  // 切换 VCP 插件状态
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

  // 跳转到插件设置
  const handleGoToSettings = (plugin: UnifiedPlugin) => {
    setVisible(false)
    if (!navigator) {
      // Not in Router context, skip navigation
      window.toast?.warning?.('无法跳转：当前页面不支持导航')
      return
    }
    if (plugin.source === 'mcp' && plugin.serverId) {
      navigator.push(`/settings/mcp/settings/${plugin.serverId}`)
    } else {
      navigator.push('/settings/mcp')
    }
  }

  // 关闭弹窗
  const handleClose = () => {
    setVisible(false)
    setSearchText('')
  }

  // 获取插件图标
  const getPluginIcon = (plugin: UnifiedPlugin) => {
    if (plugin.source === 'mcp') {
      return plugin.type === 'inMemory' ? <Box size={16} /> : <Server size={16} />
    }
    return <Puzzle size={16} />
  }

  // 统计
  const stats = useMemo(
    () => ({
      total: allPlugins.length,
      mcp: allPlugins.filter((p) => p.source === 'mcp').length,
      vcp: allPlugins.filter((p) => p.source === 'vcp').length,
      mcpBridge: allPlugins.filter((p) => p.source === 'mcp_bridge').length
    }),
    [allPlugins]
  )

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      title={
        <ModalTitle>
          <SearchOutlined style={{ marginRight: 8 }} />
          {t('settings.mcp.global_search', 'Search Plugins')}
          <StatsContainer>
            <Tag color="blue">MCP: {stats.mcp}</Tag>
            <Tag color="purple">VCP: {stats.vcp}</Tag>
            <Tag color="volcano">Bridge: {stats.mcpBridge}</Tag>
          </StatsContainer>
        </ModalTitle>
      }
      footer={null}
      width={640}
      styles={{
        body: { padding: '12px 0' }
      }}
      centered
      destroyOnHidden>
      <SearchContainer>
        <Input
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          autoFocus
        />
      </SearchContainer>

      {loading ? (
        <LoadingContainer>
          <Spin />
        </LoadingContainer>
      ) : filteredPlugins.length === 0 ? (
        <Empty description={searchText ? t('common.no_results') : t('common.no_data')} style={{ margin: '40px 0' }} />
      ) : (
        <PluginList
          dataSource={filteredPlugins}
          renderItem={(plugin: UnifiedPlugin) => (
            <PluginItem key={plugin.id}>
              <PluginLeft>
                <IconWrapper source={plugin.source}>{getPluginIcon(plugin)}</IconWrapper>
                <PluginInfo>
                  <PluginName>{plugin.displayName}</PluginName>
                  <PluginMeta>
                    <SourceBadge source={plugin.source}>
                      {plugin.source === 'mcp_bridge' ? 'MCP→VCP' : plugin.source.toUpperCase()}
                    </SourceBadge>
                    <Tag color={TYPE_COLORS[plugin.type] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                      {plugin.type}
                    </Tag>
                  </PluginMeta>
                </PluginInfo>
              </PluginLeft>

              <PluginRight>
                <Tooltip title={t('settings.mcp.plugin_config', 'Settings')}>
                  <SettingButton onClick={() => handleGoToSettings(plugin)}>
                    <SettingOutlined />
                  </SettingButton>
                </Tooltip>
                <Switch
                  size="small"
                  checked={plugin.source === 'mcp' ? plugin.isActive : plugin.enabled}
                  onChange={(checked) => {
                    if (plugin.source === 'mcp' && plugin.serverId) {
                      handleToggleMCP(plugin.serverId, plugin.isActive!)
                    } else {
                      handleToggleVCP(plugin.name, checked)
                    }
                  }}
                />
              </PluginRight>
            </PluginItem>
          )}
        />
      )}

      <FooterHint>
        <span>ESC {t('common.close', 'Close')}</span>
        <span>↑↓ {t('settings.quickPanel.select', 'Navigate')}</span>
        <span>Enter {t('settings.quickPanel.confirm', 'Confirm')}</span>
      </FooterHint>
    </Modal>
  )
}

// Styled Components
const ModalTitle = styled.div`
  display: flex;
  align-items: center;
`

const StatsContainer = styled.div`
  display: flex;
  gap: 4px;
  margin-left: auto;
  font-size: 12px;
`

const SearchContainer = styled.div`
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--color-border);
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const PluginList = styled(List<UnifiedPlugin>)`
  max-height: 400px;
  overflow-y: auto;
  padding: 0 8px;

  .ant-list-item {
    padding: 0;
    border-bottom: none;
  }
`

const PluginItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  margin: 2px 0;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-background-soft);
  }
`

const PluginLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`

const IconWrapper = styled.div<{ source: string }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
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
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const PluginMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`

const SourceBadge = styled.span<{ source: string }>`
  font-size: 10px;
  font-weight: 500;
  color: ${(p) => SOURCE_COLORS[p.source] || '#666'};
  background: ${(p) => `${SOURCE_COLORS[p.source] || '#666'}15`};
  padding: 1px 6px;
  border-radius: 4px;
`

const PluginRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
`

const SettingButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-soft);
    color: var(--color-primary);
  }
`

const FooterHint = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-3);
`

export default GlobalPluginSearch
