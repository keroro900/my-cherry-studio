/**
 * 插件配置编辑器
 *
 * 基于 configSchema 动态生成表单，支持：
 * - 字符串输入（普通/密码）
 * - 数字输入
 * - 布尔开关
 * - 枚举选择
 *
 * 配置变更实时同步到后端
 */

import { EyeInvisibleOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Drawer, Empty, Form, Input, InputNumber, Select, Space, Spin, Switch } from 'antd'
import { Key, Settings } from 'lucide-react'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 配置 Schema 类型
interface ConfigSchemaProperty {
  type: string
  description?: string
  default?: unknown
  enum?: string[]
}

interface ConfigSchema {
  type: string
  properties: Record<string, ConfigSchemaProperty>
  required?: string[]
}

// 插件配置数据
interface PluginConfigData {
  pluginId: string
  displayName: string
  configSchema: ConfigSchema | null
  defaultConfig: Record<string, unknown>
  currentConfig: Record<string, unknown>
}

interface PluginConfigEditorProps {
  pluginId: string | null
  pluginName?: string
  visible: boolean
  onClose: () => void
  onConfigSaved?: () => void
}

const PluginConfigEditor: FC<PluginConfigEditorProps> = ({ pluginId, pluginName, visible, onClose, onConfigSaved }) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configData, setConfigData] = useState<PluginConfigData | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // 加载插件配置
  const loadConfig = useCallback(async () => {
    if (!pluginId) return

    setLoading(true)
    try {
      const result = await window.api.vcpPlugin.getConfig(pluginId)
      if (result.success && result.data) {
        setConfigData(result.data)

        // 设置表单初始值（当前配置 > 默认配置）
        const initialValues = {
          ...result.data.defaultConfig,
          ...result.data.currentConfig
        }
        form.setFieldsValue(initialValues)
      } else {
        setConfigData(null)
      }
    } catch (error) {
      console.error('Failed to load plugin config:', error)
      setConfigData(null)
    } finally {
      setLoading(false)
    }
  }, [pluginId, form])

  // 加载配置
  useEffect(() => {
    if (visible && pluginId) {
      loadConfig()
    }
  }, [visible, pluginId, loadConfig])

  // 保存配置
  const handleSave = async () => {
    if (!pluginId) return

    try {
      const values = await form.validateFields()
      setSaving(true)

      const result = await window.api.vcpPlugin.updateConfig(pluginId, values)
      if (result.success) {
        window.toast.success(t('settings.mcp.config_saved', '配置已保存'))
        onConfigSaved?.()
      } else {
        window.toast.error(result.error || t('settings.mcp.config_save_failed', '保存失败'))
      }
    } catch (error) {
      console.error('Failed to save plugin config:', error)
      window.toast.error(t('settings.mcp.config_save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  // 切换密码可见性
  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // 判断是否为密码/密钥字段
  const isSecretField = (key: string): boolean => {
    const lowerKey = key.toLowerCase()
    return (
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('api')
    )
  }

  // 渲染表单字段
  const renderFormField = (key: string, schema: ConfigSchemaProperty, required: boolean) => {
    const { type, description, enum: enumValues } = schema
    const isSecret = isSecretField(key)

    // 枚举类型 -> Select
    if (enumValues && enumValues.length > 0) {
      return (
        <Form.Item
          key={key}
          name={key}
          label={
            <FieldLabel>
              {key}
              {description && <FieldDescription>{description}</FieldDescription>}
            </FieldLabel>
          }
          rules={[{ required, message: t('common.required') }]}>
          <Select
            options={enumValues.map((v) => ({ label: v, value: v }))}
            placeholder={t('common.select')}
            allowClear
          />
        </Form.Item>
      )
    }

    // 布尔类型 -> Switch
    if (type === 'boolean') {
      return (
        <Form.Item
          key={key}
          name={key}
          label={
            <FieldLabel>
              {key}
              {description && <FieldDescription>{description}</FieldDescription>}
            </FieldLabel>
          }
          valuePropName="checked">
          <Switch />
        </Form.Item>
      )
    }

    // 数字类型 -> InputNumber
    if (type === 'number' || type === 'integer') {
      return (
        <Form.Item
          key={key}
          name={key}
          label={
            <FieldLabel>
              {key}
              {description && <FieldDescription>{description}</FieldDescription>}
            </FieldLabel>
          }
          rules={[{ required, message: t('common.required') }]}>
          <InputNumber style={{ width: '100%' }} placeholder={description} />
        </Form.Item>
      )
    }

    // 字符串类型 -> Input（密钥类型显示密码输入框）
    if (isSecret) {
      const isVisible = showPasswords[key]
      return (
        <Form.Item
          key={key}
          name={key}
          label={
            <FieldLabel>
              <Key size={14} style={{ marginRight: 4 }} />
              {key}
              {description && <FieldDescription>{description}</FieldDescription>}
            </FieldLabel>
          }
          rules={[{ required, message: t('common.required') }]}>
          <Input.Password
            placeholder={description || t('settings.mcp.enter_api_key', '请输入 API Key')}
            visibilityToggle={{
              visible: isVisible,
              onVisibleChange: () => togglePasswordVisibility(key)
            }}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>
      )
    }

    // 默认 -> Input
    return (
      <Form.Item
        key={key}
        name={key}
        label={
          <FieldLabel>
            {key}
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldLabel>
        }
        rules={[{ required, message: t('common.required') }]}>
        <Input placeholder={description} />
      </Form.Item>
    )
  }

  // 渲染内容
  const renderContent = () => {
    if (loading) {
      return (
        <LoadingContainer>
          <Spin tip={t('common.loading')} />
        </LoadingContainer>
      )
    }

    if (!configData) {
      return (
        <Empty
          image={<Settings size={48} style={{ opacity: 0.3 }} />}
          description={t('settings.mcp.no_config_schema', '此插件无可配置项')}
        />
      )
    }

    const { configSchema } = configData
    if (!configSchema || !configSchema.properties || Object.keys(configSchema.properties).length === 0) {
      return (
        <Empty
          image={<Settings size={48} style={{ opacity: 0.3 }} />}
          description={t('settings.mcp.no_config_schema', '此插件无可配置项')}
        />
      )
    }

    const requiredFields = configSchema.required || []

    return (
      <Form form={form} layout="vertical" requiredMark="optional">
        {Object.entries(configSchema.properties).map(([key, schema]) =>
          renderFormField(key, schema, requiredFields.includes(key))
        )}
      </Form>
    )
  }

  const hasConfig = configData?.configSchema?.properties && Object.keys(configData.configSchema.properties).length > 0

  return (
    <Drawer
      title={
        <DrawerTitle>
          <Settings size={18} />
          <span>{pluginName || pluginId || t('settings.mcp.plugin_config', '插件配置')}</span>
        </DrawerTitle>
      }
      placement="right"
      width={450}
      open={visible}
      onClose={onClose}
      destroyOnClose
      footer={
        hasConfig && (
          <FooterContainer>
            <Space>
              <Button onClick={onClose}>{t('common.cancel')}</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                {t('common.save')}
              </Button>
            </Space>
          </FooterContainer>
        )
      }>
      <ContentContainer>{renderContent()}</ContentContainer>
    </Drawer>
  )
}

// 样式组件
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const ContentContainer = styled.div`
  .ant-form-item {
    margin-bottom: 20px;
  }

  .ant-form-item-label {
    padding-bottom: 4px;
  }
`

const DrawerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
`

const FieldLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const FieldDescription = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
  font-weight: normal;
`

const FooterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 10px 0;
`

export default PluginConfigEditor
