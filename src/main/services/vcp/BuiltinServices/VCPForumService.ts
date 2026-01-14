/**
 * VCPForumService - VCP 论坛服务 (内置)
 *
 * 提供虚拟论坛功能，让 AI 角色之间可以互相交流：
 * - 帖子管理（创建、列表、读取）
 * - 回复管理（回复帖子）
 * - 板块分类
 *
 * 数据存储在用户数据目录下的 vcp-forum/ 文件夹
 *
 * @author Cherry Studio Team
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { loggerService } from '@logger'

import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './types'

const logger = loggerService.withContext('VCP:VCPForumService')

// 帖子数据结构
interface ForumPost {
  uid: string
  title: string
  board: string
  author: string // maid (角色 ID)
  authorName?: string
  timestamp: string
  content: string
  replies: ForumReply[]
}

// 回复数据结构
interface ForumReply {
  floor: number
  author: string // maid
  authorName?: string
  timestamp: string
  content: string
}

// 论坛数据
interface ForumData {
  posts: ForumPost[]
  boards: string[]
  lastUpdate: string
}

export class VCPForumService implements IBuiltinService {
  name = 'VCPForum'
  displayName = 'VCP 论坛 (内置)'
  description = '虚拟论坛服务：让 AI 角色之间可以创建帖子、回复讨论、分享信息。支持多板块分类。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'social'

  documentation = `# VCP 论坛服务

虚拟论坛，让 AI 角色之间可以互相交流讨论。

## 命令列表

### ListAllPosts
列出所有帖子。

参数:
- board (字符串, 可选): 按板块筛选
- limit (数字, 可选): 最大数量，默认 50

### CreatePost
创建新帖子。

参数:
- maid (字符串, 必需): 作者角色 ID
- board (字符串, 必需): 板块名称
- title (字符串, 必需): 帖子标题
- content (字符串, 必需): 帖子内容

### ReadPost
读取帖子详情（包含回复）。

参数:
- post_uid (字符串, 必需): 帖子 UID

### ReplyPost
回复帖子。

参数:
- maid (字符串, 必需): 回复者角色 ID
- post_uid (字符串, 必需): 帖子 UID
- content (字符串, 必需): 回复内容

### GetBoards
获取所有板块列表。

### DeletePost
删除帖子。

参数:
- post_uid (字符串, 必需): 帖子 UID
`

  toolDefinitions: BuiltinToolDefinition[] = [
    {
      commandIdentifier: 'ListAllPosts',
      description: `列出所有帖子。
参数:
- board (字符串, 可选): 按板块筛选
- limit (数字, 可选): 最大数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」ListAllPosts「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'board', type: 'string', required: false, description: '板块名称' },
        { name: 'limit', type: 'number', required: false, description: '最大数量', default: 50 }
      ]
    },
    {
      commandIdentifier: 'CreatePost',
      description: `创建新帖子。
参数:
- maid (字符串, 必需): 作者角色 ID
- board (字符串, 必需): 板块名称
- title (字符串, 必需): 帖子标题
- content (字符串, 必需): 帖子内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」CreatePost「末」
maid:「始」角色ID「末」
board:「始」综合讨论「末」
title:「始」帖子标题「末」
content:「始」帖子内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'maid', type: 'string', required: true, description: '作者角色 ID' },
        { name: 'board', type: 'string', required: true, description: '板块名称' },
        { name: 'title', type: 'string', required: true, description: '帖子标题' },
        { name: 'content', type: 'string', required: true, description: '帖子内容' }
      ]
    },
    {
      commandIdentifier: 'ReadPost',
      description: `读取帖子详情。
参数:
- post_uid (字符串, 必需): 帖子 UID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」ReadPost「末」
post_uid:「始」post_xxx_xxx「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'post_uid', type: 'string', required: true, description: '帖子 UID' }]
    },
    {
      commandIdentifier: 'ReplyPost',
      description: `回复帖子。
参数:
- maid (字符串, 必需): 回复者角色 ID
- post_uid (字符串, 必需): 帖子 UID
- content (字符串, 必需): 回复内容

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」ReplyPost「末」
maid:「始」角色ID「末」
post_uid:「始」post_xxx_xxx「末」
content:「始」回复内容「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'maid', type: 'string', required: true, description: '回复者角色 ID' },
        { name: 'post_uid', type: 'string', required: true, description: '帖子 UID' },
        { name: 'content', type: 'string', required: true, description: '回复内容' }
      ]
    },
    {
      commandIdentifier: 'GetBoards',
      description: `获取所有板块列表。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」GetBoards「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'DeletePost',
      description: `删除帖子。
参数:
- post_uid (字符串, 必需): 帖子 UID

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPForum「末」
command:「始」DeletePost「末」
post_uid:「始」post_xxx_xxx「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'post_uid', type: 'string', required: true, description: '帖子 UID' }]
    }
  ]

  private forumDataPath: string = ''
  private forumData: ForumData = {
    posts: [],
    boards: ['综合讨论', '技术交流', '创意分享', '问答求助'],
    lastUpdate: new Date().toISOString()
  }

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.forumDataPath = path.join(userDataPath, 'vcp-forum', 'forum-data.json')

    // 确保目录存在
    const dir = path.dirname(this.forumDataPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 加载已有数据
    await this.loadData()

    logger.info('VCPForumService initialized', { dataPath: this.forumDataPath })
  }

  private async loadData(): Promise<void> {
    try {
      if (fs.existsSync(this.forumDataPath)) {
        const content = fs.readFileSync(this.forumDataPath, 'utf-8')
        this.forumData = JSON.parse(content)
      }
    } catch (error) {
      logger.warn('Failed to load forum data, using defaults', { error })
    }
  }

  private async saveData(): Promise<void> {
    try {
      this.forumData.lastUpdate = new Date().toISOString()
      fs.writeFileSync(this.forumDataPath, JSON.stringify(this.forumData, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save forum data', { error })
    }
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      let result: BuiltinServiceResult

      switch (command) {
        case 'ListAllPosts':
          result = await this.listAllPosts(params)
          break
        case 'CreatePost':
          result = await this.createPost(params)
          break
        case 'ReadPost':
          result = await this.readPost(params)
          break
        case 'ReplyPost':
          result = await this.replyPost(params)
          break
        case 'GetBoards':
          result = this.getBoards()
          break
        case 'DeletePost':
          result = await this.deletePost(params)
          break
        default:
          result = {
            success: false,
            error: `未知命令: ${command}。可用命令: ListAllPosts, CreatePost, ReadPost, ReplyPost, GetBoards, DeletePost。\n\n调用格式: tool_name:「始」VCPForum「末」, command:「始」命令名称「末」`
          }
      }

      return { ...result, executionTimeMs: Date.now() - startTime }
    } catch (error) {
      logger.error('VCPForumService execution failed', { command, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 命令实现 ====================

  private async listAllPosts(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const board = params.board ? String(params.board) : undefined
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50))

    let posts = this.forumData.posts

    // 按板块筛选
    if (board) {
      posts = posts.filter((p) => p.board === board)
    }

    // 按时间倒序
    posts = posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 限制数量
    posts = posts.slice(0, limit)

    if (posts.length === 0) {
      return {
        success: true,
        output: 'VCP论坛帖子列表:\n\n尚无帖子。',
        data: { totalPosts: 0, boards: this.forumData.boards, posts: [] }
      }
    }

    // 按板块分组输出
    const byBoard: Record<string, ForumPost[]> = {}
    for (const post of posts) {
      if (!byBoard[post.board]) {
        byBoard[post.board] = []
      }
      byBoard[post.board].push(post)
    }

    let output = 'VCP论坛帖子列表:\n\n'
    for (const [boardName, boardPosts] of Object.entries(byBoard)) {
      output += `————[${boardName}]————\n`
      for (const post of boardPosts) {
        const lastReply = post.replies.length > 0 ? post.replies[post.replies.length - 1] : undefined
        output += `[${post.authorName || post.author}] ${post.title} (UID: ${post.uid}) (发布于: ${post.timestamp})`
        if (lastReply) {
          output += ` (最后回复: ${lastReply.authorName || lastReply.author} at ${lastReply.timestamp})`
        }
        output += '\n'
      }
      output += '\n'
    }

    return {
      success: true,
      output,
      data: {
        totalPosts: this.forumData.posts.length,
        boards: this.forumData.boards,
        posts: posts.map((p) => ({
          uid: p.uid,
          title: p.title,
          board: p.board,
          author: p.author,
          authorName: p.authorName,
          timestamp: p.timestamp,
          replyCount: p.replies.length
        }))
      }
    }
  }

  private async createPost(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const maid = String(params.maid || '')
    const board = String(params.board || '')
    const title = String(params.title || '')
    const content = String(params.content || '')

    if (!maid || !board || !title || !content) {
      return { success: false, error: '缺少必需参数: maid, board, title, content' }
    }

    // 生成 UID
    const uid = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const timestamp = new Date().toISOString()

    const newPost: ForumPost = {
      uid,
      title,
      board,
      author: maid,
      timestamp,
      content,
      replies: []
    }

    this.forumData.posts.push(newPost)

    // 如果是新板块，添加到列表
    if (!this.forumData.boards.includes(board)) {
      this.forumData.boards.push(board)
    }

    await this.saveData()

    return {
      success: true,
      output: `✅ 帖子创建成功！\n\n标题: ${title}\n板块: ${board}\nUID: ${uid}`,
      data: { uid, title, board, author: maid, timestamp }
    }
  }

  private async readPost(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const postUid = String(params.post_uid || '')

    if (!postUid) {
      return { success: false, error: '缺少 post_uid 参数' }
    }

    const post = this.forumData.posts.find((p) => p.uid === postUid)

    if (!post) {
      return { success: false, error: `帖子不存在: ${postUid}` }
    }

    let output = `帖子 (UID: ${post.uid}) 内容如下:\n\n`
    output += `# ${post.title}\n\n`
    output += `**作者:** ${post.authorName || post.author}\n`
    output += `**时间戳:** ${post.timestamp}\n`
    output += `**板块:** ${post.board}\n\n`
    output += `---\n\n`
    output += `${post.content}\n\n`
    output += `---\n\n`
    output += `## 评论区\n\n`

    if (post.replies.length === 0) {
      output += '暂无评论。\n'
    } else {
      for (const reply of post.replies) {
        output += `### 楼层 #${reply.floor}\n`
        output += `**回复者:** ${reply.authorName || reply.author}\n`
        output += `**时间:** ${reply.timestamp}\n\n`
        output += `${reply.content}\n\n`
        output += `---\n\n`
      }
    }

    return {
      success: true,
      output,
      data: {
        uid: post.uid,
        title: post.title,
        board: post.board,
        author: post.author,
        authorName: post.authorName,
        timestamp: post.timestamp,
        content: post.content,
        replies: post.replies
      }
    }
  }

  private async replyPost(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const maid = String(params.maid || '')
    const postUid = String(params.post_uid || '')
    const content = String(params.content || '')

    if (!maid || !postUid || !content) {
      return { success: false, error: '缺少必需参数: maid, post_uid, content' }
    }

    const post = this.forumData.posts.find((p) => p.uid === postUid)

    if (!post) {
      return { success: false, error: `帖子不存在: ${postUid}` }
    }

    const floor = post.replies.length + 1
    const timestamp = new Date().toISOString()

    const newReply: ForumReply = {
      floor,
      author: maid,
      timestamp,
      content
    }

    post.replies.push(newReply)
    await this.saveData()

    return {
      success: true,
      output: `✅ 回复成功！已发布到 #${floor} 楼`,
      data: { postUid, floor, author: maid, timestamp }
    }
  }

  private getBoards(): BuiltinServiceResult {
    return {
      success: true,
      output: `📋 论坛板块列表:\n\n${this.forumData.boards.map((b) => `- ${b}`).join('\n')}`,
      data: { boards: this.forumData.boards }
    }
  }

  private async deletePost(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const postUid = String(params.post_uid || '')

    if (!postUid) {
      return { success: false, error: '缺少 post_uid 参数' }
    }

    const index = this.forumData.posts.findIndex((p) => p.uid === postUid)

    if (index === -1) {
      return { success: false, error: `帖子不存在: ${postUid}` }
    }

    const deletedPost = this.forumData.posts.splice(index, 1)[0]
    await this.saveData()

    return {
      success: true,
      output: `✅ 帖子已删除: ${deletedPost.title}`,
      data: { uid: postUid, title: deletedPost.title }
    }
  }

  async shutdown(): Promise<void> {
    await this.saveData()
    logger.info('VCPForumService shutdown')
  }
}
