/**
 * Studio 画廊组件
 *
 * 显示版本历史和任务队列
 */

import Scrollbar from '@renderer/components/Scrollbar'
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

  const activeTaskCount = taskQueue.filter(
    (t) => t.status === 'running' || t.status === 'queued'
  ).length

  return (
    <GalleryContainer>
      <Scrollbar>
        {/* 版本历史 */}
        <Section>
          <SectionHeader>
            <History size={16} />
            <span>{t('image_studio.gallery.version_history')}</span>
            {currentProject && currentProject.versions.length > 0 && (
              <Badge>{currentProject.versions.length}</Badge>
            )}
          </SectionHeader>
          <VersionHistory maxHeight={280} />
        </Section>

        {/* 任务队列 */}
        <TaskSection>
          <SectionHeader>
            <Layers size={16} />
            <span>{t('image_studio.gallery.task_queue')}</span>
            {activeTaskCount > 0 && <Badge $highlight>{activeTaskCount}</Badge>}
          </SectionHeader>
          <TaskQueueWrapper>
            <TaskQueue />
          </TaskQueueWrapper>
        </TaskSection>
      </Scrollbar>
    </GalleryContainer>
  )
}

export default StudioGallery

// ============================================================================
// 样式
// ============================================================================

const GalleryContainer = styled.div`
  width: 280px;
  min-width: 280px;
  border-left: 0.5px solid var(--color-border);
  background-color: var(--color-background);
  height: calc(100vh - var(--navbar-height));
`

const Section = styled.div`
  padding: 12px;
  border-bottom: 0.5px solid var(--color-border);
`

const TaskSection = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  flex: 1;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 12px;
`

const Badge = styled.span<{ $highlight?: boolean }>`
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  background-color: ${(props) =>
    props.$highlight ? 'var(--color-primary)' : 'var(--color-background-soft)'};
  color: ${(props) =>
    props.$highlight ? 'var(--color-white)' : 'var(--color-text-2)'};
  border-radius: 10px;
`

const TaskQueueWrapper = styled.div`
  flex: 1;
  min-height: 200px;
  background: var(--color-background-soft);
  border-radius: 6px;
  overflow: hidden;
`
