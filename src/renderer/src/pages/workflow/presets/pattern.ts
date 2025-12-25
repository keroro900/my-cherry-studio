/**
 * 图案预设注册表
 * Pattern Preset Registry
 *
 * 包含：
 * - 图案类型预设 (PATTERN_TYPE_PRESETS)
 * - 图案风格预设 (PATTERN_STYLE_PRESETS)
 * - 复杂图案风格预设 (COMPLEX_PATTERN_STYLE_PRESETS) - 支持 tags/category/preview
 *
 * 【SSOT 模式】
 * 添加新预设只需在注册表中添加一条记录，UI 自动同步：
 * - getOptions() 自动包含新选项
 * - getPresetsByCategory() 按分类过滤
 * - searchPresets() 搜索标签和名称
 *
 * @module presets/pattern
 */

import {
  type ComplexPresetCategory,
  createPresetCategory,
  type PatternStyleId,
  type PatternStylePresetDefinition,
  type PatternTypeId,
  type PresetDefinition
} from './types'

// ==================== 图案类型预设 ====================

const PATTERN_TYPE_PRESET_DEFINITIONS: Record<PatternTypeId, PresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select pattern type',
    systemPromptBlock: undefined,
    userPromptBlock: undefined
  },
  seamless: {
    id: 'seamless',
    label: '无缝拼贴',
    description: 'Seamlessly repeatable pattern',
    systemPromptBlock: `seamless repeating pattern design`,
    userPromptBlock: `**Pattern Type: SEAMLESS TILE**
Create a seamlessly repeatable pattern that tiles perfectly in all directions.
- Pattern edges must match exactly when repeated
- No visible seams or breaks in the design
- Suitable for fabric printing at any scale`
  },
  placement: {
    id: 'placement',
    label: '定位印花',
    description: 'Single placement design (chest print)',
    systemPromptBlock: `single placement print design`,
    userPromptBlock: `**Pattern Type: PLACEMENT PRINT**
Create a single, standalone design suitable for chest or center placement.
- Self-contained design with clear boundaries
- Works as a focal point on the garment
- Typically placed on chest, back, or hem area`
  },
  allover: {
    id: 'allover',
    label: '满印图案',
    description: 'Full garment coverage pattern',
    systemPromptBlock: `allover print pattern`,
    userPromptBlock: `**Pattern Type: ALLOVER PRINT**
Create a pattern that covers the entire garment surface.
- Continuous design across the whole garment
- Consider how pattern flows across seams
- Balance between density and visual clarity`
  }
}

export const PATTERN_TYPE_PRESETS = createPresetCategory<PatternTypeId>(
  'pattern_type',
  '图案类型',
  PATTERN_TYPE_PRESET_DEFINITIONS
)

// ==================== 图案风格预设 ====================

const PATTERN_STYLE_PRESET_DEFINITIONS: Record<PatternStyleId, PresetDefinition> = {
  random: {
    id: 'random',
    label: '随机选择',
    description: 'Randomly select pattern style',
    systemPromptBlock: undefined,
    userPromptBlock: undefined
  },
  auto: {
    id: 'auto',
    label: '自动检测',
    description: 'Automatically detect style from image',
    systemPromptBlock: `analyze and match the source pattern style`,
    userPromptBlock: `**Pattern Style: AUTO-DETECT**
Analyze the reference image and match its visual style automatically.`
  },
  kawaii: {
    id: 'kawaii',
    label: '卡哇伊可爱',
    description: 'Japanese cute style',
    systemPromptBlock: `kawaii cute Japanese style pattern`,
    userPromptBlock: `**Pattern Style: KAWAII (Cute)**
Japanese cute aesthetic with rounded shapes, pastel colors, and adorable characters.
- Soft, rounded shapes
- Pastel and candy colors
- Cute facial expressions on characters
- Playful and innocent mood`
  },
  sporty: {
    id: 'sporty',
    label: '运动动感',
    description: 'Athletic sports style',
    systemPromptBlock: `sporty athletic style pattern`,
    userPromptBlock: `**Pattern Style: SPORTY**
Dynamic athletic style with bold graphics and energetic elements.
- Bold, dynamic shapes
- High contrast colors
- Motion-inspired elements
- Sports-related imagery`
  },
  preppy: {
    id: 'preppy',
    label: '学院风',
    description: 'Classic collegiate style',
    systemPromptBlock: `preppy collegiate style pattern`,
    userPromptBlock: `**Pattern Style: PREPPY (Collegiate)**
Classic academic/collegiate aesthetic with refined patterns.
- Traditional motifs (stripes, plaids, crests)
- Navy, burgundy, forest green color palette
- Clean, structured designs
- Ivy League inspired`
  },
  ip_theme: {
    id: 'ip_theme',
    label: 'IP主题',
    description: 'Character/IP based theme',
    systemPromptBlock: `IP character themed pattern`,
    userPromptBlock: `**Pattern Style: IP THEME**
Character or intellectual property themed design.
- Feature the character prominently
- Match the character's world aesthetic
- Include themed accessories and elements
- Maintain character authenticity`
  },
  sweet: {
    id: 'sweet',
    label: '甜美浪漫',
    description: 'Sweet romantic style',
    systemPromptBlock: `sweet romantic feminine style pattern`,
    userPromptBlock: `**Pattern Style: SWEET ROMANTIC**
Feminine, romantic aesthetic with soft, dreamy elements.
- Florals, hearts, ribbons, lace
- Pink, lavender, cream color palette
- Soft, flowing shapes
- Delicate, princess-like mood`
  },
  geometric: {
    id: 'geometric',
    label: '几何图形',
    description: 'Geometric shapes pattern',
    systemPromptBlock: `geometric shapes and forms pattern`,
    userPromptBlock: `**Pattern Style: GEOMETRIC**
Abstract geometric design with clean shapes and mathematical precision.
- Circles, triangles, squares, hexagons
- Clean lines and precise angles
- Bold or subtle color blocking
- Modern, contemporary feel`
  },
  text: {
    id: 'text',
    label: '字体排版',
    description: 'Text/slogan based pattern',
    systemPromptBlock: `typographic text-based pattern`,
    userPromptBlock: `**Pattern Style: TYPOGRAPHY**
Text and slogan-based design with creative lettering.
- Bold, readable fonts
- Creative typography arrangements
- Meaningful words or phrases
- Letter-based graphic elements`
  }
}

export const PATTERN_STYLE_PRESETS = createPresetCategory<PatternStyleId>(
  'pattern_style',
  '图案风格',
  PATTERN_STYLE_PRESET_DEFINITIONS
)

// ==================== 解析函数 ====================

/**
 * 解析图案类型（处理 random）
 */
export function resolvePatternType(type: PatternTypeId | string | undefined | null): PatternTypeId {
  if (!type) return 'seamless'
  if (type === 'random') {
    const options: PatternTypeId[] = ['seamless', 'placement', 'allover']
    return options[Math.floor(Math.random() * options.length)]
  }
  return type as PatternTypeId
}

/**
 * 解析图案风格（处理 random）
 */
export function resolvePatternStyle(style: PatternStyleId | string | undefined | null): PatternStyleId {
  if (!style) return 'auto'
  if (style === 'random') {
    const options: PatternStyleId[] = ['kawaii', 'sporty', 'preppy', 'ip_theme', 'sweet', 'geometric', 'text']
    return options[Math.floor(Math.random() * options.length)]
  }
  return style as PatternStyleId
}

// ==================== 提示词辅助函数 ====================

/**
 * 获取图案类型的系统提示词片段
 */
export function getPatternTypeSystemPromptBlock(type: PatternTypeId): string {
  const preset = PATTERN_TYPE_PRESETS.getPreset(type)
  return preset?.systemPromptBlock || PATTERN_TYPE_PRESETS.getPreset('seamless')!.systemPromptBlock!
}

/**
 * 获取图案类型的用户提示词片段
 */
export function getPatternTypeUserPromptBlock(type: PatternTypeId): string {
  const preset = PATTERN_TYPE_PRESETS.getPreset(type)
  return preset?.userPromptBlock || PATTERN_TYPE_PRESETS.getPreset('seamless')!.userPromptBlock!
}

/**
 * 获取图案风格的系统提示词片段
 */
export function getPatternStyleSystemPromptBlock(style: PatternStyleId): string {
  const preset = PATTERN_STYLE_PRESETS.getPreset(style)
  return preset?.systemPromptBlock || PATTERN_STYLE_PRESETS.getPreset('auto')!.systemPromptBlock!
}

/**
 * 获取图案风格的用户提示词片段
 */
export function getPatternStyleUserPromptBlock(style: PatternStyleId): string {
  const preset = PATTERN_STYLE_PRESETS.getPreset(style)
  return preset?.userPromptBlock || PATTERN_STYLE_PRESETS.getPreset('auto')!.userPromptBlock!
}

// ==================== 复杂图案风格预设（支持 tags/category/preview）====================

/**
 * 复杂图案风格预设定义
 * Complex Pattern Style Preset Definitions
 *
 * 这些预设包含完整的提示词、标签和分类信息，
 * 用于 PromptPresetSelector 等需要搜索/过滤/分类的场景。
 *
 * 【如何添加新预设】
 * 1. 在下方 COMPLEX_PATTERN_STYLE_DEFINITIONS 对象中添加新条目
 * 2. 遵循已有预设的格式：
 *    - id: 唯一标识符（建议使用 snake_case）
 *    - label: 中文显示名称
 *    - nameEn: 英文名称
 *    - description: 简短描述
 *    - prompt: 完整的提示词模板
 *    - tags: 搜索/过滤用标签数组
 *    - category: 分类（'pattern' | 'commercial' | 'lifestyle' | 'artistic'）
 *    - preview: 预览图 URL（可选）
 * 3. UI 会自动同步显示新预设
 *
 * @example
 * new_style: {
 *   id: 'new_style',
 *   label: '新风格名称',
 *   nameEn: 'New Style Name',
 *   description: '风格描述',
 *   prompt: 'Style: ... Layout: ... Colors: ... Elements: ... Vibe: ...',
 *   tags: ['标签1', '标签2', '标签3'],
 *   category: 'pattern',
 *   preview: '/assets/pattern-previews/new_style.png'
 * }
 */
const COMPLEX_PATTERN_STYLE_DEFINITIONS: Record<string, PatternStylePresetDefinition> = {
  // y2k_acid
  y2k_acid: {
    id: 'y2k_acid',
    label: 'Y2K 千禧辣妹',
    nameEn: 'Y2K Club Girl',
    description: '酸性/散点/重叠 - 霓虹与金属色',
    prompt:
      'Style: Acid Y2K club graphic. Layout: chaotic tossed icons, overlaps and sticker clusters. Colors: neon and chrome. Elements: flames, butterflies, tribal swirls and chrome hearts. Vibe: spicy and over-the-top.',
    tags: ['潮流', '复古', '霓虹', '图案'],
    category: 'pattern'
  },

  // boho_cottagecore
  boho_cottagecore: {
    id: 'boho_cottagecore',
    label: 'Boho 波西米亚',
    nameEn: 'Boho Cottagecore',
    description: '自然/碎花/错落 - 温暖大地色',
    prompt:
      'Style: cottagecore boho. Layout: slightly irregular clusters and trails. Colors: warm earthy pastels. Elements: wildflowers, leaves and mushrooms. Vibe: soft, free and natural.',
    tags: ['自然', '田园', '温暖', '图案'],
    category: 'pattern'
  },

  // retro_70s
  retro_70s: {
    id: 'retro_70s',
    label: 'Retro 70s 复古',
    nameEn: '70s Groovy',
    description: '流动/波浪/紧凑 - 橙棕色系',
    prompt:
      'Style: 1970s groovy. Layout: dense, flowing bands and flowers with almost no empty space. Colors: orange, brown, mustard and cream. Elements: wavy stripes, daisies and warped checks. Vibe: trippy and warm.',
    tags: ['复古', '70年代', '流动', '图案'],
    category: 'pattern'
  },

  // streetwear
  streetwear: {
    id: 'streetwear',
    label: 'Streetwear 街头',
    nameEn: 'Urban Streetwear',
    description: '涂鸦/堆叠/硬朗 - 高对比度',
    prompt:
      'Style: urban streetwear. Layout: layered tags and sticker-bomb clusters. Colors: high-contrast brights on dark base. Elements: graffiti marks, spray drips and bold lettering. Vibe: tough and energetic.',
    tags: ['街头', '涂鸦', '潮流', '图案'],
    category: 'pattern'
  },

  // cute_cartoon
  cute_cartoon: {
    id: 'cute_cartoon',
    label: 'Cute Cartoon 童趣',
    nameEn: 'Dopamine Kids Cartoon',
    description: '跳跃/大小对比 - 糖果色',
    prompt:
      'Style: dopamine-kids cartoon. Layout: playful tossed icons with big–small contrast. Colors: candy brights. Elements: cute animals, sweets and toys. Vibe: bubbly, silly and fun.',
    tags: ['童趣', '可爱', '糖果色', '图案'],
    category: 'pattern'
  },

  // dino_party
  dino_party: {
    id: 'dino_party',
    label: 'Dino Party 恐龙派对',
    nameEn: 'Dinosaur Party',
    description: '恐龙/足迹/岩石 - 柔和绿蓝橙',
    prompt:
      'Style: cute dinosaur party. Layout: tossed dinos walking in different directions with small filler icons. Colors: soft greens, blues and oranges. Elements: chubby dinos, footprints, rocks and volcanoes. Vibe: adventurous but friendly.',
    tags: ['恐龙', '冒险', '男童', '图案'],
    category: 'pattern'
  },

  // unicorn_dream
  unicorn_dream: {
    id: 'unicorn_dream',
    label: 'Unicorn Dream 独角兽梦境',
    nameEn: 'Unicorn Princess',
    description: '独角兽/彩虹/公主 - 柔和彩虹',
    prompt:
      'Style: magical unicorn princess. Layout: light, airy tossed motifs with floating clouds. Colors: pastel rainbow and iridescent accents. Elements: unicorns, rainbows, hearts, stars and tiaras. Vibe: dreamy and sweet.',
    tags: ['独角兽', '梦幻', '女童', '图案'],
    category: 'pattern'
  },

  // space_explorer
  space_explorer: {
    id: 'space_explorer',
    label: 'Space Explorer 太空冒险',
    nameEn: 'Kids Space Adventure',
    description: '宇航员/星球/飞船 - 深蓝霓虹',
    prompt:
      'Style: kids space adventure. Layout: full all-over galaxy with orbiting elements. Colors: navy or black night sky with neon accents. Elements: astronauts, rockets, planets, UFOs and stars. Vibe: curious, techy and bold.',
    tags: ['太空', '科技', '男童', '图案'],
    category: 'pattern'
  },

  // candy_shop
  candy_shop: {
    id: 'candy_shop',
    label: 'Candy Shop 糖果屋',
    nameEn: 'Candy Shop Dopamine',
    description: '糖果/棒棒糖/棋盘格 - 高饱和粉薄荷',
    prompt:
      'Style: candy shop dopamine. Layout: repeating candy clusters with checkerboard pieces. Colors: saturated pink, mint, lemon and lilac. Elements: lollipops, wrapped candies, gummies and check tiles. Vibe: sugar-rush and playful.',
    tags: ['糖果', '多巴胺', '甜美', '图案'],
    category: 'pattern'
  },

  // kawaii_animal
  kawaii_animal: {
    id: 'kawaii_animal',
    label: 'Kawaii 软萌动物乐园',
    nameEn: 'Kawaii Animal Parade',
    description: '熊/兔/狗 - 柔和粉棕线稿',
    prompt:
      'Style: kawaii animal parade. Layout: evenly spaced tossed characters with tiny icons between. Colors: soft pastels with brown line art. Elements: bears, bunnies, puppies, snacks and tiny hearts. Vibe: ultra-cute and gentle.',
    tags: ['可爱', '日系', '软萌', '图案'],
    category: 'pattern'
  },

  // racing_car
  racing_car: {
    id: 'racing_car',
    label: 'Racing Car 赛道赛车',
    nameEn: 'Racing Cars',
    description: '赛车/闪电/格纹 - 红黄黑白',
    prompt:
      'Style: boyish racing fun. Layout: diagonal motion with speed lines and badges. Colors: red, yellow, black and white. Elements: race cars, checkered flags, numbers and lightning bolts. Vibe: fast, sporty and loud.',
    tags: ['赛车', '运动', '男童', '图案'],
    category: 'pattern'
  },

  // sport_varsity
  sport_varsity: {
    id: 'sport_varsity',
    label: 'Sport Varsity 校园运动',
    nameEn: 'Varsity Sports',
    description: '球类/字母/徽章 - 藏青红灰',
    prompt:
      'Style: varsity college sports. Layout: badges and numbers scattered with balls and stripes. Colors: navy, red, grey and mustard. Elements: varsity letters, footballs, basketballs and stripes. Vibe: athletic and classic.',
    tags: ['运动', '校园', '美式', '图案'],
    category: 'pattern'
  },

  // basketball_court
  basketball_court: {
    id: 'basketball_court',
    label: 'Basketball Court 篮球场',
    nameEn: 'Basketball Kids',
    description: '篮球/篮筐/数字 - 橙黑白',
    prompt:
      'Style: basketball kids. Layout: diagonal motion with court lines. Colors: orange, black, white. Elements: balls, hoops, numbers. Vibe: sporty and bold.',
    tags: ['篮球', '运动', '动感', '图案'],
    category: 'pattern'
  },

  // soccer_field
  soccer_field: {
    id: 'soccer_field',
    label: 'Soccer Field 足球场',
    nameEn: 'Soccer Kids',
    description: '足球/球门/球衣 - 草绿白黑',
    prompt:
      'Style: soccer kids. Layout: pitch cues with icon toss. Colors: grass green, white, black. Elements: balls, goals, jersey badges. Vibe: classic and active.',
    tags: ['足球', '运动', '经典', '图案'],
    category: 'pattern'
  },

  // mermaid_ocean
  mermaid_ocean: {
    id: 'mermaid_ocean',
    label: 'Mermaid Ocean 人鱼海底',
    nameEn: 'Mermaid Fantasy',
    description: '美人鱼/贝壳/波纹 - 水蓝紫珠光',
    prompt:
      'Style: under-sea mermaid fantasy. Layout: flowing vertical waves with drifting motifs. Colors: aqua, teal, lilac and pearly highlights. Elements: mermaids, shells, sea plants and bubbles. Vibe: calm, magical and fluid.',
    tags: ['海洋', '美人鱼', '梦幻', '图案'],
    category: 'pattern'
  },

  // ocean_sailor
  ocean_sailor: {
    id: 'ocean_sailor',
    label: 'Ocean Sailor 航海小水手',
    nameEn: 'Nautical Sailor',
    description: '条纹/锚/船 - 藏青白红浅蓝',
    prompt:
      'Style: nautical sailor. Layout: stripes combined with scattered icons. Colors: navy, white, red and light blue. Elements: anchors, boats, life rings and steering wheels. Vibe: fresh, marine and tidy.',
    tags: ['航海', '水手', '清爽', '图案'],
    category: 'pattern'
  },

  // ocean_friends
  ocean_friends: {
    id: 'ocean_friends',
    label: 'Ocean Friends 海洋伙伴',
    nameEn: 'Ocean Kids',
    description: '鲸鱼/海豚/海龟 - 水蓝藏青珊瑚',
    prompt:
      'Style: ocean kids. Layout: scattered sea animals with bubbles. Colors: aqua, navy, coral. Elements: whales, dolphins, turtles. Vibe: calm and cute.',
    tags: ['海洋', '动物', '可爱', '图案'],
    category: 'pattern'
  },

  // jungle_safari
  jungle_safari: {
    id: 'jungle_safari',
    label: 'Jungle Safari 丛林探险',
    nameEn: 'Jungle Safari',
    description: '狮子/老虎/长颈鹿 - 绿棕沙色',
    prompt:
      'Style: jungle safari. Layout: medium-density tossed animals among dense foliage. Colors: greens, warm browns and sandy yellow. Elements: lions, tigers, giraffes, big leaves and paw prints. Vibe: wild but kid-friendly.',
    tags: ['丛林', '动物', '冒险', '图案'],
    category: 'pattern'
  },

  // forest_friends
  forest_friends: {
    id: 'forest_friends',
    label: 'Forest Friends 森林伙伴',
    nameEn: 'Woodland Friends',
    description: '狐狸/鹿/松鼠 - 灰绿锈色',
    prompt:
      'Style: woodland kids. Layout: medium density motifs with leaf fillers. Colors: sage, rust, cream and brown. Elements: foxes, deer, squirrels, acorns. Vibe: warm and natural.',
    tags: ['森林', '动物', '温暖', '图案'],
    category: 'pattern'
  },

  // farm_friends
  farm_friends: {
    id: 'farm_friends',
    label: 'Farm Friends 农场伙伴',
    nameEn: 'Farm Friends',
    description: '奶牛/小鸡/稻草人 - 奶油绿蓝',
    prompt:
      'Style: friendly farm. Layout: evenly tossed animals and tools with micro fillers. Colors: cream, tan, grass green and sky blue. Elements: cows, chicks, tractors, straw bales. Vibe: wholesome and sunny.',
    tags: ['农场', '动物', '阳光', '图案'],
    category: 'pattern'
  },

  // arctic_friends
  arctic_friends: {
    id: 'arctic_friends',
    label: 'Arctic Friends 北极伙伴',
    nameEn: 'Arctic Friends',
    description: '企鹅/海豹/雪花 - 冰蓝白紫',
    prompt:
      'Style: arctic cute. Layout: sparse airy scatter with snowflake fillers. Colors: icy blue, navy, white and lilac. Elements: penguins, seals, igloos, snow. Vibe: cool and gentle.',
    tags: ['北极', '冬季', '可爱', '图案'],
    category: 'pattern'
  },

  // pet_pals
  pet_pals: {
    id: 'pet_pals',
    label: 'Pet Pals 宠物伙伴',
    nameEn: 'Pet Parade',
    description: '小狗/小猫/骨头 - 柔和中性糖果色',
    prompt:
      'Style: pet parade. Layout: balanced tossed with bones and yarn fillers. Colors: soft neutrals with candy accents. Elements: puppies, kittens, bowls, toys. Vibe: cozy and playful.',
    tags: ['宠物', '可爱', '温馨', '图案'],
    category: 'pattern'
  },

  // construction_vehicles
  construction_vehicles: {
    id: 'construction_vehicles',
    label: 'Construction 工程车队',
    nameEn: 'Construction Vehicles',
    description: '挖掘机/卡车 - 黄橙蓝灰',
    prompt:
      'Style: construction truck kid. Layout: medium-density tossed vehicles on simple ground hints. Colors: yellow, orange, blue and grey. Elements: diggers, dump trucks, cones and signs. Vibe: busy, mechanical and fun.',
    tags: ['工程', '车辆', '男童', '图案'],
    category: 'pattern'
  },

  // fire_rescue
  fire_rescue: {
    id: 'fire_rescue',
    label: 'Fire Rescue 消防救援',
    nameEn: 'Fire Rescue',
    description: '消防车/头盔 - 火红黄灰藏青',
    prompt:
      'Style: rescue squad. Layout: diagonal ladders and truck icons. Colors: fire red, yellow, grey and navy. Elements: fire trucks, helmets, hydrants. Vibe: strong and friendly.',
    tags: ['消防', '英雄', '男童', '图案'],
    category: 'pattern'
  },

  // airplane_sky
  airplane_sky: {
    id: 'airplane_sky',
    label: 'Airplane Sky 飞机天空',
    nameEn: 'Aviation Kids',
    description: '飞机/螺旋桨 - 天蓝红白银',
    prompt:
      'Style: aviation kids. Layout: wavy flight paths with cloud fillers. Colors: sky blue, red, white and silver. Elements: planes, propellers, towers. Vibe: breezy and bright.',
    tags: ['飞机', '天空', '冒险', '图案'],
    category: 'pattern'
  },

  // train_station
  train_station: {
    id: 'train_station',
    label: 'Train Station 火车站',
    nameEn: 'Train Play',
    description: '火车头/车厢/铁轨 - 炭灰红黄蓝',
    prompt:
      'Style: train play. Layout: brick repeat hints with icons. Colors: charcoal, red, yellow, blue. Elements: engines, carriages, tracks, signals. Vibe: classic and cute.',
    tags: ['火车', '交通', '男童', '图案'],
    category: 'pattern'
  },

  // holiday_xmas
  holiday_xmas: {
    id: 'holiday_xmas',
    label: 'Holiday Xmas 圣诞节日',
    nameEn: 'Christmas Holiday',
    description: '圣诞树/驯鹿/礼物 - 红绿金',
    prompt:
      'Style: cute Christmas kids. Layout: medium-density festive icons on a snowy base. Colors: red, green, cream and gold. Elements: trees, reindeer, stockings, gifts and snowflakes. Vibe: cozy, celebratory and bright.',
    tags: ['圣诞', '节日', '冬季', '图案'],
    category: 'pattern'
  },

  // halloween_spooky
  halloween_spooky: {
    id: 'halloween_spooky',
    label: 'Halloween 万圣节萌鬼',
    nameEn: 'Spooky Cute Halloween',
    description: '南瓜/蝙蝠/鬼魂 - 紫橙黑绿',
    prompt:
      'Style: spooky-cute Halloween. Layout: tossed characters with small filler icons. Colors: purple, orange, black and acid green. Elements: smiling ghosts, pumpkins, bats and candies. Vibe: playful, not scary.',
    tags: ['万圣节', '节日', '可爱', '图案'],
    category: 'pattern'
  },

  // birthday_fun
  birthday_fun: {
    id: 'birthday_fun',
    label: 'Birthday Fun 生日乐趣',
    nameEn: 'Birthday Party',
    description: '蛋糕/蜡烛/礼物 - 糖果明亮色',
    prompt:
      'Style: birthday set. Layout: cakes and hats tossed with sparks. Colors: candy brights. Elements: cakes, candles, gifts. Vibe: celebratory and sweet.',
    tags: ['生日', '派对', '庆祝', '图案'],
    category: 'pattern'
  },

  // minimalist_geometry
  minimalist_geometry: {
    id: 'minimalist_geometry',
    label: 'Minimalist 极简几何',
    nameEn: 'Minimalist Geometry',
    description: '非对齐/留白 - 柔和中性色',
    prompt:
      'Style: modern minimalist geometry. Layout: asymmetrical floating shapes with lots of negative space. Colors: limited muted palette. Elements: dots, squiggles and blocks. Vibe: clean, design-driven and calm.',
    tags: ['极简', '几何', '现代', '图案'],
    category: 'pattern'
  },

  // polka_dots
  polka_dots: {
    id: 'polka_dots',
    label: 'Polka Dots 圆点乐园',
    nameEn: 'Polka Dot Fun',
    description: '圆点/星星/爱心 - 原色或柔和色',
    prompt:
      'Style: dot play. Layout: dot fields with cute icons sparingly. Colors: primaries or pastels. Elements: dots, mini stars, hearts. Vibe: classic and bubbly.',
    tags: ['圆点', '经典', '简约', '图案'],
    category: 'pattern'
  },

  // rainbow_hearts
  rainbow_hearts: {
    id: 'rainbow_hearts',
    label: 'Rainbow Hearts 彩虹小爱心',
    nameEn: 'Rainbow Hearts',
    description: '爱心/星星/彩虹 - 彩虹渐变',
    prompt:
      'Style: rainbow heart repeat. Layout: simple, even tossed icons and micro icons. Colors: rainbow gradients on a light base. Elements: hearts, stars, sparkles and smiles. Vibe: optimistic, friendly and simple.',
    tags: ['彩虹', '爱心', '乐观', '图案'],
    category: 'pattern'
  },

  // fruit_crush
  fruit_crush: {
    id: 'fruit_crush',
    label: 'Fruit Crush 多巴胺水果',
    nameEn: 'Fruity Dopamine',
    description: '草莓/樱桃/柠檬 - 高饱和果色',
    prompt:
      'Style: fruity dopamine. Layout: bold tossed fruits with some overlapping for depth. Colors: bright reds, oranges, yellows and greens. Elements: strawberries, cherries, oranges, lemons and juice drops. Vibe: juicy, fresh and fun.',
    tags: ['水果', '多巴胺', '清新', '图案'],
    category: 'pattern'
  },

  // ice_cream_land
  ice_cream_land: {
    id: 'ice_cream_land',
    label: 'Ice Cream Land 冰淇淋王国',
    nameEn: 'Ice Cream Kingdom',
    description: '甜筒/冰棒/彩色糖 - 薄荷草莓香草',
    prompt:
      'Style: ice cream kids. Layout: cone and scoop toss with drips. Colors: mint, strawberry, vanilla, chocolate. Elements: cones, popsicles, sprinkles. Vibe: cool and happy.',
    tags: ['冰淇淋', '甜品', '清凉', '图案'],
    category: 'pattern'
  },

  // sweet_bakery
  sweet_bakery: {
    id: 'sweet_bakery',
    label: 'Sweet Bakery 甜品面包房',
    nameEn: 'Bakery Treats',
    description: '甜甜圈/牛角包/蛋糕 - 奶油粉棕',
    prompt:
      'Style: bakery cute. Layout: sticker clusters of pastries. Colors: cream, pink, chocolate brown. Elements: donuts, croissants, cupcakes. Vibe: cozy and sweet.',
    tags: ['烘焙', '甜品', '温馨', '图案'],
    category: 'pattern'
  },

  // pastel_dream
  pastel_dream: {
    id: 'pastel_dream',
    label: 'Pastel Dream 淡彩梦境',
    nameEn: 'Pastel Dream',
    description: '渐变/云朵/星星 - 婴儿粉紫薄荷蓝',
    prompt:
      'Style: pastel gradient dreamcore. Layout: very soft, low-contrast tossed shapes. Colors: baby pink, lavender, mint and sky blue. Elements: clouds, moons and tiny stars. Vibe: sleepy, soft and soothing.',
    tags: ['梦幻', '柔和', '治愈', '图案'],
    category: 'pattern'
  },

  // fairy_forest
  fairy_forest: {
    id: 'fairy_forest',
    label: 'Fairy Forest 仙子花园',
    nameEn: 'Fairy Woodland',
    description: '精灵/花朵/蘑菇 - 灰粉鼠尾草金',
    prompt:
      'Style: fairy woodland. Layout: clusters of florals and fairy characters with open breathing space. Colors: dusty pink, sage, cream and gold accents. Elements: fairies, mushrooms and tiny flowers. Vibe: whimsical and gentle.',
    tags: ['仙子', '花园', '梦幻', '图案'],
    category: 'pattern'
  },

  // princess_garden
  princess_garden: {
    id: 'princess_garden',
    label: 'Princess Garden 公主花园',
    nameEn: 'Princess Pastel',
    description: '皇冠/魔杖/蝴蝶结 - 腮红紫薄荷珍珠',
    prompt:
      'Style: princess pastel. Layout: airy sparkle fillers around icons. Colors: blush, lilac, mint and pearl. Elements: tiaras, wands, bows, roses. Vibe: dreamy and elegant.',
    tags: ['公主', '优雅', '梦幻', '图案'],
    category: 'pattern'
  },

  // rainbow_cloud
  rainbow_cloud: {
    id: 'rainbow_cloud',
    label: 'Rainbow Cloud 彩虹云朵',
    nameEn: 'Rainbow Pastel',
    description: '彩虹/云朵/闪光 - 柔和彩虹白底',
    prompt:
      'Style: rainbow pastel. Layout: airy cloud scatter with arcs. Colors: pastel rainbow and white. Elements: rainbows, clouds, sparkles. Vibe: soft and optimistic.',
    tags: ['彩虹', '云朵', '治愈', '图案'],
    category: 'pattern'
  },

  // moon_stars
  moon_stars: {
    id: 'moon_stars',
    label: 'Moon & Stars 月亮星星',
    nameEn: 'Night Kids',
    description: '月亮/星星/彗星 - 藏青金奶油紫',
    prompt:
      'Style: night kids. Layout: scattered moons and stars with dots. Colors: navy, gold, cream and lilac. Elements: crescent moons, stars, comets. Vibe: sleepy and magical.',
    tags: ['月亮', '星星', '夜晚', '图案'],
    category: 'pattern'
  },

  // anime_girl
  anime_girl: {
    id: 'anime_girl',
    label: 'Anime Girl 可爱二次元',
    nameEn: 'Soft Anime Shoujo',
    description: '大眼女主/蝴蝶结 - 柔和粉紫蓝',
    prompt:
      'Style: soft anime shoujo. Layout: large character heads with smaller icons floating around. Colors: pastel pinks, purples and blues. Elements: big-eyed girls, ribbons, sparkles and lace hearts. Vibe: dreamy, pretty and trendy.',
    tags: ['动漫', '少女', '日系', '图案'],
    category: 'pattern'
  },

  // pixel_gamer
  pixel_gamer: {
    id: 'pixel_gamer',
    label: 'Pixel Gamer 像素游戏',
    nameEn: 'Retro Pixel Gamer',
    description: '像素/手柄/文字块 - 霓虹暗底',
    prompt:
      'Style: retro pixel gamer. Layout: almost-grid but slightly broken for organic feel. Colors: neon brights on dark or bright cyan and magenta. Elements: pixel hearts, controllers, 8-bit icons and score blocks. Vibe: arcade, techy and energetic.',
    tags: ['像素', '游戏', '复古', '图案'],
    category: 'pattern'
  },

  // comic_pop
  comic_pop: {
    id: 'comic_pop',
    label: 'Comic Pop 漫画格子',
    nameEn: 'Pop Art Comic',
    description: '对话框/爆炸/网点 - 原色黑线',
    prompt:
      'Style: pop-art comic. Layout: overlapping panels and bursts that still behave as an all-over. Colors: primary red, blue and yellow with black lines. Elements: speech bubbles, pow-bang bursts and halftone dots. Vibe: loud, humorous and graphic.',
    tags: ['漫画', '波普', '图形', '图案'],
    category: 'pattern'
  },

  // autumn_leaves
  autumn_leaves: {
    id: 'autumn_leaves',
    label: 'Autumn Leaves 秋叶',
    nameEn: 'Autumn Kids',
    description: '落叶/橡果/蘑菇 - 锈色芥末橄榄奶油',
    prompt:
      'Style: autumn kids. Layout: leaf scatter with acorns. Colors: rust, mustard, olive, cream. Elements: leaves, acorns, mushrooms. Vibe: warm and natural.',
    tags: ['秋天', '自然', '温暖', '图案'],
    category: 'pattern'
  },

  // spring_bloom
  spring_bloom: {
    id: 'spring_bloom',
    label: 'Spring Bloom 春日花开',
    nameEn: 'Spring Florals',
    description: '花朵/蝴蝶/花蕾 - 腮红紫薄荷柠檬',
    prompt:
      'Style: spring florals. Layout: light blossoms with butterflies. Colors: blush, lilac, mint, lemon. Elements: flowers, buds, butterflies. Vibe: fresh and gentle.',
    tags: ['春天', '花朵', '清新', '图案'],
    category: 'pattern'
  },

  // summer_splash
  summer_splash: {
    id: 'summer_splash',
    label: 'Summer Splash 夏日飞溅',
    nameEn: 'Summer Kids',
    description: '水花/拖鞋/冰棒 - 水蓝阳光黄珊瑚',
    prompt:
      'Style: summer kids. Layout: water splashes with beach icons. Colors: aqua, sunny yellow, coral. Elements: waves, flip-flops, ice lollies. Vibe: bright and fun.',
    tags: ['夏天', '海滩', '清凉', '图案'],
    category: 'pattern'
  },

  // snow_day
  snow_day: {
    id: 'snow_day',
    label: 'Snow Day 下雪啦',
    nameEn: 'Snow Kids',
    description: '雪人/手套/雪橇 - 冰蓝白红点缀',
    prompt:
      'Style: snow kids. Layout: snow dots and winter icons evenly tossed. Colors: icy blues, white, red accents. Elements: snowmen, mittens, sleds. Vibe: cozy and festive.',
    tags: ['冬天', '雪', '节日', '图案'],
    category: 'pattern'
  },

  // butterfly_garden
  butterfly_garden: {
    id: 'butterfly_garden',
    label: 'Butterfly Garden 蝴蝶花园',
    nameEn: 'Butterfly Kids',
    description: '蝴蝶/花朵/闪光 - 柔和翅膀色绿色',
    prompt:
      'Style: butterfly kids. Layout: light flutter scatter with florals. Colors: pastel wings and greens. Elements: butterflies, flowers, sparkles. Vibe: gentle and pretty.',
    tags: ['蝴蝶', '花园', '女童', '图案'],
    category: 'pattern'
  },

  // bug_explorer
  bug_explorer: {
    id: 'bug_explorer',
    label: 'Bug Explorer 小虫探险',
    nameEn: 'Garden Bugs',
    description: '瓢虫/蜻蜓/甲虫 - 草绿红黑阳光黄',
    prompt:
      'Style: garden bugs. Layout: light multi-directional scatter with leaves and dots. Colors: grass green, red, black, sunshine yellow. Elements: ladybugs, dragonflies, beetles. Vibe: curious and bright.',
    tags: ['昆虫', '自然', '探索', '图案'],
    category: 'pattern'
  },

  // space_robots
  space_robots: {
    id: 'space_robots',
    label: 'Space Robots 太空机器人',
    nameEn: 'Tech Kids Robots',
    description: '机器人/齿轮/卫星 - 钴蓝银霓虹绿',
    prompt:
      'Style: tech kids. Layout: semi-structured orbit paths with robot badges. Colors: cobalt, silver, neon green. Elements: robots, gears, satellites. Vibe: futuristic and fun.',
    tags: ['机器人', '科技', '男童', '图案'],
    category: 'pattern'
  },

  // pirate_adventure
  pirate_adventure: {
    id: 'pirate_adventure',
    label: 'Pirate Adventure 海盗冒险',
    nameEn: 'Pirate Kids',
    description: '海盗船/宝藏/骷髅 - 黑红金海蓝',
    prompt:
      'Style: pirate kids. Layout: diagonal motion with maps and ropes. Colors: black, red, gold and ocean blue. Elements: skulls, ships, treasure chests. Vibe: bold and adventurous.',
    tags: ['海盗', '冒险', '男童', '图案'],
    category: 'pattern'
  },

  // knight_castle
  knight_castle: {
    id: 'knight_castle',
    label: 'Knight Castle 骑士城堡',
    nameEn: 'Medieval Play',
    description: '骑士/龙/城堡 - 宝蓝深红金石灰',
    prompt:
      'Style: medieval play. Layout: badges and shields evenly tossed. Colors: royal blue, crimson, gold and stone grey. Elements: knights, dragons, castles. Vibe: heroic and tidy.',
    tags: ['骑士', '冒险', '男童', '图案'],
    category: 'pattern'
  },

  // super_minis
  super_minis: {
    id: 'super_minis',
    label: 'Super Minis 迷你英雄',
    nameEn: 'Mini Superheroes',
    description: '披风/面具/徽章 - 原色明亮黑',
    prompt:
      'Style: mini superhero kids. Layout: action badges and lightning scatter. Colors: primary brights with black. Elements: capes, masks, emblems. Vibe: energetic and clean.',
    tags: ['英雄', '动作', '男童', '图案'],
    category: 'pattern'
  },

  // skate_park
  skate_park: {
    id: 'skate_park',
    label: 'Skate Park 滑板公园',
    nameEn: 'Skate Kids',
    description: '滑板/轮子/涂鸦 - 黑霓虹点缀',
    prompt:
      'Style: skate kids. Layout: dynamic badges with sparks. Colors: black, neon accents. Elements: boards, wheels, graffiti marks. Vibe: edgy and fun.',
    tags: ['滑板', '街头', '潮流', '图案'],
    category: 'pattern'
  },

  // camping_night
  camping_night: {
    id: 'camping_night',
    label: 'Camping Night 露营之夜',
    nameEn: 'Camping Kids',
    description: '帐篷/篝火/灯笼 - 深绿藏青棕褐',
    prompt:
      'Style: camping kids. Layout: tents and badges under stars. Colors: deep green, navy, tan. Elements: tents, fires, lanterns. Vibe: cozy and adventurous.',
    tags: ['露营', '自然', '冒险', '图案'],
    category: 'pattern'
  },

  // bee_buzz
  bee_buzz: {
    id: 'bee_buzz',
    label: 'Bee Buzz 小蜜蜂',
    nameEn: 'Bee Kids',
    description: '蜜蜂/蜂巢/花朵 - 黄黑白',
    prompt:
      'Style: bee kids. Layout: honeycomb hints with bees. Colors: yellow, black, white. Elements: bees, hives, flowers. Vibe: busy and friendly.',
    tags: ['蜜蜂', '自然', '可爱', '图案'],
    category: 'pattern'
  },

  // sunshine_smile
  sunshine_smile: {
    id: 'sunshine_smile',
    label: 'Sunshine Smile 阳光笑脸',
    nameEn: 'Smiley Sun',
    description: '笑脸/太阳/光芒 - 向日葵黄橙天蓝',
    prompt:
      'Style: smile icons. Layout: medium density face icons with tiny stars. Colors: sunflower yellow, orange, sky blue. Elements: smiley faces, suns, rays. Vibe: bright and cheerful.',
    tags: ['笑脸', '阳光', '快乐', '图案'],
    category: 'pattern'
  },

  // watercolor_soft
  watercolor_soft: {
    id: 'watercolor_soft',
    label: 'Watercolor Soft 水彩柔和',
    nameEn: 'Soft Watercolor',
    description: '水彩/花朵/小动物 - 柔和水彩淡色',
    prompt:
      'Style: soft watercolor. Layout: airy clusters with gentle edges. Colors: pale pastels, diluted brights. Elements: clouds, florals, small animals. Vibe: dreamy and calm.',
    tags: ['水彩', '柔和', '艺术', '图案'],
    category: 'pattern'
  },

  // trex_kids
  trex_kids: {
    id: 'trex_kids',
    label: 'Trex Kids 霸王龙童趣',
    nameEn: 'T-Rex Kids',
    description: '霸王龙/骨头/脚印 - 绿橙黑',
    prompt:
      'Style: T-rex kids. Layout: bold dino heads with tracks. Colors: green, orange, black. Elements: T-rex, bones, footprints. Vibe: loud and fun.',
    tags: ['恐龙', '霸王龙', '男童', '图案'],
    category: 'pattern'
  },

  // baby_icons
  baby_icons: {
    id: 'baby_icons',
    label: 'Baby Icons 婴童图标',
    nameEn: 'Baby Icons',
    description: '奶瓶/摇铃/云朵 - 奶白腮红薄荷',
    prompt:
      'Style: baby icons. Layout: pacifiers and toys tossed. Colors: milk white, blush, mint. Elements: bottles, rattles, clouds. Vibe: gentle and clean.',
    tags: ['婴童', '简约', '柔和', '图案'],
    category: 'pattern'
  },

  // fairground
  fairground: {
    id: 'fairground',
    label: 'Fairground 嘉年华',
    nameEn: 'Fair Kids',
    description: '旋转木马/气球/门票 - 明亮白底',
    prompt:
      'Style: fair kids. Layout: rides and treats tossed. Colors: brights and whites. Elements: carousels, balloons, tickets. Vibe: joyful and dense.',
    tags: ['嘉年华', '游乐场', '欢乐', '图案'],
    category: 'pattern'
  },

  // sticker_collage
  sticker_collage: {
    id: 'sticker_collage',
    label: 'Sticker Collage 贴纸拼贴',
    nameEn: 'Sticker Bomb',
    description: '标签/标记/图标 - 混合明亮',
    prompt:
      'Style: sticker-bomb. Layout: overlapping sticker clusters. Colors: mixed brights. Elements: labels, tags, icons. Vibe: chaotic but readable.',
    tags: ['贴纸', '拼贴', '潮流', '图案'],
    category: 'pattern'
  },

  // emoji_party
  emoji_party: {
    id: 'emoji_party',
    label: 'Emoji Party 表情派对',
    nameEn: 'Emoji Kids',
    description: '表情/爱心/星星 - 黄底明亮色',
    prompt:
      'Style: emoji kids. Layout: medium density faces with stickers. Colors: yellow base with brights. Elements: emojis, hearts, stars. Vibe: humorous and simple.',
    tags: ['表情', '趣味', '简单', '图案'],
    category: 'pattern'
  },

  // galaxy_gradient
  galaxy_gradient: {
    id: 'galaxy_gradient',
    label: 'Galaxy Gradient 星系渐变',
    nameEn: 'Space Gradient',
    description: '星系/星球/彗星 - 深蓝霓虹渐变',
    prompt:
      'Style: space gradient. Layout: full all-over star field with icons. Colors: deep navy to neon gradient. Elements: planets, rings, comets. Vibe: dreamy and techy.',
    tags: ['星系', '渐变', '科幻', '图案'],
    category: 'pattern'
  },

  // hologram_dream
  hologram_dream: {
    id: 'hologram_dream',
    label: 'Hologram Dream 全息梦境',
    nameEn: 'Holographic Kids',
    description: '宝石/星星/碎片 - 珍珠彩虹',
    prompt:
      'Style: holographic kids. Layout: airy motifs with rainbow sheen hint. Colors: pearl rainbow. Elements: gems, stars, shards. Vibe: magical and sleek.',
    tags: ['全息', '梦幻', '潮流', '图案'],
    category: 'pattern'
  },

  // ========== 艺术文化 (artistic) ==========
  vintage_floral: {
    id: 'vintage_floral',
    label: 'Vintage Floral 复古碎花',
    nameEn: 'Vintage Floral',
    description: '细碎/怀旧/柔和 - 莫兰迪色系',
    prompt:
      'Style: vintage floral print. Layout: dense, ditsy all-over repeat. Colors: muted morandi tones, dusty rose, sage green. Elements: small wild flowers, leaves, buds. Vibe: nostalgic, romantic and soft.',
    tags: ['复古', '花朵', '碎花', '田园', '图案'],
    category: 'pattern'
  },

  tropical_jungle: {
    id: 'tropical_jungle',
    label: 'Tropical Jungle 热带雨林',
    nameEn: 'Tropical Jungle',
    description: '龟背竹/鹦鹉/大叶 - 浓郁绿金',
    prompt:
      'Style: lush tropical jungle. Layout: large scale overlapping foliage. Colors: deep emerald greens, vibrant yellow and splashes of bright exotic flowers. Elements: monstera leaves, palm fronds, parrots, hibiscus. Vibe: exotic, summer and vibrant.',
    tags: ['热带', '植物', '夏天', '度假', '图案'],
    category: 'pattern'
  },

  mandala_art: {
    id: 'mandala_art',
    label: 'Mandala Art 曼陀罗',
    nameEn: 'Boho Mandala',
    description: '放射/对称/繁复 - 宝石色金',
    prompt:
      'Style: bohemian mandala. Layout: intricate circular kaleidoscopic patterns. Colors: jewel tones with gold accents. Elements: geometric floral petals, dots, intricate line work. Vibe: spiritual, complex and mesmerizing.',
    tags: ['曼陀罗', '波西米亚', '民族', '艺术', '图案'],
    category: 'pattern'
  },

  nordic_knit: {
    id: 'nordic_knit',
    label: 'Nordic Knit 北欧针织',
    nameEn: 'Nordic Fair Isle',
    description: '雪花/几何/条纹 - 红白蓝灰',
    prompt:
      'Style: nordic fair isle knit. Layout: horizontal bands of pixelated motifs. Colors: classic red, white, navy and grey. Elements: snowflakes, reindeer, geometric zigzags. Vibe: cozy, winter and traditional.',
    tags: ['北欧', '针织', '冬季', '传统', '图案'],
    category: 'pattern'
  },

  japanese_wave: {
    id: 'japanese_wave',
    label: 'Japanese Wave 日式海浪',
    nameEn: 'Seigaiha Wave',
    description: '扇形/重叠/传统 - 靛蓝白',
    prompt:
      'Style: traditional japanese seigaiha. Layout: overlapping concentric arches forming waves. Colors: indigo blue and white. Elements: geometric wave scales. Vibe: classic, serene and cultural.',
    tags: ['日式', '海浪', '传统', '纹样', '图案'],
    category: 'pattern'
  },

  // ========== 现代科技 (commercial) ==========
  cyber_grid: {
    id: 'cyber_grid',
    label: 'Cyber Grid 赛博网格',
    nameEn: 'Cyberpunk Grid',
    description: '网格/透视/发光 - 霓虹黑紫',
    prompt:
      'Style: cyberpunk digital grid. Layout: distorted or perspective wireframe mesh. Colors: black background with neon cyan and magenta lines. Elements: grids, data streams, glitches. Vibe: futuristic, tech and digital.',
    tags: ['赛博朋克', '科技', '网格', '未来', '图案'],
    category: 'pattern'
  },

  vaporwave: {
    id: 'vaporwave',
    label: 'Vaporwave 蒸汽波',
    nameEn: 'Vaporwave Aesthetic',
    description: '雕塑/椰树/故障 - 粉蓝渐变',
    prompt:
      'Style: 80s vaporwave aesthetic. Layout: collage of surreal elements. Colors: pastel pink and blue gradients. Elements: greek statues, palm trees, windows 95 UI, grid floors. Vibe: retro-futuristic, surreal and nostalgic.',
    tags: ['蒸汽波', '复古', '艺术', '潮流', '图案'],
    category: 'pattern'
  },

  // ========== 材质纹理 (lifestyle) ==========
  terrazzo_stone: {
    id: 'terrazzo_stone',
    label: 'Terrazzo 水磨石',
    nameEn: 'Terrazzo Stone',
    description: '碎石/不规则/斑点 - 莫兰迪混色',
    prompt:
      'Style: modern terrazzo texture. Layout: random scattered irregular chips. Colors: white base with chips of terracotta, sage, ochre and grey. Elements: stone fragments, confetti shapes. Vibe: architectural, modern and textured.',
    tags: ['水磨石', '纹理', '现代', '极简', '图案'],
    category: 'pattern'
  },

  marble_ink: {
    id: 'marble_ink',
    label: 'Marble Ink 大理石墨流',
    nameEn: 'Liquid Marble',
    description: '流动/晕染/金箔 - 黑白金',
    prompt:
      'Style: liquid marble ink. Layout: fluid swirling organic lines. Colors: black, white and gold veins. Elements: ink swirls, fluid distortions, metallic cracks. Vibe: elegant, luxurious and organic.',
    tags: ['大理石', '流体', '艺术', '奢华', '图案'],
    category: 'pattern'
  },

  denim_patch: {
    id: 'denim_patch',
    label: 'Denim Patch 牛仔拼贴',
    nameEn: 'Denim Patchwork',
    description: '牛仔/缝线/做旧 - 蓝靛白',
    prompt:
      'Style: denim patchwork. Layout: geometric blocks of different denim washes. Colors: various shades of indigo, blue and bleached white. Elements: fabric texture, stitch lines, frayed edges. Vibe: casual, textured and cool.',
    tags: ['牛仔', '拼贴', '复古', '材质', '图案'],
    category: 'pattern'
  },

  // ========== 更多童趣 (pattern) ==========
  robot_factory: {
    id: 'robot_factory',
    label: 'Robot Factory 机器人工厂',
    nameEn: 'Retro Robots',
    description: '机器人/齿轮/螺丝 - 原色金属',
    prompt:
      'Style: retro robot factory. Layout: tossed toy robots and mechanical parts. Colors: primary red, blue, yellow and silver. Elements: square robots, gears, wrenches, bolts. Vibe: mechanical, playful and boyish.',
    tags: ['机器人', '机械', '男童', '复古', '图案'],
    category: 'pattern'
  },

  monster_trucks: {
    id: 'monster_trucks',
    label: 'Monster Trucks 怪兽卡车',
    nameEn: 'Monster Truck Rally',
    description: '大轮车/泥土/旗帜 - 橙黑绿',
    prompt:
      'Style: monster truck rally. Layout: dynamic action poses of big-wheeled trucks. Colors: bright orange, lime green, black and mud brown. Elements: big trucks, tires, checkered flags, mud splatters. Vibe: loud, messy and exciting.',
    tags: ['卡车', '赛车', '男童', '运动', '图案'],
    category: 'pattern'
  },

  magic_potions: {
    id: 'magic_potions',
    label: 'Magic Potions 魔法药水',
    nameEn: 'Magic Witchy',
    description: '药瓶/水晶/星星 - 紫黑荧光',
    prompt:
      'Style: cute witchy magic. Layout: tossed magical objects. Colors: deep purple, black, neon green and stardust gold. Elements: potion bottles, crystals, spell books, stars. Vibe: mysterious, cute and magical.',
    tags: ['魔法', '万圣节', '神秘', '女童', '图案'],
    category: 'pattern'
  },

  // ========== 商业包装 (commercial) ==========
  memphis_pop: {
    id: 'memphis_pop',
    label: 'Memphis Pop 孟菲斯',
    nameEn: 'Memphis Design',
    description: '几何/波普/错位 - 高饱和撞色',
    prompt:
      'Style: 80s memphis design group. Layout: scattered geometric shapes, squiggles and bacteria patterns. Colors: cyan, magenta, yellow and black. Elements: triangles, zigzags, confetti. Vibe: fun, postmodern and graphic.',
    tags: ['孟菲斯', '波普', '80年代', '设计', '图案'],
    category: 'commercial'
  },

  bauhaus_abstract: {
    id: 'bauhaus_abstract',
    label: 'Bauhaus Abstract 包豪斯',
    nameEn: 'Bauhaus Geometric',
    description: '构成/平衡/理性 - 红黄蓝黑白',
    prompt:
      'Style: bauhaus school design. Layout: balanced geometric composition. Colors: primary red, yellow, blue with black and white. Elements: circles, squares, lines, arcs. Vibe: minimal, architectural and modern.',
    tags: ['包豪斯', '几何', '现代', '艺术', '图案'],
    category: 'commercial'
  },

  art_deco_glam: {
    id: 'art_deco_glam',
    label: 'Art Deco Glam 装饰艺术',
    nameEn: 'Art Deco Luxury',
    description: '扇形/线条/金属 - 黑金铜',
    prompt:
      'Style: roaring 20s art deco. Layout: symmetrical fan shapes and sunbursts. Colors: black, gold, bronze and emerald. Elements: geometric fans, stepped lines, palm leaves. Vibe: luxurious, vintage and elegant.',
    tags: ['装饰艺术', '奢华', '复古', '金', '图案'],
    category: 'commercial'
  },

  mid_century_mod: {
    id: 'mid_century_mod',
    label: 'Mid-Century MCM 中世纪',
    nameEn: 'Mid-Century Modern',
    description: '有机/回旋镖/星爆 - 芥末橄榄',
    prompt:
      'Style: mid-century modern atomic. Layout: atomic starbursts and organic kidneys. Colors: mustard yellow, olive green, teal and orange. Elements: boomerangs, starbursts, ellipses. Vibe: retro, classic and stylish.',
    tags: ['中世纪', '复古', '50年代', '经典', '图案'],
    category: 'commercial'
  },

  // ========== 自然生态 (pattern) ==========
  botanical_fern: {
    id: 'botanical_fern',
    label: 'Botanical Fern 蕨类植物',
    nameEn: 'Botanical Ferns',
    description: '蕨叶/细致/科学 - 深浅绿',
    prompt:
      'Style: vintage botanical illustration. Layout: elegant arrangement of fern fronds. Colors: various shades of forest and sage green on cream. Elements: detailed fern leaves, spores, stems. Vibe: natural, scientific and calm.',
    tags: ['植物', '自然', '复古', '森系', '图案'],
    category: 'pattern'
  },

  succulent_garden: {
    id: 'succulent_garden',
    label: 'Succulent Garden 多肉花园',
    nameEn: 'Succulent Cactus',
    description: '仙人掌/多肉/盆栽 - 灰绿粉',
    prompt:
      'Style: watercolor succulents. Layout: tossed potted plants and cacti. Colors: sage green, dusty pink, terracotta. Elements: cactus, aloe, echeveria, clay pots. Vibe: trendy, fresh and green.',
    tags: ['植物', '多肉', '清新', '生活', '图案'],
    category: 'pattern'
  },

  mushroom_forest: {
    id: 'mushroom_forest',
    label: 'Mushroom Forest 蘑菇森林',
    nameEn: 'Mushroom Forage',
    description: '蘑菇/苔藓/奇幻 - 红褐绿',
    prompt:
      'Style: cottagecore mushroom illustration. Layout: clusters of forest floor life. Colors: red, brown, moss green and cream. Elements: toadstools, chanterelles, ferns, moss. Vibe: earthy, magical and cozy.',
    tags: ['蘑菇', '森林', '田园', '奇幻', '图案'],
    category: 'pattern'
  },

  ocean_coral: {
    id: 'ocean_coral',
    label: 'Ocean Coral 珊瑚礁',
    nameEn: 'Coral Reef',
    description: '珊瑚/海草/鱼 - 珊瑚粉海蓝',
    prompt:
      'Style: underwater coral reef. Layout: dense organic textures of sea life. Colors: living coral, turquoise, pink and yellow. Elements: brain coral, sea fans, small fish. Vibe: vibrant, marine and organic.',
    tags: ['海洋', '珊瑚', '自然', '夏天', '图案'],
    category: 'pattern'
  },

  // ========== 传统纹样 (artistic) ==========
  william_morris: {
    id: 'william_morris',
    label: 'William Morris 莫里斯',
    nameEn: 'Arts and Crafts',
    description: '藤蔓/花鸟/繁复 - 靛蓝深红',
    prompt:
      'Style: william morris arts and crafts. Layout: intricate symmetrical intertwining vines. Colors: indigo, crimson, olive and ochre. Elements: acanthus leaves, strawberry thieves, trellis. Vibe: classic, historical and ornate.',
    tags: ['艺术', '复古', '花卉', '经典', '图案'],
    category: 'artistic'
  },

  chinoiserie_blue: {
    id: 'chinoiserie_blue',
    label: 'Chinoiserie Blue 青花瓷',
    nameEn: 'Blue Willow',
    description: '亭台/柳树/飞鸟 - 蓝白',
    prompt:
      'Style: traditional chinoiserie porcelain. Layout: toile de jouy scenes. Colors: cobalt blue on porcelain white. Elements: pagodas, willow trees, bridges, birds. Vibe: oriental, delicate and traditional.',
    tags: ['中国风', '青花瓷', '传统', '东方', '图案'],
    category: 'artistic'
  },

  paisley_print: {
    id: 'paisley_print',
    label: 'Paisley Print 佩斯利',
    nameEn: 'Boho Paisley',
    description: '腰果花/泪滴/旋涡 - 红紫金',
    prompt:
      'Style: intricate paisley textile. Layout: dense swirling teardrop motifs. Colors: rich red, purple, gold and teal. Elements: buta shapes, floral fillers, curved lines. Vibe: bohemian, ethnic and classic.',
    tags: ['佩斯利', '波西米亚', '民族', '复古', '图案'],
    category: 'artistic'
  },

  aztec_tribal: {
    id: 'aztec_tribal',
    label: 'Aztec Tribal 阿兹特克',
    nameEn: 'Aztec Geometric',
    description: '三角/菱形/锯齿 - 陶土黑白',
    prompt:
      'Style: aztec navajo tribal. Layout: horizontal geometric bands. Colors: terracotta, black, white and turquoise. Elements: diamonds, triangles, steps, arrows. Vibe: ethnic, geometric and bold.',
    tags: ['民族', '几何', '部落', '图腾', '图案'],
    category: 'artistic'
  },

  // ========== 材质拟真 (lifestyle) ==========
  knitted_texture: {
    id: 'knitted_texture',
    label: 'Knitted Texture 粗针织',
    nameEn: 'Chunky Knit',
    description: '麻花/针脚/温暖 - 米白灰',
    prompt:
      'Style: realistic chunky cable knit. Layout: vertical cable braids. Colors: oatmeal, cream, light grey. Elements: yarn texture, interlocking loops, ribbed edges. Vibe: cozy, winter and tactile.',
    tags: ['针织', '纹理', '冬季', '温暖', '图案'],
    category: 'lifestyle'
  },

  wood_grain: {
    id: 'wood_grain',
    label: 'Wood Grain 木纹',
    nameEn: 'Natural Wood',
    description: '年轮/纹理/自然 - 橡木胡桃',
    prompt:
      'Style: natural wood grain texture. Layout: flowing organic lines and knots. Colors: oak, walnut, pine shades. Elements: tree rings, vertical grain, knots. Vibe: rustic, natural and warm.',
    tags: ['木纹', '自然', '材质', '极简', '图案'],
    category: 'lifestyle'
  },

  leather_texture: {
    id: 'leather_texture',
    label: 'Leather Texture 皮革',
    nameEn: 'Leather Grain',
    description: '荔枝纹/质感/奢华 - 棕褐黑',
    prompt:
      'Style: realistic leather texture. Layout: pebbled grain surface. Colors: cognac brown, tan or black. Elements: skin pores, wrinkles, sheen. Vibe: classic, masculine and premium.',
    tags: ['皮革', '材质', '奢华', '经典', '图案'],
    category: 'lifestyle'
  },

  denim_texture: {
    id: 'denim_texture',
    label: 'Denim Texture 牛仔布',
    nameEn: 'Blue Jeans',
    description: '斜纹/水洗/织物 - 靛蓝',
    prompt:
      'Style: denim fabric texture. Layout: diagonal twill weave. Colors: indigo blue with white threads. Elements: fabric weave, slight fading, texture. Vibe: casual, rugged and classic.',
    tags: ['牛仔', '材质', '休闲', '基础', '图案'],
    category: 'lifestyle'
  },

  // ========== 节日庆典 (pattern) ==========
  easter_bunny: {
    id: 'easter_bunny',
    label: 'Easter Bunny 复活节',
    nameEn: 'Easter Spring',
    description: '兔子/彩蛋/花 - 柔和粉黄',
    prompt:
      'Style: cute easter spring. Layout: tossed bunnies and eggs. Colors: pastel pink, yellow, mint and lilac. Elements: rabbits, decorated eggs, chicks, tulips. Vibe: festive, spring and sweet.',
    tags: ['复活节', '节日', '兔子', '春天', '图案'],
    category: 'pattern'
  },

  valentine_love: {
    id: 'valentine_love',
    label: 'Valentine Love 情人节',
    nameEn: 'Romantic Hearts',
    description: '爱心/丘比特/玫瑰 - 红粉白',
    prompt:
      'Style: romantic valentine hearts. Layout: dense scattered hearts. Colors: red, pink, white and gold. Elements: hearts, cupid arrows, roses, lips. Vibe: romantic, sweet and passionate.',
    tags: ['情人节', '爱心', '浪漫', '节日', '图案'],
    category: 'pattern'
  },

  lunar_new_year: {
    id: 'lunar_new_year',
    label: 'Lunar New Year 春节',
    nameEn: 'Chinese New Year',
    description: '灯笼/生肖/元宝 - 红金',
    prompt:
      'Style: festive chinese new year. Layout: traditional lucky symbols. Colors: lucky red and gold. Elements: lanterns, zodiac animals, coins, knots, clouds. Vibe: celebratory, lucky and traditional.',
    tags: ['春节', '中国风', '节日', '喜庆', '图案'],
    category: 'pattern'
  },

  st_patricks: {
    id: 'st_patricks',
    label: 'St Patricks 圣帕特里克',
    nameEn: 'Lucky Clover',
    description: '三叶草/金币/绿帽 - 凯尔特绿',
    prompt:
      'Style: st patricks day lucky. Layout: tossed shamrocks. Colors: kelly green, lime, gold and white. Elements: four leaf clovers, horseshoes, leprechaun hats, gold coins. Vibe: lucky, green and fun.',
    tags: ['节日', '幸运', '绿色', '植物', '图案'],
    category: 'pattern'
  },

  // ========== 流行趋势 (Trending & Viral) ==========
  coquette_bows: {
    id: 'coquette_bows',
    label: 'Coquette Bows 少女蝴蝶结',
    nameEn: 'Coquette Balletcore',
    description: '蝴蝶结/蕾丝/珍珠 - 柔粉奶白',
    prompt:
      'Style: coquette balletcore aesthetic. Layout: tossed satin bows and pearls. Colors: soft baby pink, cream, white and gold. Elements: ribbons, lace trim, pearls, roses. Vibe: hyper-feminine, delicate and romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', '图案'],
    category: 'lifestyle'
  },

  mob_wife_leopard: {
    id: 'mob_wife_leopard',
    label: 'Mob Wife Leopard 豪门豹纹',
    nameEn: 'Mob Wife Aesthetic',
    description: '豹纹/皮草/金饰 - 棕黑金',
    prompt:
      'Style: mob wife aesthetic. Layout: dense realistic leopard print mixed with chain details. Colors: rich browns, black, gold and beige. Elements: leopard spots, gold chains, fur texture. Vibe: maximalist, glamorous and bold.',
    tags: ['豹纹', '奢华', '复古', '流行', '图案'],
    category: 'lifestyle'
  },

  eclectic_grandpa: {
    id: 'eclectic_grandpa',
    label: 'Eclectic Grandpa 复古爷爷风',
    nameEn: 'Eclectic Grandpa',
    description: '菱格/混搭/针织 - 墨绿棕芥末',
    prompt:
      'Style: eclectic grandpa core. Layout: patchwork of argyle and retro knits. Colors: forest green, mustard, brown and navy. Elements: argyle diamonds, plaid checks, knit textures. Vibe: retro, cozy and nostalgic.',
    tags: ['复古', '针织', '穿搭', '流行', '图案'],
    category: 'lifestyle'
  },

  cyber_sigilism: {
    id: 'cyber_sigilism',
    label: 'Cyber Sigilism 赛博图腾',
    nameEn: 'Cyber Sigilism',
    description: '图腾/液态/金属 - 银黑霓虹',
    prompt:
      'Style: cyber sigilism y2k. Layout: aggressive sharp tribal lines and chrome shapes. Colors: metallic silver, black, neon blue. Elements: tribal tattoos, liquid metal, thorns, chrome hearts. Vibe: edgy, futuristic and dark.',
    tags: ['赛博', '图腾', 'Y2K', '流行', '图案'],
    category: 'artistic'
  },

  dopamine_swirls: {
    id: 'dopamine_swirls',
    label: 'Dopamine Swirls 多巴胺漩涡',
    nameEn: 'Dopamine Psychedelic',
    description: '漩涡/波浪/变形 - 彩虹高饱和',
    prompt:
      'Style: dopamine psychedelic swirls. Layout: warped liquid waves and distorted checks. Colors: saturated rainbow brights, pink, orange, lime. Elements: melting smileys, groovy waves, optical illusions. Vibe: trippy, happy and loud.',
    tags: ['多巴胺', '漩涡', '迷幻', '流行', '图案'],
    category: 'artistic'
  },

  old_money_tweed: {
    id: 'old_money_tweed',
    label: 'Old Money Tweed 老钱风',
    nameEn: 'Old Money Tweed',
    description: '粗花呢/千鸟格 - 黑白米金',
    prompt:
      'Style: old money tweed texture. Layout: classic houndstooth or bouclé weave. Colors: black, white, beige and gold thread. Elements: woven texture, pearl buttons, chain trim. Vibe: wealthy, classic and minimal.',
    tags: ['老钱', '轻奢', '材质', '流行', '图案'],
    category: 'lifestyle'
  },

  gorpcore_tech: {
    id: 'gorpcore_tech',
    label: 'Gorpcore Tech 户外机能',
    nameEn: 'Gorpcore Technical',
    description: '等高线/迷彩/网格 - 大地灰机能黑',
    prompt:
      'Style: gorpcore technical. Layout: topographic map lines and ripstop grid. Colors: olive green, slate grey, black and safety orange. Elements: topo lines, carabiners, paracord, mesh. Vibe: functional, outdoorsy and cool.',
    tags: ['户外', '机能', '露营', '流行', '图案'],
    category: 'lifestyle'
  },

  office_siren: {
    id: 'office_siren',
    label: 'Office Siren 职场海妖',
    nameEn: 'Office Siren',
    description: '条纹/眼镜/极简 - 灰黑酒红',
    prompt:
      'Style: office siren aesthetic. Layout: sharp pinstripes and sleek minimalism. Colors: charcoal grey, black, burgundy and silver. Elements: pinstripes, glasses frames, sleek lines, latex hints. Vibe: sharp, sexy and corporate.',
    tags: ['职场', '极简', '性感', '流行', '图案'],
    category: 'lifestyle'
  },

  cowgirl_western: {
    id: 'cowgirl_western',
    label: 'Cowgirl Western 西部牛仔',
    nameEn: 'Coastal Cowgirl',
    description: '奶牛纹/靴子/流苏 - 棕白粉',
    prompt:
      'Style: coastal cowgirl western. Layout: tossed boots and hats with cow print. Colors: saddle brown, white, soft pink and denim blue. Elements: cowboy boots, hats, horseshoes, cow spots, stars. Vibe: rustic, cute and spirited.',
    tags: ['西部', '牛仔', '复古', '流行', '图案'],
    category: 'lifestyle'
  },

  barbie_glam: {
    id: 'barbie_glam',
    label: 'Barbie Glam 芭比粉',
    nameEn: 'Barbiecore',
    description: '粉红/闪光/Logo - 亮粉玫红',
    prompt:
      'Style: barbiecore glam. Layout: logo monogram or sparkle repeat. Colors: hot pink, magenta, white and glitter. Elements: silhouettes, heels, sparkles, hearts. Vibe: plastic, fantastic and girly.',
    tags: ['芭比', '粉色', '少女', '流行', '图案'],
    category: 'lifestyle'
  },

  goblincore_nature: {
    id: 'goblincore_nature',
    label: 'Goblincore Nature 哥布林森系',
    nameEn: 'Goblincore',
    description: '苔藓/青蛙/菌类 - 墨绿泥褐',
    prompt:
      'Style: goblincore nature. Layout: chaotic forest floor scatter. Colors: moss green, mud brown, mushroom beige. Elements: frogs, snails, moss, rocks, bones, mushrooms. Vibe: swampy, feral and natural.',
    tags: ['森系', '自然', '怪诞', '流行', '图案'],
    category: 'pattern'
  },

  cherry_girl: {
    id: 'cherry_girl',
    label: 'Cherry Girl 樱桃少女',
    nameEn: 'Cherry Aesthetic',
    description: '樱桃/格纹/复古 - 红白绿',
    prompt:
      'Style: vintage cherry aesthetic. Layout: tossed cherries on gingham check. Colors: bright red, leaf green, white and picnic blue. Elements: twin cherries, leaves, gingham, bows. Vibe: sweet, retro and picnic.',
    tags: ['樱桃', '水果', '复古', '流行', '图案'],
    category: 'pattern'
  },
  // Generated Trend Presets 2025
  // coquette_pearl_strings_1
  coquette_pearl_strings_1: {
    id: 'coquette_pearl_strings_1',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 1',
    description: 'pearl strings/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: dense lace repeat. Colors: mocha. Elements: pearl strings, swans. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_swans_2
  coquette_swans_2: {
    id: 'coquette_swans_2',
    label: 'Coquette Swans',
    nameEn: 'Coquette Swans 2',
    description: 'swans/pearl strings - baby pink',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: dense lace repeat. Colors: baby pink. Elements: swans, pearl strings. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_3
  coquette_lace_trim_3: {
    id: 'coquette_lace_trim_3',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 3',
    description: 'lace trim/hearts - lilac',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: dense lace repeat. Colors: lilac. Elements: lace trim, hearts. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_4
  coquette_roses_4: {
    id: 'coquette_roses_4',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 4',
    description: 'roses/lace trim - baby pink',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: dense lace repeat. Colors: baby pink. Elements: roses, lace trim. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_5
  coquette_roses_5: {
    id: 'coquette_roses_5',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 5',
    description: 'roses/ballet shoes - cream',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: tossed bows. Colors: cream. Elements: roses, ballet shoes. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_6
  coquette_hearts_6: {
    id: 'coquette_hearts_6',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 6',
    description: 'hearts/pearl strings - powder blue',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: tossed bows. Colors: powder blue. Elements: hearts, pearl strings. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_7
  coquette_ballet_shoes_7: {
    id: 'coquette_ballet_shoes_7',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 7',
    description: 'ballet shoes/roses - mocha',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: tossed bows. Colors: mocha. Elements: ballet shoes, roses. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_8
  coquette_hearts_8: {
    id: 'coquette_hearts_8',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 8',
    description: 'hearts/pearl strings - baby pink',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: tossed bows. Colors: baby pink. Elements: hearts, pearl strings. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_9
  coquette_lace_trim_9: {
    id: 'coquette_lace_trim_9',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 9',
    description: 'lace trim/roses - powder blue',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: tossed bows. Colors: powder blue. Elements: lace trim, roses. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_10
  coquette_ballet_shoes_10: {
    id: 'coquette_ballet_shoes_10',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 10',
    description: 'ballet shoes/hearts - mocha',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: dense lace repeat. Colors: mocha. Elements: ballet shoes, hearts. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_satin_bows_11
  coquette_satin_bows_11: {
    id: 'coquette_satin_bows_11',
    label: 'Coquette Satin Bows',
    nameEn: 'Coquette Satin Bows 11',
    description: 'satin bows/ballet shoes - lilac',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: tossed bows. Colors: lilac. Elements: satin bows, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_12
  coquette_hearts_12: {
    id: 'coquette_hearts_12',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 12',
    description: 'hearts/ballet shoes - mocha',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: scattered pearls. Colors: mocha. Elements: hearts, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_swans_13
  coquette_swans_13: {
    id: 'coquette_swans_13',
    label: 'Coquette Swans',
    nameEn: 'Coquette Swans 13',
    description: 'swans/pearl strings - mocha',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: scattered pearls. Colors: mocha. Elements: swans, pearl strings. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_14
  coquette_roses_14: {
    id: 'coquette_roses_14',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 14',
    description: 'roses/hearts - lilac',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: tossed bows. Colors: lilac. Elements: roses, hearts. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_15
  coquette_ballet_shoes_15: {
    id: 'coquette_ballet_shoes_15',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 15',
    description: 'ballet shoes/lace trim - powder blue',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: dense lace repeat. Colors: powder blue. Elements: ballet shoes, lace trim. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_16
  coquette_pearl_strings_16: {
    id: 'coquette_pearl_strings_16',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 16',
    description: 'pearl strings/hearts - mocha',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: scattered pearls. Colors: mocha. Elements: pearl strings, hearts. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_swans_17
  coquette_swans_17: {
    id: 'coquette_swans_17',
    label: 'Coquette Swans',
    nameEn: 'Coquette Swans 17',
    description: 'swans/roses - baby pink',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: scattered pearls. Colors: baby pink. Elements: swans, roses. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_18
  coquette_pearl_strings_18: {
    id: 'coquette_pearl_strings_18',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 18',
    description: 'pearl strings/roses - powder blue',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: dense lace repeat. Colors: powder blue. Elements: pearl strings, roses. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_19
  coquette_hearts_19: {
    id: 'coquette_hearts_19',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 19',
    description: 'hearts/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: scattered pearls. Colors: mocha. Elements: hearts, swans. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_20
  coquette_pearl_strings_20: {
    id: 'coquette_pearl_strings_20',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 20',
    description: 'pearl strings/satin bows - cream',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: scattered pearls. Colors: cream. Elements: pearl strings, satin bows. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_21
  coquette_ballet_shoes_21: {
    id: 'coquette_ballet_shoes_21',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 21',
    description: 'ballet shoes/pearl strings - powder blue',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: tossed bows. Colors: powder blue. Elements: ballet shoes, pearl strings. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_22
  coquette_lace_trim_22: {
    id: 'coquette_lace_trim_22',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 22',
    description: 'lace trim/satin bows - baby pink',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: tossed bows. Colors: baby pink. Elements: lace trim, satin bows. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_23
  coquette_hearts_23: {
    id: 'coquette_hearts_23',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 23',
    description: 'hearts/lace trim - baby pink',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: tossed bows. Colors: baby pink. Elements: hearts, lace trim. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_swans_24
  coquette_swans_24: {
    id: 'coquette_swans_24',
    label: 'Coquette Swans',
    nameEn: 'Coquette Swans 24',
    description: 'swans/roses - lilac',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: tossed bows. Colors: lilac. Elements: swans, roses. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_25
  coquette_ballet_shoes_25: {
    id: 'coquette_ballet_shoes_25',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 25',
    description: 'ballet shoes/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: tossed bows. Colors: mocha. Elements: ballet shoes, swans. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_satin_bows_26
  coquette_satin_bows_26: {
    id: 'coquette_satin_bows_26',
    label: 'Coquette Satin Bows',
    nameEn: 'Coquette Satin Bows 26',
    description: 'satin bows/lace trim - white',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: dense lace repeat. Colors: white. Elements: satin bows, lace trim. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_27
  coquette_hearts_27: {
    id: 'coquette_hearts_27',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 27',
    description: 'hearts/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: tossed bows. Colors: mocha. Elements: hearts, swans. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_28
  coquette_roses_28: {
    id: 'coquette_roses_28',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 28',
    description: 'roses/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: dense lace repeat. Colors: mocha. Elements: roses, swans. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_29
  coquette_lace_trim_29: {
    id: 'coquette_lace_trim_29',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 29',
    description: 'lace trim/swans - white',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: tossed bows. Colors: white. Elements: lace trim, swans. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_30
  coquette_ballet_shoes_30: {
    id: 'coquette_ballet_shoes_30',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 30',
    description: 'ballet shoes/satin bows - lilac',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: tossed bows. Colors: lilac. Elements: ballet shoes, satin bows. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_satin_bows_31
  coquette_satin_bows_31: {
    id: 'coquette_satin_bows_31',
    label: 'Coquette Satin Bows',
    nameEn: 'Coquette Satin Bows 31',
    description: 'satin bows/ballet shoes - cream',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: dense lace repeat. Colors: cream. Elements: satin bows, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_32
  coquette_lace_trim_32: {
    id: 'coquette_lace_trim_32',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 32',
    description: 'lace trim/satin bows - lilac',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: tossed bows. Colors: lilac. Elements: lace trim, satin bows. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_33
  coquette_hearts_33: {
    id: 'coquette_hearts_33',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 33',
    description: 'hearts/swans - cream',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: tossed bows. Colors: cream. Elements: hearts, swans. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_34
  coquette_roses_34: {
    id: 'coquette_roses_34',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 34',
    description: 'roses/pearl strings - baby pink',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: dense lace repeat. Colors: baby pink. Elements: roses, pearl strings. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_35
  coquette_pearl_strings_35: {
    id: 'coquette_pearl_strings_35',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 35',
    description: 'pearl strings/lace trim - lilac',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: tossed bows. Colors: lilac. Elements: pearl strings, lace trim. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_36
  coquette_pearl_strings_36: {
    id: 'coquette_pearl_strings_36',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 36',
    description: 'pearl strings/swans - mocha',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: dense lace repeat. Colors: mocha. Elements: pearl strings, swans. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_hearts_37
  coquette_hearts_37: {
    id: 'coquette_hearts_37',
    label: 'Coquette Hearts',
    nameEn: 'Coquette Hearts 37',
    description: 'hearts/roses - cream',
    prompt:
      'Style: Coquette aesthetic (delicate). Layout: tossed bows. Colors: cream. Elements: hearts, roses. Vibe: delicate.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_38
  coquette_lace_trim_38: {
    id: 'coquette_lace_trim_38',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 38',
    description: 'lace trim/ballet shoes - powder blue',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: scattered pearls. Colors: powder blue. Elements: lace trim, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_swans_39
  coquette_swans_39: {
    id: 'coquette_swans_39',
    label: 'Coquette Swans',
    nameEn: 'Coquette Swans 39',
    description: 'swans/hearts - powder blue',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: tossed bows. Colors: powder blue. Elements: swans, hearts. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_40
  coquette_pearl_strings_40: {
    id: 'coquette_pearl_strings_40',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 40',
    description: 'pearl strings/satin bows - mocha',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: tossed bows. Colors: mocha. Elements: pearl strings, satin bows. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_41
  coquette_roses_41: {
    id: 'coquette_roses_41',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 41',
    description: 'roses/lace trim - baby pink',
    prompt:
      'Style: Coquette aesthetic (vintage). Layout: dense lace repeat. Colors: baby pink. Elements: roses, lace trim. Vibe: vintage.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_42
  coquette_lace_trim_42: {
    id: 'coquette_lace_trim_42',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 42',
    description: 'lace trim/swans - lilac',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: tossed bows. Colors: lilac. Elements: lace trim, swans. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_43
  coquette_pearl_strings_43: {
    id: 'coquette_pearl_strings_43',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 43',
    description: 'pearl strings/ballet shoes - lilac',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: scattered pearls. Colors: lilac. Elements: pearl strings, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_44
  coquette_pearl_strings_44: {
    id: 'coquette_pearl_strings_44',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 44',
    description: 'pearl strings/ballet shoes - white',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: dense lace repeat. Colors: white. Elements: pearl strings, ballet shoes. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_lace_trim_45
  coquette_lace_trim_45: {
    id: 'coquette_lace_trim_45',
    label: 'Coquette Lace Trim',
    nameEn: 'Coquette Lace Trim 45',
    description: 'lace trim/roses - baby pink',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: scattered pearls. Colors: baby pink. Elements: lace trim, roses. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_46
  coquette_pearl_strings_46: {
    id: 'coquette_pearl_strings_46',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 46',
    description: 'pearl strings/roses - cream',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: scattered pearls. Colors: cream. Elements: pearl strings, roses. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_roses_47
  coquette_roses_47: {
    id: 'coquette_roses_47',
    label: 'Coquette Roses',
    nameEn: 'Coquette Roses 47',
    description: 'roses/hearts - lilac',
    prompt:
      'Style: Coquette aesthetic (romantic). Layout: scattered pearls. Colors: lilac. Elements: roses, hearts. Vibe: romantic.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_48
  coquette_ballet_shoes_48: {
    id: 'coquette_ballet_shoes_48',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 48',
    description: 'ballet shoes/pearl strings - cream',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: dense lace repeat. Colors: cream. Elements: ballet shoes, pearl strings. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_pearl_strings_49
  coquette_pearl_strings_49: {
    id: 'coquette_pearl_strings_49',
    label: 'Coquette Pearl Strings',
    nameEn: 'Coquette Pearl Strings 49',
    description: 'pearl strings/hearts - powder blue',
    prompt:
      'Style: Coquette aesthetic (soft). Layout: dense lace repeat. Colors: powder blue. Elements: pearl strings, hearts. Vibe: soft.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // coquette_ballet_shoes_50
  coquette_ballet_shoes_50: {
    id: 'coquette_ballet_shoes_50',
    label: 'Coquette Ballet Shoes',
    nameEn: 'Coquette Ballet Shoes 50',
    description: 'ballet shoes/pearl strings - mocha',
    prompt:
      'Style: Coquette aesthetic (hyper-feminine). Layout: scattered pearls. Colors: mocha. Elements: ballet shoes, pearl strings. Vibe: hyper-feminine.',
    tags: ['少女', '蝴蝶结', '芭蕾', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_1
  y2k_mcbling_gothic_lettering_1: {
    id: 'y2k_mcbling_gothic_lettering_1',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 1',
    description: 'gothic lettering/stars - black',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: sticker bomb. Colors: black. Elements: gothic lettering, stars. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_rhinestone_hearts_2
  y2k_mcbling_rhinestone_hearts_2: {
    id: 'y2k_mcbling_rhinestone_hearts_2',
    label: 'Y2K McBling Rhinestone Hearts',
    nameEn: 'Y2K McBling Rhinestone Hearts 2',
    description: 'rhinestone hearts/stars - black',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: centered slogan with icons. Colors: black. Elements: rhinestone hearts, stars. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_3
  y2k_mcbling_crowns_3: {
    id: 'y2k_mcbling_crowns_3',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 3',
    description: 'crowns/stars - silver',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: centered slogan with icons. Colors: silver. Elements: crowns, stars. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_4
  y2k_mcbling_stars_4: {
    id: 'y2k_mcbling_stars_4',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 4',
    description: 'stars/gothic lettering - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: lime green. Elements: stars, gothic lettering. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_5
  y2k_mcbling_gothic_lettering_5: {
    id: 'y2k_mcbling_gothic_lettering_5',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 5',
    description: 'gothic lettering/cherries - hot pink',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: all-over monogram. Colors: hot pink. Elements: gothic lettering, cherries. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_6
  y2k_mcbling_crowns_6: {
    id: 'y2k_mcbling_crowns_6',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 6',
    description: 'crowns/cherries - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: sticker bomb. Colors: baby blue. Elements: crowns, cherries. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_7
  y2k_mcbling_stars_7: {
    id: 'y2k_mcbling_stars_7',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 7',
    description: 'stars/cherries - black',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: centered slogan with icons. Colors: black. Elements: stars, cherries. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_8
  y2k_mcbling_stars_8: {
    id: 'y2k_mcbling_stars_8',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 8',
    description: 'stars/crowns - purple',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: purple. Elements: stars, crowns. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_9
  y2k_mcbling_gothic_lettering_9: {
    id: 'y2k_mcbling_gothic_lettering_9',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 9',
    description: 'gothic lettering/butterflies - black',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: centered slogan with icons. Colors: black. Elements: gothic lettering, butterflies. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_10
  y2k_mcbling_flip_phones_10: {
    id: 'y2k_mcbling_flip_phones_10',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 10',
    description: 'flip phones/butterflies - silver',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: silver. Elements: flip phones, butterflies. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_11
  y2k_mcbling_cherries_11: {
    id: 'y2k_mcbling_cherries_11',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 11',
    description: 'cherries/stars - hot pink',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: hot pink. Elements: cherries, stars. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_12
  y2k_mcbling_butterflies_12: {
    id: 'y2k_mcbling_butterflies_12',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 12',
    description: 'butterflies/crowns - silver',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: sticker bomb. Colors: silver. Elements: butterflies, crowns. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_13
  y2k_mcbling_stars_13: {
    id: 'y2k_mcbling_stars_13',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 13',
    description: 'stars/rhinestone hearts - black',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: centered slogan with icons. Colors: black. Elements: stars, rhinestone hearts. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_14
  y2k_mcbling_flip_phones_14: {
    id: 'y2k_mcbling_flip_phones_14',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 14',
    description: 'flip phones/stars - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: sticker bomb. Colors: lime green. Elements: flip phones, stars. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_15
  y2k_mcbling_flip_phones_15: {
    id: 'y2k_mcbling_flip_phones_15',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 15',
    description: 'flip phones/crowns - hot pink',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: all-over monogram. Colors: hot pink. Elements: flip phones, crowns. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_16
  y2k_mcbling_butterflies_16: {
    id: 'y2k_mcbling_butterflies_16',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 16',
    description: 'butterflies/flip phones - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: all-over monogram. Colors: lime green. Elements: butterflies, flip phones. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_17
  y2k_mcbling_cherries_17: {
    id: 'y2k_mcbling_cherries_17',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 17',
    description: 'cherries/butterflies - black',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: centered slogan with icons. Colors: black. Elements: cherries, butterflies. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_18
  y2k_mcbling_flip_phones_18: {
    id: 'y2k_mcbling_flip_phones_18',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 18',
    description: 'flip phones/gothic lettering - black',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: black. Elements: flip phones, gothic lettering. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_19
  y2k_mcbling_flip_phones_19: {
    id: 'y2k_mcbling_flip_phones_19',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 19',
    description: 'flip phones/cherries - silver',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: sticker bomb. Colors: silver. Elements: flip phones, cherries. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_20
  y2k_mcbling_gothic_lettering_20: {
    id: 'y2k_mcbling_gothic_lettering_20',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 20',
    description: 'gothic lettering/flip phones - purple',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: centered slogan with icons. Colors: purple. Elements: gothic lettering, flip phones. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_21
  y2k_mcbling_stars_21: {
    id: 'y2k_mcbling_stars_21',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 21',
    description: 'stars/flip phones - silver',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: centered slogan with icons. Colors: silver. Elements: stars, flip phones. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_22
  y2k_mcbling_cherries_22: {
    id: 'y2k_mcbling_cherries_22',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 22',
    description: 'cherries/stars - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: all-over monogram. Colors: lime green. Elements: cherries, stars. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_23
  y2k_mcbling_butterflies_23: {
    id: 'y2k_mcbling_butterflies_23',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 23',
    description: 'butterflies/stars - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: sticker bomb. Colors: baby blue. Elements: butterflies, stars. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_24
  y2k_mcbling_butterflies_24: {
    id: 'y2k_mcbling_butterflies_24',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 24',
    description: 'butterflies/gothic lettering - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: all-over monogram. Colors: lime green. Elements: butterflies, gothic lettering. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_25
  y2k_mcbling_stars_25: {
    id: 'y2k_mcbling_stars_25',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 25',
    description: 'stars/cherries - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: lime green. Elements: stars, cherries. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_26
  y2k_mcbling_crowns_26: {
    id: 'y2k_mcbling_crowns_26',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 26',
    description: 'crowns/butterflies - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: lime green. Elements: crowns, butterflies. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_27
  y2k_mcbling_stars_27: {
    id: 'y2k_mcbling_stars_27',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 27',
    description: 'stars/gothic lettering - silver',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: sticker bomb. Colors: silver. Elements: stars, gothic lettering. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_28
  y2k_mcbling_cherries_28: {
    id: 'y2k_mcbling_cherries_28',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 28',
    description: 'cherries/flip phones - black',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: black. Elements: cherries, flip phones. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_29
  y2k_mcbling_butterflies_29: {
    id: 'y2k_mcbling_butterflies_29',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 29',
    description: 'butterflies/stars - black',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: centered slogan with icons. Colors: black. Elements: butterflies, stars. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_30
  y2k_mcbling_flip_phones_30: {
    id: 'y2k_mcbling_flip_phones_30',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 30',
    description: 'flip phones/cherries - silver',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: silver. Elements: flip phones, cherries. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_31
  y2k_mcbling_crowns_31: {
    id: 'y2k_mcbling_crowns_31',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 31',
    description: 'crowns/gothic lettering - black',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: black. Elements: crowns, gothic lettering. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_32
  y2k_mcbling_cherries_32: {
    id: 'y2k_mcbling_cherries_32',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 32',
    description: 'cherries/rhinestone hearts - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: centered slogan with icons. Colors: lime green. Elements: cherries, rhinestone hearts. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_33
  y2k_mcbling_cherries_33: {
    id: 'y2k_mcbling_cherries_33',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 33',
    description: 'cherries/butterflies - purple',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: all-over monogram. Colors: purple. Elements: cherries, butterflies. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_stars_34
  y2k_mcbling_stars_34: {
    id: 'y2k_mcbling_stars_34',
    label: 'Y2K McBling Stars',
    nameEn: 'Y2K McBling Stars 34',
    description: 'stars/butterflies - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: lime green. Elements: stars, butterflies. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_35
  y2k_mcbling_cherries_35: {
    id: 'y2k_mcbling_cherries_35',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 35',
    description: 'cherries/rhinestone hearts - purple',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: centered slogan with icons. Colors: purple. Elements: cherries, rhinestone hearts. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_36
  y2k_mcbling_cherries_36: {
    id: 'y2k_mcbling_cherries_36',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 36',
    description: 'cherries/butterflies - black',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: all-over monogram. Colors: black. Elements: cherries, butterflies. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_37
  y2k_mcbling_gothic_lettering_37: {
    id: 'y2k_mcbling_gothic_lettering_37',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 37',
    description: 'gothic lettering/cherries - hot pink',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: sticker bomb. Colors: hot pink. Elements: gothic lettering, cherries. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_38
  y2k_mcbling_gothic_lettering_38: {
    id: 'y2k_mcbling_gothic_lettering_38',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 38',
    description: 'gothic lettering/cherries - purple',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: purple. Elements: gothic lettering, cherries. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_39
  y2k_mcbling_crowns_39: {
    id: 'y2k_mcbling_crowns_39',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 39',
    description: 'crowns/butterflies - black',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: centered slogan with icons. Colors: black. Elements: crowns, butterflies. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_40
  y2k_mcbling_flip_phones_40: {
    id: 'y2k_mcbling_flip_phones_40',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 40',
    description: 'flip phones/rhinestone hearts - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (sparkly). Layout: centered slogan with icons. Colors: baby blue. Elements: flip phones, rhinestone hearts. Vibe: sparkly.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_rhinestone_hearts_41
  y2k_mcbling_rhinestone_hearts_41: {
    id: 'y2k_mcbling_rhinestone_hearts_41',
    label: 'Y2K McBling Rhinestone Hearts',
    nameEn: 'Y2K McBling Rhinestone Hearts 41',
    description: 'rhinestone hearts/butterflies - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: lime green. Elements: rhinestone hearts, butterflies. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_butterflies_42
  y2k_mcbling_butterflies_42: {
    id: 'y2k_mcbling_butterflies_42',
    label: 'Y2K McBling Butterflies',
    nameEn: 'Y2K McBling Butterflies 42',
    description: 'butterflies/gothic lettering - silver',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: centered slogan with icons. Colors: silver. Elements: butterflies, gothic lettering. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_43
  y2k_mcbling_gothic_lettering_43: {
    id: 'y2k_mcbling_gothic_lettering_43',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 43',
    description: 'gothic lettering/crowns - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: sticker bomb. Colors: baby blue. Elements: gothic lettering, crowns. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_44
  y2k_mcbling_cherries_44: {
    id: 'y2k_mcbling_cherries_44',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 44',
    description: 'cherries/stars - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: all-over monogram. Colors: lime green. Elements: cherries, stars. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_45
  y2k_mcbling_cherries_45: {
    id: 'y2k_mcbling_cherries_45',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 45',
    description: 'cherries/crowns - purple',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: sticker bomb. Colors: purple. Elements: cherries, crowns. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_cherries_46
  y2k_mcbling_cherries_46: {
    id: 'y2k_mcbling_cherries_46',
    label: 'Y2K McBling Cherries',
    nameEn: 'Y2K McBling Cherries 46',
    description: 'cherries/rhinestone hearts - hot pink',
    prompt:
      'Style: Y2K McBling aesthetic (glamorous). Layout: centered slogan with icons. Colors: hot pink. Elements: cherries, rhinestone hearts. Vibe: glamorous.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_gothic_lettering_47
  y2k_mcbling_gothic_lettering_47: {
    id: 'y2k_mcbling_gothic_lettering_47',
    label: 'Y2K McBling Gothic Lettering',
    nameEn: 'Y2K McBling Gothic Lettering 47',
    description: 'gothic lettering/flip phones - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: all-over monogram. Colors: baby blue. Elements: gothic lettering, flip phones. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_flip_phones_48
  y2k_mcbling_flip_phones_48: {
    id: 'y2k_mcbling_flip_phones_48',
    label: 'Y2K McBling Flip Phones',
    nameEn: 'Y2K McBling Flip Phones 48',
    description: 'flip phones/gothic lettering - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: centered slogan with icons. Colors: lime green. Elements: flip phones, gothic lettering. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_49
  y2k_mcbling_crowns_49: {
    id: 'y2k_mcbling_crowns_49',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 49',
    description: 'crowns/stars - baby blue',
    prompt:
      'Style: Y2K McBling aesthetic (sassy). Layout: sticker bomb. Colors: baby blue. Elements: crowns, stars. Vibe: sassy.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // y2k_mcbling_crowns_50
  y2k_mcbling_crowns_50: {
    id: 'y2k_mcbling_crowns_50',
    label: 'Y2K McBling Crowns',
    nameEn: 'Y2K McBling Crowns 50',
    description: 'crowns/stars - lime green',
    prompt:
      'Style: Y2K McBling aesthetic (retro-futuristic). Layout: all-over monogram. Colors: lime green. Elements: crowns, stars. Vibe: retro-futuristic.',
    tags: ['Y2K', '千禧', '辣妹', '水钻', '流行', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // anime_manga_sparkles_1
  anime_manga_sparkles_1: {
    id: 'anime_manga_sparkles_1',
    label: 'Anime Manga Sparkles',
    nameEn: 'Anime Manga Sparkles 1',
    description: 'sparkles/speed lines - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: large character print. Colors: cyan. Elements: sparkles, speed lines. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_2
  anime_manga_magical_girl_wands_2: {
    id: 'anime_manga_magical_girl_wands_2',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 2',
    description: 'magical girl wands/chibi characters - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: black and white. Elements: magical girl wands, chibi characters. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_3
  anime_manga_speech_bubbles_3: {
    id: 'anime_manga_speech_bubbles_3',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 3',
    description: 'speech bubbles/chibi characters - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: large character print. Colors: black and white. Elements: speech bubbles, chibi characters. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_4
  anime_manga_magical_girl_wands_4: {
    id: 'anime_manga_magical_girl_wands_4',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 4',
    description: 'magical girl wands/speech bubbles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: scattered kawaii icons. Colors: cyan. Elements: magical girl wands, speech bubbles. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_5
  anime_manga_magical_girl_wands_5: {
    id: 'anime_manga_magical_girl_wands_5',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 5',
    description: 'magical girl wands/speech bubbles - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: large character print. Colors: black and white. Elements: magical girl wands, speech bubbles. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_6
  anime_manga_school_uniform_elements_6: {
    id: 'anime_manga_school_uniform_elements_6',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 6',
    description: 'school uniform elements/sparkles - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: scattered kawaii icons. Colors: bw with neon pink. Elements: school uniform elements, sparkles. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_7
  anime_manga_speech_bubbles_7: {
    id: 'anime_manga_speech_bubbles_7',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 7',
    description: 'speech bubbles/speed lines - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: scattered kawaii icons. Colors: pastel purple. Elements: speech bubbles, speed lines. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_8
  anime_manga_chibi_characters_8: {
    id: 'anime_manga_chibi_characters_8',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 8',
    description: 'chibi characters/school uniform elements - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: bw with neon pink. Elements: chibi characters, school uniform elements. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_9
  anime_manga_school_uniform_elements_9: {
    id: 'anime_manga_school_uniform_elements_9',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 9',
    description: 'school uniform elements/sparkles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: cyan. Elements: school uniform elements, sparkles. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_10
  anime_manga_chibi_characters_10: {
    id: 'anime_manga_chibi_characters_10',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 10',
    description: 'chibi characters/school uniform elements - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: manga panel collage. Colors: pastel purple. Elements: chibi characters, school uniform elements. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_11
  anime_manga_magical_girl_wands_11: {
    id: 'anime_manga_magical_girl_wands_11',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 11',
    description: 'magical girl wands/manga eyes - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: scattered kawaii icons. Colors: bw with neon pink. Elements: magical girl wands, manga eyes. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_12
  anime_manga_speech_bubbles_12: {
    id: 'anime_manga_speech_bubbles_12',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 12',
    description: 'speech bubbles/school uniform elements - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: pastel purple. Elements: speech bubbles, school uniform elements. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_13
  anime_manga_magical_girl_wands_13: {
    id: 'anime_manga_magical_girl_wands_13',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 13',
    description: 'magical girl wands/speech bubbles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: cyan. Elements: magical girl wands, speech bubbles. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_14
  anime_manga_chibi_characters_14: {
    id: 'anime_manga_chibi_characters_14',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 14',
    description: 'chibi characters/speed lines - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: scattered kawaii icons. Colors: pastel purple. Elements: chibi characters, speed lines. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_15
  anime_manga_school_uniform_elements_15: {
    id: 'anime_manga_school_uniform_elements_15',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 15',
    description: 'school uniform elements/magical girl wands - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: large character print. Colors: bw with neon pink. Elements: school uniform elements, magical girl wands. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_16
  anime_manga_chibi_characters_16: {
    id: 'anime_manga_chibi_characters_16',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 16',
    description: 'chibi characters/speed lines - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: large character print. Colors: black and white. Elements: chibi characters, speed lines. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_17
  anime_manga_school_uniform_elements_17: {
    id: 'anime_manga_school_uniform_elements_17',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 17',
    description: 'school uniform elements/manga eyes - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: manga panel collage. Colors: pastel purple. Elements: school uniform elements, manga eyes. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_18
  anime_manga_magical_girl_wands_18: {
    id: 'anime_manga_magical_girl_wands_18',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 18',
    description: 'magical girl wands/speech bubbles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: manga panel collage. Colors: cyan. Elements: magical girl wands, speech bubbles. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_19
  anime_manga_school_uniform_elements_19: {
    id: 'anime_manga_school_uniform_elements_19',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 19',
    description: 'school uniform elements/magical girl wands - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: scattered kawaii icons. Colors: bw with neon pink. Elements: school uniform elements, magical girl wands. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_20
  anime_manga_chibi_characters_20: {
    id: 'anime_manga_chibi_characters_20',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 20',
    description: 'chibi characters/sparkles - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: manga panel collage. Colors: pastel purple. Elements: chibi characters, sparkles. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_manga_eyes_21
  anime_manga_manga_eyes_21: {
    id: 'anime_manga_manga_eyes_21',
    label: 'Anime Manga Manga Eyes',
    nameEn: 'Anime Manga Manga Eyes 21',
    description: 'manga eyes/speed lines - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: scattered kawaii icons. Colors: cyan. Elements: manga eyes, speed lines. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_22
  anime_manga_speech_bubbles_22: {
    id: 'anime_manga_speech_bubbles_22',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 22',
    description: 'speech bubbles/sparkles - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: large character print. Colors: pastel purple. Elements: speech bubbles, sparkles. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_23
  anime_manga_chibi_characters_23: {
    id: 'anime_manga_chibi_characters_23',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 23',
    description: 'chibi characters/speed lines - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: pastel purple. Elements: chibi characters, speed lines. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_24
  anime_manga_speech_bubbles_24: {
    id: 'anime_manga_speech_bubbles_24',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 24',
    description: 'speech bubbles/speed lines - cyan',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: scattered kawaii icons. Colors: cyan. Elements: speech bubbles, speed lines. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speed_lines_25
  anime_manga_speed_lines_25: {
    id: 'anime_manga_speed_lines_25',
    label: 'Anime Manga Speed Lines',
    nameEn: 'Anime Manga Speed Lines 25',
    description: 'speed lines/school uniform elements - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: pastel purple. Elements: speed lines, school uniform elements. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_sparkles_26
  anime_manga_sparkles_26: {
    id: 'anime_manga_sparkles_26',
    label: 'Anime Manga Sparkles',
    nameEn: 'Anime Manga Sparkles 26',
    description: 'sparkles/magical girl wands - black and white',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: black and white. Elements: sparkles, magical girl wands. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_27
  anime_manga_chibi_characters_27: {
    id: 'anime_manga_chibi_characters_27',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 27',
    description: 'chibi characters/manga eyes - black and white',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: black and white. Elements: chibi characters, manga eyes. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_28
  anime_manga_magical_girl_wands_28: {
    id: 'anime_manga_magical_girl_wands_28',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 28',
    description: 'magical girl wands/school uniform elements - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: scattered kawaii icons. Colors: cyan. Elements: magical girl wands, school uniform elements. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_chibi_characters_29
  anime_manga_chibi_characters_29: {
    id: 'anime_manga_chibi_characters_29',
    label: 'Anime Manga Chibi Characters',
    nameEn: 'Anime Manga Chibi Characters 29',
    description: 'chibi characters/speed lines - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: bw with neon pink. Elements: chibi characters, speed lines. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_manga_eyes_30
  anime_manga_manga_eyes_30: {
    id: 'anime_manga_manga_eyes_30',
    label: 'Anime Manga Manga Eyes',
    nameEn: 'Anime Manga Manga Eyes 30',
    description: 'manga eyes/school uniform elements - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: manga panel collage. Colors: cyan. Elements: manga eyes, school uniform elements. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speed_lines_31
  anime_manga_speed_lines_31: {
    id: 'anime_manga_speed_lines_31',
    label: 'Anime Manga Speed Lines',
    nameEn: 'Anime Manga Speed Lines 31',
    description: 'speed lines/sparkles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: manga panel collage. Colors: cyan. Elements: speed lines, sparkles. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_manga_eyes_32
  anime_manga_manga_eyes_32: {
    id: 'anime_manga_manga_eyes_32',
    label: 'Anime Manga Manga Eyes',
    nameEn: 'Anime Manga Manga Eyes 32',
    description: 'manga eyes/chibi characters - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: pastel purple. Elements: manga eyes, chibi characters. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_manga_eyes_33
  anime_manga_manga_eyes_33: {
    id: 'anime_manga_manga_eyes_33',
    label: 'Anime Manga Manga Eyes',
    nameEn: 'Anime Manga Manga Eyes 33',
    description: 'manga eyes/sparkles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: cyan. Elements: manga eyes, sparkles. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_34
  anime_manga_school_uniform_elements_34: {
    id: 'anime_manga_school_uniform_elements_34',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 34',
    description: 'school uniform elements/speed lines - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: scattered kawaii icons. Colors: black and white. Elements: school uniform elements, speed lines. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_35
  anime_manga_school_uniform_elements_35: {
    id: 'anime_manga_school_uniform_elements_35',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 35',
    description: 'school uniform elements/manga eyes - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: scattered kawaii icons. Colors: pastel purple. Elements: school uniform elements, manga eyes. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_36
  anime_manga_school_uniform_elements_36: {
    id: 'anime_manga_school_uniform_elements_36',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 36',
    description: 'school uniform elements/speech bubbles - black and white',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: black and white. Elements: school uniform elements, speech bubbles. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speed_lines_37
  anime_manga_speed_lines_37: {
    id: 'anime_manga_speed_lines_37',
    label: 'Anime Manga Speed Lines',
    nameEn: 'Anime Manga Speed Lines 37',
    description: 'speed lines/magical girl wands - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: pastel purple. Elements: speed lines, magical girl wands. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_sparkles_38
  anime_manga_sparkles_38: {
    id: 'anime_manga_sparkles_38',
    label: 'Anime Manga Sparkles',
    nameEn: 'Anime Manga Sparkles 38',
    description: 'sparkles/speed lines - black and white',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: black and white. Elements: sparkles, speed lines. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_39
  anime_manga_school_uniform_elements_39: {
    id: 'anime_manga_school_uniform_elements_39',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 39',
    description: 'school uniform elements/speed lines - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: scattered kawaii icons. Colors: cyan. Elements: school uniform elements, speed lines. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_sparkles_40
  anime_manga_sparkles_40: {
    id: 'anime_manga_sparkles_40',
    label: 'Anime Manga Sparkles',
    nameEn: 'Anime Manga Sparkles 40',
    description: 'sparkles/speed lines - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: pastel purple. Elements: sparkles, speed lines. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speed_lines_41
  anime_manga_speed_lines_41: {
    id: 'anime_manga_speed_lines_41',
    label: 'Anime Manga Speed Lines',
    nameEn: 'Anime Manga Speed Lines 41',
    description: 'speed lines/speech bubbles - cyan',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: manga panel collage. Colors: cyan. Elements: speed lines, speech bubbles. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_42
  anime_manga_speech_bubbles_42: {
    id: 'anime_manga_speech_bubbles_42',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 42',
    description: 'speech bubbles/sparkles - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: manga panel collage. Colors: bw with neon pink. Elements: speech bubbles, sparkles. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_43
  anime_manga_magical_girl_wands_43: {
    id: 'anime_manga_magical_girl_wands_43',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 43',
    description: 'magical girl wands/chibi characters - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: large character print. Colors: pastel purple. Elements: magical girl wands, chibi characters. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_44
  anime_manga_magical_girl_wands_44: {
    id: 'anime_manga_magical_girl_wands_44',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 44',
    description: 'magical girl wands/school uniform elements - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: bw with neon pink. Elements: magical girl wands, school uniform elements. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speed_lines_45
  anime_manga_speed_lines_45: {
    id: 'anime_manga_speed_lines_45',
    label: 'Anime Manga Speed Lines',
    nameEn: 'Anime Manga Speed Lines 45',
    description: 'speed lines/magical girl wands - cyan',
    prompt:
      'Style: Anime Manga aesthetic (dramatic). Layout: scattered kawaii icons. Colors: cyan. Elements: speed lines, magical girl wands. Vibe: dramatic.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_magical_girl_wands_46
  anime_manga_magical_girl_wands_46: {
    id: 'anime_manga_magical_girl_wands_46',
    label: 'Anime Manga Magical Girl Wands',
    nameEn: 'Anime Manga Magical Girl Wands 46',
    description: 'magical girl wands/manga eyes - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: large character print. Colors: bw with neon pink. Elements: magical girl wands, manga eyes. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_47
  anime_manga_speech_bubbles_47: {
    id: 'anime_manga_speech_bubbles_47',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 47',
    description: 'speech bubbles/chibi characters - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cool). Layout: scattered kawaii icons. Colors: pastel purple. Elements: speech bubbles, chibi characters. Vibe: cool.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_speech_bubbles_48
  anime_manga_speech_bubbles_48: {
    id: 'anime_manga_speech_bubbles_48',
    label: 'Anime Manga Speech Bubbles',
    nameEn: 'Anime Manga Speech Bubbles 48',
    description: 'speech bubbles/magical girl wands - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: manga panel collage. Colors: pastel purple. Elements: speech bubbles, magical girl wands. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_school_uniform_elements_49
  anime_manga_school_uniform_elements_49: {
    id: 'anime_manga_school_uniform_elements_49',
    label: 'Anime Manga School Uniform Elements',
    nameEn: 'Anime Manga School Uniform Elements 49',
    description: 'school uniform elements/manga eyes - pastel purple',
    prompt:
      'Style: Anime Manga aesthetic (edgy). Layout: large character print. Colors: pastel purple. Elements: school uniform elements, manga eyes. Vibe: edgy.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // anime_manga_sparkles_50
  anime_manga_sparkles_50: {
    id: 'anime_manga_sparkles_50',
    label: 'Anime Manga Sparkles',
    nameEn: 'Anime Manga Sparkles 50',
    description: 'sparkles/speech bubbles - bw with neon pink',
    prompt:
      'Style: Anime Manga aesthetic (cute). Layout: large character print. Colors: bw with neon pink. Elements: sparkles, speech bubbles. Vibe: cute.',
    tags: ['动漫', '漫画', '二次元', '流行', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // street_camo_barbed_wire_1
  street_camo_barbed_wire_1: {
    id: 'street_camo_barbed_wire_1',
    label: 'Street Camo Barbed Wire',
    nameEn: 'Street Camo Barbed Wire 1',
    description: 'barbed wire/graffiti tags - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: all-over camo. Colors: orange safety. Elements: barbed wire, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_2
  street_camo_camouflage_blobs_2: {
    id: 'street_camo_camouflage_blobs_2',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 2',
    description: 'camouflage blobs/spray paint drips - grey scale',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: stencil spray. Colors: grey scale. Elements: camouflage blobs, spray paint drips. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_3
  street_camo_graffiti_tags_3: {
    id: 'street_camo_graffiti_tags_3',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 3',
    description: 'graffiti tags/camouflage blobs - purple camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: purple camo. Elements: graffiti tags, camouflage blobs. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_4
  street_camo_camouflage_blobs_4: {
    id: 'street_camo_camouflage_blobs_4',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 4',
    description: 'camouflage blobs/chains - forest green',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: stencil spray. Colors: forest green. Elements: camouflage blobs, chains. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_5
  street_camo_graffiti_tags_5: {
    id: 'street_camo_graffiti_tags_5',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 5',
    description: 'graffiti tags/barbed wire - forest green',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: forest green. Elements: graffiti tags, barbed wire. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_6
  street_camo_spray_paint_drips_6: {
    id: 'street_camo_spray_paint_drips_6',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 6',
    description: 'spray paint drips/chains - forest green',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: all-over camo. Colors: forest green. Elements: spray paint drips, chains. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_7
  street_camo_camouflage_blobs_7: {
    id: 'street_camo_camouflage_blobs_7',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 7',
    description: 'camouflage blobs/barbed wire - pink camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: pink camo. Elements: camouflage blobs, barbed wire. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_8
  street_camo_graffiti_tags_8: {
    id: 'street_camo_graffiti_tags_8',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 8',
    description: 'graffiti tags/spray paint drips - purple camo',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: patchwork camo. Colors: purple camo. Elements: graffiti tags, spray paint drips. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_9
  street_camo_spray_paint_drips_9: {
    id: 'street_camo_spray_paint_drips_9',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 9',
    description: 'spray paint drips/skulls - purple camo',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: all-over camo. Colors: purple camo. Elements: spray paint drips, skulls. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_10
  street_camo_camouflage_blobs_10: {
    id: 'street_camo_camouflage_blobs_10',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 10',
    description: 'camouflage blobs/barbed wire - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: orange safety. Elements: camouflage blobs, barbed wire. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_11
  street_camo_skulls_11: {
    id: 'street_camo_skulls_11',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 11',
    description: 'skulls/spray paint drips - forest green',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: patchwork camo. Colors: forest green. Elements: skulls, spray paint drips. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_12
  street_camo_graffiti_tags_12: {
    id: 'street_camo_graffiti_tags_12',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 12',
    description: 'graffiti tags/chains - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: forest green. Elements: graffiti tags, chains. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_13
  street_camo_camouflage_blobs_13: {
    id: 'street_camo_camouflage_blobs_13',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 13',
    description: 'camouflage blobs/chains - forest green',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: forest green. Elements: camouflage blobs, chains. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_14
  street_camo_skulls_14: {
    id: 'street_camo_skulls_14',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 14',
    description: 'skulls/spray paint drips - grey scale',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: patchwork camo. Colors: grey scale. Elements: skulls, spray paint drips. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_15
  street_camo_camouflage_blobs_15: {
    id: 'street_camo_camouflage_blobs_15',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 15',
    description: 'camouflage blobs/graffiti tags - grey scale',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: grey scale. Elements: camouflage blobs, graffiti tags. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_chains_16
  street_camo_chains_16: {
    id: 'street_camo_chains_16',
    label: 'Street Camo Chains',
    nameEn: 'Street Camo Chains 16',
    description: 'chains/camouflage blobs - grey scale',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: patchwork camo. Colors: grey scale. Elements: chains, camouflage blobs. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_barbed_wire_17
  street_camo_barbed_wire_17: {
    id: 'street_camo_barbed_wire_17',
    label: 'Street Camo Barbed Wire',
    nameEn: 'Street Camo Barbed Wire 17',
    description: 'barbed wire/skulls - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: pink camo. Elements: barbed wire, skulls. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_18
  street_camo_spray_paint_drips_18: {
    id: 'street_camo_spray_paint_drips_18',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 18',
    description: 'spray paint drips/chains - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: stencil spray. Colors: orange safety. Elements: spray paint drips, chains. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_19
  street_camo_skulls_19: {
    id: 'street_camo_skulls_19',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 19',
    description: 'skulls/graffiti tags - pink camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: pink camo. Elements: skulls, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_20
  street_camo_spray_paint_drips_20: {
    id: 'street_camo_spray_paint_drips_20',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 20',
    description: 'spray paint drips/camouflage blobs - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: pink camo. Elements: spray paint drips, camouflage blobs. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_21
  street_camo_graffiti_tags_21: {
    id: 'street_camo_graffiti_tags_21',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 21',
    description: 'graffiti tags/barbed wire - pink camo',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: stencil spray. Colors: pink camo. Elements: graffiti tags, barbed wire. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_22
  street_camo_spray_paint_drips_22: {
    id: 'street_camo_spray_paint_drips_22',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 22',
    description: 'spray paint drips/graffiti tags - purple camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: stencil spray. Colors: purple camo. Elements: spray paint drips, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_23
  street_camo_skulls_23: {
    id: 'street_camo_skulls_23',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 23',
    description: 'skulls/barbed wire - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: forest green. Elements: skulls, barbed wire. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_barbed_wire_24
  street_camo_barbed_wire_24: {
    id: 'street_camo_barbed_wire_24',
    label: 'Street Camo Barbed Wire',
    nameEn: 'Street Camo Barbed Wire 24',
    description: 'barbed wire/camouflage blobs - forest green',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: stencil spray. Colors: forest green. Elements: barbed wire, camouflage blobs. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_25
  street_camo_graffiti_tags_25: {
    id: 'street_camo_graffiti_tags_25',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 25',
    description: 'graffiti tags/spray paint drips - grey scale',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: all-over camo. Colors: grey scale. Elements: graffiti tags, spray paint drips. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_26
  street_camo_skulls_26: {
    id: 'street_camo_skulls_26',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 26',
    description: 'skulls/camouflage blobs - forest green',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: patchwork camo. Colors: forest green. Elements: skulls, camouflage blobs. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_27
  street_camo_spray_paint_drips_27: {
    id: 'street_camo_spray_paint_drips_27',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 27',
    description: 'spray paint drips/camouflage blobs - pink camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: all-over camo. Colors: pink camo. Elements: spray paint drips, camouflage blobs. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_28
  street_camo_graffiti_tags_28: {
    id: 'street_camo_graffiti_tags_28',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 28',
    description: 'graffiti tags/skulls - forest green',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: stencil spray. Colors: forest green. Elements: graffiti tags, skulls. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_29
  street_camo_skulls_29: {
    id: 'street_camo_skulls_29',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 29',
    description: 'skulls/barbed wire - orange safety',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: patchwork camo. Colors: orange safety. Elements: skulls, barbed wire. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_30
  street_camo_skulls_30: {
    id: 'street_camo_skulls_30',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 30',
    description: 'skulls/graffiti tags - grey scale',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: grey scale. Elements: skulls, graffiti tags. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_chains_31
  street_camo_chains_31: {
    id: 'street_camo_chains_31',
    label: 'Street Camo Chains',
    nameEn: 'Street Camo Chains 31',
    description: 'chains/barbed wire - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: forest green. Elements: chains, barbed wire. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_chains_32
  street_camo_chains_32: {
    id: 'street_camo_chains_32',
    label: 'Street Camo Chains',
    nameEn: 'Street Camo Chains 32',
    description: 'chains/graffiti tags - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: pink camo. Elements: chains, graffiti tags. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_chains_33
  street_camo_chains_33: {
    id: 'street_camo_chains_33',
    label: 'Street Camo Chains',
    nameEn: 'Street Camo Chains 33',
    description: 'chains/skulls - purple camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: all-over camo. Colors: purple camo. Elements: chains, skulls. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_barbed_wire_34
  street_camo_barbed_wire_34: {
    id: 'street_camo_barbed_wire_34',
    label: 'Street Camo Barbed Wire',
    nameEn: 'Street Camo Barbed Wire 34',
    description: 'barbed wire/chains - orange safety',
    prompt:
      'Style: Street Camo aesthetic (streetwear). Layout: patchwork camo. Colors: orange safety. Elements: barbed wire, chains. Vibe: streetwear.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_35
  street_camo_camouflage_blobs_35: {
    id: 'street_camo_camouflage_blobs_35',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 35',
    description: 'camouflage blobs/graffiti tags - purple camo',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: all-over camo. Colors: purple camo. Elements: camouflage blobs, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_36
  street_camo_camouflage_blobs_36: {
    id: 'street_camo_camouflage_blobs_36',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 36',
    description: 'camouflage blobs/chains - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: forest green. Elements: camouflage blobs, chains. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_37
  street_camo_spray_paint_drips_37: {
    id: 'street_camo_spray_paint_drips_37',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 37',
    description: 'spray paint drips/chains - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: orange safety. Elements: spray paint drips, chains. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_38
  street_camo_graffiti_tags_38: {
    id: 'street_camo_graffiti_tags_38',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 38',
    description: 'graffiti tags/skulls - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: forest green. Elements: graffiti tags, skulls. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_39
  street_camo_graffiti_tags_39: {
    id: 'street_camo_graffiti_tags_39',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 39',
    description: 'graffiti tags/spray paint drips - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: pink camo. Elements: graffiti tags, spray paint drips. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_40
  street_camo_spray_paint_drips_40: {
    id: 'street_camo_spray_paint_drips_40',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 40',
    description: 'spray paint drips/graffiti tags - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: patchwork camo. Colors: orange safety. Elements: spray paint drips, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_41
  street_camo_camouflage_blobs_41: {
    id: 'street_camo_camouflage_blobs_41',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 41',
    description: 'camouflage blobs/barbed wire - pink camo',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: patchwork camo. Colors: pink camo. Elements: camouflage blobs, barbed wire. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_42
  street_camo_skulls_42: {
    id: 'street_camo_skulls_42',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 42',
    description: 'skulls/graffiti tags - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: pink camo. Elements: skulls, graffiti tags. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_43
  street_camo_camouflage_blobs_43: {
    id: 'street_camo_camouflage_blobs_43',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 43',
    description: 'camouflage blobs/spray paint drips - orange safety',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: stencil spray. Colors: orange safety. Elements: camouflage blobs, spray paint drips. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_44
  street_camo_skulls_44: {
    id: 'street_camo_skulls_44',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 44',
    description: 'skulls/camouflage blobs - grey scale',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: grey scale. Elements: skulls, camouflage blobs. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_45
  street_camo_graffiti_tags_45: {
    id: 'street_camo_graffiti_tags_45',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 45',
    description: 'graffiti tags/skulls - grey scale',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: all-over camo. Colors: grey scale. Elements: graffiti tags, skulls. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_skulls_46
  street_camo_skulls_46: {
    id: 'street_camo_skulls_46',
    label: 'Street Camo Skulls',
    nameEn: 'Street Camo Skulls 46',
    description: 'skulls/graffiti tags - grey scale',
    prompt:
      'Style: Street Camo aesthetic (bold). Layout: stencil spray. Colors: grey scale. Elements: skulls, graffiti tags. Vibe: bold.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_camouflage_blobs_47
  street_camo_camouflage_blobs_47: {
    id: 'street_camo_camouflage_blobs_47',
    label: 'Street Camo Camouflage Blobs',
    nameEn: 'Street Camo Camouflage Blobs 47',
    description: 'camouflage blobs/skulls - forest green',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: all-over camo. Colors: forest green. Elements: camouflage blobs, skulls. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_chains_48
  street_camo_chains_48: {
    id: 'street_camo_chains_48',
    label: 'Street Camo Chains',
    nameEn: 'Street Camo Chains 48',
    description: 'chains/skulls - forest green',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: stencil spray. Colors: forest green. Elements: chains, skulls. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_graffiti_tags_49
  street_camo_graffiti_tags_49: {
    id: 'street_camo_graffiti_tags_49',
    label: 'Street Camo Graffiti Tags',
    nameEn: 'Street Camo Graffiti Tags 49',
    description: 'graffiti tags/spray paint drips - pink camo',
    prompt:
      'Style: Street Camo aesthetic (tough). Layout: stencil spray. Colors: pink camo. Elements: graffiti tags, spray paint drips. Vibe: tough.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // street_camo_spray_paint_drips_50
  street_camo_spray_paint_drips_50: {
    id: 'street_camo_spray_paint_drips_50',
    label: 'Street Camo Spray Paint Drips',
    nameEn: 'Street Camo Spray Paint Drips 50',
    description: 'spray paint drips/graffiti tags - forest green',
    prompt:
      'Style: Street Camo aesthetic (trendy). Layout: patchwork camo. Colors: forest green. Elements: spray paint drips, graffiti tags. Vibe: trendy.',
    tags: ['迷彩', '街头', '潮流', '工装', 'Pattern', '2025Trend'],
    category: 'lifestyle'
  },

  // dopamine_kidcore_lollipops_1
  dopamine_kidcore_lollipops_1: {
    id: 'dopamine_kidcore_lollipops_1',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 1',
    description: 'lollipops/smiley faces - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: sunflower yellow. Elements: lollipops, smiley faces. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_2
  dopamine_kidcore_flowers_2: {
    id: 'dopamine_kidcore_flowers_2',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 2',
    description: 'flowers/smiley faces - neon brights',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: checkerboard mix. Colors: neon brights. Elements: flowers, smiley faces. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_3
  dopamine_kidcore_smiley_faces_3: {
    id: 'dopamine_kidcore_smiley_faces_3',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 3',
    description: 'smiley faces/lollipops - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: checkerboard mix. Colors: tie-dye pastel. Elements: smiley faces, lollipops. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_4
  dopamine_kidcore_flowers_4: {
    id: 'dopamine_kidcore_flowers_4',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 4',
    description: 'flowers/tie-dye swirls - neon brights',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: checkerboard mix. Colors: neon brights. Elements: flowers, tie-dye swirls. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_5
  dopamine_kidcore_bears_5: {
    id: 'dopamine_kidcore_bears_5',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 5',
    description: 'bears/flowers - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: checkerboard mix. Colors: tie-dye pastel. Elements: bears, flowers. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_lollipops_6
  dopamine_kidcore_lollipops_6: {
    id: 'dopamine_kidcore_lollipops_6',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 6',
    description: 'lollipops/tie-dye swirls - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: sunflower yellow. Elements: lollipops, tie-dye swirls. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_clouds_7
  dopamine_kidcore_clouds_7: {
    id: 'dopamine_kidcore_clouds_7',
    label: 'Dopamine Clouds',
    nameEn: 'Dopamine Clouds 7',
    description: 'clouds/bears - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: tie-dye pastel. Elements: clouds, bears. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_8
  dopamine_kidcore_smiley_faces_8: {
    id: 'dopamine_kidcore_smiley_faces_8',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 8',
    description: 'smiley faces/lollipops - neon brights',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: neon brights. Elements: smiley faces, lollipops. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_9
  dopamine_kidcore_rainbows_9: {
    id: 'dopamine_kidcore_rainbows_9',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 9',
    description: 'rainbows/tie-dye swirls - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: tie-dye background. Colors: neon brights. Elements: rainbows, tie-dye swirls. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_10
  dopamine_kidcore_rainbows_10: {
    id: 'dopamine_kidcore_rainbows_10',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 10',
    description: 'rainbows/smiley faces - neon brights',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: checkerboard mix. Colors: neon brights. Elements: rainbows, smiley faces. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_clouds_11
  dopamine_kidcore_clouds_11: {
    id: 'dopamine_kidcore_clouds_11',
    label: 'Dopamine Clouds',
    nameEn: 'Dopamine Clouds 11',
    description: 'clouds/bears - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: neon brights. Elements: clouds, bears. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_12
  dopamine_kidcore_rainbows_12: {
    id: 'dopamine_kidcore_rainbows_12',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 12',
    description: 'rainbows/clouds - rainbow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: rainbow. Elements: rainbows, clouds. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_13
  dopamine_kidcore_smiley_faces_13: {
    id: 'dopamine_kidcore_smiley_faces_13',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 13',
    description: 'smiley faces/bears - rainbow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: tie-dye background. Colors: rainbow. Elements: smiley faces, bears. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_14
  dopamine_kidcore_smiley_faces_14: {
    id: 'dopamine_kidcore_smiley_faces_14',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 14',
    description: 'smiley faces/lollipops - rainbow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: tie-dye background. Colors: rainbow. Elements: smiley faces, lollipops. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_15
  dopamine_kidcore_rainbows_15: {
    id: 'dopamine_kidcore_rainbows_15',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 15',
    description: 'rainbows/lollipops - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: checkerboard mix. Colors: tie-dye pastel. Elements: rainbows, lollipops. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_16
  dopamine_kidcore_bears_16: {
    id: 'dopamine_kidcore_bears_16',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 16',
    description: 'bears/clouds - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: tie-dye background. Colors: sunflower yellow. Elements: bears, clouds. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_tie-dye_swirls_17
  'dopamine_kidcore_tie-dye_swirls_17': {
    id: 'dopamine_kidcore_tie-dye_swirls_17',
    label: 'Dopamine Tie-Dye Swirls',
    nameEn: 'Dopamine Tie-Dye Swirls 17',
    description: 'tie-dye swirls/bears - rainbow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: checkerboard mix. Colors: rainbow. Elements: tie-dye swirls, bears. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_18
  dopamine_kidcore_flowers_18: {
    id: 'dopamine_kidcore_flowers_18',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 18',
    description: 'flowers/clouds - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: checkerboard mix. Colors: neon brights. Elements: flowers, clouds. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_19
  dopamine_kidcore_bears_19: {
    id: 'dopamine_kidcore_bears_19',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 19',
    description: 'bears/smiley faces - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: checkerboard mix. Colors: sunflower yellow. Elements: bears, smiley faces. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_20
  dopamine_kidcore_bears_20: {
    id: 'dopamine_kidcore_bears_20',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 20',
    description: 'bears/tie-dye swirls - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: checkerboard mix. Colors: tie-dye pastel. Elements: bears, tie-dye swirls. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_21
  dopamine_kidcore_bears_21: {
    id: 'dopamine_kidcore_bears_21',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 21',
    description: 'bears/flowers - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: tie-dye pastel. Elements: bears, flowers. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_lollipops_22
  dopamine_kidcore_lollipops_22: {
    id: 'dopamine_kidcore_lollipops_22',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 22',
    description: 'lollipops/smiley faces - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: lollipops, smiley faces. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_tie-dye_swirls_23
  'dopamine_kidcore_tie-dye_swirls_23': {
    id: 'dopamine_kidcore_tie-dye_swirls_23',
    label: 'Dopamine Tie-Dye Swirls',
    nameEn: 'Dopamine Tie-Dye Swirls 23',
    description: 'tie-dye swirls/clouds - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: neon brights. Elements: tie-dye swirls, clouds. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_clouds_24
  dopamine_kidcore_clouds_24: {
    id: 'dopamine_kidcore_clouds_24',
    label: 'Dopamine Clouds',
    nameEn: 'Dopamine Clouds 24',
    description: 'clouds/smiley faces - rainbow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: dense sticker scatter. Colors: rainbow. Elements: clouds, smiley faces. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_25
  dopamine_kidcore_bears_25: {
    id: 'dopamine_kidcore_bears_25',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 25',
    description: 'bears/clouds - rainbow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: tie-dye background. Colors: rainbow. Elements: bears, clouds. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_26
  dopamine_kidcore_rainbows_26: {
    id: 'dopamine_kidcore_rainbows_26',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 26',
    description: 'rainbows/lollipops - rainbow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: checkerboard mix. Colors: rainbow. Elements: rainbows, lollipops. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_27
  dopamine_kidcore_smiley_faces_27: {
    id: 'dopamine_kidcore_smiley_faces_27',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 27',
    description: 'smiley faces/clouds - neon brights',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: tie-dye background. Colors: neon brights. Elements: smiley faces, clouds. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_28
  dopamine_kidcore_flowers_28: {
    id: 'dopamine_kidcore_flowers_28',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 28',
    description: 'flowers/rainbows - rainbow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: tie-dye background. Colors: rainbow. Elements: flowers, rainbows. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_tie-dye_swirls_29
  'dopamine_kidcore_tie-dye_swirls_29': {
    id: 'dopamine_kidcore_tie-dye_swirls_29',
    label: 'Dopamine Tie-Dye Swirls',
    nameEn: 'Dopamine Tie-Dye Swirls 29',
    description: 'tie-dye swirls/flowers - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: tie-dye swirls, flowers. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_30
  dopamine_kidcore_rainbows_30: {
    id: 'dopamine_kidcore_rainbows_30',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 30',
    description: 'rainbows/bears - rainbow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: checkerboard mix. Colors: rainbow. Elements: rainbows, bears. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_lollipops_31
  dopamine_kidcore_lollipops_31: {
    id: 'dopamine_kidcore_lollipops_31',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 31',
    description: 'lollipops/tie-dye swirls - rainbow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: rainbow. Elements: lollipops, tie-dye swirls. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_32
  dopamine_kidcore_rainbows_32: {
    id: 'dopamine_kidcore_rainbows_32',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 32',
    description: 'rainbows/lollipops - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: sunflower yellow. Elements: rainbows, lollipops. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_33
  dopamine_kidcore_smiley_faces_33: {
    id: 'dopamine_kidcore_smiley_faces_33',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 33',
    description: 'smiley faces/lollipops - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: sunflower yellow. Elements: smiley faces, lollipops. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_lollipops_34
  dopamine_kidcore_lollipops_34: {
    id: 'dopamine_kidcore_lollipops_34',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 34',
    description: 'lollipops/bears - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: neon brights. Elements: lollipops, bears. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_35
  dopamine_kidcore_smiley_faces_35: {
    id: 'dopamine_kidcore_smiley_faces_35',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 35',
    description: 'smiley faces/rainbows - rainbow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: rainbow. Elements: smiley faces, rainbows. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_36
  dopamine_kidcore_smiley_faces_36: {
    id: 'dopamine_kidcore_smiley_faces_36',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 36',
    description: 'smiley faces/flowers - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: checkerboard mix. Colors: sunflower yellow. Elements: smiley faces, flowers. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_bears_37
  dopamine_kidcore_bears_37: {
    id: 'dopamine_kidcore_bears_37',
    label: 'Dopamine Bears',
    nameEn: 'Dopamine Bears 37',
    description: 'bears/flowers - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: checkerboard mix. Colors: tie-dye pastel. Elements: bears, flowers. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_38
  dopamine_kidcore_rainbows_38: {
    id: 'dopamine_kidcore_rainbows_38',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 38',
    description: 'rainbows/tie-dye swirls - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: checkerboard mix. Colors: neon brights. Elements: rainbows, tie-dye swirls. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_39
  dopamine_kidcore_flowers_39: {
    id: 'dopamine_kidcore_flowers_39',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 39',
    description: 'flowers/bears - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: checkerboard mix. Colors: sunflower yellow. Elements: flowers, bears. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_40
  dopamine_kidcore_rainbows_40: {
    id: 'dopamine_kidcore_rainbows_40',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 40',
    description: 'rainbows/smiley faces - rainbow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: tie-dye background. Colors: rainbow. Elements: rainbows, smiley faces. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_41
  dopamine_kidcore_flowers_41: {
    id: 'dopamine_kidcore_flowers_41',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 41',
    description: 'flowers/rainbows - neon brights',
    prompt:
      'Style: Dopamine aesthetic (bright). Layout: dense sticker scatter. Colors: neon brights. Elements: flowers, rainbows. Vibe: bright.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_smiley_faces_42
  dopamine_kidcore_smiley_faces_42: {
    id: 'dopamine_kidcore_smiley_faces_42',
    label: 'Dopamine Smiley Faces',
    nameEn: 'Dopamine Smiley Faces 42',
    description: 'smiley faces/flowers - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: smiley faces, flowers. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_rainbows_43
  dopamine_kidcore_rainbows_43: {
    id: 'dopamine_kidcore_rainbows_43',
    label: 'Dopamine Rainbows',
    nameEn: 'Dopamine Rainbows 43',
    description: 'rainbows/smiley faces - rainbow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: dense sticker scatter. Colors: rainbow. Elements: rainbows, smiley faces. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_44
  dopamine_kidcore_flowers_44: {
    id: 'dopamine_kidcore_flowers_44',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 44',
    description: 'flowers/tie-dye swirls - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: flowers, tie-dye swirls. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_clouds_45
  dopamine_kidcore_clouds_45: {
    id: 'dopamine_kidcore_clouds_45',
    label: 'Dopamine Clouds',
    nameEn: 'Dopamine Clouds 45',
    description: 'clouds/smiley faces - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: tie-dye background. Colors: tie-dye pastel. Elements: clouds, smiley faces. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_flowers_46
  dopamine_kidcore_flowers_46: {
    id: 'dopamine_kidcore_flowers_46',
    label: 'Dopamine Flowers',
    nameEn: 'Dopamine Flowers 46',
    description: 'flowers/clouds - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: flowers, clouds. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_tie-dye_swirls_47
  'dopamine_kidcore_tie-dye_swirls_47': {
    id: 'dopamine_kidcore_tie-dye_swirls_47',
    label: 'Dopamine Tie-Dye Swirls',
    nameEn: 'Dopamine Tie-Dye Swirls 47',
    description: 'tie-dye swirls/bears - sunflower yellow',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: sunflower yellow. Elements: tie-dye swirls, bears. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_lollipops_48
  dopamine_kidcore_lollipops_48: {
    id: 'dopamine_kidcore_lollipops_48',
    label: 'Dopamine Lollipops',
    nameEn: 'Dopamine Lollipops 48',
    description: 'lollipops/smiley faces - rainbow',
    prompt:
      'Style: Dopamine aesthetic (energetic). Layout: dense sticker scatter. Colors: rainbow. Elements: lollipops, smiley faces. Vibe: energetic.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_clouds_49
  dopamine_kidcore_clouds_49: {
    id: 'dopamine_kidcore_clouds_49',
    label: 'Dopamine Clouds',
    nameEn: 'Dopamine Clouds 49',
    description: 'clouds/rainbows - neon brights',
    prompt:
      'Style: Dopamine aesthetic (playful). Layout: dense sticker scatter. Colors: neon brights. Elements: clouds, rainbows. Vibe: playful.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // dopamine_kidcore_tie-dye_swirls_50
  'dopamine_kidcore_tie-dye_swirls_50': {
    id: 'dopamine_kidcore_tie-dye_swirls_50',
    label: 'Dopamine Tie-Dye Swirls',
    nameEn: 'Dopamine Tie-Dye Swirls 50',
    description: 'tie-dye swirls/rainbows - tie-dye pastel',
    prompt:
      'Style: Dopamine aesthetic (happy). Layout: dense sticker scatter. Colors: tie-dye pastel. Elements: tie-dye swirls, rainbows. Vibe: happy.',
    tags: ['多巴胺', '彩虹', '快乐', '童趣', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_1
  pop_culture_meme_funny_chickens_1: {
    id: 'pop_culture_meme_funny_chickens_1',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 1',
    description: 'funny chickens/memetic text - primary red',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: central mascot. Colors: primary red. Elements: funny chickens, memetic text. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_2
  pop_culture_meme_cats_2: {
    id: 'pop_culture_meme_cats_2',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 2',
    description: 'cats/funny chickens - white',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: white. Elements: cats, funny chickens. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_3
  pop_culture_meme_pixel_art_3: {
    id: 'pop_culture_meme_pixel_art_3',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 3',
    description: 'pixel art/funny chickens - blue',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: blue. Elements: pixel art, funny chickens. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_sunglasses_4
  pop_culture_meme_sunglasses_4: {
    id: 'pop_culture_meme_sunglasses_4',
    label: 'Pop Meme Sunglasses',
    nameEn: 'Pop Meme Sunglasses 4',
    description: 'sunglasses/cats - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: grid of memes. Colors: white. Elements: sunglasses, cats. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_sunglasses_5
  pop_culture_meme_sunglasses_5: {
    id: 'pop_culture_meme_sunglasses_5',
    label: 'Pop Meme Sunglasses',
    nameEn: 'Pop Meme Sunglasses 5',
    description: 'sunglasses/pixel art - primary red',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: primary red. Elements: sunglasses, pixel art. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_6
  pop_culture_meme_funny_chickens_6: {
    id: 'pop_culture_meme_funny_chickens_6',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 6',
    description: 'funny chickens/bananas - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: text heavy repeat. Colors: white. Elements: funny chickens, bananas. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_7
  pop_culture_meme_cats_7: {
    id: 'pop_culture_meme_cats_7',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 7',
    description: 'cats/pixel art - primary red',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: text heavy repeat. Colors: primary red. Elements: cats, pixel art. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_8
  pop_culture_meme_pixel_art_8: {
    id: 'pop_culture_meme_pixel_art_8',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 8',
    description: 'pixel art/cats - primary red',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: central mascot. Colors: primary red. Elements: pixel art, cats. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_9
  pop_culture_meme_funny_chickens_9: {
    id: 'pop_culture_meme_funny_chickens_9',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 9',
    description: 'funny chickens/bananas - blue',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: blue. Elements: funny chickens, bananas. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_memetic_text_10
  pop_culture_meme_memetic_text_10: {
    id: 'pop_culture_meme_memetic_text_10',
    label: 'Pop Meme Memetic Text',
    nameEn: 'Pop Meme Memetic Text 10',
    description: 'memetic text/bananas - white',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: central mascot. Colors: white. Elements: memetic text, bananas. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_11
  pop_culture_meme_funny_chickens_11: {
    id: 'pop_culture_meme_funny_chickens_11',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 11',
    description: 'funny chickens/pixel art - primary red',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: central mascot. Colors: primary red. Elements: funny chickens, pixel art. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_12
  pop_culture_meme_bananas_12: {
    id: 'pop_culture_meme_bananas_12',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 12',
    description: 'bananas/memetic text - white',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: white. Elements: bananas, memetic text. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_13
  pop_culture_meme_cats_13: {
    id: 'pop_culture_meme_cats_13',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 13',
    description: 'cats/sunglasses - yellow',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: text heavy repeat. Colors: yellow. Elements: cats, sunglasses. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_14
  pop_culture_meme_funny_chickens_14: {
    id: 'pop_culture_meme_funny_chickens_14',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 14',
    description: 'funny chickens/sunglasses - yellow',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: yellow. Elements: funny chickens, sunglasses. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_sunglasses_15
  pop_culture_meme_sunglasses_15: {
    id: 'pop_culture_meme_sunglasses_15',
    label: 'Pop Meme Sunglasses',
    nameEn: 'Pop Meme Sunglasses 15',
    description: 'sunglasses/memetic text - blue',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: blue. Elements: sunglasses, memetic text. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_16
  pop_culture_meme_pixel_art_16: {
    id: 'pop_culture_meme_pixel_art_16',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 16',
    description: 'pixel art/memetic text - white',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: central mascot. Colors: white. Elements: pixel art, memetic text. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_17
  pop_culture_meme_funny_chickens_17: {
    id: 'pop_culture_meme_funny_chickens_17',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 17',
    description: 'funny chickens/sunglasses - yellow',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: text heavy repeat. Colors: yellow. Elements: funny chickens, sunglasses. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_18
  pop_culture_meme_cats_18: {
    id: 'pop_culture_meme_cats_18',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 18',
    description: 'cats/pixel art - primary red',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: primary red. Elements: cats, pixel art. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_19
  pop_culture_meme_funny_chickens_19: {
    id: 'pop_culture_meme_funny_chickens_19',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 19',
    description: 'funny chickens/cats - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: grid of memes. Colors: white. Elements: funny chickens, cats. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_sunglasses_20
  pop_culture_meme_sunglasses_20: {
    id: 'pop_culture_meme_sunglasses_20',
    label: 'Pop Meme Sunglasses',
    nameEn: 'Pop Meme Sunglasses 20',
    description: 'sunglasses/bananas - yellow',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: yellow. Elements: sunglasses, bananas. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_21
  pop_culture_meme_bananas_21: {
    id: 'pop_culture_meme_bananas_21',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 21',
    description: 'bananas/memetic text - primary red',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: central mascot. Colors: primary red. Elements: bananas, memetic text. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_22
  pop_culture_meme_bananas_22: {
    id: 'pop_culture_meme_bananas_22',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 22',
    description: 'bananas/funny chickens - primary red',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: central mascot. Colors: primary red. Elements: bananas, funny chickens. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_23
  pop_culture_meme_bananas_23: {
    id: 'pop_culture_meme_bananas_23',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 23',
    description: 'bananas/funny chickens - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: text heavy repeat. Colors: white. Elements: bananas, funny chickens. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_24
  pop_culture_meme_funny_chickens_24: {
    id: 'pop_culture_meme_funny_chickens_24',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 24',
    description: 'funny chickens/pixel art - white',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: text heavy repeat. Colors: white. Elements: funny chickens, pixel art. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_memetic_text_25
  pop_culture_meme_memetic_text_25: {
    id: 'pop_culture_meme_memetic_text_25',
    label: 'Pop Meme Memetic Text',
    nameEn: 'Pop Meme Memetic Text 25',
    description: 'memetic text/bananas - yellow',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: grid of memes. Colors: yellow. Elements: memetic text, bananas. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_26
  pop_culture_meme_bananas_26: {
    id: 'pop_culture_meme_bananas_26',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 26',
    description: 'bananas/memetic text - yellow',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: grid of memes. Colors: yellow. Elements: bananas, memetic text. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_27
  pop_culture_meme_funny_chickens_27: {
    id: 'pop_culture_meme_funny_chickens_27',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 27',
    description: 'funny chickens/cats - yellow',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: text heavy repeat. Colors: yellow. Elements: funny chickens, cats. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_28
  pop_culture_meme_pixel_art_28: {
    id: 'pop_culture_meme_pixel_art_28',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 28',
    description: 'pixel art/memetic text - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: white. Elements: pixel art, memetic text. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_sunglasses_29
  pop_culture_meme_sunglasses_29: {
    id: 'pop_culture_meme_sunglasses_29',
    label: 'Pop Meme Sunglasses',
    nameEn: 'Pop Meme Sunglasses 29',
    description: 'sunglasses/pixel art - blue',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: central mascot. Colors: blue. Elements: sunglasses, pixel art. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_30
  pop_culture_meme_cats_30: {
    id: 'pop_culture_meme_cats_30',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 30',
    description: 'cats/memetic text - white',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: white. Elements: cats, memetic text. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_31
  pop_culture_meme_cats_31: {
    id: 'pop_culture_meme_cats_31',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 31',
    description: 'cats/pixel art - yellow',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: text heavy repeat. Colors: yellow. Elements: cats, pixel art. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_32
  pop_culture_meme_funny_chickens_32: {
    id: 'pop_culture_meme_funny_chickens_32',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 32',
    description: 'funny chickens/memetic text - primary red',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: central mascot. Colors: primary red. Elements: funny chickens, memetic text. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_33
  pop_culture_meme_bananas_33: {
    id: 'pop_culture_meme_bananas_33',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 33',
    description: 'bananas/sunglasses - blue',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: blue. Elements: bananas, sunglasses. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_34
  pop_culture_meme_pixel_art_34: {
    id: 'pop_culture_meme_pixel_art_34',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 34',
    description: 'pixel art/bananas - primary red',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: primary red. Elements: pixel art, bananas. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_35
  pop_culture_meme_funny_chickens_35: {
    id: 'pop_culture_meme_funny_chickens_35',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 35',
    description: 'funny chickens/sunglasses - white',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: grid of memes. Colors: white. Elements: funny chickens, sunglasses. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_36
  pop_culture_meme_bananas_36: {
    id: 'pop_culture_meme_bananas_36',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 36',
    description: 'bananas/funny chickens - yellow',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: yellow. Elements: bananas, funny chickens. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_37
  pop_culture_meme_cats_37: {
    id: 'pop_culture_meme_cats_37',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 37',
    description: 'cats/funny chickens - yellow',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: central mascot. Colors: yellow. Elements: cats, funny chickens. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_38
  pop_culture_meme_pixel_art_38: {
    id: 'pop_culture_meme_pixel_art_38',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 38',
    description: 'pixel art/cats - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: white. Elements: pixel art, cats. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_memetic_text_39
  pop_culture_meme_memetic_text_39: {
    id: 'pop_culture_meme_memetic_text_39',
    label: 'Pop Meme Memetic Text',
    nameEn: 'Pop Meme Memetic Text 39',
    description: 'memetic text/funny chickens - primary red',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: grid of memes. Colors: primary red. Elements: memetic text, funny chickens. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_40
  pop_culture_meme_cats_40: {
    id: 'pop_culture_meme_cats_40',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 40',
    description: 'cats/pixel art - blue',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: grid of memes. Colors: blue. Elements: cats, pixel art. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_funny_chickens_41
  pop_culture_meme_funny_chickens_41: {
    id: 'pop_culture_meme_funny_chickens_41',
    label: 'Pop Meme Funny Chickens',
    nameEn: 'Pop Meme Funny Chickens 41',
    description: 'funny chickens/pixel art - yellow',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: yellow. Elements: funny chickens, pixel art. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_42
  pop_culture_meme_cats_42: {
    id: 'pop_culture_meme_cats_42',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 42',
    description: 'cats/bananas - white',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: white. Elements: cats, bananas. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_memetic_text_43
  pop_culture_meme_memetic_text_43: {
    id: 'pop_culture_meme_memetic_text_43',
    label: 'Pop Meme Memetic Text',
    nameEn: 'Pop Meme Memetic Text 43',
    description: 'memetic text/pixel art - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: grid of memes. Colors: white. Elements: memetic text, pixel art. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_44
  pop_culture_meme_bananas_44: {
    id: 'pop_culture_meme_bananas_44',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 44',
    description: 'bananas/sunglasses - yellow',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: central mascot. Colors: yellow. Elements: bananas, sunglasses. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_45
  pop_culture_meme_cats_45: {
    id: 'pop_culture_meme_cats_45',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 45',
    description: 'cats/funny chickens - white',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: grid of memes. Colors: white. Elements: cats, funny chickens. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_46
  pop_culture_meme_cats_46: {
    id: 'pop_culture_meme_cats_46',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 46',
    description: 'cats/pixel art - yellow',
    prompt:
      'Style: Pop Meme aesthetic (viral). Layout: text heavy repeat. Colors: yellow. Elements: cats, pixel art. Vibe: viral.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_pixel_art_47
  pop_culture_meme_pixel_art_47: {
    id: 'pop_culture_meme_pixel_art_47',
    label: 'Pop Meme Pixel Art',
    nameEn: 'Pop Meme Pixel Art 47',
    description: 'pixel art/funny chickens - primary red',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: central mascot. Colors: primary red. Elements: pixel art, funny chickens. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_bananas_48
  pop_culture_meme_bananas_48: {
    id: 'pop_culture_meme_bananas_48',
    label: 'Pop Meme Bananas',
    nameEn: 'Pop Meme Bananas 48',
    description: 'bananas/funny chickens - blue',
    prompt:
      'Style: Pop Meme aesthetic (ironic). Layout: grid of memes. Colors: blue. Elements: bananas, funny chickens. Vibe: ironic.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_cats_49
  pop_culture_meme_cats_49: {
    id: 'pop_culture_meme_cats_49',
    label: 'Pop Meme Cats',
    nameEn: 'Pop Meme Cats 49',
    description: 'cats/memetic text - yellow',
    prompt:
      'Style: Pop Meme aesthetic (humorous). Layout: grid of memes. Colors: yellow. Elements: cats, memetic text. Vibe: humorous.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  },

  // pop_culture_meme_memetic_text_50
  pop_culture_meme_memetic_text_50: {
    id: 'pop_culture_meme_memetic_text_50',
    label: 'Pop Meme Memetic Text',
    nameEn: 'Pop Meme Memetic Text 50',
    description: 'memetic text/funny chickens - white',
    prompt:
      'Style: Pop Meme aesthetic (fun). Layout: central mascot. Colors: white. Elements: memetic text, funny chickens. Vibe: fun.',
    tags: ['趣味', '梗', '流行', '搞笑', 'Pattern', '2025Trend'],
    category: 'pattern'
  }
}

/**
 * 复杂图案风格预设注册表
 * Complex Pattern Style Preset Registry
 *
 * 提供分类、搜索、过滤功能
 */
export const COMPLEX_PATTERN_STYLE_PRESETS = {
  /** 所有预设定义 */
  presets: COMPLEX_PATTERN_STYLE_DEFINITIONS,

  /**
   * 获取下拉选项列表
   */
  getOptions(): Array<{ id: string; name: string; description?: string }> {
    return Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS).map((preset) => ({
      id: preset.id,
      name: preset.label,
      description: preset.description
    }))
  },

  /**
   * 获取指定预设
   */
  getPreset(id: string): PatternStylePresetDefinition | undefined {
    return COMPLEX_PATTERN_STYLE_DEFINITIONS[id]
  },

  /**
   * 获取所有预设列表
   */
  getAllPresets(): PatternStylePresetDefinition[] {
    return Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS)
  },

  /**
   * 按分类获取预设列表
   */
  getPresetsByCategory(category?: ComplexPresetCategory): PatternStylePresetDefinition[] {
    const all = Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS)
    if (!category) return all
    return all.filter((preset) => preset.category === category)
  },

  /**
   * 搜索预设（按名称、描述、标签）
   */
  searchPresets(keyword: string): PatternStylePresetDefinition[] {
    const kw = keyword.toLowerCase()
    return Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS).filter(
      (preset) =>
        preset.label.toLowerCase().includes(kw) ||
        preset.nameEn.toLowerCase().includes(kw) ||
        (preset.description && preset.description.toLowerCase().includes(kw)) ||
        preset.tags.some((tag) => tag.toLowerCase().includes(kw))
    )
  },

  /**
   * 按标签过滤预设
   */
  getPresetsByTag(tag: string): PatternStylePresetDefinition[] {
    return Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS).filter((preset) => preset.tags.some((t) => t === tag))
  },

  /**
   * 获取所有可用标签
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>()
    Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS).forEach((preset) => {
      preset.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  },

  /**
   * 获取所有可用分类
   */
  getAllCategories(): ComplexPresetCategory[] {
    const categorySet = new Set<ComplexPresetCategory>()
    Object.values(COMPLEX_PATTERN_STYLE_DEFINITIONS).forEach((preset) => {
      categorySet.add(preset.category)
    })
    return Array.from(categorySet)
  }
}
