/**
 * 输出预览模态框
 * 支持多个文本/JSON 输出的选择和预览
 */

import { CopyOutlined, FileTextOutlined } from '@ant-design/icons'
import CodeEditor from '@renderer/components/CodeEditor'
import { TopView } from '@renderer/components/TopView'
import { message,Modal } from 'antd'
import { memo, useState } from 'react'
import styled from 'styled-components'

// ==================== 类型定义 ====================

export interface OutputItem {
  /** 输出项标识 */
  key: string
  /** 显示标签 */
  label: string
  /** 输出内容 */
  content: string
  /** 内容类型 */
  type: 'json' | 'text' | 'unknown'
}

interface OutputPreviewModalProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 输出项列表 */
  outputs: OutputItem[]
  /** 标题 */
  title?: string
}

// ==================== 样式组件 ====================

const ModalContent = styled.div`
  display: flex;
  height: 70vh;
  max-height: 600px;
  overflow: hidden;
`

const Sidebar = styled.div`
  width: 180px;
  min-width: 180px;
  border-right: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
  display: flex;
  flex-direction: column;
`

const SidebarHeader = styled.div`
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ant-color-text-secondary);
  border-bottom: 1px solid var(--ant-color-border);
`

const SidebarList = styled.div`
  flex: 1;
  overflow-y: auto;
`

const SidebarItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: ${({ $active }) => ($active ? 'var(--ant-color-primary)' : 'var(--ant-color-text)')};
  background: ${({ $active }) => ($active ? 'var(--ant-color-primary-bg)' : 'transparent')};
  border-left: 3px solid ${({ $active }) => ($active ? 'var(--ant-color-primary)' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    background: var(--ant-color-bg-text-hover);
  }
`

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const EditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const EditorTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--ant-color-text);
`

const EditorActions = styled.div`
  display: flex;
  gap: 8px;
`

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--ant-color-text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--ant-color-bg-text-hover);
    color: var(--ant-color-text);
  }
`

const EditorWrapper = styled.div`
  flex: 1;
  overflow: hidden;
`

const TypeBadge = styled.span<{ $type: string }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${({ $type }) =>
    $type === 'json' ? 'var(--ant-color-warning-bg)' : 'var(--ant-color-info-bg)'};
  color: ${({ $type }) =>
    $type === 'json' ? 'var(--ant-color-warning)' : 'var(--ant-color-info)'};
`

// ==================== 主组件 ====================

function OutputPreviewModalInner({ open, onClose, outputs, title = '输出预览' }: OutputPreviewModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(outputs[0]?.key || '')

  const selectedOutput = outputs.find((o) => o.key === selectedKey) || outputs[0]

  const handleCopy = async () => {
    if (selectedOutput) {
      try {
        await navigator.clipboard.writeText(selectedOutput.content)
        message.success('已复制到剪贴板')
      } catch {
        message.error('复制失败')
      }
    }
  }

  const getLanguage = (type: string) => {
    switch (type) {
      case 'json':
        return 'json'
      case 'text':
        return 'plaintext'
      default:
        return 'plaintext'
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      width={900}
      footer={null}
      centered
      destroyOnHidden
      styles={{
        content: { borderRadius: 12, padding: 0, overflow: 'hidden' },
        body: { padding: 0 },
        header: { padding: '16px 20px', borderBottom: '1px solid var(--ant-color-border)', margin: 0 }
      }}>
      <ModalContent>
        {/* 左侧列表 */}
        {outputs.length > 1 && (
          <Sidebar>
            <SidebarHeader>输出列表 ({outputs.length})</SidebarHeader>
            <SidebarList>
              {outputs.map((output) => (
                <SidebarItem
                  key={output.key}
                  $active={selectedKey === output.key}
                  onClick={() => setSelectedKey(output.key)}>
                  <FileTextOutlined />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {output.label}
                  </span>
                  <TypeBadge $type={output.type}>{output.type.toUpperCase()}</TypeBadge>
                </SidebarItem>
              ))}
            </SidebarList>
          </Sidebar>
        )}

        {/* 右侧编辑器 */}
        <EditorArea>
          <EditorHeader>
            <EditorTitle>{selectedOutput?.label || '预览'}</EditorTitle>
            <EditorActions>
              <ActionButton onClick={handleCopy} title="复制内容">
                <CopyOutlined />
              </ActionButton>
            </EditorActions>
          </EditorHeader>
          <EditorWrapper>
            {selectedOutput && (
              <CodeEditor
                value={selectedOutput.content}
                language={getLanguage(selectedOutput.type)}
                readOnly
                height="100%"
                expanded={false}
                options={{
                  lineNumbers: true,
                  foldGutter: true
                }}
              />
            )}
          </EditorWrapper>
        </EditorArea>
      </ModalContent>
    </Modal>
  )
}

const OutputPreviewModal = memo(OutputPreviewModalInner)

// ==================== TopView 静态方法 ====================

const TopViewKey = 'OutputPreviewModal'

interface ShowOptions {
  outputs: OutputItem[]
  title?: string
}

export default class OutputPreviewModalPopup {
  static hide() {
    TopView.hide(TopViewKey)
  }

  static show(options: ShowOptions) {
    return new Promise<void>((resolve) => {
      TopView.show(
        <OutputPreviewModal
          open={true}
          onClose={() => {
            resolve()
            TopView.hide(TopViewKey)
          }}
          outputs={options.outputs}
          title={options.title}
        />,
        TopViewKey
      )
    })
  }
}

export { OutputPreviewModal }
