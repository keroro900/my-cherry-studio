/**
 * A+ 内容 / 详情页生成提示词构建器
 * A+ Content / Detail Page Prompt Builders
 *
 * 专业级电商详情页内容生成
 * 支持：亚马逊 A+、淘宝详情页、独立站产品页等
 *
 * 核心能力：
 * 1. 深度产品视觉分析 - 从图片提取卖点
 * 2. 结构化内容生成 - 符合平台规范
 * 3. 多语言营销文案 - 本地化表达
 * 4. SEO 优化内容 - 关键词自然融入
 */

import type { AplusContentConfig, AplusModuleType } from './types'

// ==================== 模块约束定义 ====================

/**
 * 获取模块的字符限制描述
 */
function getModuleConstraints(moduleType: AplusModuleType): string {
  const modules = {
    standard_header: { headline: 150 },
    standard_image_text: { headline: 160, body: 1000 },
    standard_four_image: { caption: 160 },
    standard_comparison: { headline: 160, body: 500 },
    standard_text: { headline: 160, body: 2000 },
    standard_single_image: {},
    premium_header: { headline: 100, body: 500 },
    premium_video: { headline: 100, caption: 300 }
  }

  const constraints = modules[moduleType]
  const parts: string[] = []

  if ('headline' in constraints && constraints.headline) {
    parts.push(`Headline: max ${constraints.headline} characters`)
  }
  if ('body' in constraints && constraints.body) {
    parts.push(`Body: max ${constraints.body} characters`)
  }
  if ('caption' in constraints && constraints.caption) {
    parts.push(`Caption: max ${constraints.caption} characters`)
  }

  return parts.length > 0 ? parts.join(', ') : 'No text constraints'
}

/**
 * 获取模块类型的英文名称
 */
function getModuleEnglishName(moduleType: AplusModuleType): string {
  const names: Record<AplusModuleType, string> = {
    standard_header: 'Standard Brand Header',
    standard_image_text: 'Image with Text',
    standard_four_image: 'Four Image Highlight',
    standard_comparison: 'Comparison Chart',
    standard_text: 'Standard Text',
    standard_single_image: 'Single Image',
    premium_header: 'Premium Brand Header',
    premium_video: 'Video Module'
  }
  return names[moduleType]
}

/**
 * 获取内容风格描述
 */
function getStyleDescription(style: string): string {
  const styles: Record<string, string> = {
    professional: 'Professional, authoritative, fact-based. Use industry terminology and highlight specifications.',
    emotional:
      'Emotional, story-driven, connecting with customer feelings. Focus on benefits and lifestyle improvement.',
    technical: 'Technical, detailed specifications. Appeal to informed buyers with precise data.',
    lifestyle: 'Lifestyle-oriented, aspirational. Paint pictures of how the product fits into daily life.',
    premium: 'Premium, luxurious tone. Emphasize exclusivity, craftsmanship, and superior quality.'
  }
  return styles[style] || styles.professional
}

/**
 * 获取平台特定的合规规则
 */
function getPlatformCompliance(platform: string): string {
  const rules: Record<string, string> = {
    amazon: `[Platform Compliance - Amazon A+]
CRITICAL Amazon A+ Rules:
- NO promotional language ("best", "guaranteed", "#1", "limited time")
- NO pricing, discounts, or shipping information
- NO competitor mentions by name
- NO unverified claims or superlatives
- NO external URLs or contact information
- Focus on brand story and product differentiation
- Strictly follow character limits for each module`,

    taobao: `[Platform Compliance - 淘宝/天猫详情页]
淘宝详情页最佳实践:
- 开篇用强烈的视觉冲击和促销信息吸引注意
- 包含店铺特色和售后保障
- 使用本土化表达和网络热词
- 突出好评、销量等社会认证
- 可包含价格区间和促销活动
- 手机端优先，图文穿插`,

    shopify: `[Platform Compliance - Shopify / 独立站]
Shopify Product Page Best Practices:
- SEO-optimized headlines and meta descriptions
- Conversion-focused CTAs throughout
- Trust signals: reviews, guarantees, certifications
- Comparison tables for product variants
- FAQ sections addressing common concerns
- Cross-sell and upsell opportunities
- Mobile-responsive content structure`,

    shein: `[Platform Compliance - SHEIN]
SHEIN Product Page Guidelines:
- Fast fashion focused, trendy language
- Size guide and fit information emphasis
- Styling suggestions and outfit combinations
- User photo gallery integration
- Price-to-value messaging
- Young audience tone (Gen Z/Millennial)`,

    temu: `[Platform Compliance - Temu]
Temu Listing Best Practices:
- Value proposition upfront
- Clear product specifications
- Comparison to higher-priced alternatives
- Shipping and delivery information
- Bundle/combo suggestions
- Deal urgency messaging (where appropriate)`,

    aliexpress: `[Platform Compliance - 速卖通/AliExpress]
AliExpress Product Page Guidelines:
- Multi-language ready content
- Detailed specifications table
- Package contents list
- Shipping options and timing
- Buyer protection messaging
- Seller reputation emphasis`,

    general: `[Platform Compliance - General E-commerce]
Universal Best Practices:
- Clear, benefit-driven headlines
- Scannable content with bullet points
- Trust signals and social proof
- Mobile-optimized formatting
- SEO-friendly structure
- Call-to-action placement`
  }

  return rules[platform] || rules.general
}

/**
 * 构建系统提示词 - 专业级详情页生成
 */
export function buildSystemPrompt(config: AplusContentConfig): string {
  const { contentStyle, language, moduleTypes, platform = 'amazon' } = config

  const moduleList = moduleTypes.map((m) => `- ${getModuleEnglishName(m)} (${getModuleConstraints(m)})`).join('\n')

  return `[Role: Elite E-commerce Content Strategist & Copywriter]
You are a world-class e-commerce content specialist with 15+ years of experience creating high-converting product detail pages for Fortune 500 brands. Your expertise spans:

**Core Competencies**:
- Conversion Rate Optimization (CRO) copywriting
- Visual storytelling and information architecture
- Consumer psychology and persuasion techniques
- Platform-specific best practices (Amazon, Shopify, Taobao, etc.)
- Multilingual marketing localization

[Content Strategy Framework]
${getStyleDescription(contentStyle)}

[Target Language & Localization]
Generate all content in: ${language}
- Use culturally appropriate expressions
- Adapt tone for local market preferences
- Include region-specific social proof patterns

[Required Content Modules]
${moduleList}

[Content Excellence Standards]

**1. Headline Mastery**
- Lead with the primary benefit, not the feature
- Create urgency without being pushy
- Use power words that trigger emotion
- Keep headlines scannable (front-load key info)

**2. Body Copy Principles**
- Open with the most compelling benefit
- Use the "Problem → Agitation → Solution" framework
- Include sensory language (feel, experience, imagine)
- Break into digestible chunks with clear hierarchy
- End each section with a micro-commitment hook

**3. Visual Storytelling**
- Describe images that show the product in context
- Include lifestyle scenarios the buyer aspires to
- Suggest before/after or comparison visuals
- Recommend user-generated content style shots

**4. SEO & Discoverability**
- Naturally integrate keywords (no keyword stuffing)
- Use semantic variations of key terms
- Front-load important keywords in headlines
- Include long-tail phrase opportunities

${getPlatformCompliance(platform)}

[Output Structure]
Return a valid JSON object:
{
  "modules": [
    {
      "type": "module_type",
      "moduleName": "Display Name",
      "headline": "Benefit-driven headline",
      "body": "Compelling body copy with emotional hooks",
      "captions": ["Caption 1", "Caption 2"],
      "imageCount": 1,
      "imageSuggestions": [
        "Detailed description of recommended image including: composition, lighting, context, and emotional tone"
      ],
      "designNotes": "Layout and visual hierarchy recommendations"
    }
  ],
  "pageSummary": "Strategic overview of the content approach",
  "conversionHooks": ["Key persuasion elements used"],
  "keywordUsage": {"keyword": "context of natural integration"}
}

[Quality Checkpoint]
Before finalizing, verify:
✓ Each headline passes the "Would I click?" test
✓ Body copy answers "What's in it for me?"
✓ Image suggestions are specific and actionable
✓ Content flows as a cohesive brand story
✓ All character limits are respected

Generate exceptional detail page content that converts browsers into buyers.`
}

/**
 * 构建用户提示词 - 增强版
 */
export function buildUserPrompt(config: AplusContentConfig, productInfo?: string): string {
  const {
    brandName,
    keywords,
    targetAudience,
    moduleTypes,
    language,
    platform = 'amazon',
    productCategory,
    pricePosition
  } = config

  const moduleRequests = moduleTypes
    .map((m, i) => `${i + 1}. ${getModuleEnglishName(m)} - ${getModuleGuidance(m)}`)
    .join('\n')

  // 获取平台显示名称
  const platformNames: Record<string, string> = {
    amazon: 'Amazon A+',
    taobao: '淘宝/天猫',
    shopify: 'Shopify',
    shein: 'SHEIN',
    temu: 'Temu',
    aliexpress: 'AliExpress',
    general: 'General E-commerce'
  }

  // 获取价格定位描述
  const priceDescriptions: Record<string, string> = {
    budget: 'Value-conscious buyers seeking quality at accessible prices',
    mid: 'Quality-focused consumers balancing features and price',
    premium: 'Discerning buyers who prioritize quality over price',
    luxury: 'Affluent consumers seeking exclusivity and prestige'
  }

  const prompt = `[Product Detail Page Content Request]

**Target Platform**: ${platformNames[platform] || platform}

**Product Intelligence**:
${productInfo || 'No specific product information provided. Generate compelling generic brand content that can be customized.'}

**Product Category**: ${productCategory || 'General consumer goods'}

**Price Positioning**: ${priceDescriptions[pricePosition || 'mid'] || priceDescriptions.mid}

**Brand Identity**: ${brandName || '[Brand Name - to be specified]'}

**Strategic Keywords** (integrate naturally):
${keywords || 'Focus on benefit-driven language and emotional triggers'}

**Target Customer Profile**:
${targetAudience || 'Discerning consumers who value quality and authenticity'}

**Content Architecture** (generate in this exact order):
${moduleRequests}

**Output Language**: ${language}

[Content Generation Directives]

1. **Opening Hook**: Start with a provocative question or bold benefit statement
2. **Emotional Connection**: Address the customer's aspirations, not just needs
3. **Proof Points**: Include specific details that build credibility
4. **Visual Guidance**: Each image suggestion should be a complete creative brief
5. **Call-to-Action Undertones**: Create desire without explicit selling

**Psychological Triggers to Incorporate**:
- Social proof language ("join thousands who...")
- Scarcity/exclusivity (where appropriate)
- Authority and expertise signals
- Reciprocity and value-first messaging

**Format Requirements**:
- Headlines: Front-load with benefits, keep punchy
- Body text: Short paragraphs, bullet points where suitable
- Captions: Complement images, don't just describe them
- Image suggestions: Include mood, setting, props, and emotional context

Generate the complete content now. Return ONLY valid JSON with all required fields.`

  return prompt
}

/**
 * 获取模块的生成指导
 */
function getModuleGuidance(moduleType: AplusModuleType): string {
  const guidance: Record<AplusModuleType, string> = {
    standard_header: 'Brand story opener - establish emotional connection and differentiation',
    standard_image_text: 'Feature spotlight with lifestyle context - show benefit in action',
    standard_four_image: 'Multiple benefit showcase - quick-scan format for key features',
    standard_comparison: 'Competitive positioning or spec breakdown - build technical confidence',
    standard_text: 'Deep-dive content for engaged readers - comprehensive value proposition',
    standard_single_image: 'Hero visual moment - aspirational lifestyle or product beauty shot',
    premium_header: 'Premium brand experience - immersive storytelling opener',
    premium_video: 'Dynamic content hook - describe video concept and key moments'
  }
  return guidance[moduleType]
}

/**
 * 构建深度产品分析提示词 - 用于视觉模型
 */
export function buildImageAnalysisPrompt(): string {
  return `[Expert Product Analyst - Deep Visual Intelligence]

You are a senior product analyst with expertise in consumer goods, market positioning, and visual merchandising. Analyze this product image with the precision of a master buyer.

**ANALYSIS FRAMEWORK**

[1. Product Identification]
- Product category and subcategory
- Brand positioning tier (mass market / premium / luxury)
- Price point estimation
- Market segment

[2. Visual Design Analysis]
- Form factor and silhouette
- Color palette (primary, secondary, accent)
- Material composition and finish quality
- Craftsmanship indicators
- Ergonomic considerations

[3. Unique Selling Propositions]
- Visible differentiators from competitors
- Innovation or technology indicators
- Quality signals (stitching, materials, hardware)
- Brand story elements

[4. Target Consumer Profile]
- Demographics (age, gender, income bracket)
- Psychographics (lifestyle, values, aspirations)
- Purchase motivation (functional / emotional / status)
- Usage scenarios and contexts

[5. Marketing Angle Recommendations]
- Primary benefit to lead with
- Emotional hooks that resonate
- Technical specifications worth highlighting
- Lifestyle associations to leverage

[6. Photography Direction]
- Current image strengths to amplify
- Suggested additional angles needed
- Lifestyle context recommendations
- Props and styling suggestions

[7. Competitive Positioning]
- Likely competitor products
- Points of differentiation
- Category conventions to break
- White space opportunities

**OUTPUT FORMAT**
Provide detailed, actionable insights that can be directly used for creating compelling product detail page content. Be specific with observations - avoid generic statements.

Focus on extractable selling points and emotional triggers that convert browsers to buyers.`
}

/**
 * 构建多图分析提示词 - 用于多角度产品分析
 */
export function buildMultiImageAnalysisPrompt(imageCount: number): string {
  return `[Comprehensive Product Visual Analysis]

Analyze these ${imageCount} product images to build a complete understanding of the product for detail page content creation.

**Cross-Image Synthesis**:
1. Identify consistent design elements across all images
2. Note features visible from multiple angles
3. Catalog all visible details, materials, and finishes
4. Map the complete product story these images tell

**For Each Image, Extract**:
- Unique information not visible in other shots
- Best use case for this particular angle
- Emotional tone and styling approach
- Complementary content potential

**Consolidated Output**:
Provide a unified product profile that synthesizes all visual information into:
1. Complete feature inventory
2. Ranked selling points (by visibility and impact)
3. Recommended image sequence for detail page
4. Content themes each image supports

This analysis will drive high-converting product detail page creation.`
}
