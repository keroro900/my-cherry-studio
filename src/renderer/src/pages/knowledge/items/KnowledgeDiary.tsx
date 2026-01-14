/**
 * VCP 日记知识库组件
 *
 * 提供:
 * - 日记编辑器 (VCP 语法高亮)
 * - 知识库浏览器
 * - RAG 标签管理
 *
 * 架构融合:
 * - 使用类型安全的 window.api.* 调用
 * - 动态加载语义组 (非静态配置)
 * - 支持 VCP Agent 关联的知识库
 * - 与 DailyNoteService 完整集成
 *
 * @refactored Phase 5 - 改进 API 调用方式和语义组加载
 */

import type { KnowledgeBase } from '@renderer/types'
import { message, Tabs } from 'antd'
import { BookOpen, Edit3, Tags } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import { DiaryEditor, KnowledgeBrowser, RAGTagsManager } from '../components/Diary'
import type { DiaryFile, RAGTag, SemanticGroup } from '../components/Diary/types'

interface KnowledgeDiaryProps {
  selectedBase: KnowledgeBase
}

/**
 * 从 IPC 响应转换为 DiaryFile 格式
 */
function convertToDiaryFile(entry: any): DiaryFile {
  const fileName = entry.title || `${entry.date}.md`
  return {
    id: entry.id,
    name: fileName,
    path: `diary/${fileName}`,
    content: entry.content || '',
    size: (entry.content || '').length,
    isIndexed: true,
    chunks: [],
    createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date()
  }
}

/**
 * 从条目中提取标签统计
 */
function extractTagsFromEntries(entries: any[]): RAGTag[] {
  const tagCounts = new Map<string, number>()

  for (const entry of entries) {
    if (entry.tags && Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
  }

  // 生成颜色数组
  const colors = ['#52c41a', '#1890ff', '#722ed1', '#fa541c', '#13c2c2', '#eb2f96']

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count], index) => ({
      id: `tag-${name}`,
      name,
      color: colors[index % colors.length],
      count,
      relatedTags: []
    }))
}

/**
 * VCP 日记知识库组件
 */
const KnowledgeDiary: FC<KnowledgeDiaryProps> = ({ selectedBase }) => {
  const [activeTab, setActiveTab] = useState('editor')
  const [loading, setLoading] = useState(false)

  // 日记内容状态
  const [diaryContent, setDiaryContent] = useState('')

  // 日记文件列表
  const [diaryFiles, setDiaryFiles] = useState<DiaryFile[]>([])

  // RAG 标签
  const [ragTags, setRagTags] = useState<RAGTag[]>([])

  // 语义组 (动态从 SemanticGroupService 加载)
  const [semanticGroups, setSemanticGroups] = useState<SemanticGroup[]>([])

  // 加载语义组
  const loadSemanticGroups = useCallback(async () => {
    try {
      const result = await window.api.semanticGroup.listGroups()
      if (result.success && result.groups) {
        // 转换 API 格式到组件格式
        const groups: SemanticGroup[] = result.groups.map((g) => ({
          id: g.id,
          name: g.name,
          category: g.description || 'general',
          keywords: g.keywords,
          weight: g.priority || 1.0
        }))
        setSemanticGroups(groups)
      }
    } catch (error) {
      console.error('Failed to load semantic groups:', error)
      // 失败时使用空数组，不影响其他功能
      setSemanticGroups([])
    }
  }, [])

  // 加载日记数据
  const loadDiaryData = useCallback(async () => {
    setLoading(true)
    try {
      // 使用类型安全的 API 调用
      const result = await window.api.vcpDiary.list({
        characterName: selectedBase.name,
        includeContent: true
      })

      if (result.success && result.entries) {
        const files = result.entries.map(convertToDiaryFile)
        setDiaryFiles(files)
        setRagTags(extractTagsFromEntries(result.entries))
      } else {
        // 如果没有找到，尝试使用知识库ID
        const resultById = await window.api.vcpDiary.list({
          characterName: selectedBase.id,
          includeContent: true
        })

        if (resultById.success && resultById.entries) {
          const files = resultById.entries.map(convertToDiaryFile)
          setDiaryFiles(files)
          setRagTags(extractTagsFromEntries(resultById.entries))
        } else {
          setDiaryFiles([])
          setRagTags([])
        }
      }
    } catch (error) {
      console.error('Failed to load diary data:', error)
      message.error('加载日记数据失败')
      setDiaryFiles([])
      setRagTags([])
    } finally {
      setLoading(false)
    }
  }, [selectedBase.name, selectedBase.id])

  // 组件挂载时加载数据
  useEffect(() => {
    loadDiaryData()
    loadSemanticGroups()
  }, [loadDiaryData, loadSemanticGroups])

  // 处理日记内容变化
  const handleDiaryChange = useCallback((value: string) => {
    setDiaryContent(value)
  }, [])

  // 处理文件选择
  const handleFileSelect = useCallback((file: DiaryFile) => {
    setDiaryContent(file.content)
    setActiveTab('editor')
  }, [])

  // 处理编辑文件
  const handleEditFile = useCallback((file: DiaryFile) => {
    setDiaryContent(file.content)
    setActiveTab('editor')
  }, [])

  // 处理删除文件
  const handleDeleteFile = useCallback(
    async (file: DiaryFile) => {
      try {
        // 使用类型安全的 API 调用
        const result = await window.api.vcpDiary.delete({
          entryId: file.id
        })

        if (result.success) {
          message.success('日记已删除')
          loadDiaryData()
        } else {
          message.error(result.error || '删除失败')
        }
      } catch (error) {
        console.error('Failed to delete diary:', error)
        message.error('删除失败')
      }
    },
    [loadDiaryData]
  )

  // 处理重新索引
  const handleReindexFile = useCallback(
    async (file: DiaryFile) => {
      try {
        message.loading({ content: `正在重新索引: ${file.name}`, key: 'reindex', duration: 0 })

        // 方案1: 通过编辑 API 触发重新索引 (更新内容时会重新计算向量)
        const editResult = await window.api.vcpDiary.edit({
          entryId: file.id,
          content: file.content // 使用相同内容触发重新索引
        })

        if (!editResult.success) {
          throw new Error(editResult.error || '重新索引失败')
        }

        // 方案2: 同时添加到高级记忆系统 (可选，增强检索能力)
        try {
          await window.api.integratedMemory.addDocument({
            backend: 'lightmemo',
            document: {
              id: `diary-${file.id}`,
              content: file.content,
              metadata: {
                source: 'diary',
                fileName: file.name,
                knowledgeBase: selectedBase.name,
                createdAt: file.createdAt?.toISOString(),
                updatedAt: new Date().toISOString()
              }
            }
          })
        } catch {
          // 高级记忆系统添加失败不影响主流程
          console.warn('添加到高级记忆系统失败，但主索引已更新')
        }

        message.success({ content: `${file.name} 重新索引成功`, key: 'reindex' })
        loadDiaryData()
      } catch (error) {
        console.error('Failed to reindex diary:', error)
        message.error({ content: `重新索引失败: ${error instanceof Error ? error.message : '未知错误'}`, key: 'reindex' })
      }
    },
    [selectedBase.name, loadDiaryData]
  )

  // 创建标签 (将标签添加到符合条件的日记条目)
  const handleCreateTag = useCallback(
    async (tag: Omit<RAGTag, 'id' | 'count' | 'relatedTags'>) => {
      try {
        message.loading({ content: `正在创建标签: ${tag.name}`, key: 'createTag', duration: 0 })

        // 标签在日记系统中是存储在每个条目的 tags 字段中
        // 创建标签意味着将该标签添加到相关的日记条目

        // 首先搜索可能相关的日记条目 (使用标签名作为关键词)
        const searchResult = await window.api.vcpDiary.search({
          query: tag.name,
          characterName: selectedBase.name,
          limit: 10
        })

        if (searchResult.success && searchResult.entries && searchResult.entries.length > 0) {
          // 找到相关条目，为它们添加新标签
          let updatedCount = 0
          for (const entry of searchResult.entries) {
            // 检查条目是否已有该标签
            if (!entry.tags.includes(tag.name)) {
              const editResult = await window.api.vcpDiary.edit({
                entryId: entry.id,
                tags: [...entry.tags, tag.name]
              })
              if (editResult.success) {
                updatedCount++
              }
            }
          }

          if (updatedCount > 0) {
            message.success({
              content: `标签 "${tag.name}" 已添加到 ${updatedCount} 个相关日记条目`,
              key: 'createTag'
            })
          } else {
            message.info({
              content: `标签 "${tag.name}" 已存在于所有相关条目中`,
              key: 'createTag'
            })
          }
        } else {
          // 没有找到相关条目，存储到本地标签注册表供后续使用
          const customTagsKey = `diary-custom-tags-${selectedBase.id}`
          const existingTags = JSON.parse(localStorage.getItem(customTagsKey) || '[]')
          if (!existingTags.includes(tag.name)) {
            existingTags.push(tag.name)
            localStorage.setItem(customTagsKey, JSON.stringify(existingTags))
          }
          message.info({
            content: `标签 "${tag.name}" 已保存，将在新建日记时可用`,
            key: 'createTag'
          })
        }

        loadDiaryData()
      } catch (error) {
        console.error('Failed to create tag:', error)
        message.error({
          content: `创建标签失败: ${error instanceof Error ? error.message : '未知错误'}`,
          key: 'createTag'
        })
      }
    },
    [selectedBase.name, selectedBase.id, loadDiaryData]
  )

  // 创建语义组
  const handleCreateGroup = useCallback(
    async (group: Omit<SemanticGroup, 'id'>) => {
      try {
        const result = await window.api.semanticGroup.addGroup({
          id: `group-${Date.now()}`,
          name: group.name,
          description: group.category,
          keywords: group.keywords,
          priority: group.weight
        })

        if (result.success) {
          message.success(`语义组 "${group.name}" 创建成功`)
          loadSemanticGroups()
        } else {
          message.error(result.error || '创建语义组失败')
        }
      } catch (error) {
        console.error('Failed to create semantic group:', error)
        message.error('创建语义组失败')
      }
    },
    [loadSemanticGroups]
  )

  // 标签页配置
  const tabItems = [
    {
      key: 'editor',
      label: (
        <TabLabel>
          <Edit3 size={16} />
          <span>日记编辑</span>
        </TabLabel>
      ),
      children: (
        <TabContent>
          <DiaryEditor
            value={diaryContent}
            onChange={handleDiaryChange}
            showPreview={true}
            showLegend={true}
            placeholder={`输入日记内容...

使用 [[${selectedBase.name}]] 插入 RAG 检索
使用 {{${selectedBase.name}}} 插入全文注入
使用 <<${selectedBase.name}>> 阈值全文
使用 《《${selectedBase.name}》》 阈值 RAG`}
          />
        </TabContent>
      )
    },
    {
      key: 'browser',
      label: (
        <TabLabel>
          <BookOpen size={16} />
          <span>知识浏览</span>
        </TabLabel>
      ),
      children: (
        <TabContent>
          <KnowledgeBrowser
            files={diaryFiles}
            tags={ragTags}
            loading={loading}
            onFileSelect={handleFileSelect}
            onEditFile={handleEditFile}
            onDeleteFile={handleDeleteFile}
            onReindexFile={handleReindexFile}
          />
        </TabContent>
      )
    },
    {
      key: 'tags',
      label: (
        <TabLabel>
          <Tags size={16} />
          <span>标签管理</span>
        </TabLabel>
      ),
      children: (
        <TabContent>
          <RAGTagsManager
            tags={ragTags}
            semanticGroups={semanticGroups}
            onCreateTag={handleCreateTag}
            onCreateGroup={handleCreateGroup}
          />
        </TabContent>
      )
    }
  ]

  return (
    <Container>
      <Header>
        <Title>VCP 日记模式</Title>
        <Description>使用 VCP 语法声明知识库检索方式，支持 4 种检索模式</Description>
      </Header>
      <StyledTabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" size="small" />
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  padding: 16px;
`

const Header = styled.div`
  margin-bottom: 16px;
`

const Title = styled.h3`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
`

const Description = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
`

const TabLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const TabContent = styled.div`
  height: calc(100vh - 300px);
  overflow: hidden;
`

const StyledTabs = styled(Tabs)`
  flex: 1;
  display: flex;
  flex-direction: column;

  .ant-tabs-content {
    flex: 1;
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
  }
`

export default KnowledgeDiary
