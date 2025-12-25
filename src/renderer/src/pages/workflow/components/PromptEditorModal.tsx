/**
 * 节点系统提示词编辑模态框
 *
 * 功能：
 * - 融合助手功能和工作流需求，提供统一的提示词编辑体验
 * - 支持多步骤节点，每个步骤有独立的系统提示词
 * - 预览/编辑模式切换（类似助手功能）
 * - Token 计数显示
 * - 支持恢复默认提示词
 */

import { ExpandOutlined, EyeOutlined, PlusCircleOutlined, ReloadOutlined, TranslationOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import type { CodeEditorHandles } from '@renderer/components/CodeEditor'
import CodeEditor from '@renderer/components/CodeEditor'
import { estimateTextTokens } from '@renderer/services/TokenService'
import { translateText } from '@renderer/services/TranslateService'
import type { MenuProps } from 'antd'
import { Button, Dropdown, message, Tabs, Tooltip } from 'antd'
import { Edit, Save } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styled from 'styled-components'

import StandardModal from './StandardModal'

const logger = loggerService.withContext('PromptEditorModal')

/**
 * 单个提示词步骤配置
 */
export interface PromptStep {
  /** 步骤唯一标识 */
  id: string
  /** 步骤显示名称 */
  label: string
  /** 当前提示词内容 */
  prompt: string
  /** 默认提示词（用于恢复） */
  defaultPrompt: string
  /** 提示词描述说明 */
  description?: string
}

export interface PromptVariable {
  key: string
  label: string
  description?: string
}

/**
 * 组件 Props
 */
interface PromptEditorModalProps {
  /** 是否打开 */
  open: boolean
  /** 模态框标题 */
  title: string
  /** 提示词步骤列表（支持多步骤） */
  steps: PromptStep[]
  /** 预览附加内容 (e.g. Visual Anchors, Constraints) */
  previewAddons?: Record<string, string>
  /** 可用变量列表 */
  availableVariables?: PromptVariable[]
  /** 关闭回调 */
  onClose: () => void
  /** 保存回调 */
  onSave: (steps: PromptStep[]) => void
}

// 样式组件 - 使用 Cherry 的 CSS 变量
const EditorContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-soft);
`

const ContentArea = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  margin: 12px 16px;
  background-color: var(--color-bg);
  overflow: hidden;

  /* 使用 absolute positioning 确保子元素正确填充 */
  > * {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  /* CodeMirror 编辑器滚动配置 */
  .cm-editor {
    height: 100% !important;
  }

  .cm-scroller {
    overflow: auto !important;
  }
`

const MarkdownPreview = styled.div.attrs({ className: 'markdown' })`
  height: 100%;
  padding: 16px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.7;
  cursor: text;
  color: var(--color-text);

  &:hover {
    background-color: var(--color-bg-soft);
  }

  pre {
    background-color: var(--color-bg-soft);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }

  code {
    font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
  }

  p {
    margin: 0.5em 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 1em 0 0.5em;
    font-weight: 600;
    color: var(--color-text);
  }

  ul,
  ol {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  strong {
    font-weight: 600;
    color: var(--color-text);
  }
`

const StepHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--color-text-2);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
`

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
`

const TokenCount = styled.div`
  font-size: 13px;
  color: var(--color-text-3);
  user-select: none;
`

const StyledTabs = styled(Tabs)`
  height: 100%;
  background-color: var(--color-bg-soft);

  .ant-tabs-nav {
    margin: 0;
    background: var(--color-bg);

    &::before {
      border-color: var(--color-border);
    }
  }

  .ant-tabs-tab {
    padding: 12px 16px;
    color: var(--color-text-2);
    transition: all 0.2s;

    &:hover {
      color: var(--color-text);
    }
  }

  .ant-tabs-tab-active {
    .ant-tabs-tab-btn {
      color: var(--color-primary);
    }
  }

  .ant-tabs-ink-bar {
    background: var(--color-primary);
  }

  .ant-tabs-content-holder {
    overflow: hidden;
    border-left: 1px solid var(--color-border);
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
  }
`

const EmptyHint = styled.div`
  color: var(--color-text-3);
  font-style: italic;
`

/**
 * 节点系统提示词编辑模态框
 */
const PromptEditorModal: FC<PromptEditorModalProps> = ({
  open,
  title,
  steps: initialSteps,
  previewAddons = {},
  availableVariables = [],
  onClose,
  onSave
}) => {
  // 编辑中的步骤状态
  const [editingSteps, setEditingSteps] = useState<PromptStep[]>([])
  // 当前选中的步骤
  const [activeStepId, setActiveStepId] = useState<string>('')
  // 是否全屏
  const [fullscreen, setFullscreen] = useState(false)
  // 预览模式（类似助手功能）
  const [showPreview, setShowPreview] = useState(true)
  // 翻译 Loading
  const [isTranslating, setIsTranslating] = useState(false)
  // Token 计数
  const [tokenCount, setTokenCount] = useState(0)

  // 编辑器引用
  const editorRef = useRef<CodeEditorHandles>(null)

  // 是否显示完整提示词（包含所有步骤和附加内容）
  const [showFullPrompt, setShowFullPrompt] = useState(false)

  // 生成完整提示词预览
  const fullPromptContent = useMemo(() => {
    const parts: string[] = []

    // 添加所有步骤的提示词
    editingSteps.forEach((step) => {
      if (step.prompt) {
        parts.push(`### ${step.label}\n\n${step.prompt}`)
      }
    })

    // 添加附加内容
    Object.entries(previewAddons).forEach(([key, value]) => {
      if (value) {
        parts.push(`### ${key}\n\n${value}`)
      }
    })

    return parts.join('\n\n---\n\n')
  }, [editingSteps, previewAddons])

  // 初始化编辑状态
  useEffect(() => {
    if (open && initialSteps.length > 0) {
      setEditingSteps([...initialSteps])
      setActiveStepId(initialSteps[0].id)
      setShowPreview(true)
    }
  }, [open, initialSteps])

  // 更新 Token 计数
  useEffect(() => {
    const updateTokenCount = async () => {
      const currentStep = editingSteps.find((s) => s.id === activeStepId)
      if (currentStep?.prompt) {
        const count = await estimateTextTokens(currentStep.prompt)
        setTokenCount(count)
      } else {
        setTokenCount(0)
      }
    }
    updateTokenCount()
  }, [activeStepId, editingSteps])

  // 更新单个步骤的提示词
  const handlePromptChange = useCallback((stepId: string, newPrompt: string) => {
    setEditingSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, prompt: newPrompt } : step)))
  }, [])

  // 恢复单个步骤的默认提示词
  const handleResetStep = useCallback((stepId: string) => {
    setEditingSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, prompt: step.defaultPrompt } : step)))
    message.success('已恢复默认提示词')
  }, [])

  // 恢复所有步骤的默认提示词
  const handleResetAll = useCallback(() => {
    setEditingSteps((prev) => prev.map((step) => ({ ...step, prompt: step.defaultPrompt })))
    message.success('已恢复所有默认提示词')
  }, [])

  // 保存
  const handleSave = useCallback(() => {
    onSave(editingSteps)
    message.success('提示词配置已保存')
    setShowPreview(true)
  }, [editingSteps, onSave])

  // 保存并关闭
  const handleSaveAndClose = useCallback(() => {
    onSave(editingSteps)
    message.success('提示词配置已保存')
    onClose()
  }, [editingSteps, onSave, onClose])

  // 取消编辑
  const handleCancel = useCallback(() => {
    setEditingSteps([...initialSteps])
    onClose()
  }, [initialSteps, onClose])

  // 翻译功能
  const handleTranslate = useCallback(
    async (targetLang: 'en' | 'zh') => {
      const currentStep = editingSteps.find((s) => s.id === activeStepId)
      if (!currentStep || !currentStep.prompt) {
        message.warning('当前没有可翻译的内容')
        return
      }

      setIsTranslating(true)
      const hide = message.loading('正在翻译...', 0)

      try {
        let result = ''
        await translateText(
          currentStep.prompt,
          {
            label: () => (targetLang === 'en' ? 'English' : 'Chinese'),
            value: targetLang === 'en' ? 'English' : 'Chinese',
            langCode: targetLang,
            emoji: targetLang === 'en' ? '🇺🇸' : '🇨🇳'
          },
          (text) => {
            result = text
            return result
          }
        )

        handlePromptChange(activeStepId, result)
        message.success('翻译完成')
      } catch (error) {
        message.error('翻译失败，请检查网络或配置')
        logger.error('Translation failed:', error as Error)
      } finally {
        hide()
        setIsTranslating(false)
      }
    },
    [activeStepId, editingSteps, handlePromptChange]
  )

  // 获取当前选中的步骤
  const currentStep = editingSteps.find((s) => s.id === activeStepId)

  // 检查是否有修改
  const hasChanges = editingSteps.some((step, index) => step.prompt !== initialSteps[index]?.prompt)

  // 翻译菜单
  const translateMenu = {
    items: [
      { key: 'en', label: '翻译为英文 (推荐)', onClick: () => handleTranslate('en') },
      { key: 'zh', label: '翻译为中文', onClick: () => handleTranslate('zh') }
    ]
  }

  // 插入变量
  const handleInsertVariable = useCallback((variable: string) => {
    editorRef.current?.insertText?.(variable)
  }, [])

  // 变量菜单
  const variableMenu: MenuProps = {
    items:
      availableVariables.length > 0
        ? availableVariables.map((v) => ({
            key: v.key,
            label: (
              <Tooltip title={v.description} placement="left">
                <span>{v.label}</span>
              </Tooltip>
            ),
            onClick: () => handleInsertVariable(`{{${v.key}}}`)
          }))
        : [
            { key: 'input', label: '用户输入 {{input}}', onClick: () => handleInsertVariable('{{input}}') },
            { key: 'image', label: '输入图片 {{image}}', onClick: () => handleInsertVariable('{{image}}') }
          ]
  }

  // 渲染单个步骤的内容区域 - 使用当前编辑状态中的步骤数据
  const renderStepContent = (stepId: string) => {
    // 始终从 editingSteps 获取最新数据
    const step = editingSteps.find((s) => s.id === stepId)
    if (!step) return null

    return (
      <EditorContainer>
        <StepHeader>
          <span>{step.description || `编辑 ${step.label}`}</span>
          <Tooltip title="恢复此步骤的默认提示词">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleResetStep(step.id)}
              disabled={step.prompt === step.defaultPrompt}>
              恢复默认
            </Button>
          </Tooltip>
        </StepHeader>

        <ContentArea>
          {showPreview ? (
            <MarkdownPreview onDoubleClick={() => setShowPreview(false)}>
              {step.prompt ? (
                <ReactMarkdown>{step.prompt}</ReactMarkdown>
              ) : (
                <EmptyHint>暂无内容，双击进入编辑模式</EmptyHint>
              )}
            </MarkdownPreview>
          ) : (
            <CodeEditor
              ref={step.id === activeStepId ? editorRef : undefined}
              value={step.prompt}
              onChange={(value) => handlePromptChange(step.id, value || '')}
              language="markdown"
              height="100%"
              expanded={false}
              options={{ lineNumbers: true }}
            />
          )}
        </ContentArea>

        <ActionBar>
          <TokenCount>Tokens: {step.id === activeStepId ? tokenCount : '—'}</TokenCount>
          <Button
            type="primary"
            icon={showPreview ? <Edit size={14} /> : <Save size={14} />}
            onClick={() => {
              if (showPreview) {
                setShowPreview(false)
              } else {
                handleSave()
              }
            }}>
            {showPreview ? '编辑' : '保存'}
          </Button>
        </ActionBar>
      </EditorContainer>
    )
  }

  return (
    <StandardModal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{title}</span>
          <Tooltip title={fullscreen ? '退出全屏' : '全屏编辑'}>
            <Button type="text" size="small" icon={<ExpandOutlined />} onClick={() => setFullscreen(!fullscreen)} />
          </Tooltip>
          <Tooltip title={showFullPrompt ? '返回编辑' : '查看完整提示词'}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setShowFullPrompt(!showFullPrompt)}
              style={{ color: showFullPrompt ? 'var(--color-primary)' : undefined }}
            />
          </Tooltip>
          <Dropdown menu={variableMenu} disabled={showPreview || showFullPrompt}>
            <Tooltip title={showPreview || showFullPrompt ? '进入编辑模式后可插入变量' : '快速插入变量'}>
              <Button
                type="text"
                size="small"
                icon={<PlusCircleOutlined />}
                style={{ opacity: showPreview || showFullPrompt ? 0.5 : 1 }}
              />
            </Tooltip>
          </Dropdown>
          <Dropdown menu={translateMenu} disabled={isTranslating || showPreview || showFullPrompt}>
            <Tooltip title={showPreview || showFullPrompt ? '进入编辑模式后可翻译' : '翻译当前提示词'}>
              <Button
                type="text"
                size="small"
                icon={<TranslationOutlined />}
                loading={isTranslating}
                style={{ opacity: showPreview || showFullPrompt ? 0.5 : 1 }}
              />
            </Tooltip>
          </Dropdown>
        </div>
      }
      width={fullscreen ? '100vw' : 900}
      style={fullscreen ? { top: 0, padding: 0, maxWidth: '100vw' } : undefined}
      styles={{
        body: {
          height: fullscreen ? 'calc(100vh - 110px)' : 500,
          padding: 0,
          overflow: 'hidden'
        }
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button icon={<ReloadOutlined />} onClick={handleResetAll} disabled={!hasChanges}>
            恢复全部默认
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleSaveAndClose}>
              保存并关闭
            </Button>
          </div>
        </div>
      }
      onCancel={handleCancel}>
      {showFullPrompt ? (
        // 完整提示词预览模式
        <EditorContainer>
          <StepHeader>
            <span>完整提示词预览（只读）</span>
            <Button type="text" size="small" onClick={() => setShowFullPrompt(false)}>
              返回编辑
            </Button>
          </StepHeader>
          <ContentArea>
            <MarkdownPreview>
              {fullPromptContent ? (
                <ReactMarkdown>{fullPromptContent}</ReactMarkdown>
              ) : (
                <EmptyHint>暂无提示词内容</EmptyHint>
              )}
            </MarkdownPreview>
          </ContentArea>
          <ActionBar>
            <TokenCount>
              Total Tokens: ~{editingSteps.reduce((sum, s) => sum + (s.prompt?.length || 0), 0) / 4}
            </TokenCount>
            <Button type="primary" onClick={() => setShowFullPrompt(false)}>
              返回编辑
            </Button>
          </ActionBar>
        </EditorContainer>
      ) : editingSteps.length === 1 ? (
        // 单步骤模式
        currentStep && renderStepContent(currentStep.id)
      ) : (
        // 多步骤模式：使用 Tabs 切换
        <StyledTabs
          activeKey={activeStepId}
          onChange={setActiveStepId}
          tabPosition="left"
          destroyInactiveTabPane // 确保切换标签时内容重新渲染
          items={editingSteps.map((step) => ({
            key: step.id,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{step.label}</span>
                {step.prompt !== step.defaultPrompt && (
                  <span style={{ color: 'var(--color-primary)', fontSize: 10 }}>●</span>
                )}
              </div>
            ),
            children: renderStepContent(step.id)
          }))}
        />
      )}
    </StandardModal>
  )
}

export default PromptEditorModal
