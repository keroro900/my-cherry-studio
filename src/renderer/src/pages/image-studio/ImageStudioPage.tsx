/**
 * Image Studio 主页面
 *
 * 统一的图片工坊应用，包含电商、模特换装、图案设计三个模块
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { selectActiveModule, setActiveModule } from '@renderer/store/imageStudio'
import { Settings2 } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import ModuleSwitcher from './components/common/ModuleSwitcher'
import ProviderSelector from './components/common/ProviderSelector'
import StudioCanvas from './components/layout/StudioCanvas'
import StudioGallery from './components/layout/StudioGallery'
import StudioSidebar from './components/layout/StudioSidebar'
import type { StudioModule } from './types'

const ImageStudioPage: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const activeModule = useAppSelector(selectActiveModule)

  const handleModuleChange = (module: StudioModule) => {
    dispatch(setActiveModule(module))
  }

  return (
    <PageContainer>
      <CustomNavbar>
        <NavbarLeft>
          <PageTitle>
            <Settings2 size={18} />
            {t('title.image_studio')}
          </PageTitle>
        </NavbarLeft>
        <NavbarMiddle>
          <ModuleSwitcher active={activeModule} onChange={handleModuleChange} />
        </NavbarMiddle>
        <NavbarRight>
          <ProviderSelector />
        </NavbarRight>
      </CustomNavbar>

      <MainContent>
        <StudioSidebar module={activeModule} />
        <StudioCanvas />
        <StudioGallery />
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
  min-width: 0;
  overflow: hidden;
`

const CustomNavbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--navbar-height);
  min-height: var(--navbar-height);
  padding: 0 16px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background);
  -webkit-app-region: drag;
`

const NavbarLeft = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  -webkit-app-region: no-drag;
`

const PageTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
`

const NavbarMiddle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
`

const NavbarRight = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
  gap: 12px;
  -webkit-app-region: no-drag;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`
