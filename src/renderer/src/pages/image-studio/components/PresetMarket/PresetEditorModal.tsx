/**
 * 预设编辑弹窗组件
 * PresetEditorModal
 *
 * 用于创建和编辑图片工坊预设
 */

import { TopView } from '@renderer/components/TopView'
import { useAppSelector } from '@renderer/store'
import { selectActiveModule, selectModuleConfig } from '@renderer/store/imageStudio'
import { Button, Form, Input, InputNumber, message, Modal, Select, Switch, Tabs } from 'antd'
import { Info, Layers, Save, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { presetMarketService } from '../../services/PresetMarketService'
import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../../types'
import { PRESET_CATEGORIES, type PresetCategory, type StudioPreset } from '../../types/preset-market'

// ============================================================================
// 配置选项定义
// ============================================================================

const ECOM_OPTIONS = {
  layout: [
    { value: 'flat_lay', label: '平铺' },
    { value: 'model_shot', label: '模特展示' },
    { value: 'hanging', label: '悬挂' },
    { value: 'none', label: '无' }
  ],
  fillMode: [
    { value: 'filled', label: '填充' },
    { value: 'flat', label: '平面' },
    { value: 'none', label: '无' }
  ],
  stylePreset: [
    { value: 'auto', label: '自动' },
    { value: 'shein', label: 'SHEIN风格' },
    { value: 'temu', label: 'TEMU风格' },
    { value: 'minimal', label: '极简' },
    { value: 'premium', label: '高端' }
  ],
  imageSize: [
    { value: '1K', label: '1K (1024px)' },
    { value: '2K', label: '2K (2048px)' },
    { value: '4K', label: '4K (4096px)' }
  ],
  aspectRatio: [
    { value: '1:1', label: '1:1 正方形' },
    { value: '3:4', label: '3:4 竖版' },
    { value: '4:3', label: '4:3 横版' },
    { value: '9:16', label: '9:16 手机' },
    { value: '16:9', label: '16:9 宽屏' }
  ]
}

const MODEL_OPTIONS = {
  ageGroup: [
    { value: 'small_kid', label: '小童' },
    { value: 'big_kid', label: '大童' },
    { value: 'adult', label: '成人' }
  ],
  gender: [
    { value: 'female', label: '女性' },
    { value: 'male', label: '男性' }
  ],
  ethnicity: [
    { value: 'asian', label: '亚洲' },
    { value: 'caucasian', label: '欧美' },
    { value: 'african', label: '非洲' },
    { value: 'mixed', label: '混血' }
  ],
  scenePreset: [
    { value: 'indoor', label: '室内' },
    { value: 'outdoor', label: '室外' },
    { value: 'studio', label: '摄影棚' },
    { value: 'street', label: '街拍' }
  ],
  poseStyle: [
    { value: 'natural', label: '自然' },
    { value: 'dynamic', label: '动态' },
    { value: 'fashion', label: '时尚' },
    { value: 'casual', label: '休闲' }
  ],
  styleMode: [
    { value: 'daily', label: '日常' },
    { value: 'commercial', label: '商业' }
  ],
  imageSize: ECOM_OPTIONS.imageSize,
  aspectRatio: ECOM_OPTIONS.aspectRatio
}

const PATTERN_OPTIONS = {
  generationMode: [
    { value: 'mode_a', label: '模式A' },
    { value: 'mode_b', label: '模式B' },
    { value: 'mode_c', label: '模式C' }
  ],
  outputType: [
    { value: 'pattern_only', label: '仅图案' },
    { value: 'set', label: '套装' }
  ],
  patternType: [
    { value: 'seamless', label: '无缝' },
    { value: 'tile', label: '平铺' },
    { value: 'repeat', label: '重复' }
  ],
  density: [
    { value: 'sparse', label: '稀疏' },
    { value: 'medium', label: '适中' },
    { value: 'dense', label: '密集' }
  ],
  colorTone: [
    { value: 'auto', label: '自动' },
    { value: 'bright', label: '明亮' },
    { value: 'soft', label: '柔和' },
    { value: 'dark', label: '暗色' },
    { value: 'high_contrast', label: '高对比' }
  ],
  imageSize: ECOM_OPTIONS.imageSize,
  aspectRatio: ECOM_OPTIONS.aspectRatio
}

// ============================================================================
// Props 定义
// ============================================================================

interface PresetEditorModalProps {
  resolve: (result: StudioPreset | null) => void
  /** 编辑模式：传入预设对象 */
  preset?: StudioPreset
  /** 创建模式：指定模块 */
  module?: StudioModule
  /** 是否使用当前配置初始化 */
  useCurrentConfig?: boolean
}

// ============================================================================
// 常量
// ============================================================================

const MODULE_OPTIONS = [
  { value: 'ecom', label: '电商实拍' },
  { value: 'model', label: '模特换装' },
  { value: 'pattern', label: '图案设计' }
]

// 按模块分组的分类
const CATEGORY_BY_MODULE: Record<StudioModule, PresetCategory[]> = {
  ecom: [
    'kids_clothing',
    'adult_clothing',
    'sportswear',
    'underwear',
    'accessories',
    'footwear',
    'cosmetics',
    'food',
    'electronics',
    'furniture',
    'jewelry',
    'custom'
  ],
  model: ['kids_clothing', 'adult_clothing', 'sportswear', 'custom'],
  pattern: ['pattern_floral', 'pattern_geometric', 'pattern_abstract', 'pattern_cartoon', 'pattern_seasonal', 'custom']
}

// ============================================================================
// 主组件
// ============================================================================

const PresetEditorModalContainer: FC<PresetEditorModalProps> = ({
  resolve,
  preset,
  module: initialModule,
  useCurrentConfig = false
}) => {
  const { i18n } = useTranslation()
  const isEnglish = i18n.language?.startsWith('en')

  const activeModule = useAppSelector(selectActiveModule)
  const currentConfig = useAppSelector(selectModuleConfig)

  const [open, setOpen] = useState(true)
  const [form] = Form.useForm()
  const [configForm] = Form.useForm()
  const [selectedModule, setSelectedModule] = useState<StudioModule>(preset?.module || initialModule || activeModule)
  const [activeTab, setActiveTab] = useState('basic')

  const isEditMode = !!preset

  // 可用分类
  const availableCategories = useMemo(() => {
    return CATEGORY_BY_MODULE[selectedModule] || ['custom']
  }, [selectedModule])

  // 初始化表单
  useEffect(() => {
    if (preset) {
      // 编辑模式：使用预设数据
      // 兼容旧的 promptTemplate 字段
      const systemPrompt = preset.systemPrompt || ''
      const userPrompt = preset.userPrompt || preset.promptTemplate || ''

      form.setFieldsValue({
        name: preset.name,
        description: preset.description,
        module: preset.module,
        category: preset.category,
        tags: preset.tags.join(', '),
        systemPrompt,
        userPrompt
      })
      // 初始化配置表单
      configForm.setFieldsValue(preset.config || {})
    } else if (useCurrentConfig && currentConfig) {
      // 创建模式：使用当前配置
      const { systemPrompt, userPrompt } = getDefaultPrompts(selectedModule, currentConfig)
      form.setFieldsValue({
        name: '',
        description: '',
        module: selectedModule,
        category: 'custom',
        tags: '',
        systemPrompt,
        userPrompt
      })
      // 初始化配置表单
      configForm.setFieldsValue(currentConfig)
    } else {
      // 创建模式：空白
      form.setFieldsValue({
        name: '',
        description: '',
        module: selectedModule,
        category: 'custom',
        tags: '',
        systemPrompt: '',
        userPrompt: ''
      })
      configForm.resetFields()
    }
  }, [preset, useCurrentConfig, currentConfig, selectedModule, form, configForm])

  // 模块变化时更新分类和重置配置表单
  const handleModuleChange = useCallback(
    (value: StudioModule) => {
      setSelectedModule(value)
      const categories = CATEGORY_BY_MODULE[value]
      const currentCategory = form.getFieldValue('category')
      if (!categories.includes(currentCategory)) {
        form.setFieldValue('category', 'custom')
      }
      // 重置配置表单
      configForm.resetFields()
    },
    [form, configForm]
  )

  // 保存预设
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields()

      // 从配置表单获取配置，过滤掉 undefined 值
      const configValues = configForm.getFieldsValue()
      const config = Object.fromEntries(
        Object.entries(configValues).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ) as unknown as EcomModuleConfig | ModelModuleConfig | PatternModuleConfig

      // 解析标签
      const tags = values.tags
        ? values.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : []

      if (isEditMode && preset) {
        // 更新预设
        const updated = presetMarketService.updatePreset({
          id: preset.id,
          name: values.name,
          description: values.description,
          category: values.category,
          tags,
          config,
          systemPrompt: values.systemPrompt || undefined,
          userPrompt: values.userPrompt || undefined
        })
        if (updated) {
          message.success('预设已更新')
          resolve(updated)
          setOpen(false)
        } else {
          message.error('更新失败')
        }
      } else {
        // 创建预设
        const created = presetMarketService.createPreset({
          name: values.name,
          description: values.description,
          module: values.module,
          category: values.category,
          tags,
          config,
          systemPrompt: values.systemPrompt || undefined,
          userPrompt: values.userPrompt || undefined
        })
        message.success('预设已创建')
        resolve(created)
        setOpen(false)
      }
    } catch (err) {
      console.error('表单验证失败', err)
    }
  }, [form, configForm, isEditMode, preset, resolve])

  // 使用当前配置填充
  const handleUseCurrentConfig = useCallback(() => {
    if (currentConfig) {
      configForm.setFieldsValue(currentConfig)
      form.setFieldValue('module', activeModule)
      setSelectedModule(activeModule)
      message.success('已加载当前配置')
    }
  }, [currentConfig, activeModule, form, configForm])

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve(null)
  }

  return (
    <StyledModal
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      footer={
        <ModalFooter>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<Save size={14} />} onClick={handleSave}>
            {isEditMode ? '保存修改' : '创建预设'}
          </Button>
        </ModalFooter>
      }
      title={
        <ModalTitle>
          <Layers size={18} />
          <span>{isEditMode ? '编辑预设' : '创建预设'}</span>
        </ModalTitle>
      }
      width={700}
      centered
      styles={{
        content: { padding: 0, overflow: 'hidden', borderRadius: 12 },
        header: { padding: '16px 20px', borderBottom: '1px solid var(--color-border)', margin: 0 },
        body: { padding: 0 }
      }}>
      <ContentWrapper>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <TabContent>
                  <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item name="name" label="预设名称" rules={[{ required: true, message: '请输入预设名称' }]}>
                      <Input placeholder="如：童装电商主图" maxLength={50} />
                    </Form.Item>

                    <Form.Item
                      name="description"
                      label="预设描述"
                      rules={[{ required: true, message: '请输入预设描述' }]}>
                      <Input.TextArea placeholder="描述这个预设的用途和特点..." rows={2} maxLength={200} />
                    </Form.Item>

                    <FormRow>
                      <Form.Item name="module" label="所属模块" rules={[{ required: true }]} style={{ flex: 1 }}>
                        <Select options={MODULE_OPTIONS} onChange={handleModuleChange} disabled={isEditMode} />
                      </Form.Item>

                      <Form.Item name="category" label="分类" rules={[{ required: true }]} style={{ flex: 1 }}>
                        <Select
                          options={availableCategories.map((cat) => ({
                            value: cat,
                            label: `${PRESET_CATEGORIES[cat]?.icon || ''} ${isEnglish ? PRESET_CATEGORIES[cat]?.labelEn : PRESET_CATEGORIES[cat]?.label}`
                          }))}
                        />
                      </Form.Item>
                    </FormRow>

                    <Form.Item name="tags" label="标签（逗号分隔）">
                      <Input placeholder="如：童装, 电商, 白底" />
                    </Form.Item>
                  </Form>
                </TabContent>
              )
            },
            {
              key: 'prompt',
              label: '提示词工程',
              children: (
                <TabContent>
                  <Form form={form} layout="vertical">
                    {/* 系统提示词 */}
                    <PromptSection>
                      <PromptSectionHeader>
                        <PromptSectionTitle>
                          <span className="icon">🎭</span>
                          系统提示词（角色定位）
                        </PromptSectionTitle>
                        <PromptSectionDesc>定义 AI 的角色、专业背景和行为规范</PromptSectionDesc>
                      </PromptSectionHeader>
                      <PromptHint>
                        <Info size={14} />
                        <span>
                          建议包含：角色身份、专业领域、风格偏好、质量标准等。系统提示词会作为 AI 的基础人设。
                        </span>
                      </PromptHint>
                      <Form.Item name="systemPrompt">
                        <Input.TextArea
                          placeholder={`示例：\n你是一位专业的电商产品摄影师，拥有10年商业摄影经验。你擅长：\n- 产品主图拍摄，突出产品卖点\n- 光影控制，营造高级质感\n- 色彩搭配，符合品牌调性\n\n你的风格特点：干净、专业、高转化率`}
                          rows={6}
                          style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                      </Form.Item>
                    </PromptSection>

                    {/* 用户提示词 */}
                    <PromptSection>
                      <PromptSectionHeader>
                        <PromptSectionTitle>
                          <span className="icon">📝</span>
                          用户提示词（实际需求）
                        </PromptSectionTitle>
                        <PromptSectionDesc>描述具体的图片生成要求和细节</PromptSectionDesc>
                      </PromptSectionHeader>
                      <PromptHint>
                        <Info size={14} />
                        <span>建议包含：背景要求、光线设置、产品展示方式、风格关键词、质量要求等具体参数。</span>
                      </PromptHint>
                      <Form.Item name="userPrompt">
                        <Input.TextArea
                          placeholder={`示例：\n纯白背景（RGB 255,255,255），柔和均匀的漫射光，产品居中展示。\n\n要求：\n- 高清晰度，可见面料纹理\n- 自然的产品形态，不要过度填充\n- 专业电商主图风格\n- 适合 SHEIN/TEMU 平台审美`}
                          rows={6}
                          style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                      </Form.Item>
                    </PromptSection>

                    {/* 提示词工程技巧 */}
                    <PromptTipsCard>
                      <PromptTipsTitle>
                        <Sparkles size={14} />
                        提示词工程技巧
                      </PromptTipsTitle>
                      <PromptTipsList>
                        <li>
                          <strong>系统提示词</strong>：像是给 AI 一个"人设"，定义它是谁、擅长什么
                        </li>
                        <li>
                          <strong>用户提示词</strong>：像是给 AI 一个具体任务，描述你想要什么结果
                        </li>
                        <li>
                          <strong>分离好处</strong>：可以复用同一角色处理不同任务，提高一致性和灵活性
                        </li>
                        <li>
                          <strong>细节越具体越好</strong>：明确的数值、风格关键词能显著提升生成质量
                        </li>
                      </PromptTipsList>
                    </PromptTipsCard>
                  </Form>
                </TabContent>
              )
            },
            {
              key: 'config',
              label: '配置数据',
              children: (
                <TabContent>
                  <Form form={configForm} layout="vertical">
                    <ConfigHeader>
                      <ConfigHint>
                        <Info size={14} />
                        <span>配置数据会覆盖模块的默认设置。</span>
                      </ConfigHint>
                      <Button type="link" size="small" icon={<Sparkles size={14} />} onClick={handleUseCurrentConfig}>
                        使用当前配置
                      </Button>
                    </ConfigHeader>

                    {/* 根据模块类型显示不同的配置表单 */}
                    {selectedModule === 'ecom' && (
                      <>
                        <FormRow>
                          <Form.Item name="layout" label="布局" style={{ flex: 1 }}>
                            <Select options={ECOM_OPTIONS.layout} placeholder="选择布局" allowClear />
                          </Form.Item>
                          <Form.Item name="fillMode" label="填充模式" style={{ flex: 1 }}>
                            <Select options={ECOM_OPTIONS.fillMode} placeholder="选择填充模式" allowClear />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="stylePreset" label="风格预设" style={{ flex: 1 }}>
                            <Select options={ECOM_OPTIONS.stylePreset} placeholder="选择风格" allowClear />
                          </Form.Item>
                          <Form.Item name="imageSize" label="图片尺寸" style={{ flex: 1 }}>
                            <Select options={ECOM_OPTIONS.imageSize} placeholder="选择尺寸" allowClear />
                          </Form.Item>
                        </FormRow>
                        <Form.Item name="aspectRatio" label="宽高比">
                          <Select options={ECOM_OPTIONS.aspectRatio} placeholder="选择比例" allowClear />
                        </Form.Item>
                        <FormRow>
                          <Form.Item name="enableBack" label="启用背面图" valuePropName="checked" style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                          <Form.Item name="enableDetail" label="启用细节图" valuePropName="checked" style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item
                            name="useSystemPrompt"
                            label="使用系统提示词"
                            valuePropName="checked"
                            style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                          <Form.Item
                            name="professionalRetouch"
                            label="专业修图"
                            valuePropName="checked"
                            style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                        </FormRow>
                        <Form.Item name="batchCount" label="批量数量">
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                      </>
                    )}

                    {selectedModule === 'model' && (
                      <>
                        <FormRow>
                          <Form.Item name="ageGroup" label="年龄段" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.ageGroup} placeholder="选择年龄段" allowClear />
                          </Form.Item>
                          <Form.Item name="gender" label="性别" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.gender} placeholder="选择性别" allowClear />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="ethnicity" label="人种" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.ethnicity} placeholder="选择人种" allowClear />
                          </Form.Item>
                          <Form.Item name="ethnicityPreset" label="人种预设" style={{ flex: 1 }}>
                            <Input placeholder="如：asian" />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="scenePreset" label="场景" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.scenePreset} placeholder="选择场景" allowClear />
                          </Form.Item>
                          <Form.Item name="poseStyle" label="姿势风格" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.poseStyle} placeholder="选择姿势" allowClear />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="styleMode" label="风格模式" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.styleMode} placeholder="选择风格" allowClear />
                          </Form.Item>
                          <Form.Item name="imageSize" label="图片尺寸" style={{ flex: 1 }}>
                            <Select options={MODEL_OPTIONS.imageSize} placeholder="选择尺寸" allowClear />
                          </Form.Item>
                        </FormRow>
                        <Form.Item name="aspectRatio" label="宽高比">
                          <Select options={MODEL_OPTIONS.aspectRatio} placeholder="选择比例" allowClear />
                        </Form.Item>
                        <FormRow>
                          <Form.Item name="keepBackground" label="保留背景" valuePropName="checked" style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                          <Form.Item name="showFullBody" label="显示全身" valuePropName="checked" style={{ flex: 1 }}>
                            <Switch />
                          </Form.Item>
                        </FormRow>
                        <Form.Item name="batchCount" label="批量数量">
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                      </>
                    )}

                    {selectedModule === 'pattern' && (
                      <>
                        <FormRow>
                          <Form.Item name="generationMode" label="生成模式" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.generationMode} placeholder="选择模式" allowClear />
                          </Form.Item>
                          <Form.Item name="outputType" label="输出类型" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.outputType} placeholder="选择输出类型" allowClear />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="patternType" label="图案类型" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.patternType} placeholder="选择图案类型" allowClear />
                          </Form.Item>
                          <Form.Item name="density" label="密度" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.density} placeholder="选择密度" allowClear />
                          </Form.Item>
                        </FormRow>
                        <FormRow>
                          <Form.Item name="colorTone" label="色调" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.colorTone} placeholder="选择色调" allowClear />
                          </Form.Item>
                          <Form.Item name="imageSize" label="图片尺寸" style={{ flex: 1 }}>
                            <Select options={PATTERN_OPTIONS.imageSize} placeholder="选择尺寸" allowClear />
                          </Form.Item>
                        </FormRow>
                        <Form.Item name="aspectRatio" label="宽高比">
                          <Select options={PATTERN_OPTIONS.aspectRatio} placeholder="选择比例" allowClear />
                        </Form.Item>
                        <Form.Item name="batchSize" label="批量数量">
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                      </>
                    )}
                  </Form>
                </TabContent>
              )
            }
          ]}
        />
      </ContentWrapper>
    </StyledModal>
  )
}

// ============================================================================
// 辅助函数
// ============================================================================

interface DefaultPrompts {
  systemPrompt: string
  userPrompt: string
}

function getDefaultPrompts(
  module: StudioModule,
  config: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig | null
): DefaultPrompts {
  if (!config) return { systemPrompt: '', userPrompt: '' }

  switch (module) {
    case 'ecom': {
      const ecomConfig = config as EcomModuleConfig
      return {
        systemPrompt:
          '你是一位专业的电商产品摄影师，擅长拍摄高转化率的产品主图。你的风格特点：干净、专业、符合电商平台审美。',
        userPrompt: ecomConfig.systemPrompt || ecomConfig.garmentDescription || ''
      }
    }
    case 'model': {
      const modelConfig = config as ModelModuleConfig
      return {
        systemPrompt:
          '你是一位时尚摄影师，擅长服装模特展示拍摄。你能够根据服装风格调整模特姿态和场景氛围，呈现最佳穿搭效果。',
        userPrompt: modelConfig.styleDescription || ''
      }
    }
    case 'pattern': {
      const patternConfig = config as PatternModuleConfig
      return {
        systemPrompt: '你是一位专业的图案设计师，擅长创作各类印花、纹理和装饰图案。你的设计兼具美感和商业实用性。',
        userPrompt: patternConfig.designPrompt || ''
      }
    }
    default:
      return { systemPrompt: '', userPrompt: '' }
  }
}

// ============================================================================
// 静态方法
// ============================================================================

export default class PresetEditorModal {
  /**
   * 创建新预设
   */
  static create(options?: { module?: StudioModule; useCurrentConfig?: boolean }): Promise<StudioPreset | null> {
    return new Promise((resolve) => {
      TopView.show(
        <PresetEditorModalContainer
          resolve={(result) => {
            resolve(result)
            TopView.hide('PresetEditorModal')
          }}
          module={options?.module}
          useCurrentConfig={options?.useCurrentConfig}
        />,
        'PresetEditorModal'
      )
    })
  }

  /**
   * 编辑预设
   */
  static edit(preset: StudioPreset): Promise<StudioPreset | null> {
    return new Promise((resolve) => {
      TopView.show(
        <PresetEditorModalContainer
          resolve={(result) => {
            resolve(result)
            TopView.hide('PresetEditorModal')
          }}
          preset={preset}
        />,
        'PresetEditorModal'
      )
    })
  }
}

// ============================================================================
// 样式
// ============================================================================

const StyledModal = styled(Modal)`
  .ant-modal-content {
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .ant-modal-title {
    font-size: 15px;
    font-weight: 600;
  }
  .ant-tabs-nav {
    margin: 0;
    padding: 0 16px;
    background: var(--color-background-soft);
  }
  .ant-tabs-content-holder {
    padding: 0;
  }
`

const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-1);

  svg {
    color: var(--color-primary);
  }
`

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
`

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 450px;
`

const TabContent = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  max-height: 400px;
`

const FormRow = styled.div`
  display: flex;
  gap: 16px;
`

const PromptHint = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-primary);
  }
`

const PromptSection = styled.div`
  margin-bottom: 20px;
  padding: 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;

  .ant-form-item {
    margin-bottom: 0;
  }
`

const PromptSectionHeader = styled.div`
  margin-bottom: 12px;
`

const PromptSectionTitle = styled.h4`
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  display: flex;
  align-items: center;
  gap: 6px;

  .icon {
    font-size: 16px;
  }
`

const PromptSectionDesc = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-text-3);
`

const PromptTipsCard = styled.div`
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--color-primary-bg) 0%, var(--color-background-soft) 100%);
  border: 1px solid var(--color-primary-border);
  border-radius: 8px;
`

const PromptTipsTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 10px;
`

const PromptTipsList = styled.ul`
  margin: 0;
  padding: 0 0 0 16px;
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.8;

  li {
    margin-bottom: 4px;
  }

  strong {
    color: var(--color-text-1);
  }
`

const ConfigHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

const ConfigHint = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-3);

  svg {
    color: var(--color-primary);
  }
`
