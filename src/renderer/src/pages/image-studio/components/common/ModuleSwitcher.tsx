/**
 * 模块切换器组件
 *
 * 显示电商、模特换装、图案设计三个模块的切换标签
 */

import { Palette, ShoppingBag, User } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { StudioModule } from '../../types'

interface ModuleSwitcherProps {
  active: StudioModule
  onChange: (module: StudioModule) => void
}

const modules: Array<{
  key: StudioModule
  labelKey: string
  icon: typeof ShoppingBag
  color: string
}> = [
  { key: 'ecom', labelKey: 'image_studio.modules.ecom', icon: ShoppingBag, color: '#10B981' },
  { key: 'model', labelKey: 'image_studio.modules.model', icon: User, color: '#8B5CF6' },
  { key: 'pattern', labelKey: 'image_studio.modules.pattern', icon: Palette, color: '#F59E0B' }
]

const ModuleSwitcher: FC<ModuleSwitcherProps> = ({ active, onChange }) => {
  const { t } = useTranslation()

  return (
    <Container>
      {modules.map((m) => (
        <TabItem key={m.key} $active={active === m.key} $color={m.color} onClick={() => onChange(m.key)}>
          <m.icon size={16} />
          <span>{t(m.labelKey)}</span>
        </TabItem>
      ))}
    </Container>
  )
}

export default ModuleSwitcher

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
`

const TabItem = styled.button<{ $active: boolean; $color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;

  background-color: ${(props) => (props.$active ? props.$color : 'transparent')};
  color: ${(props) => (props.$active ? '#fff' : 'var(--color-text-2)')};

  &:hover {
    background-color: ${(props) => (props.$active ? props.$color : 'var(--color-background-mute)')};
  }

  svg {
    opacity: ${(props) => (props.$active ? 1 : 0.7)};
  }
`
