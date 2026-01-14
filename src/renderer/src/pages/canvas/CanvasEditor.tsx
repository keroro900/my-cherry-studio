/**
 * Canvas 协同编辑器组件
 *
 * 基于 CodeMirror 6 的协同编辑器
 * 支持多语言语法高亮、实时同步、版本回溯
 */

import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { basicSetup, EditorView } from 'codemirror'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import type { CanvasEditorConfig, CanvasFile } from './types'
import { DEFAULT_EDITOR_CONFIG, getLanguageMode } from './types'

interface CanvasEditorProps {
  /** 当前文件 */
  file: CanvasFile | null
  /** 编辑器配置 */
  config?: Partial<CanvasEditorConfig>
  /** 内容变更回调 */
  onChange?: (content: string) => void
  /** 保存回调 */
  onSave?: (content: string) => void
  /** 是否只读 */
  readOnly?: boolean
  /** 自定义类名 */
  className?: string
}

// 语言扩展映射
const languageExtensions: Record<string, () => any> = {
  javascript: javascript,
  jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: python,
  html: html,
  htmlmixed: html,
  css: css,
  scss: css,
  less: css,
  json: json,
  markdown: markdown
}

// Compartments for dynamic configuration
const languageConf = new Compartment()
const themeConf = new Compartment()
const readOnlyConf = new Compartment()

/**
 * Canvas 编辑器组件
 */
const CanvasEditor: FC<CanvasEditorProps> = ({
  file,
  config: userConfig,
  onChange,
  onSave,
  readOnly = false,
  className
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isReady, setIsReady] = useState(false)

  // 合并配置
  const config: CanvasEditorConfig = {
    ...DEFAULT_EDITOR_CONFIG,
    ...userConfig
  }

  // 获取语言扩展
  const getLanguageExtension = useCallback((lang: string) => {
    const factory = languageExtensions[lang]
    if (factory) {
      return factory()
    }
    // 默认使用 JavaScript
    return javascript()
  }, [])

  // 初始化编辑器
  useEffect(() => {
    if (!editorRef.current) return

    const language = file ? getLanguageMode(file.path) : 'text'
    const languageExt = getLanguageExtension(language)

    const startState = EditorState.create({
      doc: file?.content || '',
      extensions: [
        basicSetup,
        keymap.of([...defaultKeymap, indentWithTab]),
        languageConf.of(languageExt),
        themeConf.of(config.theme === 'dark' || config.theme === 'material-darker' ? oneDark : []),
        readOnlyConf.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) {
            onChange(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: `${config.fontSize}px`
          },
          '.cm-scroller': {
            fontFamily: '"Fira Code", "JetBrains Mono", monospace'
          },
          '.cm-content': {
            padding: '10px 0'
          },
          '.cm-gutters': {
            backgroundColor: 'var(--color-background-soft)',
            borderRight: '1px solid var(--color-border)'
          }
        }),
        // 自动保存快捷键
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              if (onSave && viewRef.current) {
                onSave(viewRef.current.state.doc.toString())
              }
              return true
            }
          }
        ])
      ]
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    })

    viewRef.current = view
    setIsReady(true)

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // 只在挂载时初始化

  // 更新文件内容
  useEffect(() => {
    if (!viewRef.current || !file) return

    const currentContent = viewRef.current.state.doc.toString()
    if (currentContent !== file.content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: file.content
        }
      })
    }

    // 更新语言
    const language = getLanguageMode(file.path)
    const languageExt = getLanguageExtension(language)
    viewRef.current.dispatch({
      effects: languageConf.reconfigure(languageExt)
    })
  }, [file, getLanguageExtension])

  // 更新只读状态
  useEffect(() => {
    if (!viewRef.current) return

    viewRef.current.dispatch({
      effects: readOnlyConf.reconfigure(EditorState.readOnly.of(readOnly))
    })
  }, [readOnly])

  // 更新主题
  useEffect(() => {
    if (!viewRef.current) return

    const themeExt = config.theme === 'dark' || config.theme === 'material-darker' ? oneDark : []
    viewRef.current.dispatch({
      effects: themeConf.reconfigure(themeExt)
    })
  }, [config.theme])

  return (
    <EditorContainer className={className} ref={editorRef}>
      {!isReady && <LoadingPlaceholder>加载编辑器...</LoadingPlaceholder>}
    </EditorContainer>
  )
}

const EditorContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--color-background);

  .cm-editor {
    height: 100%;
  }

  .cm-focused {
    outline: none;
  }
`

const LoadingPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 14px;
`

export default CanvasEditor
