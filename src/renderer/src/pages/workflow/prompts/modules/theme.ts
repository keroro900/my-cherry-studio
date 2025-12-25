/**
 * 主题模块
 * Theme Module
 *
 * 处理背景主题和道具匹配
 * 基于服装分析结果动态生成主题提示词
 */

import type { GarmentAnalysis, PromptModule } from './types'

/**
 * IP 角色主题映射
 */
const IP_THEMES: Record<string, { background: string; props: string }> = {
  dinosaur: {
    background: 'Prehistoric adventure scene, earth tones',
    props: 'Dinosaur toys (T-Rex, Triceratops), green plants, rocks'
  },
  unicorn: {
    background: 'Magical fairy tale corner, sparkly elements',
    props: 'Wands, crowns, rainbow decorations, pink/purple fluffy textures'
  },
  princess: {
    background: 'Magical fairy tale corner, sparkly elements',
    props: 'Tiaras, wands, pink fluffy blankets, fairy lights'
  },
  hello_kitty: {
    background: 'Pink themed setup, pastel decorations',
    props: 'Hello Kitty plushies, bows, sweet pastel items'
  },
  sanrio: {
    background: 'Pastel kawaii setup',
    props: 'Character plushies, bows, cute decorations'
  },
  frozen: {
    background: 'Ice/snow theme, blue/white colors',
    props: 'Snowflake decorations, sparkly elements, ice crystals'
  },
  elsa: {
    background: 'Ice palace theme, blue/white/silver',
    props: 'Snowflakes, sparkles, ice-themed props'
  },
  spiderman: {
    background: 'City backdrop, web patterns',
    props: 'Red/blue color scheme props, web decorations'
  },
  cars: {
    background: 'Road themed, checkered patterns',
    props: 'Toy vehicles, traffic signs, checkered flag'
  },
  paw_patrol: {
    background: 'Rescue-themed scene',
    props: 'Paw prints, badge decorations, rescue props'
  },
  bluey: {
    background: 'Family-friendly scene, blue/orange colors',
    props: 'Australian-themed elements, playful props'
  },
  harry_potter: {
    background: 'Magical study room, Hogwarts atmosphere',
    props: 'Owls, spell books, parchment, candles, dark wood'
  },
  space: {
    background: 'Galaxy theme, navy blue backdrop',
    props: 'Star decorations, planet models, astronaut toys'
  },
  gaming: {
    background: 'Gaming setup feel, LED accents',
    props: 'Controllers, pixel art decor, gaming accessories'
  }
}

/**
 * 风格主题映射
 */
const STYLE_THEMES: Record<string, { background: string; props: string; lighting: string }> = {
  sweet: {
    background: 'Light pink or cream warm background',
    props: 'Strawberries, cherries, teddy bears, bows',
    lighting: 'Soft warm light'
  },
  pajamas: {
    background: 'Cozy bedroom scene, bedding and blankets',
    props: 'Pillows, blankets, eye masks, night lights',
    lighting: 'Warm soft light'
  },
  sporty: {
    background: 'Sports venue or outdoor scene',
    props: 'Sports equipment, water bottles, athletic gear',
    lighting: 'Bright energetic light'
  },
  soccer: {
    background: 'Green grass texture, sporty atmosphere',
    props: 'Soccer balls, mini goal posts, cone markers',
    lighting: 'Bright outdoor light'
  },
  basketball: {
    background: 'Court floor texture, orange/black scheme',
    props: 'Basketballs, hoop decorations',
    lighting: 'Indoor sports lighting'
  },
  street: {
    background: 'Urban street or industrial style',
    props: 'Skateboard, graffiti elements, sneakers',
    lighting: 'Strong contrast light'
  },
  kpop: {
    background: 'Clean modern background',
    props: 'Korean style items, minimalist accessories',
    lighting: 'Soft even light'
  },
  school: {
    background: 'Campus or library scene',
    props: 'Books, stationery, backpacks',
    lighting: 'Bright natural light'
  },
  summer: {
    background: 'Beach ocean or outdoor grass field',
    props: 'Sunglasses, straw hats, cold drinks',
    lighting: 'Bright sunny light'
  },
  minimalist: {
    background: 'Clean white or light gray only',
    props: 'No props or minimal accessories',
    lighting: 'Soft even studio light'
  }
}

/**
 * 主题模块
 */
export const ThemeModule = {
  /**
   * 根据预设风格获取主题模块
   * @param styleId 风格 ID
   */
  get(styleId: string): PromptModule {
    const theme = STYLE_THEMES[styleId]
    if (!theme) {
      // 默认使用简约风格
      return this.get('minimalist')
    }

    const text = `[Theme: ${styleId}]
Background: ${theme.background}
Props: ${theme.props}
Lighting: ${theme.lighting}`

    return {
      type: 'theme',
      text,
      priority: 70
    }
  },

  /**
   * 根据 IP 角色获取主题模块
   * @param ipCharacter IP 角色名称
   */
  getByIP(ipCharacter: string): PromptModule {
    // 标准化 IP 名称
    const normalizedIP = ipCharacter.toLowerCase().replace(/[\s-]/g, '_')

    // 查找匹配的 IP 主题
    let ipTheme = IP_THEMES[normalizedIP]

    // 尝试模糊匹配
    if (!ipTheme) {
      for (const [key, value] of Object.entries(IP_THEMES)) {
        if (normalizedIP.includes(key) || key.includes(normalizedIP)) {
          ipTheme = value
          break
        }
      }
    }

    if (!ipTheme) {
      // 未找到匹配的 IP，返回通用 IP 主题
      return {
        type: 'theme',
        text: `[Theme: IP Character - ${ipCharacter}]
Background: Theme background designed based on ${ipCharacter} character
Props: Related ${ipCharacter} merchandise and character elements
Create immersive atmosphere matching the IP character.`,
        priority: 70
      }
    }

    return {
      type: 'theme',
      text: `[Theme: ${ipCharacter}]
Background: ${ipTheme.background}
Props: ${ipTheme.props}
Create immersive atmosphere matching the character theme.`,
      priority: 70
    }
  },

  /**
   * 根据服装分析结果动态生成主题
   * 这是「视觉创意总监」的核心能力
   * @param analysis 服装分析结果
   */
  fromAnalysis(analysis: GarmentAnalysis): PromptModule {
    // 如果有 IP 角色，优先使用 IP 主题
    if (analysis.ip_character) {
      const ipModule = this.getByIP(analysis.ip_character)

      // 如果同时是睡衣，混合睡衣主题
      if (
        analysis.garment_type?.toLowerCase().includes('pajama') ||
        analysis.theme?.toLowerCase().includes('sleepwear')
      ) {
        const pajamaTheme = STYLE_THEMES.pajamas
        return {
          type: 'theme',
          text: `${ipModule.text}
[Sleepwear Overlay]
Add cozy elements: ${pajamaTheme.props}
Lighting: ${pajamaTheme.lighting}`,
          priority: 70
        }
      }

      return ipModule
    }

    // 如果有推荐的背景和道具（来自分析结果）
    if (analysis.recommended_background || analysis.recommended_props) {
      return {
        type: 'theme',
        text: `[Theme: AI Recommended]
Background: ${analysis.recommended_background || 'Clean studio background'}
Props: ${analysis.recommended_props?.join(', ') || 'Minimal props'}
Lighting: ${analysis.recommended_lighting || 'Soft even light'}`,
        priority: 70
      }
    }

    // 根据主题风格选择
    if (analysis.theme) {
      const normalizedTheme = analysis.theme.toLowerCase()
      for (const key of Object.keys(STYLE_THEMES)) {
        if (normalizedTheme.includes(key)) {
          return this.get(key)
        }
      }
    }

    // 默认简约风格
    return this.get('minimalist')
  },

  /**
   * 获取所有可用的风格类型
   */
  getStyleTypes(): string[] {
    return Object.keys(STYLE_THEMES)
  },

  /**
   * 获取所有可用的 IP 类型
   */
  getIPTypes(): string[] {
    return Object.keys(IP_THEMES)
  }
}
