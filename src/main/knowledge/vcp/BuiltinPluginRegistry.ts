/**
 * Cherry Studio 内置插件注册表
 *
 * 包含 74+ 内置插件的元信息
 * 这些插件通过原生 VCP 运行时执行
 */

import type { VCPPluginType } from './types'

/**
 * 内置插件元信息
 */
export interface BuiltinPluginMeta {
  /** 插件唯一标识 */
  name: string
  /** 显示名称 */
  displayName: string
  /** 描述 */
  description: string
  /** 版本 */
  version: string
  /** 作者 */
  author: string
  /** 插件类型 */
  pluginType: VCPPluginType
  /** 分类 */
  category: 'search' | 'file' | 'diary' | 'image' | 'video' | 'code' | 'network' | 'utility' | 'ai' | 'service'
  /** 是否需要配置 */
  requiresConfig: boolean
  /** 配置项列表 */
  configKeys?: string[]
  /** 标签 */
  tags?: string[]
}

/**
 * Cherry Studio 内置插件注册表
 */
export const BUILTIN_PLUGINS: BuiltinPluginMeta[] = [
  // ========== 搜索类 ==========
  {
    name: 'GoogleSearch',
    displayName: '谷歌搜索 (API版)',
    description: '使用 Google Custom Search API 进行搜索的同步插件',
    version: '2.0.0',
    author: 'Kilo Code',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: true,
    configKeys: ['GOOGLE_SEARCH_API', 'GOOGLE_CX', 'GOOGLE_PROXY_PORT'],
    tags: ['搜索', '谷歌', 'API']
  },
  {
    name: 'TavilySearch',
    displayName: 'Tavily 搜索插件',
    description: '使用 Tavily API 进行高级网络搜索，支持时间范围、深度搜索等',
    version: '0.1.0',
    author: 'Roo',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: true,
    configKeys: ['TavilyKey'],
    tags: ['搜索', 'Tavily', 'AI搜索']
  },
  {
    name: 'SerpSearch',
    displayName: 'SERP 搜索',
    description: '使用 SerpAPI 进行搜索引擎结果页面抓取',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: true,
    configKeys: ['SERP_API_KEY'],
    tags: ['搜索', 'SERP']
  },
  {
    name: 'FlashDeepSearch',
    displayName: '闪电深度搜索',
    description: '快速深度搜索引擎，整合多个搜索源',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: false,
    tags: ['搜索', '深度搜索']
  },
  {
    name: 'DeepWikiVCP',
    displayName: 'DeepWiki 搜索',
    description: '深度 Wiki 知识搜索插件',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: false,
    tags: ['搜索', 'Wiki', '知识库']
  },
  {
    name: 'KarakeepSearch',
    displayName: 'Karakeep 搜索',
    description: 'Karakeep 书签和笔记搜索',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: true,
    tags: ['搜索', '书签']
  },
  {
    name: 'EverythingSearch',
    displayName: 'Everything 文件搜索',
    description: '使用 Everything 引擎进行本地文件快速搜索',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'search',
    requiresConfig: false,
    tags: ['搜索', '文件', 'Everything', '内置服务', 'native']
  },

  // ========== 文件操作类 ==========
  {
    name: 'FileOperator',
    displayName: 'VCP 服务器文件操作器',
    description: '强大的文件系统操作插件，支持读写、复制、移动、删除等操作，特别增强了 PDF、Word、Excel 文件的解析能力',
    version: '1.0.1',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'file',
    requiresConfig: true,
    configKeys: ['ALLOWED_DIRECTORIES', 'DEFAULT_DOWNLOAD_DIR', 'MAX_FILE_SIZE'],
    tags: ['文件', '文档', 'PDF', 'Word', 'Excel']
  },
  {
    name: 'FileServer',
    displayName: '文件服务器',
    description: '提供文件 HTTP 服务，支持文件上传下载',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'file',
    requiresConfig: true,
    tags: ['文件', '服务器', 'HTTP']
  },
  {
    name: 'FileListGenerator',
    displayName: '文件列表生成器',
    description: '生成目录的文件列表，支持多种格式输出',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'file',
    requiresConfig: false,
    tags: ['文件', '列表']
  },
  {
    name: 'FileTreeGenerator',
    displayName: '文件树生成器',
    description: '生成目录树结构，可视化展示文件层级',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'file',
    requiresConfig: false,
    tags: ['文件', '目录树']
  },

  // ========== 日记系统 ==========
  {
    name: 'DailyNote',
    displayName: '日记系统 (创建与更新)',
    description: '多功能日记插件，提供创建和更新日记的功能',
    version: '2.0.0',
    author: 'Roo',
    pluginType: 'builtin_service',
    category: 'diary',
    requiresConfig: true,
    configKeys: ['DebugMode'],
    tags: ['日记', '笔记']
  },
  {
    name: 'DailyNoteWrite',
    displayName: '日记写入',
    description: '快速写入日记内容',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'diary',
    requiresConfig: false,
    tags: ['日记', '写入']
  },
  {
    name: 'DailyNotePanel',
    displayName: '日记面板服务 (内置)',
    description: '日记面板路由胶水服务，提供面板打开、条目导航、统计获取等功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'diary',
    requiresConfig: false,
    tags: ['日记', '面板', 'UI', '内置服务', 'native']
  },
  {
    name: 'RAGDiary',
    displayName: '高级日记 RAG (内置)',
    description: '基于 RAG 的日记语义检索服务，支持时间表达式解析、批量搜索、上下文构建',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'diary',
    requiresConfig: false,
    tags: ['日记', 'RAG', '语义检索', '内置服务', 'native']
  },

  // ========== 图像生成类 ==========
  {
    name: 'ComfyUIGen',
    displayName: 'ComfyUI 图像生成',
    description: '使用 ComfyUI 工作流生成图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    configKeys: ['COMFYUI_URL'],
    tags: ['图像', 'ComfyUI', 'AI绘画']
  },
  {
    name: 'FluxGen',
    displayName: 'Flux 图像生成',
    description: '使用 Flux 模型生成图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', 'Flux', 'AI绘画']
  },
  {
    name: 'NovelAIGen',
    displayName: 'NovelAI 图像生成',
    description: '使用 NovelAI API 生成动漫风格图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    configKeys: ['NOVELAI_API_KEY'],
    tags: ['图像', 'NovelAI', '动漫']
  },
  {
    name: 'GeminiImageGen',
    displayName: 'Gemini 图像生成',
    description: '使用 Google Gemini 生成图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    configKeys: ['GEMINI_API_KEY'],
    tags: ['图像', 'Gemini', 'Google']
  },
  {
    name: 'QwenImageGen',
    displayName: '通义万相图像生成',
    description: '使用阿里通义万相 API 生成图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    configKeys: ['DASHSCOPE_API_KEY'],
    tags: ['图像', '通义万相', '阿里']
  },
  {
    name: 'DoubaoGen',
    displayName: '豆包图像生成',
    description: '使用字节豆包 API 生成图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', '豆包', '字节']
  },
  {
    name: 'ZImageGen',
    displayName: 'Z 图像生成',
    description: '通用图像生成接口',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', '通用']
  },
  {
    name: 'BananaGen',
    displayName: 'NanoBanana 图像生成',
    description: 'NanoBanana OR 版本图像生成',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', 'NanoBanana', '内置服务', 'native']
  },
  {
    name: 'ImageProcessor',
    displayName: '图像处理器',
    description: '图像处理和转换工具',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: false,
    tags: ['图像', '处理', '转换']
  },
  {
    name: 'ImageServer',
    displayName: '图像服务器',
    description: '提供图像 HTTP 服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', '服务器']
  },

  // ========== 视频生成类 ==========
  {
    name: 'Wan2.1VideoGen',
    displayName: '视频生成器 (Wan2.1)',
    description: '使用 Wan2.1 API 进行文本到视频或图像到视频的生成',
    version: '0.1.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'video',
    requiresConfig: true,
    configKeys: ['SILICONFLOW_API_KEY', 'Text2VideoModelName', 'Image2VideoModelName'],
    tags: ['视频', 'Wan2.1', 'AI视频', '内置服务', 'native']
  },
  {
    name: 'SunoGen',
    displayName: 'Suno 音乐生成',
    description: '使用 Suno API 生成音乐',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'video',
    requiresConfig: true,
    configKeys: ['SUNO_API_KEY'],
    tags: ['音乐', 'Suno', 'AI音乐']
  },

  // ========== 代码工具类 ==========
  {
    name: 'CodeSearcher',
    displayName: '代码搜索器',
    description: '在代码仓库中搜索代码片段',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'code',
    requiresConfig: false,
    tags: ['代码', '搜索']
  },
  {
    name: 'ProjectAnalyst',
    displayName: '项目分析器',
    description: '分析项目结构和依赖关系',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'code',
    requiresConfig: false,
    tags: ['代码', '分析', '项目']
  },
  {
    name: 'LinuxShellExecutor',
    displayName: 'Linux Shell 执行器',
    description: '在 Linux 环境中执行 Shell 命令',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'code',
    requiresConfig: false,
    tags: ['Shell', 'Linux', '命令']
  },
  {
    name: 'PowerShellExecutor',
    displayName: 'PowerShell 执行器',
    description: '在 Windows 环境中执行 PowerShell 命令',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'code',
    requiresConfig: false,
    tags: ['Shell', 'PowerShell', 'Windows']
  },
  {
    name: 'SciCalculator',
    displayName: '科学计算器',
    description: '执行科学计算和数学运算',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'code',
    requiresConfig: false,
    tags: ['计算', '数学', '科学']
  },

  // ========== 网络工具类 ==========
  {
    name: 'UrlFetch',
    displayName: 'URL 抓取',
    description: '抓取网页内容并提取信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'network',
    requiresConfig: false,
    tags: ['网络', '抓取', 'URL']
  },
  {
    name: 'BilibiliFetch',
    displayName: 'Bilibili 抓取',
    description: '抓取 Bilibili 视频信息和评论',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'network',
    requiresConfig: false,
    tags: ['网络', 'Bilibili', '视频']
  },
  {
    name: 'ChromeBridge',
    displayName: 'Chrome 浏览器桥接',
    description: '控制 Chrome 浏览器进行自动化操作',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'network',
    requiresConfig: true,
    tags: ['浏览器', 'Chrome', '自动化']
  },
  {
    name: 'IMAPIndex',
    displayName: 'IMAP 邮件索引',
    description: '索引 IMAP 邮箱中的邮件',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'network',
    requiresConfig: true,
    configKeys: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'],
    tags: ['邮件', 'IMAP', '索引']
  },
  {
    name: 'IMAPSearch',
    displayName: 'IMAP 邮件搜索',
    description: '搜索 IMAP 邮箱中的邮件',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'network',
    requiresConfig: true,
    configKeys: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'],
    tags: ['邮件', 'IMAP', '搜索']
  },

  // ========== 实用工具类 ==========
  {
    name: 'WeatherReporter',
    displayName: '天气预报员',
    description: '提供实时天气信息，集成到系统提示词的 {{VCPWeatherInfo}} 占位符中',
    version: '1.0.0',
    author: 'System',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: true,
    configKeys: ['VarCity', 'WeatherKey', 'WeatherUrl'],
    tags: ['天气', '静态', '占位符']
  },
  {
    name: 'DailyHot',
    displayName: '每日热点',
    description: '获取各平台每日热点新闻',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'utility',
    requiresConfig: false,
    tags: ['新闻', '热点']
  },
  {
    name: 'Randomness',
    displayName: '随机数生成器',
    description: '生成各种随机数和随机内容',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['随机', '工具', '内置服务', 'native']
  },
  {
    name: 'TarotDivination',
    displayName: '塔罗占卜',
    description: '塔罗牌占卜服务，提供抽牌、解读、牌阵等娱乐功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['娱乐', '塔罗', '占卜', '内置服务', 'native']
  },
  {
    name: 'EmojiListGenerator',
    displayName: '表情列表生成器',
    description: '生成表情包列表',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'utility',
    requiresConfig: false,
    tags: ['表情', '列表']
  },
  {
    name: 'TimelineGenerator',
    displayName: '时间线生成器',
    description: '生成时间线可视化',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['时间线', '可视化']
  },
  {
    name: 'TencentCOSBackup',
    displayName: '腾讯云 COS 备份',
    description: '将文件备份到腾讯云 COS',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'utility',
    requiresConfig: true,
    configKeys: ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION'],
    tags: ['备份', '腾讯云', 'COS']
  },

  // ========== AI/Agent 类 ==========
  {
    name: 'AgentAssistant',
    displayName: 'Agent 助手',
    description: 'AI Agent 辅助功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['Agent', 'AI', '助手']
  },
  {
    name: 'AgentMessage',
    displayName: 'Agent 消息',
    description: 'Agent 间消息传递',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['Agent', '消息']
  },
  {
    name: 'MagiAgent',
    displayName: 'MAGI Agent',
    description: 'MAGI 风格的多 Agent 决策系统',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['Agent', 'MAGI', '决策']
  },
  {
    name: 'LightMemo',
    displayName: '轻量记忆',
    description: '轻量级记忆存储和检索',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['记忆', 'AI', '存储']
  },
  {
    name: 'ThoughtClusterManager',
    displayName: '思维聚类管理器',
    description: '管理和组织思维聚类',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['思维', '聚类', 'AI']
  },
  {
    name: 'SemanticGroupEditor',
    displayName: '语义组编辑器',
    description: '编辑和管理语义分组',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['语义', '分组', 'AI']
  },
  {
    name: 'WorkspaceInjector',
    displayName: '工作区注入器',
    description: '向工作区注入上下文信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['工作区', '注入', '上下文']
  },
  {
    name: 'AIMemo',
    displayName: 'AI 记忆',
    description: 'AI 驱动的智能记忆系统，支持自动记忆提取和整理',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: true,
    tags: ['AI', '记忆', '智能', '内置服务', 'native']
  },
  {
    name: 'DeepMemo',
    displayName: '深度记忆搜索',
    description: '两阶段深度记忆搜索服务，支持 WaveRAG 三阶段检索',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: true,
    tags: ['记忆', '深度搜索', 'WaveRAG', '内置服务', 'native']
  },
  {
    name: 'MemoryMaster',
    displayName: '记忆大师',
    description: 'AI 自动标签、批量组织记忆的高级服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: true,
    tags: ['记忆', '标签', '批量', '内置服务', 'native']
  },
  {
    name: 'MetaThinking',
    displayName: '元思考链',
    description: '多步骤推理和反思服务，支持思维链编辑',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: true,
    tags: ['思维链', '推理', '反思', '内置服务', 'native']
  },
  {
    name: 'ModelSelector',
    displayName: '模型选择器',
    description: '提供完整的模型服务访问和选择功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['模型', '选择器', '内置服务', 'native']
  },
  {
    name: 'vcp_tool_info',
    displayName: 'VCP 工具信息',
    description: '分层工具发现机制，配合 {{VCPToolCatalog}} 使用',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['工具', '发现', '目录', '内置服务', 'native']
  },
  {
    name: 'FlowInvite',
    displayName: '自我心跳总线',
    description: 'AI 主观能动性心跳服务，支持自动触发和任务调度',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: true,
    tags: ['心跳', 'AI', '调度', '内置服务', 'native']
  },
  {
    name: 'VCPPluginCreator',
    displayName: 'VCP 插件创建器',
    description: 'AI 即时创建内置服务的能力',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['插件', '创建', 'AI', '内置服务', 'native']
  },
  {
    name: 'CloudPlugin',
    displayName: '云端插件管理',
    description: '云端插件的下载、安装和管理',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['云端', '插件', '管理', '内置服务', 'native']
  },
  {
    name: 'ImageGeneration',
    displayName: '统一图像生成',
    description: '多后端 AI 图片生成服务，支持多种模型',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', '生成', 'AI', '内置服务', 'native']
  },
  {
    name: 'CherryINImageGen',
    displayName: 'CherryIN 图像生成',
    description: 'CherryIN 图像生成服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: true,
    tags: ['图像', 'CherryIN', '内置服务', 'native']
  },
  {
    name: 'FashionPipeline',
    displayName: '服装流水线',
    description: '服装从实拍图→模特图→视频的一条龙服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'image',
    requiresConfig: true,
    tags: ['服装', '流水线', '图像', '视频', '内置服务', 'native']
  },

  // ========== 学术研究类 ==========
  {
    name: 'ArxivDailyPapers',
    displayName: 'Arxiv 每日论文',
    description: '获取 Arxiv 每日最新论文',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: false,
    tags: ['学术', 'Arxiv', '论文']
  },
  {
    name: 'CrossRefDailyPapers',
    displayName: 'CrossRef 每日论文',
    description: '获取 CrossRef 每日最新论文',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'search',
    requiresConfig: false,
    tags: ['学术', 'CrossRef', '论文']
  },

  // ========== 媒体娱乐类 ==========
  {
    name: 'AnimeFinder',
    displayName: '动漫查找器',
    description: '搜索和查找动漫信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'utility',
    requiresConfig: false,
    tags: ['动漫', '搜索', '娱乐']
  },
  {
    name: 'ArtistMatcher',
    displayName: '艺术家匹配器',
    description: '匹配和查找艺术家信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'synchronous',
    category: 'utility',
    requiresConfig: false,
    tags: ['艺术家', '匹配']
  },

  // ========== 系统服务类 ==========
  {
    name: 'CapturePreprocessor',
    displayName: '截图预处理器',
    description: '预处理截图消息，提取图像信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['截图', '预处理', '图像']
  },
  {
    name: 'CameraCapture',
    displayName: '摄像头捕获',
    description: '捕获摄像头图像',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['摄像头', '捕获', '内置服务', 'native']
  },
  {
    name: 'Screenshot',
    displayName: '屏幕截图',
    description: '屏幕截图服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['截图', '屏幕', '内置服务', 'native']
  },
  {
    name: 'LinuxLogMonitor',
    displayName: 'Linux 日志监控',
    description: '监控 Linux 系统日志',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['日志', 'Linux', '监控']
  },
  {
    name: 'SynapsePusher',
    displayName: 'Synapse 推送器',
    description: '向 Synapse 发送消息推送',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['推送', 'Synapse', '消息']
  },
  {
    name: 'UserAuth',
    displayName: '用户认证',
    description: '用户认证和权限管理',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['认证', '用户', '权限']
  },
  {
    name: 'VCPLog',
    displayName: 'VCP 日志',
    description: 'VCP 系统日志服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['日志', 'VCP', '系统']
  },

  // ========== 社区功能类 ==========
  {
    name: 'VCPForum',
    displayName: 'VCP 论坛',
    description: 'VCP 社区论坛功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['论坛', '社区']
  },
  {
    name: 'VCPForumAssistant',
    displayName: 'VCP 论坛助手',
    description: 'VCP 论坛 AI 助手',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['论坛', '助手', 'AI']
  },
  {
    name: 'VCPTavern',
    displayName: 'VCP 酒馆',
    description: 'VCP 酒馆角色扮演功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'utility',
    requiresConfig: false,
    tags: ['酒馆', '角色扮演']
  },

  // ========== 监控管理类 ==========
  {
    name: '1PanelInfoProvider',
    displayName: '1Panel 信息提供器',
    description: '提供 1Panel 服务器管理信息',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['1Panel', '服务器', '管理']
  },
  {
    name: 'FRPSInfoProvider',
    displayName: 'FRPS 信息提供器',
    description: '提供 FRPS 内网穿透服务信息，支持多命令：GetServerInfo, GetProxies, GetProxyTraffic, GetClients',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['FRPS', '内网穿透', '服务']
  },

  // ========== MCPO 相关 ==========
  {
    name: 'MCPO',
    displayName: 'MCPO 协议桥接',
    description: 'MCP 到 OpenAPI 的协议桥接服务',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: true,
    tags: ['MCPO', 'MCP', 'OpenAPI']
  },
  {
    name: 'MCPOMonitor',
    displayName: 'MCPO 监控',
    description: '监控 MCPO 服务状态',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'service',
    requiresConfig: false,
    tags: ['MCPO', '监控']
  },

  // ========== Workflow 桥接 (Cherry Studio 原生) ==========
  {
    name: 'WorkflowBridge',
    displayName: 'Workflow 桥接服务',
    description: '将 Cherry Studio Workflow 节点暴露为 VCP 工具，支持图像生成、网络搜索、音乐生成、视频生成等功能',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['Workflow', '图像', '搜索', '音乐', '视频', 'AI', '原生']
  },

  // ========== 质量守护 (Cherry Studio 原生) ==========
  {
    name: 'QualityGuardian',
    displayName: 'Quality Guardian 质量守护',
    description:
      'AI 驱动的质量检查和自动优化服务，支持图片、代码、文本、提示词、工作流等多种内容类型的质量评估、趋势分析和自动修复',
    version: '1.0.0',
    author: 'Cherry Studio',
    pluginType: 'builtin_service',
    category: 'ai',
    requiresConfig: false,
    tags: ['质量检查', '自动优化', '提示词优化', '代码审查', '图像质量', 'AI', '原生']
  }
]

/**
 * 获取所有内置插件
 */
export function getAllBuiltinPlugins(): BuiltinPluginMeta[] {
  return BUILTIN_PLUGINS
}

/**
 * 按分类获取内置插件
 */
export function getBuiltinPluginsByCategory(category: BuiltinPluginMeta['category']): BuiltinPluginMeta[] {
  return BUILTIN_PLUGINS.filter((p) => p.category === category)
}

/**
 * 按类型获取内置插件
 */
export function getBuiltinPluginsByType(pluginType: VCPPluginType): BuiltinPluginMeta[] {
  return BUILTIN_PLUGINS.filter((p) => p.pluginType === pluginType)
}

/**
 * 搜索内置插件
 */
export function searchBuiltinPlugins(query: string): BuiltinPluginMeta[] {
  const lowerQuery = query.toLowerCase()
  return BUILTIN_PLUGINS.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.displayName.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
  )
}

/**
 * 获取内置插件统计
 */
export function getBuiltinPluginStats(): {
  total: number
  byType: Record<VCPPluginType, number>
  byCategory: Record<BuiltinPluginMeta['category'], number>
} {
  const byType: Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  for (const plugin of BUILTIN_PLUGINS) {
    byType[plugin.pluginType] = (byType[plugin.pluginType] || 0) + 1
    byCategory[plugin.category] = (byCategory[plugin.category] || 0) + 1
  }

  return {
    total: BUILTIN_PLUGINS.length,
    byType: byType as Record<VCPPluginType, number>,
    byCategory: byCategory as Record<BuiltinPluginMeta['category'], number>
  }
}
