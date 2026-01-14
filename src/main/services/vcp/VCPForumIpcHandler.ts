/**
 * VCPForumIpcHandler - VCP 论坛直接 IPC 处理器
 *
 * 提供论坛功能的直接 IPC 接口，绕过插件执行管道
 * 直接调用 VCPForumService，提供更好的性能和类型安全
 */

import { loggerService } from '@logger'
import { ipcMain } from 'electron'

import { ensureBuiltinServicesInitialized } from './BuiltinServices'

const logger = loggerService.withContext('VCPForumIpcHandler')

// 论坛帖子接口
interface ForumPost {
  uid: string
  title: string
  board: string
  author: string
  timestamp: string
  lastReply?: {
    author: string
    timestamp: string
  }
}

// 论坛回复接口
interface ForumReply {
  floor: number
  author: string
  timestamp: string
  content: string
}

// 帖子详情接口
interface PostDetail {
  uid: string
  title: string
  board: string
  author: string
  timestamp: string
  content: string
  replies: ForumReply[]
}

/**
 * 注册 VCP 论坛直接 IPC 处理器
 */
export function registerVCPForumIpcHandlers(): void {
  logger.info('Registering VCP Forum IPC handlers')

  // 列出所有帖子
  ipcMain.handle(
    'vcp:forum:list',
    async (): Promise<{
      success: boolean
      data?: ForumPost[]
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const forumService = builtinRegistry.get('VCPForum')

        if (!forumService) {
          return { success: false, error: 'VCPForumService not available' }
        }

        const result = await forumService.execute('ListAllPosts', {})

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // 解析输出为结构化数据
        const posts = parsePostList(result.output as string)

        return { success: true, data: posts }
      } catch (error) {
        logger.error('Failed to list forum posts', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 创建帖子
  ipcMain.handle(
    'vcp:forum:create',
    async (
      _,
      params: {
        maid: string
        board: string
        title: string
        content: string
      }
    ): Promise<{
      success: boolean
      data?: { uid: string }
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const forumService = builtinRegistry.get('VCPForum')

        if (!forumService) {
          return { success: false, error: 'VCPForumService not available' }
        }

        const result = await forumService.execute('CreatePost', params)

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // 从返回数据中提取 UID
        const uid = (result.data as { uid?: string })?.uid || ''

        return { success: true, data: { uid } }
      } catch (error) {
        logger.error('Failed to create forum post', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 读取帖子
  ipcMain.handle(
    'vcp:forum:read',
    async (
      _,
      postUid: string
    ): Promise<{
      success: boolean
      data?: PostDetail
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const forumService = builtinRegistry.get('VCPForum')

        if (!forumService) {
          return { success: false, error: 'VCPForumService not available' }
        }

        const result = await forumService.execute('ReadPost', { post_uid: postUid })

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // 解析帖子内容
        const postDetail = parsePostDetail(result.output as string, postUid)

        return { success: true, data: postDetail }
      } catch (error) {
        logger.error('Failed to read forum post', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 回复帖子
  ipcMain.handle(
    'vcp:forum:reply',
    async (
      _,
      params: {
        maid: string
        post_uid: string
        content: string
      }
    ): Promise<{
      success: boolean
      data?: { floor: number }
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const forumService = builtinRegistry.get('VCPForum')

        if (!forumService) {
          return { success: false, error: 'VCPForumService not available' }
        }

        const result = await forumService.execute('ReplyPost', params)

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // 从输出中提取楼层号
        const floorMatch = (result.output as string)?.match(/#(\d+)/)
        const floor = floorMatch ? parseInt(floorMatch[1], 10) : 0

        return { success: true, data: { floor } }
      } catch (error) {
        logger.error('Failed to reply to forum post', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 获取论坛统计信息
  ipcMain.handle(
    'vcp:forum:stats',
    async (): Promise<{
      success: boolean
      data?: { totalPosts: number; boards: string[] }
      error?: string
    }> => {
      try {
        const builtinRegistry = await ensureBuiltinServicesInitialized()
        const forumService = builtinRegistry.get('VCPForum')

        if (!forumService) {
          return { success: false, error: 'VCPForumService not available' }
        }

        const result = await forumService.execute('ListAllPosts', {})

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // 从 data 中获取统计信息
        const stats = result.data as { totalPosts?: number; boards?: string[] }

        return {
          success: true,
          data: {
            totalPosts: stats?.totalPosts || 0,
            boards: stats?.boards || []
          }
        }
      } catch (error) {
        logger.error('Failed to get forum stats', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  logger.info('VCP Forum IPC handlers registered')
}

// ==================== 辅助解析函数 ====================

/**
 * 解析帖子列表文本输出
 */
function parsePostList(output: string): ForumPost[] {
  const posts: ForumPost[] = []

  if (!output || output.includes('尚无帖子')) {
    return posts
  }

  // 解析格式：
  // VCP论坛帖子列表:
  // ————[板块名]————
  // [作者] 标题 (UID: xxx) (发布于: xxx) (最后回复: xxx at xxx)

  const lines = output.split('\n')
  let currentBoard = ''

  for (const line of lines) {
    // 匹配板块行
    const boardMatch = line.match(/————\[(.*?)\]————/)
    if (boardMatch) {
      currentBoard = boardMatch[1]
      continue
    }

    // 匹配帖子行
    const postMatch = line.match(/\[(.*?)\]\s+(.*?)\s+\(UID:\s*(.*?)\)\s+\(发布于:\s*(.*?)\)/)
    if (postMatch) {
      const post: ForumPost = {
        uid: postMatch[3].trim(),
        title: postMatch[2].trim(),
        board: currentBoard,
        author: postMatch[1].trim(),
        timestamp: postMatch[4].trim()
      }

      // 检查最后回复
      const replyMatch = line.match(/\(最后回复:\s*(.*?)\s+at\s+(.*?)\)/)
      if (replyMatch) {
        post.lastReply = {
          author: replyMatch[1].trim(),
          timestamp: replyMatch[2].trim()
        }
      }

      posts.push(post)
    }
  }

  return posts
}

/**
 * 解析帖子详情
 */
function parsePostDetail(output: string, uid: string): PostDetail {
  const detail: PostDetail = {
    uid,
    title: '',
    board: '',
    author: '',
    timestamp: '',
    content: '',
    replies: []
  }

  // 移除开头的 "帖子 (UID: xxx) 内容如下:" 行
  const content = output.replace(/^帖子\s*\(UID:.*?\)\s*内容如下:\s*\n\n?/, '')

  // 解析标题
  const titleMatch = content.match(/^#\s+(.+?)$/m)
  if (titleMatch) {
    detail.title = titleMatch[1].trim()
  }

  // 解析作者
  const authorMatch = content.match(/\*\*作者:\*\*\s*(.+?)$/m)
  if (authorMatch) {
    detail.author = authorMatch[1].trim()
  }

  // 解析时间戳
  const timestampMatch = content.match(/\*\*时间戳:\*\*\s*(.+?)$/m)
  if (timestampMatch) {
    detail.timestamp = timestampMatch[1].trim()
  }

  // 解析正文内容（在第一个 --- 和 评论区 之间）
  const contentMatch = content.match(/---\s*\n([\s\S]*?)\n---\s*\n\s*##\s*评论区/)
  if (contentMatch) {
    detail.content = contentMatch[1].trim()
  }

  // 解析回复
  const replyRegex = /###\s*楼层\s*#(\d+)\s*\n\*\*回复者:\*\*\s*(.+?)\s*\n\*\*时间:\*\*\s*(.+?)\s*\n\n([\s\S]*?)(?=\n---|\n###|$)/g
  let replyMatch
  while ((replyMatch = replyRegex.exec(content)) !== null) {
    detail.replies.push({
      floor: parseInt(replyMatch[1], 10),
      author: replyMatch[2].trim(),
      timestamp: replyMatch[3].trim(),
      content: replyMatch[4].trim()
    })
  }

  return detail
}
