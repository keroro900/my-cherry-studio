/**
 * VCP 内置插件列表
 *
 * 展示所有 VCPToolBox 内置插件
 * 样式与 BuiltinMCPServerList 保持一致
 * 支持插件模型绑定配置
 * 支持查看插件详情（README、系统提示词）
 *
 * 迁移自: pages/settings/VCPToolBoxSettings/VCPPluginList.tsx
 */

import {
  BookOutlined,
  CheckOutlined,
  CloudServerOutlined,
  CodeOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined
} from '@ant-design/icons'
import ModelSelector from '@renderer/components/ModelSelector'
import { useProviders } from '@renderer/hooks/useProvider'
import { SettingTitle } from '@renderer/pages/settings'
import ReactMarkdown from 'react-markdown'
import {
  Button,
  Collapse,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip
} from 'antd'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// VCP 插件类型颜色映射
const VCP_TYPE_COLORS: Record<string, string> = {
  static: 'blue',
  synchronous: 'green',
  asynchronous: 'orange',
  messagePreprocessor: 'purple',
  service: 'cyan',
  hybridservice: 'magenta',
  mcp_bridge: 'gold',
  builtin_service: 'lime' // 内置服务类型
}

// 插件模型配置类型
interface PluginModelConfig {
  enabled: boolean
  providerId?: string
  modelId?: string
  temperature?: number
  maxTokens?: number
  streaming?: boolean
  systemPrompt?: string
}

// 插件信息类型
interface VCPPluginInfo {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  type: string
  enabled: boolean
  distributed?: boolean
  serverEndpoint?: string
  category?: string
  requiresConfig?: boolean
  configKeys?: string[]
  tags?: string[]
  isBuiltin?: boolean
  isNative?: boolean
  supportsModel?: boolean
  modelConfig?: PluginModelConfig
}

// 插件详情类型
interface PluginDetails {
  pluginId: string
  readme?: string
  systemPrompt?: string
  systemPromptFile?: string
  author?: string
  invocationCommands?: Array<{
    commandIdentifier: string
    description: string
    example?: string
  }>
}

const VCPPluginList: FC<{
  /** 默认类型筛选 - 用于控制标签页默认显示内容 */
  defaultTypeFilter?: 'all' | 'native' | 'builtin' | 'external'
  /** 是否隐藏类型筛选器 */
  hideTypeFilter?: boolean
}> = ({ defaultTypeFilter = 'all', hideTypeFilter = false }) => {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const [loading, setLoading] = useState(false)
  const [plugins, setPlugins] = useState<VCPPluginInfo[]>([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>(defaultTypeFilter) // 使用传入的默认值
  const [pluginsDir, setPluginsDir] = useState<{ userDir: string; builtinDir?: string } | null>(null)

  // 配置弹窗状态
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<VCPPluginInfo | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSchema, setConfigSchema] = useState<Record<string, any> | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [modelConfig, setModelConfig] = useState<PluginModelConfig>({
    enabled: false,
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true
  })

  // MagiAgent 模板化配置
  interface MagiTemplate {
    id: string
    name: string
    description: string
    icon: string
    category: string
    sages: Array<{
      id: string
      name: string
      perspective: string
      personality: string
    }>
  }
  const [magiTemplates, setMagiTemplates] = useState<MagiTemplate[]>([])
  const [selectedMagiTemplate, setSelectedMagiTemplate] = useState<string>('magi_classic')
  const [magiSageModels, setMagiSageModels] = useState<Record<string, { providerId?: string; modelId?: string }>>({})

  const [form] = Form.useForm()

  // 详情弹窗状态
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [pluginDetails, setPluginDetails] = useState<PluginDetails | null>(null)

  // 加载插件列表
  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      // 先初始化插件管理器
      await window.api.vcpPlugin.initialize()

      // 获取插件目录
      const dirsResult = await window.api.vcpPlugin.getPluginsDir()
      if (dirsResult.success && dirsResult.data) {
        setPluginsDir(dirsResult.data)
      }

      // 获取插件列表
      const result = await window.api.vcpPlugin.list()
      if (result.success && result.data) {
        // 去重：按 id 去重，防止重复 key 错误
        const seen = new Set<string>()
        const uniquePlugins = result.data.filter((p: VCPPluginInfo) => {
          if (seen.has(p.id)) {
            return false
          }
          seen.add(p.id)
          return true
        })
        setPlugins(uniquePlugins)
      }
    } catch (error) {
      console.error('Failed to load VCP plugins:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
        window.toast.success(enabled ? t('vcp.plugin.enabled_success') : t('vcp.plugin.disabled_success'))
      } else {
        window.toast.error(result.error || t('vcp.plugin.toggle_error'))
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 打开配置弹窗
  const openConfigModal = async (plugin: VCPPluginInfo) => {
    setSelectedPlugin(plugin)
    setConfigModalVisible(true)
    setConfigLoading(true)

    try {
      const result = await window.api.vcpPlugin.getConfig(plugin.id)
      if (result.success && result.data) {
        setConfigSchema(result.data.configSchema)
        setConfigValues(result.data.currentConfig || {})
        form.setFieldsValue(result.data.currentConfig || {})

        // 加载模型配置 (从 currentConfig.__modelConfig 中读取)
        const savedModelConfig = (result.data.currentConfig as Record<string, unknown>)?.__modelConfig as
          | PluginModelConfig
          | undefined
        // 只有明确声明 supportsModel 的服务才加载模型配置
        if (plugin.supportsModel) {
          if (savedModelConfig) {
            setModelConfig(savedModelConfig)
          } else {
            setModelConfig({
              enabled: false,
              temperature: 0.7,
              maxTokens: 4096,
              streaming: true
            })
          }
        }

        // MagiAgent 特殊处理: 加载模板列表和贤者模型配置
        if (plugin.name === 'MagiAgent') {
          const config = result.data.currentConfig as Record<string, unknown>

          // 获取模板列表
          try {
            const templatesResult = await window.api.vcpUnified.executeTool({
              toolName: 'MagiAgent',
              params: { command: 'ListTemplates' },
              source: 'vcp'
            })
            if (templatesResult.success && (templatesResult.output as any)?.templates) {
              setMagiTemplates((templatesResult.output as any).templates as MagiTemplate[])
            }
          } catch (e) {
            console.error('Failed to load MagiAgent templates:', e)
          }

          // 加载默认模板和贤者模型配置
          const templateId = (config?.defaultTemplateId as string) || 'magi_classic'
          setSelectedMagiTemplate(templateId)

          // 解析 sageModels JSON
          const sageModelsJson = (config?.sageModels as string) || '{}'
          try {
            const sageModels = JSON.parse(sageModelsJson)
            setMagiSageModels(sageModels)
          } catch {
            setMagiSageModels({})
          }
        }
      } else {
        setConfigSchema(null)
        setConfigValues({})
        setModelConfig({
          enabled: false,
          temperature: 0.7,
          maxTokens: 4096,
          streaming: true
        })
        setMagiTemplates([])
        setSelectedMagiTemplate('magi_classic')
        setMagiSageModels({})
      }
    } catch (error) {
      console.error('Failed to load plugin config:', error)
      window.toast.error(t('vcp.plugin.config_load_error', '加载配置失败'))
    } finally {
      setConfigLoading(false)
    }
  }

  // 保存配置
  const saveConfig = async () => {
    if (!selectedPlugin) return

    try {
      const values = await form.validateFields()

      // MagiAgent 特殊处理: 将模板和贤者模型配置合并到 values
      if (selectedPlugin.name === 'MagiAgent') {
        Object.assign(values, {
          defaultTemplateId: selectedMagiTemplate,
          sageModels: JSON.stringify(magiSageModels)
        })
      }

      // 保存插件配置
      const result = await window.api.vcpPlugin.updateConfig(selectedPlugin.id, values)

      if (result.success) {
        // 如果插件支持模型绑定，也保存模型配置
        if (selectedPlugin.supportsModel) {
          await window.api.vcpPlugin.updateModelConfig(
            selectedPlugin.id,
            modelConfig as unknown as Record<string, unknown>
          )
        }

        window.toast.success(t('vcp.plugin.config_saved', '配置已保存'))
        setConfigModalVisible(false)

        // 更新本地插件列表中的模型配置
        setPlugins((prev) => prev.map((p) => (p.id === selectedPlugin.id ? { ...p, modelConfig } : p)))
      } else {
        window.toast.error(result.error || t('vcp.plugin.config_save_error', '保存配置失败'))
      }
    } catch (error) {
      console.error('Failed to save plugin config:', error)
    }
  }

  // 关闭配置弹窗
  const closeConfigModal = () => {
    setConfigModalVisible(false)
    setSelectedPlugin(null)
    setConfigSchema(null)
    setConfigValues({})
    setModelConfig({
      enabled: false,
      temperature: 0.7,
      maxTokens: 4096,
      streaming: true
    })
    setMagiTemplates([])
    setSelectedMagiTemplate('magi_classic')
    setMagiSageModels({})
    form.resetFields()
  }

  // 打开详情弹窗
  const openDetailsModal = async (plugin: VCPPluginInfo) => {
    setSelectedPlugin(plugin)
    setDetailsModalVisible(true)
    setDetailsLoading(true)

    try {
      const result = await window.api.vcpPlugin.getDetails(plugin.id)
      if (result.success && result.data) {
        setPluginDetails(result.data)
      } else {
        setPluginDetails({ pluginId: plugin.id })
      }
    } catch (error) {
      console.error('Failed to load plugin details:', error)
      setPluginDetails({ pluginId: plugin.id })
    } finally {
      setDetailsLoading(false)
    }
  }

  // 关闭详情弹窗
  const closeDetailsModal = () => {
    setDetailsModalVisible(false)
    setPluginDetails(null)
  }

  // 使用插件的默认系统提示词
  const useDefaultSystemPrompt = () => {
    if (pluginDetails?.systemPrompt) {
      setModelConfig((prev) => ({ ...prev, systemPrompt: pluginDetails.systemPrompt }))
      window.toast.success(t('vcp.plugin.system_prompt_loaded', '已加载插件系统提示词'))
    }
  }

  // 从自定义路径加载插件
  const loadPluginFromPath = async () => {
    try {
      // 使用文件选择器选择插件目录
      const result = await window.api.file.selectFolder()
      if (!result) return

      const loadResult = await window.api.vcpPlugin.loadFromPath(result)
      if (loadResult.success && loadResult.data) {
        window.toast.success(t('vcp.plugin.load_success', `成功加载插件: ${loadResult.data.displayName}`))
        // 重新加载插件列表
        await loadPlugins()
      } else {
        window.toast.error(loadResult.error || t('vcp.plugin.load_error', '加载插件失败'))
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 打开插件目录
  const openPluginsDir = async () => {
    if (pluginsDir?.userDir) {
      try {
        await window.api.file.openPath(pluginsDir.userDir)
      } catch (error) {
        window.toast.error(String(error))
      }
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
        !p.description.toLowerCase().includes(search) &&
        !(p.tags || []).some((tag) => tag.toLowerCase().includes(search))
      ) {
        return false
      }
    }

    // 分类过滤
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false

    // 类型过滤
    if (typeFilter === 'native' && !p.isNative) return false
    if (typeFilter === 'builtin' && !p.isBuiltin) return false
    if (typeFilter === 'external' && (p.isNative || p.isBuiltin)) return false

    return true
  })

  // 类型筛选选项
  const typeOptions = [
    { value: 'all', label: t('vcp.plugin.type_all', '全部') },
    { value: 'native', label: t('vcp.plugin.type_native', '原生服务') },
    { value: 'builtin', label: t('vcp.plugin.type_builtin', '内置插件') },
    { value: 'external', label: t('vcp.plugin.type_external', '外部插件') }
  ]

  // 分类选项
  const categoryOptions = [
    { value: 'all', label: t('vcp.plugin.tab_all') },
    { value: 'builtin_service', label: t('vcp.plugin.category.builtin_service', '内置服务') },
    { value: 'search', label: t('vcp.plugin.category.search', '搜索') },
    { value: 'information', label: t('vcp.plugin.category.information', '资讯') },
    { value: 'media', label: t('vcp.plugin.category.media', '媒体') },
    { value: 'utilities', label: t('vcp.plugin.category.utilities', '工具') },
    { value: 'development', label: t('vcp.plugin.category.development', '开发') },
    { value: 'memory', label: t('vcp.plugin.category.memory', '记忆') },
    { value: 'ai', label: t('vcp.plugin.category.ai', 'AI') },
    { value: 'image', label: t('vcp.plugin.category.image', '图像') },
    { value: 'video', label: t('vcp.plugin.category.video', '视频') },
    { value: 'file', label: t('vcp.plugin.category.file', '文件') },
    { value: 'diary', label: t('vcp.plugin.category.diary', '日记') },
    { value: 'code', label: t('vcp.plugin.category.code', '代码') },
    { value: 'network', label: t('vcp.plugin.category.network', '网络') },
    { value: 'service', label: t('vcp.plugin.category.service', '服务') }
  ]

  if (loading) {
    return (
      <LoadingContainer>
        <Spin tip={t('vcp.plugin.loading')} />
      </LoadingContainer>
    )
  }

  return (
    <>
      <HeaderContainer>
        <SettingTitle style={{ gap: 3, marginBottom: 0 }}>{t('vcp.plugin.title')}</SettingTitle>
        <ToolBar>
          <Tooltip title={t('vcp.plugin.load_from_path', '从目录加载插件')}>
            <Button icon={<FolderOpenOutlined />} onClick={loadPluginFromPath}>
              {t('vcp.plugin.load', '加载')}
            </Button>
          </Tooltip>
          <Tooltip title={t('vcp.plugin.open_dir', '打开插件目录')}>
            <Button icon={<FolderOpenOutlined />} onClick={openPluginsDir} disabled={!pluginsDir?.userDir} />
          </Tooltip>
          <Tooltip title={t('vcp.plugin.refresh', '刷新')}>
            <Button icon={<ReloadOutlined />} onClick={loadPlugins} />
          </Tooltip>
          <Divider type="vertical" />
          {!hideTypeFilter && (
            <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} style={{ width: 100 }} />
          )}
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            style={{ width: 120 }}
          />
          <Input.Search
            placeholder={t('vcp.plugin.search_placeholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
        </ToolBar>
      </HeaderContainer>

      <StatsBar>
        <StatItem>
          <StatLabel>{t('vcp.plugin.total')}:</StatLabel>
          <StatValue>{filteredPlugins.length}</StatValue>
        </StatItem>
        {!hideTypeFilter && (
          <>
            <StatItem>
              <ThunderboltOutlined style={{ color: 'var(--color-primary)', marginRight: 4 }} />
              <StatLabel>{t('vcp.plugin.builtin', '内置')}:</StatLabel>
              <StatValue style={{ color: 'var(--color-primary)' }}>
                {plugins.filter((p) => p.isNative || p.isBuiltin).length}
              </StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>{t('vcp.plugin.external', '外部')}:</StatLabel>
              <StatValue style={{ color: 'var(--color-info)' }}>
                {plugins.filter((p) => !p.isNative && !p.isBuiltin).length}
              </StatValue>
            </StatItem>
          </>
        )}
        <StatItem>
          <StatLabel>{t('vcp.plugin.enabled')}:</StatLabel>
          <StatValue style={{ color: 'var(--color-success)' }}>
            {filteredPlugins.filter((p) => p.enabled).length}
          </StatValue>
        </StatItem>
      </StatsBar>

      {filteredPlugins.length === 0 ? (
        <Empty
          description={searchText ? t('vcp.plugin.no_search_results') : t('vcp.plugin.no_plugins')}
          style={{ marginTop: 40 }}
        />
      ) : (
        <PluginsGrid>
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.id}>
              <PluginHeader>
                <PluginName>
                  <PluginNameText>{plugin.displayName}</PluginNameText>
                  <VersionTag>v{plugin.version}</VersionTag>
                </PluginName>
                <StatusIndicator>
                  <Tooltip title={t('vcp.plugin.details', '详情')}>
                    <Button
                      type="text"
                      icon={<InfoCircleOutlined />}
                      size="small"
                      onClick={() => openDetailsModal(plugin)}
                    />
                  </Tooltip>
                  {(plugin.requiresConfig || plugin.configKeys?.length || plugin.supportsModel || plugin.isBuiltin) && (
                    <Tooltip title={t('vcp.plugin.configure', '配置')}>
                      <Button
                        type="text"
                        icon={<SettingOutlined />}
                        size="small"
                        onClick={() => openConfigModal(plugin)}
                      />
                    </Tooltip>
                  )}
                  <Button
                    type="text"
                    icon={
                      plugin.enabled ? <CheckOutlined style={{ color: 'var(--color-primary)' }} /> : <PlusOutlined />
                    }
                    size="small"
                    onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
                  />
                </StatusIndicator>
              </PluginHeader>
              <Popover
                content={
                  <PopoverContent>
                    {plugin.description || t('vcp.plugin.no_description')}
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
                <PluginDescription>{plugin.description || t('vcp.plugin.no_description')}</PluginDescription>
              </Popover>
              <PluginFooter>
                {plugin.isNative && (
                  <Tag
                    icon={<ThunderboltOutlined />}
                    color="blue"
                    style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                    {t('vcp.plugin.native_tag', 'Native')}
                  </Tag>
                )}
                {plugin.isBuiltin && !plugin.isNative && (
                  <Tag color="green" style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                    VCP
                  </Tag>
                )}
                <Tag
                  color={VCP_TYPE_COLORS[plugin.type] || 'default'}
                  style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                  {plugin.type}
                </Tag>
                {plugin.category && (
                  <Tag color="geekblue" style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                    {t(`vcp.plugin.category.${plugin.category}`, plugin.category)}
                  </Tag>
                )}
                {plugin.requiresConfig && (
                  <Tag color="gold" style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                    {t('vcp.plugin.requires_config', '需配置')}
                  </Tag>
                )}
                {plugin.distributed && (
                  <Tag
                    icon={<CloudServerOutlined />}
                    color="volcano"
                    style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                    {t('vcp.plugin.distributed')}
                  </Tag>
                )}
              </PluginFooter>
            </PluginCard>
          ))}
        </PluginsGrid>
      )}

      {/* 配置弹窗 */}
      <Modal
        title={t('vcp.plugin.config_title', `配置 ${selectedPlugin?.displayName || ''}`)}
        open={configModalVisible}
        onOk={saveConfig}
        onCancel={closeConfigModal}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        confirmLoading={configLoading}
        width={560}
        destroyOnClose>
        {configLoading ? (
          <ConfigLoadingContainer>
            <Spin />
          </ConfigLoadingContainer>
        ) : (
          <>
            {/* 插件配置表单 - 仅在有 configSchema 时显示 */}
            {configSchema?.properties && Object.keys(configSchema.properties).length > 0 && (
              <Form form={form} layout="vertical" initialValues={configValues}>
                {Object.entries(configSchema.properties)
                  // MagiAgent: 过滤掉贤者模型配置字段，这些字段通过专用UI配置
                  .filter(([key]) => {
                    if (selectedPlugin?.name === 'MagiAgent') {
                      return !['defaultTemplateId', 'sageModels'].includes(key)
                    }
                    return true
                  })
                  .map(([key, schema]: [string, any]) => (
                    <Form.Item
                      key={key}
                      name={key}
                      label={schema.description || key}
                      rules={[{ required: configSchema.required?.includes(key) }]}>
                      {schema.type === 'boolean' ? (
                        <Select
                          options={[
                            { value: true, label: t('common.yes', '是') },
                            { value: false, label: t('common.no', '否') }
                          ]}
                        />
                      ) : schema.enum ? (
                        <Select options={schema.enum.map((v: string) => ({ value: v, label: v }))} />
                      ) : /key|token|secret|password|api_key/i.test(key) ? (
                        <Input.Password placeholder={schema.default?.toString() || ''} visibilityToggle />
                      ) : (
                        <Input placeholder={schema.default?.toString() || ''} />
                      )}
                    </Form.Item>
                  ))}
              </Form>
            )}

            {/* MagiAgent 贤者模板配置 */}
            {selectedPlugin?.name === 'MagiAgent' && (
              <>
                {configSchema?.properties && Object.keys(configSchema.properties).length > 0 && (
                  <Divider style={{ margin: '16px 0' }} />
                )}
                <Collapse
                  defaultActiveKey={['magi-template', 'magi-models']}
                  ghost
                  items={[
                    {
                      key: 'magi-template',
                      label: (
                        <ModelConfigHeader>
                          <BookOutlined style={{ marginRight: 8 }} />
                          贤者模板选择
                          {selectedMagiTemplate && (
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              {magiTemplates.find((t) => t.id === selectedMagiTemplate)?.name || selectedMagiTemplate}
                            </Tag>
                          )}
                        </ModelConfigHeader>
                      ),
                      children: (
                        <ModelConfigContainer>
                          <Select
                            value={selectedMagiTemplate}
                            onChange={(val) => setSelectedMagiTemplate(val)}
                            style={{ width: '100%' }}
                            optionLabelProp="label">
                            {/* 按类别分组 */}
                            {['general', 'design', 'knowledge', 'business', 'creative'].map((category) => {
                              const categoryTemplates = magiTemplates.filter((t) => t.category === category)
                              if (categoryTemplates.length === 0) return null
                              const categoryNames: Record<string, string> = {
                                general: '通用',
                                design: '设计',
                                knowledge: '知识',
                                business: '商业',
                                creative: '创意'
                              }
                              return (
                                <Select.OptGroup key={category} label={categoryNames[category] || category}>
                                  {categoryTemplates.map((template) => (
                                    <Select.Option
                                      key={template.id}
                                      value={template.id}
                                      label={`${template.icon} ${template.name}`}>
                                      <div>
                                        <span style={{ marginRight: 8 }}>{template.icon}</span>
                                        <strong>{template.name}</strong>
                                        <div
                                          style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                                          {template.description}
                                        </div>
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select.OptGroup>
                              )
                            })}
                          </Select>

                          {/* 显示当前模板的贤者信息 */}
                          {(() => {
                            const currentTemplate = magiTemplates.find((t) => t.id === selectedMagiTemplate)
                            if (!currentTemplate) return null
                            return (
                              <div style={{ marginTop: 12 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--color-text-2)',
                                    marginBottom: 8
                                  }}>
                                  该模板包含 {currentTemplate.sages.length} 位贤者：
                                </div>
                                {currentTemplate.sages.map((sage) => (
                                  <div
                                    key={sage.id}
                                    style={{
                                      padding: '6px 10px',
                                      marginBottom: 4,
                                      background: 'var(--color-background-soft)',
                                      borderRadius: 6,
                                      fontSize: 12
                                    }}>
                                    <strong>{sage.name}</strong>
                                    <span style={{ color: 'var(--color-text-3)', marginLeft: 8 }}>
                                      {sage.perspective}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </ModelConfigContainer>
                      )
                    },
                    {
                      key: 'magi-models',
                      label: (
                        <ModelConfigHeader>
                          <RobotOutlined style={{ marginRight: 8 }} />
                          贤者模型配置
                          {Object.values(magiSageModels).some((m) => m.modelId) && (
                            <Tag color="green" style={{ marginLeft: 8 }}>
                              已配置
                            </Tag>
                          )}
                        </ModelConfigHeader>
                      ),
                      children: (
                        <ModelConfigContainer>
                          {/* 动态渲染当前模板的贤者模型选择器 */}
                          {(() => {
                            const currentTemplate = magiTemplates.find((t) => t.id === selectedMagiTemplate)
                            if (!currentTemplate || currentTemplate.sages.length === 0) {
                              return (
                                <div style={{ color: 'var(--color-text-3)', textAlign: 'center', padding: 20 }}>
                                  请先选择贤者模板
                                </div>
                              )
                            }
                            return currentTemplate.sages.map((sage) => (
                              <ModelConfigRow key={sage.id}>
                                <ModelConfigLabel style={{ minWidth: 140 }}>{sage.name}</ModelConfigLabel>
                                <ModelSelectorWrapper>
                                  <ModelSelector
                                    providers={providers}
                                    value={
                                      magiSageModels[sage.id]?.providerId && magiSageModels[sage.id]?.modelId
                                        ? JSON.stringify({
                                            id: magiSageModels[sage.id].modelId,
                                            provider: magiSageModels[sage.id].providerId
                                          })
                                        : undefined
                                    }
                                    onChange={(val) => {
                                      if (val) {
                                        try {
                                          const parsed = JSON.parse(val)
                                          setMagiSageModels((prev) => ({
                                            ...prev,
                                            [sage.id]: { providerId: parsed.provider, modelId: parsed.id }
                                          }))
                                        } catch {
                                          /* ignore */
                                        }
                                      } else {
                                        setMagiSageModels((prev) => ({
                                          ...prev,
                                          [sage.id]: {}
                                        }))
                                      }
                                    }}
                                    style={{ width: '100%' }}
                                  />
                                </ModelSelectorWrapper>
                              </ModelConfigRow>
                            ))
                          })()}

                          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            提示：每位贤者可使用不同的 AI 模型，实现真正的多模型辩论。未配置的贤者将使用默认模型。
                          </div>
                        </ModelConfigContainer>
                      )
                    }
                  ]}
                />
              </>
            )}

            {/* 模型绑定配置 - 仅对明确声明 supportsModel 的插件/服务显示，且排除 MagiAgent */}
            {selectedPlugin?.supportsModel && selectedPlugin?.name !== 'MagiAgent' && (
              <>
                {configSchema?.properties && Object.keys(configSchema.properties).length > 0 && (
                  <Divider style={{ margin: '16px 0' }} />
                )}
                <Collapse
                  defaultActiveKey={modelConfig.enabled ? ['model'] : []}
                  ghost
                  items={[
                    {
                      key: 'model',
                      label: (
                        <ModelConfigHeader>
                          <RobotOutlined style={{ marginRight: 8 }} />
                          {t('vcp.plugin.model_binding', '模型绑定')}
                          {modelConfig.enabled && (
                            <Tag color="green" style={{ marginLeft: 8 }}>
                              {t('vcp.plugin.model_enabled', '已启用')}
                            </Tag>
                          )}
                        </ModelConfigHeader>
                      ),
                      children: (
                        <ModelConfigContainer>
                          <ModelConfigRow>
                            <ModelConfigLabel>{t('vcp.plugin.enable_model', '启用模型')}</ModelConfigLabel>
                            <Switch
                              checked={modelConfig.enabled}
                              onChange={(checked) => setModelConfig((prev) => ({ ...prev, enabled: checked }))}
                            />
                          </ModelConfigRow>

                          {modelConfig.enabled && (
                            <>
                              <ModelConfigRow>
                                <ModelConfigLabel>{t('vcp.plugin.select_model', '选择模型')}</ModelConfigLabel>
                                <ModelSelectorWrapper>
                                  <ModelSelector
                                    providers={providers}
                                    value={
                                      modelConfig.providerId && modelConfig.modelId
                                        ? JSON.stringify({
                                            id: modelConfig.modelId,
                                            provider: modelConfig.providerId
                                          })
                                        : undefined
                                    }
                                    onChange={(val) => {
                                      if (val) {
                                        try {
                                          const parsed = JSON.parse(val)
                                          setModelConfig((prev) => ({
                                            ...prev,
                                            providerId: parsed.provider,
                                            modelId: parsed.id
                                          }))
                                        } catch {
                                          // ignore parse error
                                        }
                                      }
                                    }}
                                    style={{ width: '100%' }}
                                  />
                                </ModelSelectorWrapper>
                              </ModelConfigRow>

                              <ModelConfigRow>
                                <ModelConfigLabel>{t('vcp.plugin.temperature', '温度')}</ModelConfigLabel>
                                <InputNumber
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  value={modelConfig.temperature}
                                  onChange={(v) => setModelConfig((prev) => ({ ...prev, temperature: v ?? 0.7 }))}
                                  style={{ width: 120 }}
                                />
                              </ModelConfigRow>

                              <ModelConfigRow>
                                <ModelConfigLabel>{t('vcp.plugin.max_tokens', '最大 Token')}</ModelConfigLabel>
                                <InputNumber
                                  min={1}
                                  max={128000}
                                  step={256}
                                  value={modelConfig.maxTokens}
                                  onChange={(v) => setModelConfig((prev) => ({ ...prev, maxTokens: v ?? 4096 }))}
                                  style={{ width: 120 }}
                                />
                              </ModelConfigRow>

                              <ModelConfigRow>
                                <ModelConfigLabel>{t('vcp.plugin.streaming', '流式输出')}</ModelConfigLabel>
                                <Switch
                                  checked={modelConfig.streaming}
                                  onChange={(checked) => setModelConfig((prev) => ({ ...prev, streaming: checked }))}
                                />
                              </ModelConfigRow>

                              <ModelConfigRow style={{ alignItems: 'flex-start' }}>
                                <ModelConfigLabel>{t('vcp.plugin.system_prompt', '系统提示词')}</ModelConfigLabel>
                                <Input.TextArea
                                  rows={3}
                                  value={modelConfig.systemPrompt}
                                  onChange={(e) =>
                                    setModelConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))
                                  }
                                  placeholder={t('vcp.plugin.system_prompt_placeholder', '可选的系统提示词')}
                                  style={{ flex: 1 }}
                                />
                              </ModelConfigRow>
                            </>
                          )}
                        </ModelConfigContainer>
                      )
                    }
                  ]}
                />
              </>
            )}

            {/* 无可配置选项提示 - 仅在既没有 configSchema 也不是内置服务时显示 */}
            {(!configSchema?.properties || Object.keys(configSchema.properties).length === 0) &&
              !selectedPlugin?.supportsModel &&
              !selectedPlugin?.isBuiltin && (
                <NoConfigMessage>
                  {t('vcp.plugin.no_config_schema', '插件未定义 configSchema，无法进行配置。如需配置，请联系插件开发者添加配置模式。')}
                </NoConfigMessage>
              )}
          </>
        )}
      </Modal>

      {/* 插件详情弹窗 */}
      <Modal
        title={
          <DetailsModalTitle>
            <span>{selectedPlugin?.displayName || ''}</span>
            {selectedPlugin && (
              <Tag color={VCP_TYPE_COLORS[selectedPlugin.type] || 'default'}>{selectedPlugin.type}</Tag>
            )}
          </DetailsModalTitle>
        }
        open={detailsModalVisible}
        onCancel={closeDetailsModal}
        footer={null}
        width={720}
        destroyOnClose>
        {detailsLoading ? (
          <ConfigLoadingContainer>
            <Spin />
          </ConfigLoadingContainer>
        ) : (
          <DetailsContent>
            {/* 插件基本信息 */}
            <DetailsHeader>
              <DetailsInfoRow>
                <DetailsInfoItem>
                  <UserOutlined style={{ marginRight: 6 }} />
                  <span>{t('vcp.plugin.author', '作者')}: </span>
                  <strong>{pluginDetails?.author || selectedPlugin?.name || '-'}</strong>
                </DetailsInfoItem>
                <DetailsInfoItem>
                  <span>{t('vcp.plugin.version', '版本')}: </span>
                  <strong>v{selectedPlugin?.version || '1.0.0'}</strong>
                </DetailsInfoItem>
              </DetailsInfoRow>
              <DetailsDescription>{selectedPlugin?.description}</DetailsDescription>
            </DetailsHeader>

            <Divider style={{ margin: '12px 0' }} />

            {/* 标签页内容 */}
            <Tabs
              defaultActiveKey="readme"
              items={[
                {
                  key: 'readme',
                  label: (
                    <span>
                      <BookOutlined /> {t('vcp.plugin.readme', '说明文档')}
                    </span>
                  ),
                  children: pluginDetails?.readme ? (
                    <ReadmeContainer>
                      <ReactMarkdown>{pluginDetails.readme}</ReactMarkdown>
                    </ReadmeContainer>
                  ) : (
                    <NoContentMessage>
                      <FileTextOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                      <div>{t('vcp.plugin.no_readme', '暂无说明文档')}</div>
                    </NoContentMessage>
                  )
                },
                {
                  key: 'systemPrompt',
                  label: (
                    <span>
                      <RobotOutlined /> {t('vcp.plugin.system_prompt', '系统提示词')}
                    </span>
                  ),
                  children: pluginDetails?.systemPrompt ? (
                    <SystemPromptContainer>
                      <SystemPromptHeader>
                        <span>
                          <FileTextOutlined style={{ marginRight: 6 }} />
                          {pluginDetails.systemPromptFile}
                        </span>
                        <Button type="primary" size="small" onClick={useDefaultSystemPrompt}>
                          {t('vcp.plugin.use_as_default', '设为默认')}
                        </Button>
                      </SystemPromptHeader>
                      <SystemPromptContent>{pluginDetails.systemPrompt}</SystemPromptContent>
                    </SystemPromptContainer>
                  ) : (
                    <NoContentMessage>
                      <RobotOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                      <div>{t('vcp.plugin.no_system_prompt', '此插件没有预设系统提示词')}</div>
                    </NoContentMessage>
                  )
                },
                {
                  key: 'commands',
                  label: (
                    <span>
                      <CodeOutlined /> {t('vcp.plugin.commands', '命令')}
                    </span>
                  ),
                  children:
                    pluginDetails?.invocationCommands && pluginDetails.invocationCommands.length > 0 ? (
                      <CommandsContainer>
                        {pluginDetails.invocationCommands.map((cmd, idx) => (
                          <CommandCard key={idx}>
                            <CommandHeader>
                              <CommandName>{cmd.commandIdentifier}</CommandName>
                            </CommandHeader>
                            <CommandDescription>{cmd.description}</CommandDescription>
                            {cmd.example && (
                              <CommandExample>
                                <strong>{t('vcp.plugin.example', '示例')}:</strong>
                                <pre>{cmd.example}</pre>
                              </CommandExample>
                            )}
                          </CommandCard>
                        ))}
                      </CommandsContainer>
                    ) : (
                      <NoContentMessage>
                        <CodeOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                        <div>{t('vcp.plugin.no_commands', '无命令定义')}</div>
                      </NoContentMessage>
                    )
                }
              ]}
            />
          </DetailsContent>
        )}
      </Modal>
    </>
  )
}

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
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`

const PluginCard = styled.div`
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--color-border);
  border-radius: var(--list-item-border-radius);
  padding: 10px 16px;
  transition: all 0.2s ease;
  background-color: var(--color-background);
  height: 125px;
  cursor: default;

  &:hover {
    border-color: var(--color-primary);
  }
`

const PluginHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 5px;
`

const PluginName = styled.div`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;
`

const PluginNameText = styled.span`
  font-size: 15px;
  font-weight: 500;
`

const VersionTag = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  background: var(--color-background-soft);
  padding: 1px 6px;
  border-radius: 4px;
`

const StatusIndicator = styled.div`
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`

const PluginDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  width: 100%;
  word-break: break-word;
  max-height: calc(1.4em * 2);
  cursor: pointer;
  position: relative;

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
  justify-content: flex-start;
  margin-top: auto;
`

const ConfigLoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 150px;
`

const NoConfigMessage = styled.div`
  text-align: center;
  color: var(--color-text-3);
  padding: 20px;
`

const ModelConfigHeader = styled.div`
  display: flex;
  align-items: center;
  font-weight: 500;
`

const ModelConfigContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
`

const ModelConfigRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ModelConfigLabel = styled.span`
  width: 100px;
  flex-shrink: 0;
  color: var(--color-text-2);
  font-size: 13px;
`

const ModelSelectorWrapper = styled.div`
  flex: 1;
`

// ==================== 详情弹窗样式 ====================

const DetailsModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const DetailsContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`

const DetailsHeader = styled.div`
  padding: 0 4px;
`

const DetailsInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 8px;
`

const DetailsInfoItem = styled.div`
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--color-text-2);

  strong {
    margin-left: 4px;
    color: var(--color-text-1);
  }
`

const DetailsDescription = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
`

const ReadmeContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  font-size: 14px;

  h1,
  h2,
  h3 {
    margin-top: 16px;
    margin-bottom: 8px;
  }

  pre {
    background: var(--color-background-mute);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
  }

  code {
    background: var(--color-background-mute);
    padding: 2px 6px;
    border-radius: 4px;
  }

  ul,
  ol {
    padding-left: 20px;
  }
`

const SystemPromptContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const SystemPromptHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-2);
`

const SystemPromptContent = styled.pre`
  max-height: 350px;
  overflow-y: auto;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
`

const CommandsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const CommandCard = styled.div`
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const CommandHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const CommandName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: monospace;
`

const CommandDescription = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`

const CommandExample = styled.div`
  margin-top: 10px;
  font-size: 12px;

  strong {
    color: var(--color-text-2);
  }

  pre {
    margin-top: 6px;
    padding: 10px;
    background: var(--color-background-mute);
    border-radius: 6px;
    overflow-x: auto;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }
`

const NoContentMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  color: var(--color-text-3);
  font-size: 14px;
`

export default VCPPluginList
