/**
 * QuickCommandInput - @ 快捷指令输入组件
 *
 * 提供类似 Claude Code 的 @ 指令功能：
 * - @file <path> - 引用文件内容
 * - @folder <path> - 引用目录结构
 * - @git - Git 状态上下文
 * - @selection - 引用当前选中代码
 * - @terminal - 最近终端输出
 * - @error - 最近错误信息
 */

import {
  CodeOutlined,
  FileOutlined,
  FolderOutlined,
  BranchesOutlined,
  SelectOutlined,
  ConsoleSqlOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { Input, Popover, Tag } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

const { TextArea } = Input

// ==================== 类型定义 ====================

/** 快捷指令定义 */
interface QuickCommand {
  id: string
  trigger: string // 触发词，如 @file
  label: string
  description: string
  icon: React.ReactNode
  hasParameter?: boolean // 是否需要参数
  parameterPlaceholder?: string
}

/** 快捷指令结果 */
export interface QuickCommandResult {
  command: string
  parameter?: string
  resolvedContent?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  workingDirectory?: string
  currentFilePath?: string
  currentSelection?: string
  minRows?: number
  maxRows?: number
}

// ==================== 快捷指令配置 ====================

const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'file',
    trigger: '@file',
    label: '@file <path>',
    description: '引用文件内容到上下文',
    icon: <FileOutlined />,
    hasParameter: true,
    parameterPlaceholder: 'path/to/file.ts'
  },
  {
    id: 'folder',
    trigger: '@folder',
    label: '@folder <path>',
    description: '引用目录结构到上下文',
    icon: <FolderOutlined />,
    hasParameter: true,
    parameterPlaceholder: 'src/components'
  },
  {
    id: 'git',
    trigger: '@git',
    label: '@git',
    description: '添加 Git 状态上下文（分支、变更等）',
    icon: <BranchesOutlined />
  },
  {
    id: 'selection',
    trigger: '@selection',
    label: '@selection',
    description: '引用当前选中的代码',
    icon: <SelectOutlined />
  },
  {
    id: 'code',
    trigger: '@code',
    label: '@code <lang>',
    description: '插入代码块模板',
    icon: <CodeOutlined />,
    hasParameter: true,
    parameterPlaceholder: 'typescript'
  },
  {
    id: 'terminal',
    trigger: '@terminal',
    label: '@terminal',
    description: '引用最近的终端输出',
    icon: <ConsoleSqlOutlined />
  },
  {
    id: 'error',
    trigger: '@error',
    label: '@error',
    description: '引用最近的错误信息',
    icon: <WarningOutlined />
  }
]

// ==================== 样式组件 ====================

const InputWrapper = styled.div`
  position: relative;
  width: 100%;
`

const CommandSuggestionsPopup = styled.div`
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  min-width: 280px;
`

const CommandItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  background: ${(props) => (props.$active ? 'var(--color-background-soft)' : 'transparent')};

  &:hover {
    background: var(--color-background-soft);
  }
`

const CommandIcon = styled.span`
  font-size: 16px;
  color: var(--color-primary);
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const CommandInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const CommandLabel = styled.span`
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const CommandDescription = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
`

const ActiveCommandsBar = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 0;
`

const StyledTextArea = styled(TextArea)`
  .ant-input {
    font-size: 14px;
    line-height: 1.6;
  }
`

// ==================== 组件实现 ====================

export const QuickCommandInput: FC<Props> = ({
  value,
  onChange,
  onSend,
  placeholder = '输入消息，使用 @ 触发快捷指令...',
  disabled = false,
  loading = false,
  workingDirectory: _workingDirectory,
  currentFilePath: _currentFilePath,
  currentSelection: _currentSelection,
  minRows = 1,
  maxRows = 6
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeCommands, setActiveCommands] = useState<QuickCommandResult[]>([])
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  // 解析当前输入中的 @ 指令
  const currentAtTrigger = useMemo(() => {
    const cursorPos = textAreaRef.current?.selectionStart ?? value.length
    const textBeforeCursor = value.slice(0, cursorPos)

    // 查找最后一个 @
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex === -1) return null

    // 检查 @ 前是否是空白或行首
    const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
    if (!/\s/.test(charBefore) && lastAtIndex !== 0) return null

    // 获取 @ 后的文本
    const afterAt = textBeforeCursor.slice(lastAtIndex)
    // 检查是否有空格（完成的指令）
    if (afterAt.includes(' ') && !afterAt.endsWith('@')) return null

    return {
      trigger: afterAt,
      startIndex: lastAtIndex
    }
  }, [value])

  // 过滤匹配的指令
  const filteredCommands = useMemo(() => {
    if (!currentAtTrigger) return []

    const trigger = currentAtTrigger.trigger.toLowerCase()
    return QUICK_COMMANDS.filter((cmd) => cmd.trigger.toLowerCase().startsWith(trigger) || trigger === '@')
  }, [currentAtTrigger])

  // 当有匹配时显示建议
  useEffect(() => {
    setShowSuggestions(filteredCommands.length > 0 && !!currentAtTrigger)
    setSelectedIndex(0)
  }, [filteredCommands, currentAtTrigger])

  // 处理键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSuggestions && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        } else if (e.key === 'Tab' || e.key === 'Enter') {
          if (filteredCommands.length > 0) {
            e.preventDefault()
            handleSelectCommand(filteredCommands[selectedIndex])
            return
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setShowSuggestions(false)
        }
      }

      // 发送消息
      if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
        e.preventDefault()
        onSend()
      }
    },
    [showSuggestions, filteredCommands, selectedIndex, onSend]
  )

  // 选择指令
  const handleSelectCommand = useCallback(
    (command: QuickCommand) => {
      if (!currentAtTrigger) return

      const beforeTrigger = value.slice(0, currentAtTrigger.startIndex)
      const afterTrigger = value.slice(currentAtTrigger.startIndex + currentAtTrigger.trigger.length)

      // 插入指令
      const newCommand = command.hasParameter ? `${command.trigger} ` : `${command.trigger} `
      const newValue = beforeTrigger + newCommand + afterTrigger

      onChange(newValue)
      setShowSuggestions(false)

      // 聚焦回输入框
      setTimeout(() => {
        textAreaRef.current?.focus()
      }, 0)
    },
    [currentAtTrigger, value, onChange]
  )

  // 解析已完成的指令
  useEffect(() => {
    const commands: QuickCommandResult[] = []

    // 匹配所有 @command 或 @command parameter 格式
    const regex = /@(\w+)(?:\s+([^\s@]+))?/g
    let match

    while ((match = regex.exec(value)) !== null) {
      const [, cmdName, param] = match
      const cmd = QUICK_COMMANDS.find((c) => c.trigger === `@${cmdName}`)
      if (cmd) {
        commands.push({
          command: cmd.trigger,
          parameter: param
        })
      }
    }

    setActiveCommands(commands)
  }, [value])

  // 移除指令
  const handleRemoveCommand = useCallback(
    (cmdToRemove: QuickCommandResult) => {
      const pattern = cmdToRemove.parameter
        ? new RegExp(`${cmdToRemove.command}\\s+${cmdToRemove.parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`)
        : new RegExp(`${cmdToRemove.command}\\s*`)

      onChange(value.replace(pattern, ''))
    },
    [value, onChange]
  )

  return (
    <InputWrapper>
      {/* 已激活的指令标签 */}
      {activeCommands.length > 0 && (
        <ActiveCommandsBar>
          {activeCommands.map((cmd, idx) => {
            const cmdDef = QUICK_COMMANDS.find((c) => c.trigger === cmd.command)
            return (
              <Tag
                key={`${cmd.command}-${idx}`}
                closable
                onClose={() => handleRemoveCommand(cmd)}
                icon={cmdDef?.icon}
                color="blue">
                {cmd.command}
                {cmd.parameter && <span style={{ opacity: 0.7 }}> {cmd.parameter}</span>}
              </Tag>
            )
          })}
        </ActiveCommandsBar>
      )}

      {/* 输入框 */}
      <Popover
        open={showSuggestions}
        placement="topLeft"
        arrow={false}
        overlayInnerStyle={{ padding: 0 }}
        content={
          <CommandSuggestionsPopup>
            {filteredCommands.map((cmd, idx) => (
              <CommandItem
                key={cmd.id}
                $active={idx === selectedIndex}
                onClick={() => handleSelectCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}>
                <CommandIcon>{cmd.icon}</CommandIcon>
                <CommandInfo>
                  <CommandLabel>{cmd.label}</CommandLabel>
                  <CommandDescription>{cmd.description}</CommandDescription>
                </CommandInfo>
              </CommandItem>
            ))}
          </CommandSuggestionsPopup>
        }>
        <StyledTextArea
          ref={textAreaRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          autoSize={{ minRows, maxRows }}
        />
      </Popover>
    </InputWrapper>
  )
}

export default QuickCommandInput
