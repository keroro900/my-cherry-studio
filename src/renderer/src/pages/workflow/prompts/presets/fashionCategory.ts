/**
 * Fashion Category Presets
 * 服装品类预设
 *
 * 定义各服装品类的分析要点和子类别
 */

/**
 * 服装品类预设接口
 */
export interface FashionCategoryPreset {
  /** 预设 ID */
  id: string
  /** 英文名称 */
  name: string
  /** 中文名称 */
  nameZh: string
  /** 子类别列表 */
  subcategories: string[]
  /** 分析提示词 */
  analysisPrompt: string
  /** 关键分析点 */
  keyFeatures: string[]
}

/**
 * 服装品类预设定义
 */
export const FASHION_CATEGORY_PRESETS: Record<string, FashionCategoryPreset> = {
  tops: {
    id: 'tops',
    name: 'Tops',
    nameZh: '上装',
    subcategories: ['t-shirt', 'blouse', 'sweater', 'hoodie', 'tank-top', 'polo', 'crop-top', 'cardigan'],
    analysisPrompt: 'Focus on collar type, sleeve length, neckline, and print placement.',
    keyFeatures: ['collar', 'neckline', 'sleeve_length', 'hem_style', 'fit']
  },
  bottoms: {
    id: 'bottoms',
    name: 'Bottoms',
    nameZh: '下装',
    subcategories: ['jeans', 'pants', 'skirt', 'shorts', 'leggings', 'trousers', 'culottes'],
    analysisPrompt: 'Focus on waistband, leg shape, length, and pocket style.',
    keyFeatures: ['waistband', 'leg_shape', 'length', 'pockets', 'closure']
  },
  dresses: {
    id: 'dresses',
    name: 'Dresses',
    nameZh: '连衣裙',
    subcategories: ['maxi', 'midi', 'mini', 'bodycon', 'a-line', 'shift', 'wrap', 'shirt-dress'],
    analysisPrompt: 'Focus on silhouette, hemline, neckline, and overall flow.',
    keyFeatures: ['silhouette', 'hemline', 'neckline', 'waist_definition', 'sleeve_style']
  },
  outerwear: {
    id: 'outerwear',
    name: 'Outerwear',
    nameZh: '外套',
    subcategories: ['jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench', 'bomber'],
    analysisPrompt: 'Focus on closure type, collar/lapel, length, and layering potential.',
    keyFeatures: ['closure', 'collar_lapel', 'length', 'pockets', 'lining']
  },
  activewear: {
    id: 'activewear',
    name: 'Activewear',
    nameZh: '运动装',
    subcategories: ['sports-bra', 'leggings', 'joggers', 'tank', 'shorts', 'windbreaker'],
    analysisPrompt: 'Focus on performance features, stretch, moisture-wicking, and athletic styling.',
    keyFeatures: ['fabric_tech', 'stretch', 'ventilation', 'support', 'reflective_details']
  },
  swimwear: {
    id: 'swimwear',
    name: 'Swimwear',
    nameZh: '泳装',
    subcategories: ['bikini', 'one-piece', 'tankini', 'swim-shorts', 'cover-up'],
    analysisPrompt: 'Focus on coverage, strap style, cut, and decorative elements.',
    keyFeatures: ['coverage', 'strap_style', 'cut', 'lining', 'hardware']
  },
  sleepwear: {
    id: 'sleepwear',
    name: 'Sleepwear',
    nameZh: '睡衣',
    subcategories: ['pajama-set', 'nightgown', 'robe', 'loungewear', 'sleep-shirt'],
    analysisPrompt: 'Focus on comfort features, fabric softness, and relaxed fit.',
    keyFeatures: ['fabric_softness', 'fit', 'closure', 'matching_set', 'trim_details']
  },
  accessories: {
    id: 'accessories',
    name: 'Accessories',
    nameZh: '配饰',
    subcategories: ['hat', 'scarf', 'belt', 'bag', 'jewelry', 'sunglasses', 'socks'],
    analysisPrompt: 'Focus on material, size, styling versatility, and decorative details.',
    keyFeatures: ['material', 'size', 'closure', 'hardware', 'branding']
  }
}

/**
 * 获取服装品类预设
 * @param categoryId 品类 ID
 */
export function getFashionCategoryPreset(categoryId: string): FashionCategoryPreset | undefined {
  return FASHION_CATEGORY_PRESETS[categoryId]
}

/**
 * 获取所有服装品类预设键
 */
export function getFashionCategoryPresetKeys(): string[] {
  return Object.keys(FASHION_CATEGORY_PRESETS)
}

/**
 * 获取品类选项列表（用于下拉选择）
 */
export function getFashionCategoryOptions(): Array<{ label: string; value: string }> {
  return Object.values(FASHION_CATEGORY_PRESETS).map((preset) => ({
    label: preset.nameZh,
    value: preset.id
  }))
}
