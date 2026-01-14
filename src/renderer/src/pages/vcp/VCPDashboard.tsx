/**
 * VCP Dashboard - 统一管理控制台
 *
 * 整合 VCPToolBox 和 VCPChat 功能的统一入口
 * 提供 Agent、插件、变量、模板、群聊管理的集中管理界面
 *
 * @see VCP-NATIVE-REWRITE-PLAN.md Phase 7.1
 */

import {
  AppstoreOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  CodeOutlined,
  CrownOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FormOutlined,
  GlobalOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import { Layout, Menu, Tabs, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 导入各管理组件
import { ExternalPluginManager, VCPPluginList } from '@renderer/components/VCP'

// 导入群聊管理组件
import GroupChatManagement from './GroupChatManagement'

// 导入工作台组件
import AdvancedVariableEditor from './AdvancedVariableEditor'
import GlobalSettingsPanel from './GlobalSettingsPanel'
// 导入面板组件
import { DailyNotePanel, ForumPanel, RAGObserverPanel, SemanticGroupsEditor, ThinkingChainsEditor, TracingPanel } from './panels'
import { TavernManagement } from './tavern'
import TemplateManagement from './TemplateManagement'
import UnifiedAssistantManager from './UnifiedAssistantManager'
import WorkbenchPanel from './WorkbenchPanel'

const { Sider, Content } = Layout
const { Title } = Typography

/**
 * 导航菜单项类型
 */
type MenuKey =
  | 'workbench'
  | 'agents'
  | 'plugins'
  | 'variables'
  | 'templates'
  | 'groupchat'
  | 'tavern'
  | 'forum'
  | 'memory'
  | 'diary-character'
  | 'diary-global'
  | 'observer'
  | 'tracing'
  | 'semantic-groups'
  | 'thinking-chains'
  | 'settings'

/**
 * VCP Dashboard 组件
 */
const VCPDashboard: FC = () => {
  const { t } = useTranslation()
  const { isLeftNavbar } = useNavbarPosition()
  const [selectedKey, setSelectedKey] = useState<MenuKey>('workbench')
  const [collapsed, setCollapsed] = useState(false)

  // 监听 VCP 日记面板事件
  useEffect(() => {
    // 打开日记面板
    const handleOpenPanel = (_event: unknown, data: { mode?: string; characterName?: string }) => {
      if (data.mode === 'character') {
        setSelectedKey('diary-character')
      } else if (data.mode === 'memory') {
        setSelectedKey('memory')
      } else {
        setSelectedKey('diary-global')
      }
    }

    // 导航到日记条目
    const handleNavigateEntry = (_event: unknown, data: { entryPath?: string; entryId?: string }) => {
      // 先切换到日记面板，后续可以通过 Redux 或 Context 传递条目信息
      setSelectedKey('diary-global')
      // TODO: 可以通过 dispatch 或 context 传递 entryPath/entryId 到 DailyNotePanel
      console.log('Navigate to diary entry:', data)
    }

    const cleanup1 = window.electron?.ipcRenderer.on('vcp:open-diary-panel', handleOpenPanel)
    const cleanup2 = window.electron?.ipcRenderer.on('vcp:navigate-diary-entry', handleNavigateEntry)

    return () => {
      cleanup1?.()
      cleanup2?.()
    }
  }, [])

  /**
   * 菜单项配置
   */
  const menuItems = [
    {
      key: 'workbench',
      icon: <DashboardOutlined />,
      label: t('vcp.dashboard.menu.workbench', '工作台')
    },
    {
      key: 'agents',
      icon: <UserOutlined />,
      label: t('vcp.dashboard.menu.agents', 'Agent 管理')
    },
    {
      key: 'plugins',
      icon: <AppstoreOutlined />,
      label: t('vcp.dashboard.menu.plugins', '插件管理')
    },
    {
      key: 'variables',
      icon: <CodeOutlined />,
      label: t('vcp.dashboard.menu.variables', '变量管理')
    },
    {
      key: 'templates',
      icon: <FormOutlined />,
      label: t('vcp.dashboard.menu.templates', '模板管理')
    },
    {
      key: 'groupchat',
      icon: <TeamOutlined />,
      label: t('vcp.dashboard.menu.groupchat', '群聊管理')
    },
    {
      key: 'tavern',
      icon: <CrownOutlined />,
      label: t('vcp.dashboard.menu.tavern', 'Tavern 角色')
    },
    {
      type: 'divider' as const
    },
    {
      key: 'memory',
      icon: <DatabaseOutlined />,
      label: t('vcp.dashboard.menu.memory', '记忆管理')
    },
    {
      key: 'diary',
      icon: <CalendarOutlined />,
      label: t('vcp.dashboard.menu.diary', '日记系统'),
      children: [
        {
          key: 'diary-character',
          icon: <RobotOutlined />,
          label: t('vcp.dashboard.menu.diary_character', '角色日记')
        },
        {
          key: 'diary-global',
          icon: <GlobalOutlined />,
          label: t('vcp.dashboard.menu.diary_global', '全局日记')
        }
      ]
    },
    {
      key: 'forum',
      icon: <MessageOutlined />,
      label: t('vcp.dashboard.menu.forum', '论坛')
    },
    {
      key: 'observer',
      icon: <EyeOutlined />,
      label: t('vcp.dashboard.menu.observer', 'RAG 观察器')
    },
    {
      key: 'tracing',
      icon: <ThunderboltOutlined />,
      label: t('vcp.dashboard.menu.tracing', '全链路追踪')
    },
    {
      key: 'semantic-groups',
      icon: <AppstoreOutlined />,
      label: t('vcp.dashboard.menu.semantic_groups', '语义组')
    },
    {
      key: 'thinking-chains',
      icon: <CodeOutlined />,
      label: t('vcp.dashboard.menu.thinking_chains', '思维链')
    },
    {
      type: 'divider' as const
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('vcp.dashboard.menu.settings', '全局设置')
    }
  ]

  /**
   * 处理菜单选择
   */
  const handleMenuSelect = useCallback(({ key }: { key: string }) => {
    setSelectedKey(key as MenuKey)
  }, [])

  /**
   * 渲染内容区域
   */
  const renderContent = () => {
    switch (selectedKey) {
      case 'workbench':
        return <WorkbenchWrapper />
      case 'agents':
        return <AgentManagerWrapper />
      case 'plugins':
        return <PluginListWrapper />
      case 'variables':
        return <VariableManagerWrapper />
      case 'templates':
        return <TemplateManagerWrapper />
      case 'groupchat':
        return <GroupChatManagerWrapper />
      case 'tavern':
        return <TavernWrapper />
      case 'forum':
        return <ForumWrapper />
      case 'memory':
        return <MemoryManagerWrapper />
      case 'diary-character':
        return <CharacterDiaryWrapper />
      case 'diary-global':
        return <GlobalDiaryWrapper />
      case 'observer':
        return <RAGObserverWrapper />
      case 'tracing':
        return <TracingWrapper />
      case 'semantic-groups':
        return <SemanticGroupsWrapper />
      case 'thinking-chains':
        return <ThinkingChainsWrapper />
      case 'settings':
        return <GlobalSettingsWrapper />
      default:
        return <WorkbenchWrapper />
    }
  }

  return (
    <DashboardContainer>
      {/* 顶部导航栏 */}
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('vcp.dashboard.title', 'VCP 控制台')}</NavbarCenter>
      </Navbar>
      <PageContainer id={isLeftNavbar ? 'content-container' : undefined}>
        <StyledLayout>
          <StyledSider
            width={200}
            collapsedWidth={60}
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            theme="light">
            <LogoContainer $collapsed={collapsed}>
              {collapsed ? (
                <LogoIcon>VCP</LogoIcon>
              ) : (
                <Title level={4} style={{ margin: 0, color: 'var(--color-text-1)' }}>
                  VCP Dashboard
                </Title>
              )}
            </LogoContainer>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onSelect={handleMenuSelect}
              style={{ borderRight: 0, flex: 1 }}
            />
          </StyledSider>
          <StyledContent>{renderContent()}</StyledContent>
        </StyledLayout>
      </PageContainer>
    </DashboardContainer>
  )
}

// ==================== 子组件包装器 ====================

/**
 * 工作台包装器
 * 统一工作台与调用可视化
 */
const WorkbenchWrapper: FC = () => {
  return (
    <ContentWrapper>
      <WorkbenchPanel />
    </ContentWrapper>
  )
}

/**
 * Agent 管理包装器
 * 使用 UnifiedAssistantManager 融合原生 Assistant 系统
 */
const AgentManagerWrapper: FC = () => {
  return (
    <ContentWrapper>
      <UnifiedAssistantManager />
    </ContentWrapper>
  )
}

/**
 * 插件管理包装器
 * 使用现有的 VCPPluginList 组件 + ExternalPluginManager
 * 内置插件标签页默认只显示 Native 原生服务
 */
const PluginListWrapper: FC = () => {
  const { t } = useTranslation()

  const tabItems = [
    {
      key: 'builtin',
      label: (
        <span>
          <CloudDownloadOutlined /> {t('vcp.plugins.tab.builtin', '内置插件')}
        </span>
      ),
      // 内置插件标签页只显示 native 原生服务，隐藏类型筛选器
      children: <VCPPluginList defaultTypeFilter="native" hideTypeFilter />
    },
    {
      key: 'external',
      label: (
        <span>
          <UploadOutlined /> {t('vcp.plugins.tab.external', '外部插件')}
        </span>
      ),
      children: <ExternalPluginManager />
    }
  ]

  return (
    <ContentWrapper>
      <Tabs defaultActiveKey="builtin" items={tabItems} />
    </ContentWrapper>
  )
}

/**
 * 变量管理包装器
 * 使用 VariableManagement 组件
 */
const VariableManagerWrapper: FC = () => {
  return (
    <ContentWrapper>
      <AdvancedVariableEditor />
    </ContentWrapper>
  )
}

/**
 * 模板管理包装器
 * 使用 TemplateManagement 组件
 */
const TemplateManagerWrapper: FC = () => {
  return (
    <ContentWrapper>
      <TemplateManagement />
    </ContentWrapper>
  )
}

/**
 * 群聊管理包装器
 * 显示会话列表和配置，提供跳转到 Home 群聊的入口
 */
const GroupChatManagerWrapper: FC = () => {
  return (
    <ContentWrapper>
      <GroupChatManagement />
    </ContentWrapper>
  )
}

/**
 * Tavern 角色卡管理包装器
 * 管理 SillyTavern 格式的角色卡和世界书
 */
const TavernWrapper: FC = () => {
  return (
    <ContentWrapper>
      <TavernManagement />
    </ContentWrapper>
  )
}

/**
 * 论坛面板包装器
 * VCPChat 论坛功能
 */
const ForumWrapper: FC = () => {
  return (
    <ContentWrapper>
      <ForumPanel />
    </ContentWrapper>
  )
}

/**
 * 记忆管理包装器
 * 显示记忆系统状态、搜索统计和配置
 */
const MemoryManagerWrapper: FC = () => {
  return (
    <ContentWrapper>
      <DailyNotePanel mode="memory" />
    </ContentWrapper>
  )
}

/**
 * 角色日记包装器
 * 与助手关联的角色日记管理
 */
const CharacterDiaryWrapper: FC = () => {
  return (
    <ContentWrapper>
      <DailyNotePanel mode="character" />
    </ContentWrapper>
  )
}

/**
 * 全局日记包装器
 * 不与角色绑定的通用日记
 */
const GlobalDiaryWrapper: FC = () => {
  return (
    <ContentWrapper>
      <DailyNotePanel mode="global" />
    </ContentWrapper>
  )
}

/**
 * RAG 观察器包装器
 * 实时显示 RAG 检索、思维链等事件
 */
const RAGObserverWrapper: FC = () => {
  return (
    <ContentWrapper>
      <RAGObserverPanel />
    </ContentWrapper>
  )
}

/**
 * 全链路追踪面板包装器
 * Native VCP 监控与日志
 */
const TracingWrapper: FC = () => {
  return (
    <ContentWrapper>
      <TracingPanel />
    </ContentWrapper>
  )
}

/**
 * 语义组编辑器包装器
 * 管理语义组和关键词
 */
const SemanticGroupsWrapper: FC = () => {
  return (
    <ContentWrapper>
      <SemanticGroupsEditor />
    </ContentWrapper>
  )
}

/**
 * 思维链编辑器包装器
 * 查看和测试思维链
 */
const ThinkingChainsWrapper: FC = () => {
  return (
    <ContentWrapper>
      <ThinkingChainsEditor />
    </ContentWrapper>
  )
}

/**
 * 全局设置包装器
 * 使用 GlobalSettingsPanel 组件
 */
const GlobalSettingsWrapper: FC = () => {
  return (
    <ContentWrapper>
      <GlobalSettingsPanel />
    </ContentWrapper>
  )
}

// ==================== 样式组件 ====================

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--color-background);
`

const PageContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  height: calc(100vh - var(--navbar-height));
  width: 100%;
`

const StyledLayout = styled(Layout)`
  height: 100%;
  background: var(--color-background);
`

const StyledSider = styled(Sider)`
  background: var(--color-background-soft) !important;
  border-right: 1px solid var(--color-border);

  .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
  }

  .ant-menu {
    background: transparent;

    .ant-menu-item {
      margin: 4px 8px;
      border-radius: 8px;

      &:hover {
        background: var(--color-background-mute);
      }

      &.ant-menu-item-selected {
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }
    }
  }

  .ant-layout-sider-trigger {
    background: var(--color-background-soft);
    border-top: 1px solid var(--color-border);
  }
`

const LogoContainer = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: ${(props) => (props.$collapsed ? '0' : '0 16px')};
  border-bottom: 1px solid var(--color-border);
`

const LogoIcon = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
`

const StyledContent = styled(Content)`
  flex: 1;
  overflow: auto;
  background: var(--color-background);
`

const ContentWrapper = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 0;
`

export default VCPDashboard
