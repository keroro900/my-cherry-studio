import { CheckOutlined, RobotOutlined } from '@ant-design/icons'
import type { NotesSortType } from '@renderer/types/note'
import type { MenuProps } from 'antd'
import { Dropdown, Input, Tooltip } from 'antd'
import { ArrowLeft, ArrowUpNarrowWide, FilePlus2, FolderPlus, Search, Star } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface NotesSidebarHeaderProps {
  isShowStarred: boolean
  isShowSearch: boolean
  isShowDiary: boolean
  searchKeyword: string
  sortType: NotesSortType
  diaryFilter: string | null
  availableCharacters: string[]
  onCreateFolder: () => void
  onCreateNote: () => void
  onToggleStarredView: () => void
  onToggleSearchView: () => void
  onToggleDiaryView: () => void
  onSetSearchKeyword: (keyword: string) => void
  onSelectSortType: (sortType: NotesSortType) => void
  onSetDiaryFilter: (characterName: string | null) => void
}

const NotesSidebarHeader: FC<NotesSidebarHeaderProps> = ({
  isShowStarred,
  isShowSearch,
  isShowDiary,
  searchKeyword,
  sortType,
  diaryFilter,
  availableCharacters,
  onCreateFolder,
  onCreateNote,
  onToggleStarredView,
  onToggleSearchView,
  onToggleDiaryView,
  onSetSearchKeyword,
  onSelectSortType,
  onSetDiaryFilter
}) => {
  const { t } = useTranslation()

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

export default NotesSidebarHeader
