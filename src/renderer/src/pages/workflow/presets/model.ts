/**
 * 模特预设注册表
 * Model Preset Registry
 *
 * 包含：
 * - 年龄段预设 (AGE_PRESETS)
 * - 性别预设 (GENDER_PRESETS)
 * - 场景预设 (SCENE_PRESETS)
 * - 人种预设 (ETHNICITY_PRESETS)
 * - 姿态预设 (POSE_PRESETS)
 * - 风格模式预设 (STYLE_MODE_PRESETS)
 *
 * 【Single Source of Truth】
 * UI 选项从此注册表自动生成，添加/删除预设时 UI 自动同步
 *
 * @module presets/model
 */

import {
  type AgeGroupId,
  type AgePresetDefinition,
  createPresetCategory,
  type EthnicityId,
  type EthnicityPresetDefinition,
  type GenderId,
  type GenderPresetDefinition,
  type PoseId,
  type PosePresetDefinition,
  type PresetDefinition,
  type SceneId,
  type ScenePresetDefinition,
  type StyleModeId,
  type StyleModePresetDefinition
} from './types'

// ==================== 年龄段预设 ====================

const AGE_PRESET_DEFINITIONS: Record<AgeGroupId, AgePresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select age group',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    en: '',
    ageRange: '',
    defaultAge: 0,
    pose: '',
    expression: ''
  },
  small_kid: {
    id: 'small_kid',
    label: '小童 (4-7岁)',
    description: 'Small kid aged 4-7 years',
    systemPromptBlock: `adorable child aged 4-7 years old`,
    userPromptBlock: `**Model Age: SMALL KID (4-7 years)**
Natural playful stance, curious body language.
Innocent, happy, bright eyes with genuine child-like joy.`,
    en: 'adorable child aged 4-7 years old',
    ageRange: '4-7 year old child',
    defaultAge: 6,
    pose: 'natural playful stance, curious body language',
    expression: 'innocent, happy, bright eyes with genuine child-like joy'
  },
  big_kid: {
    id: 'big_kid',
    label: '大童 (8-12岁)',
    description: 'Big kid aged 8-12 years',
    systemPromptBlock: `energetic child aged 8-12 years old`,
    userPromptBlock: `**Model Age: BIG KID (8-12 years)**
Confident natural pose, relaxed shoulders.
Friendly smile, confident gaze, youthful enthusiasm.`,
    en: 'energetic child aged 8-12 years old',
    ageRange: '8-12 year old child',
    defaultAge: 10,
    pose: 'confident natural pose, relaxed shoulders',
    expression: 'friendly smile, confident gaze, youthful enthusiasm'
  },
  teen: {
    id: 'teen',
    label: '青少年 (13-17岁)',
    description: 'Teenager aged 13-17 years',
    systemPromptBlock: `fashion-conscious teenager aged 13-17 years old`,
    userPromptBlock: `**Model Age: TEENAGER (13-17 years)**
Trendy casual stance, relaxed yet expressive.
Cool, youthful confidence with natural smile.`,
    en: 'fashion-conscious teenager aged 13-17 years old',
    ageRange: '13-17 year old teenager',
    defaultAge: 15,
    pose: 'trendy casual stance, relaxed yet expressive',
    expression: 'cool, youthful confidence with natural smile'
  },
  young_adult: {
    id: 'young_adult',
    label: '青年 (18-25岁)',
    description: 'Young adult aged 18-25 years',
    systemPromptBlock: `young adult aged 18-25 years old`,
    userPromptBlock: `**Model Age: YOUNG ADULT (18-25 years)**
Casual confident stance, subtle dynamic posture.
Fresh and stylish, approachable.`,
    en: 'young adult aged 18-25 years old',
    ageRange: '18-25 young adult',
    defaultAge: 22,
    pose: 'casual confident stance, subtle dynamic posture',
    expression: 'fresh and stylish, approachable'
  },
  adult: {
    id: 'adult',
    label: '成人 (26-40岁)',
    description: 'Adult model',
    systemPromptBlock: `young adult model aged 20-28 years old`,
    userPromptBlock: `**Model Age: ADULT (26-40 years)**
Professional model stance, elegant posture.
Natural confident expression, approachable look.`,
    en: 'young adult model aged 20-28 years old',
    ageRange: 'adult',
    defaultAge: 25,
    pose: 'professional model stance, elegant posture',
    expression: 'natural confident expression, approachable look'
  },
  mature: {
    id: 'mature',
    label: '中年 (40+)',
    description: 'Mature adult 40+ years',
    systemPromptBlock: `mature adult aged 40+ years old`,
    userPromptBlock: `**Model Age: MATURE (40+ years)**
Elegant mature posture, poised.
Sophisticated, gentle confidence.`,
    en: 'mature adult aged 40+ years old',
    ageRange: '40+ mature adult',
    defaultAge: 45,
    pose: 'elegant mature posture, poised',
    expression: 'sophisticated, gentle confidence'
  }
}

export const AGE_PRESETS = {
  ...createPresetCategory<AgeGroupId>('age', '年龄段', AGE_PRESET_DEFINITIONS as Record<AgeGroupId, PresetDefinition>),

  /**
   * 获取完整的年龄段预设（包含所有扩展字段）
   */
  getFullPreset(id: AgeGroupId): AgePresetDefinition | undefined {
    return AGE_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): AgePresetDefinition[] {
    return Object.values(AGE_PRESET_DEFINITIONS)
  }
}

// ==================== 性别预设 ====================

const GENDER_PRESET_DEFINITIONS: Record<GenderId, GenderPresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select gender',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    en: '',
    genderLabel: '',
    features: ''
  },
  female: {
    id: 'female',
    label: '女',
    description: 'Female',
    systemPromptBlock: `female model`,
    userPromptBlock: `**Gender: FEMALE**
Healthy natural look, age-appropriate appearance.`,
    en: 'female',
    genderLabel: 'girl',
    features: 'healthy natural look, age-appropriate appearance'
  },
  male: {
    id: 'male',
    label: '男',
    description: 'Male',
    systemPromptBlock: `male model`,
    userPromptBlock: `**Gender: MALE**
Healthy natural look, age-appropriate appearance.`,
    en: 'male',
    genderLabel: 'boy',
    features: 'healthy natural look, age-appropriate appearance'
  },
  unisex: {
    id: 'unisex',
    label: '不区分',
    description: 'Unisex',
    systemPromptBlock: `model`,
    userPromptBlock: `**Gender: UNISEX**
Gender-neutral styling, healthy natural look.`,
    en: 'unisex',
    genderLabel: 'kid',
    features: 'gender-neutral styling, healthy natural look'
  }
}

export const GENDER_PRESETS = {
  ...createPresetCategory<GenderId>('gender', '性别', GENDER_PRESET_DEFINITIONS as Record<GenderId, PresetDefinition>),

  /**
   * 获取完整的性别预设（包含所有扩展字段）
   */
  getFullPreset(id: GenderId): GenderPresetDefinition | undefined {
    return GENDER_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): GenderPresetDefinition[] {
    return Object.values(GENDER_PRESET_DEFINITIONS)
  }
}

// ==================== 场景预设（扩展版）====================

const SCENE_PRESET_DEFINITIONS: Record<string, ScenePresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select scene',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    en: '',
    lighting: '',
    background: '',
    props: ''
  },
  studio: {
    id: 'studio',
    label: '专业影棚',
    description: 'Professional studio',
    systemPromptBlock: `professional photography studio setting`,
    userPromptBlock: `**Scene: PROFESSIONAL STUDIO**
Clean white or light gray seamless backdrop.
Three-point studio lighting, soft key light with fill and rim.
Minimal, professional product photography setup.`,
    en: 'professional photography studio',
    lighting: 'three-point studio lighting, soft key light with fill and rim',
    background: 'clean white or light gray seamless backdrop',
    props: 'minimal, professional product photography setup',
    foreground: 'Clean studio floor or backdrop, neat and professional',
    midground: 'Professional studio environment with soft even lighting',
    composition: 'Professional studio shot, balanced composition highlighting garment and model',
    visual_style: 'High-quality professional photography, clean and sharp, accurate colors, e-commerce ready'
  },
  home: {
    id: 'home',
    label: '室内家居',
    description: 'Cozy home environment',
    systemPromptBlock: `cozy indoor home setting`,
    userPromptBlock: `**Scene: HOME INTERIOR**
Modern minimalist living room or bedroom, clean and tidy.
Soft natural window light with warm ambient fill, golden hour quality.
Comfortable furniture, soft cushions, warm blankets.`,
    en: 'cozy indoor home setting',
    lighting: 'soft natural window light with warm ambient fill, golden hour quality',
    background: 'modern minimalist living room or bedroom, clean and tidy',
    props: 'comfortable furniture, soft cushions, warm blankets',
    foreground:
      'Natural living environment details like carpet texture, floor material, furniture edges. MUST include theme-related decorative elements.',
    midground:
      'Cozy indoor environment with sofa, windows, furniture. Soft lighting creates comfortable atmosphere. MUST include theme-related elements.',
    composition: 'iPhone-style smartphone photography, natural angle, slightly candid authentic perspective',
    visual_style: 'Authentic natural smartphone photo quality, slight film grain, natural color reproduction'
  },
  outdoor: {
    id: 'outdoor',
    label: '户外场景',
    description: 'Natural outdoor background',
    systemPromptBlock: `bright outdoor natural setting`,
    userPromptBlock: `**Scene: OUTDOOR NATURE**
Lush green park or garden with blurred bokeh.
Natural daylight, soft diffused sunlight, no harsh shadows.
Natural greenery, flowers, playground elements.`,
    en: 'bright outdoor natural setting',
    lighting: 'natural daylight, soft diffused sunlight, no harsh shadows',
    background: 'lush green park or garden with blurred bokeh',
    props: 'natural greenery, flowers, playground elements',
    foreground:
      'Outdoor ground details like grass texture, pavement, steps. Include theme-related elements where appropriate.',
    midground: 'Park or playground environment with slides, swings, trees. Natural light and shadows.',
    composition: 'iPhone-style outdoor photography, natural angle capturing child in outdoor activity',
    visual_style: 'Authentic outdoor photo quality, natural lighting variation, realistic skin texture'
  },
  playground: {
    id: 'playground',
    label: '游乐场',
    description: 'Colorful playground',
    systemPromptBlock: `colorful children playground`,
    userPromptBlock: `**Scene: PLAYGROUND**
Playground equipment, slides, swings with safety surfacing.
Bright natural daylight, cheerful atmosphere.
Playground toys, balls, colorful elements.`,
    en: 'colorful children playground',
    lighting: 'bright natural daylight, cheerful atmosphere',
    background: 'playground equipment, slides, swings with safety surfacing',
    props: 'playground toys, balls, colorful elements'
  },
  nature: {
    id: 'nature',
    label: '自然风景',
    description: 'Beautiful nature scene',
    systemPromptBlock: `beautiful natural outdoor scene`,
    userPromptBlock: `**Scene: NATURE**
Forest path, flower meadow, or beach scene.
Golden hour sunlight, warm and soft.
Natural elements, flowers, leaves, beach accessories.`,
    en: 'beautiful natural outdoor scene',
    lighting: 'golden hour sunlight, warm and soft',
    background: 'forest path, flower meadow, or beach scene',
    props: 'natural elements, flowers, leaves, beach accessories'
  },
  beach: {
    id: 'beach',
    label: '海边度假',
    description: 'Sunny beach vacation',
    systemPromptBlock: `sunny beach vacation scene`,
    userPromptBlock: `**Scene: BEACH**
Blue ocean, sandy beach, clear sky.
Bright sunlight, golden reflections, soft sea breeze feel.
Beach toys, shells, small umbrella, towel.`,
    en: 'sunny beach vacation scene',
    lighting: 'bright sunlight, golden reflections, soft sea breeze feel',
    background: 'blue ocean, sandy beach, clear sky',
    props: 'beach toys, shells, small umbrella, towel',
    composition: 'vacation vibe, relaxed framing',
    visual_style: 'warm, vibrant summer palette'
  },
  urban: {
    id: 'urban',
    label: '城市街景',
    description: 'Modern city street',
    systemPromptBlock: `modern city street scene`,
    userPromptBlock: `**Scene: URBAN**
Contemporary buildings, street textures.
Daylight with urban reflections or neon at night.
Street signs, crates, subtle urban elements.`,
    en: 'modern city street scene',
    lighting: 'daylight with urban reflections or neon at night',
    background: 'contemporary buildings, street textures',
    props: 'street signs, crates, subtle urban elements',
    composition: 'street style framing',
    visual_style: 'trendy, slightly high-contrast'
  },
  campus: {
    id: 'campus',
    label: '校园青春',
    description: 'School campus',
    systemPromptBlock: `school campus scene`,
    userPromptBlock: `**Scene: CAMPUS**
Schoolyard, classroom decor, lockers.
Soft daylight, classroom or yard light.
Books, backpacks, sports items.`,
    en: 'school campus scene',
    lighting: 'soft daylight, classroom or yard light',
    background: 'schoolyard, classroom decor, lockers',
    props: 'books, backpacks, sports items',
    composition: 'youthful academic vibe',
    visual_style: 'clean, friendly tone'
  },
  sakura: {
    id: 'sakura',
    label: '樱花季节',
    description: 'Cherry blossom',
    systemPromptBlock: `spring cherry blossom scene`,
    userPromptBlock: `**Scene: SAKURA**
Sakura trees, petals falling.
Soft golden hour or overcast soft light.
Flower basket, ribbons.`,
    en: 'spring cherry blossom scene',
    lighting: 'soft golden hour or overcast soft light',
    background: 'sakura trees, petals falling',
    props: 'flower basket, ribbons',
    composition: 'romantic spring vibe',
    visual_style: 'pastel, dreamy'
  },
  gallery: {
    id: 'gallery',
    label: '艺术画廊',
    description: 'Art gallery',
    systemPromptBlock: `art gallery aesthetic scene`,
    userPromptBlock: `**Scene: GALLERY**
White walls, artworks, minimalist decor.
Soft, spot-lit highlights.
Frames, sculpture elements.`,
    en: 'art gallery aesthetic scene',
    lighting: 'soft, spot-lit highlights',
    background: 'white walls, artworks, minimalist decor',
    props: 'frames, sculpture elements',
    composition: 'aesthetic editorial framing',
    visual_style: 'refined, sophisticated'
  },
  // ==================== 居家生活 ====================
  living_room_sunny: {
    id: 'living_room_sunny',
    label: '阳光客厅',
    description: 'Sunny living room',
    systemPromptBlock: `sunny living room interior`,
    userPromptBlock: `**Scene: SUNNY LIVING ROOM**
Bright living room with sunlight streaming in.
Natural bright daylight, warm sunbeams.
Sofa, rug, plants, coffee table.`,
    en: 'sunny living room interior',
    lighting: 'natural bright daylight, warm sunbeams',
    background: 'bright living room',
    props: 'sofa, rug, plants, coffee table',
    composition: 'homey, welcoming',
    visual_style: 'bright, airy, warm'
  },
  bathroom_luxury: {
    id: 'bathroom_luxury',
    label: '豪华浴室',
    description: 'Luxury bathroom',
    systemPromptBlock: `luxury bathroom interior`,
    userPromptBlock: `**Scene: LUXURY BATHROOM**
Marble bathroom with bathtub and large mirror.
Clean, soft white lighting.
Bathtub, mirror, towels, toiletries.`,
    en: 'luxury bathroom interior',
    lighting: 'clean, soft white lighting',
    background: 'marble bathroom',
    props: 'bathtub, mirror, towels',
    composition: 'clean, spa-like',
    visual_style: 'clean, white, luxury'
  },
  bathroom_mirror: {
    id: 'bathroom_mirror',
    label: '浴室镜前',
    description: 'Bathroom mirror selfie view',
    systemPromptBlock: `bathroom mirror selfie scene`,
    userPromptBlock: `**Scene: BATHROOM MIRROR**
Standing in front of bathroom mirror.
Vanity lighting, flattering face light.
Mirror reflection, sink, tiles.`,
    en: 'bathroom mirror selfie scene',
    lighting: 'vanity lighting, flattering face light',
    background: 'bathroom tiles',
    props: 'mirror reflection, sink',
    composition: 'selfie style, intimate',
    visual_style: 'realistic, daily life'
  },
  walk_in_closet: {
    id: 'walk_in_closet',
    label: '衣帽间',
    description: 'Walk-in closet',
    systemPromptBlock: `walk-in closet interior`,
    userPromptBlock: `**Scene: CLOSET**
Walk-in closet with hanging clothes and shelves.
Bright, even indoor lighting.
Clothes racks, shelves, mirror, shoes.`,
    en: 'walk-in closet interior',
    lighting: 'bright, even indoor lighting',
    background: 'shelves with clothes',
    props: 'clothes racks, mirror, shoes',
    composition: 'fashion, organizing',
    visual_style: 'organized, stylish'
  },
  balcony_garden: {
    id: 'balcony_garden',
    label: '阳台花园',
    description: 'Balcony with plants',
    systemPromptBlock: `balcony garden scene`,
    userPromptBlock: `**Scene: BALCONY**
Balcony with potted plants and outdoor chair.
Outdoor natural light, fresh air feel.
Railing, plants, outdoor chair.`,
    en: 'balcony garden scene',
    lighting: 'outdoor natural light',
    background: 'balcony view',
    props: 'railing, plants, outdoor chair',
    composition: 'outdoor, relaxing',
    visual_style: 'fresh, green'
  },
  entrance_hall: {
    id: 'entrance_hall',
    label: '玄关',
    description: 'Home entrance hall',
    systemPromptBlock: `home entrance hall interior`,
    userPromptBlock: `**Scene: ENTRANCE**
Home entrance with shoe cabinet and mirror.
Welcoming indoor lighting.
Door, shoe cabinet, rug, mirror.`,
    en: 'home entrance hall interior',
    lighting: 'welcoming indoor lighting',
    background: 'entrance hallway',
    props: 'door, shoe cabinet, rug',
    composition: 'welcoming, homecoming',
    visual_style: 'warm, homey'
  },
  laundry_room: {
    id: 'laundry_room',
    label: '洗衣房',
    description: 'Aesthetic laundry room',
    systemPromptBlock: `aesthetic laundry room interior`,
    userPromptBlock: `**Scene: LAUNDRY ROOM**
Clean laundry room with washing machine.
Bright, clean white lighting.
Washing machine, laundry basket, tiles.`,
    en: 'aesthetic laundry room interior',
    lighting: 'bright, clean white lighting',
    background: 'tiled laundry room',
    props: 'washing machine, laundry basket',
    composition: 'clean, chore',
    visual_style: 'clean, white, fresh'
  },
  home_office: {
    id: 'home_office',
    label: '家庭办公',
    description: 'Cozy home office',
    systemPromptBlock: `cozy home office interior`,
    userPromptBlock: `**Scene: HOME OFFICE**
Desk at home with laptop and coffee.
Warm desk lamp or window light.
Desk, laptop, books, plant.`,
    en: 'cozy home office interior',
    lighting: 'warm desk lamp or window light',
    background: 'home workspace',
    props: 'desk, laptop, books, plant',
    composition: 'productive, cozy',
    visual_style: 'warm, intellectual'
  },

  // ==================== 交通出行 ====================
  car_interior: {
    id: 'car_interior',
    label: '车内',
    description: 'Inside luxury car',
    systemPromptBlock: `luxury car interior`,
    userPromptBlock: `**Scene: CAR INTERIOR**
Sitting in driver or passenger seat of luxury car.
Soft daylight entering through windows.
Leather seats, steering wheel, window view.`,
    en: 'luxury car interior',
    lighting: 'soft daylight entering through windows',
    background: 'car leather seats',
    props: 'steering wheel, window view',
    composition: 'lifestyle, travel',
    visual_style: 'luxury, sleek'
  },
  subway_station: {
    id: 'subway_station',
    label: '地铁站',
    description: 'Subway station platform',
    systemPromptBlock: `subway station platform scene`,
    userPromptBlock: `**Scene: SUBWAY**
Tiled subway station platform.
Artificial fluorescent lighting.
Tiles, signs, tracks.`,
    en: 'subway station platform scene',
    lighting: 'artificial fluorescent lighting',
    background: 'tiled station walls',
    props: 'signs, tracks',
    composition: 'urban, transit',
    visual_style: 'urban, cool'
  },
  airport_terminal: {
    id: 'airport_terminal',
    label: '机场航站楼',
    description: 'Airport terminal',
    systemPromptBlock: `airport terminal scene`,
    userPromptBlock: `**Scene: AIRPORT**
Modern airport terminal with large windows.
Bright natural daylight.
Luggage, large windows, seats.`,
    en: 'airport terminal scene',
    lighting: 'bright natural daylight',
    background: 'airport architecture',
    props: 'luggage, seats',
    composition: 'travel, spacious',
    visual_style: 'clean, modern, airy'
  },
  airplane_cabin: {
    id: 'airplane_cabin',
    label: '飞机机舱',
    description: 'Airplane first class cabin',
    systemPromptBlock: `airplane first class cabin interior`,
    userPromptBlock: `**Scene: AIRPLANE CABIN**
Sitting in airplane seat near window.
Window light, cabin lighting.
Airplane window, clouds, seat.`,
    en: 'airplane first class cabin interior',
    lighting: 'window light, cabin lighting',
    background: 'airplane cabin wall',
    props: 'airplane window, clouds',
    composition: 'travel, luxury',
    visual_style: 'cozy, travel'
  },

  // ==================== 专业场所 ====================
  classroom: {
    id: 'classroom',
    label: '教室',
    description: 'School classroom',
    systemPromptBlock: `school classroom interior`,
    userPromptBlock: `**Scene: CLASSROOM**
Classroom with desks and blackboard.
Bright classroom lighting.
Desks, chairs, blackboard, books.`,
    en: 'school classroom interior',
    lighting: 'bright classroom lighting',
    background: 'classroom walls, blackboard',
    props: 'desks, chairs, books',
    composition: 'academic, youthful',
    visual_style: 'bright, educational'
  },
  art_studio: {
    id: 'art_studio',
    label: '画室',
    description: 'Art studio with easel',
    systemPromptBlock: `art studio interior`,
    userPromptBlock: `**Scene: ART STUDIO**
Creative studio with easel and paints.
Natural north light (soft indirect).
Easel, canvas, paints, brushes.`,
    en: 'art studio interior',
    lighting: 'natural north light',
    background: 'studio space',
    props: 'easel, canvas, paints',
    composition: 'artistic, creative',
    visual_style: 'messy but aesthetic'
  },
  science_lab: {
    id: 'science_lab',
    label: '实验室',
    description: 'Science laboratory',
    systemPromptBlock: `science laboratory interior`,
    userPromptBlock: `**Scene: LAB**
Clean white laboratory with equipment.
Bright, sterile lighting.
Microscope, glassware, white counter.`,
    en: 'science laboratory interior',
    lighting: 'bright, sterile lighting',
    background: 'white lab walls',
    props: 'microscope, glassware',
    composition: 'scientific, clean',
    visual_style: 'white, clean, professional'
  },

  // ==================== 休闲娱乐 ====================
  swimming_pool: {
    id: 'swimming_pool',
    label: '游泳池',
    description: 'Blue swimming pool',
    systemPromptBlock: `swimming pool scene`,
    userPromptBlock: `**Scene: POOL**
Sparkling blue swimming pool water.
Bright sunlight, water reflections.
Blue water, pool tiles, lounge chair.`,
    en: 'swimming pool scene',
    lighting: 'bright sunlight, water reflections',
    background: 'blue pool water',
    props: 'pool tiles, lounge chair',
    composition: 'summer, cool',
    visual_style: 'blue, refreshing'
  },
  cinema: {
    id: 'cinema',
    label: '电影院',
    description: 'Movie theater',
    systemPromptBlock: `movie theater interior`,
    userPromptBlock: `**Scene: CINEMA**
Dark movie theater with red seats.
Dim lighting, screen glow.
Red seats, popcorn, screen.`,
    en: 'movie theater interior',
    lighting: 'dim lighting, screen glow',
    background: 'dark theater walls',
    props: 'red seats, popcorn',
    composition: 'entertainment, dark',
    visual_style: 'dark, cinematic'
  },
  concert_stage: {
    id: 'concert_stage',
    label: '演唱会',
    description: 'Concert stage with lights',
    systemPromptBlock: `concert stage scene`,
    userPromptBlock: `**Scene: CONCERT**
Live concert stage with colorful beams.
Dramatic stage lighting, spotlights.
Stage, lights, crowd silhouette.`,
    en: 'concert stage scene',
    lighting: 'dramatic stage lighting, spotlights',
    background: 'stage backdrop',
    props: 'lights, speakers',
    composition: 'energetic, dramatic',
    visual_style: 'colorful, high contrast'
  },

  // ==================== 室内场景 ====================
  cafe: {
    id: 'cafe',
    label: '咖啡厅',
    description: 'Cozy coffee shop',
    systemPromptBlock: `cozy coffee shop interior`,
    userPromptBlock: `**Scene: CAFE**
Warm coffee shop with wooden furniture and soft lighting.
Warm ambient lighting, natural window light, cozy atmosphere.
Coffee cups, books, plants, vintage decor.`,
    en: 'cozy coffee shop interior',
    lighting: 'warm ambient lighting, natural window light, cozy atmosphere',
    background: 'wooden furniture, exposed brick, plants, coffee bar',
    props: 'coffee cups, books, plants, vintage decor',
    composition: 'lifestyle candid shot',
    visual_style: 'warm, inviting, instagram-worthy'
  },
  library: {
    id: 'library',
    label: '图书馆',
    description: 'Quiet library with books',
    systemPromptBlock: `library interior with books`,
    userPromptBlock: `**Scene: LIBRARY**
Rows of bookshelves, quiet atmosphere.
Soft indoor lighting, studious vibe.
Books, reading lamps, wooden tables.`,
    en: 'library interior with books',
    lighting: 'soft indoor lighting, quiet atmosphere',
    background: 'rows of bookshelves, wooden tables',
    props: 'books, reading lamps',
    composition: 'academic, quiet',
    visual_style: 'intellectual, calm'
  },
  supermarket: {
    id: 'supermarket',
    label: '超市',
    description: 'Supermarket aisle',
    systemPromptBlock: `supermarket aisle scene`,
    userPromptBlock: `**Scene: SUPERMARKET**
Brightly lit supermarket aisle with colorful products.
Fluorescent lighting, clean and bright.
Shelves stocked with goods, shopping cart.`,
    en: 'supermarket aisle scene',
    lighting: 'fluorescent lighting, clean and bright',
    background: 'shelves stocked with goods',
    props: 'shopping cart, colorful products',
    composition: 'daily life snapshot',
    visual_style: 'bright, colorful, pop'
  },
  hotel_lobby: {
    id: 'hotel_lobby',
    label: '酒店大堂',
    description: 'Luxury hotel lobby',
    systemPromptBlock: `luxury hotel lobby scene`,
    userPromptBlock: `**Scene: HOTEL LOBBY**
Elegant hotel lobby with marble floors and chandeliers.
Warm, luxurious lighting.
Sofas, reception desk, plants.`,
    en: 'luxury hotel lobby scene',
    lighting: 'warm, luxurious lighting',
    background: 'marble floors, chandeliers, high ceilings',
    props: 'sofas, reception desk, plants',
    composition: 'high-end, spacious',
    visual_style: 'luxurious, elegant'
  },
  gym: {
    id: 'gym',
    label: '健身房',
    description: 'Gym fitness center',
    systemPromptBlock: `gym fitness center scene`,
    userPromptBlock: `**Scene: GYM**
Modern gym with fitness equipment and mirrors.
Bright, energetic lighting.
Dumbbells, treadmills, yoga mats.`,
    en: 'gym fitness center scene',
    lighting: 'bright, energetic lighting',
    background: 'fitness equipment, mirrors',
    props: 'dumbbells, treadmills, yoga mats',
    composition: 'active, sporty',
    visual_style: 'energetic, healthy'
  },
  bedroom: {
    id: 'bedroom',
    label: '卧室',
    description: 'Cozy bedroom',
    systemPromptBlock: `cozy bedroom interior`,
    userPromptBlock: `**Scene: BEDROOM**
Comfortable bed with soft linens, morning light.
Soft, intimate lighting.
Pillows, blankets, bedside table.`,
    en: 'cozy bedroom interior',
    lighting: 'soft, intimate lighting, morning light',
    background: 'comfortable bed, soft linens',
    props: 'pillows, blankets, bedside table',
    composition: 'intimate, relaxed',
    visual_style: 'soft, cozy, homey'
  },
  kitchen: {
    id: 'kitchen',
    label: '厨房',
    description: 'Modern kitchen',
    systemPromptBlock: `modern kitchen interior`,
    userPromptBlock: `**Scene: KITCHEN**
Clean modern kitchen with counter and appliances.
Bright, clean lighting.
Fruits, kitchenware, plants.`,
    en: 'modern kitchen interior',
    lighting: 'bright, clean lighting',
    background: 'kitchen counter, cabinets, appliances',
    props: 'fruits, kitchenware, plants',
    composition: 'lifestyle, home',
    visual_style: 'clean, modern, fresh'
  },

  // ==================== 户外场景 ====================
  rooftop: {
    id: 'rooftop',
    label: '天台',
    description: 'City rooftop view',
    systemPromptBlock: `city rooftop scene`,
    userPromptBlock: `**Scene: ROOFTOP**
Rooftop with city skyline view.
Open sky light, urban atmosphere.
Railing, city buildings in distance.`,
    en: 'city rooftop scene',
    lighting: 'open sky light, urban atmosphere',
    background: 'city skyline view',
    props: 'railing, city buildings in distance',
    composition: 'wide, open, urban',
    visual_style: 'airy, urban, freedom'
  },
  bridge: {
    id: 'bridge',
    label: '桥梁',
    description: 'On a bridge',
    systemPromptBlock: `standing on bridge scene`,
    userPromptBlock: `**Scene: BRIDGE**
Architectural bridge structure, river or road below.
Daylight or city lights.
Railing, cables, view.`,
    en: 'standing on bridge scene',
    lighting: 'daylight or city lights',
    background: 'architectural bridge structure, river or road below',
    props: 'railing, cables',
    composition: 'leading lines, architectural',
    visual_style: 'structured, scenic'
  },
  bus_stop: {
    id: 'bus_stop',
    label: '公交站',
    description: 'Bus stop',
    systemPromptBlock: `bus stop scene`,
    userPromptBlock: `**Scene: BUS STOP**
Urban bus stop with bench and sign.
Street lighting or daylight.
Bench, bus sign, street background.`,
    en: 'bus stop scene',
    lighting: 'street lighting or daylight',
    background: 'street background, shelter',
    props: 'bench, bus sign',
    composition: 'street, waiting',
    visual_style: 'urban, daily life'
  },
  tunnel: {
    id: 'tunnel',
    label: '隧道',
    description: 'Illuminated tunnel',
    systemPromptBlock: `illuminated tunnel scene`,
    userPromptBlock: `**Scene: TUNNEL**
Tunnel with leading lines and lights.
Artificial tunnel lighting, cool tones.
Concrete walls, lights.`,
    en: 'illuminated tunnel scene',
    lighting: 'artificial tunnel lighting, cool tones',
    background: 'tunnel walls, leading lines',
    props: 'lights, concrete texture',
    composition: 'depth, leading lines',
    visual_style: 'cool, cinematic, urban'
  },
  parking_lot: {
    id: 'parking_lot',
    label: '停车场',
    description: 'Empty parking lot',
    systemPromptBlock: `empty parking lot scene`,
    userPromptBlock: `**Scene: PARKING LOT**
Wide asphalt parking lot with painted lines.
Open light or streetlamps.
Painted lines, asphalt texture.`,
    en: 'empty parking lot scene',
    lighting: 'open light or streetlamps',
    background: 'asphalt parking lot',
    props: 'painted lines, asphalt texture',
    composition: 'minimal, urban, grunge',
    visual_style: 'urban, raw'
  },

  // ==================== 自然场景 ====================
  forest_path: {
    id: 'forest_path',
    label: '森林小径',
    description: 'Path in forest',
    systemPromptBlock: `forest path scene`,
    userPromptBlock: `**Scene: FOREST PATH**
Path winding through tall trees.
Dappled sunlight filtering through leaves.
Trees, ferns, fallen leaves.`,
    en: 'forest path scene',
    lighting: 'dappled sunlight filtering through leaves',
    background: 'path winding through tall trees',
    props: 'trees, ferns, fallen leaves',
    composition: 'nature, depth',
    visual_style: 'green, fresh, mysterious'
  },
  flower_field: {
    id: 'flower_field',
    label: '花海',
    description: 'Field of flowers',
    systemPromptBlock: `flower field scene`,
    userPromptBlock: `**Scene: FLOWER FIELD**
Vast field of blooming flowers.
Bright sunny lighting.
Flowers, grass, sky.`,
    en: 'flower field scene',
    lighting: 'bright sunny lighting',
    background: 'vast field of blooming flowers',
    props: 'flowers, grass',
    composition: 'romantic, nature',
    visual_style: 'colorful, dreamy, bright'
  },
  snow_field: {
    id: 'snow_field',
    label: '雪地',
    description: 'Snowy landscape',
    systemPromptBlock: `snowy landscape scene`,
    userPromptBlock: `**Scene: SNOW FIELD**
White snow-covered ground, winter trees.
Cool, bright winter light.
Snow, ice, winter trees.`,
    en: 'snowy landscape scene',
    lighting: 'cool, bright winter light',
    background: 'white snow-covered ground',
    props: 'snow, ice, winter trees',
    composition: 'clean, winter, cold',
    visual_style: 'white, pure, cold'
  },
  desert: {
    id: 'desert',
    label: '沙漠',
    description: 'Desert dunes',
    systemPromptBlock: `desert dunes scene`,
    userPromptBlock: `**Scene: DESERT**
Sand dunes under blue sky.
Harsh, bright sunlight.
Sand, dunes, ripples.`,
    en: 'desert dunes scene',
    lighting: 'harsh, bright sunlight',
    background: 'sand dunes under blue sky',
    props: 'sand, dunes, ripples',
    composition: 'vast, hot, minimal',
    visual_style: 'warm, dry, adventurous'
  },
  waterfall: {
    id: 'waterfall',
    label: '瀑布',
    description: 'Waterfall background',
    systemPromptBlock: `waterfall nature scene`,
    userPromptBlock: `**Scene: WATERFALL**
Cascading waterfall with rocks and water.
Fresh, natural lighting.
Water, rocks, mist.`,
    en: 'waterfall nature scene',
    lighting: 'fresh, natural lighting',
    background: 'cascading waterfall',
    props: 'rocks, water, mist',
    composition: 'dynamic, nature',
    visual_style: 'refreshing, powerful'
  },
  lake_pier: {
    id: 'lake_pier',
    label: '湖边码头',
    description: 'Wooden pier on lake',
    systemPromptBlock: `wooden pier on lake scene`,
    userPromptBlock: `**Scene: LAKE PIER**
Wooden pier extending into calm lake.
Soft morning or evening light.
Water, wood texture, horizon.`,
    en: 'wooden pier on lake scene',
    lighting: 'soft morning or evening light',
    background: 'calm lake, horizon',
    props: 'wooden pier, water',
    composition: 'peaceful, perspective',
    visual_style: 'calm, serene'
  },

  // ==================== 商业场景 ====================
  mall: {
    id: 'mall',
    label: '商场',
    description: 'Shopping mall',
    systemPromptBlock: `shopping mall interior`,
    userPromptBlock: `**Scene: MALL**
Modern shopping mall with glass railings.
Bright artificial lighting.
Storefronts, escalators, glass.`,
    en: 'shopping mall interior',
    lighting: 'bright artificial lighting',
    background: 'modern shopping mall architecture',
    props: 'storefronts, escalators, glass',
    composition: 'commercial, modern',
    visual_style: 'clean, bright, commercial'
  },
  office_modern: {
    id: 'office_modern',
    label: '办公室',
    description: 'Modern office',
    systemPromptBlock: `modern office interior`,
    userPromptBlock: `**Scene: OFFICE**
Professional office space with desks and glass walls.
Office lighting, professional atmosphere.
Desks, computers, chairs.`,
    en: 'modern office interior',
    lighting: 'office lighting, professional atmosphere',
    background: 'professional office space',
    props: 'desks, computers, chairs',
    composition: 'professional, business',
    visual_style: 'clean, corporate'
  },
  boutique: {
    id: 'boutique',
    label: '精品店',
    description: 'Clothing boutique',
    systemPromptBlock: `clothing boutique interior`,
    userPromptBlock: `**Scene: BOUTIQUE**
Stylish clothing store with racks and mirrors.
Warm, focused retail lighting.
Clothes racks, mirrors, decor.`,
    en: 'clothing boutique interior',
    lighting: 'warm, focused retail lighting',
    background: 'stylish clothing store',
    props: 'clothes racks, mirrors, decor',
    composition: 'fashion, retail',
    visual_style: 'stylish, curated'
  },
  meeting_room: {
    id: 'meeting_room',
    label: '会议室',
    description: 'Conference room',
    systemPromptBlock: `conference room scene`,
    userPromptBlock: `**Scene: MEETING ROOM**
Meeting table with chairs, presentation screen.
Professional lighting.
Table, chairs, screen.`,
    en: 'conference room scene',
    lighting: 'professional lighting',
    background: 'meeting table, whiteboard',
    props: 'chairs, presentation screen',
    composition: 'business, formal',
    visual_style: 'corporate, serious'
  },

  // ==================== 特色场景 ====================
  amusement_park: {
    id: 'amusement_park',
    label: '游乐园',
    description: 'Amusement park rides',
    systemPromptBlock: `amusement park scene`,
    userPromptBlock: `**Scene: AMUSEMENT PARK**
Ferris wheel, carousel, colorful lights.
Bright, colorful, festive lighting.
Rides, balloons, crowds.`,
    en: 'amusement park scene',
    lighting: 'bright, colorful, festive lighting',
    background: 'ferris wheel, carousel',
    props: 'rides, balloons',
    composition: 'fun, busy, colorful',
    visual_style: 'playful, vibrant'
  },
  aquarium: {
    id: 'aquarium',
    label: '水族馆',
    description: 'Aquarium tunnel',
    systemPromptBlock: `aquarium tunnel scene`,
    userPromptBlock: `**Scene: AQUARIUM**
Underwater tunnel with fish swimming above.
Blue underwater lighting.
Glass, fish, water.`,
    en: 'aquarium tunnel scene',
    lighting: 'blue underwater lighting',
    background: 'underwater tunnel',
    props: 'glass, fish, water',
    composition: 'magical, underwater',
    visual_style: 'blue, dreamy'
  },
  museum: {
    id: 'museum',
    label: '博物馆',
    description: 'Museum exhibit',
    systemPromptBlock: `museum exhibit scene`,
    userPromptBlock: `**Scene: MUSEUM**
Museum hall with exhibits and glass cases.
Quiet, focused lighting.
Exhibits, glass cases, info signs.`,
    en: 'museum exhibit scene',
    lighting: 'quiet, focused lighting',
    background: 'museum hall',
    props: 'exhibits, glass cases',
    composition: 'culture, history',
    visual_style: 'quiet, respectful'
  },
  zoo: {
    id: 'zoo',
    label: '动物园',
    description: 'Zoo setting',
    systemPromptBlock: `zoo setting scene`,
    userPromptBlock: `**Scene: ZOO**
Naturalistic zoo enclosure or path.
Outdoor natural light.
Fences, plants, animals in background.`,
    en: 'zoo setting scene',
    lighting: 'outdoor natural light',
    background: 'naturalistic enclosure',
    props: 'fences, plants',
    composition: 'nature, fun',
    visual_style: 'natural, bright'
  },

  // ==================== 氛围场景 ====================
  neon_night: {
    id: 'neon_night',
    label: '霓虹夜景',
    description: 'Neon city night',
    systemPromptBlock: `neon city night scene`,
    userPromptBlock: `**Scene: NEON NIGHT**
City street at night with neon signs.
Colorful neon lighting, dark shadows.
Neon signs, wet pavement, city lights.`,
    en: 'neon city night scene',
    lighting: 'colorful neon lighting, dark shadows',
    background: 'city street at night',
    props: 'neon signs, wet pavement',
    composition: 'cyberpunk, moody',
    visual_style: 'high contrast, colorful'
  },
  rainy_window: {
    id: 'rainy_window',
    label: '雨窗',
    description: 'Rainy window view',
    systemPromptBlock: `rainy window view scene`,
    userPromptBlock: `**Scene: RAINY WINDOW**
Looking out a window with raindrops.
Soft, moody, overcast light.
Glass, raindrops, blurred outside view.`,
    en: 'rainy window view scene',
    lighting: 'soft, moody, overcast light',
    background: 'blurred outside view',
    props: 'glass, raindrops',
    composition: 'moody, emotional',
    visual_style: 'soft, melancholic'
  },
  sunset_silhouette: {
    id: 'sunset_silhouette',
    label: '日落剪影',
    description: 'Sunset silhouette',
    systemPromptBlock: `sunset silhouette scene`,
    userPromptBlock: `**Scene: SUNSET SILHOUETTE**
Against a colorful sunset sky.
Backlit, silhouette lighting.
Sunset sky, horizon.`,
    en: 'sunset silhouette scene',
    lighting: 'backlit, silhouette lighting',
    background: 'colorful sunset sky',
    props: 'horizon',
    composition: 'dramatic, silhouette',
    visual_style: 'warm, dramatic'
  },
  foggy_morning: {
    id: 'foggy_morning',
    label: '雾气朦胧',
    description: 'Foggy morning',
    systemPromptBlock: `foggy morning scene`,
    userPromptBlock: `**Scene: FOGGY MORNING**
Mist-covered landscape or street.
Soft, diffused, white light.
Fog, trees or buildings in mist.`,
    en: 'foggy morning scene',
    lighting: 'soft, diffused, white light',
    background: 'mist-covered landscape',
    props: 'fog',
    composition: 'mysterious, soft',
    visual_style: 'low contrast, dreamy'
  },
  starry_night: {
    id: 'starry_night',
    label: '星空',
    description: 'Starry night sky',
    systemPromptBlock: `starry night sky scene`,
    userPromptBlock: `**Scene: STARRY NIGHT**
Night sky filled with stars, maybe Milky Way.
Dark, starlight.
Stars, silhouette of terrain.`,
    en: 'starry night sky scene',
    lighting: 'dark, starlight',
    background: 'night sky filled with stars',
    props: 'stars',
    composition: 'vast, magical',
    visual_style: 'dark, sparkling'
  },

  // ==================== 节日场景 ====================
  christmas: {
    id: 'christmas',
    label: '圣诞节',
    description: 'Christmas decorations',
    systemPromptBlock: `christmas decoration scene`,
    userPromptBlock: `**Scene: CHRISTMAS**
Christmas tree, lights, gifts.
Warm, festive, twinkling lights.
Christmas tree, ornaments, gifts.`,
    en: 'christmas decoration scene',
    lighting: 'warm, festive, twinkling lights',
    background: 'christmas decor',
    props: 'christmas tree, ornaments, gifts',
    composition: 'festive, happy',
    visual_style: 'warm, red and green'
  },
  halloween: {
    id: 'halloween',
    label: '万圣节',
    description: 'Halloween theme',
    systemPromptBlock: `halloween theme scene`,
    userPromptBlock: `**Scene: HALLOWEEN**
Pumpkins, cobwebs, spooky decor.
Orange and purple spooky lighting.
Pumpkins, bats, cobwebs.`,
    en: 'halloween theme scene',
    lighting: 'orange and purple spooky lighting',
    background: 'spooky decor',
    props: 'pumpkins, bats, cobwebs',
    composition: 'spooky, fun',
    visual_style: 'dark, orange'
  },
  birthday: {
    id: 'birthday',
    label: '生日派对',
    description: 'Birthday party',
    systemPromptBlock: `birthday party scene`,
    userPromptBlock: `**Scene: BIRTHDAY**
Balloons, cake, party hats.
Bright, colorful party lighting.
Balloons, cake, confetti.`,
    en: 'birthday party scene',
    lighting: 'bright, colorful party lighting',
    background: 'party decor',
    props: 'balloons, cake, confetti',
    composition: 'celebratory, fun',
    visual_style: 'colorful, happy'
  },
  new_year: {
    id: 'new_year',
    label: '新年',
    description: 'New Year celebration',
    systemPromptBlock: `new year celebration scene`,
    userPromptBlock: `**Scene: NEW YEAR**
    Fireworks, champagne, glitter.
    Sparkling, festive lighting.
    Fireworks, glasses, glitter.`,
    en: 'new year celebration scene',
    lighting: 'sparkling, festive lighting',
    background: 'fireworks or party backdrop',
    props: 'fireworks, glasses, glitter',
    composition: 'grand, celebratory',
    visual_style: 'gold, sparkling'
  },

  // ==================== 儿童家居场景 ====================
  kids_bedroom: {
    id: 'kids_bedroom',
    label: '儿童卧室',
    description: 'Colorful kids bedroom',
    systemPromptBlock: `colorful kids bedroom interior`,
    userPromptBlock: `**Scene: KIDS BEDROOM**
    Bright and colorful kids bedroom with bunk beds.
    Soft, warm daylight.
    Toys, bunk beds, colorful rug.`,
    en: 'colorful kids bedroom interior',
    lighting: 'soft, warm daylight',
    background: 'bunk beds, colorful walls',
    props: 'toys, colorful rug',
    composition: 'playful, cozy',
    visual_style: 'colorful, bright'
  },
  play_tent: {
    id: 'play_tent',
    label: '游戏帐篷',
    description: 'Teepee play tent',
    systemPromptBlock: `teepee play tent scene`,
    userPromptBlock: `**Scene: PLAY TENT**
    Cozy teepee tent with fairy lights and cushions.
    Warm, magical lighting.
    Teepee, fairy lights, cushions, stuffed animals.`,
    en: 'teepee play tent scene',
    lighting: 'warm, magical lighting',
    background: 'cozy corner',
    props: 'teepee, fairy lights, cushions',
    composition: 'magical, intimate',
    visual_style: 'warm, cozy, dreamy'
  },
  toy_room: {
    id: 'toy_room',
    label: '玩具房',
    description: 'Room filled with toys',
    systemPromptBlock: `toy room interior`,
    userPromptBlock: `**Scene: TOY ROOM**
    Room organized with shelves full of toys.
    Bright, even lighting.
    Shelves, lego, dolls, cars.`,
    en: 'toy room interior',
    lighting: 'bright, even lighting',
    background: 'shelves full of toys',
    props: 'lego, dolls, cars',
    composition: 'busy, fun',
    visual_style: 'colorful, organized'
  },
  messy_corner: {
    id: 'messy_corner',
    label: '玩具角',
    description: 'Messy but cute toy corner',
    systemPromptBlock: `messy toy corner scene`,
    userPromptBlock: `**Scene: MESSY CORNER**
    Corner of room with scattered toys on rug.
    Natural window light.
    Scattered blocks, plushies, rug.`,
    en: 'messy toy corner scene',
    lighting: 'natural window light',
    background: 'room corner',
    props: 'scattered blocks, plushies',
    composition: 'candid, authentic',
    visual_style: 'natural, lifestyle'
  },
  story_time: {
    id: 'story_time',
    label: '故事角',
    description: 'Reading corner',
    systemPromptBlock: `reading corner scene`,
    userPromptBlock: `**Scene: STORY TIME**
    Cozy reading nook with bean bag and bookshelves.
    Soft reading light.
    Bean bag, books, blanket.`,
    en: 'reading corner scene',
    lighting: 'soft reading light',
    background: 'bookshelves, reading nook',
    props: 'bean bag, books',
    composition: 'quiet, cozy',
    visual_style: 'warm, soft'
  },

  // ==================== 专业家居场景 ====================
  luxury_penthouse: {
    id: 'luxury_penthouse',
    label: '顶层公寓',
    description: 'Luxury penthouse interior',
    systemPromptBlock: `luxury penthouse interior scene`,
    userPromptBlock: `**Scene: LUXURY PENTHOUSE**
    Spacious living room with floor-to-ceiling windows and city view.
    High-end modern furniture, open layout.
    City skyline view, designer sofa, glass table.`,
    en: 'luxury penthouse interior scene',
    lighting: 'natural daylight, bright and airy',
    background: 'floor-to-ceiling windows, city view',
    props: 'designer sofa, glass table',
    composition: 'wide angle, architectural',
    visual_style: 'luxury, expensive, modern'
  },
  scandinavian_living: {
    id: 'scandinavian_living',
    label: '北欧客厅',
    description: 'Scandinavian living room',
    systemPromptBlock: `scandinavian living room interior`,
    userPromptBlock: `**Scene: SCANDINAVIAN LIVING**
    Bright, minimalist living room with wood accents.
    White walls, light wood floor, functional design.
    Fabric sofa, wooden coffee table, plants.`,
    en: 'scandinavian living room interior',
    lighting: 'soft natural northern light',
    background: 'white walls, light wood floor',
    props: 'fabric sofa, wooden coffee table',
    composition: 'clean, balanced',
    visual_style: 'minimalist, cozy, bright'
  },
  italian_kitchen: {
    id: 'italian_kitchen',
    label: '意式厨房',
    description: 'Modern Italian kitchen',
    systemPromptBlock: `modern italian kitchen interior`,
    userPromptBlock: `**Scene: ITALIAN KITCHEN**
    Sleek modern kitchen with marble island and dark cabinetry.
    Professional built-in appliances, clean lines.
    Marble island, bar stools, pendant lights.`,
    en: 'modern italian kitchen interior',
    lighting: 'architectural lighting, under-cabinet light',
    background: 'marble island, dark cabinets',
    props: 'bar stools, pendant lights',
    composition: 'linear, symmetrical',
    visual_style: 'sleek, sophisticated, premium'
  },
  mid_century_corner: {
    id: 'mid_century_corner',
    label: '中古角落',
    description: 'Mid-century modern corner',
    systemPromptBlock: `mid-century modern interior corner`,
    userPromptBlock: `**Scene: MID-CENTURY CORNER**
    Styled corner with iconic mid-century chair and teak furniture.
    Vintage floor lamp, abstract art.
    Lounge chair, side table, floor lamp.`,
    en: 'mid-century modern interior corner',
    lighting: 'warm, vintage mood',
    background: 'teak wood paneling or plain wall',
    props: 'lounge chair, floor lamp',
    composition: 'curated, artistic',
    visual_style: 'retro-modern, warm, stylish'
  },
  zen_bathroom: {
    id: 'zen_bathroom',
    label: '禅意浴室',
    description: 'Spa-like zen bathroom',
    systemPromptBlock: `zen spa bathroom interior`,
    userPromptBlock: `**Scene: ZEN BATHROOM**
    Minimalist bathroom with stone texture and bamboo elements.
    Freestanding tub, natural materials.
    Stone tub, bamboo, pebbles.`,
    en: 'zen spa bathroom interior',
    lighting: 'soft, diffused, relaxing',
    background: 'stone wall, natural texture',
    props: 'stone tub, bamboo',
    composition: 'peaceful, balanced',
    visual_style: 'natural, calm, spa-like'
  }
}

export const SCENE_PRESETS = {
  ...createPresetCategory<SceneId>('scene', '场景', SCENE_PRESET_DEFINITIONS as Record<SceneId, PresetDefinition>),

  /**
   * 获取完整的场景预设（包含所有扩展字段）
   */
  getFullPreset(id: SceneId): ScenePresetDefinition | undefined {
    return SCENE_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): ScenePresetDefinition[] {
    return Object.values(SCENE_PRESET_DEFINITIONS)
  }
}

// ==================== 人种预设 ====================

const ETHNICITY_PRESET_DEFINITIONS: Record<string, EthnicityPresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select ethnicity',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    en: '',
    detailedDescription: ''
  },
  asian: {
    id: 'asian',
    label: '亚洲人',
    description: 'Asian appearance',
    systemPromptBlock: `Asian ethnicity`,
    userPromptBlock: `**Ethnicity: ASIAN**
East Asian features with natural skin tone.`,
    en: 'Asian',
    detailedDescription: 'East Asian ethnicity with natural skin tone'
  },
  caucasian: {
    id: 'caucasian',
    label: '白人',
    description: 'Caucasian/White appearance',
    systemPromptBlock: `Caucasian ethnicity`,
    userPromptBlock: `**Ethnicity: CAUCASIAN**
European features with fair skin.`,
    en: 'Caucasian/White',
    detailedDescription: 'Caucasian/European features with fair skin'
  },
  african_american: {
    id: 'african_american',
    label: '非裔',
    description: 'African American appearance',
    systemPromptBlock: `African American ethnicity`,
    userPromptBlock: `**Ethnicity: AFRICAN AMERICAN**
Beautiful dark skin tone, African American features.`,
    en: 'African American',
    detailedDescription: 'African American features with beautiful dark skin tone'
  },
  hispanic: {
    id: 'hispanic',
    label: '拉丁裔',
    description: 'Hispanic/Latino appearance',
    systemPromptBlock: `Hispanic/Latino ethnicity`,
    userPromptBlock: `**Ethnicity: HISPANIC/LATINO**
Warm skin tone, Hispanic/Latino features.`,
    en: 'Hispanic/Latino',
    detailedDescription: 'Hispanic/Latino features with warm skin tone'
  },
  mixed: {
    id: 'mixed',
    label: '混血',
    description: 'Mixed ethnicity appearance',
    systemPromptBlock: `mixed ethnicity`,
    userPromptBlock: `**Ethnicity: MIXED**
Beautiful mixed ethnicity features.`,
    en: 'Mixed ethnicity',
    detailedDescription: 'beautiful mixed ethnicity features'
  },
  middle_eastern: {
    id: 'middle_eastern',
    label: '中东人',
    description: 'Middle Eastern appearance',
    systemPromptBlock: `Middle Eastern ethnicity`,
    userPromptBlock: `**Ethnicity: MIDDLE EASTERN**
Middle Eastern features with warm olive skin tone.`,
    en: 'Middle Eastern',
    detailedDescription: 'Middle Eastern features with warm olive skin tone'
  },
  south_asian: {
    id: 'south_asian',
    label: '南亚人',
    description: 'South Asian appearance',
    systemPromptBlock: `South Asian ethnicity`,
    userPromptBlock: `**Ethnicity: SOUTH ASIAN**
South Asian features with brown skin tone.`,
    en: 'South Asian',
    detailedDescription: 'South Asian features with brown skin tone'
  },
  south_east_asian: {
    id: 'south_east_asian',
    label: '东南亚人',
    description: 'Southeast Asian appearance',
    systemPromptBlock: `Southeast Asian ethnicity`,
    userPromptBlock: `**Ethnicity: SOUTHEAST ASIAN**
Southeast Asian features with warm skin tone.`,
    en: 'Southeast Asian',
    detailedDescription: 'Southeast Asian features with warm skin tone'
  }
}

export const ETHNICITY_PRESETS = {
  ...createPresetCategory<EthnicityId>(
    'ethnicity',
    '人种',
    ETHNICITY_PRESET_DEFINITIONS as Record<EthnicityId, PresetDefinition>
  ),

  /**
   * 获取完整的人种预设（包含所有扩展字段）
   */
  getFullPreset(id: EthnicityId): EthnicityPresetDefinition | undefined {
    return ETHNICITY_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): EthnicityPresetDefinition[] {
    return Object.values(ETHNICITY_PRESET_DEFINITIONS)
  }
}

// ==================== 姿态预设 ====================

const POSE_PRESET_DEFINITIONS: Record<string, PosePresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select pose',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    en: '',
    detailedDescription: ''
  },
  natural: {
    id: 'natural',
    label: '自然站立',
    description: 'Natural standing or relaxed walking',
    systemPromptBlock: `natural standing or walking pose`,
    userPromptBlock: `**Pose: NATURAL STANDING**
Standing naturally with relaxed posture, arms at sides or slightly bent.
Relaxed and authentic expression.`,
    en: 'natural standing or walking, relaxed and authentic expression',
    detailedDescription: 'standing naturally with relaxed posture, arms at sides or slightly bent'
  },
  sitting: {
    id: 'sitting',
    label: '坐姿',
    description: 'Naturally sitting or crouching',
    systemPromptBlock: `naturally sitting pose`,
    userPromptBlock: `**Pose: SITTING**
Sitting comfortably on chair or floor, relaxed position.
Comfortable and relaxed expression.`,
    en: 'naturally sitting or crouching, comfortable and relaxed',
    detailedDescription: 'sitting comfortably on chair or floor, relaxed position'
  },
  playing: {
    id: 'playing',
    label: '玩耍',
    description: 'Playful or active movement',
    systemPromptBlock: `playful or active pose`,
    userPromptBlock: `**Pose: PLAYING**
Dynamic playful pose, mid-action movement, energetic.
Full of energy and childlike joy.`,
    en: 'playful or active pose, full of energy and childlike joy',
    detailedDescription: 'dynamic playful pose, mid-action movement, energetic'
  },
  walking: {
    id: 'walking',
    label: '行走',
    description: 'Natural walking motion',
    systemPromptBlock: `natural walking motion`,
    userPromptBlock: `**Pose: WALKING**
Natural walking motion, one foot slightly forward, casual stride.`,
    en: 'natural walking motion, casual stride',
    detailedDescription: 'natural walking motion, one foot slightly forward, casual stride'
  },
  confident: {
    id: 'confident',
    label: '自信姿态',
    description: 'Confident posture, strong stance',
    systemPromptBlock: `confident pose`,
    userPromptBlock: `**Pose: CONFIDENT**
Confident posture, shoulders back, slight chin up.
Hands on hips or strong stance.`,
    en: 'confident pose, hands on hips or strong stance',
    detailedDescription: 'confident posture, shoulders back, slight chin up'
  },
  editorial: {
    id: 'editorial',
    label: '时尚大片',
    description: 'Editorial fashion pose',
    systemPromptBlock: `editorial fashion pose`,
    userPromptBlock: `**Pose: EDITORIAL**
Stylized pose, artistic angles, refined hands placement.
Magazine-worthy, dramatic.`,
    en: 'editorial fashion pose, magazine-worthy',
    detailedDescription: 'stylized pose, artistic angles, refined hands placement'
  },
  hands_on_hips: {
    id: 'hands_on_hips',
    label: '叉腰',
    description: 'Hands on hips pose',
    systemPromptBlock: `hands on hips pose`,
    userPromptBlock: `**Pose: HANDS ON HIPS**
Both hands on hips, confident body language.`,
    en: 'hands on hips, strong posture',
    detailedDescription: 'both hands on hips, confident body language'
  },
  running: {
    id: 'running',
    label: '奔跑',
    description: 'Running motion',
    systemPromptBlock: `running motion pose`,
    userPromptBlock: `**Pose: RUNNING**
Mid-run pose, one foot lifted, energetic.`,
    en: 'running motion, dynamic energy',
    detailedDescription: 'mid-run pose, one foot lifted, energetic'
  },
  jumping: {
    id: 'jumping',
    label: '跳跃',
    description: 'Jumping pose',
    systemPromptBlock: `jumping pose`,
    userPromptBlock: `**Pose: JUMPING**
Mid-jump, joyful expression and dynamic limbs.`,
    en: 'jumping pose, cheerful',
    detailedDescription: 'mid-jump, joyful expression and dynamic limbs'
  },
  // ==================== 站姿类 ====================
  leaning_wall: {
    id: 'leaning_wall',
    label: '倚靠墙壁',
    description: 'Leaning against wall casually',
    systemPromptBlock: `casually leaning against wall pose`,
    userPromptBlock: `**Pose: LEANING WALL**
Casually leaning against wall or surface, relaxed posture.
One shoulder against wall, relaxed arms, natural slouch.`,
    en: 'leaning against wall, casual and relaxed',
    detailedDescription: 'casually leaning against wall or surface, relaxed posture, one shoulder against wall'
  },
  hands_in_pockets: {
    id: 'hands_in_pockets',
    label: '双手插兜',
    description: 'Hands in pockets',
    systemPromptBlock: `hands in pockets pose`,
    userPromptBlock: `**Pose: HANDS IN POCKETS**
Standing with both hands in pockets, relaxed shoulders.
Cool and casual vibe.`,
    en: 'hands in pockets, casual',
    detailedDescription: 'standing with both hands in pockets, relaxed shoulders'
  },
  crossed_arms: {
    id: 'crossed_arms',
    label: '双手抱胸',
    description: 'Arms crossed confidently',
    systemPromptBlock: `arms crossed pose`,
    userPromptBlock: `**Pose: ARMS CROSSED**
Standing with arms crossed over chest.
Confident and professional look.`,
    en: 'arms crossed, confident',
    detailedDescription: 'standing with arms crossed over chest, confident and professional'
  },
  looking_back: {
    id: 'looking_back',
    label: '回眸',
    description: 'Looking back over shoulder',
    systemPromptBlock: `looking back over shoulder pose`,
    userPromptBlock: `**Pose: LOOKING BACK**
Standing with back turned slightly, looking back over shoulder.
Engaging and mysterious.`,
    en: 'looking back over shoulder',
    detailedDescription: 'standing with back turned slightly, looking back over shoulder'
  },
  side_profile: {
    id: 'side_profile',
    label: '侧身站立',
    description: 'Side profile standing',
    systemPromptBlock: `side profile standing pose`,
    userPromptBlock: `**Pose: SIDE PROFILE**
Standing sideways to camera, showcasing profile.
Elegant silhouette.`,
    en: 'side profile standing',
    detailedDescription: 'standing sideways to camera, showcasing profile'
  },
  one_leg_up: {
    id: 'one_leg_up',
    label: '单脚站立',
    description: 'Standing on one leg casually',
    systemPromptBlock: `standing on one leg pose`,
    userPromptBlock: `**Pose: ONE LEG UP**
Leaning against wall, one foot resting on wall behind.
Or playful balance on one leg.`,
    en: 'standing on one leg, playful',
    detailedDescription: 'leaning against wall, one foot resting on wall behind or playful balance'
  },
  tiptoe: {
    id: 'tiptoe',
    label: '踮脚尖',
    description: 'Standing on tiptoes',
    systemPromptBlock: `standing on tiptoes pose`,
    userPromptBlock: `**Pose: TIPTOE**
Standing on tiptoes, reaching up or looking forward.
Light and airy feeling.`,
    en: 'standing on tiptoes',
    detailedDescription: 'standing on tiptoes, reaching up or looking forward'
  },

  // ==================== 坐姿类 ====================
  sitting_floor: {
    id: 'sitting_floor',
    label: '地板坐',
    description: 'Sitting on floor cross-legged',
    systemPromptBlock: `sitting on floor cross-legged pose`,
    userPromptBlock: `**Pose: SITTING FLOOR**
Sitting comfortably on the floor, legs crossed or extended.
Casual and grounded.`,
    en: 'sitting on floor, casual',
    detailedDescription: 'sitting comfortably on the floor, legs crossed or extended'
  },
  kneeling: {
    id: 'kneeling',
    label: '跪坐',
    description: 'Kneeling pose',
    systemPromptBlock: `kneeling pose`,
    userPromptBlock: `**Pose: KNEELING**
Kneeling on floor or cushion, upright posture.
Gentle and polite appearance.`,
    en: 'kneeling, gentle',
    detailedDescription: 'kneeling on floor or cushion, upright posture'
  },
  sitting_stool: {
    id: 'sitting_stool',
    label: '坐高凳',
    description: 'Sitting on a high stool',
    systemPromptBlock: `sitting on high stool pose`,
    userPromptBlock: `**Pose: SITTING STOOL**
Perched on a high stool, one leg straight, one bent.
Fashionable studio pose.`,
    en: 'sitting on high stool, fashionable',
    detailedDescription: 'perched on a high stool, one leg straight, one bent'
  },
  reclining: {
    id: 'reclining',
    label: '侧卧/躺坐',
    description: 'Reclining or lying down',
    systemPromptBlock: `reclining or lying down pose`,
    userPromptBlock: `**Pose: RECLINING**
Lying on side or back, relaxed and comfortable.
Soft and dreamy vibe.`,
    en: 'reclining or lying down, relaxed',
    detailedDescription: 'lying on side or back, relaxed and comfortable'
  },
  sitting_steps: {
    id: 'sitting_steps',
    label: '台阶坐',
    description: 'Sitting on steps',
    systemPromptBlock: `sitting on steps pose`,
    userPromptBlock: `**Pose: SITTING STEPS**
Sitting on staircase or steps, knees bent.
Urban casual look.`,
    en: 'sitting on steps, urban',
    detailedDescription: 'sitting on staircase or steps, knees bent'
  },
  hugging_knees: {
    id: 'hugging_knees',
    label: '抱膝坐',
    description: 'Sitting hugging knees',
    systemPromptBlock: `sitting hugging knees pose`,
    userPromptBlock: `**Pose: HUGGING KNEES**
Sitting on floor hugging knees to chest.
Cute and compact pose.`,
    en: 'sitting hugging knees, cute',
    detailedDescription: 'sitting on floor hugging knees to chest'
  },
  // ==================== 居家舒适类 ====================
  waking_up: {
    id: 'waking_up',
    label: '起床/苏醒',
    description: 'Waking up stretching',
    systemPromptBlock: `waking up stretching pose`,
    userPromptBlock: `**Pose: WAKING UP**
Sitting up in bed, stretching arms.
Sleepy but refreshed, morning vibe.`,
    en: 'waking up stretching, morning',
    detailedDescription: 'sitting up in bed, stretching arms, sleepy but refreshed'
  },
  couch_potato: {
    id: 'couch_potato',
    label: '沙发瘫',
    description: 'Relaxing on sofa',
    systemPromptBlock: `relaxing on sofa pose`,
    userPromptBlock: `**Pose: COUCH POTATO**
Slouching comfortably on sofa, maybe watching TV.
Very relaxed and lazy.`,
    en: 'relaxing on sofa, lazy',
    detailedDescription: 'slouching comfortably on sofa, maybe watching TV, very relaxed'
  },
  holding_pillow: {
    id: 'holding_pillow',
    label: '抱枕头',
    description: 'Hugging a pillow',
    systemPromptBlock: `hugging pillow pose`,
    userPromptBlock: `**Pose: HOLDING PILLOW**
Sitting or lying while hugging a soft pillow.
Cozy and safe feeling.`,
    en: 'hugging pillow, cozy',
    detailedDescription: 'sitting or lying while hugging a soft pillow'
  },
  skin_care: {
    id: 'skin_care',
    label: '护肤/敷面膜',
    description: 'Applying skincare',
    systemPromptBlock: `applying skincare pose`,
    userPromptBlock: `**Pose: SKIN CARE**
Applying face cream or wearing a sheet mask.
Self-care moment, bathroom or bedroom.`,
    en: 'applying skincare, self-care',
    detailedDescription: 'applying face cream or wearing a sheet mask, self-care moment'
  },
  brushing_teeth: {
    id: 'brushing_teeth',
    label: '刷牙',
    description: 'Brushing teeth',
    systemPromptBlock: `brushing teeth pose`,
    userPromptBlock: `**Pose: BRUSHING TEETH**
Standing at sink, brushing teeth.
Daily routine, fresh.`,
    en: 'brushing teeth, daily routine',
    detailedDescription: 'standing at sink, brushing teeth'
  },
  cooking: {
    id: 'cooking',
    label: '做饭',
    description: 'Cooking in kitchen',
    systemPromptBlock: `cooking in kitchen pose`,
    userPromptBlock: `**Pose: COOKING**
Stirring a pot or cutting vegetables in kitchen.
Home chef, warm atmosphere.`,
    en: 'cooking in kitchen, lifestyle',
    detailedDescription: 'stirring a pot or cutting vegetables in kitchen'
  },
  stretching_bed: {
    id: 'stretching_bed',
    label: '床上伸展',
    description: 'Stretching in bed',
    systemPromptBlock: `stretching in bed pose`,
    userPromptBlock: `**Pose: STRETCHING BED**
Lying or sitting in bed, big stretch.
Relaxed morning or evening routine.`,
    en: 'stretching in bed, relaxed',
    detailedDescription: 'lying or sitting in bed, big stretch'
  },
  sitting_window: {
    id: 'sitting_window',
    label: '飘窗坐',
    description: 'Sitting on window sill',
    systemPromptBlock: `sitting on window sill pose`,
    userPromptBlock: `**Pose: SITTING WINDOW**
Sitting on bay window sill, looking out.
Contemplative and cozy.`,
    en: 'sitting on window sill, contemplative',
    detailedDescription: 'sitting on bay window sill, looking out'
  },

  // ==================== 运动健身类 ====================
  yoga_tree: {
    id: 'yoga_tree',
    label: '瑜伽树式',
    description: 'Yoga tree pose',
    systemPromptBlock: `yoga tree pose`,
    userPromptBlock: `**Pose: YOGA TREE**
Standing on one leg, hands in prayer position.
Balanced and peaceful.`,
    en: 'yoga tree pose, balanced',
    detailedDescription: 'standing on one leg, hands in prayer position'
  },
  yoga_lotus: {
    id: 'yoga_lotus',
    label: '瑜伽莲花坐',
    description: 'Yoga lotus position',
    systemPromptBlock: `yoga lotus pose`,
    userPromptBlock: `**Pose: YOGA LOTUS**
Sitting cross-legged in lotus position, hands on knees.
Meditative and calm.`,
    en: 'yoga lotus pose, meditative',
    detailedDescription: 'sitting cross-legged in lotus position, hands on knees'
  },
  plank: {
    id: 'plank',
    label: '平板支撑',
    description: 'Plank exercise',
    systemPromptBlock: `plank exercise pose`,
    userPromptBlock: `**Pose: PLANK**
Holding plank position on floor.
Strong core, fitness focus.`,
    en: 'plank exercise, strong',
    detailedDescription: 'holding plank position on floor'
  },
  jogging: {
    id: 'jogging',
    label: '慢跑',
    description: 'Light jogging',
    systemPromptBlock: `jogging pose`,
    userPromptBlock: `**Pose: JOGGING**
Light jogging motion, relaxed smile.
Healthy lifestyle vibe.`,
    en: 'jogging, healthy',
    detailedDescription: 'light jogging motion, relaxed smile'
  },

  // ==================== 职场工作类 ====================
  typing: {
    id: 'typing',
    label: '打字/办公',
    description: 'Typing on laptop',
    systemPromptBlock: `typing on laptop pose`,
    userPromptBlock: `**Pose: TYPING**
Sitting at desk, typing on laptop.
Focused professional look.`,
    en: 'typing on laptop, professional',
    detailedDescription: 'sitting at desk, typing on laptop'
  },
  presentation: {
    id: 'presentation',
    label: '演讲/展示',
    description: 'Giving presentation',
    systemPromptBlock: `giving presentation pose`,
    userPromptBlock: `**Pose: PRESENTATION**
Standing next to screen or board, pointing.
Confident speaker gesture.`,
    en: 'giving presentation, confident',
    detailedDescription: 'standing next to screen or board, pointing'
  },
  writing: {
    id: 'writing',
    label: '书写',
    description: 'Writing notes',
    systemPromptBlock: `writing notes pose`,
    userPromptBlock: `**Pose: WRITING**
Sitting or standing, writing in notebook.
Studious and attentive.`,
    en: 'writing notes, studious',
    detailedDescription: 'sitting or standing, writing in notebook'
  },
  on_call: {
    id: 'on_call',
    label: '打电话',
    description: 'Talking on phone',
    systemPromptBlock: `talking on phone pose`,
    userPromptBlock: `**Pose: ON CALL**
Holding phone to ear, talking.
Business or casual conversation.`,
    en: 'talking on phone, communication',
    detailedDescription: 'holding phone to ear, talking'
  },

  // ==================== 情绪表达类 ====================
  laughing: {
    id: 'laughing',
    label: '大笑',
    description: 'Laughing out loud',
    systemPromptBlock: `laughing out loud pose`,
    userPromptBlock: `**Pose: LAUGHING**
Head thrown back, laughing freely.
Joyful, candid moment.`,
    en: 'laughing out loud, joyful',
    detailedDescription: 'head thrown back, laughing freely'
  },
  surprised: {
    id: 'surprised',
    label: '惊讶',
    description: 'Surprised expression',
    systemPromptBlock: `surprised pose`,
    userPromptBlock: `**Pose: SURPRISED**
Hands to mouth or cheeks, wide eyes.
Shocked or happily surprised.`,
    en: 'surprised, shocked',
    detailedDescription: 'hands to mouth or cheeks, wide eyes'
  },
  thinking: {
    id: 'thinking',
    label: '思考',
    description: 'Thinking pose',
    systemPromptBlock: `thinking pose`,
    userPromptBlock: `**Pose: THINKING**
Hand on chin, looking away or up.
Pensive and thoughtful.`,
    en: 'thinking, pensive',
    detailedDescription: 'hand on chin, looking away or up'
  },
  sad: {
    id: 'sad',
    label: '忧伤',
    description: 'Sad or melancholic',
    systemPromptBlock: `sad melancholic pose`,
    userPromptBlock: `**Pose: SAD**
Looking down, shoulders slumped or hugging self.
Emotional and moody.`,
    en: 'sad, melancholic',
    detailedDescription: 'looking down, shoulders slumped or hugging self'
  },

  // ==================== 动态类 ====================
  twirling: {
    id: 'twirling',
    label: '转圈',
    description: 'Twirling dress',
    systemPromptBlock: `twirling dress pose`,
    userPromptBlock: `**Pose: TWIRLING**
Spinning around, dress or hair flowing in motion.
Dynamic and joyful.`,
    en: 'twirling dress, dynamic',
    detailedDescription: 'spinning around, dress or hair flowing in motion'
  },
  kicking: {
    id: 'kicking',
    label: '踢腿',
    description: 'Playful kick',
    systemPromptBlock: `playful kicking pose`,
    userPromptBlock: `**Pose: KICKING**
One leg kicking forward or high, dynamic action.
Energetic and fun.`,
    en: 'playful kicking, energetic',
    detailedDescription: 'one leg kicking forward or high, dynamic action'
  },
  stretching: {
    id: 'stretching',
    label: '伸懒腰',
    description: 'Stretching arms',
    systemPromptBlock: `stretching arms pose`,
    userPromptBlock: `**Pose: STRETCHING**
Arms reaching up or out, stretching body.
Relaxed and refreshing.`,
    en: 'stretching arms, relaxed',
    detailedDescription: 'arms reaching up or out, stretching body'
  },
  waving: {
    id: 'waving',
    label: '挥手',
    description: 'Waving hand',
    systemPromptBlock: `waving hand pose`,
    userPromptBlock: `**Pose: WAVING**
One hand raised waving greeting.
Friendly and welcoming.`,
    en: 'waving hand, friendly',
    detailedDescription: 'one hand raised waving greeting'
  },
  clapping: {
    id: 'clapping',
    label: '拍手',
    description: 'Clapping hands',
    systemPromptBlock: `clapping hands pose`,
    userPromptBlock: `**Pose: CLAPPING**
Hands together clapping, happy expression.
Celebratory and cheerful.`,
    en: 'clapping hands, cheerful',
    detailedDescription: 'hands together clapping, happy expression'
  },
  dancing: {
    id: 'dancing',
    label: '舞蹈',
    description: 'Dancing move',
    systemPromptBlock: `dancing pose`,
    userPromptBlock: `**Pose: DANCING**
Fluid dance movement, expressive arms.
Artistic and rhythmic.`,
    en: 'dancing pose, artistic',
    detailedDescription: 'fluid dance movement, expressive arms'
  },

  // ==================== 互动类 ====================
  reading: {
    id: 'reading',
    label: '看书',
    description: 'Reading a book',
    systemPromptBlock: `reading book pose`,
    userPromptBlock: `**Pose: READING**
Holding a book, looking down at pages.
Intellectual and quiet.`,
    en: 'reading book, quiet',
    detailedDescription: 'holding a book, looking down at pages'
  },
  holding_flower: {
    id: 'holding_flower',
    label: '拿花',
    description: 'Holding a flower',
    systemPromptBlock: `holding flower pose`,
    userPromptBlock: `**Pose: HOLDING FLOWER**
Holding flowers near face or chest.
Romantic and soft.`,
    en: 'holding flower, romantic',
    detailedDescription: 'holding flowers near face or chest'
  },
  drinking: {
    id: 'drinking',
    label: '喝饮料',
    description: 'Drinking from cup',
    systemPromptBlock: `drinking from cup pose`,
    userPromptBlock: `**Pose: DRINKING**
Holding a cup or glass, sipping.
Lifestyle casual.`,
    en: 'drinking from cup, lifestyle',
    detailedDescription: 'holding a cup or glass, sipping'
  },
  eating: {
    id: 'eating',
    label: '吃零食',
    description: 'Eating snack',
    systemPromptBlock: `eating snack pose`,
    userPromptBlock: `**Pose: EATING**
Holding a snack, cookie or ice cream.
Playful and yummy.`,
    en: 'eating snack, playful',
    detailedDescription: 'holding a snack, cookie or ice cream'
  },
  using_phone: {
    id: 'using_phone',
    label: '玩手机',
    description: 'Using smartphone',
    systemPromptBlock: `using smartphone pose`,
    userPromptBlock: `**Pose: USING PHONE**
Looking at smartphone screen, typing or scrolling.
Modern daily life.`,
    en: 'using smartphone, modern',
    detailedDescription: 'looking at smartphone screen, typing or scrolling'
  },
  holding_bag: {
    id: 'holding_bag',
    label: '拎包',
    description: 'Holding a bag',
    systemPromptBlock: `holding bag pose`,
    userPromptBlock: `**Pose: HOLDING BAG**
Holding a handbag or shopping bag comfortably.
Fashionable accessory display.`,
    en: 'holding bag, fashionable',
    detailedDescription: 'holding a handbag or shopping bag comfortably'
  },

  // ==================== 时尚类 ====================
  catwalk: {
    id: 'catwalk',
    label: '猫步',
    description: 'Catwalk strut',
    systemPromptBlock: `catwalk runway pose`,
    userPromptBlock: `**Pose: CATWALK**
Walking with one foot directly in front of other.
High fashion runway strut.`,
    en: 'catwalk strut, high fashion',
    detailedDescription: 'walking with one foot directly in front of other, high fashion runway strut'
  },
  hair_touch: {
    id: 'hair_touch',
    label: '撩发',
    description: 'Touching hair',
    systemPromptBlock: `touching hair pose`,
    userPromptBlock: `**Pose: HAIR TOUCH**
Hand gently touching or running through hair.
Feminine and alluring.`,
    en: 'touching hair, feminine',
    detailedDescription: 'hand gently touching or running through hair'
  },
  face_framing: {
    id: 'face_framing',
    label: '托腮/捧脸',
    description: 'Hands framing face',
    systemPromptBlock: `hands framing face pose`,
    userPromptBlock: `**Pose: FACE FRAMING**
Hands around face, resting chin on hands or framing cheeks.
Focus on face features.`,
    en: 'hands framing face, portrait',
    detailedDescription: 'hands around face, resting chin on hands or framing cheeks'
  },
  looking_up: {
    id: 'looking_up',
    label: '仰望',
    description: 'Looking up',
    systemPromptBlock: `looking up pose`,
    userPromptBlock: `**Pose: LOOKING UP**
Head tilted back, looking up at sky or light.
Hopeful and dreamy.`,
    en: 'looking up, hopeful',
    detailedDescription: 'head tilted back, looking up at sky or light'
  },
  jacket_drape: {
    id: 'jacket_drape',
    label: '披外套',
    description: 'Jacket over shoulder',
    systemPromptBlock: `jacket over shoulder pose`,
    userPromptBlock: `**Pose: JACKET DRAPE**
Holding jacket over one shoulder or wearing it draped.
Cool and chic.`,
    en: 'jacket over shoulder, chic',
    detailedDescription: 'holding jacket over one shoulder or wearing it draped'
  },

  // ==================== 儿童专用类 ====================
  hiding_face: {
    id: 'hiding_face',
    label: '躲猫猫',
    description: 'Hiding face playfully',
    systemPromptBlock: `hiding face playfully pose`,
    userPromptBlock: `**Pose: HIDING FACE**
Peeking through fingers or hiding behind hands.
Cute and shy.`,
    en: 'hiding face playfully, cute',
    detailedDescription: 'peeking through fingers or hiding behind hands'
  },
  finger_heart: {
    id: 'finger_heart',
    label: '比心',
    description: 'Making finger heart',
    systemPromptBlock: `making finger heart pose`,
    userPromptBlock: `**Pose: FINGER HEART**
Fingers crossed to make small heart shape.
Popular cute gesture.`,
    en: 'making finger heart, cute',
    detailedDescription: 'fingers crossed to make small heart shape'
  },
  peace_sign: {
    id: 'peace_sign',
    label: '比耶',
    description: 'Peace sign gesture',
    systemPromptBlock: `peace sign gesture pose`,
    userPromptBlock: `**Pose: PEACE SIGN**
Holding up V sign with fingers near face.
Happy and classic photo pose.`,
    en: 'peace sign gesture, happy',
    detailedDescription: 'holding up V sign with fingers near face'
  },
  crawling: {
    id: 'crawling',
    label: '爬行',
    description: 'Crawling (baby)',
    systemPromptBlock: `crawling baby pose`,
    userPromptBlock: `**Pose: CRAWLING**
On hands and knees, crawling forward.
Baby or toddler action.`,
    en: 'crawling, baby',
    detailedDescription: 'on hands and knees, crawling forward'
  },
  lying_stomach: {
    id: 'lying_stomach',
    label: '趴着',
    description: 'Lying on stomach',
    systemPromptBlock: `lying on stomach pose`,
    userPromptBlock: `**Pose: LYING STOMACH**
    Lying on stomach, head up, maybe reading or playing.
    Comfortable floor pose.`,
    en: 'lying on stomach, comfortable',
    detailedDescription: 'lying on stomach, head up, maybe reading or playing'
  },

  // ==================== 儿童家居姿态 ====================
  playing_toys: {
    id: 'playing_toys',
    label: '玩玩具',
    description: 'Playing with toys on floor',
    systemPromptBlock: `playing with toys on floor pose`,
    userPromptBlock: `**Pose: PLAYING TOYS**
    Sitting on floor surrounded by toys, engaged in play.
    Happy and focused.`,
    en: 'playing with toys on floor, happy',
    detailedDescription: 'sitting on floor surrounded by toys, engaged in play'
  },
  reading_floor: {
    id: 'reading_floor',
    label: '地板阅读',
    description: 'Reading book on floor',
    systemPromptBlock: `reading book on floor pose`,
    userPromptBlock: `**Pose: READING FLOOR**
    Lying on stomach or sitting on floor reading a picture book.
    Quiet and curious.`,
    en: 'reading book on floor, curious',
    detailedDescription: 'lying on stomach or sitting on floor reading a picture book'
  },
  hugging_plushie: {
    id: 'hugging_plushie',
    label: '抱玩偶',
    description: 'Hugging a plush toy',
    systemPromptBlock: `hugging plush toy pose`,
    userPromptBlock: `**Pose: HUGGING PLUSHIE**
    Hugging a large teddy bear or plush toy tightly.
    Cute and safe feeling.`,
    en: 'hugging plush toy, cute',
    detailedDescription: 'hugging a large teddy bear or plush toy tightly'
  },
  jumping_bed: {
    id: 'jumping_bed',
    label: '床上跳跃',
    description: 'Jumping on bed',
    systemPromptBlock: `jumping on bed pose`,
    userPromptBlock: `**Pose: JUMPING BED**
    Jumping on the bed, mid-air, messy hair.
    Energetic and naughty.`,
    en: 'jumping on bed, energetic',
    detailedDescription: 'jumping on the bed, mid-air, messy hair'
  },
  napping: {
    id: 'napping',
    label: '午睡',
    description: 'Napping or sleeping',
    systemPromptBlock: `napping sleeping pose`,
    userPromptBlock: `**Pose: NAPPING**
    Sleeping peacefully in bed or on sofa.
    Relaxed and sweet.`,
    en: 'napping sleeping, peaceful',
    detailedDescription: 'sleeping peacefully in bed or on sofa'
  },
  parent_child: {
    id: 'parent_child',
    label: '亲子互动',
    description: 'Parent and child interaction',
    systemPromptBlock: `parent and child interaction pose`,
    userPromptBlock: `**Pose: PARENT CHILD**
    Child being hugged by parent or reading together (parent partially visible or suggested).
    Warm and loving family vibe.`,
    en: 'parent and child interaction, loving',
    detailedDescription: 'child being hugged by parent or reading together'
  },

  // ==================== 家居展示类 (专业) ====================
  lounging_sofa: {
    id: 'lounging_sofa',
    label: '沙发慵懒',
    description: 'Elegant lounging on sofa',
    systemPromptBlock: `elegant lounging on sofa pose`,
    userPromptBlock: `**Pose: LOUNGING SOFA**
    Reclining elegantly on a designer sofa, one arm resting on backrest.
    Sophisticated and relaxed.`,
    en: 'elegant lounging on sofa, sophisticated',
    detailedDescription: 'reclining elegantly on a designer sofa, one arm resting on backrest'
  },
  sitting_armchair: {
    id: 'sitting_armchair',
    label: '单人椅坐姿',
    description: 'Sitting in armchair',
    systemPromptBlock: `sitting in armchair pose`,
    userPromptBlock: `**Pose: SITTING ARMCHAIR**
    Sitting in a high-end armchair, legs crossed elegantly.
    Reading a magazine or looking out window.`,
    en: 'sitting in armchair, elegant',
    detailedDescription: 'sitting in a high-end armchair, legs crossed elegantly'
  },
  leaning_counter: {
    id: 'leaning_counter',
    label: '倚靠吧台',
    description: 'Leaning against kitchen island',
    systemPromptBlock: `leaning against kitchen island pose`,
    userPromptBlock: `**Pose: LEANING COUNTER**
    Standing and leaning back against a kitchen island or high table.
    Holding a coffee cup or glass.`,
    en: 'leaning against kitchen island, lifestyle',
    detailedDescription: 'standing and leaning back against a kitchen island or high table'
  },
  standing_window: {
    id: 'standing_window',
    label: '窗边伫立',
    description: 'Standing by large window',
    systemPromptBlock: `standing by large window pose`,
    userPromptBlock: `**Pose: STANDING WINDOW**
    Standing next to floor-to-ceiling window, bathed in natural light.
    Looking out or turning back to camera.`,
    en: 'standing by large window, atmospheric',
    detailedDescription: 'standing next to floor-to-ceiling window, bathed in natural light'
  },
  touching_fabric: {
    id: 'touching_fabric',
    label: '触碰材质',
    description: 'Touching furniture fabric',
    systemPromptBlock: `touching furniture fabric pose`,
    userPromptBlock: `**Pose: TOUCHING FABRIC**
    Close interaction with furniture, hand gently touching the fabric or surface.
    Highlighting texture and quality.`,
    en: 'touching furniture fabric, detail',
    detailedDescription: 'close interaction with furniture, hand gently touching the fabric or surface'
  }
}

export const POSE_PRESETS = {
  ...createPresetCategory<PoseId>('pose', '姿态', POSE_PRESET_DEFINITIONS as Record<PoseId, PresetDefinition>),

  /**
   * 获取完整的姿态预设（包含所有扩展字段）
   */
  getFullPreset(id: PoseId): PosePresetDefinition | undefined {
    return POSE_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): PosePresetDefinition[] {
    return Object.values(POSE_PRESET_DEFINITIONS)
  }
}

// ==================== 风格模式预设 ====================

const STYLE_MODE_PRESET_DEFINITIONS: Record<string, StyleModePresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select style mode',
    systemPromptBlock: undefined,
    userPromptBlock: undefined,
    styleDescription: '',
    quality: ''
  },
  daily: {
    id: 'daily',
    label: '日常生活风格',
    description: 'Natural, lifestyle-oriented, social media ready',
    systemPromptBlock: `authentic iPhone-captured candid moment style`,
    userPromptBlock: `**Style: DAILY/LIFESTYLE**
Real skin texture, natural imperfections, lifestyle photography.
Natural colors, authentic lighting, genuine moment captured.`,
    styleDescription:
      'authentic iPhone-captured candid moment style, real skin texture, natural imperfections, lifestyle photography',
    quality: 'natural colors, authentic lighting, genuine moment captured'
  },
  commercial: {
    id: 'commercial',
    label: '商业目录风格',
    description: 'Professional, polished, catalog-grade',
    systemPromptBlock: `professional magazine editorial style`,
    userPromptBlock: `**Style: COMMERCIAL/CATALOG**
Studio-quality product photography, commercial catalog standard.
Even lighting, perfect exposure, sharp details, commercial-grade retouching.`,
    styleDescription:
      'professional magazine editorial style, studio-quality product photography, commercial catalog standard',
    quality: 'even lighting, perfect exposure, sharp details, commercial-grade retouching'
  },
  celebrity: {
    id: 'celebrity',
    label: '明星同款',
    description: 'Fashion editorial celebrity style',
    systemPromptBlock: `celebrity street style, high-fashion editorial vibe`,
    userPromptBlock: `**Style: CELEBRITY**
High-fashion editorial vibe.
Stylish posing, premium feel, sharp contrast, trendy composition.`,
    styleDescription: 'celebrity street style, high-fashion editorial vibe',
    quality: 'stylish posing, premium feel, sharp contrast, trendy composition'
  },
  film: {
    id: 'film',
    label: '胶片复古',
    description: 'Film grain and vintage tones',
    systemPromptBlock: `film-like nostalgic style with grain and muted tones`,
    userPromptBlock: `**Style: FILM**
Film-like nostalgic style with grain and muted tones.
Soft highlights, gentle shadows, film grain, vintage palette.`,
    styleDescription: 'film-like nostalgic style with grain and muted tones',
    quality: 'soft highlights, gentle shadows, film grain, vintage palette'
  },
  japanese: {
    id: 'japanese',
    label: '日系清新',
    description: 'Airy Japanese clean style',
    systemPromptBlock: `Japanese airy clean style with overexposed highlights`,
    userPromptBlock: `**Style: JAPANESE**
Airy clean style with overexposed highlights.
Oxygen-feel, bright clean whites, soft pastel accents.`,
    styleDescription: 'Japanese airy clean style with overexposed highlights',
    quality: 'oxygen-feel, bright clean whites, soft pastel accents'
  },
  cinematic: {
    id: 'cinematic',
    label: '电影宽幅',
    description: 'Cinematic storytelling',
    systemPromptBlock: `cinematic wide-frame storytelling style`,
    userPromptBlock: `**Style: CINEMATIC**
Cinematic wide-frame storytelling style.
Film-grade color grading, narrative composition, wide aspect hints.`,
    styleDescription: 'cinematic wide-frame storytelling style',
    quality: 'film-grade color grading, narrative composition, wide aspect hints'
  }
}

export const STYLE_MODE_PRESETS = {
  ...createPresetCategory<StyleModeId>(
    'style_mode',
    '风格模式',
    STYLE_MODE_PRESET_DEFINITIONS as Record<StyleModeId, PresetDefinition>
  ),

  /**
   * 获取完整的风格模式预设（包含所有扩展字段）
   */
  getFullPreset(id: StyleModeId): StyleModePresetDefinition | undefined {
    return STYLE_MODE_PRESET_DEFINITIONS[id]
  },

  /**
   * 获取所有预设的完整列表
   */
  getAllPresets(): StyleModePresetDefinition[] {
    return Object.values(STYLE_MODE_PRESET_DEFINITIONS)
  }
}

// ==================== 解析函数 ====================

/**
 * 解析年龄段（处理 random）
 */
export function resolveAgeGroup(age: AgeGroupId | string | undefined | null): AgeGroupId {
  if (!age) return 'adult'
  if (age === 'random') {
    const options: AgeGroupId[] = ['small_kid', 'big_kid', 'teen', 'young_adult', 'adult', 'mature']
    return options[Math.floor(Math.random() * options.length)]
  }
  return age as AgeGroupId
}

/**
 * 解析性别（处理 random）
 *
 * @description 当输入为 'random' 时，从所有已定义的性别中随机选择一个
 * @param gender - 性别ID，可以是具体性别或 'random'
 * @returns 解析后的性别ID（永不返回 'random'）
 *
 * 支持的性别：
 * - female: 女
 * - male: 男
 * - unisex: 不区分
 */
export function resolveGender(gender: GenderId | string | undefined | null): GenderId {
  if (!gender) return 'female'
  if (gender === 'random') {
    // 随机候选列表：包含所有已定义的性别预设（排除 random 本身）
    const options: GenderId[] = ['female', 'male', 'unisex']
    return options[Math.floor(Math.random() * options.length)]
  }
  return gender as GenderId
}

/**
 * 解析场景（处理 random）
 *
 * @description 当输入为 'random' 时，从所有已定义的场景中随机选择一个
 * @param scene - 场景ID，可以是具体场景或 'random'
 * @returns 解析后的场景ID（永不返回 'random'）
 *
 * 支持的场景：
 * - studio: 专业影棚
 * - home: 室内家居
 * - outdoor: 户外场景
 * - playground: 游乐场
 * - nature: 自然风景
 * - beach: 海边度假
 * - urban: 城市街景
 * - campus: 校园青春
 * - sakura: 樱花季节
 * - gallery: 艺术画廊
 */
export function resolveScene(scene: SceneId | string | undefined | null): SceneId {
  if (!scene) return 'studio'
  if (scene === 'random') {
    // 随机候选列表：包含所有已定义的场景预设（排除 random 本身）
    const options = Object.keys(SCENE_PRESET_DEFINITIONS).filter((key) => key !== 'random') as SceneId[]
    return options[Math.floor(Math.random() * options.length)]
  }
  return scene as SceneId
}

/**
 * 解析人种（处理 random）
 *
 * @description 当输入为 'random' 时，从所有已定义的人种中随机选择一个
 * @param ethnicity - 人种ID，可以是具体人种或 'random'
 * @returns 解析后的人种ID（永不返回 'random'）
 *
 * 支持的人种：
 * - asian: 亚洲人
 * - caucasian: 白人
 * - african_american: 非裔
 * - hispanic: 拉丁裔
 * - mixed: 混血
 * - middle_eastern: 中东人
 * - south_asian: 南亚人
 * - south_east_asian: 东南亚人
 */
export function resolveEthnicity(ethnicity: EthnicityId | string | undefined | null): EthnicityId {
  if (!ethnicity) return 'asian'
  if (ethnicity === 'random') {
    // 随机候选列表：包含所有已定义的人种预设（排除 random 本身）
    const options: EthnicityId[] = [
      'asian',
      'caucasian',
      'african_american',
      'hispanic',
      'mixed',
      'middle_eastern',
      'south_asian',
      'south_east_asian'
    ]
    return options[Math.floor(Math.random() * options.length)]
  }
  return ethnicity as EthnicityId
}

/**
 * 解析姿态（处理 random）
 *
 * @description 当输入为 'random' 时，从所有已定义的姿态中随机选择一个
 * @param pose - 姿态ID，可以是具体姿态或 'random'
 * @returns 解析后的姿态ID（永不返回 'random'）
 *
 * 支持的姿态：
 * - natural: 自然站立
 * - sitting: 坐姿
 * - playing: 玩耍
 * - walking: 行走
 * - confident: 自信姿态
 * - editorial: 时尚大片
 * - hands_on_hips: 叉腰
 * - running: 奔跑
 * - jumping: 跳跃
 */
export function resolvePose(pose: PoseId | string | undefined | null): PoseId {
  if (!pose) return 'natural'
  if (pose === 'random') {
    // 随机候选列表：包含所有已定义的姿态预设（排除 random 本身）
    const options = Object.keys(POSE_PRESET_DEFINITIONS).filter((key) => key !== 'random') as PoseId[]
    return options[Math.floor(Math.random() * options.length)]
  }
  return pose as PoseId
}

/**
 * 解析风格模式（处理 random）
 *
 * @description 当输入为 'random' 时，从所有已定义的风格模式中随机选择一个
 * @param styleMode - 风格模式ID，可以是具体风格或 'random'
 * @returns 解析后的风格模式ID（永不返回 'random'）
 *
 * 支持的风格模式：
 * - daily: 日常生活风格（iPhone 抓拍美学）
 * - commercial: 商业目录风格（专业影棚级）
 * - celebrity: 明星同款（高端时尚编辑风）
 * - film: 胶片复古（颗粒感和复古色调）
 * - japanese: 日系清新（过曝高光和空气感）
 * - cinematic: 电影宽幅（叙事构图和电影调色）
 */
export function resolveStyleMode(styleMode: StyleModeId | string | undefined | null): StyleModeId {
  if (!styleMode) return 'daily'
  if (styleMode === 'random') {
    // 随机候选列表：包含所有已定义的风格模式预设（排除 random 本身）
    const options: StyleModeId[] = ['daily', 'commercial', 'celebrity', 'film', 'japanese', 'cinematic']
    return options[Math.floor(Math.random() * options.length)]
  }
  return styleMode as StyleModeId
}

// ==================== 兼容旧接口的辅助函数 ====================

/**
 * 获取年龄段预设（兼容旧接口）
 * @deprecated 使用 AGE_PRESETS.getFullPreset(id) 替代
 */
export function getAgePreset(ageGroup: string): AgePresetDefinition | undefined {
  if (ageGroup === 'random') {
    const resolved = resolveAgeGroup('random')
    return AGE_PRESET_DEFINITIONS[resolved]
  }
  return AGE_PRESET_DEFINITIONS[ageGroup as AgeGroupId]
}

/**
 * 获取性别预设（兼容旧接口）
 * @deprecated 使用 GENDER_PRESETS.getFullPreset(id) 替代
 */
export function getGenderPreset(gender: string): GenderPresetDefinition | undefined {
  if (gender === 'random') {
    const resolved = resolveGender('random')
    return GENDER_PRESET_DEFINITIONS[resolved]
  }
  return GENDER_PRESET_DEFINITIONS[gender as GenderId]
}

/**
 * 获取场景预设（兼容旧接口）
 * @deprecated 使用 SCENE_PRESETS.getFullPreset(id) 替代
 */
export function getScenePreset(scene: string): ScenePresetDefinition | undefined {
  if (scene === 'random') {
    const resolved = resolveScene('random')
    return SCENE_PRESET_DEFINITIONS[resolved]
  }
  return SCENE_PRESET_DEFINITIONS[scene]
}

/**
 * 获取人种预设（兼容旧接口）
 * @deprecated 使用 ETHNICITY_PRESETS.getFullPreset(id) 替代
 */
export function getEthnicityPreset(ethnicity: string): EthnicityPresetDefinition | undefined {
  if (ethnicity === 'random') {
    const resolved = resolveEthnicity('random')
    return ETHNICITY_PRESET_DEFINITIONS[resolved]
  }
  return ETHNICITY_PRESET_DEFINITIONS[ethnicity]
}

/**
 * 获取姿态预设（兼容旧接口）
 * @deprecated 使用 POSE_PRESETS.getFullPreset(id) 替代
 */
export function getPosePreset(pose: string): PosePresetDefinition | undefined {
  if (pose === 'random') {
    const resolved = resolvePose('random')
    return POSE_PRESET_DEFINITIONS[resolved]
  }
  return POSE_PRESET_DEFINITIONS[pose]
}

/**
 * 获取风格模式预设（兼容旧接口）
 * @deprecated 使用 STYLE_MODE_PRESETS.getFullPreset(id) 替代
 */
export function getStyleModePreset(styleMode: string): StyleModePresetDefinition | undefined {
  if (styleMode === 'random') {
    const resolved = resolveStyleMode('random')
    return STYLE_MODE_PRESET_DEFINITIONS[resolved]
  }
  return STYLE_MODE_PRESET_DEFINITIONS[styleMode]
}
