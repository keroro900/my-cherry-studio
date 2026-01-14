import { CheckOutlined, ClockCircleOutlined, RobotOutlined } from '@ant-design/icons'
import type { NotesSortType } from '@renderer/types/note'
import type { MenuProps } from 'antd'
import { Dropdown, Input, Tooltip } from 'antd'
import { ArrowLeft, ArrowUpNarrowWide, FilePlus2, FolderPlus, LayoutGrid, List, Search, Star, Zap } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export type ViewMode = 'tree' | 'card' | 'stream'

interface NotesSidebarHeaderProps {
  isShowStarred: boolean
  isShowSearch: boolean
  isShowDiary: boolean
  searchKeyword: string
  sortType: NotesSortType
  diaryFilter: string | null
  availableCharacters: string[]
  viewMode: ViewMode
  onCreateFolder: () => void
  onCreateNote: () => void
  onToggleStarredView: () => void
  onToggleSearchView: () => void
  onToggleDiaryView: () => void
  onSetSearchKeyword: (keyword: string) => void
  onSelectSortType: (sortType: NotesSortType) => void
  onSetDiaryFilter: (characterName: string | null) => void
  onTimeSearch?: (expression: string) => void
  onViewModeChange?: (mode: ViewMode) => void
}

const NotesSidebarHeader: FC<NotesSidebarHeaderProps> = ({
  isShowStarred,
  isShowSearch,
  isShowDiary,
  searchKeyword,
  sortType,
  diaryFilter,
  availableCharacters,
  viewMode,
  onCreateFolder,
  onCreateNote,
  onToggleStarredView,
  onToggleSearchView,
  onToggleDiaryView,
  onSetSearchKeyword,
  onSelectSortType,
  onSetDiaryFilter,
  onTimeSearch,
  onViewModeChange
}) => {
  const { t } = useTranslation()
  const [timeExpression, setTimeExpression] = useState('')

  const handleSortMenuClick: MenuProps['onClick'] = useCallback(
    (e) => {
      onSelectSortType(e.key as NotesSortType)
    },
    [onSelectSortType]
  )

  const handleDiaryMenuClick: MenuProps['onClick'] = useCallback(
    (e) => {
      if (e.key === '__all__') {
        onSetDiaryFilter(null)
      } else {
        onSetDiaryFilter(e.key)
      }
    },
    [onSetDiaryFilter]
  )

  // 日记角色筛选菜单
  const diaryMenuItems: Required<MenuProps>['items'] = useMemo(() => {
    const items: Required<MenuProps>['items'] = [
      {
        label: t('notes.diary_all', '全部日记'),
        key: '__all__',
        icon: diaryFilter === null ? <CheckOutlined /> : undefined
      }
    ]

    if (availableCharacters.length > 0) {
      items.push({ type: 'divider' })
      items.push(
        ...availableCharacters.map((char) => ({
          label: char,
          key: char,
          icon: diaryFilter === char ? <CheckOutlined /> : undefined
        }))
      )
    }

    return items
  }, [availableCharacters, diaryFilter, t])

  const sortMenuItems: Required<MenuProps>['items'] = [
    { label: t('notes.sort_a2z'), key: 'sort_a2z' },
    { label: t('notes.sort_z2a'), key: 'sort_z2a' },
    { type: 'divider' },
    { label: t('notes.sort_updated_desc'), key: 'sort_updated_desc' },
    { label: t('notes.sort_updated_asc'), key: 'sort_updated_asc' },
    { type: 'divider' },
    { label: t('notes.sort_created_desc'), key: 'sort_created_desc' },
    { label: t('notes.sort_created_asc'), key: 'sort_created_asc' }
  ]

  const sortMenuWithCheck = sortMenuItems
    .map((item) => {
      if (item) {
        return {
          ...item,
          icon: sortType === item.key ? <CheckOutlined /> : undefined,
          key: item.key
        }
      }
      return null
    })
    .filter(Boolean) as MenuProps['items']

  return (
    <SidebarHeader isStarView={isShowStarred} isSearchView={isShowSearch} isDiaryView={isShowDiary}>
      <HeaderActions>
        {!isShowStarred && !isShowSearch && !isShowDiary && (
          <>
            <Tooltip title={t('notes.new_note')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onCreateNote}>
                <FilePlus2 size={18} />
              </ActionButton>
            </Tooltip>

            <Tooltip title={t('notes.new_folder')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onCreateFolder}>
                <FolderPlus size={18} />
              </ActionButton>
            </Tooltip>

            <Dropdown
              menu={{
                items: sortMenuWithCheck,
                onClick: handleSortMenuClick
              }}
              trigger={['click']}>
              <Tooltip title={t('assistants.presets.sorting.title')} mouseEnterDelay={0.8}>
                <ActionButton>
                  <ArrowUpNarrowWide size={18} />
                </ActionButton>
              </Tooltip>
            </Dropdown>

            <Tooltip title={t('notes.show_starred')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onToggleStarredView}>
                <Star size={18} />
              </ActionButton>
            </Tooltip>

            <Tooltip title={t('notes.show_diary', '日记筛选')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onToggleDiaryView}>
                <RobotOutlined style={{ fontSize: 16 }} />
              </ActionButton>
            </Tooltip>

            <Tooltip title={t('common.search')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onToggleSearchView}>
                <Search size={18} />
              </ActionButton>
            </Tooltip>
          </>
        )}
        {isShowStarred && (
          <Tooltip title={t('common.back')} mouseEnterDelay={0.8}>
            <ActionButton onClick={onToggleStarredView}>
              <ArrowLeft size={18} />
            </ActionButton>
          </Tooltip>
        )}
        {isShowDiary && (
          <>
            <Tooltip title={t('common.back')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onToggleDiaryView}>
                <ArrowLeft size={18} />
              </ActionButton>
            </Tooltip>
            <DiaryLabel>{t('notes.diary_filter', '日记筛选')}</DiaryLabel>
            <Dropdown
              menu={{
                items: diaryMenuItems,
                onClick: handleDiaryMenuClick
              }}
              trigger={['click']}>
              <DiaryFilterButton>
                <RobotOutlined style={{ marginRight: 4 }} />
                {diaryFilter || t('notes.diary_all', '全部')}
              </DiaryFilterButton>
            </Dropdown>

            <ViewModeToggle>
              <Tooltip title={t('notes.view_tree', '树形视图')} mouseEnterDelay={0.8}>
                <ViewModeButton
                  $active={viewMode === 'tree'}
                  onClick={() => onViewModeChange?.('tree')}
                >
                  <List size={14} />
                </ViewModeButton>
              </Tooltip>
              <Tooltip title={t('notes.view_card', '卡片视图')} mouseEnterDelay={0.8}>
                <ViewModeButton
                  $active={viewMode === 'card'}
                  onClick={() => onViewModeChange?.('card')}
                >
                  <LayoutGrid size={14} />
                </ViewModeButton>
              </Tooltip>
              <Tooltip title={t('notes.view_stream', '日记流')} mouseEnterDelay={0.8}>
                <ViewModeButton
                  $active={viewMode === 'stream'}
                  onClick={() => onViewModeChange?.('stream')}
                >
                  <Zap size={14} />
                </ViewModeButton>
              </Tooltip>
            </ViewModeToggle>

            <Tooltip
              title={
                <div style={{ fontSize: 12 }}>
                  <div>{t('notes.time_search_hint', '支持时间表达式:')}</div>
                  <div>今天、昨天、前天</div>
                  <div>本周、上周、本月、上个月</div>
                  <div>过去7天、最近30天</div>
                  <div>2025-01-01 至 2025-01-06</div>
                </div>
              }
              placement="bottom">
              <TimeSearchInput
                prefix={<ClockCircleOutlined style={{ color: 'var(--color-text-3)' }} />}
                placeholder={t('notes.time_search_placeholder', '时间搜索...')}
                value={timeExpression}
                onChange={(e) => setTimeExpression(e.target.value)}
                onPressEnter={() => {
                  if (timeExpression.trim() && onTimeSearch) {
                    onTimeSearch(timeExpression.trim())
                  }
                }}
                size="small"
                allowClear
              />
            </Tooltip>
          </>
        )}
        {isShowSearch && (
          <>
            <Tooltip title={t('common.back')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onToggleSearchView}>
                <ArrowLeft size={18} />
              </ActionButton>
            </Tooltip>
            <SearchInput
              placeholder={t('knowledge.search_placeholder')}
              value={searchKeyword}
              onChange={(e) => onSetSearchKeyword(e.target.value)}
              allowClear
              size="small"
              autoFocus
            />
          </>
        )}
      </HeaderActions>
    </SidebarHeader>
  )
}

const SidebarHeader = styled.div<{ isStarView?: boolean; isSearchView?: boolean; isDiaryView?: boolean }>`
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--color-border);
  display: flex;
  justify-content: ${(props) => (props.isStarView || props.isSearchView || props.isDiaryView ? 'flex-start' : 'center')};
  height: var(--navbar-height);
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const ActionButton = styled.div`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  color: var(--color-text-2);
  cursor: pointer;

  &:hover {
    background-color: var(--color-background-soft);
    color: var(--color-text);
  }
`

const SearchInput = styled(Input)`
  flex: 1;
  margin-left: 8px;
  max-width: 180px;

  .ant-input {
    font-size: 13px;
    border-radius: 4px;
  }
`

const DiaryLabel = styled.span`
  font-size: 13px;
  color: var(--color-text-2);
  margin-left: 8px;
  margin-right: 4px;
`

const DiaryFilterButton = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--color-primary-bg-hover);
  }
`

const TimeSearchInput = styled(Input)`
  width: 100px;
  margin-left: 4px;

  .ant-input {
    font-size: 12px;
    border-radius: 4px;
  }
`

const ViewModeToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
  padding: 2px;
  background: var(--color-background-mute);
  border-radius: 4px;
`

const ViewModeButton = styled.div<{ $active?: boolean }>`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-text-3)')};
  background: ${({ $active }) => ($active ? 'var(--color-background)' : 'transparent')};

  &:hover {
    color: var(--color-primary);
    background: var(--color-background);
  }
`

export default NotesSidebarHeader
