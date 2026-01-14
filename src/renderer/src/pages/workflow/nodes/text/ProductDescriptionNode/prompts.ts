/**
 * 产品描述生成提示词构建器
 * Product Description Prompts
 *
 * 构建用于生成多语言产品描述的系统提示词和用户提示词
 */

import { LANGUAGE_LABELS, PLATFORM_CONFIGS, type ProductDescriptionConfig, TONE_STYLE_LABELS } from './types'

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(config: ProductDescriptionConfig): string {
  const platformConfig = PLATFORM_CONFIGS[config.platform]
  const languageLabel = LANGUAGE_LABELS[config.language]
  const toneLabel = TONE_STYLE_LABELS[config.toneStyle]

  return `[Role: Professional E-commerce Copywriter & SEO Specialist]
You are an expert e-commerce copywriter with extensive experience writing product listings for major platforms. You specialize in creating compelling, conversion-focused copy that resonates with target audiences.

[Target Platform: ${platformConfig.name}]
Platform characteristics: ${platformConfig.styleKeywords}
- Maximum title length: ${config.maxTitleLength || platformConfig.maxTitleLength} characters
- Maximum description length: ${config.maxDescriptionLength || platformConfig.maxDescriptionLength} characters
- Bullet points: ${config.bulletCount || platformConfig.bulletCount} items

[Language: ${languageLabel}]
${config.language === 'multi' ? 'Generate content in multiple languages (English, Chinese, Japanese, Korean)' : `Write all content in ${languageLabel}`}

[Tone & Style: ${toneLabel}]
${getToneDescription(config.toneStyle)}

[Writing Guidelines]
1. **Title Optimization**:
   - Include primary keywords naturally
   - Highlight key product benefits
   - Keep within character limit
   - Make it scannable and attention-grabbing

2. **Bullet Points**:
   - Lead with benefits, follow with features
   - Use action verbs and sensory words
   - Address customer pain points
   - Keep each point concise and impactful

3. **Description**:
   - Tell a compelling product story
   - Include relevant specifications
   - Address target audience needs
   - Create emotional connection

${
  config.includeSEO
    ? `4. **SEO Keywords**:
   - Extract relevant search terms
   - Include long-tail keywords
   - Consider buyer intent
   - Prioritize by search volume potential`
    : ''
}

[Output Format]
Respond ONLY in valid JSON format with this structure:
{
  "title": "Product title here",
  "description": "Full product description here",
  "bullets": ["Bullet point 1", "Bullet point 2", ...],
  ${config.includeSEO ? '"seoKeywords": ["keyword1", "keyword2", ...],' : ''}
  "meta": {
    "platform": "${config.platform}",
    "language": "${config.language}",
    "tone": "${config.toneStyle}"
  }
}

IMPORTANT: Return ONLY the JSON object. Do not include any explanations, markdown, or additional text.`
}

/**
 * 构建用户提示词
 */
export function buildUserPrompt(
  config: ProductDescriptionConfig,
  productInfo: string,
  features?: string,
  hasImage?: boolean
): string {
  const platformConfig = PLATFORM_CONFIGS[config.platform]

  let prompt = `[Product Description Generation Task]

**Platform**: ${platformConfig.name}
**Language**: ${LANGUAGE_LABELS[config.language]}
**Tone**: ${TONE_STYLE_LABELS[config.toneStyle]}

**Product Information**:
${productInfo}
`

  if (features) {
    prompt += `
**Key Features**:
${features}
`
  }

  if (hasImage) {
    prompt += `
**Visual Reference**: An image of the product has been provided. Please analyze the visual details to enhance the description accuracy.
`
  }

  prompt += `
**Requirements**:
- Title: Maximum ${config.maxTitleLength || platformConfig.maxTitleLength} characters
- Description: Maximum ${config.maxDescriptionLength || platformConfig.maxDescriptionLength} characters
- Bullet Points: Exactly ${config.bulletCount || platformConfig.bulletCount} items
${config.includeSEO ? '- SEO Keywords: 8-12 relevant keywords' : ''}

**Generate**: Create compelling, platform-optimized product content that will drive conversions.

Return your response as a valid JSON object only.`

  return prompt
}

/**
 * 获取风格描述
 */
function getToneDescription(tone: string): string {
  const descriptions: Record<string, string> = {
    professional:
      'Maintain a professional, authoritative voice. Focus on quality, reliability, and expertise. Use industry-appropriate terminology.',
    casual:
      'Use friendly, conversational language. Create a personal connection with readers. Keep it approachable and relatable.',
    luxury:
      'Employ sophisticated, elegant language. Emphasize exclusivity, craftsmanship, and premium quality. Create aspiration.',
    playful:
      'Be fun, energetic, and engaging. Use creative wordplay and enthusiasm. Appeal to a younger, trend-conscious audience.',
    technical:
      'Focus on specifications, performance metrics, and technical details. Appeal to informed buyers who value data.',
    emotional:
      'Create strong emotional connections. Use storytelling, sensory language, and appeal to feelings and desires.'
  }
  return descriptions[tone] || descriptions.professional
}

/**
 * 平台选项
 */
export const PLATFORM_OPTIONS = [
  { id: 'amazon', name: 'Amazon' },
  { id: 'shopify', name: 'Shopify' },
  { id: 'taobao', name: '淘宝/天猫' },
  { id: 'shein', name: 'SHEIN' },
  { id: 'temu', name: 'TEMU' },
  { id: 'general', name: '通用' }
]

/**
 * 语言选项
 */
export const LANGUAGE_OPTIONS = [
  { id: 'en-US', name: 'English (US)' },
  { id: 'zh-CN', name: '简体中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'multi', name: '多语言' }
]

/**
 * 风格选项
 */
export const TONE_OPTIONS = [
  { id: 'professional', name: '专业' },
  { id: 'casual', name: '休闲' },
  { id: 'luxury', name: '奢华' },
  { id: 'playful', name: '活泼' },
  { id: 'technical', name: '技术' },
  { id: 'emotional', name: '情感' }
]

/**
 * 输出格式选项
 */
export const FORMAT_OPTIONS = [
  { id: 'title_bullets', name: '标题 + 卖点' },
  { id: 'paragraph', name: '段落描述' },
  { id: 'full_listing', name: '完整列表' },
  { id: 'json', name: 'JSON 格式' }
]
