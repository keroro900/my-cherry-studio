/**
 * GeminiEditNode 专用提示词
 * Gemini Edit Node Prompts
 *
 * 用于图片编辑和模特换装的提示词模板
 *
 * 【功能】
 * - 预设模式（preset）：根据年龄、性别、场景等参数构建专业提示词
 * - 自定义模式（custom）：使用用户输入的提示词
 *
 * 【预设模式参数】
 * - ageGroup: 年龄段 (small_kid/big_kid/adult)
 * - gender: 性别 (male/female)
 * - scenePreset: 场景预设 (home/outdoor/studio/playground/nature)
 * - styleMode: 风格模式 (daily/commercial)
 * - ethnicityPreset: 人种预设 (asian/caucasian/african_american/hispanic/mixed)
 * - posePreset: 姿态预设 (natural/sitting/playing/walking)
 *
 * 【Single Source of Truth】
 * 所有预设数据从 presets/ 注册表获取
 */

import {
  AGE_PRESETS,
  ETHNICITY_PRESETS,
  GENDER_PRESETS,
  getAgePreset,
  getEthnicityPreset,
  getGenderPreset,
  getPosePreset,
  getScenePreset,
  getStyleModePreset,
  POSE_PRESETS,
  SCENE_PRESETS,
  STYLE_MODE_PRESETS
} from '../../../presets'

// ==================== 类型定义 ====================

export interface GeminiEditPromptConfig {
  ageGroup?: 'small_kid' | 'big_kid' | 'adult'
  gender?: 'male' | 'female'
  scenePreset?: 'home' | 'outdoor' | 'studio' | 'playground' | 'nature'
  styleMode?: 'daily' | 'commercial'
  ethnicityPreset?: 'asian' | 'caucasian' | 'african_american' | 'hispanic' | 'mixed'
  posePreset?: 'natural' | 'sitting' | 'playing' | 'walking'
}

export interface PromptJson {
  garmentDescription?: string
  styleConstraint?: string
}

// ==================== 导出预设常量（向后兼容）====================

export { AGE_PRESETS, ETHNICITY_PRESETS, GENDER_PRESETS, POSE_PRESETS, SCENE_PRESETS, STYLE_MODE_PRESETS }

// ==================== 提示词构建函数 ====================

/**
 * 构建预设模式的专业提示词
 * Build Preset Mode Professional Prompt
 *
 * 根据配置参数构建完整的模特换装/图片编辑提示词
 *
 * 【提示词结构】
 * 1. 任务定位 - 专业模特摄影/换装图片生成
 * 2. 模特描述 - 年龄、性别、人种、姿态、表情
 * 3. 服装指令 - 从 promptJson 或通用描述
 * 4. 场景描述 - 位置、背景、道具
 * 5. 光影描述 - 光照类型和氛围
 * 6. 风格质量 - 风格模式和输出质量
 * 7. 额外约束 - 来自 promptJson 的风格约束
 * 8. 禁止项 - 严格禁止的元素
 * 9. 输出指令 - 直接生成图片
 *
 * @param config - 节点配置参数
 * @param promptJson - 可选的来自智能提示词节点的 JSON 数据
 * @returns 完整的提示词字符串
 */
export function buildPresetPrompt(config: GeminiEditPromptConfig, promptJson?: PromptJson): string {
  const parts: string[] = []

  // 获取配置值（带默认值）
  const ageGroup = config.ageGroup || 'big_kid'
  const gender = config.gender || 'female'
  const scenePreset = config.scenePreset || 'home'
  const styleMode = config.styleMode || 'daily'
  const ethnicity = config.ethnicityPreset || 'asian'
  const pose = config.posePreset || 'natural'

  // 获取预设数据（使用新的 getFullPreset 方法获取扩展字段）
  const ageData = getAgePreset(ageGroup)
  const genderData = getGenderPreset(gender)
  const sceneData = getScenePreset(scenePreset)
  const styleData = getStyleModePreset(styleMode)
  const ethnicityData = getEthnicityPreset(ethnicity)
  const poseData = getPosePreset(pose)

  // 1. 任务定位
  parts.push(`[Task: Professional Model Photography / Clothing Try-On Image Generation]`)

  // 2. 模特描述 - 使用新字段名
  parts.push(`[Model Description]
Generate a photorealistic image of a ${ageData?.en || ''}, ${genderData?.en || ''}, ${ethnicityData?.detailedDescription || ''}.
Pose: ${poseData?.detailedDescription || ''}
Expression: ${ageData?.expression || ''}
Physical appearance: ${genderData?.features || ''}`)

  // 3. 服装指令（从 promptJson 或使用通用描述）
  if (promptJson?.garmentDescription) {
    parts.push(`[Clothing - MUST PRESERVE FROM REFERENCE]
${promptJson.garmentDescription}
CRITICAL: Accurately reproduce all clothing details from the input garment image:
- Exact colors, patterns, and prints
- Collar style, sleeve length, fit
- All decorative elements (buttons, zippers, pockets)
- Brand logos or character prints if visible`)
  } else {
    parts.push(`[Clothing - MUST PRESERVE FROM REFERENCE]
CRITICAL: The model MUST wear the exact clothing shown in the reference garment image.
Preserve ALL details:
- Exact colors and color combinations
- All patterns, prints, and graphics
- Collar type, sleeve length, overall silhouette
- Any visible brand elements or decorations`)
  }

  // 4. 场景描述 - 使用新字段名
  parts.push(`[Scene Setting]
Location: ${sceneData?.en || ''}
Background: ${sceneData?.background || ''}
Props: ${sceneData?.props || ''}`)

  // 5. 光影描述 - 使用新字段名
  parts.push(`[Lighting & Atmosphere]
${sceneData?.lighting || ''}`)

  // 6. 风格质量 - 使用新字段名
  parts.push(`[Style & Quality]
${styleData?.styleDescription || ''}
Output quality: ${styleData?.quality || ''}
Resolution: High-resolution, sharp details, professional photography quality`)

  // 7. 额外风格约束（如果有）
  if (promptJson?.styleConstraint) {
    parts.push(`[Additional Style Constraints]
${promptJson.styleConstraint}`)
  }

  // 8. 禁止项
  parts.push(`[Strict Prohibitions]
- NO text, watermarks, logos, or UI elements
- NO distortion or unnatural body proportions
- NO inappropriate content
- NO changing the clothing design from the reference
- NO extra people or characters not requested`)

  // 9. 输出指令
  parts.push(`[Output]
Generate the image directly. Start pixel generation immediately. No text output.`)

  return parts.join('\n\n')
}

/**
 * 构建简化版提示词（用于快速生成）
 * Build Simplified Prompt
 *
 * @param config - 节点配置参数
 * @returns 简化的提示词字符串
 */
export function buildSimplePrompt(config: GeminiEditPromptConfig): string {
  const ageData = getAgePreset(config.ageGroup || 'big_kid')
  const genderData = getGenderPreset(config.gender || 'female')
  const ethnicityData = getEthnicityPreset(config.ethnicityPreset || 'asian')
  const sceneData = getScenePreset(config.scenePreset || 'home')
  const poseData = getPosePreset(config.posePreset || 'natural')

  return `Generate a photorealistic image of a ${ageData?.en || ''} ${genderData?.en || ''} ${ethnicityData?.detailedDescription || ''}, ${poseData?.detailedDescription || ''}, wearing the exact clothing from the reference image. Setting: ${sceneData?.en || ''}, ${sceneData?.lighting || ''}. Preserve all clothing details exactly. High quality professional photography.`
}

/**
 * 获取负面提示词
 * Get Negative Prompt
 *
 * @returns 负面提示词字符串
 */
export function getNegativePrompt(): string {
  return 'text, watermark, logo, writing, letters, signature, low quality, lowres, blurry, bad anatomy, distorted, disfigured, bad proportions, deformed, multiple people, extra limbs, cartoon, illustration, painting, 3d render'
}

// ==================== 模特生成提示词（从 system-prompts.ts 迁移）====================

/**
 * 默认的模特生成 prompt 模板（支持年龄段、性别和人种）
 * 从旧后端 gemini_client.py 移植
 */
export const DEFAULT_GEMINI_MODEL_PROMPT = `生成一个 {gender_word}（{age_group_label}），穿着上述服装搭配，在 {scene_preset_label} 场景中自然站立或行走，画面干净、质感好，突出衣服细节。

模特年龄：{age_years} 岁
人种特征：{ethnicity}
外观特征：{appearance}
服装描述：{subject}
前景：{foreground}
中景：{midground}
背景：{background}
构图：{composition}
视觉指导：{visual_guidance}
色彩色调：{color_tone}
光线氛围：{lighting_mood}
相机参数：{camera_params}
IP 品牌：{ip_brand}
IP 描述：{ip_desc}
标题：{caption}

要求：
- 真实自然的形象，不完美但可爱/自然
- **根据服装风格、图案、颜色、IP角色来推断模特的长相和发型**，年龄严格按照JSON中的age_years，但长相、发型、气质要根据服装风格推断
- 保持 iPhone 快照风格，自然光、抓拍感
- 突出服装细节和整体搭配效果
- **背景装饰与服装高度关联**：前景、中景、背景都要包含与服装主题相关的装饰元素，形成完整的主题氛围。如果服装上有特定图案（恐龙、心形、爪子等），背景必须有相应的装饰元素（玩具、墙贴、地毯图案等）；如果服装是IP角色，背景必须有该IP相关的装饰、玩具、墙贴；如果服装上有文字，背景装饰要与文字主题呼应
- 场景与服装风格匹配，画面干净有质感
- **重要**：必须严格按照 ethnicity 字段中的人种特征生成模特，确保人种特征准确（如肤色、面部特征等）
- **相机参数要求**：必须严格按照 camera_params 字段中的相机参数和高质量词生成图片，包括镜头参数、对焦方式、画质描述等
- **严格按照JSON字段生成**：必须完全按照JSON中的appearance、foreground、midground、background、composition、visual_guidance、lighting_mood、camera_params等字段的详细描述生成图片，确保生成的图片与JSON描述完全对齐，特别是背景装饰要与服装主题高度关联`

/**
 * 从衣服生成模特的提示词模板
 * 从旧后端 model_prompts.py 移植
 */
export const MODEL_FROM_CLOTHES_PROMPT = `
生成一张真实自然的儿童模特服装展示照片。你是一名专业儿童服装摄影师，需要根据输入的服装图片生成一张真实自然的模特展示图，要求达到真实照片的质量和质感。

**重要：请直接生成图像，不要提供文字描述、分析或解释。**

输入说明：
- 第 1 张图片是服装的正面图（可能包含上衣和裤子）
- 第 2 张图片（如果存在）是服装的背面图
- 你需要仔细观察并完全还原服装的所有细节：颜色、图案、印花、文字、版型、款式、材质纹理

核心要求：
1. **严格还原服装**：必须完全按照输入图片中的服装设计生成，不能改变任何颜色、图案、印花、文字、版型、款式细节
2. **真实自然的模特**：生成一个真实自然的孩子形象，年龄大约 {age_years} 岁，表情自然不做作，像真实照片中抓拍的瞬间。**根据服装风格、图案、颜色、IP角色来推断模特的长相和发型**
3. **真实照片质感**：画面必须像真实的智能手机拍摄的照片，具有真实的纹理、光线和氛围
4. **背景装饰与服装高度关联**：前景、中景、背景都要包含与服装主题相关的装饰元素，形成完整的主题氛围

场景和构图（{scene_style} 风格）：
- **前景**：{foreground}。**必须包含与服装主题相关的装饰元素**
- **中景**：{midground}。**必须包含与服装主题相关的装饰元素**
- **背景**：{background}。**必须包含与服装主题相关的背景装饰**
- **构图方式**：{composition}
- **光线氛围**：{lighting}
- **视觉质感**：{visual_style}

模特姿态和表情：
{pose_desc}

详细视觉要求：
- **真实感优先**：模特形象要完全真实自然，不能是卡通、插画或AI生成感强烈的风格
- **皮肤纹理**：真实的皮肤质感，有轻微的毛孔、纹理，不过度光滑或美化
- **自然表情**：表情自然真实，可以是微笑、大笑、专注等，符合真实孩子的表情特征
- **服装贴合度**：服装要自然贴合身体，有真实的穿着感，不能像画上去的一样
- **环境融合**：模特与场景自然融合，有真实的环境光反射和阴影
- **细节还原**：必须完全还原服装上的所有图案、文字、装饰等细节，不能遗漏或改变
- **画面质量**：高清清晰，但保持真实照片的自然质感，不要过度锐化或美化

色彩和色调：
- 自然真实的色彩还原，不过度饱和或鲜艳
- 根据场景光线，有真实的光影变化和色彩过渡
- 服装颜色必须与输入图片完全一致

**重要提醒**：
- 如果输入图片中有明确的图案、文字或IP角色，必须完全还原，不能改变
- 画面要像真实的父母或朋友用手机拍摄的孩子照片，自然、真实、不做作
- 不要生成过于完美、像商业广告一样摆拍的效果，要更像真实的生活瞬间

**最终要求：请根据以上所有要求直接生成一张高质量的儿童模特服装展示照片，不要返回任何文字内容。**
`.trim()

// ==================== 模特生成预设配置 ====================

/**
 * 年龄段配置
 */
export const MODEL_AGE_GROUPS = {
  small_kid: {
    label: '小童 (3-7岁)',
    age_years_range: [3, 7] as const
  },
  big_kid: {
    label: '大童 (8-12岁)',
    age_years_range: [8, 12] as const
  },
  adult: {
    label: '成人 (18-30岁)',
    age_years_range: [18, 30] as const
  }
} as const

/**
 * 模特生成场景预设配置
 */
export const MODEL_SCENE_PRESETS = {
  home: {
    label: '室内家居',
    foreground: '自然的生活环境细节，如地毯纹理、地板材质、家具边缘等',
    midground: '温馨的室内环境，如沙发、窗户、家具，柔和的光线营造舒适氛围',
    background: '柔和虚化的室内背景，如墙壁、装饰画、书架等，营造真实的家居感',
    composition: 'iPhone 风格智能手机摄影，自然角度拍摄，略带抓拍感的真实视角',
    lighting: '柔和的自然光线从窗户透入，温和的室内环境光，没有强烈的阴影',
    visual_style: '真实自然的智能手机照片质感，略带轻微颗粒感，自然的色彩还原'
  },
  outdoor: {
    label: '户外场景',
    foreground: '户外地面细节，如草地纹理、路面、台阶等',
    midground: '公园或游乐场环境，如滑梯、秋千、树木等元素，自然的光线和阴影',
    background: '虚化的户外背景，如建筑物、天空、远处的景观，营造真实的户外场景感',
    composition: 'iPhone 风格户外摄影，自然角度，捕捉孩子在户外活动的真实瞬间',
    lighting: '自然日光，根据天气可以是明亮的阳光或柔和的阴天光线，真实的户外光线质感',
    visual_style: '真实的户外照片质感，自然的光线变化，真实的皮肤质感和环境细节'
  }
} as const

/**
 * 性别预设配置
 */
export const MODEL_GENDER_PRESETS = {
  male: {
    words: {
      small_kid: 'a little boy',
      big_kid: 'a boy',
      adult: 'a young man'
    }
  },
  female: {
    words: {
      small_kid: 'a little girl',
      big_kid: 'a girl',
      adult: 'a young woman'
    }
  }
} as const

/**
 * 姿态预设配置
 */
export const MODEL_POSE_PRESETS = {
  natural: '自然站立或轻松行走，动作放松自然，表情自然真实，可以是微笑、看镜头或看向一旁，像真实的孩子一样不做作',
  sitting: '自然地坐着或蹲着，姿态舒适放松，可以是盘腿坐、侧坐或蹲姿，表情自然，像真实生活中休息或玩耍的瞬间',
  playing:
    '活泼玩耍或运动的姿态，充满活力和童真，可以是跳跃、奔跑、挥舞手臂等动态姿势，表情开心兴奋，捕捉真实的活动瞬间'
} as const

// ==================== 模特生成提示词构建函数 ====================

/**
 * 从 JSON 数据构建 Gemini 生模特 prompt
 * 从旧后端 gemini_client.py 的 build_model_prompt_from_json 移植
 *
 * 支持的 JSON 字段：
 * - age_years: 年龄数字
 * - ethnicity: 人种描述
 * - appearance: 外观特征（长相、发型等）
 * - subject: 服装描述
 * - foreground: 前景描述
 * - midground: 中景描述
 * - background: 背景描述
 * - composition: 构图方式
 * - visual_guidance: 视觉指导
 * - color_tone: 色彩色调
 * - lighting_mood: 光线氛围
 * - camera_params: 相机参数
 * - ip_brand: IP品牌
 * - ip_desc: IP描述
 * - caption: 最终标题/提示词
 * - age_group: 年龄段 (small_kid/big_kid/adult)
 * - scene_preset: 场景预设 (home/outdoor)
 * - gender: 性别 (male/female)
 */
export function buildModelPromptFromJson(
  baseJson: Record<string, any>,
  ageGroup: string = 'big_kid',
  scenePreset: string = 'home',
  gender: string = 'female'
): string {
  // 优先使用 JSON 中的配置，否则使用传入的参数
  const jsonAgeGroup = baseJson.age_group || ageGroup
  const jsonScenePreset = baseJson.scene_preset || scenePreset
  const jsonGender = baseJson.gender || gender

  // 获取配置
  const ageInfo = MODEL_AGE_GROUPS[jsonAgeGroup as keyof typeof MODEL_AGE_GROUPS] || MODEL_AGE_GROUPS.big_kid
  const sceneInfo = MODEL_SCENE_PRESETS[jsonScenePreset as keyof typeof MODEL_SCENE_PRESETS] || MODEL_SCENE_PRESETS.home
  const genderInfo =
    MODEL_GENDER_PRESETS[jsonGender as keyof typeof MODEL_GENDER_PRESETS] || MODEL_GENDER_PRESETS.female

  // 根据年龄 + 性别组合出英文描述
  const genderWord = genderInfo.words[jsonAgeGroup as keyof typeof genderInfo.words] || genderInfo.words.big_kid

  // 构建安全的字典，确保未提供的字段返回空字符串或合理默认值
  const safeDict: Record<string, any> = {
    ...baseJson,
    age_group_label: ageInfo.label,
    scene_preset_label: sceneInfo.label,
    gender_word: genderWord,
    // 确保所有模板字段都有值（避免 {xxx} 残留）
    ethnicity: baseJson.ethnicity || '',
    appearance: baseJson.appearance || '',
    subject: baseJson.subject || '',
    foreground: baseJson.foreground || sceneInfo.foreground || '',
    midground: baseJson.midground || sceneInfo.midground || '',
    background: baseJson.background || sceneInfo.background || '',
    composition: baseJson.composition || sceneInfo.composition || '',
    visual_guidance: baseJson.visual_guidance || '',
    color_tone: baseJson.color_tone || '',
    lighting_mood: baseJson.lighting_mood || sceneInfo.lighting || '',
    ip_brand: baseJson.ip_brand || '',
    ip_desc: baseJson.ip_desc || '',
    caption: baseJson.caption || ''
  }

  // 如果没有 age_years，根据 age_group 生成一个合理的值
  if (!safeDict.age_years) {
    const ageRange = ageInfo.age_years_range
    safeDict.age_years = Math.floor((ageRange[0] + ageRange[1]) / 2)
  }

  // 如果没有 camera_params，根据场景和年龄组生成默认值
  if (!safeDict.camera_params) {
    let lens = '85mm f/1.4'
    if (jsonAgeGroup === 'small_kid') {
      lens = '50mm f/1.8'
    }

    const lightingDesc =
      jsonScenePreset === 'home'
        ? 'natural window lighting, soft ambient glow'
        : 'natural daylight, diffused overcast light'

    safeDict.camera_params = `Ultra-realistic portrait, sharp focus on details, natural skin texture with visible pores and translucency. Shot on iPhone with ${lens} lens equivalent, cinematic depth of field, ${lightingDesc}, authentic smartphone photo quality with slight film grain texture, realistic color reproduction without artificial enhancement, candid photo feel with imperfect framing, natural shadows and highlights, no studio lighting or professional setup. High resolution, 4K quality, authentic details, professional photography aesthetic`
  }

  // 使用模板替换
  let result = DEFAULT_GEMINI_MODEL_PROMPT
  for (const [key, value] of Object.entries(safeDict)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''))
  }

  return result
}

/**
 * 构建从衣服生成模特的提示词
 * 从旧后端 model_prompts.py 的 build_model_from_clothes_prompt 移植
 */
export function buildModelFromClothesPrompt(
  garmentDesc: string = '',
  sceneStyle: string = 'home',
  modelPose: string = 'natural',
  ageGroup: string = 'big_kid',
  extraNote: string = ''
): string {
  if (!garmentDesc.trim()) {
    garmentDesc = '儿童服装套装'
  }

  // 获取场景配置
  const sceneConfig = MODEL_SCENE_PRESETS[sceneStyle] || MODEL_SCENE_PRESETS.home

  // 获取姿态描述
  const poseDesc = MODEL_POSE_PRESETS[modelPose] || MODEL_POSE_PRESETS.natural

  // 获取年龄配置
  const ageInfo = MODEL_AGE_GROUPS[ageGroup] || MODEL_AGE_GROUPS.big_kid
  const ageYears = Math.floor((ageInfo.age_years_range[0] + ageInfo.age_years_range[1]) / 2)

  // 构建提示词
  let result = MODEL_FROM_CLOTHES_PROMPT.replace('{age_years}', String(ageYears))
    .replace('{scene_style}', sceneConfig.label)
    .replace('{foreground}', sceneConfig.foreground)
    .replace('{midground}', sceneConfig.midground)
    .replace('{background}', sceneConfig.background)
    .replace('{composition}', sceneConfig.composition)
    .replace('{lighting}', sceneConfig.lighting)
    .replace('{visual_style}', sceneConfig.visual_style)
    .replace('{pose_desc}', poseDesc)

  if (extraNote) {
    result += `\n\n额外说明：${extraNote}`
  }

  return result
}
