/**
 * External Plugin Manager UI
 *
 * 外部插件管理界面
 * 支持安装、卸载、启用/禁用、配置外部插件
 *
 * 外部插件来源于 userData/vcp/plugins 目录
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Text, Paragraph } = Typography
const { TextArea } = Input

// 外部插件类型
interface ExternalPlugin {
  name: string
  displayName: string
  version: string
  description: string
  type: string
  enabled: boolean
  installedAt: string
  path: string
  author?: string
  homepage?: string
  config?: Record<string, unknown>
  configSchema?: Record<string, ConfigFieldSchema>
  defaultConfig?: Record<string, unknown>
}

// 配置字段 Schema
interface ConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  default?: unknown
  description?: string
  enum?: string[]
  min?: number
  max?: number
}

// 可用插件类型 (用于批量安装)
interface AvailablePlugin {
  path: string
  name: string
  selected: boolean
}

// 插件类型颜色
const PLUGIN_TYPE_COLORS: Record<string, string> = {
  static: 'blue',
  synchronous: 'green',
  asynchronous: 'orange',
  messagePreprocessor: 'purple',
  service: 'cyan',
  hybridservice: 'magenta'
}

// 插件类型说明
const PLUGIN_TYPE_DESCRIPTIONS: Record<string, string> = {
  static: '静态配置/文本',
  synchronous: '同步执行',
  asynchronous: '异步执行',
  messagePreprocessor: '消息预处理器',
  service: 'HTTP 服务',
  hybridservice: '混合服务'
}

// 插件类型图标
const PLUGIN_TYPE_ICONS: Record<string, string> = {
  static: '📄',
  synchronous: '⚡',
  asynchronous: '🔄',
  messagePreprocessor: '📝',
  service: '🌐',
  hybridservice: '🔀'
}

const ExternalPluginManager: FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [plugins, setPlugins] = useState<ExternalPlugin[]>([])
  const [paths, setPaths] = useState<{ plugins: string; assets: string; config: string } | null>(null)
  const [selectedPlugin, setSelectedPlugin] = useState<ExternalPlugin | null>(null)
  const [detailsVisible, setDetailsVisible] = useState(false)

  // 配置相关状态
  const [configVisible, setConfigVisible] = useState(false)
  const [configPlugin, setConfigPlugin] = useState<ExternalPlugin | null>(null)
  const [configForm] = Form.useForm()
  const [configSaving, setConfigSaving] = useState(false)

  // 批量安装相关状态
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [availablePlugins, setAvailablePlugins] = useState<AvailablePlugin[]>([])
  const [batchInstalling, setBatchInstalling] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResult, setBatchResult] = useState<{
    installed: number
    failed: number
    skipped: number
  } | null>(null)

  // 加载插件列表
  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      // 初始化外部插件管理器
      await window.api.externalPlugin?.initialize?.()

      // 获取路径信息
      const pathsResult = await window.api.externalPlugin?.getPaths?.()
      if (pathsResult?.success) {
        setPaths(pathsResult.data)
      }

      // 获取插件列表
      const result = await window.api.externalPlugin?.listPlugins?.()
      if (result?.success) {
        setPlugins(result.data || [])
      }
    } catch (error) {
      console.error('Failed to load external plugins:', error)
      window.toast?.error(t('vcp.external.load_error', '加载外部插件失败'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  // 安装插件
  const installPlugin = async () => {
    try {
      const folderPath = await window.api.file?.selectFolder?.()
      if (!folderPath) return

      const result = await window.api.externalPlugin?.install?.(folderPath)

      if (result?.success) {
        window.toast?.success(t('vcp.external.install_success', '插件安装成功'))
        await loadPlugins()
      } else if (result?.isMultiple && result?.availablePlugins) {
        // 发现多个插件，显示批量安装对话框
        setAvailablePlugins(
          result.availablePlugins.map((p) => ({
            ...p,
            selected: true
          }))
        )
        setBatchResult(null)
        setBatchProgress(0)
        setBatchModalVisible(true)
      } else {
        window.toast?.error(result?.error || t('vcp.external.install_error', '插件安装失败'))
      }
    } catch (error) {
      window.toast?.error(String(error))
    }
  }

  // 批量安装选中的插件
  const installSelectedPlugins = async () => {
    const selectedPaths = availablePlugins.filter((p) => p.selected).map((p) => p.path)

    if (selectedPaths.length === 0) {
      window.toast?.warning(t('vcp.external.no_selected', '请选择至少一个插件'))
      return
    }

    setBatchInstalling(true)
    setBatchProgress(0)

    try {
      const result = await window.api.externalPlugin?.installBatch?.(selectedPaths)

      if (result?.success && result.data) {
        setBatchResult({
          installed: result.data.installed?.length || 0,
          failed: result.data.failed?.length || 0,
          skipped: result.data.skipped?.length || 0
        })
        setBatchProgress(100)

        if (result.data.installed?.length > 0) {
          await loadPlugins()
        }
      } else {
        window.toast?.error(result?.error || t('vcp.external.batch_install_error', '批量安装失败'))
      }
    } catch (error) {
      window.toast?.error(String(error))
    } finally {
      setBatchInstalling(false)
    }
  }

  // 切换插件选择状态
  const togglePluginSelection = (index: number) => {
    setAvailablePlugins((prev) => prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)))
  }

  // 全选/取消全选
  const toggleSelectAll = (selected: boolean) => {
    setAvailablePlugins((prev) => prev.map((p) => ({ ...p, selected })))
  }

  // 卸载插件
  const uninstallPlugin = async (name: string) => {
    try {
      const result = await window.api.externalPlugin?.uninstall?.(name)
      if (result?.success) {
        window.toast?.success(t('vcp.external.uninstall_success', '插件卸载成功'))
        await loadPlugins()
      } else {
        window.toast?.error(result?.error || t('vcp.external.uninstall_error', '插件卸载失败'))
      }
    } catch (error) {
      window.toast?.error(String(error))
    }
  }

  // 切换启用状态
  const toggleEnabled = async (name: string, enabled: boolean) => {
    try {
      const result = await window.api.externalPlugin?.setEnabled?.(name, enabled)
      if (result?.success) {
        setPlugins((prev) => prev.map((p) => (p.name === name ? { ...p, enabled } : p)))
        window.toast?.success(enabled ? t('vcp.external.enabled', '已启用') : t('vcp.external.disabled', '已禁用'))
      } else {
        window.toast?.error(result?.error || t('vcp.external.toggle_error', '切换状态失败'))
      }
    } catch (error) {
      window.toast?.error(String(error))
    }
  }

  // 打开插件目录
  const openPluginsFolder = async () => {
    try {
      await window.api.externalPlugin?.openPluginsFolder?.()
    } catch (error) {
      window.toast?.error(String(error))
    }
  }

  // 重新扫描
  const rescanPlugins = async () => {
    setLoading(true)
    try {
      await window.api.externalPlugin?.rescan?.()
      await loadPlugins()
      window.toast?.success(t('vcp.external.rescan_success', '扫描完成'))
    } catch (error) {
      window.toast?.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  // 显示详情
  const showDetails = (plugin: ExternalPlugin) => {
    setSelectedPlugin(plugin)
    setDetailsVisible(true)
  }

  // 显示配置
  const showConfig = async (plugin: ExternalPlugin) => {
    setConfigPlugin(plugin)
    configForm.resetFields()

    try {
      // 先设置默认值
      if (plugin.defaultConfig) {
        configForm.setFieldsValue(plugin.defaultConfig)
      }
      // 从 configSchema 获取默认值
      if (plugin.configSchema) {
        const schemaDefaults: Record<string, unknown> = {}
        Object.entries(plugin.configSchema).forEach(([key, schema]) => {
          if (schema.default !== undefined) {
            schemaDefaults[key] = schema.default
          }
        })
        configForm.setFieldsValue(schemaDefaults)
      }

      // 获取用户保存的配置覆盖默认值
      const result = await window.api.externalPlugin?.getConfig?.(plugin.name)
      if (result?.success && result.data) {
        configForm.setFieldsValue(result.data)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
    setConfigVisible(true)
  }

  // 渲染动态配置字段
  const renderConfigField = (key: string, schema: ConfigFieldSchema) => {
    const label = key
    const tooltip = schema.description
    const required = schema.required

    switch (schema.type) {
      case 'boolean':
        return (
          <Form.Item
            key={key}
            name={key}
            label={label}
            tooltip={tooltip}
            valuePropName="checked"
            rules={required ? [{ required: true, message: `请填写 ${key}` }] : undefined}>
            <Switch />
          </Form.Item>
        )

      case 'number':
        return (
          <Form.Item
            key={key}
            name={key}
            label={label}
            tooltip={tooltip}
            rules={required ? [{ required: true, message: `请填写 ${key}` }] : undefined}>
            <InputNumber
              min={schema.min}
              max={schema.max}
              style={{ width: '100%' }}
              placeholder={schema.default !== undefined ? String(schema.default) : undefined}
            />
          </Form.Item>
        )

      case 'string':
        // 如果有枚举值，使用 Select
        if (schema.enum && schema.enum.length > 0) {
          return (
            <Form.Item
              key={key}
              name={key}
              label={label}
              tooltip={tooltip}
              rules={required ? [{ required: true, message: `请选择 ${key}` }] : undefined}>
              <Select
                placeholder={`选择 ${key}`}
                options={schema.enum.map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
          )
        }

        // 如果默认值比较长或包含换行，使用 TextArea
        const defaultStr = String(schema.default || '')
        const useTextArea = defaultStr.length > 100 || defaultStr.includes('\n')

        return (
          <Form.Item
            key={key}
            name={key}
            label={label}
            tooltip={tooltip}
            rules={required ? [{ required: true, message: `请填写 ${key}` }] : undefined}>
            {useTextArea ? (
              <TextArea
                rows={3}
                placeholder={schema.default !== undefined ? String(schema.default) : undefined}
              />
            ) : (
              <Input placeholder={schema.default !== undefined ? String(schema.default) : undefined} />
            )}
          </Form.Item>
        )

      case 'array':
      case 'object':
        // 复杂类型使用 JSON 编辑器
        return (
          <Form.Item
            key={key}
            name={key}
            label={label}
            tooltip={tooltip}
            rules={required ? [{ required: true, message: `请填写 ${key}` }] : undefined}
            getValueFromEvent={(e) => {
              try {
                return JSON.parse(e.target.value)
              } catch {
                return e.target.value
              }
            }}
            getValueProps={(value) => ({
              value: typeof value === 'object' ? JSON.stringify(value, null, 2) : value
            })}>
            <TextArea
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={schema.default !== undefined ? JSON.stringify(schema.default, null, 2) : '[]'}
            />
          </Form.Item>
        )

      default:
        return (
          <Form.Item
            key={key}
            name={key}
            label={label}
            tooltip={tooltip}
            rules={required ? [{ required: true, message: `请填写 ${key}` }] : undefined}>
            <Input />
          </Form.Item>
        )
    }
  }

  // 保存配置
  const saveConfig = async () => {
    if (!configPlugin) return

    setConfigSaving(true)
    try {
      const values = configForm.getFieldsValue()
      const result = await window.api.externalPlugin?.updateConfig?.(configPlugin.name, values)
      if (result?.success) {
        window.toast?.success(t('vcp.external.config_saved', '配置已保存'))
        setConfigVisible(false)
      } else {
        window.toast?.error(result?.error || t('vcp.external.config_save_error', '保存配置失败'))
      }
    } catch (error) {
      window.toast?.error(String(error))
    } finally {
      setConfigSaving(false)
    }
  }

  // 渲染插件卡片
  const renderPluginCard = (plugin: ExternalPlugin) => {
    const typeIcon = PLUGIN_TYPE_ICONS[plugin.type] || '🔌'
    const typeColor = PLUGIN_TYPE_COLORS[plugin.type] || 'default'
    const typeDesc = PLUGIN_TYPE_DESCRIPTIONS[plugin.type] || plugin.type

    return (
      <PluginCard key={plugin.name} $enabled={plugin.enabled}>
        <CardHeader>
          <PluginIcon>{typeIcon}</PluginIcon>
          <PluginTitle>
            <PluginName>{plugin.displayName || plugin.name}</PluginName>
            <PluginVersion>v{plugin.version}</PluginVersion>
          </PluginTitle>
          <Switch
            checked={plugin.enabled}
            onChange={(checked) => toggleEnabled(plugin.name, checked)}
            size="small"
          />
        </CardHeader>

        <CardBody>
          <PluginDescription>{plugin.description || t('vcp.external.no_description', '暂无描述')}</PluginDescription>

          <PluginMeta>
            <Tooltip title={typeDesc}>
              <Tag color={typeColor} style={{ margin: 0 }}>
                {plugin.type}
              </Tag>
            </Tooltip>
            {plugin.author && (
              <MetaItem>
                <Text type="secondary">作者: {plugin.author}</Text>
              </MetaItem>
            )}
          </PluginMeta>
        </CardBody>

        <CardFooter>
          <FooterLeft>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {plugin.installedAt ? new Date(plugin.installedAt).toLocaleDateString() : ''}
            </Text>
          </FooterLeft>
          <FooterActions>
            <Tooltip title={t('vcp.external.config', '配置')}>
              <ActionButton onClick={() => showConfig(plugin)}>
                <SettingOutlined />
              </ActionButton>
            </Tooltip>
            <Tooltip title={t('vcp.external.details', '详情')}>
              <ActionButton onClick={() => showDetails(plugin)}>
                <InfoCircleOutlined />
              </ActionButton>
            </Tooltip>
            <Popconfirm
              title={t('vcp.external.uninstall_confirm', '确定要卸载此插件吗？')}
              description={t('vcp.external.uninstall_warning', '卸载后插件目录将被删除')}
              onConfirm={() => uninstallPlugin(plugin.name)}
              okText={t('common.confirm', '确定')}
              cancelText={t('common.cancel', '取消')}
              okButtonProps={{ danger: true }}>
              <Tooltip title={t('vcp.external.uninstall', '卸载')}>
                <ActionButton className="danger">
                  <DeleteOutlined />
                </ActionButton>
              </Tooltip>
            </Popconfirm>
          </FooterActions>
        </CardFooter>
      </PluginCard>
    )
  }

  return (
    <Container>
      <HeaderSection>
        <TitleSection>
          <Title>{t('vcp.external.title', '外部插件管理')}</Title>
          <Subtitle>
            {t('vcp.external.plugin_count', '已安装 {{count}} 个插件', { count: plugins.length })}
          </Subtitle>
        </TitleSection>
        <ActionButtons>
          <Button icon={<UploadOutlined />} type="primary" onClick={installPlugin}>
            {t('vcp.external.install', '安装插件')}
          </Button>
          <Tooltip title={t('vcp.external.open_folder', '打开插件目录')}>
            <Button icon={<FolderOpenOutlined />} onClick={openPluginsFolder} />
          </Tooltip>
          <Tooltip title={t('vcp.external.rescan', '重新扫描')}>
            <Button icon={<ReloadOutlined />} onClick={rescanPlugins} loading={loading} />
          </Tooltip>
        </ActionButtons>
      </HeaderSection>

      {paths && (
        <PathInfo>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('vcp.external.plugins_dir', '插件目录')}: <code>{paths.plugins}</code>
          </Text>
        </PathInfo>
      )}

      {loading ? (
        <LoadingContainer>
          <Spin tip={t('vcp.external.loading', '加载中...')} />
        </LoadingContainer>
      ) : plugins.length === 0 ? (
        <EmptyContainer>
          <Empty description={t('vcp.external.no_plugins', '暂无外部插件')}>
            <Button type="primary" icon={<UploadOutlined />} onClick={installPlugin}>
              {t('vcp.external.install_first', '安装第一个插件')}
            </Button>
          </Empty>
        </EmptyContainer>
      ) : (
        <PluginGrid>{plugins.map(renderPluginCard)}</PluginGrid>
      )}

      {/* 插件详情弹窗 */}
      <Modal
        title={
          <Space>
            <span>{PLUGIN_TYPE_ICONS[selectedPlugin?.type || ''] || '🔌'}</span>
            {selectedPlugin?.displayName || selectedPlugin?.name}
            {selectedPlugin && (
              <Tag color={PLUGIN_TYPE_COLORS[selectedPlugin.type] || 'default'}>{selectedPlugin.type}</Tag>
            )}
          </Space>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailsVisible(false)}>{t('common.close', '关闭')}</Button>
            {selectedPlugin && (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => {
                  setDetailsVisible(false)
                  showConfig(selectedPlugin)
                }}>
                {t('vcp.external.config', '配置')}
              </Button>
            )}
          </Space>
        }
        width={600}>
        {selectedPlugin && (
          <DetailsContent>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.name', '名称')}:</DetailLabel>
              <DetailValue>{selectedPlugin.name}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.display_name', '显示名称')}:</DetailLabel>
              <DetailValue>{selectedPlugin.displayName || '-'}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.version', '版本')}:</DetailLabel>
              <DetailValue>v{selectedPlugin.version}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.type', '类型')}:</DetailLabel>
              <DetailValue>
                <Tag color={PLUGIN_TYPE_COLORS[selectedPlugin.type] || 'default'}>{selectedPlugin.type}</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {PLUGIN_TYPE_DESCRIPTIONS[selectedPlugin.type] || ''}
                </Text>
              </DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.status', '状态')}:</DetailLabel>
              <DetailValue>
                {selectedPlugin.enabled ? (
                  <Tag color="success">{t('vcp.external.enabled', '已启用')}</Tag>
                ) : (
                  <Tag color="default">{t('vcp.external.disabled', '已禁用')}</Tag>
                )}
              </DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.installed_at', '安装时间')}:</DetailLabel>
              <DetailValue>
                {selectedPlugin.installedAt ? new Date(selectedPlugin.installedAt).toLocaleString() : '-'}
              </DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('vcp.external.detail.path', '路径')}:</DetailLabel>
              <DetailValue>
                <code style={{ wordBreak: 'break-all' }}>{selectedPlugin.path}</code>
              </DetailValue>
            </DetailItem>
            {selectedPlugin.description && (
              <DetailItem style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <DetailLabel>{t('vcp.external.detail.description', '描述')}:</DetailLabel>
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{selectedPlugin.description}</Paragraph>
              </DetailItem>
            )}

            {['synchronous', 'asynchronous'].includes(selectedPlugin.type) && (
              <Alert
                message={t('vcp.external.deprecated_warning', 'stdio 类型已弃用')}
                description={t(
                  'vcp.external.deprecated_description',
                  '此插件使用已弃用的 stdio 执行模式。建议将插件迁移到 service 或 hybridservice 类型。'
                )}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </DetailsContent>
        )}
      </Modal>

      {/* 插件配置弹窗 */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            {t('vcp.external.config_title', '插件配置')} - {configPlugin?.displayName || configPlugin?.name}
          </Space>
        }
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        onOk={saveConfig}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        confirmLoading={configSaving}
        width={700}>
        <ConfigModalContent>
          {configPlugin?.configSchema && Object.keys(configPlugin.configSchema).length > 0 ? (
            <>
              <Alert
                message={t('vcp.external.config_hint', '配置提示')}
                description={t(
                  'vcp.external.config_hint_desc',
                  '在此处配置插件参数。配置会被保存到 plugins.json 中，覆盖插件的默认配置。'
                )}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form form={configForm} layout="vertical" autoComplete="off">
                {Object.entries(configPlugin.configSchema).map(([key, schema]) =>
                  renderConfigField(key, schema)
                )}
              </Form>
            </>
          ) : (
            <EmptyConfigContainer>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('vcp.external.no_config_schema', '此插件没有可配置的选项')}
              />
              <Text type="secondary" style={{ marginTop: 12 }}>
                {t(
                  'vcp.external.no_config_hint',
                  '插件未定义 configSchema，无法进行配置。如需配置，请联系插件开发者添加配置模式。'
                )}
              </Text>
            </EmptyConfigContainer>
          )}
        </ConfigModalContent>
      </Modal>

      {/* 批量安装弹窗 */}
      <Modal
        title={t('vcp.external.batch_install_title', '批量安装插件')}
        open={batchModalVisible}
        onCancel={() => !batchInstalling && setBatchModalVisible(false)}
        footer={
          batchResult ? (
            <Button type="primary" onClick={() => setBatchModalVisible(false)}>
              {t('common.close', '关闭')}
            </Button>
          ) : (
            <Space>
              <Button onClick={() => setBatchModalVisible(false)} disabled={batchInstalling}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                type="primary"
                onClick={installSelectedPlugins}
                loading={batchInstalling}
                disabled={availablePlugins.filter((p) => p.selected).length === 0}>
                {t('vcp.external.install_selected', '安装选中')} ({availablePlugins.filter((p) => p.selected).length})
              </Button>
            </Space>
          )
        }
        width={700}
        closable={!batchInstalling}>
        {batchResult ? (
          <BatchResultContainer>
            <Progress percent={100} status="success" />
            <BatchResultStats>
              <BatchResultItem>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                <div>
                  <Text strong>{batchResult.installed}</Text>
                  <Text type="secondary"> {t('vcp.external.installed', '已安装')}</Text>
                </div>
              </BatchResultItem>
              {batchResult.skipped > 0 && (
                <BatchResultItem>
                  <WarningOutlined style={{ color: '#faad14', fontSize: 24 }} />
                  <div>
                    <Text strong>{batchResult.skipped}</Text>
                    <Text type="secondary"> {t('vcp.external.skipped', '已跳过')}</Text>
                  </div>
                </BatchResultItem>
              )}
              {batchResult.failed > 0 && (
                <BatchResultItem>
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
                  <div>
                    <Text strong>{batchResult.failed}</Text>
                    <Text type="secondary"> {t('vcp.external.failed', '失败')}</Text>
                  </div>
                </BatchResultItem>
              )}
            </BatchResultStats>
          </BatchResultContainer>
        ) : (
          <>
            <BatchHeader>
              <Text>
                {t('vcp.external.found_plugins', '发现 {{count}} 个插件', {
                  count: availablePlugins.length
                })}
              </Text>
              <Space>
                <Button size="small" onClick={() => toggleSelectAll(true)}>
                  {t('common.select_all', '全选')}
                </Button>
                <Button size="small" onClick={() => toggleSelectAll(false)}>
                  {t('common.deselect_all', '取消全选')}
                </Button>
              </Space>
            </BatchHeader>
            <BatchPluginList>
              {availablePlugins.map((plugin, index) => (
                <BatchPluginItem key={plugin.path} onClick={() => togglePluginSelection(index)}>
                  <Checkbox checked={plugin.selected} />
                  <BatchPluginInfo>
                    <Text strong>{plugin.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {plugin.path}
                    </Text>
                  </BatchPluginInfo>
                </BatchPluginItem>
              ))}
            </BatchPluginList>
            {batchInstalling && <Progress percent={batchProgress} status="active" style={{ marginTop: 16 }} />}
          </>
        )}
      </Modal>
    </Container>
  )
}

// ==================== Styled Components ====================

const Container = styled.div`
  padding: 20px;
  height: 100%;
  overflow-y: auto;
`

const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`

const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
`

const Subtitle = styled.span`
  font-size: 13px;
  color: var(--color-text-3);
`

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`

const PathInfo = styled.div`
  margin-bottom: 20px;
  padding: 10px 14px;
  background: var(--color-background-soft);
  border-radius: 8px;

  code {
    background: var(--color-background-mute);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
`

// 卡片网格布局
const PluginGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`

// 插件卡片
const PluginCard = styled.div<{ $enabled: boolean }>`
  background: var(--color-background-soft);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  opacity: ${(props) => (props.$enabled ? 1 : 0.6)};

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const PluginIcon = styled.span`
  font-size: 28px;
  line-height: 1;
`

const PluginTitle = styled.div`
  flex: 1;
  min-width: 0;
`

const PluginName = styled.div`
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const PluginVersion = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
`

const CardBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const PluginDescription = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 39px;
`

const PluginMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

const MetaItem = styled.span`
  font-size: 12px;
`

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
`

const FooterLeft = styled.div``

const FooterActions = styled.div`
  display: flex;
  gap: 4px;
`

const ActionButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-2);
  transition: all 0.2s;

  &:hover {
    background: var(--color-background-mute);
    color: var(--color-primary);
  }

  &.danger:hover {
    background: rgba(255, 77, 79, 0.1);
    color: #ff4d4f;
  }
`

// 详情弹窗
const DetailsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const DetailLabel = styled.span`
  width: 100px;
  flex-shrink: 0;
  color: var(--color-text-2);
  font-size: 13px;
`

const DetailValue = styled.div`
  flex: 1;
  font-size: 13px;

  code {
    background: var(--color-background-soft);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
`

// 配置弹窗
const ConfigModalContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`

const EmptyConfigContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
`

// 批量安装相关样式
const BatchHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
`

const BatchPluginList = styled.div`
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const BatchPluginItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--color-background-mute);
  }
`

const BatchPluginInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow: hidden;

  span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const BatchResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;
`

const BatchResultStats = styled.div`
  display: flex;
  justify-content: center;
  gap: 48px;
`

const BatchResultItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  div {
    display: flex;
    flex-direction: column;
  }
`

export default ExternalPluginManager
