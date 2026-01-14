/**
 * Image Studio 主页面
 *
 * 统一的图片工坊应用，支持可收起侧边栏
 * 布局：左侧模块列表（可收起）+ 中间画布 + 右侧配置（可收起）
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectActiveModule, setActiveModule } from '@renderer/store/imageStudio'
import { ChevronRight, PanelLeftClose, PanelRightClose } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import StudioSettingsPopup from './components/common/StudioSettingsPopup'
import ModuleList from './components/layout/ModuleList'
import StudioCanvas from './components/layout/StudioCanvas'
import StudioGallery from './components/layout/StudioGallery'
import StudioSidebar from './components/layout/StudioSidebar'
import type { StudioModule } from './types'

const ImageStudioPage: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const activeModule = useAppSelector(selectActiveModule)

  // 侧边栏收起状态
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const handleModuleChange = useCallback(
    (module: StudioModule) => {
      dispatch(setActiveModule(module))
    },
    [dispatch]
  )

  const handleSettingsClick = useCallback(() => {
    StudioSettingsPopup.show()
  }, [])

  const toggleLeftSidebar = useCallback(() => {
    setLeftCollapsed((prev) => !prev)
  }, [])

  const toggleRightSidebar = useCallback(() => {
    setRightCollapsed((prev) => !prev)
  }, [])

  return (
    <PageContainer>
      <MainContent>
        {/* 左侧模块列表 */}
        <LeftPanel $collapsed={leftCollapsed}>
          {!leftCollapsed && (
            <ModuleList active={activeModule} onChange={handleModuleChange} onSettingsClick={handleSettingsClick} />
          )}
          <CollapseButton $position="left" onClick={toggleLeftSidebar} title={t('common.toggle_sidebar')}>
            {leftCollapsed ? <ChevronRight size={14} /> : <PanelLeftClose size={14} />}
          </CollapseButton>
        </LeftPanel>

        {/* 中间画布区域 */}
        <CenterArea>
          <CanvasWrapper>
            <StudioCanvas />
          </CanvasWrapper>
        </CenterArea>

        {/* 右侧配置面板 */}
        <RightPanel $collapsed={rightCollapsed}>
          <CollapseButton $position="right" onClick={toggleRightSidebar} title={t('common.toggle_sidebar')}>
            {rightCollapsed ? <PanelRightClose size={14} /> : <ChevronRight size={14} />}
          </CollapseButton>
          {!rightCollapsed && (
            <RightContent>
              <StudioSidebar module={activeModule} />
              <StudioGallery />
            </RightContent>
          )}
        </RightPanel>
      </MainContent>
    </PageContainer>
  )
}

export default ImageStudioPage

// ============================================================================
// 样式
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
`

const LeftPanel = styled.div<{ $collapsed: boolean }>`
  position: relative;
  display: flex;
  width: ${(props) => (props.$collapsed ? '36px' : '180px')};
  min-width: ${(props) => (props.$collapsed ? '36px' : '180px')};
  max-width: ${(props) => (props.$collapsed ? '36px' : '180px')};
  border-right: 0.5px solid var(--color-border);
  background-color: var(--color-background);
  transition: all 0.2s ease;
  overflow: hidden;
`

const RightPanel = styled.div<{ $collapsed: boolean }>`
  position: relative;
  display: flex;
  width: ${(props) => (props.$collapsed ? '36px' : '280px')};
  min-width: ${(props) => (props.$collapsed ? '36px' : '280px')};
  max-width: ${(props) => (props.$collapsed ? '36px' : '280px')};
  border-left: 0.5px solid var(--color-border);
  background-color: var(--color-background);
  transition: all 0.2s ease;
  overflow: hidden;
`

const RightContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`

const CollapseButton = styled.button<{ $position: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${(props) => (props.$position === 'left' ? 'right: 4px' : 'left: 4px')};
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 44px;
  border: none;
  border-radius: 4px;
  background: var(--color-background-soft);
  color: var(--color-text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.5;

  &:hover {
    opacity: 1;
    background: var(--color-background-mute);
    color: var(--color-text-1);
  }
`

const CenterArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
`

const CanvasWrapper = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`
