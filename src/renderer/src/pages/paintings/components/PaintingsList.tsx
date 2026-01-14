/**
 * 绘画历史列表组件
 *
 * P2 优化：添加收起/展开功能，支持长时间保存历史记录
 */

import { DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { DraggableList } from '@renderer/components/DraggableList'
import Scrollbar from '@renderer/components/Scrollbar'
import { usePaintings } from '@renderer/hooks/usePaintings'
import FileManager from '@renderer/services/FileManager'
import type { Painting, PaintingsState } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Popconfirm, Tooltip } from 'antd'
import type { FC } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface PaintingsListProps {
  paintings: Painting[]
  selectedPainting: Painting
  onSelectPainting: (painting: Painting) => void
  onDeletePainting: (painting: Painting) => void
  onNewPainting: () => void
  namespace: keyof PaintingsState
}

const PaintingsList: FC<PaintingsListProps> = ({
  paintings,
  selectedPainting,
  onSelectPainting,
  onDeletePainting,
  onNewPainting,
  namespace
}) => {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { updatePaintings } = usePaintings()

  // 收起状态时显示简化的按钮栏
  if (collapsed) {
    return (
      <CollapsedContainer>
        <Tooltip title={t('paintings.expand_history', { defaultValue: '展开历史记录' })} placement="left">
          <CollapseButton onClick={() => setCollapsed(false)}>
            <LeftOutlined />
          </CollapseButton>
        </Tooltip>
        <Tooltip title={t('paintings.button.new.image')} placement="left">
          <CollapsedNewButton onClick={onNewPainting}>
            <PlusOutlined />
          </CollapsedNewButton>
        </Tooltip>
        {paintings.length > 0 && <CollapsedCount>{paintings.length}</CollapsedCount>}
      </CollapsedContainer>
    )
  }

  return (
    <Container style={{ paddingBottom: dragging ? 80 : 10 }}>
      {/* P2: 收起按钮 */}
      <CollapseHeader>
        <Tooltip title={t('paintings.collapse_history', { defaultValue: '收起历史记录' })} placement="left">
          <CollapseButton onClick={() => setCollapsed(true)}>
            <RightOutlined />
          </CollapseButton>
        </Tooltip>
      </CollapseHeader>

      {!dragging && (
        <NewPaintingButton onClick={onNewPainting}>
          <PlusOutlined />
        </NewPaintingButton>
      )}
      <DraggableList
        list={paintings}
        onUpdate={(value) => updatePaintings(namespace, value)}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}>
        {(item: Painting) => (
          <CanvasWrapper key={item.id}>
            <Canvas
              className={classNames(selectedPainting.id === item.id && 'selected')}
              onClick={() => onSelectPainting(item)}>
              {item.files[0] && <ThumbnailImage src={FileManager.getFileUrl(item.files[0])} alt="" />}
            </Canvas>
            <DeleteButton>
              <Popconfirm
                title={t('paintings.button.delete.image.confirm')}
                onConfirm={() => onDeletePainting(item)}
                okButtonProps={{ danger: true }}
                placement="left">
                <DeleteOutlined />
              </Popconfirm>
            </DeleteButton>
          </CanvasWrapper>
        )}
      </DraggableList>
    </Container>
  )
}

const Container = styled(Scrollbar)`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: var(--color-background);
  max-width: 100px;
  border-left: 0.5px solid var(--color-border);
  height: calc(100vh - var(--navbar-height));
  overflow-x: hidden;
`

// P2: 收起状态容器
const CollapsedContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  background-color: var(--color-background);
  border-left: 0.5px solid var(--color-border);
  height: calc(100vh - var(--navbar-height));
`

// P2: 收起按钮头部
const CollapseHeader = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 4px;
`

// P2: 收起/展开按钮
const CollapseButton = styled.div`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-2);
  background-color: var(--color-background-soft);
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-primary);
  }
`

// P2: 收起状态下的新建按钮
const CollapsedNewButton = styled.div`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-2);
  background-color: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

// P2: 收起状态下的数量显示
const CollapsedCount = styled.div`
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
`

const CanvasWrapper = styled.div`
  position: relative;

  &:hover {
    .delete-button {
      opacity: 1;
    }
  }
`

const Canvas = styled.div`
  width: 80px;
  height: 80px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 1px solid var(--color-background-soft);
  overflow: hidden;
  position: relative;

  &.selected {
    border: 1px solid var(--color-primary);
  }

  &:hover {
    background-color: var(--color-background-mute);
  }
`

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const DeleteButton = styled.div.attrs({ className: 'delete-button' })`
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  color: var(--color-error);
  background-color: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
`

const NewPaintingButton = styled.div`
  width: 80px;
  height: 80px;
  min-height: 80px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-2);

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

export default PaintingsList
