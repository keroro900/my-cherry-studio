/**
 * Art Studio 侧边栏组件
 *
 * 使用动态参数系统：
 * 1. 从中转服务获取模型参数 Schema (GET /v1/params/{model})
 * 2. 根据 Schema 动态渲染表单
 * 3. 支持参数依赖、动态范围、实时验证
 */

import { SelectModelPopup } from '@renderer/components/Popups/SelectModelPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import useModelParams from '@renderer/hooks/useModelParams'
import usePromptHistory from '@renderer/hooks/usePromptHistory'
import type { Provider } from '@renderer/types'
import { Button, Popover, Segmented, Skeleton, Tag, Tooltip } from 'antd'
import { BookOpen, ChevronDown, ChevronRight, Clock, RefreshCw, Sparkles, Star, Trash2, Wand2, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import DynamicParamsForm from './DynamicParamsForm'
import PromptTemplates from './PromptTemplates'

// ============================================================================
// 类型定义
// ============================================================================

export interface ArtStudioSidebarProps {
  /** Provider ID */
  providerId?: string
  /** Model ID */
  modelId?: string
  /** Providers 列表 */
  providers: Provider[]
  /** 模型变更回调 */
  onModelChange: (providerId: string, modelId: string) => void
  /** 表单值 */
  values: Record<string, any>
  /** 值变更回调 */
  onValueChange: (key: string, value: any) => void
  /** 批量设置值 */
  onValuesChange?: (values: Record<string, any>) => void
  /** 生成回调 */
  onGenerate: () => void
  /** 增强提示词回调 */
  onEnhancePrompt?: () => void
  /** 是否正在生成 */
  isGenerating: boolean
  /** 模式 */
  mode: 'generate' | 'edit'
  /** 模式变更回调 */
  onModeChange: (mode: 'generate' | 'edit') => void
}

// ============================================================================
// 样式组件
// ============================================================================

const SidebarContainer = styled.div`
  width: 320px;
  min-width: 320px;
  max-width: 400px;
  flex-shrink: 0;
  flex-grow: 0.3;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
  background: var(--color-background);
  border-right: 1px solid var(--color-border);
  overflow: hidden;

  @media (min-width: 1400px) {
    width: 360px;
  }

  @media (min-width: 1600px) {
    width: 400px;
  }
`

const Header = styled.div`
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  .logo-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .logo-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }
`

const Content = styled.div`
  flex: 1;
  overflow: hidden;
`

const ScrollContent = styled.div`
  padding: 12px 16px;
`

const Section = styled.div`
  margin-bottom: 16px;
`

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
`

const ModelSelector = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
  font-size: 12px;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  .model-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
    flex: 1;
  }

  .model-name {
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .model-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .model-type {
    color: var(--color-text-secondary);
    font-size: 10px;
  }

  .placeholder {
    color: var(--color-text-secondary);
  }
`

const CapabilityTag = styled(Tag)`
  font-size: 9px;
  padding: 0 4px;
  line-height: 16px;
  border-radius: 4px;
  margin: 0;
`

const PromptSection = styled.div`
  margin-bottom: 16px;

  .prompt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
  }

  .prompt-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`

const PromptArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  font-size: 13px;
  resize: vertical;
  color: var(--color-text);
  font-family: inherit;
  line-height: 1.5;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: var(--color-text-secondary);
  }
`

const ActionButton = styled(Button)`
  font-size: 11px;
  padding: 0 6px;
  height: 22px;
  display: flex;
  align-items: center;
  gap: 4px;
`

const Footer = styled.div`
  padding: 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
  flex-shrink: 0;
  min-height: 76px;
`

const GenerateButton = styled(Button)`
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: var(--color-background-mute);
    box-shadow: none;
  }
`

const PresetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 200px;
`

const PresetItem = styled.div`
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary);
    color: white;
  }

  .preset-name {
    font-size: 12px;
    font-weight: 500;
  }

  .preset-desc {
    font-size: 10px;
    opacity: 0.7;
    margin-top: 2px;
  }
`

const LoadingContainer = styled.div`
  padding: 16px 0;
`

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 280px;
  max-height: 300px;
  overflow-y: auto;
`

const HistoryItem = styled.div`
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  &:hover {
    background: var(--color-primary);
    color: white;
  }

  .history-content {
    flex: 1;
    min-width: 0;
  }

  .history-prompt {
    font-size: 12px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .history-meta {
    font-size: 10px;
    opacity: 0.7;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .history-favorite {
    cursor: pointer;
    color: var(--color-warning);
    flex-shrink: 0;

    &:hover {
      transform: scale(1.1);
    }
  }
`

const EmptyHistory = styled.div`
  text-align: center;
  padding: 16px;
  color: var(--color-text-secondary);
  font-size: 12px;
`

const HistoryPanel = styled.div`
  margin-bottom: 16px;

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    cursor: pointer;
    user-select: none;

    &:hover {
      .header-left {
        color: var(--color-primary);
      }
    }
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
    transition: color 0.2s;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .history-count {
    font-size: 10px;
    color: var(--color-text-secondary);
    background: var(--color-background-soft);
    padding: 2px 6px;
    border-radius: 10px;
  }
`

const HistoryPanelContent = styled.div<{ $expanded: boolean }>`
  max-height: ${(props) => (props.$expanded ? '300px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
`

const HistoryPanelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  max-height: 280px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const HistoryPanelItem = styled.div`
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  &:hover {
    background: var(--color-primary);
    color: white;

    .history-meta {
      color: rgba(255, 255, 255, 0.7);
    }

    .history-actions {
      opacity: 1;
    }
  }

  .history-content {
    flex: 1;
    min-width: 0;
  }

  .history-prompt {
    font-size: 11px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .history-meta {
    font-size: 9px;
    color: var(--color-text-secondary);
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .history-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .action-btn {
    padding: 2px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &.favorite {
      color: var(--color-warning);
      opacity: 1;
    }
  }
`

// ============================================================================
// 组件
// ============================================================================

function ArtStudioSidebar({
  providerId,
  modelId,
  providers,
  onModelChange,
  values,
  onValueChange,
  onValuesChange,
  onGenerate,
  onEnhancePrompt,
  isGenerating,
  mode,
  onModeChange
}: ArtStudioSidebarProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // 获取当前 Provider 和 Model
  const { currentProvider, currentModel } = useMemo(() => {
    if (!providerId || !modelId) return { currentProvider: undefined, currentModel: undefined }
    const provider = providers.find((p) => p.id === providerId)
    const model = provider?.models?.find((m) => m.id === modelId)
    return { currentProvider: provider, currentModel: model }
  }, [providerId, modelId, providers])

  // 使用动态参数 Hook
  const {
    isLoading: isLoadingParams,
    capabilities,
    presets,
    defaultValues,
    validateAll,
    refresh: refreshParams
  } = useModelParams(currentProvider, currentModel)

  // 使用提示词历史 Hook
  const {
    recent: recentPrompts,
    history: _allHistory,
    addToHistory,
    removeFromHistory,
    toggleFavorite: togglePromptFavorite
  } = usePromptHistory()
  void _allHistory // 预留变量，后续可用于显示完整历史

  // 当默认值变化时，初始化表单值
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0 && onValuesChange) {
      const currentPrompt = values.prompt
      onValuesChange({ ...defaultValues, prompt: currentPrompt || '' })
    }
  }, [defaultValues])

  // 打开模型选择弹窗
  const handleModelClick = useCallback(async () => {
    const selectedModel = await SelectModelPopup.show({
      model: currentModel,
      showTagFilter: true
    })

    if (selectedModel && selectedModel.provider) {
      onModelChange(selectedModel.provider, selectedModel.id)
    }
  }, [currentModel, onModelChange])

  // 提示词变更
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange('prompt', e.target.value)
    },
    [onValueChange]
  )

  // 应用预设
  const handleApplyPreset = useCallback(
    (preset: { values: Record<string, any> }) => {
      if (onValuesChange) {
        onValuesChange({ ...values, ...preset.values })
      }
    },
    [values, onValuesChange]
  )

  // 生成前验证
  const handleGenerate = useCallback(() => {
    const errors = validateAll(values)
    setValidationErrors(errors)

    if (Object.keys(errors).length === 0) {
      // 保存提示词到历史
      if (values.prompt) {
        addToHistory(values.prompt, values.negative_prompt, modelId, providerId)
      }
      onGenerate()
    }
  }, [values, validateAll, onGenerate, addToHistory, modelId, providerId])

  // 应用模板
  const handleApplyTemplate = useCallback(
    (prompt: string, negativePrompt?: string) => {
      onValueChange('prompt', prompt)
      if (negativePrompt) {
        onValueChange('negative_prompt', negativePrompt)
      }
    },
    [onValueChange]
  )

  // 应用历史提示词
  const handleApplyHistory = useCallback(
    (prompt: string, negativePrompt?: string) => {
      onValueChange('prompt', prompt)
      if (negativePrompt) {
        onValueChange('negative_prompt', negativePrompt)
      }
    },
    [onValueChange]
  )

  // 渲染能力标签
  const renderCapabilityTags = () => {
    if (!capabilities) return null

    const tags: React.ReactNode[] = []
    if (capabilities.supportsChinesePrompt) {
      tags.push(
        <CapabilityTag key="zh" color="blue">
          中文
        </CapabilityTag>
      )
    }
    if (capabilities.supportsImg2Img) {
      tags.push(
        <CapabilityTag key="img2img" color="green">
          图生图
        </CapabilityTag>
      )
    }
    if (capabilities.supportsControlNet) {
      tags.push(
        <CapabilityTag key="controlnet" color="purple">
          ControlNet
        </CapabilityTag>
      )
    }

    return tags.length > 0 ? <div className="model-meta">{tags}</div> : null
  }

  // 渲染预设列表
  const renderPresets = () => {
    if (!presets || presets.length === 0) return null

    return (
      <PresetList>
        {presets.map((preset) => (
          <PresetItem key={preset.id} onClick={() => handleApplyPreset(preset)}>
            <div className="preset-name">{preset.name}</div>
            {preset.description && <div className="preset-desc">{preset.description}</div>}
          </PresetItem>
        ))}
      </PresetList>
    )
  }

  // 渲染历史列表（Popover 用）
  const renderHistoryList = () => {
    if (recentPrompts.length === 0) {
      return <EmptyHistory>暂无历史记录</EmptyHistory>
    }

    return (
      <HistoryList>
        {recentPrompts.map((item) => (
          <HistoryItem key={item.id} onClick={() => handleApplyHistory(item.prompt, item.negativePrompt)}>
            <div className="history-content">
              <div className="history-prompt">{item.prompt}</div>
              <div className="history-meta">
                <span>使用 {item.useCount} 次</span>
                <span>{new Date(item.usedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <span
              className="history-favorite"
              onClick={(e) => {
                e.stopPropagation()
                togglePromptFavorite(item.id)
              }}>
              {item.favorite ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
            </span>
          </HistoryItem>
        ))}
      </HistoryList>
    )
  }

  // 渲染折叠面板中的历史记录
  const renderHistoryPanel = () => {
    return (
      <HistoryPanel>
        <div className="history-header" onClick={() => setHistoryExpanded(!historyExpanded)}>
          <div className="header-left">
            {historyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Clock size={14} />
            <span>提示词历史</span>
          </div>
          <div className="header-right">
            {recentPrompts.length > 0 && <span className="history-count">{recentPrompts.length}</span>}
          </div>
        </div>
        <HistoryPanelContent $expanded={historyExpanded}>
          {recentPrompts.length === 0 ? (
            <EmptyHistory>暂无历史记录</EmptyHistory>
          ) : (
            <HistoryPanelList>
              {recentPrompts.map((item) => (
                <HistoryPanelItem key={item.id} onClick={() => handleApplyHistory(item.prompt, item.negativePrompt)}>
                  <div className="history-content">
                    <div className="history-prompt">{item.prompt}</div>
                    <div className="history-meta">
                      <span>使用 {item.useCount} 次</span>
                      <span>{new Date(item.usedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="history-actions">
                    <span
                      className={`action-btn ${item.favorite ? 'favorite' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePromptFavorite(item.id)
                      }}>
                      {item.favorite ? <Star size={12} fill="currentColor" /> : <Star size={12} />}
                    </span>
                    <span
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFromHistory(item.id)
                      }}>
                      <Trash2 size={12} />
                    </span>
                  </div>
                </HistoryPanelItem>
              ))}
            </HistoryPanelList>
          )}
        </HistoryPanelContent>
      </HistoryPanel>
    )
  }

  return (
    <SidebarContainer>
      <Header>
        <Logo>
          <div className="logo-icon">
            <Sparkles size={16} />
          </div>
          <span className="logo-text">Art Studio</span>
        </Logo>
        {modelId && (
          <Tooltip title="刷新参数">
            <ActionButton type="text" size="small" icon={<RefreshCw size={12} />} onClick={refreshParams} />
          </Tooltip>
        )}
      </Header>

      <Content>
        <Scrollbar>
          <ScrollContent>
            {/* 模式切换 */}
            <Section>
              <Segmented
                block
                size="small"
                value={mode}
                onChange={(v) => onModeChange(v as 'generate' | 'edit')}
                options={[
                  { label: '绘图', value: 'generate', icon: <Sparkles size={12} /> },
                  { label: '编辑', value: 'edit', icon: <Wand2 size={12} /> }
                ]}
              />
            </Section>

            {/* 模型选择 */}
            <Section>
              <SectionLabel>
                <span>模型</span>
                {isLoadingParams && <Zap size={12} className="animate-pulse" />}
              </SectionLabel>
              <ModelSelector onClick={handleModelClick}>
                {currentModel ? (
                  <div className="model-info">
                    <span className="model-name">{currentModel.name || currentModel.id}</span>
                    {renderCapabilityTags()}
                  </div>
                ) : (
                  <span className="placeholder">选择模型</span>
                )}
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>▼</span>
              </ModelSelector>
            </Section>

            {/* 提示词 */}
            <PromptSection>
              <div className="prompt-header">
                <span>提示词</span>
                <div className="prompt-actions">
                  {/* 模板按钮 */}
                  <Popover
                    content={
                      <PromptTemplates
                        onApply={handleApplyTemplate}
                        currentPrompt={values.prompt}
                        currentNegativePrompt={values.negative_prompt}
                      />
                    }
                    trigger="click"
                    placement="bottomRight">
                    <ActionButton type="text" size="small" icon={<BookOpen size={12} />}>
                      模板
                    </ActionButton>
                  </Popover>
                  {/* 历史按钮 */}
                  <Popover content={renderHistoryList()} trigger="click" placement="bottomRight">
                    <ActionButton type="text" size="small" icon={<Clock size={12} />}>
                      历史
                    </ActionButton>
                  </Popover>
                  {/* 预设按钮（来自远程参数） */}
                  {presets && presets.length > 0 && (
                    <Popover content={renderPresets()} trigger="click" placement="bottomRight">
                      <ActionButton type="text" size="small" icon={<Zap size={12} />}>
                        预设
                      </ActionButton>
                    </Popover>
                  )}
                  {/* 增强按钮 */}
                  {onEnhancePrompt && (
                    <ActionButton type="text" size="small" icon={<Wand2 size={12} />} onClick={onEnhancePrompt}>
                      增强
                    </ActionButton>
                  )}
                </div>
              </div>
              <PromptArea
                value={values.prompt || ''}
                onChange={handlePromptChange}
                placeholder={
                  capabilities?.supportsChinesePrompt
                    ? '描述你想要生成的图片...'
                    : 'Describe the image you want to generate...'
                }
              />
            </PromptSection>

            {/* 提示词历史折叠面板 */}
            {renderHistoryPanel()}

            {/* 动态参数表单 */}
            {isLoadingParams ? (
              <LoadingContainer>
                <Skeleton active paragraph={{ rows: 4 }} />
              </LoadingContainer>
            ) : (
              currentProvider &&
              currentModel && (
                <DynamicParamsForm
                  provider={currentProvider}
                  model={currentModel}
                  values={values}
                  onChange={onValueChange}
                  onValuesChange={onValuesChange}
                  showAdvanced={true}
                  showStyle={true}
                  showOutput={true}
                  errors={validationErrors}
                  mode={mode}
                />
              )
            )}
          </ScrollContent>
        </Scrollbar>
      </Content>

      <Footer>
        <GenerateButton
          type="primary"
          onClick={handleGenerate}
          disabled={isGenerating || !values.prompt || !modelId}
          loading={isGenerating}>
          {isGenerating ? '生成中...' : '✨ 生成图片'}
        </GenerateButton>
      </Footer>
    </SidebarContainer>
  )
}

export default memo(ArtStudioSidebar)
