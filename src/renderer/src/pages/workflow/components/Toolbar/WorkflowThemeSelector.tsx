/**
 * 工作流主题选择器组件
 * Workflow Theme Selector Component
 *
 * 支持两种模式：
 * 1. 下拉菜单快速选择
 * 2. 模态框详细预览选择
 */

import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import { Check, Maximize2, Palette } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import { useWorkflowTheme } from '../../hooks/useWorkflowTheme'
import ThemeSelectionModal from './ThemeSelectionModal'

/**
 * 工作流主题选择器
 */
const WorkflowThemeSelector: FC = () => {
  const { currentThemeId, allThemes, setTheme } = useWorkflowTheme()
  const [modalVisible, setModalVisible] = useState(false)

  // 打开模态框
  const openModal = useCallback(() => {
    setModalVisible(true)
  }, [])

  // 关闭模态框
  const closeModal = useCallback(() => {
    setModalVisible(false)
  }, [])

  // 构建下拉菜单项
  const menuItems: MenuProps['items'] = useMemo(() => {
    const themeItems = allThemes.map((theme) => ({
      key: theme.id,
      label: (
        <ThemeMenuItem>
          <ThemePreview $colors={theme.categoryColors || {}} />
          <ThemeInfo>
            <ThemeName>{theme.displayName}</ThemeName>
            {theme.description && <ThemeDesc>{theme.description}</ThemeDesc>}
          </ThemeInfo>
          {currentThemeId === theme.id && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
        </ThemeMenuItem>
      ),
      onClick: () => setTheme(theme.id)
    }))

    // 添加分隔线和"更多选项"按钮
    return [
      ...themeItems,
      { type: 'divider' as const },
      {
        key: 'more',
        label: (
          <ThemeMenuItem>
            <MoreIcon>
              <Maximize2 size={14} />
            </MoreIcon>
            <ThemeInfo>
              <ThemeName>更多选项...</ThemeName>
              <ThemeDesc>打开主题选择器查看详细预览</ThemeDesc>
            </ThemeInfo>
          </ThemeMenuItem>
        ),
        onClick: openModal
      }
    ]
  }, [allThemes, currentThemeId, setTheme, openModal])

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        placement="bottomRight"
        autoFocus={false}
        destroyPopupOnHide>
        <ThemeButton title="节点主题">
          <Palette size={16} />
        </ThemeButton>
      </Dropdown>

      {/* 主题选择模态框 */}
      <ThemeSelectionModal
        visible={modalVisible}
        currentThemeId={currentThemeId}
        onSelect={setTheme}
        onClose={closeModal}
      />
    </>
  )
}

// ==================== 样式 ====================

const ThemeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-background-soft);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
`

const ThemeMenuItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  min-width: 220px;
`

const ThemePreview = styled.div<{ $colors: Record<string, string> }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(
    135deg,
    ${(props) => props.$colors.input || '#52c41a'} 0%,
    ${(props) => props.$colors.ai || '#1890ff'} 50%,
    ${(props) => props.$colors.output || '#13c2c2'} 100%
  );
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
`

const MoreIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
  flex-shrink: 0;
`

const ThemeInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const ThemeName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const ThemeDesc = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export default WorkflowThemeSelector
