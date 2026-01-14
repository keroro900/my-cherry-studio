/**
 * 模块列表组件
 *
 * 左侧模块选择列表，紧凑设计，类似助手列表
 */

import { Palette, Plus, Settings, ShoppingBag, User } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { StudioModule } from '../../types'

interface ModuleListProps {
  active: StudioModule
  onChange: (module: StudioModule) => void
  onSettingsClick: () => void
}

const modules: Array<{
  key: StudioModule
  labelKey: string
  icon: typeof ShoppingBag
  color: string
  emoji: string
}> = [
  {
    key: 'ecom',
    labelKey: 'image_studio.modules.ecom',
    icon: ShoppingBag,
    color: '#10B981',
    emoji: '🛍️'
  },
  {
    key: 'model',
    labelKey: 'image_studio.modules.model',
    icon: User,
    color: '#8B5CF6',
    emoji: '👗'
  },
  {
    key: 'pattern',
    labelKey: 'image_studio.modules.pattern',
    icon: Palette,
    color: '#F59E0B',
    emoji: '🎨'
  }
]

const ModuleList: FC<ModuleListProps> = ({ active, onChange, onSettingsClick }) => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header>
        <Title>{t('image_studio.title', '图片工坊')}</Title>
        <SettingsButton onClick={onSettingsClick} title={t('common.settings')}>
          <Settings size={14} />
        </SettingsButton>
      </Header>

      <ModuleListContainer>
        {modules.map((m) => (
          <ModuleItem key={m.key} $active={active === m.key} $color={m.color} onClick={() => onChange(m.key)}>
            {active === m.key && <ActiveIndicator $color={m.color} />}
            <ModuleEmoji>{m.emoji}</ModuleEmoji>
            <ModuleName>{t(m.labelKey)}</ModuleName>
          </ModuleItem>
        ))}
      </ModuleListContainer>

      <Footer>
        <CreateButton>
          <Plus size={14} />
          <span>{t('image_studio.module_list.create_preset', '新建')}</span>
        </CreateButton>
      </Footer>
    </Container>
  )
}

export default ModuleList

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 8px;
  border-bottom: 0.5px solid var(--color-border);
`

const Title = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-1);
`

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-3);
  transition: all 0.15s ease;

  &:hover {
    background: var(--color-background-soft);
    color: var(--color-text-1);
  }
`

const ModuleListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 6px;

  &::-webkit-scrollbar {
    width: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const ModuleItem = styled.div<{ $active: boolean; $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;

  background-color: ${(props) => (props.$active ? 'var(--color-background-soft)' : 'transparent')};

  &:hover {
    background-color: var(--color-background-soft);
  }
`

const ModuleEmoji = styled.span`
  font-size: 18px;
  line-height: 1;
`

const ModuleName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ActiveIndicator = styled.div<{ $color: string }>`
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: ${(props) => props.$color};
  border-radius: 0 2px 2px 0;
`

const Footer = styled.div`
  padding: 6px;
  border-top: 0.5px solid var(--color-border);
`

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 6px;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-text-3);
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
`
