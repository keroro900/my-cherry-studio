/**
 * 模块类型定义
 * Module Type Definitions
 */

/**
 * 提示词模块接口
 * 每个模块返回一个包含类型、文本和优先级的对象
 */
export interface PromptModule {
  /** 模块类型标识 */
  type: string
  /** 提示词文本 */
  text: string
  /** 优先级（越高越靠前） */
  priority: number
}

/**
 * 服装分析结果类型
 * 用于存储 AI 分析服装后的结构化信息
 */
export interface GarmentAnalysis {
  /** 服装类型 (t-shirt, pants, dress, etc.) */
  garment_type: string
  /** 印花/图案描述 */
  prints_patterns?: string
  /** IP 角色（如果有） */
  ip_character?: string
  /** 主题风格 */
  theme?: string
  /** 主要颜色 */
  colors: string[]
  /** 面料纹理 */
  fabric_texture?: string
  /** 结构细节 */
  structural_details?: string
  /** 推荐的背景风格 */
  recommended_background?: string
  /** 推荐的道具 */
  recommended_props?: string[]
  /** 推荐的灯光 */
  recommended_lighting?: string
  /** 完整的生成提示词 */
  full_prompt?: string
}

/**
 * 构建结果类型
 */
export interface BuildResult {
  /** 最终提示词 */
  prompt: string
  /** 来源：promptJson 上游输入 / preset 预设 / auto 自动分析 */
  source: 'promptJson' | 'preset' | 'auto'
  /** 分析结果（仅 auto 模式） */
  analysisResult?: GarmentAnalysis
}
