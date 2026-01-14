/**
 * AssistantBubbleThemeSettings - Agent 气泡主题设置
 *
 * 允许为每个 Agent 配置独立的消息气泡主题样式
 */

import { CheckOutlined } from '@ant-design/icons'
import type { AgentBubbleTheme, BubbleThemePreset } from '@renderer/types/assistant'
import { BUBBLE_THEME_PRESETS, getBubbleThemeConfig } from '@renderer/types/assistant'
import type { Assistant } from '@renderer/types'
import { Card, Col, ColorPicker, Row, Slider, Switch, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const { Text } = Typography

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Partial<Assistant>) => void
}

/**
 * 主题预设列表
 */
const THEME_PRESETS: { key: BubbleThemePreset; label: string; icon: string }[] = [
  { key: 'default', label: '默认', icon: '💎' },
  { key: 'ocean', label: '海洋', icon: '🌊' },
  { key: 'forest', label: '森林', icon: '🌲' },
  { key: 'sunset', label: '日落', icon: '🌅' },
  { key: 'lavender', label: '薰衣草', icon: '💜' },
  { key: 'rose', label: '玫瑰', icon: '🌹' },
  { key: 'midnight', label: '午夜', icon: '🌙' },
  { key: 'sakura', label: '樱花', icon: '🌸' },
  { key: 'aurora', label: '极光', icon: '✨' },
  { key: 'neon', label: '霓虹', icon: '💫' },
  { key: 'custom', label: '自定义', icon: '🎨' }
]

const AssistantBubbleThemeSettings: FC<Props> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()
  const currentTheme = assistant.bubbleTheme || { preset: 'default' }
  const themeConfig = useMemo(() => getBubbleThemeConfig(currentTheme), [currentTheme])

  /**
   * 更新主题配置
   */
  const updateTheme = useCallback(
    (updates: Partial<AgentBubbleTheme>) => {
      updateAssistant({
        bubbleTheme: { ...currentTheme, ...updates }
      })
    },
    [currentTheme, updateAssistant]
  )

  /**
   * 选择预设主题
   */
  const selectPreset = useCallback(
    (preset: BubbleThemePreset) => {
      if (preset === 'custom') {
        updateTheme({ preset: 'custom' })
      } else {
        // 应用预设主题
        const presetConfig = BUBBLE_THEME_PRESETS[preset]
        updateAssistant({
          bubbleTheme: { ...presetConfig, preset }
        })
      }
    },
    [updateTheme, updateAssistant]
  )

  const isCustom = currentTheme.preset === 'custom'

  return (
    <Container>
      <SettingTitle>{t('assistants.settings.bubble_theme.title', '气泡主题')}</SettingTitle>
      <SettingGroup>
        {/* 主题预设选择 */}
        <SettingRow>
          <SettingRowTitle>{t('assistants.settings.bubble_theme.preset', '预设主题')}</SettingRowTitle>
        </SettingRow>
        <PresetGrid>
          <Row gutter={[12, 12]}>
            {THEME_PRESETS.map((preset) => {
              const presetTheme = BUBBLE_THEME_PRESETS[preset.key]
              const isSelected = currentTheme.preset === preset.key
              return (
                <Col key={preset.key} span={8}>
                  <PresetCard
                    $selected={isSelected}
                    $primaryColor={presetTheme.primaryColor || '#00d2ff'}
                    onClick={() => selectPreset(preset.key)}
                    hoverable
                    size="small">
                    <PresetContent>
                      <PresetIcon>{preset.icon}</PresetIcon>
                      <PresetLabel>{preset.label}</PresetLabel>
                      {isSelected && <CheckOutlined style={{ color: presetTheme.primaryColor }} />}
                    </PresetContent>
                    <PresetPreview
                      $backgroundColor={presetTheme.backgroundColor}
                      $borderColor={presetTheme.borderColor}
                      $primaryColor={presetTheme.primaryColor}
                    />
                  </PresetCard>
                </Col>
              )
            })}
          </Row>
        </PresetGrid>

        <SettingDivider />

        {/* 自定义颜色设置 (仅在自定义模式下显示) */}
        {isCustom && (
          <>
            <SettingRow>
              <SettingRowTitle>{t('assistants.settings.bubble_theme.primary_color', '主色调')}</SettingRowTitle>
              <ColorPicker
                value={themeConfig.primaryColor}
                onChange={(color) => updateTheme({ primaryColor: color.toHexString() })}
                showText
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{t('assistants.settings.bubble_theme.border_color', '边框颜色')}</SettingRowTitle>
              <ColorPicker
                value={themeConfig.borderColor}
                onChange={(color) => updateTheme({ borderColor: color.toHexString() })}
                showText
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>
                {t('assistants.settings.bubble_theme.avatar_border_color', '头像边框颜色')}
              </SettingRowTitle>
              <ColorPicker
                value={themeConfig.avatarBorderColor}
                onChange={(color) => updateTheme({ avatarBorderColor: color.toHexString() })}
                showText
              />
            </SettingRow>

            <SettingRow>
              <SettingRowTitle>{t('assistants.settings.bubble_theme.glow_color', '发光颜色')}</SettingRowTitle>
              <ColorPicker
                value={themeConfig.glowColor}
                onChange={(color) => updateTheme({ glowColor: color.toHexString() })}
                showText
              />
            </SettingRow>

            <SettingDivider />
          </>
        )}

        {/* 通用设置 */}
        <SettingRow>
          <SettingRowTitle>{t('assistants.settings.bubble_theme.glassmorphism', '毛玻璃效果')}</SettingRowTitle>
          <Switch
            checked={themeConfig.enableGlassmorphism}
            onChange={(checked) => updateTheme({ enableGlassmorphism: checked })}
          />
        </SettingRow>

        <SettingRow>
          <SettingRowTitle>{t('assistants.settings.bubble_theme.gradient_border', '渐变边框')}</SettingRowTitle>
          <Switch
            checked={themeConfig.enableGradientBorder}
            onChange={(checked) => updateTheme({ enableGradientBorder: checked })}
          />
        </SettingRow>

        {themeConfig.enableGradientBorder && (
          <SettingRow>
            <SettingRowTitle>{t('assistants.settings.bubble_theme.gradient_angle', '渐变角度')}</SettingRowTitle>
            <Slider
              style={{ width: 200 }}
              min={0}
              max={360}
              value={themeConfig.gradientAngle || 45}
              onChange={(value) => updateTheme({ gradientAngle: value })}
            />
          </SettingRow>
        )}

        <SettingRow>
          <SettingRowTitle>{t('assistants.settings.bubble_theme.border_radius', '圆角大小')}</SettingRowTitle>
          <Slider
            style={{ width: 200 }}
            min={0}
            max={30}
            value={themeConfig.borderRadius || 14}
            onChange={(value) => updateTheme({ borderRadius: value })}
          />
        </SettingRow>

        <SettingDivider />

        {/* 预览 */}
        <PreviewSection>
          <Text type="secondary">{t('assistants.settings.bubble_theme.preview', '预览')}</Text>
          <PreviewBubble $theme={themeConfig}>
            <PreviewAvatar $theme={themeConfig}>{assistant.emoji || assistant.name?.charAt(0) || '🤖'}</PreviewAvatar>
            <PreviewContent>
              <PreviewName $theme={themeConfig}>{assistant.name || 'Agent'}</PreviewName>
              <PreviewText>
                这是一条示例消息，展示当前气泡主题的效果。代码示例：<code>const theme = "custom"</code>
              </PreviewText>
            </PreviewContent>
          </PreviewBubble>
        </PreviewSection>
      </SettingGroup>
    </Container>
  )
}

// Styled Components
const Container = styled.div``

const PresetGrid = styled.div`
  margin-top: 12px;
  margin-bottom: 16px;
`

const PresetCard = styled(Card)<{ $selected: boolean; $primaryColor: string }>`
  cursor: pointer;
  border: 2px solid ${({ $selected, $primaryColor }) => ($selected ? $primaryColor : 'var(--color-border)')};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ $primaryColor }) => $primaryColor};
    box-shadow: 0 0 8px ${({ $primaryColor }) => `${$primaryColor}40`};
  }

  .ant-card-body {
    padding: 8px;
  }
`

const PresetContent = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
`

const PresetIcon = styled.span`
  font-size: 16px;
`

const PresetLabel = styled.span`
  flex: 1;
  font-size: 12px;
  font-weight: 500;
`

const PresetPreview = styled.div<{ $backgroundColor?: string; $borderColor?: string; $primaryColor?: string }>`
  height: 24px;
  border-radius: 6px;
  background: ${({ $backgroundColor }) => $backgroundColor || 'var(--color-background-soft)'};
  border: 1px solid ${({ $borderColor }) => $borderColor || 'var(--color-border)'};
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ $primaryColor }) => $primaryColor || '#00d2ff'};
    box-shadow: 0 0 4px ${({ $primaryColor }) => $primaryColor || '#00d2ff'};
  }
`

const PreviewSection = styled.div`
  margin-top: 16px;
`

const PreviewBubble = styled.div<{ $theme: AgentBubbleTheme }>`
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  margin-top: 12px;
  border-radius: ${({ $theme }) => $theme.borderRadius || 14}px;
  background: ${({ $theme }) => $theme.backgroundColor || 'var(--color-background-soft)'};
  border: 1px solid ${({ $theme }) => $theme.borderColor || 'var(--color-border)'};
  backdrop-filter: ${({ $theme }) => ($theme.enableGlassmorphism ? 'blur(10px)' : 'none')};
  color: ${({ $theme }) => $theme.textColor || 'var(--color-text)'};
  ${({ $theme }) => $theme.glowColor && `box-shadow: 0 0 8px ${$theme.glowColor};`}
`

const PreviewAvatar = styled.div<{ $theme: AgentBubbleTheme }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ $theme }) => $theme.primaryColor || '#00d2ff'};
  border: 2px solid ${({ $theme }) => $theme.avatarBorderColor || $theme.primaryColor || '#00d2ff'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 0 8px ${({ $theme }) => $theme.glowColor || 'rgba(0, 210, 255, 0.3)'};
`

const PreviewContent = styled.div`
  flex: 1;
`

const PreviewName = styled.div<{ $theme: AgentBubbleTheme }>`
  font-weight: 600;
  font-size: 14px;
  color: ${({ $theme }) => $theme.primaryColor || 'var(--color-text)'};
  margin-bottom: 4px;
`

const PreviewText = styled.div`
  font-size: 14px;
  line-height: 1.6;

  code {
    background: rgba(0, 210, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--vcp-primary, #00d2ff);
  }
`

export default AssistantBubbleThemeSettings
