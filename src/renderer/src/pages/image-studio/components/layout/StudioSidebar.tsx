/**
 * Studio 侧边栏组件
 *
 * 根据当前模块显示不同的配置面板，紧凑设计
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addTask,
  addVersion,
  createProject,
  selectActiveModule,
  selectModuleConfig,
  selectProviderConfig,
  selectQueuedTasks,
  selectRunningTasks,
  updateEcomConfig,
  updateModelConfig,
  updatePatternConfig
} from '@renderer/store/imageStudio'
import { Button, message, Popconfirm, Tooltip } from 'antd'
import { Layers, Loader2, Pencil, Play, Sparkles, Star } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { v4 as uuid } from 'uuid'

import { presetMarketService } from '../../services/PresetMarketService'
import type { EcomModuleConfig, ImageTask, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../../types'
import type { StudioPreset } from '../../types/preset-market'
import EcomConfigPanel from '../modules/EcomModule/EcomConfigPanel'
import ModelConfigPanel from '../modules/ModelModule/ModelConfigPanel'
import PatternConfigPanel from '../modules/PatternModule/PatternConfigPanel'
import PresetEditorModal from '../PresetMarket/PresetEditorModal'
import PresetMarketModal from '../PresetMarket/PresetMarketModal'

interface StudioSidebarProps {
  module: StudioModule
}

const StudioSidebar: FC<StudioSidebarProps> = ({ module }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const activeModule = useAppSelector(selectActiveModule)
  const moduleConfig = useAppSelector(selectModuleConfig)
  const { providerId, modelId } = useAppSelector(selectProviderConfig)
  const runningTasks = useAppSelector(selectRunningTasks)
  const queuedTasks = useAppSelector(selectQueuedTasks)

  const isGenerating = runningTasks.length > 0 || queuedTasks.length > 0

  // 用户预设列表
  const [userPresets, setUserPresets] = useState<StudioPreset[]>([])

  // 加载用户预设
  const loadUserPresets = useCallback(async () => {
    try {
      await presetMarketService.initialize()
      const presets = presetMarketService.getUserPresets()
      // 只显示当前模块的预设
      const filteredPresets = presets.filter((p) => p.module === activeModule)
      setUserPresets(filteredPresets)
    } catch (err) {
      console.error('Failed to load presets:', err)
    }
  }, [activeModule])

  // 模块变化时重新加载预设
  useEffect(() => {
    loadUserPresets()
  }, [loadUserPresets])

  const renderConfigPanel = () => {
    switch (module) {
      case 'ecom':
        return <EcomConfigPanel />
      case 'model':
        return <ModelConfigPanel />
      case 'pattern':
        return <PatternConfigPanel />
      default:
        return null
    }
  }

  const handleGenerate = useCallback(() => {
    if (!providerId || !modelId) {
      console.warn('Please select a provider and model')
      return
    }

    const projectId = uuid()
    const versionId = uuid()

    dispatch(
      createProject({
        id: projectId,
        name: `${activeModule}-${Date.now()}`,
        module: activeModule,
        originalInputs: {
          images: [],
          config: moduleConfig || {}
        }
      })
    )

    dispatch(
      addVersion({
        projectId,
        version: {
          id: versionId,
          versionNumber: 1,
          parentVersionId: null,
          outputs: {},
          config: moduleConfig || {},
          createdAt: Date.now(),
          status: 'pending'
        }
      })
    )

    const task: ImageTask = {
      id: uuid(),
      projectId,
      versionId,
      type: 'generate',
      status: 'queued',
      progress: { current: 0, total: 100, step: '' },
      createdAt: Date.now()
    }

    dispatch(addTask(task))
  }, [dispatch, activeModule, moduleConfig, providerId, modelId])

  const buttonText = useMemo(() => {
    if (isGenerating) {
      const total = runningTasks.length + queuedTasks.length
      return `${t('image_studio.sidebar.generating')} (${total})`
    }
    return t('image_studio.sidebar.generate')
  }, [isGenerating, runningTasks.length, queuedTasks.length, t])

  // 打开预设市场
  const handleOpenPresetMarket = useCallback(async () => {
    await PresetMarketModal.show({ initialModule: activeModule })
    // 关闭后刷新预设列表
    loadUserPresets()
  }, [activeModule, loadUserPresets])

  // 新建预设
  const handleCreatePreset = useCallback(async () => {
    const result = await PresetEditorModal.create({
      module: activeModule,
      useCurrentConfig: true
    })
    if (result) {
      loadUserPresets()
    }
  }, [activeModule, loadUserPresets])

  // 应用预设
  const handleApplyPreset = useCallback(
    (preset: StudioPreset) => {
      const config = presetMarketService.applyPreset(preset.id)
      if (!config) {
        message.error('应用预设失败')
        return
      }

      // 根据预设的模块类型更新对应的配置
      switch (preset.module) {
        case 'ecom':
          dispatch(updateEcomConfig(config as EcomModuleConfig))
          break
        case 'model':
          dispatch(updateModelConfig(config as ModelModuleConfig))
          break
        case 'pattern':
          dispatch(updatePatternConfig(config as PatternModuleConfig))
          break
      }

      message.success(`已应用预设「${preset.name}」`)
    },
    [dispatch]
  )

  // 编辑预设
  const handleEditPreset = useCallback(
    async (preset: StudioPreset) => {
      const result = await PresetEditorModal.edit(preset)
      if (result) {
        loadUserPresets()
      }
    },
    [loadUserPresets]
  )

  // 删除预设
  const handleDeletePreset = useCallback(
    (preset: StudioPreset) => {
      const success = presetMarketService.deletePreset(preset.id)
      if (success) {
        message.success('已删除预设')
        loadUserPresets()
      } else {
        message.error('删除预设失败')
      }
    },
    [loadUserPresets]
  )

  return (
    <SidebarContainer>
      <ScrollableContent>
        {/* 预设快捷列表 */}
        {userPresets.length > 0 && (
          <PresetSection>
            <PresetHeader>
              <PresetTitle>
                <Star size={12} />
                <span>我的预设</span>
              </PresetTitle>
              <Tooltip title="新建预设">
                <AddPresetButton type="text" size="small" icon={<PlusOutlined />} onClick={handleCreatePreset} />
              </Tooltip>
            </PresetHeader>
            <PresetList>
              {userPresets.slice(0, 5).map((preset) => (
                <PresetItem key={preset.id}>
                  <PresetIcon>{preset.category ? '📦' : '⚙️'}</PresetIcon>
                  <PresetName>{preset.name}</PresetName>
                  <PresetActions>
                    <Tooltip title="应用">
                      <PresetActionButton onClick={() => handleApplyPreset(preset)}>
                        <Play size={10} />
                      </PresetActionButton>
                    </Tooltip>
                    <Tooltip title="编辑">
                      <PresetActionButton onClick={() => handleEditPreset(preset)}>
                        <Pencil size={10} />
                      </PresetActionButton>
                    </Tooltip>
                    <Popconfirm
                      title="确定删除此预设吗？"
                      onConfirm={() => handleDeletePreset(preset)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}>
                      <Tooltip title="删除">
                        <PresetActionButton $danger>
                          <DeleteOutlined style={{ fontSize: 10 }} />
                        </PresetActionButton>
                      </Tooltip>
                    </Popconfirm>
                  </PresetActions>
                </PresetItem>
              ))}
              {userPresets.length > 5 && (
                <MorePresetsHint onClick={handleOpenPresetMarket}>
                  查看全部 {userPresets.length} 个预设...
                </MorePresetsHint>
              )}
            </PresetList>
          </PresetSection>
        )}

        {/* 配置面板 */}
        {renderConfigPanel()}
      </ScrollableContent>
      <Footer>
        <FooterButtonRow>
          <Tooltip title={t('image_studio.sidebar.preset_market')}>
            <PresetButton type="default" icon={<Layers size={16} />} onClick={handleOpenPresetMarket} />
          </Tooltip>
          <Tooltip title="保存当前配置为预设">
            <PresetButton type="default" icon={<PlusOutlined />} onClick={handleCreatePreset} />
          </Tooltip>
          <GenerateButton
            type="primary"
            size="middle"
            icon={isGenerating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            onClick={handleGenerate}
            disabled={!providerId || !modelId}>
            {buttonText}
          </GenerateButton>
        </FooterButtonRow>
      </Footer>
    </SidebarContainer>
  )
}

export default StudioSidebar

// ============================================================================
// 样式
// ============================================================================

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--color-background);
  height: 55%;
  min-height: 260px;
  overflow: hidden;
  border-bottom: 0.5px solid var(--color-border);
`

const ScrollableContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;

    &:hover {
      background: var(--color-text-4);
    }
  }
`

const Footer = styled.div`
  padding: 10px;
  border-top: 0.5px solid var(--color-border);
  background: var(--color-background);
`

const FooterButtonRow = styled.div`
  display: flex;
  gap: 8px;
`

const PresetButton = styled(Button)`
  height: 36px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

const GenerateButton = styled(Button)`
  flex: 1;
  height: 36px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

// ============================================================================
// 预设快捷列表样式
// ============================================================================

const PresetSection = styled.div`
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--color-border);
`

const PresetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const PresetTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);

  svg {
    color: #faad14;
  }
`

const AddPresetButton = styled(Button)`
  width: 20px;
  height: 20px;
  min-width: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`

const PresetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const PresetItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--color-background-soft);
  border-radius: 6px;
  cursor: default;
  transition: all 0.15s ease;

  &:hover {
    background: var(--color-background-mute);
  }

  &:hover .preset-actions {
    opacity: 1;
  }
`

const PresetIcon = styled.span`
  font-size: 14px;
  flex-shrink: 0;
`

const PresetName = styled.span`
  flex: 1;
  font-size: 12px;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const PresetActions = styled.span.attrs({ className: 'preset-actions' })`
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
`

const PresetActionButton = styled.span<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: ${(props) => (props.$danger ? '#ff4d4f' : 'var(--color-primary)')};
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }
`

const MorePresetsHint = styled.div`
  font-size: 11px;
  color: var(--color-primary);
  text-align: center;
  padding: 4px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
