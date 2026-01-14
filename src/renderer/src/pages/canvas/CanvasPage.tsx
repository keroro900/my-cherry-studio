/**
 * Canvas 页面组件 (IDE 模式)
 *
 * 协同编辑页面，使用 react-resizable-panels 实现 IDE 风格布局：
 * - 左侧：文件浏览器
 * - 中间：编辑器区域 + 底部面板
 * - 右侧：Agent 面板
 */

import {
  DiffOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  RobotOutlined,
  SaveOutlined,
  SettingOutlined,
  SplitCellsOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Drawer, Empty, Flex, message, Modal, Timeline, Typography } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectCollabPanelMode,
  selectViewMode,
  selectCurrentFilePath,
  selectCrewSession,
  selectPendingChangesCount,
  selectShowPendingChangesPreview,
  selectIDEPanel,
  selectActiveEditorTab,
  setCollabPanelMode,
  setViewMode,
  setCurrentFilePath,
  setShowPendingChangesPreview,
  setRightPanelVisible,
  updateCrewSession,
  addEditorTab,
  updateEditorTabDirty,
  type CollabPanelMode,
  type ViewMode
} from '@renderer/store/canvas'

import CanvasEditor from './CanvasEditor'
import CanvasPreview from './CanvasPreview'
import { EditorTabs, FileExplorer, IDELayout, PendingChangesPreview, TerminalPanel } from './components'
import DiffViewer from './DiffViewer'
import MultiModelCodeCrewPanel from './MultiModelCodeCrewPanel'
import type { CanvasEditorConfig, CanvasFile, CanvasSyncState, CanvasVersion } from './types'
import { DEFAULT_EDITOR_CONFIG, DEFAULT_SYNC_STATE } from './types'

const { Text } = Typography

const logger = loggerService.withContext('CanvasPage')

/**
 * Canvas 页面 (IDE 模式)
 */
const CanvasPage: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // Redux 状态 (持久化)
  const collabPanelMode = useAppSelector(selectCollabPanelMode)
  const viewMode = useAppSelector(selectViewMode)
  const savedFilePath = useAppSelector(selectCurrentFilePath)
  const crewSession = useAppSelector(selectCrewSession)
  const pendingChangesCount = useAppSelector(selectPendingChangesCount)
  const showPendingChangesPreview = useAppSelector(selectShowPendingChangesPreview)
  const idePanel = useAppSelector(selectIDEPanel)
  const activeTab = useAppSelector(selectActiveEditorTab)

  // 本地状态 (非持久化)
  const [currentFile, setCurrentFile] = useState<CanvasFile | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [config] = useState<CanvasEditorConfig>(DEFAULT_EDITOR_CONFIG)
  const [syncState] = useState<CanvasSyncState>(DEFAULT_SYNC_STATE)
  const [fileExplorerRefreshKey, setFileExplorerRefreshKey] = useState(0)

  // 版本历史状态
  const [versionDrawerVisible, setVersionDrawerVisible] = useState(false)
  const [versions, setVersions] = useState<CanvasVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [diffViewerVisible, setDiffViewerVisible] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<CanvasVersion | null>(null)

  // 编辑器设置状态
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false)

  // 协同运行状态派生自 Redux
  const isCrewRunning = crewSession.isRunning

  // 加载文件内容
  const loadFile = useCallback(
    async (path: string) => {
      try {
        if (!window.api?.canvas) return
        const result = await window.api.canvas.loadFile(path)
        if (result?.success) {
          const file = result.data as CanvasFile
          setCurrentFile(file)
          setIsDirty(false)
          dispatch(setCurrentFilePath(path))
          // 添加到标签页
          dispatch(
            addEditorTab({
              filePath: path,
              fileName: file.name,
              isDirty: false
            })
          )
        }
      } catch (error) {
        logger.error('Failed to load file:', error instanceof Error ? error : new Error(String(error)))
        message.error('加载文件失败')
      }
    },
    [dispatch]
  )

  // 保存文件
  const saveFile = useCallback(
    async (content: string) => {
      if (!currentFile) return

      try {
        if (!window.api?.canvas) return
        const result = await window.api.canvas.saveFile({
          path: currentFile.path,
          content
        })
        if (result?.success) {
          setIsDirty(false)
          if (activeTab) {
            dispatch(updateEditorTabDirty({ id: activeTab.id, isDirty: false }))
          }
          message.success('保存成功')
        }
      } catch (error) {
        logger.error('Failed to save file:', error instanceof Error ? error : new Error(String(error)))
        message.error('保存失败')
      }
    },
    [currentFile, activeTab, dispatch]
  )

  // 内容变更处理
  const handleContentChange = useCallback(
    (content: string) => {
      setIsDirty(true)
      if (activeTab) {
        dispatch(updateEditorTabDirty({ id: activeTab.id, isDirty: true }))
      }
      if (currentFile) {
        setCurrentFile({ ...currentFile, content })
      }
    },
    [currentFile, activeTab, dispatch]
  )

  // 加载版本历史
  const loadVersionHistory = useCallback(async () => {
    if (!currentFile) return

    setLoadingVersions(true)
    try {
      if (!window.api?.canvas) {
        message.warning(t('canvas.apiNotReady', 'Canvas 功能未就绪'))
        return
      }
      const result = await window.api.canvas.getVersions(currentFile.path)
      if (result?.success && result.data) {
        setVersions(result.data as CanvasVersion[])
      }
    } catch (error) {
      logger.error('Failed to load versions:', error instanceof Error ? error : new Error(String(error)))
      message.error(t('canvas.loadVersionsFailed', '加载版本历史失败'))
    } finally {
      setLoadingVersions(false)
    }
  }, [currentFile, t])

  // 打开版本历史
  const handleOpenVersionHistory = useCallback(() => {
    if (!currentFile) {
      message.warning(t('canvas.selectFileFirst', '请先选择一个文件'))
      return
    }
    setVersionDrawerVisible(true)
    loadVersionHistory()
  }, [currentFile, loadVersionHistory, t])

  // 查看版本差异
  const handleViewDiff = useCallback((version: CanvasVersion) => {
    setSelectedVersion(version)
    setDiffViewerVisible(true)
  }, [])

  // 恢复版本
  const handleRestoreVersion = useCallback(
    async (version: CanvasVersion) => {
      if (!window.api?.canvas) return

      Modal.confirm({
        title: t('canvas.confirmRestore', '确认恢复'),
        content: t('canvas.restoreWarning', '恢复到此版本将覆盖当前内容，确定要继续吗？'),
        okText: t('common.confirm', '确定'),
        cancelText: t('common.cancel', '取消'),
        onOk: async () => {
          try {
            const result = await window.api.canvas.restoreVersion({
              path: version.filePath,
              version: parseInt(version.id)
            })
            if (result?.success) {
              message.success(t('canvas.restoreSuccess', '恢复成功'))
              if (currentFile) {
                await loadFile(currentFile.path)
              }
              setVersionDrawerVisible(false)
            }
          } catch (error) {
            logger.error('Failed to restore version:', error instanceof Error ? error : new Error(String(error)))
            message.error(t('canvas.restoreFailed', '恢复失败'))
          }
        }
      })
    },
    [currentFile, loadFile, t]
  )

  // 格式化时间
  const formatTime = useCallback((date: Date) => {
    const d = new Date(date)
    return d.toLocaleString()
  }, [])

  // 切换视图模式
  const handleToggleViewMode = useCallback(() => {
    const nextMode: ViewMode = viewMode === 'editor' ? 'preview' : viewMode === 'preview' ? 'split' : 'editor'
    dispatch(setViewMode(nextMode))
  }, [dispatch, viewMode])

  // 处理协同运行状态变更
  const handleCrewRunningChange = useCallback(
    (isRunning: boolean) => {
      dispatch(updateCrewSession({ isRunning }))
    },
    [dispatch]
  )

  // 处理协同面板切换
  const handleToggleCollabPanel = useCallback(
    (targetMode: CollabPanelMode) => {
      const newMode = collabPanelMode === targetMode ? 'none' : targetMode
      dispatch(setCollabPanelMode(newMode))
      // 激活协同面板时，自动显示右侧面板
      if (newMode !== 'none' && !idePanel.rightPanelVisible) {
        dispatch(setRightPanelVisible(true))
      }
    },
    [dispatch, collabPanelMode, idePanel.rightPanelVisible]
  )

  // 处理待处理变更预览切换
  const handleTogglePendingChanges = useCallback(() => {
    dispatch(setShowPendingChangesPreview(!showPendingChangesPreview))
  }, [dispatch, showPendingChangesPreview])

  // 恢复保存的文件
  useEffect(() => {
    if (savedFilePath && !currentFile) {
      loadFile(savedFilePath)
    }
  }, [savedFilePath, currentFile, loadFile])

  // 自动保存
  useEffect(() => {
    if (!config.autoSave || !isDirty || !currentFile) return

    const timer = setTimeout(() => {
      saveFile(currentFile.content)
    }, config.autoSaveInterval)

    return () => clearTimeout(timer)
  }, [config.autoSave, config.autoSaveInterval, isDirty, currentFile, saveFile])

  // 渲染编辑器区域
  const renderEditorArea = () => (
    <EditorAreaContainer>
      {/* 编辑器标签栏 */}
      <EditorTabs onTabClick={(tab) => loadFile(tab.filePath)} />

      {/* 工具栏 */}
      <Toolbar>
        <Flex align="center" gap={8}>
          {currentFile && (
            <>
              <Text>{currentFile.name}</Text>
              {isDirty && <Text type="secondary">(未保存)</Text>}
            </>
          )}
        </Flex>

        <Flex align="center" gap={4}>
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={() => currentFile && saveFile(currentFile.content)}
            disabled={!isDirty}
            title="保存 (Ctrl+S)"
          />
          <Button
            type={viewMode === 'preview' ? 'primary' : 'text'}
            icon={
              viewMode === 'editor' ? (
                <EyeOutlined />
              ) : viewMode === 'preview' ? (
                <EyeInvisibleOutlined />
              ) : (
                <SplitCellsOutlined />
              )
            }
            title={
              viewMode === 'editor'
                ? t('canvas.showPreview', '显示预览')
                : viewMode === 'preview'
                  ? t('canvas.splitView', '分屏视图')
                  : t('canvas.hidePreview', '隐藏预览')
            }
            onClick={handleToggleViewMode}
            disabled={!currentFile}
          />
          <Button
            type="text"
            icon={<SyncOutlined spin={syncState.isSyncing} />}
            title={t('canvas.syncStatus', '同步状态')}
          />
          <Button
            type="text"
            icon={<HistoryOutlined />}
            title={t('canvas.versionHistory', '版本历史')}
            onClick={handleOpenVersionHistory}
            disabled={!currentFile}
          />
          <Button
            type={showPendingChangesPreview ? 'primary' : 'text'}
            icon={<DiffOutlined />}
            title={t('canvas.pending.toggle', '待处理变更')}
            onClick={handleTogglePendingChanges}>
            {pendingChangesCount > 0 && <PendingBadge>{pendingChangesCount}</PendingBadge>}
          </Button>
          <Button
            type={collabPanelMode === 'crew' ? 'primary' : 'text'}
            icon={<RobotOutlined />}
            title={t('canvas.crew.toggle', 'AI 协同编码')}
            onClick={() => handleToggleCollabPanel('crew')}
          />
          <Button
            type={settingsDrawerVisible ? 'primary' : 'text'}
            icon={<SettingOutlined />}
            title={t('canvas.editorSettings', '编辑器设置')}
            onClick={() => setSettingsDrawerVisible(true)}
          />
        </Flex>
      </Toolbar>

      {/* 编辑器/预览区域 */}
      <EditorContent>
        {currentFile ? (
          <EditorContainer $viewMode={viewMode}>
            {viewMode !== 'preview' && (
              <EditorPane $fullWidth={viewMode === 'editor'}>
                <CanvasEditor file={currentFile} config={config} onChange={handleContentChange} onSave={saveFile} />
              </EditorPane>
            )}
            {viewMode !== 'editor' && (
              <PreviewPane $fullWidth={viewMode === 'preview'}>
                <CanvasPreview
                  content={currentFile.content}
                  filePath={currentFile.path}
                  height="100%"
                  autoRefreshInterval={500}
                />
              </PreviewPane>
            )}
          </EditorContainer>
        ) : (
          <EmptyState>
            <Empty description="选择一个文件开始编辑" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </EmptyState>
        )}
      </EditorContent>
    </EditorAreaContainer>
  )

  // 渲染 Agent 面板
  const renderAgentPanel = () => {
    if (collabPanelMode === 'crew') {
      return (
        <MultiModelCodeCrewPanel
          visible={true}
          onClose={() => dispatch(setCollabPanelMode('none'))}
          onRunningChange={handleCrewRunningChange}
          onFilesApplied={() => {
            // 刷新当前文件
            if (currentFile) {
              loadFile(currentFile.path)
            }
            // 刷新文件浏览器
            setFileExplorerRefreshKey((prev) => prev + 1)
          }}
          currentFile={currentFile}
        />
      )
    }

    return null
  }

  return (
    <PageContainer>
      <IDELayout
        fileExplorer={<FileExplorer onSelectFile={loadFile} refreshTrigger={fileExplorerRefreshKey} />}
        editorArea={renderEditorArea()}
        agentPanel={renderAgentPanel()}
        terminal={<TerminalPanel />}
      />

      {/* 浮动状态指示器 - 运行中但面板隐藏时显示 */}
      {isCrewRunning && collabPanelMode === 'none' && !idePanel.rightPanelVisible && (
        <FloatingIndicator onClick={() => dispatch(setCollabPanelMode('crew'))}>
          <LoadingOutlined spin />
          <span>AI 协同编码运行中</span>
        </FloatingIndicator>
      )}

      {/* 待处理变更预览面板 */}
      {showPendingChangesPreview && (
        <PendingChangesPanel>
          <PendingChangesPreview
            height="100%"
            showHeader
            onClose={() => dispatch(setShowPendingChangesPreview(false))}
          />
        </PendingChangesPanel>
      )}

      {/* 版本历史抽屉 */}
      <Drawer
        title={t('canvas.versionHistory', '版本历史')}
        open={versionDrawerVisible}
        onClose={() => setVersionDrawerVisible(false)}
        width={400}>
        {loadingVersions ? (
          <Flex align="center" justify="center" style={{ height: 200 }}>
            <Text type="secondary">{t('common.loading', '加载中...')}</Text>
          </Flex>
        ) : versions.length === 0 ? (
          <Empty description={t('canvas.noVersions', '暂无版本历史')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={versions.map((version) => ({
              children: (
                <VersionItem key={version.id}>
                  <VersionInfo>
                    <Text strong>{formatTime(version.timestamp)}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {version.description || t('canvas.autoSave', '自动保存')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Hash: {version.hash.substring(0, 8)}
                    </Text>
                  </VersionInfo>
                  <VersionActions>
                    <Button size="small" onClick={() => handleViewDiff(version)}>
                      {t('canvas.viewDiff', '查看差异')}
                    </Button>
                    <Button size="small" onClick={() => handleRestoreVersion(version)}>
                      {t('canvas.restore', '恢复')}
                    </Button>
                  </VersionActions>
                </VersionItem>
              )
            }))}
          />
        )}
      </Drawer>

      {/* Diff 查看器模态框 */}
      <Modal
        title={t('canvas.diffView', '版本对比')}
        open={diffViewerVisible}
        onCancel={() => {
          setDiffViewerVisible(false)
          setSelectedVersion(null)
        }}
        footer={null}
        width={1200}
        styles={{ body: { padding: 0 } }}>
        {selectedVersion && currentFile && (
          <DiffViewer
            originalContent={selectedVersion.content}
            modifiedContent={currentFile.content}
            originalLabel={t('canvas.historicalVersion', '历史版本')}
            modifiedLabel={t('canvas.currentVersion', '当前版本')}
            filePath={currentFile.path}
            theme="dark"
            height="70vh"
            onClose={() => {
              setDiffViewerVisible(false)
              setSelectedVersion(null)
            }}
          />
        )}
      </Modal>

      {/* 编辑器设置抽屉 */}
      <Drawer
        title={t('canvas.editorSettings', '编辑器设置')}
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}
        width={360}>
        <SettingsSection>
          <SettingsItem>
            <Text strong>{t('canvas.settings.autoSave', '自动保存')}</Text>
            <Text type="secondary">
              {config.autoSave ? t('common.enabled', '已启用') : t('common.disabled', '已禁用')}
            </Text>
          </SettingsItem>

          <SettingsItem>
            <Text strong>{t('canvas.settings.fontSize', '字体大小')}</Text>
            <Text type="secondary">{config.fontSize}px</Text>
          </SettingsItem>

          <SettingsItem>
            <Text strong>{t('canvas.settings.tabSize', 'Tab 大小')}</Text>
            <Text type="secondary">{config.tabSize}</Text>
          </SettingsItem>

          <SettingsItem>
            <Text strong>{t('canvas.settings.lineWrapping', '自动换行')}</Text>
            <Text type="secondary">
              {config.lineWrapping ? t('common.enabled', '已启用') : t('common.disabled', '已禁用')}
            </Text>
          </SettingsItem>

          <SettingsItem>
            <Text strong>{t('canvas.settings.lineNumbers', '行号显示')}</Text>
            <Text type="secondary">
              {config.lineNumbers ? t('common.enabled', '已启用') : t('common.disabled', '已禁用')}
            </Text>
          </SettingsItem>
        </SettingsSection>

        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          {t('canvas.settings.note', '更多设置请在应用设置中配置')}
        </Text>
      </Drawer>
    </PageContainer>
  )
}

// Styled Components
const PageContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  overflow: hidden;
`

const EditorAreaContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-background);
  flex-shrink: 0;
  min-height: 40px;
`

const EditorContent = styled.div`
  flex: 1;
  overflow: hidden;
`

type ViewModeType = 'editor' | 'preview' | 'split'

const EditorContainer = styled.div<{ $viewMode: ViewModeType }>`
  display: flex;
  height: 100%;
  width: 100%;
  gap: ${(props) => (props.$viewMode === 'split' ? '1px' : '0')};
  background: ${(props) => (props.$viewMode === 'split' ? 'var(--color-border)' : 'transparent')};
`

const EditorPane = styled.div<{ $fullWidth: boolean }>`
  flex: ${(props) => (props.$fullWidth ? '1' : '0.5')};
  height: 100%;
  overflow: hidden;
  min-width: 0;
`

const PreviewPane = styled.div<{ $fullWidth: boolean }>`
  flex: ${(props) => (props.$fullWidth ? '1' : '0.5')};
  height: 100%;
  overflow: hidden;
  min-width: 0;
  background: var(--color-background);
`

const FloatingIndicator = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--color-primary);
  color: white;
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  z-index: 1000;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: var(--color-background);
`

const VersionItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const VersionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const VersionActions = styled.div`
  display: flex;
  gap: 8px;
`

const SettingsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const SettingsItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`

const PendingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  margin-left: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-primary);
  color: white;
  border-radius: 9px;
`

const PendingChangesPanel = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 480px;
  max-height: 60vh;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  overflow: hidden;
`

export default CanvasPage
