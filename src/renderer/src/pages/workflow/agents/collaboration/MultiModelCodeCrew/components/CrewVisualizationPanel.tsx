/**
 * CrewVisualizationPanel - Vibe Coding 可视化界面
 *
 * 实时展示多模型协作的全貌：
 * - 角色活动时间线
 * - 任务流转可视化
 * - 结构化日志
 * - 统计面板
 */

import {
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { CREW_ROLE_CONFIGS, type CrewRole } from '../types'
import type { CrewLogEntry, CrewSnapshot, RoleActivity } from '../hooks/useCrewEvents'

const { Text, Title } = Typography

// ==================== 类型定义 ====================

interface Props {
  snapshot: CrewSnapshot
  onClearLogs?: () => void
  onClearActivities?: () => void
  onRefresh?: () => void
}

// ==================== 辅助函数 ====================

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getLogLevelIcon = (level: CrewLogEntry['level']) => {
  switch (level) {
    case 'success':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'error':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    case 'warning':
      return <WarningOutlined style={{ color: '#faad14' }} />
    case 'info':
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />
    case 'debug':
      return <BugOutlined style={{ color: '#8c8c8c' }} />
    default:
      return <InfoCircleOutlined />
  }
}

const getLogLevelColor = (level: CrewLogEntry['level']) => {
  switch (level) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'processing'
    case 'debug':
      return 'default'
    default:
      return 'default'
  }
}

const getActivityIcon = (type: RoleActivity['type']) => {
  switch (type) {
    case 'task_start':
      return <PlayCircleOutlined style={{ color: '#1890ff' }} />
    case 'task_complete':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'task_fail':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    case 'file':
      return <FileOutlined style={{ color: '#1890ff' }} />
    case 'issue':
      return <ExclamationCircleOutlined style={{ color: '#faad14' }} />
    case 'message':
      return <RobotOutlined />
    default:
      return <InfoCircleOutlined />
  }
}

const getPhaseLabel = (phase: string | null): string => {
  const labels: Record<string, string> = {
    initialization: '初始化',
    research: '调研',
    design: '设计',
    implementation: '实现',
    review: '审查',
    testing: '测试',
    completed: '已完成'
  }
  return phase ? labels[phase] || phase : '未知'
}

// ==================== 子组件 ====================

/**
 * 统计概览卡片
 */
const StatisticsOverview: FC<{ snapshot: CrewSnapshot }> = ({ snapshot }) => {
  const { statistics, isRunning, currentPhase } = snapshot
  const { t } = useTranslation()

  const progressPercent =
    statistics.totalTasks > 0 ? Math.round((statistics.completedTasks / statistics.totalTasks) * 100) : 0

  return (
    <StatsGrid>
      <Card size="small">
        <Statistic
          title={t('crew.viz.phase', '当前阶段')}
          value={getPhaseLabel(currentPhase)}
          prefix={isRunning ? <SyncOutlined spin /> : <CheckCircleOutlined />}
          valueStyle={{ fontSize: 16 }}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('crew.viz.progress', '任务进度')}
          value={`${statistics.completedTasks}/${statistics.totalTasks}`}
          suffix={<Progress percent={progressPercent} size="small" showInfo={false} style={{ width: 60 }} />}
          valueStyle={{ fontSize: 16 }}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('crew.viz.files', '生成文件')}
          value={statistics.totalFiles}
          prefix={<FileOutlined />}
          valueStyle={{ fontSize: 16, color: '#52c41a' }}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('crew.viz.issues', '发现问题')}
          value={statistics.totalIssues}
          prefix={<ExclamationCircleOutlined />}
          valueStyle={{
            fontSize: 16,
            color: statistics.totalIssues > 0 ? '#faad14' : 'inherit'
          }}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('crew.viz.avgDuration', '平均耗时')}
          value={formatDuration(statistics.averageTaskDuration)}
          prefix={<ClockCircleOutlined />}
          valueStyle={{ fontSize: 16 }}
        />
      </Card>
      <Card size="small">
        <Statistic
          title={t('crew.viz.elapsed', '总耗时')}
          value={formatDuration(
            statistics.elapsedTime || (statistics.startTime ? Date.now() - statistics.startTime.getTime() : 0)
          )}
          prefix={<ThunderboltOutlined />}
          valueStyle={{ fontSize: 16 }}
        />
      </Card>
    </StatsGrid>
  )
}

/**
 * 团队状态面板
 */
const TeamStatusPanel: FC<{ members: CrewSnapshot['members'] }> = ({ members }) => {
  const { t } = useTranslation()

  if (members.length === 0) {
    return <Empty description={t('crew.viz.noMembers', '暂无团队成员')} />
  }

  return (
    <MemberGrid>
      {members.map((member) => {
        const roleConfig = CREW_ROLE_CONFIGS[member.role]
        const isWorking = member.status === 'working'
        const hasError = member.status === 'error'

        return (
          <MemberCard key={member.id} $status={member.status}>
            <MemberHeader>
              <Badge status={isWorking ? 'processing' : hasError ? 'error' : 'default'} offset={[-4, 4]}>
                <Avatar size={36}>{roleConfig.icon}</Avatar>
              </Badge>
              <MemberInfo>
                <Text strong>{member.name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {roleConfig.displayNameEn}
                </Text>
              </MemberInfo>
            </MemberHeader>
            <MemberStatus>
              {isWorking ? (
                <Tag color="processing" icon={<LoadingOutlined spin />}>
                  {t('crew.viz.working', '工作中')}
                </Tag>
              ) : hasError ? (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  {t('crew.viz.error', '错误')}
                </Tag>
              ) : (
                <Tag icon={<PauseCircleOutlined />}>{t('crew.viz.idle', '空闲')}</Tag>
              )}
              <Text type="secondary" style={{ fontSize: 10 }}>
                {member.modelConfig.modelId}
              </Text>
            </MemberStatus>
            {member.currentTask && (
              <CurrentTask>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  当前: {member.currentTask}
                </Text>
              </CurrentTask>
            )}
          </MemberCard>
        )
      })}
    </MemberGrid>
  )
}

/**
 * 角色活动时间线
 */
const RoleActivityTimeline: FC<{
  roleActivities: CrewSnapshot['roleActivities']
  selectedRole: CrewRole | 'all'
  onRoleChange: (role: CrewRole | 'all') => void
}> = ({ roleActivities, selectedRole, onRoleChange }) => {
  const { t } = useTranslation()

  // 合并所有活动并按时间排序
  const allActivities = useMemo(() => {
    const activities: RoleActivity[] = []
    roleActivities.forEach((roleActs) => {
      activities.push(...roleActs)
    })
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [roleActivities])

  // 过滤活动
  const filteredActivities = useMemo(() => {
    if (selectedRole === 'all') return allActivities.slice(0, 50)
    return allActivities.filter((a) => a.role === selectedRole).slice(0, 50)
  }, [allActivities, selectedRole])

  const roleOptions = [
    { value: 'all', label: t('crew.viz.allRoles', '全部角色') },
    ...(Object.keys(CREW_ROLE_CONFIGS) as CrewRole[]).map((role) => ({
      value: role,
      label: `${CREW_ROLE_CONFIGS[role].icon} ${CREW_ROLE_CONFIGS[role].displayName}`
    }))
  ]

  return (
    <ActivityContainer>
      <ActivityHeader>
        <Space>
          <FilterOutlined />
          <Select
            value={selectedRole}
            onChange={onRoleChange}
            options={roleOptions}
            style={{ width: 140 }}
            size="small"
          />
        </Space>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('crew.viz.showingRecent', '显示最近 50 条')}
        </Text>
      </ActivityHeader>

      {filteredActivities.length === 0 ? (
        <Empty description={t('crew.viz.noActivities', '暂无活动记录')} />
      ) : (
        <Timeline
          items={filteredActivities.map((activity) => {
            const roleConfig = CREW_ROLE_CONFIGS[activity.role]
            return {
              dot: getActivityIcon(activity.type),
              children: (
                <ActivityItem>
                  <ActivityItemHeader>
                    <Space size={4}>
                      <Avatar size={18}>{roleConfig.icon}</Avatar>
                      <Text strong style={{ fontSize: 12 }}>
                        {activity.memberName}
                      </Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {formatTimestamp(activity.timestamp)}
                    </Text>
                  </ActivityItemHeader>
                  <ActivityItemContent>
                    <Text>{activity.content}</Text>
                    {activity.duration !== undefined && (
                      <Tag style={{ marginLeft: 8, fontSize: 11 }}>{formatDuration(activity.duration)}</Tag>
                    )}
                  </ActivityItemContent>
                </ActivityItem>
              )
            }
          })}
        />
      )}
    </ActivityContainer>
  )
}

/**
 * 日志查看器
 */
const LogViewer: FC<{
  logs: CrewLogEntry[]
  onClear?: () => void
}> = ({ logs, onClear }) => {
  const { t } = useTranslation()
  const [levelFilter, setLevelFilter] = useState<CrewLogEntry['level'] | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => levelFilter === 'all' || log.level === levelFilter)
      .filter((log) => sourceFilter === 'all' || log.source === sourceFilter)
      .slice(-200)
      .reverse()
  }, [logs, levelFilter, sourceFilter])

  const columns: ColumnsType<CrewLogEntry> = [
    {
      title: t('crew.viz.time', '时间'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 80,
      render: (ts: Date) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {formatTimestamp(ts)}
        </Text>
      )
    },
    {
      title: t('crew.viz.level', '级别'),
      dataIndex: 'level',
      key: 'level',
      width: 70,
      render: (level: CrewLogEntry['level']) => (
        <Tag color={getLogLevelColor(level)} style={{ margin: 0 }}>
          {level}
        </Tag>
      )
    },
    {
      title: t('crew.viz.source', '来源'),
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (source: CrewLogEntry['source']) => {
        if (source === 'system' || source === 'orchestrator') {
          return <Tag>{source}</Tag>
        }
        const roleConfig = CREW_ROLE_CONFIGS[source as CrewRole]
        return (
          <Space size={4}>
            <Avatar size={16}>{roleConfig?.icon || '?'}</Avatar>
            <Text style={{ fontSize: 11 }}>{roleConfig?.displayName || source}</Text>
          </Space>
        )
      }
    },
    {
      title: t('crew.viz.message', '消息'),
      dataIndex: 'message',
      key: 'message',
      render: (message: string, record) => (
        <Tooltip title={record.details ? JSON.stringify(record.details, null, 2) : undefined}>
          <LogMessage>
            {getLogLevelIcon(record.level)}
            <Text style={{ marginLeft: 6 }}>{message}</Text>
          </LogMessage>
        </Tooltip>
      )
    }
  ]

  const levelOptions = [
    { value: 'all', label: t('crew.viz.allLevels', '全部级别') },
    { value: 'error', label: '错误' },
    { value: 'warning', label: '警告' },
    { value: 'success', label: '成功' },
    { value: 'info', label: '信息' },
    { value: 'debug', label: '调试' }
  ]

  const sourceOptions = [
    { value: 'all', label: t('crew.viz.allSources', '全部来源') },
    { value: 'system', label: '系统' },
    { value: 'orchestrator', label: '协调器' },
    ...(Object.keys(CREW_ROLE_CONFIGS) as CrewRole[]).map((role) => ({
      value: role,
      label: CREW_ROLE_CONFIGS[role].displayName
    }))
  ]

  return (
    <LogContainer>
      <LogHeader>
        <Space>
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            options={levelOptions}
            style={{ width: 100 }}
            size="small"
          />
          <Select
            value={sourceFilter}
            onChange={setSourceFilter}
            options={sourceOptions}
            style={{ width: 100 }}
            size="small"
          />
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {filteredLogs.length} 条
          </Text>
          {onClear && <Button type="text" size="small" icon={<DeleteOutlined />} onClick={onClear} danger />}
        </Space>
      </LogHeader>
      <Table
        columns={columns}
        dataSource={filteredLogs}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ y: 300 }}
      />
    </LogContainer>
  )
}

/**
 * 文件列表
 */
const FileList: FC<{ files: CrewSnapshot['files'] }> = ({ files }) => {
  const { t } = useTranslation()

  if (files.length === 0) {
    return <Empty description={t('crew.viz.noFiles', '暂无生成文件')} />
  }

  return (
    <FileGrid>
      {files.map((file, index) => (
        <FileCard key={`${file.path}_${index}`}>
          <FileCardHeader>
            <CodeOutlined />
            <Text strong style={{ flex: 1, fontSize: 12 }} ellipsis>
              {file.path.split('/').pop()}
            </Text>
            <Tag
              color={file.action === 'create' ? 'success' : file.action === 'modify' ? 'processing' : 'error'}
              style={{ margin: 0 }}>
              {file.action}
            </Tag>
          </FileCardHeader>
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            {file.path}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {file.language} · {file.content.split('\n').length} 行
          </Text>
        </FileCard>
      ))}
    </FileGrid>
  )
}

/**
 * 问题列表
 */
const IssueList: FC<{ issues: CrewSnapshot['issues'] }> = ({ issues }) => {
  const { t } = useTranslation()

  if (issues.length === 0) {
    return <Empty description={t('crew.viz.noIssues', '暂无发现问题')} />
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      case 'info':
        return 'processing'
      default:
        return 'default'
    }
  }

  return (
    <IssueGrid>
      {issues.map((issue) => (
        <IssueCard key={issue.id}>
          <IssueCardHeader>
            <Tag color={getSeverityColor(issue.severity)}>{issue.severity}</Tag>
            <Tag>{issue.type}</Tag>
          </IssueCardHeader>
          <Text>{issue.message}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {issue.file}
            {issue.line ? `:${issue.line}` : ''}
          </Text>
        </IssueCard>
      ))}
    </IssueGrid>
  )
}

// ==================== 主组件 ====================

const CrewVisualizationPanel: FC<Props> = ({
  snapshot,
  onClearLogs,
  onClearActivities: _onClearActivities,
  onRefresh
}) => {
  const { t } = useTranslation()
  const [selectedRole, setSelectedRole] = useState<CrewRole | 'all'>('all')

  const handleRoleChange = useCallback((role: CrewRole | 'all') => {
    setSelectedRole(role)
  }, [])

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <TeamOutlined />
          {t('crew.viz.overview', '概览')}
        </Space>
      ),
      children: (
        <TabContent>
          <StatisticsOverview snapshot={snapshot} />
          <SectionTitle>
            <TeamOutlined />
            {t('crew.viz.teamStatus', '团队状态')}
          </SectionTitle>
          <TeamStatusPanel members={snapshot.members} />
        </TabContent>
      )
    },
    {
      key: 'activity',
      label: (
        <Space>
          <SyncOutlined />
          {t('crew.viz.activity', '活动')}
          {snapshot.roleActivities.size > 0 && (
            <Badge
              count={Array.from(snapshot.roleActivities.values()).reduce((sum, arr) => sum + arr.length, 0)}
              size="small"
              style={{ marginLeft: 4 }}
            />
          )}
        </Space>
      ),
      children: (
        <TabContent>
          <RoleActivityTimeline
            roleActivities={snapshot.roleActivities}
            selectedRole={selectedRole}
            onRoleChange={handleRoleChange}
          />
        </TabContent>
      )
    },
    {
      key: 'logs',
      label: (
        <Space>
          <FileOutlined />
          {t('crew.viz.logs', '日志')}
          {snapshot.logs.length > 0 && <Badge count={snapshot.logs.length} size="small" style={{ marginLeft: 4 }} />}
        </Space>
      ),
      children: (
        <TabContent>
          <LogViewer logs={snapshot.logs} onClear={onClearLogs} />
        </TabContent>
      )
    },
    {
      key: 'files',
      label: (
        <Space>
          <CodeOutlined />
          {t('crew.viz.files', '文件')}
          {snapshot.files.length > 0 && (
            <Badge count={snapshot.files.length} size="small" style={{ marginLeft: 4 }} color="green" />
          )}
        </Space>
      ),
      children: (
        <TabContent>
          <FileList files={snapshot.files} />
        </TabContent>
      )
    },
    {
      key: 'issues',
      label: (
        <Space>
          <ExclamationCircleOutlined />
          {t('crew.viz.issues', '问题')}
          {snapshot.issues.length > 0 && (
            <Badge count={snapshot.issues.length} size="small" style={{ marginLeft: 4 }} color="orange" />
          )}
        </Space>
      ),
      children: (
        <TabContent>
          <IssueList issues={snapshot.issues} />
        </TabContent>
      )
    }
  ]

  return (
    <Container>
      <Header>
        <Space>
          <RobotOutlined />
          <Title level={5} style={{ margin: 0 }}>
            {t('crew.viz.title', 'Vibe Coding 可视化')}
          </Title>
          {snapshot.isRunning && (
            <Tag color="processing" icon={<LoadingOutlined spin />}>
              {t('crew.viz.running', '运行中')}
            </Tag>
          )}
        </Space>
        <Space>{onRefresh && <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onRefresh} />}</Space>
      </Header>

      <Content>
        <Tabs defaultActiveKey="overview" items={tabItems} size="small" style={{ height: '100%' }} />
      </Content>
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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const Content = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 12px;

  .ant-tabs {
    height: 100%;
  }

  .ant-tabs-content {
    height: calc(100% - 46px);
    overflow-y: auto;
  }

  .ant-tabs-nav {
    margin-bottom: 8px;
  }
`

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--ant-color-text);
  margin-top: 8px;
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  .ant-card {
    border-radius: var(--ant-border-radius-lg);
    border: 1px solid var(--ant-color-border);
    transition: all 0.2s;

    &:hover {
      border-color: var(--ant-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  .ant-card-body {
    padding: 12px;
  }

  .ant-statistic-title {
    font-size: 11px;
    margin-bottom: 4px;
    color: var(--ant-color-text-secondary);
  }
`

const MemberGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const MemberCard = styled.div<{ $status: string }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${(props) =>
    props.$status === 'working'
      ? 'var(--ant-color-primary)'
      : props.$status === 'error'
        ? 'var(--ant-color-error)'
        : 'var(--ant-color-border)'};
  border-radius: var(--ant-border-radius-lg);
  background: ${(props) =>
    props.$status === 'working' ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-bg-container)'};
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const MemberHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const MemberInfo = styled.div`
  display: flex;
  flex-direction: column;
`

const MemberStatus = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CurrentTask = styled.div`
  padding-top: 8px;
  border-top: 1px dashed var(--ant-color-border);
`

const ActivityContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const ActivityItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const ActivityItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const ActivityItemContent = styled.div`
  display: flex;
  align-items: center;
`

const LogContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const LogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const LogMessage = styled.div`
  display: flex;
  align-items: center;
`

const FileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const FileCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--ant-color-border);
  border-radius: var(--ant-border-radius);
  background: var(--ant-color-bg-elevated);
  transition: all 0.2s;

  &:hover {
    border-color: var(--ant-color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const FileCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const IssueGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const IssueCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--ant-color-border);
  border-radius: var(--ant-border-radius);
  background: var(--ant-color-bg-elevated);
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const IssueCardHeader = styled.div`
  display: flex;
  gap: 6px;
`

export default CrewVisualizationPanel
