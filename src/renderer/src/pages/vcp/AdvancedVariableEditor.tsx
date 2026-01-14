/**
 * AdvancedVariableEditor - 高级变量编辑器
 *
 * 提供更强大的变量编辑功能：
 * - Sar 变量模型选择器
 * - 变量测试/预览功能
 * - TVStxt 文件管理
 * - 变量依赖可视化
 */

import {
  ApiOutlined,
  BugOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LinkOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import Scrollbar from '@renderer/components/Scrollbar'
import ModelSelectorButton from '@renderer/pages/workflow/components/ConfigForms/ModelSelectorButton'
import { BASIC_VARIABLES, DYNAMIC_VARIABLE_PATTERNS, type VariableDefinition } from '@shared/variables'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Typography
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { type ConflictResolution,type ImportConflict, ImportConflictModal } from './components/ImportConflictModal'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const logger = loggerService.withContext('AdvancedVariableEditor')

// ==================== 类型定义 ====================

interface PromptVariable {
  id: string
  name: string
  value: string
  description?: string
  category?: 'Tar' | 'Var' | 'Sar' | 'custom'
  scope?: 'global' | 'agent' | 'session'
  createdAt?: number
  updatedAt?: number
}

interface SarConfig {
  modelId: string
  modelName: string
  promptValue: string
  description?: string
}

interface TvsTxtFile {
  name: string
  path: string
  content: string
  size: number
  modifiedAt: Date
}

interface VariableDependency {
  from: string
  to: string
  type: 'reference' | 'nested'
}

interface TestResult {
  input: string
  output: string
  resolvedVariables: Array<{ placeholder: string; value: string }>
  errors: string[]
  warnings: string[]
}

// ==================== 常量 ====================

const CATEGORY_COLORS: Record<string, string> = {
  Tar: 'purple',
  Var: 'cyan',
  Sar: 'gold',
  custom: 'default'
}

const SCOPE_COLORS: Record<string, string> = {
  global: 'blue',
  agent: 'green',
  session: 'orange'
}

// 系统变量类别颜色
const SYSTEM_CATEGORY_COLORS: Record<string, string> = {
  datetime: 'blue',
  system: 'green',
  model: 'purple',
  cultural: 'orange',
  media: 'cyan',
  plugin: 'magenta',
  diary: 'gold',
  agent: 'lime',
  vcp: 'geekblue',
  flag: 'red'
}

// 系统变量类别名称
const SYSTEM_CATEGORY_NAMES: Record<string, string> = {
  datetime: '日期时间',
  system: '系统信息',
  model: '模型相关',
  cultural: '文化节日',
  media: '媒体资源',
  plugin: '插件变量',
  diary: '日记变量',
  agent: 'Agent 变量',
  vcp: 'VCP 扩展',
  flag: '标志变量'
}

// 常用模型列表
const COMMON_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
  { id: 'grok-3-beta', name: 'Grok 3 Beta' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'qwen-max', name: 'Qwen Max' },
  { id: 'qwen-plus', name: 'Qwen Plus' }
]

// ==================== 组件 ====================

const AdvancedVariableEditor: FC = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [sarForm] = Form.useForm()

  // 状态
  const [loading, setLoading] = useState(true)
  const [variables, setVariables] = useState<PromptVariable[]>([])
  const [activeTab, setActiveTab] = useState('editor')
  const [selectedVariable, setSelectedVariable] = useState<PromptVariable | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSarModalOpen, setIsSarModalOpen] = useState(false)

  // Sar 配置状态
  const [sarConfigs, setSarConfigs] = useState<SarConfig[]>([])

  // TVStxt 状态
  const [tvsTxtFiles, setTvsTxtFiles] = useState<TvsTxtFile[]>([])
  const [selectedTvsFile, setSelectedTvsFile] = useState<TvsTxtFile | null>(null)
  const [tvsFileContent, setTvsFileContent] = useState('')
  const [loadingTvsFiles, setLoadingTvsFiles] = useState(false)

  // 测试状态
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [testProviderId, setTestProviderId] = useState('')
  const [testModelId, setTestModelId] = useState('')

  // 导入导出状态
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([])
  const [importConflictModalOpen, setImportConflictModalOpen] = useState(false)
  const [pendingEnvContent, setPendingEnvContent] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // VCPToolBox 预设导入状态
  const [importingPresets, setImportingPresets] = useState(false)

  // ==================== 数据加载 ====================

  /**
   * 加载变量列表
   */
  const loadVariables = useCallback(async () => {
    try {
      setLoading(true)
      const result = await window.electron.ipcRenderer.invoke('vcp:variable:list')
      const data = result?.variables || result || []
      setVariables(data)

      // 解析 Sar 配置
      const sarVars = (data || []).filter((v: PromptVariable) => v.category === 'Sar')
      const configs: SarConfig[] = []
      const promptVars = sarVars.filter((v: PromptVariable) => v.name.startsWith('SarPrompt'))
      const modelVars = sarVars.filter((v: PromptVariable) => v.name.startsWith('SarModel'))

      promptVars.forEach((pv: PromptVariable) => {
        const num = pv.name.replace('SarPrompt', '')
        const modelVar = modelVars.find((mv: PromptVariable) => mv.name === `SarModel${num}`)
        if (modelVar) {
          configs.push({
            modelId: modelVar.value,
            modelName: modelVar.description || modelVar.value,
            promptValue: pv.value,
            description: pv.description
          })
        }
      })
      setSarConfigs(configs)
    } catch (error) {
      logger.error('Failed to load variables', error as Error)
      message.error(t('vcp.variables.load_failed', '加载变量失败'))
    } finally {
      setLoading(false)
    }
  }, [t])

  /**
   * 加载 TVStxt 文件列表
   */
  const loadTvsTxtFiles = useCallback(async () => {
    try {
      setLoadingTvsFiles(true)
      // 调用主进程获取 TVStxt 目录下的文件
      const files = await window.electron.ipcRenderer.invoke('vcp:tvstxt:list')
      setTvsTxtFiles(files || [])
    } catch (error) {
      logger.error('Failed to load TVStxt files', error as Error)
      // TVStxt 功能可能不存在，静默处理
      setTvsTxtFiles([])
    } finally {
      setLoadingTvsFiles(false)
    }
  }, [])

  useEffect(() => {
    loadVariables()
    loadTvsTxtFiles()
  }, [loadVariables, loadTvsTxtFiles])

  // ==================== 变量操作 ====================

  /**
   * 创建变量
   */
  const handleCreate = () => {
    setSelectedVariable(null)
    form.resetFields()
    form.setFieldsValue({ scope: 'global', category: 'Var' })
    setIsModalOpen(true)
  }

  /**
   * 编辑变量
   */
  const handleEdit = (variable: PromptVariable) => {
    setSelectedVariable(variable)
    form.setFieldsValue({
      name: variable.name,
      value: variable.value,
      description: variable.description,
      category: variable.category || 'Var',
      scope: variable.scope || 'global'
    })
    setIsModalOpen(true)
  }

  /**
   * 保存变量
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (selectedVariable) {
        await window.electron.ipcRenderer.invoke('vcp:variable:update', {
          id: selectedVariable.id,
          ...values
        })
        message.success(t('vcp.variables.update_success', '变量更新成功'))
      } else {
        await window.electron.ipcRenderer.invoke('vcp:variable:create', values)
        message.success(t('vcp.variables.create_success', '变量创建成功'))
      }

      setIsModalOpen(false)
      loadVariables()
    } catch (error) {
      logger.error('Failed to save variable', error as Error)
      message.error(t('vcp.variables.save_failed', '保存失败'))
    }
  }

  /**
   * 删除变量
   */
  const handleDelete = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('vcp:variable:delete', id)
      message.success(t('vcp.variables.delete_success', '变量删除成功'))
      loadVariables()
    } catch (error) {
      logger.error('Failed to delete variable', error as Error)
      message.error(t('vcp.variables.delete_failed', '删除失败'))
    }
  }

  /**
   * 复制占位符
   */
  const copyPlaceholder = (name: string) => {
    const placeholder = `{{${name}}}`
    navigator.clipboard.writeText(placeholder)
    message.success(t('common.copied', '已复制: ') + placeholder)
  }

  // ==================== Sar 配置操作 ====================

  /**
   * 创建 Sar 配置对
   */
  const handleCreateSar = () => {
    sarForm.resetFields()
    setIsSarModalOpen(true)
  }

  /**
   * 保存 Sar 配置
   */
  const handleSaveSar = async () => {
    try {
      const values = await sarForm.validateFields()
      const nextNum = sarConfigs.length + 1

      // 创建 SarModelN 变量
      await window.electron.ipcRenderer.invoke('vcp:variable:create', {
        name: `SarModel${nextNum}`,
        value: values.models.join(','),
        description: values.modelDescription || `Sar${nextNum} 模型列表`,
        category: 'Sar',
        scope: 'global'
      })

      // 创建 SarPromptN 变量
      await window.electron.ipcRenderer.invoke('vcp:variable:create', {
        name: `SarPrompt${nextNum}`,
        value: values.promptValue,
        description: values.promptDescription || `Sar${nextNum} 条件提示词`,
        category: 'Sar',
        scope: 'global'
      })

      message.success(t('vcp.sar.create_success', 'Sar 配置创建成功'))
      setIsSarModalOpen(false)
      loadVariables()
    } catch (error) {
      logger.error('Failed to create Sar config', error as Error)
      message.error(t('vcp.sar.create_failed', '创建失败'))
    }
  }

  /**
   * 删除 Sar 配置对
   */
  const handleDeleteSar = async (index: number) => {
    try {
      const num = index + 1
      const modelVar = variables.find((v) => v.name === `SarModel${num}`)
      const promptVar = variables.find((v) => v.name === `SarPrompt${num}`)

      if (modelVar) {
        await window.electron.ipcRenderer.invoke('vcp:variable:delete', modelVar.id)
      }
      if (promptVar) {
        await window.electron.ipcRenderer.invoke('vcp:variable:delete', promptVar.id)
      }

      message.success(t('vcp.sar.delete_success', 'Sar 配置删除成功'))
      loadVariables()
    } catch (error) {
      logger.error('Failed to delete Sar config', error as Error)
      message.error(t('vcp.sar.delete_failed', '删除失败'))
    }
  }

  // ==================== TVStxt 操作 ====================

  /**
   * 选择 TVStxt 文件
   */
  const handleSelectTvsFile = async (file: TvsTxtFile) => {
    setSelectedTvsFile(file)
    try {
      const content = await window.electron.ipcRenderer.invoke('vcp:tvstxt:read', file.path)
      setTvsFileContent(content || '')
    } catch (error) {
      logger.error('Failed to read TVStxt file', error as Error)
      setTvsFileContent('')
    }
  }

  /**
   * 保存 TVStxt 文件
   */
  const handleSaveTvsFile = async () => {
    if (!selectedTvsFile) return

    try {
      await window.electron.ipcRenderer.invoke('vcp:tvstxt:write', {
        path: selectedTvsFile.path,
        content: tvsFileContent
      })
      message.success(t('vcp.tvstxt.save_success', '文件保存成功'))
      loadTvsTxtFiles()
    } catch (error) {
      logger.error('Failed to save TVStxt file', error as Error)
      message.error(t('vcp.tvstxt.save_failed', '保存失败'))
    }
  }

  /**
   * 创建新的 TVStxt 文件
   */
  const handleCreateTvsFile = async () => {
    Modal.confirm({
      title: t('vcp.tvstxt.create', '创建 TVStxt 文件'),
      content: <Input placeholder="文件名.txt" id="new-tvs-file-name" style={{ marginTop: 16 }} autoFocus />,
      onOk: async () => {
        const input = document.getElementById('new-tvs-file-name') as HTMLInputElement
        const fileName = input?.value
        if (!fileName) {
          message.warning(t('vcp.tvstxt.name_required', '请输入文件名'))
          return Promise.reject()
        }
        if (!fileName.endsWith('.txt')) {
          message.warning(t('vcp.tvstxt.must_be_txt', '文件名必须以 .txt 结尾'))
          return Promise.reject()
        }

        try {
          await window.electron.ipcRenderer.invoke('vcp:tvstxt:create', fileName)
          message.success(t('vcp.tvstxt.create_success', '文件创建成功'))
          loadTvsTxtFiles()
        } catch (error) {
          logger.error('Failed to create TVStxt file', error as Error)
          message.error(t('vcp.tvstxt.create_failed', '创建失败'))
        }
      }
    })
  }

  // ==================== 变量测试 ====================

  /**
   * 执行变量测试
   */
  const handleTest = async () => {
    if (!testInput.trim()) {
      message.warning(t('vcp.test.input_required', '请输入测试文本'))
      return
    }

    setTesting(true)
    try {
      // 调用主进程解析变量
      const result = await window.electron.ipcRenderer.invoke('vcp:variable:resolve', {
        text: testInput,
        modelId: testModelId || undefined
      })

      setTestResult({
        input: testInput,
        output: result.resolvedText || testInput,
        resolvedVariables: result.resolvedVariables || [],
        errors: result.errors || [],
        warnings: result.warnings || []
      })
    } catch (error) {
      logger.error('Failed to test variables', error as Error)
      setTestResult({
        input: testInput,
        output: testInput,
        resolvedVariables: [],
        errors: [String(error)],
        warnings: []
      })
    } finally {
      setTesting(false)
    }
  }

  // ==================== 导入导出操作 ====================

  /**
   * 导入 .env 文件
   */
  const handleImportEnv = useCallback(async () => {
    try {
      // 打开文件选择对话框
      const result = await window.api.file.open({
        filters: [{ name: 'Env Files', extensions: ['env', 'txt'] }]
      })

      if (!result || !result.content) return

      // 解码文件内容
      const content = new TextDecoder('utf-8').decode(result.content)
      if (!content) {
        message.error('读取文件失败')
        return
      }

      setImporting(true)

      // 分析导入内容，检查冲突
      const analyzeResult = await window.electron.ipcRenderer.invoke('vcp:variable:analyzeEnvImport', content)

      if (!analyzeResult.success) {
        message.error(analyzeResult.error || '分析导入内容失败')
        return
      }

      if (analyzeResult.conflicts && analyzeResult.conflicts.length > 0) {
        // 有冲突，显示确认对话框
        setImportConflicts(analyzeResult.conflicts)
        setPendingEnvContent(content)
        setImportConflictModalOpen(true)
      } else {
        // 无冲突，直接导入
        const importResult = await window.electron.ipcRenderer.invoke('vcp:variable:executeEnvImport', {
          envContent: content,
          conflictResolutions: []
        })

        if (importResult.success) {
          message.success(`导入完成：新增 ${importResult.created} 个，跳过 ${importResult.skipped} 个`)
          await loadVariables()
        } else {
          message.error(importResult.error || '导入失败')
        }
      }
    } catch (error) {
      logger.error('Failed to import env file', error as Error)
      message.error('导入失败: ' + String(error))
    } finally {
      setImporting(false)
    }
  }, [loadVariables])

  /**
   * 处理冲突解决
   */
  const handleConflictResolve = useCallback(
    async (resolutions: Map<string, ConflictResolution>) => {
      try {
        setImporting(true)

        // 转换为数组格式（IPC 不支持 Map）
        const resolutionArray = Array.from(resolutions.entries())

        const result = await window.electron.ipcRenderer.invoke('vcp:variable:executeEnvImport', {
          envContent: pendingEnvContent,
          conflictResolutions: resolutionArray
        })

        if (result.success) {
          message.success(`导入完成：新增 ${result.created} 个，更新 ${result.updated} 个，跳过 ${result.skipped} 个`)
          setImportConflictModalOpen(false)
          setPendingEnvContent('')
          setImportConflicts([])
          await loadVariables()
        } else {
          message.error(result.error || '导入失败')
        }
      } catch (error) {
        logger.error('Failed to execute env import', error as Error)
        message.error('导入失败: ' + String(error))
      } finally {
        setImporting(false)
      }
    },
    [pendingEnvContent, loadVariables]
  )

  /**
   * 导出为 .env 文件
   */
  const handleExportEnv = useCallback(async () => {
    try {
      setExporting(true)

      // 获取导出内容
      const result = await window.electron.ipcRenderer.invoke('vcp:variable:exportToEnv', {})

      if (!result.success) {
        message.error(result.error || '导出失败')
        return
      }

      // 使用 Blob + download 方式下载文件
      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `vcp-variables-${timestamp}.env`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('导出成功')
    } catch (error) {
      logger.error('Failed to export env file', error as Error)
      message.error('导出失败: ' + String(error))
    } finally {
      setExporting(false)
    }
  }, [])

  /**
   * 导入 VCPToolBox 预设
   */
  const handleImportPresets = useCallback(async () => {
    try {
      setImportingPresets(true)

      // 先预览要导入的内容
      const previewResult = await window.electron.ipcRenderer.invoke('vcp:preset:preview', {
        overwrite: false
      })

      if (!previewResult.success) {
        message.error(previewResult.error || '预览失败')
        return
      }

      const { toCreate, toSkip, files } = previewResult
      const totalNew = toCreate?.length || 0
      const totalSkip = toSkip?.length || 0
      const totalFileNew = files?.toCreate?.length || 0
      const totalFileSkip = files?.toSkip?.length || 0

      // 确认导入
      Modal.confirm({
        title: '导入 VCPToolBox 预设',
        content: (
          <div>
            <p>将导入以下 VCPToolBox 预设变量：</p>
            <ul>
              <li>Agent 角色卡：Nova, Hornet, Metis, ThemeMaidCoco</li>
              <li>TVStxt 指南：工具调用、日记系统、文件管理</li>
              <li>Tar 模板变量：系统提示词、表情包模板</li>
              <li>Var 基础变量：时间、地点、用户信息等</li>
              <li>Sar 模型条件变量：模型专属指令</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              <strong>变量：</strong>
              <Tag color="green">新增 {totalNew} 个</Tag>
              <Tag color="default">跳过 {totalSkip} 个</Tag>
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>TVStxt 文件：</strong>
              <Tag color="blue">新增 {totalFileNew} 个</Tag>
              <Tag color="default">跳过 {totalFileSkip} 个</Tag>
            </p>
          </div>
        ),
        okText: '确认导入',
        cancelText: '取消',
        onOk: async () => {
          const result = await window.electron.ipcRenderer.invoke('vcp:preset:importAll', {
            overwrite: false
          })

          if (result.success) {
            // 显示变量和文件的导入结果
            const fileInfo = result.files
              ? `，文件：新增 ${result.files.created} 个，跳过 ${result.files.skipped} 个`
              : ''
            message.success(`导入完成：变量新增 ${result.created} 个，跳过 ${result.skipped} 个${fileInfo}`)
            await loadVariables()
          } else {
            message.error(result.error || '导入失败')
          }
        }
      })
    } catch (error) {
      logger.error('Failed to import VCPToolBox presets', error as Error)
      message.error('导入预设失败: ' + String(error))
    } finally {
      setImportingPresets(false)
    }
  }, [loadVariables])

  // ==================== 依赖分析 ====================

  /**
   * 分析变量依赖关系
   */
  const dependencies = useMemo((): VariableDependency[] => {
    const deps: VariableDependency[] = []
    const varPattern = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g

    variables.forEach((v) => {
      let match
      while ((match = varPattern.exec(v.value)) !== null) {
        const refName = match[1]
        if (variables.some((ov) => ov.name === refName)) {
          deps.push({
            from: v.name,
            to: refName,
            type: 'reference'
          })
        }
      }
    })

    return deps
  }, [variables])

  /**
   * 构建依赖树数据
   */
  const dependencyTreeData = useMemo((): DataNode[] => {
    const varsByCategory: Record<string, PromptVariable[]> = {
      Tar: [],
      Var: [],
      Sar: [],
      custom: []
    }

    variables.forEach((v) => {
      const cat = v.category || 'custom'
      if (!varsByCategory[cat]) {
        varsByCategory[cat] = []
      }
      varsByCategory[cat].push(v)
    })

    return Object.entries(varsByCategory)
      .filter(([, vars]) => vars.length > 0)
      .map(([category, vars]) => ({
        title: (
          <Space>
            <Tag color={CATEGORY_COLORS[category]}>{category}</Tag>
            <Text type="secondary">({vars.length})</Text>
          </Space>
        ),
        key: category,
        children: vars.map((v) => {
          const refs = dependencies.filter((d) => d.from === v.name)
          const refBy = dependencies.filter((d) => d.to === v.name)

          return {
            title: (
              <Space>
                <code>{`{{${v.name}}}`}</code>
                {refs.length > 0 && (
                  <Tooltip title={`引用: ${refs.map((r) => r.to).join(', ')}`}>
                    <Badge count={refs.length} style={{ backgroundColor: '#52c41a' }} />
                  </Tooltip>
                )}
                {refBy.length > 0 && (
                  <Tooltip title={`被引用: ${refBy.map((r) => r.from).join(', ')}`}>
                    <Badge count={refBy.length} style={{ backgroundColor: '#1890ff' }} />
                  </Tooltip>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    copyPlaceholder(v.name)
                  }}
                />
              </Space>
            ),
            key: v.id,
            isLeaf: true
          }
        })
      }))
  }, [variables, dependencies])

  // ==================== 统计数据 ====================

  const stats = useMemo(() => {
    return {
      total: variables.length,
      tar: variables.filter((v) => v.category === 'Tar').length,
      var: variables.filter((v) => v.category === 'Var').length,
      sar: variables.filter((v) => v.category === 'Sar').length,
      sarPairs: sarConfigs.length,
      dependencies: dependencies.length
    }
  }, [variables, sarConfigs, dependencies])

  // ==================== 渲染 ====================

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          <ExperimentOutlined style={{ marginRight: 8 }} />
          {t('vcp.advanced_editor.title', '高级变量编辑器')}
        </Title>
        <Text type="secondary">
          {t('vcp.advanced_editor.description', 'Tar/Var/Sar 变量管理、测试预览、依赖分析、TVStxt 文件管理')}
        </Text>
      </Header>

      <Content>
        {/* 统计概览 */}
        <StatsRow gutter={16}>
          <Col span={4}>
            <StatItem>
              <CodeOutlined />
              <div>
                <Text type="secondary">总变量</Text>
                <Text strong>{stats.total}</Text>
              </div>
            </StatItem>
          </Col>
          <Col span={4}>
            <StatItem>
              <Tag color="purple">Tar</Tag>
              <Text strong>{stats.tar}</Text>
            </StatItem>
          </Col>
          <Col span={4}>
            <StatItem>
              <Tag color="cyan">Var</Tag>
              <Text strong>{stats.var}</Text>
            </StatItem>
          </Col>
          <Col span={4}>
            <StatItem>
              <Tag color="gold">Sar</Tag>
              <Text strong>{stats.sarPairs} 对</Text>
            </StatItem>
          </Col>
          <Col span={4}>
            <StatItem>
              <LinkOutlined />
              <div>
                <Text type="secondary">依赖</Text>
                <Text strong>{stats.dependencies}</Text>
              </div>
            </StatItem>
          </Col>
          <Col span={4}>
            <StatItem>
              <FileTextOutlined />
              <div>
                <Text type="secondary">TVStxt</Text>
                <Text strong>{tvsTxtFiles.length}</Text>
              </div>
            </StatItem>
          </Col>
        </StatsRow>

        {/* 主要内容标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'editor',
              label: (
                <span>
                  <EditOutlined />
                  变量编辑
                </span>
              ),
              children: (
                <TabContent>
                  <Row gutter={16}>
                    {/* 左侧: 变量树 */}
                    <Col span={8}>
                      <SectionCard
                        title="变量列表"
                        extra={
                          <Space>
                            <Tooltip title="导入 .env 文件">
                              <Button
                                type="text"
                                size="small"
                                icon={<UploadOutlined />}
                                onClick={handleImportEnv}
                                loading={importing}
                              />
                            </Tooltip>
                            <Tooltip title="导出为 .env 文件">
                              <Button
                                type="text"
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={handleExportEnv}
                                loading={exporting}
                              />
                            </Tooltip>
                            <Tooltip title="导入 VCPToolBox 预设 (Nova, Hornet 等)">
                              <Button
                                type="text"
                                size="small"
                                icon={<ThunderboltOutlined />}
                                onClick={handleImportPresets}
                                loading={importingPresets}
                              />
                            </Tooltip>
                            <Button
                              type="text"
                              size="small"
                              icon={<ReloadOutlined />}
                              onClick={loadVariables}
                              loading={loading}
                            />
                            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
                              新建
                            </Button>
                          </Space>
                        }>
                        {loading ? (
                          <Spin />
                        ) : variables.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无变量">
                            <Button type="primary" onClick={handleCreate}>
                              创建第一个变量
                            </Button>
                          </Empty>
                        ) : (
                          <Tree
                            treeData={dependencyTreeData}
                            defaultExpandAll
                            showLine={{ showLeafIcon: false }}
                            onSelect={(_, info) => {
                              const node = info.node as DataNode
                              if (node.isLeaf) {
                                const v = variables.find((v) => v.id === node.key)
                                if (v) {
                                  setSelectedVariable(v)
                                }
                              }
                            }}
                          />
                        )}
                      </SectionCard>
                    </Col>

                    {/* 右侧: 变量详情 */}
                    <Col span={16}>
                      {selectedVariable ? (
                        <SectionCard
                          title={
                            <Space>
                              <code>{`{{${selectedVariable.name}}}`}</code>
                              <Tag color={CATEGORY_COLORS[selectedVariable.category || 'custom']}>
                                {selectedVariable.category || 'custom'}
                              </Tag>
                              <Tag color={SCOPE_COLORS[selectedVariable.scope || 'global']}>
                                {selectedVariable.scope || 'global'}
                              </Tag>
                            </Space>
                          }
                          extra={
                            <Space>
                              <Button icon={<CopyOutlined />} onClick={() => copyPlaceholder(selectedVariable.name)}>
                                复制
                              </Button>
                              <Button icon={<EditOutlined />} onClick={() => handleEdit(selectedVariable)}>
                                编辑
                              </Button>
                              <Popconfirm title="确定删除此变量？" onConfirm={() => handleDelete(selectedVariable.id)}>
                                <Button danger icon={<DeleteOutlined />}>
                                  删除
                                </Button>
                              </Popconfirm>
                            </Space>
                          }>
                          <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="变量名">
                              <code>{selectedVariable.name}</code>
                            </Descriptions.Item>
                            <Descriptions.Item label="值">
                              <Paragraph
                                copyable
                                style={{
                                  maxHeight: 200,
                                  overflow: 'auto',
                                  whiteSpace: 'pre-wrap',
                                  margin: 0
                                }}>
                                {selectedVariable.value}
                              </Paragraph>
                            </Descriptions.Item>
                            <Descriptions.Item label="描述">{selectedVariable.description || '-'}</Descriptions.Item>
                            <Descriptions.Item label="创建时间">
                              {selectedVariable.createdAt ? new Date(selectedVariable.createdAt).toLocaleString() : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="更新时间">
                              {selectedVariable.updatedAt ? new Date(selectedVariable.updatedAt).toLocaleString() : '-'}
                            </Descriptions.Item>
                          </Descriptions>

                          {/* 依赖关系 */}
                          {dependencies.some(
                            (d) => d.from === selectedVariable.name || d.to === selectedVariable.name
                          ) && (
                            <>
                              <Divider orientation="left">依赖关系</Divider>
                              <Space direction="vertical" style={{ width: '100%' }}>
                                {dependencies
                                  .filter((d) => d.from === selectedVariable.name)
                                  .map((d) => (
                                    <Tag key={d.to} color="green">
                                      引用 → {`{{${d.to}}}`}
                                    </Tag>
                                  ))}
                                {dependencies
                                  .filter((d) => d.to === selectedVariable.name)
                                  .map((d) => (
                                    <Tag key={d.from} color="blue">
                                      被引用 ← {`{{${d.from}}}`}
                                    </Tag>
                                  ))}
                              </Space>
                            </>
                          )}
                        </SectionCard>
                      ) : (
                        <SectionCard>
                          <Empty description="选择左侧变量查看详情" />
                        </SectionCard>
                      )}
                    </Col>
                  </Row>
                </TabContent>
              )
            },
            {
              key: 'sar',
              label: (
                <span>
                  <ApiOutlined />
                  Sar 条件配置
                </span>
              ),
              children: (
                <TabContent>
                  <Alert
                    type="info"
                    showIcon
                    icon={<QuestionCircleOutlined />}
                    message="Sar 条件变量"
                    description={
                      <Text>
                        Sar 变量成对配置：
                        <code>{'{{SarModelN}}'}</code> 定义目标模型列表，
                        <code>{'{{SarPromptN}}'}</code> 定义对应的提示词。 当当前模型匹配 SarModelN 时，SarPromptN
                        的内容会被注入到 system 提示词中。
                      </Text>
                    }
                    style={{ marginBottom: 16 }}
                  />

                  <SectionCard
                    title="Sar 配置对"
                    extra={
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateSar}>
                        新建 Sar 配置
                      </Button>
                    }>
                    {sarConfigs.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Sar 配置">
                        <Button type="primary" onClick={handleCreateSar}>
                          创建第一个 Sar 配置
                        </Button>
                      </Empty>
                    ) : (
                      <List
                        dataSource={sarConfigs}
                        renderItem={(item, index) => (
                          <SarConfigItem>
                            <Row gutter={16} align="middle">
                              <Col span={6}>
                                <Text strong>Sar{index + 1}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  模型: {item.modelId}
                                </Text>
                              </Col>
                              <Col span={14}>
                                <Text ellipsis style={{ display: 'block' }}>
                                  {item.promptValue.substring(0, 100)}...
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Space>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => copyPlaceholder(`SarPrompt${index + 1}`)}
                                  />
                                  <Popconfirm title="确定删除此 Sar 配置？" onConfirm={() => handleDeleteSar(index)}>
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              </Col>
                            </Row>
                          </SarConfigItem>
                        )}
                      />
                    )}
                  </SectionCard>
                </TabContent>
              )
            },
            {
              key: 'test',
              label: (
                <span>
                  <BugOutlined />
                  变量测试
                </span>
              ),
              children: (
                <TabContent>
                  <Row gutter={16}>
                    <Col span={12}>
                      <SectionCard title="输入">
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          <TextArea
                            rows={10}
                            placeholder="输入包含变量占位符的文本，例如：今天是 {{Date}}，星期{{Weekday}}"
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                          />
                          <Space>
                            <ModelSelectorButton
                              providerId={testProviderId}
                              modelId={testModelId}
                              onModelChange={(providerId, modelId) => {
                                setTestProviderId(providerId)
                                setTestModelId(modelId)
                              }}
                              placeholder="选择测试模型 (用于 Sar 变量)"
                              style={{ width: 220 }}
                            />
                            <Button
                              type="primary"
                              icon={<SyncOutlined spin={testing} />}
                              onClick={handleTest}
                              loading={testing}>
                              解析变量
                            </Button>
                          </Space>
                        </Space>
                      </SectionCard>
                    </Col>
                    <Col span={12}>
                      <SectionCard title="输出">
                        {testResult ? (
                          <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <TextArea
                              rows={10}
                              value={testResult.output}
                              readOnly
                              style={{ backgroundColor: 'var(--color-background-soft)' }}
                            />
                            {testResult.resolvedVariables.length > 0 && (
                              <Collapse size="small">
                                <Panel header={`已解析变量 (${testResult.resolvedVariables.length})`} key="resolved">
                                  <List
                                    size="small"
                                    dataSource={testResult.resolvedVariables}
                                    renderItem={(item) => (
                                      <List.Item>
                                        <code>{item.placeholder}</code>
                                        <Text type="secondary" style={{ marginLeft: 8 }}>
                                          → {item.value}
                                        </Text>
                                      </List.Item>
                                    )}
                                  />
                                </Panel>
                              </Collapse>
                            )}
                            {testResult.errors.length > 0 && (
                              <Alert type="error" message="解析错误" description={testResult.errors.join('\n')} />
                            )}
                            {testResult.warnings.length > 0 && (
                              <Alert type="warning" message="警告" description={testResult.warnings.join('\n')} />
                            )}
                          </Space>
                        ) : (
                          <Empty description="输入文本后点击解析查看结果" />
                        )}
                      </SectionCard>
                    </Col>
                  </Row>
                </TabContent>
              )
            },
            {
              key: 'tvstxt',
              label: (
                <span>
                  <FileTextOutlined />
                  TVStxt 文件
                </span>
              ),
              children: (
                <TabContent>
                  <Alert
                    type="info"
                    showIcon
                    message="TVStxt 变量文件"
                    description="TVStxt 文件用于存储大段文本内容，变量值设置为文件名即可引用文件内容。"
                    style={{ marginBottom: 16 }}
                  />
                  <Row gutter={16}>
                    <Col span={8}>
                      <SectionCard
                        title="文件列表"
                        extra={
                          <Space>
                            <Button
                              type="text"
                              size="small"
                              icon={<ReloadOutlined />}
                              onClick={loadTvsTxtFiles}
                              loading={loadingTvsFiles}
                            />
                            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateTvsFile}>
                              新建
                            </Button>
                          </Space>
                        }>
                        {loadingTvsFiles ? (
                          <Spin />
                        ) : tvsTxtFiles.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 TVStxt 文件">
                            <Button type="primary" onClick={handleCreateTvsFile}>
                              创建第一个文件
                            </Button>
                          </Empty>
                        ) : (
                          <List
                            size="small"
                            dataSource={tvsTxtFiles}
                            renderItem={(file) => (
                              <TvsFileItem
                                $active={selectedTvsFile?.path === file.path}
                                onClick={() => handleSelectTvsFile(file)}>
                                <Space>
                                  <FileTextOutlined />
                                  <Text>{file.name}</Text>
                                </Space>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {(file.size / 1024).toFixed(1)} KB
                                </Text>
                              </TvsFileItem>
                            )}
                          />
                        )}
                      </SectionCard>
                    </Col>
                    <Col span={16}>
                      {selectedTvsFile ? (
                        <SectionCard
                          title={
                            <Space>
                              <FileTextOutlined />
                              {selectedTvsFile.name}
                            </Space>
                          }
                          extra={
                            <Space>
                              <Button
                                icon={<FolderOpenOutlined />}
                                onClick={() => {
                                  // 在文件管理器中打开
                                  window.electron.ipcRenderer.invoke('open-path', selectedTvsFile.path)
                                }}>
                                打开目录
                              </Button>
                              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTvsFile}>
                                保存
                              </Button>
                            </Space>
                          }>
                          <TextArea
                            rows={20}
                            value={tvsFileContent}
                            onChange={(e) => setTvsFileContent(e.target.value)}
                            style={{ fontFamily: 'monospace' }}
                          />
                        </SectionCard>
                      ) : (
                        <SectionCard>
                          <Empty description="选择左侧文件进行编辑" />
                        </SectionCard>
                      )}
                    </Col>
                  </Row>
                </TabContent>
              )
            },
            {
              key: 'system',
              label: (
                <span>
                  <GlobalOutlined />
                  系统变量
                </span>
              ),
              children: (
                <TabContent>
                  <Alert
                    type="info"
                    showIcon
                    icon={<ThunderboltOutlined />}
                    message="内置系统变量"
                    description="这些变量由系统自动提供，可直接在提示词中使用。插件变量需要对应插件启用后才能生效。"
                    style={{ marginBottom: 16 }}
                  />

                  <Row gutter={[16, 16]}>
                    {/* 按类别分组显示系统变量 */}
                    {Object.entries(
                      [...BASIC_VARIABLES, ...DYNAMIC_VARIABLE_PATTERNS].reduce(
                        (groups, v) => {
                          const cat = v.category
                          if (!groups[cat]) groups[cat] = []
                          groups[cat].push(v)
                          return groups
                        },
                        {} as Record<string, VariableDefinition[]>
                      )
                    ).map(([category, vars]) => (
                      <Col span={12} key={category}>
                        <SectionCard
                          title={
                            <Space>
                              <Tag color={SYSTEM_CATEGORY_COLORS[category]}>
                                {SYSTEM_CATEGORY_NAMES[category] || category}
                              </Tag>
                              <Text type="secondary">({vars.length})</Text>
                            </Space>
                          }
                          size="small">
                          <List
                            size="small"
                            dataSource={vars}
                            renderItem={(v: VariableDefinition) => (
                              <SystemVarItem>
                                <Space direction="vertical" size={0} style={{ flex: 1 }}>
                                  <Space>
                                    <code
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => copyPlaceholder(v.name)}>
                                      {v.dynamic ? `{{${v.name}}}` : `{{${v.name}}}`}
                                    </code>
                                    {v.async && (
                                      <Tag color="processing" style={{ fontSize: 10 }}>
                                        异步
                                      </Tag>
                                    )}
                                    {v.dynamic && (
                                      <Tag color="warning" style={{ fontSize: 10 }}>
                                        动态
                                      </Tag>
                                    )}
                                  </Space>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {v.description}
                                    {v.source && ` (来源: ${v.source})`}
                                  </Text>
                                  {v.aliases && v.aliases.length > 0 && (
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      别名: {v.aliases.map((a) => `{{${a}}}`).join(', ')}
                                    </Text>
                                  )}
                                </Space>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => copyPlaceholder(v.name)}
                                />
                              </SystemVarItem>
                            )}
                          />
                        </SectionCard>
                      </Col>
                    ))}
                  </Row>
                </TabContent>
              )
            }
          ]}
        />
      </Content>

      {/* 变量编辑弹窗 */}
      <Modal
        title={selectedVariable ? '编辑变量' : '新建变量'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={600}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                message: '变量名必须以字母开头，只能包含字母、数字和下划线'
              }
            ]}>
            <Input placeholder="例如: UserName, ApiKey" prefix="{{" suffix="}}" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入变量值' }]}>
            <TextArea rows={4} placeholder="变量的值，支持多行文本。设置为 xxx.txt 可引用 TVStxt 文件内容" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="类型">
                <Select
                  options={[
                    { value: 'Var', label: 'Var - 全局变量' },
                    { value: 'Tar', label: 'Tar - 模板变量' },
                    { value: 'Sar', label: 'Sar - 条件变量' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scope" label="作用域">
                <Select
                  options={[
                    { value: 'global', label: '全局' },
                    { value: 'agent', label: 'Agent' },
                    { value: 'session', label: '会话' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="变量的用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sar 配置弹窗 */}
      <Modal
        title="新建 Sar 条件配置"
        open={isSarModalOpen}
        onOk={handleSaveSar}
        onCancel={() => setIsSarModalOpen(false)}
        width={700}>
        <Alert
          type="info"
          showIcon
          message="Sar 配置会创建一对变量：SarModelN 和 SarPromptN"
          style={{ marginBottom: 16 }}
        />
        <Form form={sarForm} layout="vertical">
          <Form.Item name="models" label="目标模型" rules={[{ required: true, message: '请选择至少一个模型' }]}>
            <Select
              mode="tags"
              placeholder="选择或输入模型 ID"
              options={COMMON_MODELS.map((m) => ({
                value: m.id,
                label: (
                  <Space>
                    <Text>{m.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {m.id}
                    </Text>
                  </Space>
                )
              }))}
            />
          </Form.Item>
          <Form.Item name="modelDescription" label="模型配置描述">
            <Input placeholder="例如: Gemini 系列模型" />
          </Form.Item>
          <Form.Item
            name="promptValue"
            label="条件提示词"
            rules={[{ required: true, message: '请输入条件提示词内容' }]}>
            <TextArea rows={6} placeholder="当模型匹配时，此内容会被注入到 system 提示词中" />
          </Form.Item>
          <Form.Item name="promptDescription" label="提示词描述">
            <Input placeholder="例如: Gemini 专用指令" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入冲突解决对话框 */}
      <ImportConflictModal
        visible={importConflictModalOpen}
        conflicts={importConflicts}
        onResolve={handleConflictResolve}
        onCancel={() => {
          setImportConflictModalOpen(false)
          setPendingEnvContent('')
          setImportConflicts([])
        }}
        loading={importing}
      />
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);

  h4 {
    margin-bottom: 4px;
  }
`

const Content = styled.div`
  padding: 16px 24px;
  flex: 1;
  overflow: auto;
`

const StatsRow = styled(Row)`
  margin-bottom: 16px;
`

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);

  .anticon {
    font-size: 20px;
    color: var(--color-primary);
  }
`

const TabContent = styled.div`
  padding-top: 8px;
`

const SectionCard = styled(Card)`
  height: 100%;

  .ant-card-head {
    min-height: 40px;
    padding: 0 16px;
  }

  .ant-card-head-title {
    font-size: 14px;
    padding: 12px 0;
  }

  .ant-card-body {
    padding: 16px;
  }
`

const SarConfigItem = styled.div`
  padding: 12px 16px;
  margin-bottom: 8px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);

  &:hover {
    border-color: var(--color-primary);
  }
`

const TvsFileItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  background: ${(props) => (props.$active ? 'var(--color-primary-bg)' : 'transparent')};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  }
`

const SystemVarItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-bg);
  }

  code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    padding: 2px 6px;
    background: var(--color-background-mute);
    border-radius: 4px;
    color: var(--color-primary);
  }
`

export default AdvancedVariableEditor
