/**
 * Trend Dimension Presets
 * 趋势分析维度预设
 *
 * 定义各维度的分析要点和提示词
 */

/**
 * 趋势维度预设接口
 */
export interface TrendDimensionPreset {
  /** 预设 ID */
  id: string
  /** 英文名称 */
  name: string
  /** 中文名称 */
  nameZh: string
  /** 描述 */
  description: string
  /** 分析提示词 */
  analysisPrompt: string
  /** 输出字段 */
  outputFields: string[]
}

/**
 * 趋势维度预设定义
 */
export const TREND_DIMENSION_PRESETS: Record<string, TrendDimensionPreset> = {
  color: {
    id: 'color',
    name: 'Color Trends',
    nameZh: '颜色趋势',
    description: '分析流行色彩和配色方案',
    analysisPrompt: `Analyze color trends:
- Identify dominant colors across the dataset
- Note color combinations and palettes
- Track seasonal color shifts
- Identify emerging and declining colors
- Consider color psychology and market appeal`,
    outputFields: ['colorName', 'hexCode', 'popularity', 'trend', 'season', 'pairedColors']
  },
  pattern: {
    id: 'pattern',
    name: 'Pattern Trends',
    nameZh: '图案趋势',
    description: '分析流行图案和印花',
    analysisPrompt: `Analyze pattern trends:
- Identify popular print types (floral, geometric, abstract, IP character)
- Note pattern scale preferences (small, medium, large)
- Track pattern placement trends
- Identify emerging pattern themes
- Consider cultural and seasonal influences`,
    outputFields: ['patternType', 'scale', 'placement', 'popularity', 'trend', 'themes']
  },
  silhouette: {
    id: 'silhouette',
    name: 'Silhouette Trends',
    nameZh: '版型趋势',
    description: '分析流行版型和剪裁',
    analysisPrompt: `Analyze silhouette trends:
- Identify popular fits (oversized, fitted, relaxed)
- Note length preferences for different categories
- Track structural detail trends (ruffles, pleats, asymmetry)
- Identify emerging silhouette innovations
- Consider comfort and lifestyle factors`,
    outputFields: ['fitType', 'length', 'structuralDetails', 'popularity', 'trend', 'targetAge']
  },
  style: {
    id: 'style',
    name: 'Style Trends',
    nameZh: '风格趋势',
    description: '分析整体风格走向',
    analysisPrompt: `Analyze style trends:
- Identify dominant style categories (streetwear, minimalist, romantic, Y2K)
- Note cross-category styling influences
- Track lifestyle-driven style shifts
- Identify emerging aesthetic movements
- Consider social media and cultural influences`,
    outputFields: ['styleName', 'description', 'keyElements', 'popularity', 'trend', 'influencers']
  },
  material: {
    id: 'material',
    name: 'Material Trends',
    nameZh: '面料趋势',
    description: '分析流行面料和材质',
    analysisPrompt: `Analyze material trends:
- Identify popular fabric types (cotton, linen, synthetic blends)
- Note texture preferences (smooth, textured, ribbed)
- Track sustainable material adoption
- Identify emerging fabric technologies
- Consider comfort, sustainability, and cost factors`,
    outputFields: ['materialType', 'texture', 'sustainability', 'popularity', 'trend', 'pricePoint']
  },
  detail: {
    id: 'detail',
    name: 'Detail Trends',
    nameZh: '细节趋势',
    description: '分析流行设计细节',
    analysisPrompt: `Analyze design detail trends:
- Identify popular decorative elements (embroidery, beading, cutouts)
- Note hardware trends (buttons, zippers, buckles)
- Track finishing details (hems, seams, edges)
- Identify emerging embellishment techniques
- Consider craftsmanship and perceived value`,
    outputFields: ['detailType', 'placement', 'technique', 'popularity', 'trend', 'costImpact']
  },
  occasion: {
    id: 'occasion',
    name: 'Occasion Trends',
    nameZh: '场景趋势',
    description: '分析不同场景的穿搭趋势',
    analysisPrompt: `Analyze occasion-based trends:
- Identify casual vs formal wear shifts
- Note work-from-home influence on clothing
- Track athleisure and loungewear evolution
- Identify special occasion trends
- Consider lifestyle changes and social factors`,
    outputFields: ['occasionType', 'dressCode', 'keyPieces', 'popularity', 'trend', 'lifestyle']
  }
}

/**
 * 获取趋势维度预设
 * @param dimensionId 维度 ID
 */
export function getTrendDimensionPreset(dimensionId: string): TrendDimensionPreset | undefined {
  return TREND_DIMENSION_PRESETS[dimensionId]
}

/**
 * 获取所有趋势维度预设键
 */
export function getTrendDimensionPresetKeys(): string[] {
  return Object.keys(TREND_DIMENSION_PRESETS)
}

/**
 * 获取维度选项列表（用于多选）
 */
export function getTrendDimensionOptions(): Array<{ label: string; value: string; description: string }> {
  return Object.values(TREND_DIMENSION_PRESETS).map((preset) => ({
    label: preset.nameZh,
    value: preset.id,
    description: preset.description
  }))
}

/**
 * 构建多维度分析提示词
 * @param dimensionIds 维度 ID 列表
 */
export function buildDimensionAnalysisPrompt(dimensionIds: string[]): string {
  const prompts = dimensionIds
    .map((id) => {
      const preset = getTrendDimensionPreset(id)
      if (!preset) return ''
      return `### ${preset.nameZh} (${preset.name})\n${preset.analysisPrompt}`
    })
    .filter(Boolean)

  return prompts.join('\n\n')
}
