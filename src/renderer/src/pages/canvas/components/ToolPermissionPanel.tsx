/**
 * ToolPermissionPanel - 工具权限设置面板
 *
 * 允许用户配置 AI Agent 工具的执行权限
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Alert, Card, Collapse, Divider, List, Radio, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import {
  getToolPermissionManager,
  type PermissionLevel,
  type ToolCategory,
  type ToolPermission,
  type UserPermissionSettings
} from '../utils/toolPermissionManager'

const { Text, Title } = Typography

// ==================== 类型定义 ====================

interface Props {
  onSettingsChange?: () => void
}

// ==================== 常量 ====================

const CATEGORY_LABELS: Record<ToolCategory, { label: string; icon: React.ReactNode; description: string }> = {
  read: {
    label: '读取操作',
    icon: <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />,
    description: '读取文件、目录、搜索等'
  },
  write: {
    label: '写入操作',
    icon: <ExclamationCircleOutlined style={{ color: 'var(--color-warning)' }} />,
    description: '创建、编辑、删除文件'
  },
  execute: {
    label: '执行操作',
    icon: <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />,
    description: 'Shell 命令、代码执行'
  },
  git: {
    label: 'Git 操作',
    icon: <SafetyCertificateOutlined style={{ color: 'var(--color-info)' }} />,
    description: '版本控制操作'
  },
  system: {
    label: '系统操作',
    icon: <SettingOutlined />,
    description: '系统级别操作'
  }
}

// ==================== 组件实现 ====================

export const ToolPermissionPanel: FC<Props> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<UserPermissionSettings | null>(null)
  const [tools, setTools] = useState<ToolPermission[]>([])

  const permissionManager = getToolPermissionManager()

  // 加载设置
  useEffect(() => {
    setSettings(permissionManager.getUserSettings())
    setTools(permissionManager.getAllToolPermissions())
  }, [])

  // 更新分类设置
  const handleCategoryToggle = useCallback(
    (key: keyof UserPermissionSettings, value: boolean) => {
      permissionManager.updateUserSettings({ [key]: value })
      setSettings(permissionManager.getUserSettings())
      onSettingsChange?.()
    },
    [permissionManager, onSettingsChange]
  )

  // 更新单个工具权限
  const handleToolPermissionChange = useCallback(
    (toolName: string, level: PermissionLevel) => {
      permissionManager.setToolPermissionLevel(toolName, level)
      setSettings(permissionManager.getUserSettings())
      onSettingsChange?.()
    },
    [permissionManager, onSettingsChange]
  )

  if (!settings) {
    return null
  }

  // 按分类分组工具
  const toolsByCategory = tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = []
      }
      acc[tool.category].push(tool)
      return acc
    },
    {} as Record<ToolCategory, ToolPermission[]>
  )

  return (
    <Container>
      <Title level={5}>
        <SafetyCertificateOutlined /> 工具权限设置
      </Title>

      <Alert
        type="info"
        showIcon
        message="安全提示"
        description="AI Agent 可以使用工具来操作您的文件和系统。建议保持危险操作的确认开关开启。"
        style={{ marginBottom: 16 }}
      />

      {/* 分类级别设置 */}
      <Card title="分类权限" size="small" style={{ marginBottom: 16 }}>
        <SettingRow>
          <SettingLabel>
            {CATEGORY_LABELS.read.icon}
            <span>自动批准读取操作</span>
            <Tooltip title="包括读取文件、列出目录、搜索等">
              <QuestionCircleOutlined style={{ color: 'var(--color-text-3)', marginLeft: 4 }} />
            </Tooltip>
          </SettingLabel>
          <Switch checked={settings.autoApproveReads} onChange={(v) => handleCategoryToggle('autoApproveReads', v)} />
        </SettingRow>

        <Divider style={{ margin: '12px 0' }} />

        <SettingRow>
          <SettingLabel>
            {CATEGORY_LABELS.write.icon}
            <span>自动批准写入操作</span>
            <Tooltip title="包括创建、编辑、删除文件等">
              <QuestionCircleOutlined style={{ color: 'var(--color-text-3)', marginLeft: 4 }} />
            </Tooltip>
          </SettingLabel>
          <Switch checked={settings.autoApproveWrites} onChange={(v) => handleCategoryToggle('autoApproveWrites', v)} />
        </SettingRow>

        <Divider style={{ margin: '12px 0' }} />

        <SettingRow>
          <SettingLabel>
            {CATEGORY_LABELS.execute.icon}
            <span>自动批准执行操作</span>
            <Tooltip title="包括 Shell 命令、代码执行等 (危险)">
              <QuestionCircleOutlined style={{ color: 'var(--color-text-3)', marginLeft: 4 }} />
            </Tooltip>
          </SettingLabel>
          <Switch
            checked={settings.autoApproveExecute}
            onChange={(v) => handleCategoryToggle('autoApproveExecute', v)}
          />
        </SettingRow>

        <Divider style={{ margin: '12px 0' }} />

        <SettingRow>
          <SettingLabel>
            {CATEGORY_LABELS.git.icon}
            <span>自动批准 Git 操作</span>
            <Tooltip title="包括暂存、提交、重置等">
              <QuestionCircleOutlined style={{ color: 'var(--color-text-3)', marginLeft: 4 }} />
            </Tooltip>
          </SettingLabel>
          <Switch checked={settings.autoApproveGit} onChange={(v) => handleCategoryToggle('autoApproveGit', v)} />
        </SettingRow>
      </Card>

      {/* 单独工具设置 */}
      <Card title="详细工具权限" size="small">
        <Collapse
          ghost
          items={Object.entries(toolsByCategory).map(([category, categoryTools]) => {
            const categoryInfo = CATEGORY_LABELS[category as ToolCategory]
            return {
              key: category,
              label: (
                <Space>
                  {categoryInfo.icon}
                  <span>{categoryInfo.label}</span>
                  <Tag>{categoryTools.length} 个工具</Tag>
                </Space>
              ),
              children: (
                <List
                  size="small"
                  dataSource={categoryTools}
                  renderItem={(tool) => {
                    const customLevel = settings.customPermissions[tool.tool]
                    const effectiveLevel = customLevel || tool.permissionLevel

                    return (
                      <ToolItem>
                        <ToolInfo>
                          <ToolName>
                            <code>{tool.tool}</code>
                            {tool.isDangerous && (
                              <Tag color="error" style={{ marginLeft: 8 }}>
                                危险
                              </Tag>
                            )}
                          </ToolName>
                          <ToolDescription>{tool.description}</ToolDescription>
                        </ToolInfo>
                        <Radio.Group
                          size="small"
                          value={effectiveLevel}
                          onChange={(e) => handleToolPermissionChange(tool.tool, e.target.value)}
                          optionType="button"
                          buttonStyle="solid">
                          <Radio.Button value="always">
                            <CheckCircleOutlined />
                          </Radio.Button>
                          <Radio.Button value="ask">
                            <QuestionCircleOutlined />
                          </Radio.Button>
                          <Radio.Button value="never">
                            <CloseCircleOutlined />
                          </Radio.Button>
                        </Radio.Group>
                      </ToolItem>
                    )
                  }}
                />
              )
            }
          })}
        />
      </Card>

      {/* 权限说明 */}
      <LegendContainer>
        <Text type="secondary">权限级别说明：</Text>
        <Space style={{ marginTop: 8 }}>
          <Tag icon={<CheckCircleOutlined />} color="success">
            始终允许
          </Tag>
          <Tag icon={<QuestionCircleOutlined />} color="warning">
            每次询问
          </Tag>
          <Tag icon={<CloseCircleOutlined />} color="error">
            始终拒绝
          </Tag>
        </Space>
      </LegendContainer>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  padding: 16px;
`

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const SettingLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ToolItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`

const ToolInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const ToolName = styled.div`
  display: flex;
  align-items: center;

  code {
    font-size: 13px;
    background: var(--color-background-soft);
    padding: 2px 6px;
    border-radius: 4px;
  }
`

const ToolDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  margin-top: 2px;
`

const LegendContainer = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

export default ToolPermissionPanel
