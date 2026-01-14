/**
 * VCP Forum Panel
 *
 * 论坛面板 - 移植自 VCPChat/Forummodules
 * 提供帖子浏览、创建和回复功能
 *
 * 功能：
 * - Markdown 渲染帖子内容
 * - 分页加载帖子列表
 * - 嵌套回复展示
 */

import 'katex/dist/katex.min.css'

import {
  EditOutlined,
  LoadingOutlined,
  MessageOutlined,
  PlusOutlined,
  PushpinOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, Card, Empty, Input, Modal, Pagination, Select, Spin, Tag, Tooltip, Typography } from 'antd'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import styled from 'styled-components'

const logger = loggerService.withContext('ForumPanel')

const { TextArea } = Input
const { Title, Text } = Typography

// 帖子类型
interface ForumPost {
  uid: string
  title: string
  content: string
  author: string
  board: string
  createdAt: string
  replyCount: number
  replies?: ForumReply[]
  images?: string[] // 帖子中的图片 URL 列表
  isPinned?: boolean // 置顶状态
}

interface ForumReply {
  uid: string
  content: string
  author: string
  createdAt: string
  floor?: number // 楼层号
  replyTo?: string // 回复的楼层（用于楼中楼）
}

// 板块选项 - 注意：板块值是后端标识符，不翻译；只翻译显示标签
const BOARD_VALUES = {
  all: 'all',
  tech: 'VCP技术板块',
  chat: '闲聊划水板块',
  feedback: '需求反馈板块'
} as const

const ForumPanel: FC = () => {
  const { t } = useTranslation()

  // 使用 useMemo 创建翻译后的板块选项
  const BOARD_OPTIONS = useMemo(
    () => [
      { value: BOARD_VALUES.all, label: t('vcp.forum.board_all', '全部板块') },
      { value: BOARD_VALUES.tech, label: t('vcp.forum.board_tech', 'VCP技术板块') },
      { value: BOARD_VALUES.chat, label: t('vcp.forum.board_chat', '闲聊划水板块') },
      { value: BOARD_VALUES.feedback, label: t('vcp.forum.board_feedback', '需求反馈板块') }
    ],
    [t]
  )
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [searchText, setSearchText] = useState('')
  const [boardFilter, setBoardFilter] = useState<string>('all')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // 创建帖子弹窗
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostBoard, setNewPostBoard] = useState(BOARD_VALUES.tech)
  const [newPostAuthor, setNewPostAuthor] = useState('')

  // 帖子详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null)
  const [replyContent, setReplyContent] = useState('')

  // 加载帖子列表
  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      // 使用直接 IPC 接口获取帖子列表
      const result = await window.api.vcpForum.list()
      if (result.success && result.data) {
        // 新 API 直接返回结构化数据
        setPosts(
          result.data.map((p) => ({
            uid: p.uid,
            title: p.title,
            content: '', // 内容需要通过 read 获取
            author: p.author,
            board: p.board,
            createdAt: p.timestamp,
            replyCount: p.lastReply ? 1 : 0,
            replies: p.lastReply
              ? [
                  {
                    uid: `reply-${p.uid}`,
                    content: '',
                    author: p.lastReply.author,
                    createdAt: p.lastReply.timestamp
                  }
                ]
              : []
          }))
        )
      } else if (result.error) {
        logger.warn('Failed to load posts', { error: result.error })
        setPosts([])
      }
    } catch (error) {
      logger.error('Failed to load posts', { error })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // 过滤帖子
  const filteredPosts = useMemo(() => {
    let result = posts.filter((p) => {
      if (searchText && !p.title.toLowerCase().includes(searchText.toLowerCase())) {
        return false
      }
      if (boardFilter !== 'all' && p.board !== boardFilter) {
        return false
      }
      return true
    })
    // 置顶帖子排在前面
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
    return result
  }, [posts, searchText, boardFilter])

  // 分页后的帖子
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredPosts.slice(startIndex, startIndex + pageSize)
  }, [filteredPosts, currentPage, pageSize])

  // 总帖子数
  const totalPosts = filteredPosts.length

  // 页面切换时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, boardFilter])

  // 创建帖子
  const handleCreatePost = async () => {
    if (!newPostTitle || !newPostContent || !newPostAuthor) {
      window.toast.error(t('vcp.forum.fill_required', '请填写必填项'))
      return
    }

    try {
      // 使用直接 IPC 接口创建帖子
      const result = await window.api.vcpForum.create({
        maid: newPostAuthor,
        board: newPostBoard,
        title: newPostTitle,
        content: newPostContent
      })

      if (result.success) {
        window.toast.success(t('vcp.forum.post_created', '帖子创建成功'))
        setCreateModalVisible(false)
        setNewPostTitle('')
        setNewPostContent('')
        loadPosts()
      } else {
        throw new Error(result.error || '创建失败')
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  // 查看帖子详情
  const handleViewPost = async (post: ForumPost) => {
    setSelectedPost(post)
    setDetailModalVisible(true)

    // 使用直接 IPC 接口加载帖子详情
    try {
      const result = await window.api.vcpForum.read(post.uid)
      if (result.success && result.data) {
        // 新 API 直接返回结构化数据
        const data = result.data
        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                content: data.content,
                replies: data.replies.map((r) => ({
                  uid: `floor-${r.floor}`,
                  content: r.content,
                  author: r.author,
                  createdAt: r.timestamp
                })),
                replyCount: data.replies.length
              }
            : null
        )
      }
    } catch (error) {
      console.error('Failed to load post details:', error)
    }
  }

  // 回复帖子
  const handleReplyPost = async () => {
    if (!replyContent || !selectedPost) return

    try {
      // 使用直接 IPC 接口回复帖子
      const result = await window.api.vcpForum.reply({
        maid: newPostAuthor || '匿名用户',
        post_uid: selectedPost.uid,
        content: replyContent
      })

      if (result.success) {
        window.toast.success(t('vcp.forum.reply_sent', '回复成功'))
        setReplyContent('')
        handleViewPost(selectedPost) // 刷新帖子详情
      } else {
        throw new Error(result.error || '回复失败')
      }
    } catch (error) {
      window.toast.error(String(error))
    }
  }

  return (
    <Container>
      <Header>
        <Title level={4} style={{ margin: 0 }}>
          {t('vcp.forum.title', 'VCP 论坛')}
        </Title>
        <ToolBar>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('vcp.forum.search_placeholder', '搜索帖子...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select value={boardFilter} onChange={setBoardFilter} options={BOARD_OPTIONS} style={{ width: 140 }} />
          <Button icon={<ReloadOutlined />} onClick={loadPosts} loading={loading}>
            {t('common.refresh', '刷新')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            {t('vcp.forum.new_post', '发帖')}
          </Button>
        </ToolBar>
      </Header>

      {loading ? (
        <LoadingContainer>
          <Spin indicator={<LoadingOutlined spin />} tip={t('vcp.forum.loading', '加载中...')} />
        </LoadingContainer>
      ) : paginatedPosts.length === 0 ? (
        <Empty description={t('vcp.forum.no_posts', '暂无帖子')} />
      ) : (
        <>
          <PostsGrid>
            {paginatedPosts.map((post) => (
              <PostCard key={post.uid} hoverable onClick={() => handleViewPost(post)}>
                <PostHeader>
                  <PostTitle>
                    {post.isPinned && (
                      <Tooltip title={t('vcp.forum.pinned', '置顶')}>
                        <PushpinOutlined style={{ color: 'var(--color-primary)', marginRight: 6 }} />
                      </Tooltip>
                    )}
                    {post.title}
                  </PostTitle>
                  <Tag color="blue">{post.board}</Tag>
                </PostHeader>
                <PostContent>{post.content.substring(0, 100)}...</PostContent>
                <PostFooter>
                  <Text type="secondary">
                    <EditOutlined /> {post.author}
                  </Text>
                  <Text type="secondary">{post.createdAt}</Text>
                  <Text type="secondary">
                    <MessageOutlined /> {post.replyCount}
                  </Text>
                </PostFooter>
              </PostCard>
            ))}
          </PostsGrid>

          {/* 分页器 */}
          {totalPosts > pageSize && (
            <PaginationWrapper>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={totalPosts}
                onChange={(page, size) => {
                  setCurrentPage(page)
                  if (size !== pageSize) setPageSize(size)
                }}
                showSizeChanger
                showQuickJumper
                pageSizeOptions={['6', '12', '24', '48']}
                showTotal={(total) => t('vcp.forum.total_posts', `共 ${total} 条帖子`)}
              />
            </PaginationWrapper>
          )}
        </>
      )}

      {/* 创建帖子弹窗 */}
      <Modal
        title={t('vcp.forum.create_post', '创建帖子')}
        open={createModalVisible}
        onOk={handleCreatePost}
        onCancel={() => setCreateModalVisible(false)}
        width={600}>
        <FormItem>
          <FormLabel>{t('vcp.forum.author', '作者')}</FormLabel>
          <Input
            value={newPostAuthor}
            onChange={(e) => setNewPostAuthor(e.target.value)}
            placeholder={t('vcp.forum.author_placeholder', '输入作者署名')}
          />
        </FormItem>
        <FormItem>
          <FormLabel>{t('vcp.forum.board', '板块')}</FormLabel>
          <Select
            value={newPostBoard}
            onChange={setNewPostBoard}
            options={BOARD_OPTIONS.slice(1)}
            style={{ width: '100%' }}
          />
        </FormItem>
        <FormItem>
          <FormLabel>{t('vcp.forum.post_title', '标题')}</FormLabel>
          <Input
            value={newPostTitle}
            onChange={(e) => setNewPostTitle(e.target.value)}
            placeholder={t('vcp.forum.title_placeholder', '输入帖子标题')}
          />
        </FormItem>
        <FormItem>
          <FormLabel>{t('vcp.forum.post_content', '内容 (Markdown)')}</FormLabel>
          <TextArea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder={t('vcp.forum.content_placeholder', '输入帖子内容，支持 Markdown')}
            rows={8}
          />
        </FormItem>
      </Modal>

      {/* 帖子详情弹窗 */}
      <Modal
        title={selectedPost?.title}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}>
        {selectedPost && (
          <>
            <PostMeta>
              {selectedPost.isPinned && (
                <Tag color="gold" icon={<PushpinOutlined />}>
                  {t('vcp.forum.pinned', '置顶')}
                </Tag>
              )}
              <Tag color="blue">{selectedPost.board}</Tag>
              <Text type="secondary">{selectedPost.author}</Text>
              <Text type="secondary">{selectedPost.createdAt}</Text>
            </PostMeta>

            {/* Markdown 渲染帖子内容 */}
            <MarkdownContent className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {selectedPost.content}
              </ReactMarkdown>
            </MarkdownContent>

            {/* 帖子图片展示 */}
            {selectedPost.images && selectedPost.images.length > 0 && (
              <ImageGallery>
                {selectedPost.images.map((imgUrl, index) => (
                  <ImageWrapper key={index}>
                    <PostImage src={imgUrl} alt={`${t('vcp.forum.image', '图片')} ${index + 1}`} />
                  </ImageWrapper>
                ))}
              </ImageGallery>
            )}

            {/* 回复列表 */}
            {selectedPost.replies && selectedPost.replies.length > 0 && (
              <RepliesList>
                <Title level={5} style={{ marginBottom: 12 }}>
                  {t('vcp.forum.reply_list', '回复列表')} ({selectedPost.replies.length})
                </Title>
                {selectedPost.replies.map((reply, index) => (
                  <ReplyItem key={reply.uid || index}>
                    <ReplyHeader>
                      <FloorBadge>#{reply.floor || index + 1}</FloorBadge>
                      <Text strong>{reply.author}</Text>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                        {reply.createdAt}
                      </Text>
                    </ReplyHeader>
                    {/* Markdown 渲染回复内容 */}
                    <ReplyMarkdownContent className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {reply.content}
                      </ReactMarkdown>
                    </ReplyMarkdownContent>
                  </ReplyItem>
                ))}
              </RepliesList>
            )}

            <ReplySection>
              <Title level={5}>{t('vcp.forum.replies', '回复')}</Title>
              <TextArea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={t('vcp.forum.reply_placeholder', '输入回复内容，支持 Markdown...')}
                rows={4}
              />
              <Button type="primary" onClick={handleReplyPost} style={{ marginTop: 8 }}>
                {t('vcp.forum.send_reply', '发送回复')}
              </Button>
            </ReplySection>
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

const PostsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`

const PaginationWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

const PostCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }
`

const PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`

const PostTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  flex: 1;
  margin-right: 8px;
`

const PostContent = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  margin-bottom: 12px;
  line-height: 1.5;
`

const PostFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
`

const PostMeta = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`

const ReplySection = styled.div`
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

const FormItem = styled.div`
  margin-bottom: 16px;
`

const FormLabel = styled.div`
  font-weight: 500;
  margin-bottom: 6px;
`

const ImageGallery = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin: 16px 0;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const ImageWrapper = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background-mute);
`

const PostImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
`

const RepliesList = styled.div`
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

const ReplyItem = styled.div`
  padding: 12px;
  margin-bottom: 8px;
  background: var(--color-background-soft);
  border-radius: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`

const ReplyHeader = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
`

const FloorBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: 4px;
`

const MarkdownContent = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  line-height: 1.8;

  &.markdown-body {
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-top: 16px;
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 12px;
    }

    code {
      padding: 2px 6px;
      background: var(--color-background-mute);
      border-radius: 4px;
      font-family: monospace;
    }

    pre {
      padding: 12px;
      background: var(--color-background-mute);
      border-radius: 8px;
      overflow-x: auto;
    }

    blockquote {
      padding-left: 12px;
      border-left: 3px solid var(--color-primary);
      color: var(--color-text-2);
    }

    img {
      max-width: 100%;
      border-radius: 8px;
    }

    ul,
    ol {
      padding-left: 24px;
    }
  }
`

const ReplyMarkdownContent = styled.div`
  font-size: 14px;
  line-height: 1.6;

  &.markdown-body {
    p {
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    code {
      padding: 1px 4px;
      background: var(--color-background-mute);
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
    }
  }
`

export default ForumPanel
