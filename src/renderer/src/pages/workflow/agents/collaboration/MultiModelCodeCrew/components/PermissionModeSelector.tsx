/**
 * PermissionModeSelector - 权限模式选择器
 *
 * 提供 Claude Code 风格的权限控制界面：
 * - 权限模式切换
 * - 待审批队列
 * - 细粒度权限配置
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UnlockOutlined,
  WarningOutlined
} from '@ant-design/icons'
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  List,
  Popconfirm,
  Radio,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { PermissionManager } from '../sandbox'
import type { PermissionConfig, PermissionMode, PermissionRequest, RiskLevel } from '../sandbox/types'
import { PERMISSION_MODE_LABELS, RISK_LEVEL_COLORS } from '../sandbox/types'

const { Text, Title } = Typography

// ==================== 类型定义 ====================

interface Props {
  compact?: boolean
  onModeChange?: (mode: PermissionMode) => void
}

// ==================== 辅助函数 ====================

const getRiskIcon = (risk: RiskLevel): React.ReactNode => {
  switch (risk) {
    case 'low':
      return <CheckCircleOutlined style={{ color: RISK_LEVEL_COLORS.low }} />
    case 'medium':
      return <ExclamationCircleOutlined style={{ color: RISK_LEVEL_COLORS.medium }} />
    case 'high':
      return <WarningOutlined style={{ color: RISK_LEVEL_COLORS.high }} />
    case 'critical':
      return <CloseCircleOutlined style={{ color: RISK_LEVEL_COLORS.critical }} />
    default:
      return <ExclamationCircleOutlined />
  }
}

const getRequestTypeLabel = (type: PermissionRequest['type']): string => {
  const labels: Record<string, string> = {
    file_read: '读取文件',
    file_write: '写入文件',
    file_delete: '删除文件',
    shell_execute: '执行命令',
    network: '网络访问'
  }
  return labels[type] || type
}

const getModeIcon = (mode: PermissionMode): React.ReactNode => {
  switch (mode) {
    case 'ask_always':
      return <LockOutlined />
    case 'auto_approve':
      return <SafetyCertificateOutlined />
    case 'yolo':
      return <ThunderboltOutlined />
    default:
      return <LockOutlined />
  }
}

// ==================== 审批项组件 ====================

interface ApprovalItemProps {
  request: PermissionRequest
  onApprove: (approveAll: boolean) => void
  onDeny: (denyAll: boolean) => void
}

const ApprovalItem: FC<ApprovalItemProps> = ({ request, onApprove, onDeny }) => {
  const { t } = useTranslation()

  return (
    <ApprovalCard $risk={request.risk}>
      <ApprovalHeader>
        <Space>
          {getRiskIcon(request.risk)}
          <Tag
            color={
              request.risk === 'low'
                ? 'green'
                : request.risk === 'medium'
                  ? 'orange'
                  : request.risk === 'high'
                    ? 'red'
                    : 'magenta'
            }>
            {request.risk}
          </Tag>
          <Text strong>{getRequestTypeLabel(request.type)}</Text>
        </Space>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {request.source && `来自: ${request.source}`}
        </Text>
      </ApprovalHeader>

      <ApprovalDetails>
        {request.details.path && (
          <DetailRow>
            <Text type="secondary">路径:</Text>
            <Text code ellipsis style={{ maxWidth: 200 }}>
              {request.details.path}
            </Text>
          </DetailRow>
        )}
        {request.details.command && (
          <DetailRow>
            <Text type="secondary">命令:</Text>
            <Text code ellipsis style={{ maxWidth: 200 }}>
              {request.details.command}
            </Text>
          </DetailRow>
        )}
        {request.details.url && (
          <DetailRow>
            <Text type="secondary">URL:</Text>
            <Text code ellipsis style={{ maxWidth: 200 }}>
              {request.details.url}
            </Text>
          </DetailRow>
        )}
        {request.details.description && (
          <DetailRow>
            <Text type="secondary">描述:</Text>
            <Text>{request.details.description}</Text>
          </DetailRow>
        )}
      </ApprovalDetails>

      <ApprovalActions>
        <Space>
          <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => onApprove(false)}>
            {t('crew.permission.approve', '批准')}
          </Button>
          <Popconfirm
            title={t('crew.permission.approveAllConfirm', '批准所有同类操作?')}
            onConfirm={() => onApprove(true)}>
            <Button type="default" size="small">
              {t('crew.permission.approveAll', '批准同类')}
            </Button>
          </Popconfirm>
        </Space>
        <Space>
          <Button danger size="small" icon={<CloseCircleOutlined />} onClick={() => onDeny(false)}>
            {t('crew.permission.deny', '拒绝')}
          </Button>
          <Popconfirm title={t('crew.permission.denyAllConfirm', '拒绝所有同类操作?')} onConfirm={() => onDeny(true)}>
            <Button danger type="text" size="small">
              {t('crew.permission.denyAll', '拒绝同类')}
            </Button>
          </Popconfirm>
        </Space>
      </ApprovalActions>
    </ApprovalCard>
  )
}

// ==================== 主组件 ====================

const PermissionModeSelector: FC<Props> = ({ compact = false, onModeChange }) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<PermissionMode>(PermissionManager.getMode())
  const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState<PermissionConfig>(PermissionManager.getConfig())

  // 订阅权限请求变化
  useEffect(() => {
    const unsubscribe = PermissionManager.subscribe((requests) => {
      setPendingRequests(requests)
    })
    return unsubscribe
  }, [])

  // 切换模式
  const handleModeChange = useCallback(
    (newMode: PermissionMode) => {
      PermissionManager.setMode(newMode)
      setMode(newMode)
      onModeChange?.(newMode)
    },
    [onModeChange]
  )

  // 批准请求
  const handleApprove = useCallback((requestId: string, approveAll: boolean) => {
    PermissionManager.approveRequest(requestId, approveAll)
  }, [])

  // 拒绝请求
  const handleDeny = useCallback((requestId: string, denyAll: boolean) => {
    PermissionManager.denyRequest(requestId, denyAll)
  }, [])

  // 更新配置
  const handleConfigUpdate = useCallback((updates: Partial<PermissionConfig>) => {
    PermissionManager.updateConfig(updates)
    setConfig(PermissionManager.getConfig())
  }, [])

  // 清除模式
  const handleClearPatterns = useCallback(() => {
    PermissionManager.clearPatterns()
  }, [])

  const modeInfo = PERMISSION_MODE_LABELS[mode]

  // 紧凑模式
  if (compact) {
    return (
      <CompactContainer>
        <Tooltip title={modeInfo.description}>
          <ModeButton onClick={() => setShowSettings(true)} $color={modeInfo.color}>
            {getModeIcon(mode)}
            <Text style={{ marginLeft: 4, fontSize: 12 }}>{modeInfo.label}</Text>
            {pendingRequests.length > 0 && <Badge count={pendingRequests.length} size="small" offset={[4, -2]} />}
          </ModeButton>
        </Tooltip>

        <Drawer
          title={
            <Space>
              <LockOutlined />
              {t('crew.permission.title', '权限控制')}
            </Space>
          }
          placement="right"
          width={400}
          open={showSettings}
          onClose={() => setShowSettings(false)}>
          <DrawerContent>
            {/* 模式选择 */}
            <Section>
              <SectionTitle>{t('crew.permission.mode', '权限模式')}</SectionTitle>
              <Radio.Group
                value={mode}
                onChange={(e) => handleModeChange(e.target.value)}
                buttonStyle="solid"
                style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {Object.entries(PERMISSION_MODE_LABELS).map(([key, info]) => (
                    <ModeOption key={key}>
                      <Radio value={key}>
                        <Space>
                          {getModeIcon(key as PermissionMode)}
                          <span>{info.label}</span>
                        </Space>
                      </Radio>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 24 }}>
                        {info.description}
                      </Text>
                    </ModeOption>
                  ))}
                </Space>
              </Radio.Group>
            </Section>

            {/* YOLO 模式警告 */}
            {mode === 'yolo' && (
              <Alert
                type="error"
                icon={<WarningOutlined />}
                message={t('crew.permission.yoloWarning', 'YOLO 模式危险')}
                description={t(
                  'crew.permission.yoloWarningDesc',
                  '所有操作将自动执行，包括可能危险的操作。请谨慎使用。'
                )}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* 待审批队列 */}
            {pendingRequests.length > 0 && (
              <Section>
                <SectionTitle>
                  {t('crew.permission.pending', '待审批')}
                  <Badge count={pendingRequests.length} />
                </SectionTitle>
                <List
                  dataSource={pendingRequests}
                  renderItem={(request) => (
                    <ApprovalItem
                      request={request}
                      onApprove={(all) => handleApprove(request.id, all)}
                      onDeny={(all) => handleDeny(request.id, all)}
                    />
                  )}
                />
              </Section>
            )}

            {/* 细粒度权限 */}
            <Section>
              <SectionTitle>{t('crew.permission.granular', '细粒度权限')}</SectionTitle>
              <PermissionGrid>
                <PermissionRow>
                  <Text>读取文件</Text>
                  <Switch
                    checked={config.fileRead === 'allow'}
                    onChange={(checked) => handleConfigUpdate({ fileRead: checked ? 'allow' : 'ask' })}
                  />
                </PermissionRow>
                <PermissionRow>
                  <Text>写入文件</Text>
                  <Switch
                    checked={config.fileWrite === 'allow'}
                    onChange={(checked) => handleConfigUpdate({ fileWrite: checked ? 'allow' : 'ask' })}
                  />
                </PermissionRow>
                <PermissionRow>
                  <Text>删除文件</Text>
                  <Switch
                    checked={config.fileDelete === 'allow'}
                    onChange={(checked) => handleConfigUpdate({ fileDelete: checked ? 'allow' : 'ask' })}
                  />
                </PermissionRow>
                <PermissionRow>
                  <Text>执行命令</Text>
                  <Switch
                    checked={config.shellExecute === 'allow'}
                    onChange={(checked) => handleConfigUpdate({ shellExecute: checked ? 'allow' : 'ask' })}
                  />
                </PermissionRow>
                <PermissionRow>
                  <Text>网络访问</Text>
                  <Switch
                    checked={config.networkAccess === 'allow'}
                    onChange={(checked) => handleConfigUpdate({ networkAccess: checked ? 'allow' : 'ask' })}
                  />
                </PermissionRow>
              </PermissionGrid>
            </Section>

            {/* 清除按钮 */}
            <Section>
              <Button type="default" icon={<UnlockOutlined />} onClick={handleClearPatterns} block>
                {t('crew.permission.clearPatterns', '清除已记住的选择')}
              </Button>
            </Section>
          </DrawerContent>
        </Drawer>
      </CompactContainer>
    )
  }

  // 完整模式
  return (
    <Container>
      <Header>
        <Space>
          <LockOutlined />
          <Title level={5} style={{ margin: 0 }}>
            {t('crew.permission.title', '权限控制')}
          </Title>
        </Space>
        <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setShowSettings(true)} />
      </Header>

      {/* 当前模式 */}
      <ModeCard>
        <ModeCardIcon $color={modeInfo.color}>{getModeIcon(mode)}</ModeCardIcon>
        <ModeCardContent>
          <Text strong>{modeInfo.label}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {modeInfo.description}
          </Text>
        </ModeCardContent>
        <Radio.Group value={mode} onChange={(e) => handleModeChange(e.target.value)} size="small">
          <Radio.Button value="ask_always">
            <LockOutlined />
          </Radio.Button>
          <Radio.Button value="auto_approve">
            <SafetyCertificateOutlined />
          </Radio.Button>
          <Radio.Button value="yolo">
            <ThunderboltOutlined />
          </Radio.Button>
        </Radio.Group>
      </ModeCard>

      {/* YOLO 警告 */}
      {mode === 'yolo' && (
        <Alert
          type="error"
          message={t('crew.permission.yoloActive', 'YOLO 模式已激活')}
          icon={<WarningOutlined />}
          showIcon
          style={{ margin: '0 16px 12px' }}
        />
      )}

      {/* 待审批队列 */}
      <PendingSection>
        {pendingRequests.length > 0 ? (
          <>
            <SectionTitle>
              {t('crew.permission.pendingApprovals', '待审批操作')}
              <Badge count={pendingRequests.length} />
            </SectionTitle>
            <List
              dataSource={pendingRequests}
              renderItem={(request) => (
                <ApprovalItem
                  request={request}
                  onApprove={(all) => handleApprove(request.id, all)}
                  onDeny={(all) => handleDeny(request.id, all)}
                />
              )}
            />
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crew.permission.noPending', '无待审批操作')} />
        )}
      </PendingSection>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius-lg);
  overflow: hidden;
`

const CompactContainer = styled.div`
  display: flex;
  align-items: center;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const ModeCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
`

const ModeCardIcon = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ant-border-radius-lg);
  background: ${(props) => `${props.$color}20`};
  color: ${(props) => props.$color};
  font-size: 18px;
`

const ModeCardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

const ModeButton = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--ant-border-radius);
  border: 1px solid var(--ant-color-border);
  cursor: pointer;
  transition: all 0.2s;
  color: ${(props) => props.$color};

  &:hover {
    border-color: ${(props) => props.$color};
    background: ${(props) => `${props.$color}10`};
  }
`

const PendingSection = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
`

const Section = styled.div`
  margin-bottom: 16px;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
`

const ModeOption = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: var(--ant-border-radius);
  border: 1px solid var(--ant-color-border);
  margin-bottom: 8px;

  &:hover {
    background: var(--ant-color-bg-elevated);
  }
`

const ApprovalCard = styled(Card)<{ $risk: RiskLevel }>`
  margin-bottom: 8px;
  border-left: 3px solid ${(props) => RISK_LEVEL_COLORS[props.$risk]};

  .ant-card-body {
    padding: 12px;
  }
`

const ApprovalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const ApprovalDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius);
`

const DetailRow = styled.div`
  display: flex;
  gap: 8px;
  font-size: 12px;
`

const ApprovalActions = styled.div`
  display: flex;
  justify-content: space-between;
`

const DrawerContent = styled.div`
  display: flex;
  flex-direction: column;
`

const PermissionGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius);
`

const PermissionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export default PermissionModeSelector
