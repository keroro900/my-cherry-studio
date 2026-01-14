/**
 * VCP 插件配置项描述
 *
 * 共享的配置项描述映射，用于为常见的配置项提供友好的描述
 * 被 VCPPluginIpcHandler 和 PluginSyncService 共同使用
 */

/**
 * 配置项描述映射
 */
export const CONFIG_KEY_DESCRIPTIONS: Record<string, string> = {
  // Google
  GOOGLE_SEARCH_API: 'Google Custom Search API 密钥',
  GOOGLE_CX: 'Google 自定义搜索引擎 ID (CX)',
  GOOGLE_PROXY_PORT: 'Google 代理端口（可选）',

  // Tavily
  TavilyKey: 'Tavily API 密钥',

  // SERP
  SERP_API_KEY: 'SerpAPI 密钥',
  SerpApi: 'SerpAPI 密钥',

  // Weather
  WeatherKey: '天气 API 密钥',
  VarCity: '城市名称',
  WeatherUrl: '天气 API 地址',

  // Image Generation
  COMFYUI_URL: 'ComfyUI 服务地址',
  ComfyUI_URL: 'ComfyUI 服务地址',
  SILICONFLOW_API_KEY: 'SiliconFlow API 密钥',
  FLUX_API_KEY: 'Flux API 密钥',
  NOVELAI_API_KEY: 'NovelAI API 密钥',
  NovelAI_API_KEY: 'NovelAI API 密钥',
  GEMINI_API_KEY: 'Google Gemini API 密钥',
  Gemini_API_KEY: 'Google Gemini API 密钥',
  GeminiImageKey: 'Google Gemini 图像 API 密钥',
  DASHSCOPE_API_KEY: '通义万相 API 密钥',
  TongyiWanxiang_API_KEY: '通义万相 API 密钥',
  VOLCENGINE_API_KEY: '豆包/火山引擎 API 密钥',
  Doubao_API_KEY: '豆包 API 密钥',
  DMX_API_KEY: 'DMX 豆包 API 密钥',
  NanoBanana_API_KEY: 'NanoBanana API 密钥',

  // Video
  SUNO_API_KEY: 'Suno 音乐生成 API 密钥',
  Suno_API_KEY: 'Suno 音乐生成 API 密钥',
  Wan21_API_KEY: 'Wan2.1 视频生成 API 密钥',

  // File
  ALLOWED_DIRECTORIES: '允许访问的目录列表',
  DEFAULT_DOWNLOAD_DIR: '默认下载目录',
  MAX_FILE_SIZE: '最大文件大小',

  // Email
  IMAP_HOST: 'IMAP 服务器地址',
  IMAP_USER: 'IMAP 用户名',
  IMAP_PASS: 'IMAP 密码',

  // Cloud
  COS_SECRET_ID: '腾讯云 COS SecretId',
  COS_SECRET_KEY: '腾讯云 COS SecretKey',
  COS_BUCKET: '腾讯云 COS Bucket',
  COS_REGION: '腾讯云 COS Region',

  // Debug
  DebugMode: '调试模式',

  // Generic
  API_KEY: 'API 密钥',
  API_SECRET: 'API 密钥（Secret）',
  API_URL: 'API 服务地址',
  PROXY_URL: '代理服务器地址'
}

/**
 * 获取配置项描述
 * 先检查精确匹配，然后尝试智能推断
 */
export function getConfigKeyDescription(key: string): string {
  // 先检查精确匹配
  if (CONFIG_KEY_DESCRIPTIONS[key]) {
    return CONFIG_KEY_DESCRIPTIONS[key]
  }

  // 智能推断描述
  const lowerKey = key.toLowerCase()

  if (lowerKey.includes('api_key') || lowerKey.includes('apikey') || lowerKey.includes('key')) {
    return `${key.replace(/_/g, ' ')} - API 密钥`
  }
  if (lowerKey.includes('secret')) {
    return `${key.replace(/_/g, ' ')} - 密钥`
  }
  if (lowerKey.includes('url') || lowerKey.includes('endpoint')) {
    return `${key.replace(/_/g, ' ')} - 服务地址`
  }
  if (lowerKey.includes('port')) {
    return `${key.replace(/_/g, ' ')} - 端口号`
  }
  if (lowerKey.includes('proxy')) {
    return `${key.replace(/_/g, ' ')} - 代理配置`
  }

  // 默认返回 key 本身（格式化下划线）
  return key.replace(/_/g, ' ')
}
