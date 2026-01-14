/**
 * MultiModelCodeCrewPanel - 多模型协同编码面板
 *
 * VCP 风格的多 AI 协作编程界面
 * 支持两种模式：
 * 1. 聊天模式 - 类似 Claude Code 的对话式编程
 * 2. 团队模式 - 多模型协同完成复杂任务
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  CopyOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import ModelSelector from '@renderer/components/ModelSelector'
import Markdown from '@renderer/pages/home/Markdown/Markdown'
import { getModelUniqId, resolveModelUniqId } from '@renderer/services/ModelService'
import type { Model, Provider } from '@renderer/types'
import { MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Collapse,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Progress,
  Segmented,
  Slider,
  Space,
  Steps,
  Switch,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography
} from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import type { RootState } from '@renderer/store'
import { fetchGenerateStream } from '@renderer/services/ApiService'
import { ChunkType } from '@renderer/types/chunk'
import {
  CodeCrewOrchestrator,
  CREW_ROLE_CONFIGS,
  getCrewConfigManager,
  useCrewEvents,
  CrewVisualizationPanel,
  type CodeFile,
  type CodeIssue,
  type CrewEvent,
  type CrewMember,
  type CrewPhase,
  type CrewProgress,
  type CrewRole,
  type CrewSession,
  type ModelProvider,
  type RoleCustomConfig
} from '@renderer/pages/workflow/agents/collaboration/MultiModelCodeCrew'

import {
  buildSystemPromptWithTools,
  parseToolCalls,
  removeToolCallBlocks,
  hasToolCalls,
  executeToolCall,
  type VCPToolRequest
} from './utils/agenticToolCalling'
import { toolCallHistory } from './utils/toolCallHistory'
import { resolveQuickCommands } from './utils/quickCommandResolver'
import QuickCommandInput from './components/QuickCommandInput'

const { Text, Title } = Typography
const { TextArea } = Input

const logger = loggerService.withContext('MultiModelCodeCrewPanel')

// ==================== 类型定义 ====================

/** 当前打开的文件 */
interface CurrentFile {
  name: string
  path: string
  content: string
  language?: string
}

interface Props {
  visible: boolean
  onClose?: () => void
  onFilesGenerated?: (files: CodeFile[]) => void
  onRunningChange?: (isRunning: boolean) => void
  onFilesApplied?: () => void
  /** 当前打开的文件 */
  currentFile?: CurrentFile | null
}

interface RoleModelMapping {
  role: CrewRole
  providerId: string
  modelId: string
  model?: Model
}

// 聊天消息类型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: Date
  isStreaming?: boolean
  files?: CodeFile[]
  toolCalls?: VCPToolRequest[]
  toolCallId?: string
  toolName?: string
  isToolResult?: boolean
}

// 工具调用活动（用于 UI 显示）
interface ToolActivity {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'success' | 'error'
  arguments?: Record<string, unknown>
  result?: string
  error?: string
  timestamp: Date
}

// 面板模式
type PanelMode = 'chat' | 'team'

// ==================== 常量 ====================

const PHASE_STEPS: { phase: CrewPhase; title: string; icon: React.ReactNode }[] = [
  { phase: 'research', title: '调研', icon: <SearchOutlined /> },
  { phase: 'design', title: '设计', icon: <ToolOutlined /> },
  { phase: 'implementation', title: '实现', icon: <CodeOutlined /> },
  { phase: 'review', title: '审查', icon: <EyeOutlined /> },
  { phase: 'testing', title: '测试', icon: <ExperimentOutlined /> },
  { phase: 'completed', title: '完成', icon: <CheckCircleOutlined /> }
]

// ==================== 角色配置编辑器组件 ====================

interface RoleConfigEditorProps {
  role: CrewRole
  visible: boolean
  onClose: () => void
  onSave: (config: Partial<RoleCustomConfig>) => void
  providers: Provider[]
  currentMapping: RoleModelMapping
}

const RoleConfigEditor: FC<RoleConfigEditorProps> = ({ role, visible, onClose, onSave, providers, currentMapping }) => {
  const { t } = useTranslation()
  const configManager = useMemo(() => getCrewConfigManager(), [])
  const [form] = Form.useForm()

  const roleConfig = CREW_ROLE_CONFIGS[role]
  const customConfig = configManager.getRoleConfig(role)

  // 初始化表单
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        customSystemPrompt: customConfig.systemPrompt || '',
        systemPromptAppend: customConfig.systemPromptAppend || '',
        temperature: customConfig.modelConfig?.temperature ?? 0.7,
        maxTokens: customConfig.modelConfig?.maxTokens ?? 4096,
        enabled: customConfig.enabled,
        expertiseTags: customConfig.expertiseTags?.join(', ') || ''
      })
    }
  }, [visible, customConfig, form])

  const handleSave = () => {
    form.validateFields().then((values) => {
      const config: Partial<RoleCustomConfig> = {
        role,
        systemPrompt: values.customSystemPrompt || undefined,
        systemPromptAppend: values.systemPromptAppend || undefined,
        modelConfig: {
          provider: currentMapping.providerId as ModelProvider,
          modelId: currentMapping.modelId,
          temperature: values.temperature,
          maxTokens: values.maxTokens
        },
        enabled: values.enabled,
        expertiseTags: values.expertiseTags
          ? values.expertiseTags
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined
      }
      onSave(config)
      onClose()
    })
  }

  return (
    <Drawer
      title={
        <Space>
          <Avatar size={24}>{roleConfig.icon}</Avatar>
          <span>
            {roleConfig.displayName} - {t('crew.roleConfig', '角色配置')}
          </span>
        </Space>
      }
      placement="right"
      width={520}
      open={visible}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel', '取消')}</Button>
          <Button type="primary" onClick={handleSave}>
            {t('common.save', '保存')}
          </Button>
        </Space>
      }>
      <Tabs
        defaultActiveKey="prompt"
        items={[
          {
            key: 'prompt',
            label: (
              <Space>
                <FileTextOutlined />
                {t('crew.systemPrompt', '系统提示词')}
              </Space>
            ),
            children: (
              <Form form={form} layout="vertical">
                <Form.Item
                  label={
                    <Space>
                      <span>{t('crew.defaultPrompt', '默认提示词')}</span>
                      <Tag color="blue">{t('crew.readOnly', '只读')}</Tag>
                    </Space>
                  }>
                  <TextArea
                    rows={6}
                    value={roleConfig.systemPrompt}
                    disabled
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>

                <Form.Item
                  name="customSystemPrompt"
                  label={
                    <Space>
                      <span>{t('crew.customPrompt', '自定义提示词')}</span>
                      <Tooltip title={t('crew.customPromptTip', '完全替换默认提示词')}>
                        <Tag color="orange">{t('crew.override', '覆盖')}</Tag>
                      </Tooltip>
                    </Space>
                  }
                  help={t('crew.customPromptHelp', '留空则使用默认提示词，填写后将完全替换默认提示词')}>
                  <TextArea
                    rows={6}
                    placeholder={t('crew.customPromptPlaceholder', '输入自定义系统提示词...')}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>

                <Form.Item
                  name="systemPromptAppend"
                  label={
                    <Space>
                      <span>{t('crew.appendPrompt', '追加提示词')}</span>
                      <Tooltip title={t('crew.appendPromptTip', '追加到默认或自定义提示词后面')}>
                        <Tag color="green">{t('crew.append', '追加')}</Tag>
                      </Tooltip>
                    </Space>
                  }
                  help={t('crew.appendPromptHelp', '会追加到最终提示词的末尾，类似 CLAUDE.md 的效果')}>
                  <TextArea
                    rows={4}
                    placeholder={t('crew.appendPromptPlaceholder', '输入要追加的内容，如项目特定规则...')}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'model',
            label: (
              <Space>
                <RobotOutlined />
                {t('crew.modelSettings', '模型设置')}
              </Space>
            ),
            children: (
              <Form form={form} layout="vertical">
                <Form.Item label={t('crew.currentModel', '当前模型')}>
                  <ModelSelector
                    providers={providers.filter((p) => p.enabled)}
                    value={getModelUniqId(currentMapping.model || ({ id: currentMapping.modelId } as Model))}
                    style={{ width: '100%' }}
                    disabled
                  />
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    {t('crew.modelChangeNote', '模型在角色选择区域更改')}
                  </Text>
                </Form.Item>

                <Form.Item
                  name="temperature"
                  label={t('crew.temperature', '温度')}
                  help={t('crew.temperatureHelp', '控制输出的随机性，0-1 之间')}>
                  <Slider min={0} max={1} step={0.1} marks={{ 0: '精确', 0.5: '平衡', 1: '创意' }} />
                </Form.Item>

                <Form.Item
                  name="maxTokens"
                  label={t('crew.maxTokens', '最大令牌数')}
                  help={t('crew.maxTokensHelp', '限制单次输出的最大长度')}>
                  <Slider
                    min={256}
                    max={16384}
                    step={256}
                    marks={{ 256: '256', 4096: '4K', 8192: '8K', 16384: '16K' }}
                  />
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'advanced',
            label: (
              <Space>
                <SettingOutlined />
                {t('crew.advanced', '高级')}
              </Space>
            ),
            children: (
              <Form form={form} layout="vertical">
                <Form.Item name="enabled" label={t('crew.roleEnabled', '启用角色')} valuePropName="checked">
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="expertiseTags"
                  label={t('crew.expertiseTags', '专长标签')}
                  help={t('crew.expertiseTagsHelp', '用逗号分隔，用于任务自动匹配')}>
                  <Input placeholder={t('crew.expertiseTagsPlaceholder', 'React, TypeScript, 前端优化...')} />
                </Form.Item>

                <Card size="small" title={t('crew.roleCapabilities', '角色能力')} style={{ marginTop: 16 }}>
                  <Space wrap>
                    {roleConfig.capabilities.map((cap) => (
                      <Tag key={cap}>{cap}</Tag>
                    ))}
                  </Space>
                </Card>

                <Card size="small" title={t('crew.roleSpecialties', '专业领域')} style={{ marginTop: 12 }}>
                  <Space wrap>
                    {roleConfig.specialties.map((spec) => (
                      <Tag key={spec} color="blue">
                        {spec}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              </Form>
            )
          }
        ]}
      />
    </Drawer>
  )
}

// ==================== 项目指令编辑器 ====================

interface ProjectInstructionsEditorProps {
  visible: boolean
  onClose: () => void
}

const ProjectInstructionsEditor: FC<ProjectInstructionsEditorProps> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const configManager = useMemo(() => getCrewConfigManager(), [])
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    if (visible) {
      setInstructions(configManager.getProjectInstructions())
    }
  }, [visible, configManager])

  const handleSave = () => {
    configManager.setProjectInstructions(instructions)
    message.success(t('crew.projectInstructionsSaved', '项目指令已保存'))
    onClose()
  }

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>{t('crew.projectInstructions', '项目指令 (CLAUDE.md)')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      width={700}
      okText={t('common.save', '保存')}
      cancelText={t('common.cancel', '取消')}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('crew.projectInstructionsHelp', '这些指令会追加到所有角色的系统提示词中，类似于 CLAUDE.md 的效果。')}
      </Text>
      <TextArea
        rows={16}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={t(
          'crew.projectInstructionsPlaceholder',
          `# 项目规范

## 代码风格
- 使用 TypeScript
- 使用函数式组件
- 使用 styled-components

## 命名规范
- 组件使用 PascalCase
- 函数使用 camelCase

## 其他要求
- 所有代码需要添加注释
- 确保类型安全
`
        )}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
    </Modal>
  )
}

// ==================== 主组件 ====================

const MultiModelCodeCrewPanel: FC<Props> = ({
  onClose,
  onFilesGenerated,
  onRunningChange,
  onFilesApplied,
  currentFile
}) => {
  const { t } = useTranslation()
  const configManager = useMemo(() => getCrewConfigManager(), [])

  // 从 Redux 获取 providers
  const providers = useSelector((state: RootState) => state.llm.providers)
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers])

  // Crew 事件订阅
  const crewEvents = useCrewEvents()

  // 面板模式: 'chat' | 'team'
  const [panelMode, setPanelMode] = useState<PanelMode>('chat')

  // 视图模式: 'config' | 'running' | 'visualization'
  const [viewMode, setViewMode] = useState<'config' | 'running' | 'visualization'>('config')

  // 聊天状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [selectedChatModel, setSelectedChatModel] = useState<string>('')
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  // 工具调用状态
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([])
  const [enableToolCalling, setEnableToolCalling] = useState(true)
  const [workingDirectory, setWorkingDirectory] = useState<string>('')

  // Abort controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null)

  // 团队模式状态
  const [requirement, setRequirement] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<CrewRole[]>(['architect', 'developer', 'reviewer', 'tester'])
  const [roleModels, setRoleModels] = useState<RoleModelMapping[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [session, setSession] = useState<CrewSession | null>(null)
  const [progress, setProgress] = useState<CrewProgress | null>(null)
  const [members, setMembers] = useState<CrewMember[]>([])
  const [events, setEvents] = useState<CrewEvent[]>([])
  const [files, setFiles] = useState<CodeFile[]>([])
  const [issues, setIssues] = useState<CodeIssue[]>([])

  // 设置抽屉状态
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false)
  const [maxParallelTasks, setMaxParallelTasks] = useState(2)
  const [enableAutoReview, setEnableAutoReview] = useState(true)
  const [enableAutoTest, setEnableAutoTest] = useState(true)

  // 配置编辑器状态
  const [editingRole, setEditingRole] = useState<CrewRole | null>(null)
  const [showProjectInstructions, setShowProjectInstructions] = useState(false)

  const orchestratorRef = useRef<CodeCrewOrchestrator | null>(null)

  // 自动滚动到聊天底部
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // 初始化默认聊天模型
  useEffect(() => {
    if (!selectedChatModel && enabledProviders.length > 0) {
      const firstProvider = enabledProviders[0]
      if (firstProvider.models.length > 0) {
        setSelectedChatModel(getModelUniqId(firstProvider.models[0]))
      }
    }
  }, [enabledProviders, selectedChatModel])

  // 初始化工作目录 (从当前文件路径推断)
  useEffect(() => {
    if (currentFile?.path && !workingDirectory) {
      // 从文件路径推断项目根目录（假设是最接近的包含 package.json 的目录）
      const dir = currentFile.path.replace(/[/\\][^/\\]+$/, '')
      setWorkingDirectory(dir)
    }
  }, [currentFile, workingDirectory])

  // 发送聊天消息（带 Agentic Tool Calling）
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    // 先解析 @ 快捷指令
    const { resolvedText, contextAdditions } = await resolveQuickCommands(chatInput.trim(), {
      workingDirectory: workingDirectory || undefined,
      currentFilePath: currentFile?.path,
      currentSelection: currentFile?.content?.slice(0, 2000) // 简单处理，取前2000字符作为选中内容
    })

    // 构建最终的用户消息（包含解析后的上下文）
    let finalContent = resolvedText
    if (contextAdditions.length > 0) {
      finalContent = `${resolvedText}\n\n---\n## 上下文引用\n${contextAdditions.join('\n\n')}`
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(), // 显示原始输入
      timestamp: new Date()
    }

    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)
    setToolActivities([])

    // 创建助手消息占位
    const assistantMessageId = `msg_${Date.now() + 1}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }
    setChatMessages((prev) => [...prev, assistantMessage])

    // Create abort controller
    abortControllerRef.current = new AbortController()

    try {
      // 解析选择的模型
      const resolved = resolveModelUniqId(selectedChatModel)
      if (!resolved) {
        throw new Error('No model selected')
      }

      // 获取 Provider 和 Model - 使用 providerId 精确查找
      const provider = enabledProviders.find((p) => p.id === resolved.providerId)
      if (!provider) {
        throw new Error('Provider not found')
      }
      const model = provider.models.find((m) => m.id === resolved.modelId)
      if (!model) {
        throw new Error('Model not found')
      }

      // 获取项目指令
      const projectInstructions = configManager.getProjectInstructions()

      // 构建基础系统提示词
      let basePrompt =
        '你是一个专业的编程助手，帮助用户完成编码任务。当用户需要你生成代码时，请直接给出完整的代码，不要省略。'

      if (projectInstructions) {
        basePrompt += `\n\n## 项目指令\n${projectInstructions}`
      }

      // 构建带工具的系统提示词
      const systemPrompt = buildSystemPromptWithTools(basePrompt, {
        workingDirectory: workingDirectory || undefined,
        currentFilePath: currentFile?.path,
        enableTools: enableToolCalling
      })

      // 构建历史对话
      const historyContext = chatMessages
        .filter((m) => m.role !== 'tool' && !m.isToolResult)
        .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
        .join('\n\n')

      // Agentic Loop
      let currentResponse = ''
      let iteration = 0
      const maxIterations = 10
      // 累积对话上下文 - 使用解析后的内容
      let conversationContext = historyContext ? `${historyContext}\n\n用户: ${finalContent}` : finalContent

      while (iteration < maxIterations) {
        iteration++
        logger.debug(`Agentic loop iteration ${iteration}`)

        // 使用流式输出调用 AI
        let streamedContent = ''
        const response = await fetchGenerateStream({
          prompt: systemPrompt,
          content: conversationContext,
          model: model,
          signal: abortControllerRef.current?.signal,
          onChunk: (chunk) => {
            // 处理流式 chunk
            if (chunk.type === ChunkType.TEXT_DELTA && chunk.text) {
              streamedContent += chunk.text
              // 实时更新消息内容（去掉工具调用块以获得更好的显示效果）
              const displayContent = removeToolCallBlocks(streamedContent) || streamedContent
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: displayContent || '正在思考...', isStreaming: true }
                    : m
                )
              )
            }
          }
        })

        if (!response) {
          throw new Error('Empty response from model')
        }

        // 检查是否有工具调用
        if (!enableToolCalling || !hasToolCalls(response)) {
          // 没有工具调用，结束循环
          const textContent = removeToolCallBlocks(response) || response
          currentResponse = textContent

          // 更新助手消息
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: textContent, isStreaming: false } : m
            )
          )
          break
        }

        // 解析工具调用
        const toolCalls = parseToolCalls(response)

        if (toolCalls.length === 0) {
          // 解析失败，结束循环
          const textContent = removeToolCallBlocks(response) || response
          currentResponse = textContent

          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: textContent, isStreaming: false } : m
            )
          )
          break
        }

        // 显示 AI 思考内容（去掉工具调用块）
        const thinkingContent = removeToolCallBlocks(response)
        if (thinkingContent) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: thinkingContent, isStreaming: true, toolCalls }
                : m
            )
          )
        }

        // 执行工具调用 (并行执行)
        const toolResults: string[] = []

        // 1. 先添加所有工具活动（状态为 running）
        const activityIds = toolCalls.map((toolRequest, index) => {
          const activityId = `${toolRequest.toolName}_${Date.now()}_${index}`
          setToolActivities((prev) => [
            ...prev,
            {
              id: activityId,
              toolName: toolRequest.toolName,
              status: 'running',
              arguments: toolRequest.params as Record<string, unknown>,
              timestamp: new Date()
            }
          ])
          return activityId
        })

        // 2. 并行执行所有工具
        const toolPromises = toolCalls.map(async (toolRequest, index) => {
          const activityId = activityIds[index]
          const startTime = Date.now()
          try {
            const result = await executeToolCall(toolRequest, workingDirectory || undefined)
            const duration = Date.now() - startTime

            // 更新工具活动状态
            setToolActivities((prev) =>
              prev.map((a) =>
                a.id === activityId
                  ? {
                      ...a,
                      status: result.result.success ? 'success' : 'error',
                      result: result.formattedOutput,
                      error: result.result.error
                    }
                  : a
              )
            )

            // 记录到历史
            toolCallHistory.addRecord({
              toolName: toolRequest.toolName,
              arguments: toolRequest.params as Record<string, unknown>,
              result: result.formattedOutput,
              error: result.result.error,
              success: result.result.success,
              duration,
              sessionId: assistantMessageId
            })

            return {
              toolName: toolRequest.toolName,
              output: result.formattedOutput,
              success: result.result.success
            }
          } catch (err) {
            const duration = Date.now() - startTime
            const errorMsg = err instanceof Error ? err.message : String(err)
            setToolActivities((prev) =>
              prev.map((a) =>
                a.id === activityId
                  ? { ...a, status: 'error', error: errorMsg }
                  : a
              )
            )

            // 记录错误到历史
            toolCallHistory.addRecord({
              toolName: toolRequest.toolName,
              arguments: toolRequest.params as Record<string, unknown>,
              error: errorMsg,
              success: false,
              duration,
              sessionId: assistantMessageId
            })

            return {
              toolName: toolRequest.toolName,
              output: `Error: ${errorMsg}`,
              success: false
            }
          }
        })

        // 3. 等待所有工具完成
        const results = await Promise.all(toolPromises)

        // 4. 收集工具结果
        for (const result of results) {
          toolResults.push(`[Tool Result: ${result.toolName}]\n${result.output}`)
        }

        // 累积 AI 响应和工具结果到对话上下文
        conversationContext += `\n\nAI: ${response}\n\n${toolResults.join('\n\n')}`
      }

      if (iteration >= maxIterations) {
        logger.warn('Agentic loop reached max iterations')
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: currentResponse || '已达到最大工具调用次数限制。请简化你的请求。',
                  isStreaming: false
                }
              : m
          )
        )
      }
    } catch (error) {
      // 处理用户中断
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted')) {
        logger.info('Chat aborted by user')
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: m.content || '已中断', isStreaming: false }
              : m
          )
        )
      } else {
        logger.error('Chat error:', error instanceof Error ? error : new Error(String(error)))
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: `发生错误: ${error instanceof Error ? error.message : '请重试'}`, isStreaming: false }
              : m
          )
        )
      }
    } finally {
      setIsChatLoading(false)
      abortControllerRef.current = null
    }
  }, [chatInput, isChatLoading, chatMessages, selectedChatModel, configManager, currentFile, enabledProviders, enableToolCalling, workingDirectory])

  // 通知父组件运行状态变化
  useEffect(() => {
    onRunningChange?.(isRunning)
  }, [isRunning, onRunningChange])

  // 初始化角色模型映射
  useEffect(() => {
    const mappings: RoleModelMapping[] = selectedRoles.map((role) => {
      const roleConfig = CREW_ROLE_CONFIGS[role]
      const customConfig = configManager.getRoleConfig(role)

      // 优先使用自定义配置的模型
      let providerId: string = customConfig.modelConfig?.provider || roleConfig.recommendedProvider
      let modelId: string = customConfig.modelConfig?.modelId || roleConfig.recommendedModel

      // 尝试找到实际的模型对象
      let model: Model | undefined
      for (const p of enabledProviders) {
        if (p.id === providerId || p.id.includes(providerId)) {
          const found = p.models.find((m) => m.id === modelId || m.id.includes(modelId))
          if (found) {
            model = found
            providerId = p.id
            break
          }
        }
      }

      // 如果没找到，使用第一个可用的模型
      if (!model && enabledProviders.length > 0) {
        const firstProvider = enabledProviders[0]
        if (firstProvider.models.length > 0) {
          model = firstProvider.models[0]
          providerId = firstProvider.id
          modelId = model.id
        }
      }

      return {
        role,
        providerId,
        modelId,
        model
      }
    })
    setRoleModels(mappings)
  }, [selectedRoles, enabledProviders, configManager])

  // 切换角色选择
  const toggleRole = useCallback((role: CrewRole) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role)
      }
      return [...prev, role]
    })
  }, [])

  // 更新角色模型
  const updateRoleModel = useCallback(
    (role: CrewRole, modelUniqId: string) => {
      const resolved = resolveModelUniqId(modelUniqId)
      if (!resolved) return

      // 找到模型对象
      let model: Model | undefined
      for (const p of enabledProviders) {
        if (p.id === resolved.providerId) {
          model = p.models.find((m) => m.id === resolved.modelId)
          break
        }
      }

      setRoleModels((prev) =>
        prev.map((m) =>
          m.role === role ? { ...m, providerId: resolved.providerId, modelId: resolved.modelId, model } : m
        )
      )

      // 同时更新配置管理器
      configManager.updateRoleConfig(role, {
        modelConfig: {
          provider: resolved.providerId as ModelProvider,
          modelId: resolved.modelId
        }
      })

      // 反馈配置成功
      const roleConfig = CREW_ROLE_CONFIGS[role]
      message.success(t('crew.modelUpdated', `${roleConfig.displayName} 模型已更新`))
    },
    [enabledProviders, configManager, t]
  )

  // 保存角色配置
  const handleSaveRoleConfig = useCallback(
    (config: Partial<RoleCustomConfig>) => {
      if (!config.role) return
      configManager.updateRoleConfig(config.role, config)
      message.success(t('crew.roleConfigSaved', '角色配置已保存'))
    },
    [configManager, t]
  )

  // 启动协同任务
  const handleStart = useCallback(async () => {
    if (!requirement.trim()) {
      message.warning(t('crew.requirementRequired', '请输入需求描述'))
      return
    }

    if (selectedRoles.length === 0) {
      message.warning(t('crew.rolesRequired', '请选择至少一个角色'))
      return
    }

    setIsRunning(true)
    setViewMode('running')
    setEvents([])
    setFiles([])
    setIssues([])

    // 构建配置
    const roleModelConfig: Record<string, { provider: string; modelId: string }> = {}
    for (const mapping of roleModels) {
      roleModelConfig[mapping.role] = {
        provider: mapping.providerId,
        modelId: mapping.modelId
      }
    }

    // 创建协调器
    const orchestrator = new CodeCrewOrchestrator({
      enabledRoles: selectedRoles,
      roleModels: roleModelConfig as any,
      maxParallelTasks: 2,
      enableAutoReview: true,
      enableAutoTest: true
    })

    orchestratorRef.current = orchestrator

    // 订阅 crew 事件（用于可视化）
    crewEvents.subscribe(`crew_${Date.now()}`)

    // 注册事件处理器
    const eventTypes = [
      'session_started',
      'session_completed',
      'session_failed',
      'phase_changed',
      'task_started',
      'task_completed',
      'task_failed',
      'file_generated',
      'issue_found'
    ] as const

    for (const eventType of eventTypes) {
      orchestrator.on(eventType, (event: CrewEvent) => {
        setEvents((prev) => [...prev, event])

        // 转发到可视化 hook
        crewEvents.handleEvent(event)

        // 更新进度
        const currentProgress = orchestrator.getProgress()
        if (currentProgress) {
          setProgress(currentProgress)
        }

        // 更新成员状态
        const currentSession = orchestrator.getSession()
        if (currentSession) {
          setSession(currentSession)
          setMembers([...currentSession.members])
        }

        // 处理文件生成
        if (eventType === 'file_generated' && event.data.file) {
          const file = event.data.file as CodeFile
          setFiles((prev) => {
            const existing = prev.findIndex((f) => f.path === file.path)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = file
              return updated
            }
            return [...prev, file]
          })
        }

        // 处理问题发现
        if (eventType === 'issue_found' && event.data.issue) {
          const issue = event.data.issue as CodeIssue
          setIssues((prev) => [...prev, issue])
        }
      })
    }

    try {
      // 初始化并执行
      await orchestrator.initSession({
        name: `Crew_${Date.now()}`,
        description: requirement.slice(0, 100),
        requirement
      })

      const result = await orchestrator.execute(requirement)

      // 更新最终结果
      setFiles(result.files)
      setIssues(result.issues)

      // 通知父组件
      if (onFilesGenerated && result.files.length > 0) {
        onFilesGenerated(result.files)
      }

      message.success(t('crew.completed', '协同任务完成'))
    } catch (error) {
      logger.error('Crew execution failed:', error instanceof Error ? error : new Error(String(error)))
      message.error(t('crew.failed', '协同任务失败'))
    } finally {
      setIsRunning(false)
    }
  }, [requirement, selectedRoles, roleModels, t, onFilesGenerated, crewEvents])

  // 停止任务
  const handleStop = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.stop()
      setIsRunning(false)
      message.info(t('crew.stopped', '任务已停止'))
    }
  }, [t])

  // 重置
  const handleReset = useCallback(() => {
    setSession(null)
    setProgress(null)
    setMembers([])
    setEvents([])
    setFiles([])
    setIssues([])
    setViewMode('config')
    orchestratorRef.current = null
    crewEvents.unsubscribe()
    crewEvents.clearLogs()
    crewEvents.clearActivities()
  }, [crewEvents])

  // 应用文件到 Canvas
  const handleApplyFiles = useCallback(async () => {
    if (files.length === 0) {
      message.warning(t('crew.noFiles', '没有可应用的文件'))
      return
    }

    try {
      let successCount = 0
      let failCount = 0

      for (const file of files) {
        if (file.action === 'create' || file.action === 'modify') {
          if (window.api?.canvas) {
            // 获取文件名（最后一部分）
            const fileName = file.path.split('/').pop() || file.path

            try {
              // 先尝试创建文件（忽略如果已存在）
              const createResult = (await window.api.canvas.createFile(fileName)) as {
                success: boolean
                data?: { path: string }
                error?: string
              }
              if (createResult?.success || createResult?.error === 'File already exists') {
                // 使用返回的完整路径来保存内容
                const filePath = createResult?.data?.path || fileName
                const saveResult = (await window.api.canvas.saveFile({
                  path: filePath,
                  content: file.content
                })) as { success: boolean; error?: string }

                if (saveResult?.success) {
                  successCount++
                } else {
                  failCount++
                  logger.error('Failed to save file:', { fileName, error: saveResult?.error })
                }
              } else {
                failCount++
                logger.error('Failed to create file:', { fileName, error: createResult?.error })
              }
            } catch (err) {
              failCount++
              logger.error('Failed to apply file:', {
                fileName,
                error: err instanceof Error ? err : new Error(String(err))
              })
            }
          }
        }
      }

      if (failCount === 0) {
        message.success(t('crew.applied', `已成功应用 ${successCount} 个文件`))
        // 通知父组件刷新文件列表
        onFilesApplied?.()
      } else if (successCount > 0) {
        message.warning(t('crew.partialApply', `应用完成：${successCount} 成功，${failCount} 失败`))
        // 部分成功也刷新
        onFilesApplied?.()
      } else {
        message.error(t('crew.applyFailed', '应用失败'))
      }
    } catch (err) {
      logger.error('Apply files error:', err instanceof Error ? err : new Error(String(err)))
      message.error(t('crew.applyFailed', '应用失败'))
    }
  }, [files, t, onFilesApplied])

  // 获取当前阶段索引
  const getCurrentPhaseIndex = useCallback(() => {
    if (!progress) return 0
    const index = PHASE_STEPS.findIndex((s) => s.phase === progress.phase)
    return index >= 0 ? index : 0
  }, [progress])

  // 获取当前编辑角色的映射
  const editingRoleMapping = useMemo(() => {
    if (!editingRole) return null
    return roleModels.find((m) => m.role === editingRole) || null
  }, [editingRole, roleModels])

  // 获取工具图标
  const getToolIcon = useCallback((toolName: string): React.ReactNode => {
    switch (toolName) {
      case 'read_file':
        return <FileOutlined style={{ fontSize: 12 }} />
      case 'list_directory':
        return <FolderOpenOutlined style={{ fontSize: 12 }} />
      case 'search_files':
        return <SearchOutlined style={{ fontSize: 12 }} />
      case 'grep_search':
        return <SearchOutlined style={{ fontSize: 12 }} />
      case 'write_file':
        return <EditOutlined style={{ fontSize: 12 }} />
      case 'execute_command':
        return <ConsoleSqlOutlined style={{ fontSize: 12 }} />
      default:
        return <ToolOutlined style={{ fontSize: 12 }} />
    }
  }, [])

  // 可视化模式
  if (viewMode === 'visualization') {
    return (
      <PanelContainer>
        <PanelHeader>
          <Space>
            <TeamOutlined />
            <Title level={5} style={{ margin: 0 }}>
              {t('crew.title', '多模型协同编码')}
            </Title>
            <Tag color="processing">Vibe Coding+</Tag>
          </Space>
          <Space>
            <Button type="text" size="small" onClick={() => setViewMode(isRunning || session ? 'running' : 'config')}>
              {t('crew.backToPanel', '返回')}
            </Button>
            {onClose && (
              <Button type="text" size="small" onClick={onClose}>
                {t('common.close', '关闭')}
              </Button>
            )}
          </Space>
        </PanelHeader>
        <CrewVisualizationPanel
          snapshot={crewEvents.snapshot}
          onClearLogs={crewEvents.clearLogs}
          onClearActivities={crewEvents.clearActivities}
        />
      </PanelContainer>
    )
  }

  return (
    <PanelContainer>
      <PanelHeader>
        <Space>
          <Segmented
            value={panelMode}
            onChange={(v) => setPanelMode(v as PanelMode)}
            options={[
              {
                label: (
                  <Space size={4}>
                    <MessageOutlined />
                    对话
                  </Space>
                ),
                value: 'chat'
              },
              {
                label: (
                  <Space size={4}>
                    <TeamOutlined />
                    团队
                  </Space>
                ),
                value: 'team'
              }
            ]}
            size="small"
          />
        </Space>
        <Space>
          {panelMode === 'team' && (isRunning || session) && (
            <Tooltip title={t('crew.openVisualization', '打开可视化面板')}>
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setViewMode('visualization')} />
            </Tooltip>
          )}
          <Tooltip title={t('crew.projectInstructions', '项目指令 (CLAUDE.md)')}>
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setShowProjectInstructions(true)}
            />
          </Tooltip>
          <Tooltip title={t('crew.settings', '协同设置')}>
            <Button
              type={settingsDrawerVisible ? 'primary' : 'text'}
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setSettingsDrawerVisible(true)}
            />
          </Tooltip>
          {onClose && (
            <Button type="text" size="small" onClick={onClose}>
              {t('common.close', '关闭')}
            </Button>
          )}
        </Space>
      </PanelHeader>

      {/* 聊天模式 */}
      {panelMode === 'chat' && (
        <ChatContainer>
          {/* 模型选择和工具开关 */}
          <ChatModelBar>
            <ModelSelector
              providers={enabledProviders}
              value={selectedChatModel}
              onChange={(v) => setSelectedChatModel(v as string)}
              style={{ flex: 1 }}
              size="small"
            />
            <Tooltip title={enableToolCalling ? '禁用工具调用（Claude Code 模式）' : '启用工具调用（Claude Code 模式）'}>
              <Button
                type={enableToolCalling ? 'primary' : 'text'}
                size="small"
                icon={<ToolOutlined />}
                onClick={() => setEnableToolCalling(!enableToolCalling)}
                style={{ marginLeft: 8 }}
              />
            </Tooltip>
          </ChatModelBar>

          {/* 工具活动面板 */}
          {toolActivities.length > 0 && (
            <ToolActivitiesPanel>
              <Space style={{ marginBottom: 8 }}>
                <ToolOutlined />
                <Text strong style={{ fontSize: 12 }}>工具调用</Text>
                <Tag>{toolActivities.length}</Tag>
              </Space>
              <Collapse
                size="small"
                expandIconPosition="end"
                items={toolActivities.map((activity) => ({
                  key: activity.id,
                  label: (
                    <Space size={8}>
                      {activity.status === 'running' ? (
                        <LoadingOutlined spin style={{ fontSize: 12 }} />
                      ) : activity.status === 'success' ? (
                        <CheckCircleOutlined style={{ fontSize: 12, color: 'var(--ant-color-success)' }} />
                      ) : activity.status === 'error' ? (
                        <CloseCircleOutlined style={{ fontSize: 12, color: 'var(--ant-color-error)' }} />
                      ) : (
                        <LoadingOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                      )}
                      <Text style={{ fontSize: 12 }}>
                        {getToolIcon(activity.toolName)} {activity.toolName}
                      </Text>
                      {(() => {
                        const pathArg = activity.arguments?.path
                        if (typeof pathArg === 'string') {
                          return (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {pathArg.split(/[/\\]/).pop()}
                            </Text>
                          )
                        }
                        return null
                      })()}
                    </Space>
                  ),
                  children: (
                    <ToolActivityDetail>
                      {activity.arguments && Object.keys(activity.arguments).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>参数:</Text>
                          <ToolOutputPre>
                            {JSON.stringify(activity.arguments, null, 2)}
                          </ToolOutputPre>
                        </div>
                      )}
                      {activity.result && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>输出:</Text>
                          <ToolOutputPre $error={activity.status === 'error'}>
                            {activity.result.length > 500
                              ? activity.result.slice(0, 500) + '\n... (truncated)'
                              : activity.result}
                          </ToolOutputPre>
                        </div>
                      )}
                      {activity.error && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, color: 'var(--ant-color-error)' }}>
                            错误:
                          </Text>
                          <ToolOutputPre $error>{activity.error}</ToolOutputPre>
                        </div>
                      )}
                    </ToolActivityDetail>
                  )
                }))}
              />
            </ToolActivitiesPanel>
          )}

          {/* 消息列表 */}
          <ChatMessagesContainer>
            {chatMessages.length === 0 ? (
              <ChatEmptyState>
                <RobotOutlined style={{ fontSize: 48, color: 'var(--color-text-3)' }} />
                <Text type="secondary">开始对话，描述你的编程需求</Text>
                {enableToolCalling && (
                  <Tag color="blue" style={{ marginTop: 8 }}>
                    <ToolOutlined /> Claude Code 模式已启用
                  </Tag>
                )}
                {currentFile && (
                  <CurrentFileInfo>
                    <CodeOutlined />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {currentFile.name} ({currentFile.content.split('\n').length} 行)
                    </Text>
                  </CurrentFileInfo>
                )}
                {workingDirectory && (
                  <CurrentFileInfo>
                    <FolderOpenOutlined />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {workingDirectory}
                    </Text>
                  </CurrentFileInfo>
                )}
                <Space wrap style={{ marginTop: 12 }}>
                  <Tag
                    color="cyan"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setChatInput('查看这个项目的目录结构')}>
                    查看目录
                  </Tag>
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setChatInput('搜索所有 React 组件文件')}>
                    搜索组件
                  </Tag>
                  {currentFile && (
                    <Tag
                      color="green"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setChatInput('阅读并分析当前打开的文件')}>
                      分析代码
                    </Tag>
                  )}
                  <Tag color="orange" style={{ cursor: 'pointer' }} onClick={() => setChatInput('帮我优化这段代码')}>
                    优化代码
                  </Tag>
                  <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => setChatInput('找到所有 TODO 注释')}>
                    查找 TODO
                  </Tag>
                </Space>
              </ChatEmptyState>
            ) : (
              <>
                {chatMessages.map((msg) => (
                  <ChatMessageItem key={msg.id} $isUser={msg.role === 'user'}>
                    <Avatar
                      size={28}
                      icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      style={{
                        backgroundColor: msg.role === 'user' ? 'var(--ant-color-primary)' : 'var(--ant-color-success)'
                      }}
                    />
                    <ChatMessageContent $isUser={msg.role === 'user'}>
                      {msg.isStreaming ? (
                        <Space direction="vertical" size={4}>
                          {msg.content && (
                            msg.role === 'user' ? (
                              <ChatMessageText>{msg.content}</ChatMessageText>
                            ) : (
                              <MarkdownWrapper>
                                <Markdown
                                  block={{
                                    id: msg.id,
                                    messageId: msg.id,
                                    content: msg.content,
                                    status: MessageBlockStatus.STREAMING,
                                    type: MessageBlockType.MAIN_TEXT,
                                    createdAt: msg.timestamp.toISOString()
                                  }}
                                />
                              </MarkdownWrapper>
                            )
                          )}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <ToolCallsIndicator>
                              <LoadingOutlined spin />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                正在执行 {msg.toolCalls.map((tc) => tc.toolName).join(', ')}...
                              </Text>
                            </ToolCallsIndicator>
                          )}
                          {!msg.toolCalls && (
                            <Space>
                              <LoadingOutlined />
                              <Text type="secondary">正在思考...</Text>
                            </Space>
                          )}
                        </Space>
                      ) : msg.role === 'user' ? (
                        <ChatMessageText>{msg.content}</ChatMessageText>
                      ) : (
                        <>
                          <MarkdownWrapper>
                            <Markdown
                              block={{
                                id: msg.id,
                                messageId: msg.id,
                                content: msg.content,
                                status: MessageBlockStatus.SUCCESS,
                                type: MessageBlockType.MAIN_TEXT,
                                createdAt: msg.timestamp.toISOString()
                              }}
                            />
                          </MarkdownWrapper>
                          <MessageActions>
                            <Tooltip title="复制">
                              <Button
                                type="text"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content)
                                  message.success('已复制到剪贴板')
                                }}
                              />
                            </Tooltip>
                          </MessageActions>
                        </>
                      )}
                    </ChatMessageContent>
                  </ChatMessageItem>
                ))}
                <div ref={chatMessagesEndRef} />
              </>
            )}
          </ChatMessagesContainer>

          {/* 输入区域 */}
          <ChatInputContainer>
            <QuickCommandInput
              value={chatInput}
              onChange={setChatInput}
              onSend={handleSendChat}
              placeholder="描述你的编程需求... (Enter 发送, @ 触发快捷指令)"
              disabled={isChatLoading}
              loading={isChatLoading}
              workingDirectory={workingDirectory}
              currentFilePath={currentFile?.path}
              currentSelection={currentFile?.content?.slice(0, 2000)}
              minRows={1}
              maxRows={4}
            />
            {isChatLoading ? (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  abortControllerRef.current?.abort()
                  setIsChatLoading(false)
                }}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
              />
            )}
          </ChatInputContainer>
        </ChatContainer>
      )}

      {/* 团队模式 */}
      {panelMode === 'team' && (
        <PanelBody>
          {!isRunning && !session ? (
            // 配置界面
            <ConfigSection>
              <Text type="secondary">{t('crew.description', '组建多模型 AI 团队，协同完成复杂编码任务')}</Text>

              {/* 需求输入 */}
              <FormSection>
                <Text strong>{t('crew.requirement', '任务需求')}</Text>
                <TextArea
                  rows={4}
                  placeholder={t('crew.requirementPlaceholder', '描述你想要实现的功能...')}
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                />
              </FormSection>

              {/* 角色选择 */}
              <FormSection>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>{t('crew.selectRoles', '选择团队角色')}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('crew.clickEditPrompt', '点击编辑按钮配置角色提示词')}
                  </Text>
                </Space>
                <RoleGrid>
                  {(Object.keys(CREW_ROLE_CONFIGS) as CrewRole[]).map((role) => {
                    const config = CREW_ROLE_CONFIGS[role]
                    const isSelected = selectedRoles.includes(role)
                    const mapping = roleModels.find((m) => m.role === role)
                    return (
                      <RoleCard key={role} $selected={isSelected}>
                        <RoleCardContent onClick={() => toggleRole(role)}>
                          <Avatar size={32}>{config.icon}</Avatar>
                          <RoleInfo>
                            <Text strong>{config.displayName}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {mapping?.model?.name || config.recommendedModel}
                            </Text>
                          </RoleInfo>
                          {isSelected && <CheckCircleOutlined style={{ color: 'var(--ant-color-primary)' }} />}
                        </RoleCardContent>
                        {isSelected && (
                          <EditButton
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingRole(role)
                            }}
                          />
                        )}
                      </RoleCard>
                    )
                  })}
                </RoleGrid>
              </FormSection>

              {/* 启动按钮 */}
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                disabled={!requirement.trim() || selectedRoles.length === 0}
                block>
                {t('crew.start', '启动协同')}
              </Button>
            </ConfigSection>
          ) : (
            // 运行中界面
            <RunningSection>
              {/* 进度步骤 */}
              <Steps
                current={getCurrentPhaseIndex()}
                size="small"
                items={PHASE_STEPS.map((step, index) => ({
                  title: step.title,
                  icon: isRunning && getCurrentPhaseIndex() === index ? <LoadingOutlined /> : step.icon,
                  status:
                    index < getCurrentPhaseIndex() ? 'finish' : index === getCurrentPhaseIndex() ? 'process' : 'wait'
                }))}
              />

              {/* 进度条 */}
              {progress && (
                <ProgressSection>
                  <Progress
                    percent={Math.round((progress.completedTasks / Math.max(progress.totalTasks, 1)) * 100)}
                    status={isRunning ? 'active' : 'normal'}
                  />
                  <Text type="secondary">
                    {progress.completedTasks}/{progress.totalTasks} 任务完成
                  </Text>
                </ProgressSection>
              )}

              {/* 团队状态 */}
              <Collapse
                defaultActiveKey={['members']}
                items={[
                  {
                    key: 'members',
                    label: (
                      <Space>
                        <TeamOutlined />
                        {t('crew.teamStatus', '团队状态')}
                        <Tag color="blue">{members.length} 人</Tag>
                      </Space>
                    ),
                    children: (
                      <List
                        size="small"
                        dataSource={members}
                        renderItem={(member) => {
                          const config = CREW_ROLE_CONFIGS[member.role]
                          return (
                            <List.Item>
                              <List.Item.Meta
                                avatar={<Avatar size="small">{config.icon}</Avatar>}
                                title={member.name}
                                description={
                                  <Space>
                                    <Badge
                                      status={
                                        member.status === 'working'
                                          ? 'processing'
                                          : member.status === 'error'
                                            ? 'error'
                                            : 'default'
                                      }
                                      text={
                                        member.status === 'working'
                                          ? '工作中'
                                          : member.status === 'error'
                                            ? '错误'
                                            : '空闲'
                                      }
                                    />
                                    <Tag>{member.modelConfig.provider}</Tag>
                                  </Space>
                                }
                              />
                            </List.Item>
                          )
                        }}
                      />
                    )
                  }
                ]}
              />

              {/* 事件时间线 */}
              <EventsSection>
                <Text strong>{t('crew.events', '协同记录')}</Text>
                {events.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crew.noEvents', '暂无记录')} />
                ) : (
                  <Timeline
                    items={events.slice(-10).map((event) => ({
                      dot:
                        event.type === 'task_completed' ? (
                          <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />
                        ) : event.type === 'task_failed' ? (
                          <CloseCircleOutlined style={{ color: 'var(--ant-color-error)' }} />
                        ) : (
                          <RobotOutlined />
                        ),
                      children: (
                        <EventItem>
                          <Text strong>{event.type.replace(/_/g, ' ')}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </Text>
                        </EventItem>
                      )
                    }))}
                  />
                )}
              </EventsSection>

              {/* 生成的文件 */}
              {files.length > 0 && (
                <FilesSection>
                  <Text strong>
                    {t('crew.generatedFiles', '生成的文件')} ({files.length})
                  </Text>
                  <List
                    size="small"
                    dataSource={files}
                    renderItem={(file) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<CodeOutlined />}
                          title={file.path}
                          description={
                            <Tag color={file.action === 'create' ? 'green' : file.action === 'modify' ? 'blue' : 'red'}>
                              {file.action}
                            </Tag>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </FilesSection>
              )}

              {/* 发现的问题 */}
              {issues.length > 0 && (
                <IssuesSection>
                  <Text strong>
                    {t('crew.issues', '发现的问题')} ({issues.length})
                  </Text>
                  <List
                    size="small"
                    dataSource={issues}
                    renderItem={(issue) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <Tag
                              color={
                                issue.severity === 'critical' || issue.severity === 'error'
                                  ? 'red'
                                  : issue.severity === 'warning'
                                    ? 'orange'
                                    : 'blue'
                              }>
                              {issue.severity}
                            </Tag>
                          }
                          title={issue.message}
                          description={`${issue.file}${issue.line ? `:${issue.line}` : ''}`}
                        />
                      </List.Item>
                    )}
                  />
                </IssuesSection>
              )}

              {/* 团队对话区域 */}
              <TeamChatSection>
                <Text strong>{t('crew.teamChat', '与团队对话')}</Text>
                {currentFile && (
                  <CurrentFileInfo>
                    <CodeOutlined />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      当前文件: {currentFile.name}
                    </Text>
                  </CurrentFileInfo>
                )}
                <TeamChatMessages>
                  {chatMessages.length === 0 ? (
                    <Text type="secondary" style={{ textAlign: 'center', padding: 16 }}>
                      向团队发送消息或反馈...
                    </Text>
                  ) : (
                    chatMessages.slice(-5).map((msg) => (
                      <ChatMessageItem key={msg.id} $isUser={msg.role === 'user'}>
                        <Avatar
                          size={24}
                          icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                          style={{
                            backgroundColor: msg.role === 'user' ? 'var(--ant-color-primary)' : 'var(--ant-color-success)'
                          }}
                        />
                        <ChatMessageContent $isUser={msg.role === 'user'}>
                          {msg.isStreaming ? (
                            <Space>
                              <LoadingOutlined />
                              <Text type="secondary">思考中...</Text>
                            </Space>
                          ) : msg.role === 'user' ? (
                            <ChatMessageText style={{ fontSize: 13 }}>{msg.content}</ChatMessageText>
                          ) : (
                            <MarkdownWrapper $compact>
                              <Markdown
                                block={{
                                  id: msg.id,
                                  messageId: msg.id,
                                  content: msg.content,
                                  status: MessageBlockStatus.SUCCESS,
                                  type: MessageBlockType.MAIN_TEXT,
                                  createdAt: msg.timestamp.toISOString()
                                }}
                              />
                            </MarkdownWrapper>
                          )}
                        </ChatMessageContent>
                      </ChatMessageItem>
                    ))
                  )}
                </TeamChatMessages>
                <ChatInputContainer>
                  <TextArea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="向团队发送消息... (Enter 发送)"
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendChat()
                      }
                    }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    icon={isChatLoading ? <LoadingOutlined /> : <SendOutlined />}
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || isChatLoading}
                  />
                </ChatInputContainer>
              </TeamChatSection>

              {/* 控制按钮 */}
              <ControlSection>
                {isRunning ? (
                  <Button danger icon={<StopOutlined />} onClick={handleStop}>
                    {t('crew.stop', '停止')}
                  </Button>
                ) : (
                  <Space>
                    <Button onClick={handleReset}>{t('crew.reset', '重新开始')}</Button>
                    <Button type="primary" onClick={handleApplyFiles} disabled={files.length === 0}>
                      {t('crew.apply', '应用更改')} ({files.length})
                    </Button>
                  </Space>
                )}
              </ControlSection>
            </RunningSection>
          )}
        </PanelBody>
      )}

      {/* 角色配置编辑器 */}
      {editingRole && editingRoleMapping && (
        <RoleConfigEditor
          role={editingRole}
          visible={!!editingRole}
          onClose={() => setEditingRole(null)}
          onSave={handleSaveRoleConfig}
          providers={enabledProviders}
          currentMapping={editingRoleMapping}
        />
      )}

      {/* 项目指令编辑器 */}
      <ProjectInstructionsEditor visible={showProjectInstructions} onClose={() => setShowProjectInstructions(false)} />

      {/* 设置抽屉 */}
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            {t('crew.settings', '协同设置')}
          </Space>
        }
        placement="right"
        width={420}
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}>
        {/* 模型配置 */}
        <Collapse
          defaultActiveKey={['models', 'options']}
          items={[
            {
              key: 'models',
              label: (
                <Space>
                  <RobotOutlined />
                  {t('crew.modelConfig', '模型配置')}
                </Space>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {roleModels.map((mapping) => {
                    const config = CREW_ROLE_CONFIGS[mapping.role]
                    return (
                      <div
                        key={mapping.role}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Avatar size="small">{config.icon}</Avatar>
                          <Text>{config.displayName}</Text>
                        </Space>
                        <ModelSelector
                          providers={enabledProviders}
                          value={mapping.model ? getModelUniqId(mapping.model) : undefined}
                          onChange={(v) => updateRoleModel(mapping.role, v as string)}
                          style={{ width: 180 }}
                          size="small"
                          showSuffix={false}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            },
            {
              key: 'options',
              label: (
                <Space>
                  <ToolOutlined />
                  {t('crew.executionOptions', '执行选项')}
                </Space>
              ),
              children: (
                <Form layout="vertical">
                  <Form.Item label={t('crew.maxParallelTasks', '最大并行任务数')}>
                    <Slider
                      min={1}
                      max={4}
                      value={maxParallelTasks}
                      onChange={setMaxParallelTasks}
                      marks={{ 1: '1', 2: '2', 3: '3', 4: '4' }}
                    />
                  </Form.Item>

                  <Form.Item label={t('crew.enableAutoReview', '自动代码审查')}>
                    <Switch checked={enableAutoReview} onChange={setEnableAutoReview} />
                    <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                      {t('crew.autoReviewTip', '开发完成后自动执行代码审查')}
                    </Text>
                  </Form.Item>

                  <Form.Item label={t('crew.enableAutoTest', '自动测试')}>
                    <Switch checked={enableAutoTest} onChange={setEnableAutoTest} />
                    <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                      {t('crew.autoTestTip', '开发完成后自动生成测试用例')}
                    </Text>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </Drawer>
    </PanelContainer>
  )
}

// ==================== 样式组件 ====================

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ant-color-bg-container);
  border-left: 1px solid var(--ant-color-border);
`

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`

const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const RoleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const RoleCard = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid
    ${(props) => (props.$selected ? 'var(--ant-color-primary)' : 'var(--ant-color-border)')};
  border-radius: var(--ant-border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  background: ${(props) => (props.$selected ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-bg-container)')};
  position: relative;

  &:hover {
    border-color: var(--ant-color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`

const RoleCardContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`

const EditButton = styled(Button)`
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
`

const RoleInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`

const RunningSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const ProgressSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const EventsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
`

const EventItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const FilesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius-lg);
`

const IssuesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius-lg);
`

const TeamChatSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--ant-color-bg-elevated);
  border-radius: var(--ant-border-radius-lg);
  border: 1px solid var(--ant-color-border);
`

const TeamChatMessages = styled.div`
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius);
`

const ControlSection = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--ant-color-border);
`

// ==================== 聊天模式样式 ====================

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  overflow: hidden;
`

const ChatModelBar = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ant-color-border);
  flex-shrink: 0;
`

const ToolActivitiesPanel = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
  flex-shrink: 0;
  max-height: 300px;
  overflow-y: auto;

  .ant-collapse {
    background: transparent;
  }

  .ant-collapse-item {
    border: 1px solid var(--ant-color-border);
    border-radius: 6px !important;
    margin-bottom: 4px;
    background: var(--ant-color-bg-container);
  }

  .ant-collapse-header {
    padding: 6px 12px !important;
  }

  .ant-collapse-content-box {
    padding: 8px 12px !important;
  }
`

const ToolActivityDetail = styled.div`
  font-size: 12px;
`

const ToolOutputPre = styled.pre<{ $error?: boolean }>`
  margin: 4px 0 0 0;
  padding: 8px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: ${(props) => (props.$error ? 'var(--ant-color-error)' : 'inherit')};
`

const ToolCallsIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--ant-color-info-bg);
  border-radius: 4px;
  margin-top: 4px;
`

const ChatMessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const ChatEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
`

const CurrentFileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--ant-color-primary-bg);
  border: 1px solid var(--ant-color-primary-border);
  border-radius: 16px;
  margin-top: 4px;
`

const ChatMessageItem = styled.div<{ $isUser: boolean }>`
  display: flex;
  gap: 10px;
  flex-direction: ${(props) => (props.$isUser ? 'row-reverse' : 'row')};
  align-items: flex-start;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: var(--ant-color-fill-quaternary);
  }
`

const ChatMessageContent = styled.div<{ $isUser: boolean }>`
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  background: ${(props) => (props.$isUser ? 'var(--ant-color-primary)' : 'var(--ant-color-bg-elevated)')};
  color: ${(props) => (props.$isUser ? 'var(--ant-color-text-light-solid)' : 'inherit')};
  border: 1px solid ${(props) => (props.$isUser ? 'transparent' : 'var(--ant-color-border)')};
`

const ChatMessageText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
`

const MarkdownWrapper = styled.div<{ $compact?: boolean }>`
  font-size: ${(props) => (props.$compact ? '13px' : '14px')};
  line-height: 1.6;

  /* 确保 markdown 内容样式正确 */
  pre {
    background: var(--ant-color-fill-tertiary);
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    margin: 8px 0;
  }

  code {
    background: var(--ant-color-fill-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
  }

  pre code {
    background: transparent;
    padding: 0;
  }

  p {
    margin: 0 0 8px 0;
  }

  p:last-child {
    margin-bottom: 0;
  }

  ul, ol {
    margin: 8px 0;
    padding-left: 20px;
  }

  table {
    border-collapse: collapse;
    margin: 8px 0;
    width: 100%;
  }

  th, td {
    border: 1px solid var(--ant-color-border);
    padding: 8px;
  }

  blockquote {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 3px solid var(--ant-color-primary);
    color: var(--ant-color-text-secondary);
  }
`

const MessageActions = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  .ant-btn {
    color: var(--ant-color-text-secondary);
  }
`

const ChatInputContainer = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
  flex-shrink: 0;

  .ant-input {
    flex: 1;
    border-radius: 8px;
  }

  .ant-btn {
    flex-shrink: 0;
  }
`

export default MultiModelCodeCrewPanel
