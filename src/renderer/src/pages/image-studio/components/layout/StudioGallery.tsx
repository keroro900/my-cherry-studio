/**
 * Studio 画廊组件
 *
 * 显示版本历史和任务队列，紧凑设计
 */

import { useAppSelector } from '@renderer/store'
import { selectCurrentProject, selectTaskQueue } from '@renderer/store/imageStudio'
import { History, Layers } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import VersionHistory from '../gallery/VersionHistory'
import TaskQueue from '../task/TaskQueue'

const StudioGallery: FC = () => {
  const { t } = useTranslation()

  const currentProject = useAppSelector(selectCurrentProject)
  const taskQueue = useAppSelector(selectTaskQueue)

  const activeTaskCount = taskQueue.filter((task) => task.status === 'running' || task.status === 'queued').length

  return (
    <GalleryContainer>
      <ScrollableContent>
        {/* 版本历史 */}
        <Section>
          <SectionHeader>
            <History size={12} />
            <span>{t('image_studio.gallery.version_history')}</span>
            {currentProject && currentProject.versions.length > 0 && <Badge>{currentProject.versions.length}</Badge>}
          </SectionHeader>
          <VersionHistory maxHeight={200} />
        </Section>

        {/* 任务队列 */}
        <TaskSection>
          <SectionHeader>
            <Layers size={12} />
            <span>{t('image_studio.gallery.task_queue')}</span>
            {activeTaskCount > 0 && <Badge $highlight>{activeTaskCount}</Badge>}
          </SectionHeader>
          <TaskQueueWrapper>
            <TaskQueue />
          </TaskQueueWrapper>
        </TaskSection>
      </ScrollableContent>
    </GalleryContainer>
  )
}

export default StudioGallery

// ============================================================================
// 样式
// ============================================================================

const GalleryContainer = styled.div`
  flex: 1;
  background-color: var(--color-background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ScrollableContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;

    &:hover {
      background: var(--color-text-4);
    }
  }
`

const Section = styled.div`
  padding: 10px;
  border-bottom: 0.5px solid var(--color-border);
`

const TaskSection = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  min-height: 140px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 8px;
`

const Badge = styled.span<{ $highlight?: boolean }>`
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
  margin-left: auto;
  background-color: ${(props) => (props.$highlight ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  color: ${(props) => (props.$highlight ? 'var(--color-white)' : 'var(--color-text-2)')};
  border-radius: 8px;
`

const TaskQueueWrapper = styled.div`
  flex: 1;
  min-height: 100px;
  background: var(--color-background-soft);
  border-radius: 4px;
  overflow: hidden;
`
