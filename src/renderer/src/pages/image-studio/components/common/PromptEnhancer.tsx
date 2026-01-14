/**
 * Prompt 增强器组件
 *
 * 提供智能提示词增强功能，集成到各模块的提示词输入框旁
 * 支持：
 * - 一键增强
 * - 增强结果预览和对比
 * - 应用或取消增强
 */

import { CheckOutlined, CloseOutlined, LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message, Popover, Tooltip } from 'antd'
import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { type EnhanceMode, type EnhanceResult, promptEnhancerService } from '../../services/PromptEnhancerService'
import type { StudioModule } from '../../types'

// ============================================================================
// Props 定义
// ============================================================================

interface PromptEnhancerProps {
  /** 当前提示词 */
  value: string
  /** 所属模块 */
  module: StudioModule
  /** 增强模式 */
  mode?: EnhanceMode
  /** 模块配置（可选，用于提供上下文） */
  moduleConfig?: Record<string, any>
  /** 应用增强结果的回调 */
  onApply: (enhancedPrompt: string) => void
  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large'
  /** 是否禁用 */
  disabled?: boolean
  /** 按钮类型：icon-only 或 with-text */
  buttonType?: 'icon' | 'text'
}

// ============================================================================
// 主组件
// ============================================================================

const PromptEnhancer: FC<PromptEnhancerProps> = ({
  value,
  module,
  mode,
  moduleConfig,
  onApply,
  size = 'small',
  disabled = false,
  buttonType = 'icon'
}) => {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EnhanceResult | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // 检查是否可用
  const canEnhance = promptEnhancerService.canEnhance()

  // 执行增强
  const handleEnhance = useCallback(async () => {
    if (!value.trim()) {
      message.warning(t('image_studio.prompt_enhancer.empty_prompt', '请先输入提示词'))
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const enhanceResult = await promptEnhancerService.enhance(value, {
        mode: mode || getDefaultMode(module),
        module,
        moduleConfig
      })

      setResult(enhanceResult)
      setPopoverOpen(true)
    } catch (error) {
      console.error('Enhance failed:', error)
      message.error(t('image_studio.prompt_enhancer.enhance_failed', '增强失败，请稍后重试'))
    } finally {
      setLoading(false)
    }
  }, [value, module, mode, moduleConfig, t])

  // 应用增强结果
  const handleApply = useCallback(() => {
    if (result) {
      onApply(result.enhanced)
      setPopoverOpen(false)
      setResult(null)
      message.success(t('image_studio.prompt_enhancer.applied', '已应用增强结果'))
    }
  }, [result, onApply, t])

  // 取消
  const handleCancel = useCallback(() => {
    setPopoverOpen(false)
    setResult(null)
  }, [])

  // 获取默认模式
  function getDefaultMode(mod: StudioModule): EnhanceMode {
    switch (mod) {
      case 'ecom':
        return 'garment'
      case 'model':
        return 'style'
      case 'pattern':
        return 'design'
      default:
        return 'garment'
    }
  }

  // 增强结果弹出内容
  const popoverContent = result ? (
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>
          <Sparkles size={14} />
          <span>{t('image_studio.prompt_enhancer.result_title', '增强结果')}</span>
        </PopoverTitle>
        <ConfidenceBadge $confidence={result.confidence}>{Math.round(result.confidence * 100)}%</ConfidenceBadge>
      </PopoverHeader>

      <CompareSection>
        <CompareItem>
          <CompareLabel>{t('image_studio.prompt_enhancer.original', '原始')}</CompareLabel>
          <CompareText $type="original">{result.original}</CompareText>
        </CompareItem>

        <CompareItem>
          <CompareLabel>{t('image_studio.prompt_enhancer.enhanced', '增强后')}</CompareLabel>
          <CompareText $type="enhanced">{result.enhanced}</CompareText>
        </CompareItem>
      </CompareSection>

      {result.additions.length > 0 && (
        <AdditionsSection>
          <AdditionsLabel>{t('image_studio.prompt_enhancer.additions', '新增内容')}</AdditionsLabel>
          <AdditionsTags>
            {result.additions.map((addition, index) => (
              <AdditionTag key={index}>{addition}</AdditionTag>
            ))}
          </AdditionsTags>
        </AdditionsSection>
      )}

      <PopoverActions>
        <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="primary" size="small" icon={<CheckOutlined />} onClick={handleApply}>
          {t('image_studio.prompt_enhancer.apply', '应用')}
        </Button>
      </PopoverActions>
    </PopoverContent>
  ) : null

  // 不可用时的提示
  const unavailableTooltip = !canEnhance
    ? t('image_studio.prompt_enhancer.not_available', '请先配置默认助手模型')
    : undefined

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      content={popoverContent}
      trigger="click"
      placement="bottomRight"
      overlayStyle={{ maxWidth: 400 }}>
      <Tooltip title={unavailableTooltip || t('image_studio.prompt_enhancer.tooltip', 'AI 智能增强提示词')}>
        {buttonType === 'icon' ? (
          <EnhanceButton
            type="text"
            size={size}
            disabled={disabled || !canEnhance || loading}
            onClick={handleEnhance}
            icon={loading ? <LoadingOutlined spin /> : <ThunderboltOutlined />}
          />
        ) : (
          <EnhanceButtonWithText
            type="default"
            size={size}
            disabled={disabled || !canEnhance || loading}
            onClick={handleEnhance}
            icon={loading ? <LoadingOutlined spin /> : <Sparkles size={14} />}>
            {t('image_studio.prompt_enhancer.enhance', '增强')}
          </EnhanceButtonWithText>
        )}
      </Tooltip>
    </Popover>
  )
}

export default PromptEnhancer

// ============================================================================
// 样式
// ============================================================================

const EnhanceButton = styled(Button)`
  color: var(--color-text-3);

  &:hover:not(:disabled) {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
`

const EnhanceButtonWithText = styled(Button)`
  display: flex;
  align-items: center;
  gap: 4px;
`

const PopoverContent = styled.div`
  width: 350px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const PopoverHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const PopoverTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);

  svg {
    color: var(--color-primary);
  }
`

const ConfidenceBadge = styled.span<{ $confidence: number }>`
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 10px;
  color: ${(props) => (props.$confidence >= 0.8 ? 'var(--color-success)' : 'var(--color-warning)')};
  background: ${(props) =>
    props.$confidence >= 0.8
      ? 'var(--color-success-bg, rgba(82, 196, 26, 0.1))'
      : 'var(--color-warning-bg, rgba(250, 173, 20, 0.1))'};
`

const CompareSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const CompareItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const CompareLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
`

const CompareText = styled.div<{ $type: 'original' | 'enhanced' }>`
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-2);
  background: ${(props) => (props.$type === 'enhanced' ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  border-radius: 6px;
  border-left: 3px solid ${(props) => (props.$type === 'enhanced' ? 'var(--color-primary)' : 'var(--color-border)')};
  max-height: 80px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`

const AdditionsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const AdditionsLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
`

const AdditionsTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const AdditionTag = styled.span`
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: 4px;
`

const PopoverActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
`
