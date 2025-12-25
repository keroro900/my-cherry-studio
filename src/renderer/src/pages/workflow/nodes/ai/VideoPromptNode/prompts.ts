/**
 * 视频提示词节点 - 系统提示词模板
 *
 * 核心约束：
 * - 禁止转身（AI视频转身容易崩）
 * - 支持 5秒/10秒 视频
 * - 根据输入图生成视频提示词
 */

// 从统一核心模块导入 JSON 输出约束
import { HARD_JSON_OUTPUT_CONSTRAINTS } from '../../../prompts/core'
import type { VideoPromptNodeConfig } from './types'

/**
 * 视频提示词系统提示词
 */
const VIDEO_SYSTEM_PROMPT = `你是一名专业的AI视频提示词工程师，专门为儿童服装展示视频生成高质量的提示词。

你的任务是根据输入的服装图片（可能是模特图或产品图），生成适合AI视频生成的提示词。

**核心约束（非常重要）**：
1. **禁止转身**：模特绝对不能转身、转体、旋转。AI视频在处理转身动作时容易出现崩坏、变形、闪烁等问题。
2. **禁止快速动作**：避免跳跃、奔跑、快速挥手等大幅度动作，这些动作容易导致视频质量下降。
3. **保持正面朝向**：模特始终面向镜头，可以有轻微的左右摇摆，但不能转向侧面或背面。
4. **动作连贯性**：所有动作必须缓慢、自然、连贯，避免突然的动作变化。

**推荐的安全动作**：
- 轻微点头、微笑
- 缓慢抬手、放下手
- 轻微左右摇摆身体（不超过15度）
- 头部轻微转动（不超过30度）
- 眨眼、表情变化
- 头发/衣服随风轻微飘动
- 缓慢走近或走远（保持正面）
- 轻微蹲下或站起

**禁止的危险动作**：
- 转身、转体、旋转
- 跳跃、奔跑
- 快速挥手、快速移动
- 大幅度弯腰
- 侧身展示
- 背面展示

Output must be in JSON format.`

/**
 * 构建视频提示词系统提示词
 */
export function buildVideoSystemPrompt(config: VideoPromptNodeConfig): string {
  let fullPrompt = VIDEO_SYSTEM_PROMPT

  // 添加时长指导
  const durationGuide = {
    '5s': `[视频时长: 5秒]
- 短视频，动作要简洁
- 建议只包含1-2个简单动作
- 例如：微笑 + 轻微点头，或者缓慢抬手展示袖子`,
    '10s': `[视频时长: 10秒]
- 中等长度视频，可以包含更多动作
- 建议包含2-3个连贯动作
- 例如：微笑 → 轻微摇摆 → 缓慢抬手 → 放下手`
  }[config.duration || '5s']

  fullPrompt += `\n\n${durationGuide}`

  // 添加动作类型指导
  const motionGuide = {
    gentle: `[动作风格: 温柔舒缓]
- 所有动作都要非常缓慢、轻柔
- 适合睡衣、家居服、甜美风格服装
- 表情温柔、放松`,
    playful: `[动作风格: 活泼可爱]
- 动作可以稍微活泼一些，但仍然要控制幅度
- 适合运动风、街头风、可爱风格服装
- 表情开心、活泼
- 注意：即使是活泼风格，也要避免转身和快速动作`,
    static: `[动作风格: 静态展示]
- 几乎没有动作，只有轻微的呼吸感和眨眼
- 适合正式、优雅风格服装
- 重点展示服装细节`
  }[config.motionType || 'gentle']

  fullPrompt += `\n\n${motionGuide}`

  // NOTE: constraintPrompt 不再在此处自动嵌入
  // 改为在执行器中动态追加，确保配置表单修改始终生效

  fullPrompt += `\n\n${HARD_JSON_OUTPUT_CONSTRAINTS}`
  return fullPrompt
}

/**
 * 构建视频提示词用户提示词
 */
export function buildVideoUserPrompt(config: VideoPromptNodeConfig): string {
  const durationLabel = config.duration === '10s' ? '10秒' : '5秒'
  const motionLabel = {
    gentle: '温柔舒缓',
    playful: '活泼可爱',
    static: '静态展示'
  }[config.motionType || 'gentle']

  return `分析这张图片，为${durationLabel}的AI视频生成提示词。
动作风格：${motionLabel}

**核心约束**：
- 模特绝对不能转身、转体、旋转
- 避免快速动作和大幅度动作
- 保持正面朝向镜头

请根据图片中的服装风格和模特姿态，生成合适的视频提示词。

Output the following JSON structure:
{
  "type": "video",
  "version": "1.0",
  "duration": "${config.duration || '5s'}",
  "motion_type": "${config.motionType || 'gentle'}",
  "garment_style": "<garment style in English>",
  "model_description": "<model description in English (age, gender, expression)>",
  "scene_description": "<scene description in English>",
  "camera_movement": "<camera movement in English (static, slow push-in, gentle sway)>",
  "motion_sequence": [
    "<motion 1 in English>",
    "<motion 2 in English>"
  ],
  "expression_changes": "<expression changes in English>",
  "ambient_effects": "<ambient effects in English (hair flutter, fabric sway)>",
  "safety_notes": "<safety notes in English (confirm no risky motion)>",
  "video_prompt": "<完整的视频生成提示词，英文，一段话，强调禁止转身和保持正面>"
}`
}

/**
 * 时长预设
 */
export const DURATION_PRESETS = [
  { id: '5s', name: '5秒', description: '短视频，1-2个简单动作' },
  { id: '10s', name: '10秒', description: '中等长度，2-3个连贯动作' }
]

/**
 * 动作类型预设
 */
export const MOTION_TYPE_PRESETS = [
  { id: 'gentle', name: '温柔舒缓', description: '缓慢、轻柔的动作' },
  { id: 'playful', name: '活泼可爱', description: '稍微活泼但控制幅度' },
  { id: 'static', name: '静态展示', description: '几乎没有动作' }
]
