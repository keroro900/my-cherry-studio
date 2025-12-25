/**
 * 工作流主题选择模态框
 * Workflow Theme Selection Modal
 *
 * 提供丰富的主题预览和选择功能
 */

import { Modal } from 'antd'
import { Check } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import styled from 'styled-components'

import { WORKFLOW_THEMES } from '../../config/workflowThemes'
import type { WorkflowNodeTheme } from '../../types/workflowTheme'

interface ThemeSelectionModalProps {
  visible: boolean
  currentThemeId: string
  onSelect: (themeId: string) => void
  onClose: () => void
}

/**
 * 主题选择模态框
 */
const ThemeSelectionModal: FC<ThemeSelectionModalProps> = ({ visible, currentThemeId, onSelect, onClose }) => {
  const [previewThemeId, setPreviewThemeId] = useState(currentThemeId)

  // 处理主题选择
  const handleSelect = useCallback(
    (themeId: string) => {
      onSelect(themeId)
      onClose()
    },
    [onSelect, onClose]
  )

  // 处理悬停预览
  const handleHover = useCallback((themeId: string) => {
    setPreviewThemeId(themeId)
  }, [])

  // 重置预览
  const handleMouseLeave = useCallback(() => {
    setPreviewThemeId(currentThemeId)
  }, [currentThemeId])

  return (
    <Modal
      open={visible}
      title={<ModalTitle>选择节点主题</ModalTitle>}
      width={720}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden>
      <ModalContent>
        <ThemeGrid onMouseLeave={handleMouseLeave}>
          {WORKFLOW_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              $isSelected={currentThemeId === theme.id}
              $isPreview={previewThemeId === theme.id}
              onClick={() => handleSelect(theme.id)}
              onMouseEnter={() => handleHover(theme.id)}>
              {/* 主题预览 */}
              <ThemePreview theme={theme} />

              {/* 主题信息 */}
              <ThemeInfo>
                <ThemeName>{theme.displayName}</ThemeName>
                {theme.description && <ThemeDesc>{theme.description}</ThemeDesc>}
              </ThemeInfo>

              {/* 选中标记 */}
              {currentThemeId === theme.id && (
                <SelectedBadge>
                  <Check size={14} />
                </SelectedBadge>
              )}
            </ThemeCard>
          ))}
        </ThemeGrid>

        {/* 预览提示 */}
        <PreviewHint>悬停预览主题效果，点击应用</PreviewHint>
      </ModalContent>
    </Modal>
  )
}

// ==================== 主题预览组件 ====================

interface ThemePreviewProps {
  theme: WorkflowNodeTheme
}

const ThemePreview: FC<ThemePreviewProps> = ({ theme }) => {
  const categoryColors = theme.categoryColors || {}

  return (
    <PreviewContainer $theme={theme}>
      {/* 迷你节点预览 */}
      <MiniNode $theme={theme} $category="input">
        <MiniNodeStripe $color={categoryColors.input || '#52c41a'} />
        <MiniNodeContent>
          <MiniNodeIcon>📝</MiniNodeIcon>
          <MiniNodeLabel>Input</MiniNodeLabel>
        </MiniNodeContent>
        <MiniHandle $color={categoryColors.input || '#52c41a'} $side="right" />
      </MiniNode>

      <MiniNode $theme={theme} $category="ai">
        <MiniNodeStripe $color={categoryColors.ai || '#1890ff'} />
        <MiniNodeContent>
          <MiniNodeIcon>🧠</MiniNodeIcon>
          <MiniNodeLabel>AI</MiniNodeLabel>
        </MiniNodeContent>
        <MiniHandle $color={categoryColors.ai || '#1890ff'} $side="left" />
        <MiniHandle $color={categoryColors.ai || '#1890ff'} $side="right" />
      </MiniNode>

      <MiniNode $theme={theme} $category="output">
        <MiniNodeStripe $color={categoryColors.output || '#13c2c2'} />
        <MiniNodeContent>
          <MiniNodeIcon>📤</MiniNodeIcon>
          <MiniNodeLabel>Output</MiniNodeLabel>
        </MiniNodeContent>
        <MiniHandle $color={categoryColors.output || '#13c2c2'} $side="left" />
      </MiniNode>

      {/* 连接线 */}
      <MiniEdge $color={theme.edgeColor || '#90A4AE'} $from="input" $to="ai" />
      <MiniEdge $color={theme.edgeColor || '#90A4AE'} $from="ai" $to="output" />
    </PreviewContainer>
  )
}

// ==================== 样式组件 ====================

const ModalTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
`

const ModalContent = styled.div`
  padding: 8px 0;
`

const ThemeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
`

const ThemeCard = styled.div<{ $isSelected: boolean; $isPreview: boolean }>`
  position: relative;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  background: ${(props) =>
    props.$isSelected
      ? 'linear-gradient(135deg, var(--color-primary-light, rgba(24, 144, 255, 0.1)), var(--color-primary-mute, rgba(24, 144, 255, 0.05)))'
      : 'var(--color-background-soft)'};

  border: 2px solid ${(props) =>
    props.$isSelected
      ? 'var(--color-primary)'
      : props.$isPreview
        ? 'var(--color-primary-mute, rgba(24, 144, 255, 0.3))'
        : 'transparent'};

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
`

const PreviewContainer = styled.div<{ $theme: WorkflowNodeTheme }>`
  position: relative;
  height: 100px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: ${(props) =>
    props.$theme.id.includes('neon') || props.$theme.id.includes('midnight')
      ? 'linear-gradient(135deg, #1a1a2e, #16213e)'
      : 'linear-gradient(135deg, #f5f5f5, #e8e8e8)'};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
`

const MiniNode = styled.div<{ $theme: WorkflowNodeTheme; $category: string }>`
  position: relative;
  width: 70px;
  height: 50px;
  border-radius: ${(props) => Math.min(props.$theme.nodeStyle.borderRadius, 12)}px;
  border: ${(props) => props.$theme.nodeStyle.borderWidth}px solid var(--color-border);
  background: ${(props) =>
    props.$theme.id.includes('neon') || props.$theme.id.includes('midnight')
      ? 'rgba(30, 30, 50, 0.9)'
      : 'rgba(255, 255, 255, 0.95)'};
  box-shadow: ${(props) => props.$theme.nodeStyle.shadow};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const MiniNodeStripe = styled.div<{ $color: string }>`
  height: 3px;
  background: ${(props) => props.$color};
`

const MiniNodeContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
`

const MiniNodeIcon = styled.span`
  font-size: 12px;
`

const MiniNodeLabel = styled.span`
  font-size: 9px;
  font-weight: 500;
  color: var(--color-text-2);
`

const MiniHandle = styled.div<{ $color: string; $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${(props) => (props.$side === 'left' ? 'left: -4px' : 'right: -4px')};
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.8) 0%,
    ${(props) => props.$color} 50%
  );
  box-shadow: 0 0 4px ${(props) => props.$color}60;
`

const MiniEdge = styled.div<{ $color: string; $from: string; $to: string }>`
  position: absolute;
  height: 2px;
  background: ${(props) => props.$color};
  opacity: 0.6;

  ${(props) => {
    if (props.$from === 'input' && props.$to === 'ai') {
      return `
        width: 20px;
        left: calc(33% + 35px);
        top: 50%;
      `
    }
    if (props.$from === 'ai' && props.$to === 'output') {
      return `
        width: 20px;
        left: calc(66% - 15px);
        top: 50%;
      `
    }
    return ''
  }}
`

const ThemeInfo = styled.div`
  text-align: center;
`

const ThemeName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
`

const ThemeDesc = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
`

const SelectedBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`

const PreviewHint = styled.div`
  text-align: center;
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

export default ThemeSelectionModal
