/**
 * Studio 设置模态框 v2.0
 *
 * 美化版设置界面，集成提示词编辑器
 */

import { EditOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { TopView } from '@renderer/components/TopView'
import ModelSelectorButton, {
  imageGenerationModelFilter
} from '@renderer/pages/workflow/components/ConfigForms/ModelSelectorButton'
import PromptEditorModal, { type PromptStep } from '@renderer/pages/workflow/components/PromptEditorModal'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectActiveModule,
  selectModuleConfig,
  selectProviderConfig,
  setProvider,
  updateEcomConfig,
  updateModelConfig,
  updatePatternConfig
} from '@renderer/store/imageStudio'
import { Button, Modal, Select, Slider, Switch, Tag, Tooltip } from 'antd'
import { Bot, Image, Palette, Sliders, Sparkles, Type, Wand2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../../types'

// ============================================================================
// 提示词步骤生成
// ============================================================================

function getEcomPromptSteps(config: EcomModuleConfig | null): PromptStep[] {
  const systemPrompt = config?.systemPrompt || ''
  const defaultSystemPrompt = `You are a professional e-commerce product photographer. Generate high-quality product images that:
- Showcase the product clearly with professional lighting
- Use clean, appealing backgrounds appropriate for the style
- Highlight key features and details
- Maintain consistent brand aesthetics`

  return [
    {
      id: 'system',
      label: '系统提示词',
      prompt: systemPrompt || defaultSystemPrompt,
      defaultPrompt: defaultSystemPrompt,
      description: '定义AI生成图片的整体风格和规则'
    }
  ]
}

function getModelPromptSteps(config: ModelModuleConfig | null): PromptStep[] {
  const styleDesc = config?.styleDescription || ''
  const defaultStylePrompt = `Generate a fashion model photo featuring:
- A professional model with natural poses
- High-quality studio lighting
- Clean background that complements the clothing
- Focus on showcasing the garment's fit and details`

  return [
    {
      id: 'style',
      label: '风格提示词',
      prompt: styleDesc || defaultStylePrompt,
      defaultPrompt: defaultStylePrompt,
      description: '定义模特图片的风格和氛围'
    }
  ]
}

function getPatternPromptSteps(config: PatternModuleConfig | null): PromptStep[] {
  const designPrompt = config?.designPrompt || ''
  const colorPrompt = config?.colorPrompt || ''

  const defaultDesignPrompt = `Create a seamless repeating pattern that:
- Has a balanced composition
- Works well as a tileable texture
- Features clear, well-defined elements
- Maintains visual harmony across repeats`

  const defaultColorPrompt = `Use a harmonious color palette that:
- Creates visual interest
- Has good contrast between elements
- Works well for fabric or product applications`

  return [
    {
      id: 'design',
      label: '设计提示词',
      prompt: designPrompt || defaultDesignPrompt,
      defaultPrompt: defaultDesignPrompt,
      description: '定义图案的设计风格和元素'
    },
    {
      id: 'color',
      label: '配色提示词',
      prompt: colorPrompt || defaultColorPrompt,
      defaultPrompt: defaultColorPrompt,
      description: '定义图案的色彩搭配方案'
    }
  ]
}

// ============================================================================
// 主组件
// ============================================================================

interface StudioSettingsPopupProps {
  resolve: () => void
  initialTab?: StudioSettingsTab
}

type StudioSettingsTab = 'model' | 'prompt' | 'basic' | 'advanced'

const StudioSettingsPopupContainer: FC<StudioSettingsPopupProps> = ({ resolve, initialTab }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<StudioSettingsTab>(initialTab || 'model')
  const [promptEditorOpen, setPromptEditorOpen] = useState(false)

  const activeModule = useAppSelector(selectActiveModule)
  const { providerId, modelId } = useAppSelector(selectProviderConfig)
  const moduleConfig = useAppSelector(selectModuleConfig)

  const handleModelChange = (newProviderId: string, newModelId: string) => {
    dispatch(setProvider({ providerId: newProviderId, modelId: newModelId }))
  }

  const handleConfigUpdate = useCallback(
    (updates: Partial<EcomModuleConfig | ModelModuleConfig | PatternModuleConfig>) => {
      switch (activeModule) {
        case 'ecom':
          dispatch(updateEcomConfig(updates as Partial<EcomModuleConfig>))
          break
        case 'model':
          dispatch(updateModelConfig(updates as Partial<ModelModuleConfig>))
          break
        case 'pattern':
          dispatch(updatePatternConfig(updates as Partial<PatternModuleConfig>))
          break
      }
    },
    [activeModule, dispatch]
  )

  // 提示词步骤
  const promptSteps = useMemo(() => {
    switch (activeModule) {
      case 'ecom':
        return getEcomPromptSteps(moduleConfig as EcomModuleConfig)
      case 'model':
        return getModelPromptSteps(moduleConfig as ModelModuleConfig)
      case 'pattern':
        return getPatternPromptSteps(moduleConfig as PatternModuleConfig)
      default:
        return []
    }
  }, [activeModule, moduleConfig])

  // 是否有自定义提示词
  const hasCustomPrompts = useMemo(() => {
    if (!moduleConfig) return false
    if (activeModule === 'ecom') return !!(moduleConfig as EcomModuleConfig).systemPrompt
    if (activeModule === 'model') return !!(moduleConfig as ModelModuleConfig).styleDescription
    if (activeModule === 'pattern') {
      const pc = moduleConfig as PatternModuleConfig
      return !!pc.designPrompt || !!pc.colorPrompt
    }
    return false
  }, [activeModule, moduleConfig])

  // 保存提示词
  const handleSavePrompts = useCallback(
    (steps: PromptStep[]) => {
      switch (activeModule) {
        case 'ecom': {
          const systemStep = steps.find((s) => s.id === 'system')
          if (systemStep) {
            handleConfigUpdate({ systemPrompt: systemStep.prompt })
          }
          break
        }
        case 'model': {
          const styleStep = steps.find((s) => s.id === 'style')
          if (styleStep) {
            handleConfigUpdate({ styleDescription: styleStep.prompt })
          }
          break
        }
        case 'pattern': {
          const updates: Partial<PatternModuleConfig> = {}
          const designStep = steps.find((s) => s.id === 'design')
          const colorStep = steps.find((s) => s.id === 'color')
          if (designStep) updates.designPrompt = designStep.prompt
          if (colorStep) updates.colorPrompt = colorStep.prompt
          handleConfigUpdate(updates)
          break
        }
      }
      setPromptEditorOpen(false)
    },
    [activeModule, handleConfigUpdate]
  )

  // 重置提示词
  const handleResetPrompts = useCallback(() => {
    switch (activeModule) {
      case 'ecom':
        handleConfigUpdate({ systemPrompt: undefined })
        break
      case 'model':
        handleConfigUpdate({ styleDescription: undefined })
        break
      case 'pattern':
        handleConfigUpdate({ designPrompt: undefined, colorPrompt: undefined })
        break
    }
  }, [activeModule, handleConfigUpdate])

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve()
  }

  const getModuleIcon = () => {
    switch (activeModule) {
      case 'ecom':
        return <Sparkles size={18} />
      case 'model':
        return <Bot size={18} />
      case 'pattern':
        return <Palette size={18} />
      default:
        return <SettingOutlined />
    }
  }

  const getModuleTitle = () => {
    switch (activeModule) {
      case 'ecom':
        return t('image_studio.modules.ecom')
      case 'model':
        return t('image_studio.modules.model')
      case 'pattern':
        return t('image_studio.modules.pattern')
      default:
        return ''
    }
  }

  const tabs = [
    { key: 'model', label: t('image_studio.settings.model'), icon: <Wand2 size={14} /> },
    { key: 'prompt', label: t('image_studio.settings.prompt'), icon: <Type size={14} /> },
    { key: 'basic', label: t('image_studio.settings.basic'), icon: <Image size={14} /> },
    { key: 'advanced', label: t('image_studio.settings.advanced'), icon: <Sliders size={14} /> }
  ]

  return (
    <>
      <StyledModal
        open={open}
        onCancel={onClose}
        afterClose={afterClose}
        footer={null}
        title={
          <ModalTitle>
            {getModuleIcon()}
            <span>
              {getModuleTitle()} {t('common.settings')}
            </span>
          </ModalTitle>
        }
        width={720}
        centered
        styles={{
          content: { padding: 0, overflow: 'hidden', borderRadius: 12 },
          header: { padding: '16px 20px', borderBottom: '1px solid var(--color-border)', margin: 0 },
          body: { padding: 0 }
        }}>
        <ContentWrapper>
          {/* 顶部标签栏 */}
          <TabBar>
            {tabs.map((tab) => (
              <TabItem
                key={tab.key}
                $active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key as StudioSettingsTab)}>
                {tab.icon}
                <span>{tab.label}</span>
              </TabItem>
            ))}
          </TabBar>

          {/* 内容区域 */}
          <ContentArea>
            {activeTab === 'model' && (
              <SettingsPanel>
                <PanelHeader>
                  <PanelTitle>{t('image_studio.settings.generation_model')}</PanelTitle>
                  <PanelDesc>选择用于生成图片的 AI 模型</PanelDesc>
                </PanelHeader>
                <SettingCard>
                  <ModelSelectorButton
                    providerId={providerId}
                    modelId={modelId}
                    filter={imageGenerationModelFilter}
                    showTagFilter={false}
                    onModelChange={handleModelChange}
                    placeholder={t('image_studio.settings.select_model')}
                    style={{ width: '100%' }}
                  />
                </SettingCard>
              </SettingsPanel>
            )}

            {activeTab === 'prompt' && (
              <SettingsPanel>
                <PanelHeader>
                  <PanelTitle>{t('image_studio.settings.prompt')}</PanelTitle>
                  <PanelDesc>自定义 AI 生成图片的提示词</PanelDesc>
                </PanelHeader>

                <PromptCard>
                  <PromptCardHeader>
                    <PromptCardTitle>
                      <EditOutlined />
                      <span>提示词配置</span>
                      {hasCustomPrompts && <Tag color="blue">已自定义</Tag>}
                    </PromptCardTitle>
                    {hasCustomPrompts && (
                      <Tooltip title="重置为默认提示词">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={handleResetPrompts}
                          danger
                        />
                      </Tooltip>
                    )}
                  </PromptCardHeader>

                  <PromptCardBody>
                    <PromptPreview>
                      {promptSteps.map((step) => (
                        <PromptStepItem key={step.id}>
                          <PromptStepLabel>{step.label}</PromptStepLabel>
                          <PromptStepContent>
                            {step.prompt.substring(0, 100)}
                            {step.prompt.length > 100 && '...'}
                          </PromptStepContent>
                        </PromptStepItem>
                      ))}
                    </PromptPreview>

                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setPromptEditorOpen(true)}
                      block
                      size="large"
                      style={{ marginTop: 16 }}>
                      编辑提示词
                    </Button>
                  </PromptCardBody>
                </PromptCard>
              </SettingsPanel>
            )}

            {activeTab === 'basic' && (
              <BasicSettings activeModule={activeModule} config={moduleConfig} onUpdate={handleConfigUpdate} />
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettings activeModule={activeModule} config={moduleConfig} onUpdate={handleConfigUpdate} />
            )}
          </ContentArea>
        </ContentWrapper>
      </StyledModal>

      {/* 提示词编辑器模态框 */}
      <PromptEditorModal
        open={promptEditorOpen}
        title={`编辑 ${getModuleTitle()} 提示词`}
        steps={promptSteps}
        onClose={() => setPromptEditorOpen(false)}
        onSave={handleSavePrompts}
      />
    </>
  )
}

// ============================================================================
// 基本设置组件
// ============================================================================

const BasicSettings: FC<{
  activeModule: StudioModule
  config: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig | null
  onUpdate: (updates: any) => void
}> = ({ activeModule, config, onUpdate }) => {
  const { t } = useTranslation()

  if (!config) return null

  return (
    <SettingsPanel>
      <PanelHeader>
        <PanelTitle>{t('image_studio.settings.basic')}</PanelTitle>
        <PanelDesc>配置图片输出的基本参数</PanelDesc>
      </PanelHeader>

      <SettingsGrid>
        <SettingItem>
          <SettingLabel>{t('image_studio.settings.image_size')}</SettingLabel>
          <Select
            value={config.imageSize}
            onChange={(value) => onUpdate({ imageSize: value })}
            style={{ width: '100%' }}
            options={[
              { value: '1K', label: '1K (1024px)' },
              { value: '2K', label: '2K (2048px)' },
              { value: '4K', label: '4K (4096px)' }
            ]}
          />
        </SettingItem>

        <SettingItem>
          <SettingLabel>{t('image_studio.settings.aspect_ratio')}</SettingLabel>
          <Select
            value={config.aspectRatio}
            onChange={(value) => onUpdate({ aspectRatio: value })}
            style={{ width: '100%' }}
            options={[
              { value: '1:1', label: '1:1 正方形' },
              { value: '3:4', label: '3:4 竖版' },
              { value: '4:3', label: '4:3 横版' },
              { value: '9:16', label: '9:16 手机屏' },
              { value: '16:9', label: '16:9 宽屏' }
            ]}
          />
        </SettingItem>

        {activeModule === 'ecom' && (
          <>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.layout')}</SettingLabel>
              <Select
                value={(config as EcomModuleConfig).layout}
                onChange={(value) => onUpdate({ layout: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'model_shot', label: '模特拍摄' },
                  { value: 'flat_lay', label: '平铺展示' },
                  { value: 'hanging', label: '悬挂展示' }
                ]}
              />
            </SettingItem>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.style_preset')}</SettingLabel>
              <Select
                value={(config as EcomModuleConfig).stylePreset}
                onChange={(value) => onUpdate({ stylePreset: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'shein', label: 'SHEIN' },
                  { value: 'temu', label: 'TEMU' },
                  { value: 'minimal', label: '极简' },
                  { value: 'premium', label: '高端' }
                ]}
              />
            </SettingItem>
          </>
        )}

        {activeModule === 'model' && (
          <>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.age_group')}</SettingLabel>
              <Select
                value={(config as ModelModuleConfig).ageGroup}
                onChange={(value) => onUpdate({ ageGroup: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'small_kid', label: '小童' },
                  { value: 'big_kid', label: '大童' },
                  { value: 'adult', label: '成人' }
                ]}
              />
            </SettingItem>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.gender')}</SettingLabel>
              <Select
                value={(config as ModelModuleConfig).gender}
                onChange={(value) => onUpdate({ gender: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'female', label: '女' },
                  { value: 'male', label: '男' }
                ]}
              />
            </SettingItem>
          </>
        )}

        {activeModule === 'pattern' && (
          <>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.pattern_type')}</SettingLabel>
              <Select
                value={(config as PatternModuleConfig).patternType}
                onChange={(value) => onUpdate({ patternType: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'seamless', label: '无缝' },
                  { value: 'half_drop', label: '半落' },
                  { value: 'brick', label: '砖块' },
                  { value: 'mirror', label: '镜像' }
                ]}
              />
            </SettingItem>
            <SettingItem>
              <SettingLabel>{t('image_studio.settings.density')}</SettingLabel>
              <Select
                value={(config as PatternModuleConfig).density}
                onChange={(value) => onUpdate({ density: value })}
                style={{ width: '100%' }}
                options={[
                  { value: 'sparse', label: '稀疏' },
                  { value: 'medium', label: '中等' },
                  { value: 'dense', label: '密集' }
                ]}
              />
            </SettingItem>
          </>
        )}
      </SettingsGrid>
    </SettingsPanel>
  )
}

// ============================================================================
// 高级设置组件
// ============================================================================

const AdvancedSettings: FC<{
  activeModule: StudioModule
  config: EcomModuleConfig | ModelModuleConfig | PatternModuleConfig | null
  onUpdate: (updates: any) => void
}> = ({ activeModule, config, onUpdate }) => {
  const { t } = useTranslation()

  if (!config) return null

  const getBatchCount = () => {
    if ('batchCount' in config) return config.batchCount || 1
    if ('batchSize' in config) return (config as PatternModuleConfig).batchSize || 1
    return 1
  }

  const getSeed = () => {
    if ('seed' in config) return config.seed
    return undefined
  }

  return (
    <SettingsPanel>
      <PanelHeader>
        <PanelTitle>{t('image_studio.settings.advanced')}</PanelTitle>
        <PanelDesc>高级生成参数配置</PanelDesc>
      </PanelHeader>

      <SettingsGrid>
        <SettingItemFull>
          <SettingLabel>{t('image_studio.settings.batch_count')}</SettingLabel>
          <SliderWrapper>
            <Slider
              min={1}
              max={4}
              value={getBatchCount()}
              onChange={(value) =>
                activeModule === 'pattern' ? onUpdate({ batchSize: value }) : onUpdate({ batchCount: value })
              }
              marks={{ 1: '1', 2: '2', 3: '3', 4: '4' }}
              tooltip={{ formatter: (v) => `生成 ${v} 张` }}
            />
          </SliderWrapper>
        </SettingItemFull>

        <SettingItem>
          <SettingLabel>{t('image_studio.settings.seed')}</SettingLabel>
          <SeedInput
            type="number"
            value={getSeed() ?? ''}
            onChange={(e) => onUpdate({ seed: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={t('image_studio.settings.seed_placeholder')}
          />
        </SettingItem>

        {activeModule === 'ecom' && (
          <>
            <SwitchItem>
              <SwitchLabel>
                <span>{t('image_studio.settings.enable_back')}</span>
                <SwitchDesc>同时生成产品背面图</SwitchDesc>
              </SwitchLabel>
              <Switch
                checked={(config as EcomModuleConfig).enableBack}
                onChange={(checked) => onUpdate({ enableBack: checked })}
              />
            </SwitchItem>
            <SwitchItem>
              <SwitchLabel>
                <span>{t('image_studio.settings.enable_detail')}</span>
                <SwitchDesc>同时生成细节放大图</SwitchDesc>
              </SwitchLabel>
              <Switch
                checked={(config as EcomModuleConfig).enableDetail}
                onChange={(checked) => onUpdate({ enableDetail: checked })}
              />
            </SwitchItem>
            <SwitchItem>
              <SwitchLabel>
                <span>{t('image_studio.settings.use_system_prompt')}</span>
                <SwitchDesc>启用自定义系统提示词</SwitchDesc>
              </SwitchLabel>
              <Switch
                checked={(config as EcomModuleConfig).useSystemPrompt}
                onChange={(checked) => onUpdate({ useSystemPrompt: checked })}
              />
            </SwitchItem>
          </>
        )}
      </SettingsGrid>
    </SettingsPanel>
  )
}

// ============================================================================
// 静态方法
// ============================================================================

export default class StudioSettingsPopup {
  static show(props?: { initialTab?: StudioSettingsTab }) {
    return new Promise<void>((resolve) => {
      TopView.show(
        <StudioSettingsPopupContainer
          {...props}
          resolve={() => {
            resolve()
            TopView.hide('StudioSettingsPopup')
          }}
        />,
        'StudioSettingsPopup'
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
  .ant-modal-close {
    top: 12px;
    right: 12px;
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

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 520px;
`

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
`

const TabItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  color: ${(props) => (props.$active ? 'white' : 'var(--color-text-2)')};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  }

  svg {
    opacity: ${(props) => (props.$active ? 1 : 0.7)};
  }
`

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  background: var(--color-background-soft);

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
`

const SettingsPanel = styled.div`
  padding: 20px;
`

const PanelHeader = styled.div`
  margin-bottom: 20px;
`

const PanelTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0 0 6px 0;
`

const PanelDesc = styled.p`
  font-size: 13px;
  color: var(--color-text-3);
  margin: 0;
`

const SettingCard = styled.div`
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
`

const SettingsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
`

const SettingItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
`

const SettingItemFull = styled(SettingItem)`
  grid-column: span 2;
`

const SettingLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const SliderWrapper = styled.div`
  padding: 0 8px;

  .ant-slider {
    margin: 8px 0;
  }
`

const SeedInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text-1);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-text-4);
  }
`

const SwitchItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px;
`

const SwitchLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  > span {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-1);
  }
`

const SwitchDesc = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
`

// 提示词卡片样式
const PromptCard = styled.div`
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
`

const PromptCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const PromptCardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);

  .anticon {
    color: var(--color-primary);
  }
`

const PromptCardBody = styled.div`
  padding: 16px;
`

const PromptPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const PromptStepItem = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px;
`

const PromptStepLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 6px;
`

const PromptStepContent = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
  font-family: monospace;
`
