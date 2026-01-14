/**
 * 内嵌 Prompt 编辑器组件 v1.0
 * 允许用户直接在节点内编辑提示词
 *
 * 特性：
 * - 自动高度调整
 * - 防抖更新 Redux
 * - 字符计数显示
 * - 阻止键盘事件冒泡到画布
 */

import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateNode } from '@renderer/store/workflow'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

interface InlinePromptEditorProps {
  nodeId: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  /** 配置字段名，默认 'prompt' */
  configKey?: string
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
}

/**
 * 内嵌 Prompt 编辑器
 */
function InlinePromptEditor({
  nodeId,
  value,
  onChange,
  placeholder = '输入提示词...',
  disabled = false,
  maxLength = 2000,
  configKey = 'prompt',
  minRows = 2,
  maxRows = 6
}: InlinePromptEditorProps) {
  const dispatch = useAppDispatch()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localValue, setLocalValue] = useState(value || '')
  const [isFocused, setIsFocused] = useState(false)

  // 获取当前节点的 config 用于合并更新
  const currentConfig = useAppSelector((state) => {
    const node = state.workflow.nodes.find((n) => n.id === nodeId)
    return node?.data?.config || {}
  })

  // 同步外部值变化
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value || '')
    }
  }, [value, isFocused])

  // 防抖更新 Redux - 合并 config 而不是替换
  const debouncedUpdate = useMemo(
    () =>
      debounce((newValue: string, existingConfig: Record<string, any>) => {
        dispatch(
          updateNode({
            id: nodeId,
            data: {
              config: {
                ...existingConfig,
                [configKey]: newValue
              }
            }
          })
        )
        onChange?.(newValue)
      }, 300),
    [dispatch, nodeId, configKey, onChange]
  )

  // 清理防抖
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel()
    }
  }, [debouncedUpdate])

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto'

    const lineHeight = 18 // 约等于 font-size * line-height
    const minHeight = minRows * lineHeight + 16 // 16px padding
    const maxHeight = maxRows * lineHeight + 16

    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [minRows, maxRows])

  // 值变化时调整高度
  useEffect(() => {
    adjustHeight()
  }, [localValue, adjustHeight])

  // 处理输入变化
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (newValue.length <= maxLength) {
        setLocalValue(newValue)
        debouncedUpdate(newValue, currentConfig)
      }
    },
    [maxLength, debouncedUpdate, currentConfig]
  )

  // 阻止键盘事件冒泡到画布
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 阻止所有键盘事件冒泡，避免触发画布快捷键
    e.stopPropagation()

    // 允许 Escape 键取消焦点
    if (e.key === 'Escape') {
      textareaRef.current?.blur()
    }
  }, [])

  // 阻止拖拽冒泡
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <EditorContainer className={isFocused ? 'focused' : ''}>
      <StyledTextarea
        ref={textareaRef}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className="nodrag nowheel"
        spellCheck={false}
      />
      <EditorFooter>
        <CharCount $warning={localValue.length > maxLength * 0.9}>
          {localValue.length} / {maxLength}
        </CharCount>
      </EditorFooter>
    </EditorContainer>
  )
}

export default memo(InlinePromptEditor)

// ==================== 样式 ====================

const EditorContainer = styled.div`
  position: relative;
  margin: 0 14px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--color-border);
  background: var(--color-background);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-border-soft);
  }

  &.focused {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-mute);
  }
`

const StyledTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;

  &::placeholder {
    color: var(--color-text-3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-soft);
  }
`

const EditorFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 4px 10px 6px;
  border-top: 1px solid var(--color-border-mute);
  background: var(--color-background-soft);
  border-radius: 0 0 6px 6px;
`

const CharCount = styled.span<{ $warning: boolean }>`
  font-size: 10px;
  color: ${(props) => (props.$warning ? 'var(--color-warning, #faad14)' : 'var(--color-text-3)')};
`
