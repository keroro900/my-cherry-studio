/**
 * TerminalPanel - 终端面板组件 (增强版)
 *
 * 使用 TerminalService 提供持久终端会话：
 * - 会话管理由后端维护
 * - 流式输出实时显示
 * - 进程管理 (可终止运行中的命令)
 * - 命令历史
 * - 多终端标签
 */

import { CloseOutlined, PauseCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'

const logger = loggerService.withContext('TerminalPanel')

// ==================== 类型定义 ====================

interface TerminalTab {
  id: string // 本地 tab ID
  sessionId: string // 后端 session ID
  name: string
  cwd: string
  terminal: Terminal
  fitAddon: FitAddon
  history: string[]
  historyIndex: number
  isRunning: boolean
}

interface TerminalPanelProps {
  /** 初始工作目录 */
  initialCwd?: string
  /** 面板高度 */
  height?: string | number
}

// ==================== 组件实现 ====================

const TerminalPanel: FC<TerminalPanelProps> = ({ initialCwd, height = '100%' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const inputBufferRef = useRef<string>('')
  const defaultCwdRef = useRef<string>('')
  const cleanupRef = useRef<(() => void) | null>(null)

  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentCwd, setCurrentCwd] = useState(initialCwd || '')
  const [isInitialized, setIsInitialized] = useState(false)

  // 获取当前激活的 tab
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // 初始化 xterm 终端 UI
  const initTerminalUI = useCallback((container: HTMLElement): { terminal: Terminal; fitAddon: FitAddon } => {
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#d7ba7d',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff'
      },
      allowProposedApi: true,
      scrollback: 5000
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(container)

    // 延迟 fit 以确保容器已渲染
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (e) {
        logger.debug('Fit failed, will retry', { error: e })
      }
    }, 100)

    return { terminal, fitAddon }
  }, [])

  // 写入提示符
  const writePrompt = useCallback((terminal: Terminal, cwd: string) => {
    const shortCwd = cwd.split(/[/\\]/).pop() || cwd
    terminal.write(`\r\n\x1b[32m${shortCwd}\x1b[0m \x1b[33m❯\x1b[0m `)
  }, [])

  // 执行命令 (使用 TerminalService)
  const executeCommand = useCallback(
    async (tab: TerminalTab, command: string) => {
      if (!command.trim()) {
        writePrompt(tab.terminal, tab.cwd)
        return
      }

      // 添加到历史
      tab.history.push(command)
      tab.historyIndex = tab.history.length

      // 处理内置命令
      if (command.trim() === 'clear' || command.trim() === 'cls') {
        tab.terminal.clear()
        writePrompt(tab.terminal, tab.cwd)
        return
      }

      if (command.trim() === 'pwd') {
        tab.terminal.writeln(tab.cwd)
        writePrompt(tab.terminal, tab.cwd)
        return
      }

      // 标记为执行中
      setIsExecuting(true)
      setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, isRunning: true } : t)))

      try {
        // 订阅输出事件
        if (window.api?.terminal?.subscribe) {
          await window.api.terminal.subscribe(tab.sessionId)
        }

        // 执行命令
        if (window.api?.terminal?.executeCommand) {
          const result = await window.api.terminal.executeCommand(tab.sessionId, command)

          // 显示输出 (流式输出已通过事件处理，这里处理最终结果)
          if (result.output && !result.success) {
            // 只有失败时才显示汇总，成功时输出已通过流式事件显示
            tab.terminal.writeln(`\x1b[31m${result.output}\x1b[0m`)
          }

          if (result.exitCode !== null && result.exitCode !== 0) {
            tab.terminal.writeln(`\x1b[31mProcess exited with code ${result.exitCode}\x1b[0m`)
          }

          // 如果是 cd 命令，更新本地 cwd
          const cdMatch = command.match(/^cd\s+(.+)$/i)
          if (cdMatch && result.success) {
            const newCwd = await window.api.terminal.getCwd(tab.sessionId)
            if (newCwd.success && newCwd.cwd) {
              tab.cwd = newCwd.cwd
              setCurrentCwd(newCwd.cwd)
            }
          }
        } else if (window.api?.shell?.execute) {
          // 回退到旧 API
          const result = await window.api.shell.execute(command, {
            cwd: tab.cwd,
            timeout: 120000
          })

          if (result.stdout) {
            result.stdout.split('\n').forEach((line) => tab.terminal.writeln(line))
          }
          if (result.stderr) {
            result.stderr.split('\n').forEach((line) => tab.terminal.writeln(`\x1b[31m${line}\x1b[0m`))
          }
          if (!result.success) {
            tab.terminal.writeln(`\x1b[31mProcess exited with code ${result.exitCode}\x1b[0m`)
          }
        } else {
          tab.terminal.writeln('\x1b[31mTerminal API not available\x1b[0m')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        tab.terminal.writeln(`\x1b[31mError: ${errorMessage}\x1b[0m`)
        logger.error('Command execution failed', { command, error })
      }

      setIsExecuting(false)
      setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, isRunning: false } : t)))
      writePrompt(tab.terminal, tab.cwd)
    },
    [writePrompt]
  )

  // 终止进程
  const killProcess = useCallback(async (tab: TerminalTab) => {
    if (!tab.isRunning) return

    try {
      if (window.api?.terminal?.killProcess) {
        await window.api.terminal.killProcess(tab.sessionId)
        tab.terminal.writeln('\r\n\x1b[33m^C Process terminated\x1b[0m')
      }
    } catch (error) {
      logger.error('Failed to kill process', { error })
    }
  }, [])

  // 创建新终端 tab
  const createTab = useCallback(
    async (cwd?: string) => {
      if (!terminalContainerRef.current) return

      const tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const sessionCwd = cwd || currentCwd || defaultCwdRef.current || '.'

      // 清除之前的终端 UI
      if (terminalContainerRef.current.firstChild) {
        terminalContainerRef.current.innerHTML = ''
      }

      // 创建后端会话
      let sessionId = tabId // 默认使用本地 ID
      if (window.api?.terminal?.createSession) {
        try {
          const result = await window.api.terminal.createSession(sessionCwd)
          if (result.success && result.session) {
            sessionId = result.session.id
          }
        } catch (error) {
          logger.warn('Failed to create backend session, using local mode', { error })
        }
      }

      const { terminal, fitAddon } = initTerminalUI(terminalContainerRef.current)

      const tab: TerminalTab = {
        id: tabId,
        sessionId,
        name: `Terminal ${tabs.length + 1}`,
        cwd: sessionCwd,
        terminal,
        fitAddon,
        history: [],
        historyIndex: 0,
        isRunning: false
      }

      // 写入欢迎信息
      terminal.writeln('')
      terminal.writeln('\x1b[1;36m  Cherry Studio Terminal\x1b[0m')
      terminal.writeln('\x1b[90m  Type commands below. Use "clear" to clear screen.\x1b[0m')
      terminal.writeln('')
      writePrompt(terminal, sessionCwd)

      // 处理输入
      terminal.onData((data) => {
        if (tab.isRunning && data !== '\x03') {
          // 只允许 Ctrl+C 中断
          return
        }

        switch (data) {
          case '\r': // Enter
            terminal.write('\r\n')
            const command = inputBufferRef.current
            inputBufferRef.current = ''
            executeCommand(tab, command)
            break

          case '\x7f': // Backspace
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1)
              terminal.write('\b \b')
            }
            break

          case '\x1b[A': // Up arrow - history
            if (tab.historyIndex > 0) {
              tab.historyIndex--
              const historyCmd = tab.history[tab.historyIndex]
              while (inputBufferRef.current.length > 0) {
                terminal.write('\b \b')
                inputBufferRef.current = inputBufferRef.current.slice(0, -1)
              }
              terminal.write(historyCmd)
              inputBufferRef.current = historyCmd
            }
            break

          case '\x1b[B': // Down arrow - history
            if (tab.historyIndex < tab.history.length - 1) {
              tab.historyIndex++
              const historyCmd = tab.history[tab.historyIndex]
              while (inputBufferRef.current.length > 0) {
                terminal.write('\b \b')
                inputBufferRef.current = inputBufferRef.current.slice(0, -1)
              }
              terminal.write(historyCmd)
              inputBufferRef.current = historyCmd
            } else if (tab.historyIndex === tab.history.length - 1) {
              tab.historyIndex = tab.history.length
              while (inputBufferRef.current.length > 0) {
                terminal.write('\b \b')
                inputBufferRef.current = inputBufferRef.current.slice(0, -1)
              }
            }
            break

          case '\x03': // Ctrl+C
            if (tab.isRunning) {
              killProcess(tab)
            } else {
              terminal.write('^C')
              inputBufferRef.current = ''
              writePrompt(terminal, tab.cwd)
            }
            break

          case '\x0c': // Ctrl+L - clear
            terminal.clear()
            writePrompt(terminal, tab.cwd)
            break

          default:
            if (data >= ' ' || data === '\t') {
              inputBufferRef.current += data
              terminal.write(data)
            }
        }
      })

      setTabs((prev) => [...prev, tab])
      setActiveTabId(tabId)
      setCurrentCwd(sessionCwd)

      logger.info('Terminal tab created', { tabId, sessionId, cwd: sessionCwd })
    },
    [currentCwd, tabs.length, initTerminalUI, writePrompt, executeCommand, killProcess]
  )

  // 关闭 tab
  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return

      // 关闭后端会话
      if (window.api?.terminal?.closeSession) {
        try {
          await window.api.terminal.closeSession(tab.sessionId)
        } catch (error) {
          logger.warn('Failed to close backend session', { error })
        }
      }

      tab.terminal.dispose()

      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId)

        if (activeTabId === tabId && newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id)
        } else if (newTabs.length === 0) {
          setActiveTabId(null)
        }

        return newTabs
      })
    },
    [tabs, activeTabId]
  )

  // 切换 tab
  const switchTab = useCallback(
    (tabId: string) => {
      if (!terminalContainerRef.current) return

      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return

      terminalContainerRef.current.innerHTML = ''
      tab.terminal.open(terminalContainerRef.current)

      setTimeout(() => {
        tab.fitAddon.fit()
      }, 50)

      setActiveTabId(tabId)
      setCurrentCwd(tab.cwd)
    },
    [tabs]
  )

  // 设置流式输出监听
  useEffect(() => {
    if (!window.api?.terminal?.onOutput) return

    const cleanup = window.api.terminal.onOutput((output) => {
      // 找到对应的 tab
      const tab = tabs.find((t) => t.sessionId === output.sessionId)
      if (!tab) return

      switch (output.type) {
        case 'stdout':
          tab.terminal.write(output.data)
          break
        case 'stderr':
          tab.terminal.write(`\x1b[31m${output.data}\x1b[0m`)
          break
        case 'exit':
          // 退出事件由 executeCommand 处理
          break
        case 'error':
          tab.terminal.writeln(`\x1b[31mError: ${output.data}\x1b[0m`)
          break
      }
    })

    cleanupRef.current = cleanup

    return () => {
      cleanup()
    }
  }, [tabs])

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (activeTab) {
        try {
          activeTab.fitAddon.fit()
        } catch (_e) {
          // 忽略 fit 错误
        }
      }
    }

    window.addEventListener('resize', handleResize)

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [activeTab])

  // 初始化默认工作目录
  useEffect(() => {
    const initDefaultCwd = async () => {
      if (initialCwd) {
        defaultCwdRef.current = initialCwd
      } else if (window.api?.system?.getPath) {
        try {
          const homePath = await window.api.system.getPath('home')
          defaultCwdRef.current = homePath || '.'
        } catch (e) {
          logger.debug('Failed to get home path', { error: e })
          defaultCwdRef.current = '.'
        }
      } else {
        defaultCwdRef.current = '.'
      }
      setIsInitialized(true)
    }
    initDefaultCwd()
  }, [initialCwd])

  // 初始化时创建第一个 tab
  useEffect(() => {
    if (isInitialized && tabs.length === 0 && terminalContainerRef.current) {
      createTab(initialCwd)
    }
  }, [isInitialized, tabs.length, initialCwd, createTab])

  // 清理
  useEffect(() => {
    return () => {
      // 清理输出监听
      if (cleanupRef.current) {
        cleanupRef.current()
      }

      // 关闭所有会话
      tabs.forEach(async (tab) => {
        tab.terminal.dispose()
        if (window.api?.terminal?.closeSession) {
          try {
            await window.api.terminal.closeSession(tab.sessionId)
          } catch (_e) {
            // 忽略关闭错误
          }
        }
      })
    }
  }, [])

  return (
    <Container ref={containerRef} style={{ height }}>
      {/* 标签栏 */}
      <TabBar>
        <TabList>
          {tabs.map((tab) => (
            <Tab key={tab.id} $active={tab.id === activeTabId} onClick={() => switchTab(tab.id)}>
              <TabName>
                {tab.isRunning && <RunningIndicator />}
                {tab.name}
              </TabName>
              <TabClose
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}>
                <CloseOutlined />
              </TabClose>
            </Tab>
          ))}
        </TabList>

        <TabActions>
          <Tooltip title="新建终端">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => createTab()} />
          </Tooltip>
          {activeTab?.isRunning && (
            <Tooltip title="终止进程">
              <Button
                type="text"
                size="small"
                danger
                icon={<PauseCircleOutlined />}
                onClick={() => activeTab && killProcess(activeTab)}
              />
            </Tooltip>
          )}
          <Tooltip title="清屏">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                if (activeTab) {
                  activeTab.terminal.clear()
                  writePrompt(activeTab.terminal, activeTab.cwd)
                }
              }}
            />
          </Tooltip>
        </TabActions>
      </TabBar>

      {/* 终端区域 */}
      <TerminalArea ref={terminalContainerRef} />

      {/* 状态栏 */}
      <StatusBar>
        <StatusItem>
          {isExecuting ? (
            <span style={{ color: '#ffcc00' }}>
              <RunningIndicator /> 执行中...
            </span>
          ) : (
            <span>就绪</span>
          )}
        </StatusItem>
        <StatusItem>
          <span title={currentCwd}>{currentCwd.split(/[/\\]/).pop() || currentCwd}</span>
        </StatusItem>
      </StatusBar>
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 150px;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
`

const TabBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
`

const TabList = styled.div`
  display: flex;
  flex: 1;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: #555;
  }
`

const Tab = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 100%;
  cursor: pointer;
  background: ${(props) => (props.$active ? '#1e1e1e' : 'transparent')};
  border-right: 1px solid #3c3c3c;
  color: ${(props) => (props.$active ? '#fff' : '#999')};
  font-size: 12px;
  white-space: nowrap;

  &:hover {
    background: ${(props) => (props.$active ? '#1e1e1e' : '#2a2a2a')};
  }
`

const TabName = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
`

const RunningIndicator = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffcc00;
  animation: pulse 1s infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`

const TabClose = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }
`

const TabActions = styled.div`
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 4px;

  .ant-btn {
    color: #999;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }
  }
`

const TerminalArea = styled.div`
  flex: 1;
  padding: 8px;
  overflow: hidden;

  .xterm {
    height: 100%;
  }

  .xterm-viewport {
    overflow-y: auto !important;
  }
`

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 12px;
  background: #007acc;
  color: #fff;
  font-size: 11px;
  flex-shrink: 0;
`

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export default TerminalPanel
