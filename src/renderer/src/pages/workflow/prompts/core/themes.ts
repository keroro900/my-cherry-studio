/**
 * 主题背景规则（单一来源）
 * Theme Background Rules (Single Source of Truth)
 *
 * v4.0 详细版：完整的 IP 主题映射和背景道具规则
 * 各节点通过导入此模块获取统一的主题匹配规则
 */

// ==================== 主题背景自动匹配规则 ====================

/**
 * 主题匹配背景和道具映射（关键！）
 * 背景必须创造沉浸式氛围，不要用通用的纯白背景
 *
 * IP 角色主题服装映射完整列表
 */
export const THEME_BACKGROUND_RULES = `[Theme-Matched Background System - CRITICAL]

**Core Principle**: Background MUST create immersive atmosphere matching the garment theme.
DO NOT use generic plain backgrounds for themed garments.

**IP CHARACTER THEMED GARMENTS**:
- Harry Potter → Magical study room, owls, spell books, parchment scrolls, candles, Hogwarts atmosphere, dark wood desk
- Dinosaur prints → Prehistoric adventure scene, dinosaur toys (T-Rex, Triceratops), green plants, rocks, earth tones
- Unicorn/Princess → Magical fairy tale corner, sparkly wands, crowns, rainbow elements, pink/purple fluffy textures
- Hello Kitty/Sanrio → Pink themed setup, character plushies, bows, sweet pastel decorations
- Cars/Trucks/Lightning McQueen → Road themed, toy vehicles, traffic signs, checkered flag, blue/red accents
- Space/Rocket → Galaxy theme, star decorations, planet models, astronaut toys, navy blue backdrop
- Gaming/Controller → Gaming setup feel, controllers, pixel art decor, LED accent lighting
- Spider-Man/Superhero → City backdrop elements, web patterns, red/blue color scheme props
- Frozen/Elsa → Ice/snow theme, blue/white colors, snowflake decorations, sparkly elements
- Paw Patrol → Paw prints, badge decorations, rescue-themed props
- Bluey → Blue/orange colors, family-friendly props, Australian-themed elements

**SPORTS THEMED GARMENTS**:
- Soccer/Football prints → Soccer balls (2-3 different sizes), mini goal posts, green grass mat/texture, whistle, cone markers
- Basketball prints → Mini basketballs, hoop decorations, orange/black color scheme, court floor texture
- Baseball prints → Baseball gloves, baseballs, caps, diamond/field elements
- General sports → Trophies, medals, water bottles, athletic equipment, sporty color accents

**SLEEPWEAR/LOUNGEWEAR**:
- General pajamas → Soft fluffy blankets (white/cream/pink), pillows, eye masks, bedside books, plush toys, cozy bedroom atmosphere
- Themed pajamas → COMBINE sleepwear props WITH theme-specific props
  * Soccer pajamas = Soccer balls + cozy blanket + sports-themed pillow
  * Dinosaur pajamas = Dinosaur toys + fluffy blanket + adventure books
  * Princess pajamas = Sparkly wand + pink fluffy blanket + fairy lights

**SWEET/CUTE STYLE GARMENTS**:
- Strawberry/Fruit prints → Fresh fruits (strawberries, cherries), juice boxes, cute snack props, wooden surface
- Heart/Love themes → Heart-shaped pillows, love-themed decorations, pink/red accents
- Bow/Ribbon themes → Ribbon decorations, gift boxes, feminine accessories
- Floral prints → Fresh flowers, flower vases, garden-themed props

**STREET/COOL STYLE GARMENTS**:
- Black, flames, spider web, hero silhouettes → Concrete floor texture, wooden crates, industrial elements
- Skateboard/BMX themes → Skateboards, graffiti elements, urban props
- Props: Sneakers, baseball caps, sunglasses

**MINIMALIST/SOLID COLOR GARMENTS (ONLY for these)**:
- Plain solid color garments with no prints → Clean white/gray background is acceptable
- Basic stripes or simple patterns → Minimal props or no props
- Focus on garment silhouette and fabric quality`

// ==================== 专业造型规则 ====================

/**
 * 专业服装造型规则
 * 如何摆放/定位服装（与背景分开考虑）
 */
export const PROFESSIONAL_STYLING_RULES = `[Professional Garment Styling Rules - DO NOT Copy Reference Layout]

**Core Principle**: Reference images only provide garment information, positioning must be professionally re-designed.
The garment itself should be clean and professionally arranged, while the background provides theme atmosphere.

**Top Garment Styling**:
- Shoulder line horizontal and clear, maintain natural proportions
- Body slightly tilted 3-8 degrees to one side, avoid "ID photo" straight-on look
- Long sleeves naturally bent 20-60 degrees, forming elegant relaxed curve
- Cuffs can slightly bend inward or rest near waistband area
- Body silhouette clear, dimensional, neat with smooth lines

**Bottom Garment Styling**:
- Two pant legs slightly spread forming gentle "V" shape
- One leg can be slightly bent or offset 5-15 degrees for dynamic feel
- Pant legs flat and neat, showing details (ribbed cuffs, cuffs, ankle details)
- Patterned pants can rotate 5-10 degrees to show pattern dynamically

**Top-Bottom Set Relationship**:
- Top hem can lightly rest 1-3cm above waistband, creating coordinated layered look
- Or leave 1-2cm "breathing room" between them for clean separation
- Overall should clearly read as a coordinated set, not two separate items

**Professional Retouching (CRITICAL)**:
- Remove ALL shipping creases and random wrinkles from reference
- Keep ONLY necessary structural folds (natural sleeve bends, armpit gathers)
- Fabric should have natural drape but look professionally steamed/pressed
- Silhouette lines must be clean, smooth, and dimensional

**Even if reference image is wrinkled or casually placed, your output MUST show professionally styled positioning.**`

// ==================== 电商通用规则 ====================

/**
 * 电商图通用规则
 * 适用于所有平台的基础质量标准
 */
export const ECOM_GENERAL_RULES = `[E-commerce General Standards]

**Image Quality**:
- High resolution (2K or higher recommended)
- Accurate colors - no color cast, match original garment
- Even, soft lighting - minimize harsh shadows
- Sharp focus on garment details

**Composition**:
- Garment fills 70-85% of frame
- Clean, uncluttered appearance
- Balanced visual weight
- Room for cropping to different aspect ratios

**Garment Presentation**:
- Professional styling - clean and neat
- Realistic fabric texture visible
- Natural drape and proportions
- No distortion or stretching`

// ==================== SHEIN/TEMU 风格规则 ====================

/**
 * SHEIN/TEMU "甜区" 风格分析
 * 基于 SHEIN 和 TEMU 热销童装的研究
 */
export const SHEIN_TEMU_SWEET_STYLE = `[SHEIN/TEMU "Sweet Zone" Style Analysis]
Based on research of top-selling kids' products on SHEIN and TEMU:

**Visual Characteristics**:
- Clean, bright, Instagram-worthy aesthetic
- High color saturation but not neon/artificial
- Soft shadows, not harsh studio lighting
- Props scattered organically, not rigidly arranged
- Lifestyle feel - looks like a styled home shoot
- Matching color coordination between props and garment
- Subtle gradient backgrounds (white to soft theme color)

**Props Arrangement Rules**:
- 3-5 props maximum per shot
- One "hero" prop that matches the theme prominently
- 2-3 smaller "supporting" props
- Props should NOT overlap or cover the garment
- Corner placement preferred (top-left, bottom-right diagonal)
- Some props can be slightly cropped at frame edge for natural feel

**Background Surface by Garment Type**:
- Sleepwear: Fuzzy white/cream blanket, faux fur texture
- Sports: Grass-like surface or clean gym floor look
- Sweet/Cute: Wooden surface with pastel accents
- IP Theme: Color-coordinated backdrop matching IP's main color + relevant props
- Casual: Clean white or light gray seamless (only for plain garments)

**Color Temperature**:
- Slightly warm for sleepwear/cute themes
- Neutral/cool for sports themes
- Vibrant for IP character themes`
