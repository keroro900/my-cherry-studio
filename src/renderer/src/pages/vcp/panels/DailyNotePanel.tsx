/**
 * VCP DailyNote Panel
 *
 * 日记面板 - 移植自 VCPToolBox/DailyNotePanel
 * 提供日记浏览、搜索、编辑功能
 *
 * 功能:
 * - 日记本/条目 CRUD
 * - 后端搜索（支持 TagMemo/Time 修饰符）
 * - 标签管理
 * - 统计信息显示
 * - 助手联动（日记本与助手关联）
 *
 * 模式:
 * - character: 角色日记 (与助手关联)
 * - global: 全局日记 (不绑定角色)
 * - memory: 记忆管理 (显示记忆系统状态)
 */

import {
  BookOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SyncOutlined,
  TagOutlined,
  UserOutlined
} from '@ant-design/icons'
import SearchResultFeedback from '@renderer/components/VCP/SearchResultFeedback'
import UnifiedSearchPopup from '@renderer/pages/knowledge/components/UnifiedSearchPopup'
import type { RootState } from '@renderer/store'
import { setActiveFilePath } from '@renderer/store/note'
import type { Assistant } from '@renderer/types'
import { Button, Card, Empty, Input, Modal, Popconfirm, Progress, Select, Space, Spin, Statistic, Tag, Tooltip, Typography } from 'antd'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

// 面板模式
type PanelMode = 'character' | 'global' | 'memory'

// 组件属性
interface DailyNotePanelProps {
  mode?: PanelMode
}

// 日记条目类型
interface DiaryNote {
  id?: string // 日记 ID
  folderName: string // 日记本名称 (角色名)
  name: string // 文件名
  mtime: number // 修改时间戳
  preview?: string // 预览内容
  content?: string // 完整内容 (编辑时加载)
  tags?: string[] // 标签
  filePath?: string // 文件路径 (用于导航到笔记页面)
}

// 日记本类型
interface Notebook {
  name: string
  noteCount?: number
  latestMtime?: number
  assistantId?: string // 关联的助手 ID
  assistantName?: string // 助手显示名
}

// 排序模式
type SortMode = 'mtime-desc' | 'mtime-asc' | 'name-asc' | 'name-desc'

// 统计信息类型
interface DiaryStats {
  bookCount: number
  entryCount: number
  publicEntryCount: number
  tagCount: number
}

// 记忆系统统计
interface MemoryStats {
  searchAvailable: boolean
  searchInitialized: boolean
  documentCount: number
  indexSize?: string
  lastIndexTime?: string
}

// 论坛统计
interface ForumStats {
  totalPosts: number
  boards: string[]
}

// 思维簇统计
interface ClusterStats {
  clusterCount: number
  totalFiles: number
  totalSize: number
}

// 数据源类型
type DataSource = 'all' | 'notes' | 'forum' | 'clusters'

// path polyfill for basename (outside component to avoid dependency issues)
const pathUtils = {
  basename: (p: string) => {
    const parts = p.split(/[/\\]/)
    return parts[parts.length - 1] || p
  }
}

// 从文件路径提取文件夹名 (outside component)
const extractFolderName = (filePath: string): string => {
  // 格式: category/YYYY/MM/[character-]title.md
  const parts = filePath.split('/')
  if (parts.length >= 1) {
    // 尝试从文件名提取角色名
    const fileName = parts[parts.length - 1]
    const match = fileName.match(/^(.+?)-\d{2}-/)
    if (match) return match[1]
  }
  return parts[0] || '全局日记'
}

const DailyNotePanel: FC<DailyNotePanelProps> = ({ mode = 'character' }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // 获取助手列表
  const assistants = useSelector((state: RootState) => state.assistants.assistants) as Assistant[]

  // 使用 useMemo 创建翻译后的排序选项
  const SORT_OPTIONS = useMemo(
    () => [
      { value: 'mtime-desc', label: t('vcp.dailynote.sort_mtime_desc', '最近修改') },
      { value: 'mtime-asc', label: t('vcp.dailynote.sort_mtime_asc', '最早修改') },
      { value: 'name-asc', label: t('vcp.dailynote.sort_name_asc', '名称升序') },
      { value: 'name-desc', label: t('vcp.dailynote.sort_name_desc', '名称降序') }
    ],
    [t]
  )
  const [loading, setLoading] = useState(false)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [notes, setNotes] = useState<DiaryNote[]>([])
  // 根据模式设置初始选中状态: global模式默认选中全局，character模式默认显示日记本列表
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(mode === 'global' ? '' : null)
  const [searchText, setSearchText] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('mtime-desc')
  const [stats, setStats] = useState<DiaryStats | null>(null)

  // 记忆系统状态 (memory 模式使用)
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const [forumStats, setForumStats] = useState<ForumStats | null>(null)
  const [clusterStats, setClusterStats] = useState<ClusterStats | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('all')
  const [indexing, setIndexing] = useState(false)

  // 编辑弹窗状态
  const [editorVisible, setEditorVisible] = useState(false)
  const [selectedNote, setSelectedNote] = useState<DiaryNote | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [isNewEntry, setIsNewEntry] = useState(false)
  const [newEntryDate, setNewEntryDate] = useState('')

  // 搜索模式状态 (用于显示反馈按钮)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [lastSearchQuery, setLastSearchQuery] = useState('')

  // 加载记忆系统统计 (memory 模式)
  const loadMemoryStats = useCallback(async () => {
    if (mode !== 'memory') return
    try {
      const result = await window.api.dailyNoteWrite.getSearchStats()
      if (result.success && result.stats) {
        setMemoryStats({
          searchAvailable: result.stats.available,
          searchInitialized: result.stats.initialized,
          documentCount: result.stats.documentCount || 0
        })
      }
    } catch (error) {
      console.error('Failed to load memory stats:', error)
    }
  }, [mode])

  // 加载论坛统计 (memory 模式)
  const loadForumStats = useCallback(async () => {
    if (mode !== 'memory') return
    try {
      const result = await window.api.vcpForum.stats()
      if (result.success && result.data) {
        setForumStats(result.data)
      }
    } catch (error) {
      console.error('Failed to load forum stats:', error)
    }
  }, [mode])

  // 加载思维簇统计 (memory 模式)
  const loadClusterStats = useCallback(async () => {
    if (mode !== 'memory') return
    try {
      const result = await window.api.vcpCluster.stats()
      if (result.success && result.stats) {
        setClusterStats(result.stats)
      }
    } catch (error) {
      console.error('Failed to load cluster stats:', error)
    }
  }, [mode])

  // 加载所有记忆相关统计
  const loadAllMemoryStats = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      loadMemoryStats(),
      loadForumStats(),
      loadClusterStats()
    ])
    setLoading(false)
  }, [loadMemoryStats, loadForumStats, loadClusterStats])

  // 初始化搜索索引
  const initSearchIndex = useCallback(async () => {
    setIndexing(true)
    try {
      const result = await window.api.dailyNoteWrite.initSearchIndex()
      if (result.success) {
        window.toast.success(t('vcp.memory.index_success', `索引完成，共 ${result.indexed || 0} 条记录`))
        loadMemoryStats()
      } else {
        window.toast.error(result.error || '索引失败')
      }
    } catch (error) {
      window.toast.error(String(error))
    } finally {
      setIndexing(false)
    }
  }, [t, loadMemoryStats])

  // 打开统一搜索弹窗
  const openUnifiedSearch = useCallback(async () => {
    const result = await UnifiedSearchPopup.show({ initialSource: 'all' })
    if (result) {
      // 处理搜索结果 - 可以显示详情或跳转到对应文档
      window.toast.success(t('vcp.memory.search_result_selected', `已选择: ${result.metadata.title || result.pageContent.slice(0, 30)}...`))
    }
  }, [t])

  // 加载日记本列表
  const loadNotebooks = useCallback(async () => {
    setLoading(true)
    try {
      // 调用 VCP 日记 API 获取所有日记本
      const result = await window.api.vcpDiary.list()
      if (result.success && result.books) {
        setNotebooks(
          result.books.map((book) => {
            // 尝试匹配关联的助手
            const matchedAssistant = assistants.find(
              (a) =>
                a.name === book.name ||
                a.id === book.name ||
                (a as any).displayName === book.name ||
                (a as any).memory?.diaryBookName === book.name
            )

            // 解析最新时间：支持字符串或对象格式
            let latestMtime: number | undefined
            if (book.latestEntry) {
              // latestEntry 可能是字符串 (日期) 或对象 ({ date: string })
              const dateStr = typeof book.latestEntry === 'string'
                ? book.latestEntry
                : (book.latestEntry as any).date
              if (dateStr) {
                latestMtime = new Date(dateStr).getTime()
              }
            } else if (book.updatedAt) {
              latestMtime = new Date(book.updatedAt).getTime()
            }

            return {
              name: book.name,
              noteCount: book.entryCount,
              latestMtime,
              assistantId: matchedAssistant?.id,
              assistantName: matchedAssistant?.name || (matchedAssistant as any)?.displayName
            }
          })
        )
      }

      // 同时加载统计信息
      const statsResult = await window.api.vcpDiary.getStats()
      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats)
      }
    } catch (error) {
      console.error('Failed to load notebooks:', error)
    } finally {
      setLoading(false)
    }
  }, [assistants])

  // 加载指定日记本的日记列表 (或全部日记)
  const loadNotes = useCallback(async (notebookName: string | null) => {
    setLoading(true)
    // 加载新数据时退出搜索模式
    setIsSearchMode(false)
    setLastSearchQuery('')
    try {
      if (!notebookName) {
        // 全局日记模式：使用 listAll 获取所有笔记
        const listResult = await window.api.dailyNoteWrite.listAll({
          limit: 100,
          includeContent: true
        })

        if (listResult.success && listResult.notes) {
          setNotes(
            listResult.notes.map((entry) => ({
              id: entry.id,
              folderName: entry.characterName || extractFolderName(entry.filePath),
              name: entry.title || pathUtils.basename(entry.filePath),
              mtime: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
              preview: entry.content.substring(0, 200),
              content: entry.content,
              tags: entry.tags || [],
              filePath: entry.filePath
            }))
          )
        } else {
          // Fallback: 使用 VCP 日记 API (不指定角色)
          const result = await window.api.vcpDiary.list({ includeContent: true })
          if (result.success && result.entries) {
            setNotes(
              result.entries.map((entry) => ({
                id: entry.id,
                folderName: '全局',
                name: entry.date + '.txt',
                mtime: entry.updatedAt ? new Date(entry.updatedAt).getTime() : new Date(entry.date).getTime(),
                preview: entry.content.substring(0, 200),
                content: entry.content,
                tags: entry.tags,
                filePath: entry.filePath
              }))
            )
          } else {
            setNotes([])
          }
        }
        return
      }

      // 调用 VCP 日记 API 获取指定日记本的日记列表
      const result = await window.api.vcpDiary.list({ characterName: notebookName, includeContent: true })
      if (result.success && result.entries) {
        setNotes(
          result.entries.map((entry) => ({
            id: entry.id,
            folderName: notebookName,
            name: entry.date + '.txt',
            mtime: entry.updatedAt ? new Date(entry.updatedAt).getTime() : new Date(entry.date).getTime(),
            preview: entry.content.substring(0, 200),
            content: entry.content,
            tags: entry.tags,
            filePath: entry.filePath
          }))
        )
      }
    } catch (error) {
      console.error('Failed to load notes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotebooks()
  }, [loadNotebooks])

  useEffect(() => {
    loadNotes(selectedNotebook)
  }, [selectedNotebook, loadNotes])

  // 加载记忆系统统计 (memory 模式)
  useEffect(() => {
    if (mode === 'memory') {
      loadAllMemoryStats()
      // 同时加载文档列表
      loadNotes(null)
    }
  }, [mode, loadAllMemoryStats, loadNotes])

  // 排序日记
  const sortedNotes = [...notes].sort((a, b) => {
    switch (sortMode) {
      case 'mtime-desc':
        return b.mtime - a.mtime
      case 'mtime-asc':
        return a.mtime - b.mtime
      case 'name-asc':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'name-desc':
        return b.name.localeCompare(a.name, 'zh-CN')
      default:
        return 0
    }
  })

  // 过滤日记
  const filteredNotes = sortedNotes.filter((note) => {
    if (!searchText) return true
    const search = searchText.toLowerCase()
    return note.name.toLowerCase().includes(search) || note.preview?.toLowerCase().includes(search)
  })

  // 导航到笔记页面进行编辑
  const navigateToNote = useCallback(
    (note: DiaryNote) => {
      if (note.filePath) {
        // 设置活动文件路径并导航到笔记页面
        dispatch(setActiveFilePath(note.filePath))
        navigate('/notes')
      } else {
        // 如果没有文件路径，显示提示
        window.toast.warning(t('vcp.dailynote.no_file_path', '无法找到笔记文件路径'))
      }
    },
    [dispatch, navigate, t]
  )

  // 打开新建日记对话框
  const openNewEntryDialog = () => {
    if (!selectedNotebook) {
      window.toast.warning(t('vcp.dailynote.select_notebook_first', '请先选择日记本'))
      return
    }
    const today = new Date().toISOString().split('T')[0]
    setNewEntryDate(today)
    setSelectedNote({
      folderName: selectedNotebook,
      name: today + '.txt',
      mtime: Date.now(),
      content: '',
      tags: []
    })
    setIsNewEntry(true)
    setEditContent('')
    setEditTags([])
    setEditorVisible(true)
  }

  // 保存日记
  const handleSave = async () => {
    if (!selectedNote) return

    setSaving(true)
    try {
      if (isNewEntry) {
        // 创建新日记
        const result = await window.api.vcpDiary.write({
          characterName: selectedNote.folderName,
          content: editContent,
          date: newEntryDate,
          tags: editTags
        })
        if (!result.success) {
          throw new Error(result.error || '创建失败')
        }
        window.toast.success(t('vcp.dailynote.create_success', '日记创建成功'))
      } else if (selectedNote.id) {
        // 编辑现有日记
        const result = await window.api.vcpDiary.edit({
          entryId: selectedNote.id,
          content: editContent,
          tags: editTags
        })
        if (!result.success) {
          throw new Error(result.error || '保存失败')
        }
        window.toast.success(t('vcp.dailynote.save_success', '日记保存成功'))
      }

      setEditorVisible(false)
      setIsNewEntry(false)
      loadNotes(selectedNotebook)
      loadNotebooks() // 刷新统计
    } catch (error) {
      window.toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  // 删除日记
  const handleDelete = async (note: DiaryNote, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡

    if (!note.id) {
      window.toast.error(t('vcp.dailynote.delete_error', '无法删除：缺少日记 ID'))
      return
    }

    try {
      const result = await window.api.vcpDiary.delete({ entryId: note.id })
      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }
      window.toast.success(t('vcp.dailynote.delete_success', '日记已删除'))
      loadNotes(selectedNotebook)
      loadNotebooks() // 刷新统计
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 使用后端搜索 - 优先使用 Tantivy 全文搜索，fallback 到 VCP 搜索
  const handleSearch = useCallback(async () => {
    if (!searchText) {
      setIsSearchMode(false)
      setLastSearchQuery('')
      return
    }

    setLoading(true)
    try {
      // 优先使用 Note_FullTextSearch (Tantivy + jieba)
      const fullTextResult = await window.api.dailyNoteWrite.fullTextSearch({
        query: searchText,
        limit: 50
      })

      if (fullTextResult.success && fullTextResult.results && fullTextResult.results.length > 0) {
        // 如果选择了日记本，过滤结果
        let results = fullTextResult.results
        if (selectedNotebook) {
          results = results.filter(
            (r) =>
              r.filePath.includes(selectedNotebook) ||
              (r as any).characterName === selectedNotebook ||
              r.title.includes(selectedNotebook)
          )
        }

        setNotes(
          results.map((entry) => ({
            id: entry.id,
            folderName: selectedNotebook || extractFolderName(entry.filePath),
            name: entry.title || pathUtils.basename(entry.filePath),
            mtime: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
            preview: entry.content.substring(0, 200),
            content: entry.content,
            tags: entry.tags || []
          }))
        )
        // 设置搜索模式，用于显示反馈按钮
        setIsSearchMode(true)
        setLastSearchQuery(searchText)
        return
      }

      // Fallback: 使用 VCP 日记搜索
      if (selectedNotebook) {
        const result = await window.api.vcpDiary.search({
          query: searchText,
          characterName: selectedNotebook,
          limit: 50
        })

        if (result.success && result.entries) {
          setNotes(
            result.entries.map((entry) => ({
              id: entry.id,
              folderName: selectedNotebook,
              name: entry.date + '.txt',
              mtime: new Date(entry.date).getTime(),
              preview: entry.content.substring(0, 200),
              content: entry.content,
              tags: entry.tags
            }))
          )
          // 设置搜索模式
          setIsSearchMode(true)
          setLastSearchQuery(searchText)
        }
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }, [searchText, selectedNotebook])

  // 格式化时间
  const formatTime = useCallback(
    (mtime: number) => {
      const d = new Date(mtime)
      const now = Date.now()
      const diff = now - mtime

      if (diff < 1000 * 60 * 10) {
        return t('vcp.dailynote.time_just_now', '刚刚')
      } else if (diff < 1000 * 60 * 60) {
        const minutes = Math.floor(diff / (1000 * 60))
        return t('vcp.dailynote.time_minutes_ago', '{{n}} 分钟前', { n: minutes })
      } else if (diff < 1000 * 60 * 60 * 24) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        return t('vcp.dailynote.time_hours_ago', '{{n}} 小时前', { n: hours })
      }
      return d.toLocaleString()
    },
    [t]
  )

  // 获取时间标签颜色
  const getTimeColor = (mtime: number) => {
    const diff = Date.now() - mtime
    if (diff < 1000 * 60 * 10) return 'green' // 10分钟内
    if (diff < 1000 * 60 * 30) return 'gold' // 30分钟内
    return 'default'
  }

  // 获取模式标题和图标
  const getModeTitle = () => {
    switch (mode) {
      case 'memory':
        return { icon: <DatabaseOutlined />, title: t('vcp.memory.title', '记忆管理') }
      case 'global':
        return { icon: <GlobalOutlined />, title: t('vcp.dailynote.global_title', '全局日记') }
      case 'character':
      default:
        return { icon: <RobotOutlined />, title: t('vcp.dailynote.character_title', '角色日记') }
    }
  }

  const { icon: modeIcon, title: modeTitle } = getModeTitle()

  // Memory 模式的特殊 UI
  if (mode === 'memory') {
    return (
      <Container>
        <Header>
          <HeaderLeft>
            <Title level={4} style={{ margin: 0 }}>
              {modeIcon}
              <span style={{ marginLeft: 8 }}>{modeTitle}</span>
            </Title>
          </HeaderLeft>
          <ToolBar>
            <Button type="primary" icon={<SearchOutlined />} onClick={openUnifiedSearch}>
              {t('vcp.memory.unified_search', '统一搜索')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadAllMemoryStats} loading={loading}>
              {t('common.refresh', '刷新')}
            </Button>
          </ToolBar>
        </Header>

        {/* 记忆系统统计卡片 */}
        <MemoryStatsGrid>
          <MemoryStatCard>
            <Statistic
              title={t('vcp.memory.search_status', '搜索引擎状态')}
              value={memoryStats?.searchAvailable ? t('vcp.memory.available', '可用') : t('vcp.memory.unavailable', '不可用')}
              valueStyle={{ color: memoryStats?.searchAvailable ? '#52c41a' : '#ff4d4f' }}
              prefix={<DatabaseOutlined />}
            />
          </MemoryStatCard>
          <MemoryStatCard>
            <Statistic
              title={t('vcp.memory.document_count', '日记/笔记')}
              value={memoryStats?.documentCount || 0}
              suffix={t('vcp.memory.entries', '篇')}
              prefix={<BookOutlined />}
            />
          </MemoryStatCard>
          <MemoryStatCard>
            <Statistic
              title={t('vcp.memory.forum_posts', '论坛帖子')}
              value={forumStats?.totalPosts || 0}
              suffix={t('vcp.memory.posts', '帖')}
              prefix={<MessageOutlined />}
            />
          </MemoryStatCard>
          <MemoryStatCard>
            <Statistic
              title={t('vcp.memory.thought_clusters', '思维簇')}
              value={clusterStats?.clusterCount || 0}
              suffix={`${t('vcp.memory.clusters', '簇')} / ${clusterStats?.totalFiles || 0}${t('vcp.memory.files', '文件')}`}
              prefix={<BranchesOutlined />}
            />
          </MemoryStatCard>
        </MemoryStatsGrid>

        {/* 索引控制 */}
        <MemoryControlCard>
          <Title level={5}>{t('vcp.memory.index_control', '索引控制')}</Title>
          <MemoryControlRow>
            <Text>{t('vcp.memory.init_index_desc', '重建搜索索引（将扫描所有日记并建立全文索引）')}</Text>
            <Button
              type="primary"
              icon={<SyncOutlined spin={indexing} />}
              onClick={initSearchIndex}
              loading={indexing}
              disabled={indexing}>
              {indexing ? t('vcp.memory.indexing', '索引中...') : t('vcp.memory.rebuild_index', '重建索引')}
            </Button>
          </MemoryControlRow>
          {indexing && (
            <Progress percent={100} status="active" showInfo={false} style={{ marginTop: 12 }} />
          )}
        </MemoryControlCard>

        {/* 日记统计 */}
        {stats && (
          <MemoryControlCard>
            <Title level={5}>{t('vcp.memory.diary_stats', '日记统计')}</Title>
            <StatsRow>
              <Statistic title={t('vcp.dailynote.stats_books', '日记本')} value={stats.bookCount} />
              <Statistic title={t('vcp.dailynote.stats_entries', '条目')} value={stats.entryCount} />
              <Statistic title={t('vcp.dailynote.stats_tags', '标签')} value={stats.tagCount} />
            </StatsRow>
          </MemoryControlCard>
        )}

        {/* 已索引文档列表 */}
        <MemoryControlCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>{t('vcp.memory.document_list', '已索引文档')}</Title>
            <Space>
              <Select
                value={sortMode}
                onChange={setSortMode}
                options={SORT_OPTIONS}
                style={{ width: 120 }}
                size="small"
              />
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => loadNotes(null)}
                loading={loading}
              >
                {t('common.refresh', '刷新')}
              </Button>
            </Space>
          </div>
          {loading ? (
            <LoadingContainer style={{ minHeight: 150 }}>
              <Spin tip={t('vcp.dailynote.loading', '加载中...')} />
            </LoadingContainer>
          ) : sortedNotes.length === 0 ? (
            <Empty description={t('vcp.memory.no_documents', '暂无已索引文档')} />
          ) : (
            <DocumentListContainer>
              {sortedNotes.slice(0, 50).map((note) => (
                <DocumentItem key={`${note.folderName}/${note.name}`} onClick={() => navigateToNote(note)}>
                  <DocumentIcon>
                    <BookOutlined />
                  </DocumentIcon>
                  <DocumentInfo>
                    <DocumentTitle>{note.name.replace('.txt', '').replace('.md', '')}</DocumentTitle>
                    <DocumentMeta>
                      <Tag color="blue" style={{ marginRight: 4 }}>{note.folderName}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(note.mtime)}</Text>
                    </DocumentMeta>
                    {note.preview && (
                      <DocumentPreview>{note.preview.slice(0, 80)}...</DocumentPreview>
                    )}
                    {note.tags && note.tags.length > 0 && (
                      <DocumentTags>
                        {note.tags.slice(0, 3).map((tag) => (
                          <Tag key={tag} color="processing" style={{ fontSize: 11 }}>{tag}</Tag>
                        ))}
                        {note.tags.length > 3 && <Tag style={{ fontSize: 11 }}>+{note.tags.length - 3}</Tag>}
                      </DocumentTags>
                    )}
                  </DocumentInfo>
                </DocumentItem>
              ))}
              {sortedNotes.length > 50 && (
                <Text type="secondary" style={{ textAlign: 'center', display: 'block', marginTop: 12 }}>
                  {t('vcp.memory.more_documents', '还有 {{count}} 篇文档未显示', { count: sortedNotes.length - 50 })}
                </Text>
              )}
            </DocumentListContainer>
          )}
        </MemoryControlCard>

        {/* VCP 搜索语法说明 */}
        <MemoryControlCard>
          <Title level={5}>{t('vcp.memory.search_syntax', 'VCP 搜索语法')}</Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t('vcp.memory.search_syntax_desc', '在系统提示词中使用以下语法进行日记检索：')}
          </Paragraph>
          <SyntaxTable>
            <tbody>
              <tr>
                <td><code>{'{{日记本}}'}</code></td>
                <td>{t('vcp.memory.syntax_fulltext', '全文注入')}</td>
              </tr>
              <tr>
                <td><code>{'[[日记本]]'}</code></td>
                <td>{t('vcp.memory.syntax_rag', 'RAG 片段检索')}</td>
              </tr>
              <tr>
                <td><code>{'[[日记本::TagMemo0.65]]'}</code></td>
                <td>{t('vcp.memory.syntax_tagmemo', '标签共现增强')}</td>
              </tr>
              <tr>
                <td><code>{'[[日记本::Time]]'}</code></td>
                <td>{t('vcp.memory.syntax_time', '时间感知过滤')}</td>
              </tr>
              <tr>
                <td><code>{'[[日记本::AIMemo]]'}</code></td>
                <td>{t('vcp.memory.syntax_aimemo', 'AI 综合召回')}</td>
              </tr>
              <tr>
                <td><code>{'[[日记本::Rerank]]'}</code></td>
                <td>{t('vcp.memory.syntax_rerank', '精排重排序')}</td>
              </tr>
            </tbody>
          </SyntaxTable>
        </MemoryControlCard>
      </Container>
    )
  }

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title level={4} style={{ margin: 0 }}>
            {modeIcon}
            <span style={{ marginLeft: 8 }}>{modeTitle}</span>
          </Title>
          {/* 统计信息 */}
          {stats && (
            <StatsRow>
              <Statistic title={t('vcp.dailynote.stats_books', '日记本')} value={stats.bookCount} />
              <Statistic title={t('vcp.dailynote.stats_entries', '条目')} value={stats.entryCount} />
              <Statistic title={t('vcp.dailynote.stats_tags', '标签')} value={stats.tagCount} />
            </StatsRow>
          )}
        </HeaderLeft>
        <ToolBar>
          <Select
            value={selectedNotebook}
            onChange={setSelectedNotebook}
            placeholder={t('vcp.dailynote.select_notebook', '选择日记本')}
            style={{ width: 180 }}
            allowClear>
            {/* 全局日记选项 */}
            <Select.Option key="__global__" value="">
              <BookOutlined style={{ marginRight: 4 }} />
              {t('vcp.dailynote.all_notes', '全部日记')}
            </Select.Option>
            <Select.OptGroup label={t('vcp.dailynote.notebooks', '日记本')}>
              {notebooks.map((nb) => (
                <Select.Option key={nb.name} value={nb.name}>
                  {nb.assistantId ? <RobotOutlined style={{ marginRight: 4 }} /> : <BookOutlined style={{ marginRight: 4 }} />}
                  {nb.name} ({nb.noteCount})
                </Select.Option>
              ))}
            </Select.OptGroup>
          </Select>
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder={t('vcp.dailynote.search_placeholder', '搜索日记...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 220 }}
            allowClear
            enterButton
          />
          <Select value={sortMode} onChange={setSortMode} options={SORT_OPTIONS} style={{ width: 120 }} />
          <Button icon={<ReloadOutlined />} onClick={() => loadNotes(selectedNotebook)} loading={loading}>
            {t('common.refresh', '刷新')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewEntryDialog} disabled={!selectedNotebook}>
            {t('vcp.dailynote.new_entry', '新建日记')}
          </Button>
        </ToolBar>
      </Header>

      {/* 日记本概览 - 只在未选择任何选项时显示 */}
      {selectedNotebook === null && (
        <NotebooksGrid>
          {notebooks.map((nb) => (
            <NotebookCard key={nb.name} hoverable onClick={() => setSelectedNotebook(nb.name)}>
              <NotebookIcon $hasAssistant={!!nb.assistantId}>
                {nb.assistantId ? <RobotOutlined /> : <BookOutlined />}
              </NotebookIcon>
              <NotebookInfo>
                <NotebookName>{t('vcp.dailynote.notebook_name', '{{name}}的日记本', { name: nb.name })}</NotebookName>
                <NotebookMeta>
                  <span>{t('vcp.dailynote.note_count', '{{count}} 篇日记', { count: nb.noteCount })}</span>
                  {nb.assistantId && (
                    <Tag color="blue" icon={<RobotOutlined />} style={{ marginLeft: 8 }}>
                      {nb.assistantName || t('vcp.dailynote.linked_assistant', '已关联助手')}
                    </Tag>
                  )}
                  {nb.latestMtime && (
                    <Tag color={getTimeColor(nb.latestMtime)} style={{ marginLeft: 8 }}>
                      {formatTime(nb.latestMtime)}
                    </Tag>
                  )}
                </NotebookMeta>
              </NotebookInfo>
            </NotebookCard>
          ))}
          {/* 未关联的助手列表 - 可创建新日记本 */}
          {assistants
            .filter((a) => !notebooks.some((nb) => nb.assistantId === a.id))
            .slice(0, 6)
            .map((a) => (
              <NotebookCard
                key={`assistant-${a.id}`}
                hoverable
                onClick={() => setSelectedNotebook(a.name || (a as any).displayName || a.id)}
                style={{ borderStyle: 'dashed', opacity: 0.7 }}>
                <NotebookIcon $hasAssistant={true}>
                  <UserOutlined />
                </NotebookIcon>
                <NotebookInfo>
                  <NotebookName>
                    {t('vcp.dailynote.create_for_assistant', '为 {{name}} 创建日记本', {
                      name: a.name || (a as any).displayName
                    })}
                  </NotebookName>
                  <NotebookMeta>
                    <Tag color="default" icon={<PlusOutlined />}>
                      {t('vcp.dailynote.click_to_create', '点击创建')}
                    </Tag>
                  </NotebookMeta>
                </NotebookInfo>
              </NotebookCard>
            ))}
        </NotebooksGrid>
      )}

      {/* 日记列表 - 当选择日记本或全局日记时显示 */}
      {selectedNotebook !== null && (
        <>
          <StatsBar>
            <StatItem>
              <StatLabel>{t('vcp.dailynote.stats_notebook', '日记本:')}</StatLabel>
              <StatValue>{selectedNotebook || t('vcp.dailynote.all_notes', '全部日记')}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>{t('vcp.dailynote.stats_total', '共:')}</StatLabel>
              <StatValue>{t('vcp.dailynote.stats_count', '{{count}} 篇', { count: filteredNotes.length })}</StatValue>
            </StatItem>
          </StatsBar>

          {loading ? (
            <LoadingContainer>
              <Spin tip={t('vcp.dailynote.loading', '加载中...')} />
            </LoadingContainer>
          ) : filteredNotes.length === 0 ? (
            <Empty description={t('vcp.dailynote.no_notes', '暂无日记')} />
          ) : (
            <NotesGrid>
              {filteredNotes.map((note) => (
                <NoteCard key={`${note.folderName}/${note.name}`} hoverable onClick={() => navigateToNote(note)}>
                  <NoteHeader>
                    <NoteTitle>{note.name.replace('.txt', '')}</NoteTitle>
                    <Space>
                      <Tag color={getTimeColor(note.mtime)}>{formatTime(note.mtime)}</Tag>
                      <Popconfirm
                        title={t('vcp.dailynote.delete_confirm', '确定删除这篇日记吗？')}
                        onConfirm={(e) => handleDelete(note, e as unknown as React.MouseEvent)}
                        onCancel={(e) => e?.stopPropagation()}
                        okText={t('common.confirm', '确定')}
                        cancelText={t('common.cancel', '取消')}>
                        <Tooltip title={t('common.delete', '删除')}>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </NoteHeader>
                  <NotePreview>{note.preview || t('vcp.dailynote.no_preview', '无预览')}</NotePreview>
                  {/* 标签显示 */}
                  {note.tags && note.tags.length > 0 && (
                    <TagsRow>
                      <TagOutlined style={{ marginRight: 4, color: 'var(--color-text-3)' }} />
                      {note.tags.slice(0, 4).map((tag) => (
                        <Tag key={tag} color="processing">
                          {tag}
                        </Tag>
                      ))}
                      {note.tags.length > 4 && <Tag>+{note.tags.length - 4}</Tag>}
                    </TagsRow>
                  )}
                  <NoteFooter>
                    <Text type="secondary">
                      <EditOutlined /> {t('vcp.dailynote.click_to_edit', '点击编辑')}
                    </Text>
                    {/* 搜索模式下显示反馈按钮 */}
                    {isSearchMode && note.id && (
                      <FeedbackContainer onClick={(e) => e.stopPropagation()}>
                        <SearchResultFeedback
                          result={{
                            id: note.id,
                            query: lastSearchQuery,
                            tags: note.tags,
                            source: 'diary',
                            characterName: note.folderName
                          }}
                          compact
                        />
                      </FeedbackContainer>
                    )}
                  </NoteFooter>
                </NoteCard>
              ))}
            </NotesGrid>
          )}
        </>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title={isNewEntry ? t('vcp.dailynote.new_entry', '新建日记') : `${t('vcp.dailynote.edit_entry', '编辑日记')} - ${selectedNote?.name || ''}`}
        open={editorVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditorVisible(false)
          setIsNewEntry(false)
        }}
        width={700}
        okText={t('common.save', '保存')}
        cancelText={t('common.cancel', '取消')}
        confirmLoading={saving}>
        {selectedNote && (
          <>
            <NoteMeta>
              <Tag color="blue">{selectedNote.folderName}</Tag>
              {isNewEntry ? (
                <Input
                  value={newEntryDate}
                  onChange={(e) => setNewEntryDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  style={{ width: 150 }}
                />
              ) : (
                <Text type="secondary">{formatTime(selectedNote.mtime)}</Text>
              )}
            </NoteMeta>
            <TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={12}
              style={{ marginTop: 12, fontFamily: 'monospace' }}
              placeholder={t('vcp.dailynote.content_placeholder', '日记内容...')}
            />
            {/* 标签编辑 */}
            <TagEditRow>
              <TagOutlined style={{ marginRight: 8 }} />
              <Select
                mode="tags"
                style={{ flex: 1 }}
                placeholder={t('vcp.dailynote.tags_placeholder', '添加标签（回车确认）')}
                value={editTags}
                onChange={setEditTags}
                tokenSeparators={[',']}
              />
            </TagEditRow>
            <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
              {t('vcp.dailynote.tag_tip', '提示: 日记末尾添加 "Tag: 关键词1, 关键词2" 可以自动打标签')}
            </Paragraph>
          </>
        )}
      </Modal>
    </Container>
  )
}

// Styled Components
const Container = styled.div`
  padding: 20px;
  height: 100%;
  overflow-y: auto;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`

const StatsRow = styled.div`
  display: flex;
  gap: 24px;

  .ant-statistic {
    .ant-statistic-title {
      font-size: 12px;
      color: var(--color-text-3);
    }
    .ant-statistic-content {
      font-size: 16px;
    }
  }
`

const ToolBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
`

const NotebooksGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`

const NotebookCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }

  .ant-card-body {
    display: flex;
    align-items: center;
    gap: 16px;
  }
`

const NotebookIcon = styled.div<{ $hasAssistant?: boolean }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${({ $hasAssistant }) => ($hasAssistant ? 'var(--color-info-bg)' : 'var(--color-primary-bg)')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: ${({ $hasAssistant }) => ($hasAssistant ? 'var(--color-info)' : 'var(--color-primary)')};
`

const NotebookInfo = styled.div`
  flex: 1;
`

const NotebookName = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
`

const NotebookMeta = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  display: flex;
  align-items: center;
`

const StatsBar = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const StatLabel = styled.span`
  color: var(--color-text-2);
  font-size: 13px;
`

const StatValue = styled.span`
  font-weight: 600;
  font-size: 14px;
`

const NotesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`

const NoteCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }
`

const NoteHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const NoteTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
`

const NotePreview = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 12px;
`

const TagsRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
`

const NoteFooter = styled.div`
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const FeedbackContainer = styled.div`
  display: flex;
  align-items: center;
`

const NoteMeta = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`

const TagEditRow = styled.div`
  display: flex;
  align-items: center;
  margin-top: 12px;
`

// Memory 模式样式组件
const MemoryStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`

const MemoryStatCard = styled(Card)`
  .ant-statistic {
    .ant-statistic-title {
      font-size: 13px;
      color: var(--color-text-2);
    }
    .ant-statistic-content {
      font-size: 20px;
    }
  }
`

const MemoryControlCard = styled(Card)`
  margin-bottom: 16px;

  .ant-typography {
    margin-bottom: 12px;
  }
`

const MemoryControlRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`

const SyntaxTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
  }

  td:first-child {
    width: 200px;
    font-family: monospace;

    code {
      background: var(--color-background-soft);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--color-primary);
    }
  }

  tr:last-child td {
    border-bottom: none;
  }
`

// 文档列表样式组件
const DocumentListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
`

const DocumentItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--color-primary-bg);
    transform: translateX(4px);
  }
`

const DocumentIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--color-primary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--color-primary);
  flex-shrink: 0;
`

const DocumentInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const DocumentTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const DocumentMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
`

const DocumentPreview = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
`

const DocumentTags = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
`

export default DailyNotePanel
