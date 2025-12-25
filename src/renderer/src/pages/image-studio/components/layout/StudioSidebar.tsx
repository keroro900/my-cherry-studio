/**
 * Studio 侧边栏组件
 *
 * 根据当前模块显示不同的配置面板
 */

import Scrollbar from '@renderer/components/Scrollbar'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addTask,
  createProject,
  selectActiveModule,
  selectModuleConfig,
  selectProviderConfig,
  selectRunningTasks,
  selectQueuedTasks
} from '@renderer/store/imageStudio'
import { Button } from 'antd'
import { Loader2, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { v4 as uuid } from 'uuid'

import type { ImageTask, StudioModule } from '../../types'
import EcomConfigPanel from '../modules/EcomModule/EcomConfigPanel'
import ModelConfigPanel from '../modules/ModelModule/ModelConfigPanel'
import PatternConfigPanel from '../modules/PatternModule/PatternConfigPanel'

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
    // 验证配置
    if (!providerId || !modelId) {
      console.warn('Please select a provider and model')
      return
    }

    // 创建项目
    const projectId = uuid()
    const versionId = uuid()

    dispatch(
      createProject({
        id: projectId,
        name: `${activeModule}-${Date.now()}`,
        module: activeModule,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [
          {
            id: versionId,
            projectId,
            versionNumber: 1,
            parentVersionId: null,
            outputs: {},
            config: moduleConfig || {},
            createdAt: Date.now(),
            status: 'pending'
          }
        ],
        currentVersionId: versionId,
        originalInputs: {
          images: [],
          config: moduleConfig || {}
        }
      })
    )

    // 添加任务到队列
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

  return (
    <SidebarContainer>
      <ScrollableContent>{renderConfigPanel()}</ScrollableContent>
      <Footer>
        <GenerateButton
          type="primary"
          size="large"
          icon={isGenerating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          onClick={handleGenerate}
        >
          {buttonText}
        </GenerateButton>
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
  width: 320px;
  min-width: 320px;
  border-right: 0.5px solid var(--color-border);
  background-color: var(--color-background);
  height: calc(100vh - var(--navbar-height));
`

const ScrollableContent = styled(Scrollbar)`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`

const Footer = styled.div`
  padding: 16px;
  border-top: 0.5px solid var(--color-border);
`

const GenerateButton = styled(Button)`
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

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
