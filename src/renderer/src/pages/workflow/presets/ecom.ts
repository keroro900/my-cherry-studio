/**
 * 电商预设注册表
 * E-commerce Preset Registry
 *
 * 包含：
 * - 布局模式预设 (LAYOUT_PRESETS) - 7种专业拍摄布局
 * - 填充模式预设 (FILL_MODE_PRESETS) - 5种服装造型方式
 * - 光影模式预设 (LIGHTING_PRESETS) - 6种专业打光方案
 *
 * 参考来源：
 * - [soona Ghost Mannequin Guide](https://soona.co/blog/ghost-mannequin-photography)
 * - [Shopify Clothing Photography 2025](https://www.shopify.com/blog/clothing-photography)
 * - [Orbitvu Fashion Trends 2025](https://orbitvu.com/blog/fashion-photography-trends-2025-e-commerce-let-your-creativity-run-wild/)
 * - [COLBOR Lighting Guide](https://www.colborlight.com/blogs/articles/set-up-lighting-for-clothing-photography)
 *
 * @module presets/ecom
 */

import {
  createPresetCategory,
  type FillModeId,
  type LayoutModeId,
  type LightingModeId,
  type PresetDefinition,
  type ResolvedFillModeId,
  type ResolvedLayoutModeId
} from './types'

// ==================== 布局模式预设 ====================

/**
 * 布局模式预设定义
 * Layout Mode Preset Definitions
 *
 * 7种专业电商服装拍摄布局方式
 */
const LAYOUT_PRESET_DEFINITIONS: Record<LayoutModeId, PresetDefinition> = {
  none: {
    id: 'none',
    label: '无（AI决定）',
    description: 'AI 根据服装类型自动选择最佳布局',
    systemPromptBlock: `product photography (you decide the best layout based on garment analysis - flat lay for sets/casual items, hanging for dresses/formal items, ghost mannequin for structured garments)`,
    userPromptBlock: `**Layout: AI DECIDES**
Use your expertise to select the optimal layout based on garment type:
- Flat lay for pajama sets, casual coordinates, t-shirts
- Hanging for dresses, long garments, formal wear
- Ghost mannequin for structured jackets, blazers, coats
- Lifestyle for seasonal collections, themed shoots`
  },
  random: {
    id: 'random',
    label: '随机选择',
    description: '随机选择一种布局方式',
    systemPromptBlock: undefined,
    userPromptBlock: undefined
  },
  flat_lay: {
    id: 'flat_lay',
    label: '平铺图',
    description: '俯视90度角，服装平铺展示',
    systemPromptBlock: `flat lay product photography (bird's eye view, 90-degree overhead shot)`,
    userPromptBlock: `**Layout: FLAT LAY (俯视平铺)**
Position garment laid flat on surface, shot from directly above (bird's eye view / 90-degree overhead).

**Camera Setup:**
- Shooting angle: Directly overhead (90 degrees)
- Camera height: Chest level for consistent perspective
- Lens: 50mm equivalent, f/8 for sharp edge-to-edge focus

**Garment Positioning:**
- Sleeves naturally bent at comfortable angles (NOT spread eagle)
- Collar opened naturally to show neckline design
- Body area smooth but with natural fabric weight
- Garment fills 70% of frame, leaving space for themed props
- If set (top + bottom): arrange in natural wearing relationship

**Surface Requirements:**
- Clean, textured background surface (fabric, wood, marble)
- Background color complements garment theme
- Subtle shadows show dimension without harsh lines`
  },
  hanging: {
    id: 'hanging',
    label: '隐形挂拍',
    description: '隐形衣架，服装自然垂坠',
    systemPromptBlock: `invisible hanger photography (garment appears suspended, no visible hanger)`,
    userPromptBlock: `**Layout: HANGING (隐形挂拍)**
Garment displayed on invisible/hidden hanger, shot from front angle.

**Camera Setup:**
- Shooting angle: Front view, slightly elevated (10-15 degrees)
- Lens: 50-85mm, f/5.6-f/8
- Distance: Full garment in frame with breathing room

**Hanging Requirements:**
- Invisible hanger - NO visible hanger parts, hooks, or clips
- Shoulders properly positioned and even
- Natural drape showing garment silhouette
- Natural fabric fall and gentle movement
- Collar and neckline clearly visible

**Styling:**
- Steam/iron garment before shooting - NO wrinkles
- Clip back if needed for clean front view (clips hidden)
- Natural gravity pull on fabric
- Arms/sleeves hang naturally or slightly angled`
  },
  ghost_mannequin: {
    id: 'ghost_mannequin',
    label: '隐形人台',
    description: '3D立体效果，模拟穿着状态',
    systemPromptBlock: `ghost mannequin photography (invisible mannequin effect, 3D volumetric form showing garment shape as if worn)`,
    userPromptBlock: `**Layout: GHOST MANNEQUIN (隐形人台)**
Create invisible mannequin effect - garment appears worn by invisible body with 3D form.

**Technical Requirements:**
- Garment shows 3D volumetric shape as if worn by invisible person
- Internal volume visible - chest, torso, shoulders filled out
- NO visible mannequin parts - completely invisible support
- Show both front construction and inner neck/collar area

**Camera Setup:**
- Shooting angle: Front view, eye level
- Lens: 50mm, f/8-f/11 for sharp detail
- Consistent lighting to reduce post-processing

**3D Effect Checklist:**
- Collar stands naturally with inner shadow
- Shoulders have proper width and roundness
- Chest area shows natural volume
- Sleeves have dimensional shape
- Waist shows natural tapering (if applicable)
- Overall silhouette matches human wearing posture

**Post-Production Notes:**
- Composite front shot with inner garment shot
- Remove all mannequin visibility
- Maintain natural shadows and depth`
  },
  on_model: {
    id: 'on_model',
    label: '真人模特',
    description: '真人模特穿着展示',
    systemPromptBlock: `on-model fashion photography (live model wearing garment, showing fit and movement)`,
    userPromptBlock: `**Layout: ON MODEL (真人模特)**
Live model wearing the garment, demonstrating fit, drape, and movement.

**Model Requirements:**
- Model body type matches target customer demographic
- Natural, relaxed pose - NOT stiff or awkward
- Expression: Pleasant, approachable, brand-appropriate
- Static pose preferred for clean product focus

**Camera Setup:**
- Shooting angle: Eye level or slightly elevated
- Full body or 3/4 shot depending on garment
- Lens: 85mm, f/4-f/5.6 for slight background blur

**Styling Guidelines:**
- Garment fits model properly - no clips visible
- Complementary accessories if appropriate
- Hair and makeup clean and simple
- Model's pose showcases garment features

**Background:**
- Clean studio background (white/grey) for main shots
- Lifestyle setting for contextual shots`
  },
  lifestyle: {
    id: 'lifestyle',
    label: '场景生活照',
    description: '真实场景中的生活方式展示',
    systemPromptBlock: `lifestyle fashion photography (real-world setting, storytelling imagery showing garment in context)`,
    userPromptBlock: `**Layout: LIFESTYLE (场景生活照)**
Garment shown in real-world context, telling a visual story.

**Scene Requirements:**
- Location matches garment style and target customer
- Natural, candid feeling (even if staged)
- Environmental elements complement garment theme
- Authentic, aspirational lifestyle imagery

**Location Ideas by Style:**
- Pajamas/loungewear: Cozy bedroom, living room
- Sportswear: Outdoor park, gym, urban street
- Casual: Coffee shop, beach, garden
- Formal: Urban architecture, elegant interior

**Camera Setup:**
- Mix of angles: eye level, slightly low, environmental wide
- Lens: 35-85mm depending on scene
- Aperture: f/2.8-f/4 for contextual blur

**Styling Notes:**
- Props and environment tell the brand story
- Model (if present) engaged with environment
- Garment remains hero - not lost in scene
- Golden hour or soft natural light preferred`
  },
  hanger_visible: {
    id: 'hanger_visible',
    label: '衣架展示',
    description: '可见衣架，突出服装结构',
    systemPromptBlock: `hanger display photography (visible hanger showing garment on rack, retail presentation style)`,
    userPromptBlock: `**Layout: HANGER DISPLAY (衣架展示)**
Garment on visible hanger, retail/showroom presentation style.

**Hanger Requirements:**
- Clean, high-quality hanger matching garment style
- Wood hanger for premium items
- Velvet/padded for delicate fabrics
- Matching hangers for set consistency

**Camera Setup:**
- Shooting angle: Front view, slightly elevated
- Include hanger hook in frame (intentionally)
- Lens: 50mm, f/8

**Styling:**
- Garment hangs naturally from shoulders
- No clips or pins visible (if used, hide them)
- Steam garment - NO wrinkles
- Natural fabric drape

**Background:**
- Clean wall or backdrop
- Clothing rack for multiple items
- Retail environment feeling`
  },

  // ==================== 非真人创意拍摄方式 ====================

  creative_flat_lay: {
    id: 'creative_flat_lay',
    label: '创意平铺',
    description: '带道具组合的艺术平铺',
    systemPromptBlock: `creative flat lay photography (artistic overhead composition with styled props and thematic elements)`,
    userPromptBlock: `**Layout: CREATIVE FLAT LAY (创意平铺)**
Artistic overhead composition with thoughtfully styled props and thematic elements.

**Composition Principles:**
- Garment as hero, occupying 50-60% of frame
- Props arranged in visual balance around garment
- Negative space for breathing room
- Color coordination between garment and props

**Prop Categories by Theme:**
- **Seasonal**: Leaves, flowers, pinecones, shells
- **Lifestyle**: Coffee cup, book, sunglasses, jewelry
- **Fashion**: Accessories, shoes, bags that complement
- **Texture**: Fabric swatches, natural materials
- **Whimsical**: Confetti, ribbons, small decorative items

**Camera Setup:**
- Shooting angle: Direct overhead (90 degrees)
- Lens: 35-50mm for wider scene
- Aperture: f/5.6-f/8 for depth of field variation

**Styling Guidelines:**
- Tell a story with prop selection
- Maintain brand aesthetic consistency
- Props enhance, never compete with garment
- Create natural, effortless arrangement
- Use odd numbers for prop groupings (3, 5, 7)

**Background:**
- Textured surface: marble, wood, linen, paper
- Color complements garment and brand palette
- Consistent background across collection`
  },

  styled_set: {
    id: 'styled_set',
    label: '造型搭配',
    description: '多件服装组合展示',
    systemPromptBlock: `styled set photography (outfit coordination showing multiple garments together as complete look)`,
    userPromptBlock: `**Layout: STYLED SET (造型搭配展示)**
Multiple garments arranged together showing complete outfit or coordination.

**Arrangement Types:**
- **Complete Outfit**: Top + bottom + accessories
- **Layering Display**: Base + mid-layer + outer layer
- **Mix & Match**: Multiple tops or bottoms showing versatility
- **Capsule Collection**: 3-5 pieces that work together

**Positioning Strategies:**
- Overlapping pieces showing relationship
- Stepped arrangement for visual hierarchy
- Exploded view (separated but coordinated)
- Stacked/folded with visible edges

**Camera Setup:**
- Shooting angle: Overhead (90°) or slight angle (75°)
- Frame all pieces with consistent margins
- Lens: 35-50mm for wider field

**Styling Guidelines:**
- Color story: harmonious palette across pieces
- Show how pieces work together
- Maintain individual garment visibility
- Accessories complete the story (shoes, bags, jewelry)

**Best For:**
- "Shop the Look" features
- Outfit inspiration content
- Bundle/set promotions
- Seasonal lookbook shots`
  },

  detail_closeup: {
    id: 'detail_closeup',
    label: '细节特写',
    description: '展示工艺细节、纽扣、刺绣等',
    systemPromptBlock: `detail close-up photography (macro/close shot showing craftsmanship, buttons, stitching, embroidery details)`,
    userPromptBlock: `**Layout: DETAIL CLOSE-UP (细节特写)**
Macro/close-up shots highlighting craftsmanship and design details.

**Focus Areas:**
- **Hardware**: Buttons, zippers, snaps, buckles
- **Stitching**: Seams, topstitching, decorative stitches
- **Embellishments**: Embroidery, beading, appliqué
- **Fabric Detail**: Weave pattern, texture, print detail
- **Labels**: Brand tags, care labels, size tags
- **Closures**: Button holes, zipper pulls, hook & eye

**Camera Setup:**
- Lens: Macro lens or 85mm+ with close focus
- Aperture: f/2.8-f/4 for shallow DOF
- Focus: Tack sharp on detail, soft background
- Distance: Fill frame with detail (30-50% crop)

**Lighting:**
- Soft, directional light to show texture
- Slight shadow to reveal dimension
- Avoid harsh shadows obscuring detail

**Technical Tips:**
- Use tripod for sharpness
- Focus stacking for deep detail shots
- Color accuracy critical for fabric representation

**Best For:**
- Product page detail carousel
- Highlighting premium craftsmanship
- Justifying premium pricing
- Showing unique design elements`
  },

  texture_focus: {
    id: 'texture_focus',
    label: '面料质感',
    description: '突出面料质地和手感',
    systemPromptBlock: `texture-focused photography (emphasizing fabric quality, material feel, and tactile qualities)`,
    userPromptBlock: `**Layout: TEXTURE FOCUS (面料质感)**
Photography emphasizing fabric quality, material feel, and tactile properties.

**Texture Capture Techniques:**
- Directional lighting at low angle (30-45°) to reveal texture
- Fabric draping to show weight and flow
- Controlled wrinkles showing fabric behavior
- Comparison context (hand touching, draped over surface)

**Lighting for Texture:**
- Side lighting creates shadow in texture valleys
- Soft main + harder accent for dimension
- Avoid flat front lighting (kills texture)
- Natural window light excellent for authenticity

**Fabric-Specific Approaches:**
- **Silk/Satin**: Highlight sheen and light play
- **Knit/Wool**: Show weave pattern and softness
- **Cotton/Linen**: Natural texture, slight wrinkles OK
- **Leather**: Surface grain, natural variations
- **Velvet**: Light catching pile, directional texture

**Camera Setup:**
- Lens: 50-85mm, close focus
- Aperture: f/4-f/5.6 for texture depth
- Angle: 30-45° to surface for best texture reveal

**Composition:**
- Fill 60-80% of frame with fabric
- Include enough context for scale
- Show natural fabric fall and behavior

**Best For:**
- Material quality communication
- Premium fabric justification
- Sensory marketing (visual = tactile)
- Fabric composition storytelling`
  },

  studio_white: {
    id: 'studio_white',
    label: '纯白棚拍',
    description: '纯白背景专业棚拍',
    systemPromptBlock: `pure white studio photography (clean white background, professional e-commerce standard style)`,
    userPromptBlock: `**Layout: STUDIO WHITE (纯白背景棚拍)**
Classic e-commerce photography with pure white background.

**Background Requirements:**
- Pure white (RGB 255,255,255) or within 5 values
- No visible shadows on background
- Seamless - no horizon line visible
- Consistent across all product shots

**Lighting Setup:**
- Background lit separately, 1-2 stops brighter than subject
- Soft key light at 45° for main illumination
- Fill light or reflector on shadow side
- Optional hair/rim light for edge definition

**Camera Setup:**
- Shooting angle: Front view, eye level
- Lens: 50-85mm for accurate proportions
- Aperture: f/8-f/11 for sharpness
- Distance: Garment fills 70-80% of frame

**Product Positioning:**
- Centered in frame
- Consistent margins (top, bottom, sides)
- Full garment visible (no crop unless intentional)
- Symmetrical placement

**Post-Production:**
- Background cleanup to pure white
- Consistent color correction
- Remove any dust/lint
- Match all images in set

**Best For:**
- Amazon, Shopify main product images
- Marketplace requirements
- Clean, professional catalog look
- Easy background removal for compositing`
  },

  folded: {
    id: 'folded',
    label: '折叠展示',
    description: '服装折叠堆叠展示',
    systemPromptBlock: `folded garment photography (neatly folded clothing display, retail stack presentation)`,
    userPromptBlock: `**Layout: FOLDED (折叠展示)**
Garment presented in neatly folded retail-style stack.

**Folding Techniques:**
- **Retail Fold**: Standard store display fold
- **Gift Box Fold**: Compact, presentable for packaging
- **Stack Display**: Multiple items layered
- **Partial Fold**: Showing some features unfolded

**Camera Setup:**
- Shooting angle: 45° from above (shows front and depth)
- Alternative: Overhead for stack shots
- Lens: 50mm, f/8 for edge-to-edge sharpness

**Folding Quality:**
- Crisp, clean folds
- Symmetrical alignment
- No visible creases from shipping
- Edges aligned precisely

**Presentation Styles:**
- Single item: Hero product focus
- Stack of 2-3: Color variants shown
- Multiple stacks: Collection/inventory feel
- With tissue paper: Premium unboxing feel

**Styling Tips:**
- Iron/steam before folding
- Use folding board for consistency
- Keep visible design elements showing
- Stack in size order (smallest on top)

**Best For:**
- T-shirts, polos, basics
- Showing color range
- Retail/wholesale presentation
- Packaging/gift box context`
  }
}

/**
 * 布局模式预设类别
 */
export const LAYOUT_PRESETS = createPresetCategory<LayoutModeId>('layout', '布局模式', LAYOUT_PRESET_DEFINITIONS)

// ==================== 填充模式预设 ====================

/**
 * 填充模式预设定义
 * Fill Mode Preset Definitions
 *
 * 5种服装造型和填充方式
 */
const FILL_MODE_PRESET_DEFINITIONS: Record<FillModeId, PresetDefinition> = {
  none: {
    id: 'none',
    label: '无（AI决定）',
    description: 'AI 根据服装类型选择最佳造型方式',
    systemPromptBlock: `appropriate styling technique (you decide based on garment type - Ghost Mannequin for structured garments, natural flat for casual items, stuffed for knitwear)`,
    userPromptBlock: `**Styling: AI DECIDES**
Use your expertise to determine the optimal styling technique:
- Ghost Mannequin for structured items (jackets, blazers, dresses)
- Natural flat for casual items (t-shirts, pajamas)
- Stuffed effect for knitwear and soft fabrics
- Pinned styling for achieving specific silhouettes`
  },
  random: {
    id: 'random',
    label: '随机选择',
    description: '随机选择一种填充方式',
    systemPromptBlock: undefined,
    userPromptBlock: undefined
  },
  filled: {
    id: 'filled',
    label: '3D立体填充',
    description: 'Ghost Mannequin 效果，完整3D体积感',
    systemPromptBlock: `Ghost Mannequin (3D filled) technique - invisible body effect with full volumetric form`,
    userPromptBlock: `**Styling: GHOST MANNEQUIN (3D立体填充)**
Create invisible mannequin effect with full 3D volumetric form.

**Volume Requirements - CRITICAL:**
- Garment MUST have visible internal volume and fullness
- Body cavity: chest, back, shoulders show air/filling support
- Form soft, rounded three-dimensional volume
- Silhouette matches real human wearing posture

**Shadow & Depth:**
- Collar, cuffs, hems show reasonable inner shadows
- Inner shadow effect creates depth perception
- Clear outline between garment and background
- Contact shadow grounds the garment

**Quality Checklist:**
- NOT paper-flat - must have lift-off effect
- Shoulders properly rounded and filled
- Chest area shows natural volume
- Sleeves have dimensional shape
- Appears as if worn by invisible person

**Technical Notes:**
- Consistent lighting reveals form
- Post-processing removes any mannequin visibility
- Maintain natural fabric texture in volume areas`
  },
  flat: {
    id: 'flat',
    label: '自然平铺',
    description: '服装自然平放，保留面料质感',
    systemPromptBlock: `natural flat lay styling - garment lies naturally with authentic fabric drape`,
    userPromptBlock: `**Styling: NATURAL FLAT (自然平铺)**
Garment lies naturally flat with authentic fabric drape.

**Fabric Presentation:**
- Maintain natural fabric thickness - NOT paper-thin
- Allow natural creases and folds where fabric falls
- Show fabric texture and material quality
- Subtle dimension from natural fabric weight

**Positioning:**
- Smooth main body area
- Natural sleeve positioning
- Collar arranged to show design
- Hem lies naturally

**Styling Notes:**
- Steam to remove shipping creases
- Keep structural creases that show garment design
- Clean, professional appearance
- Works best for casual items, t-shirts, basic tops`
  },
  stuffed: {
    id: 'stuffed',
    label: '填充物造型',
    description: '使用纸巾/气囊填充，适合针织和软质面料',
    systemPromptBlock: `stuffed styling technique - internal filling creates soft, natural volume`,
    userPromptBlock: `**Styling: STUFFED (填充物造型)**
Internal filling creates soft, natural volume without hard mannequin form.

**Filling Technique:**
- Tissue paper or air bladder inside garment
- Creates soft, pillowy volume
- Natural roundness without rigid structure
- Ideal for knitwear, sweaters, hoodies

**Volume Characteristics:**
- Softer, more organic shape than mannequin
- Gentle curves rather than sharp shoulders
- Relaxed, cozy appearance
- Natural fabric drape around filling

**Best For:**
- Knitwear and sweaters
- Hoodies and sweatshirts
- Fleece and soft fabrics
- Loungewear and comfort items

**Avoid:**
- Structured garments (use ghost mannequin)
- Tailored items (use invisible form)`
  },
  pinned: {
    id: 'pinned',
    label: '别针固定',
    description: '使用别针塑造特定轮廓',
    systemPromptBlock: `pinned styling technique - clips and pins create precise garment silhouette`,
    userPromptBlock: `**Styling: PINNED (别针固定)**
Strategic pinning creates precise, controlled silhouette.

**Pinning Technique:**
- Pins and clips used on back/hidden side
- Pull fabric to create clean front view
- Adjust waist, shoulders, hem as needed
- All pins completely hidden from camera

**Silhouette Control:**
- Create fitted appearance on loose garments
- Define waistline if desired
- Smooth out excess fabric
- Achieve catalog-perfect shape

**Best For:**
- Creating fitted look on standard samples
- Oversized garments needing definition
- Achieving specific brand silhouette
- Multiple sizes shot on one sample

**Important:**
- NO pins visible in final image
- Maintain natural fabric flow where visible
- Don't over-pin - keep it believable`
  },
  invisible_form: {
    id: 'invisible_form',
    label: '隐形支撑架',
    description: '使用透明支撑架，保持服装形状',
    systemPromptBlock: `invisible form styling - transparent support structure maintains garment shape`,
    userPromptBlock: `**Styling: INVISIBLE FORM (隐形支撑架)**
Transparent support structure maintains garment shape without visibility.

**Support Types:**
- Clear acrylic body forms
- Transparent shoulder shapers
- Invisible neck supports
- Wire frame structures (painted to match)

**Advantages:**
- More stable than stuffing
- Consistent results across products
- Less post-production than mannequin
- Good for front-only shots

**Best For:**
- Consistent catalog photography
- High-volume shooting
- Items that need structure
- When mannequin post-processing isn't feasible

**Technical Notes:**
- Match form size to garment size
- Use soft lighting to minimize reflections
- May need minor retouching for reflections`
  }
}

/**
 * 填充模式预设类别
 */
export const FILL_MODE_PRESETS = createPresetCategory<FillModeId>('fill_mode', '填充模式', FILL_MODE_PRESET_DEFINITIONS)

// ==================== 光影模式预设 ====================

/**
 * 光影模式预设定义
 * Lighting Mode Preset Definitions
 *
 * 6种专业电商服装打光方案
 */
const LIGHTING_PRESET_DEFINITIONS: Record<LightingModeId, PresetDefinition> = {
  auto: {
    id: 'auto',
    label: '自动（AI决定）',
    description: 'AI 根据服装风格选择最佳打光',
    systemPromptBlock: `professional studio lighting (you decide the best setup based on garment type and mood)`,
    userPromptBlock: `**Lighting: AI DECIDES**
Use your expertise to select optimal lighting based on garment:
- Soft box for even, professional look
- Rim light for depth and separation
- Natural window light for lifestyle feel
- High key for bright, clean e-commerce
- Low key for dramatic, premium items`
  },
  soft_box: {
    id: 'soft_box',
    label: '柔光箱',
    description: '均匀柔和的专业棚光',
    systemPromptBlock: `soft box studio lighting - even, diffused light with soft shadows`,
    userPromptBlock: `**Lighting: SOFT BOX (柔光箱)**
Professional soft box setup for even, flattering illumination.

**Light Setup:**
- Main light: Large soft box at 45° angle
- Fill light: Reflector or second soft box opposite
- Output ratio: Key 100%, Fill 50%
- Distance: 4-6 feet from subject

**Light Quality:**
- Soft, even illumination across garment
- Minimal harsh shadows
- Fabric texture visible but not exaggerated
- Professional, commercial appearance

**Best For:**
- Standard e-commerce product shots
- Consistent catalog photography
- True color reproduction
- Detail visibility

**Settings Guide:**
- Aperture: f/8-f/11
- ISO: 100-200
- White balance: 5500K (daylight)`
  },
  rim_light: {
    id: 'rim_light',
    label: '轮廓光',
    description: '边缘光分离主体与背景',
    systemPromptBlock: `rim/edge lighting - backlight creating luminous edge separation`,
    userPromptBlock: `**Lighting: RIM LIGHT (轮廓光)**
Back/edge lighting creates depth and subject separation.

**Light Setup:**
- Position backlight behind and to side of subject
- Creates rim of light around garment edges
- Main light from front fills shadows
- Strip boxes work well for rim effect

**Effect:**
- Luminous outline around garment silhouette
- Clear separation from background
- Added depth and dimension
- More dramatic, premium feel

**Best For:**
- Dark garments on light backgrounds
- Adding dimension to flat items
- Premium/luxury product presentation
- Creating visual interest

**Technical Notes:**
- Watch for lens flare from backlight
- Balance rim with front fill
- Don't overpower - subtle rim is elegant`
  },
  natural_window: {
    id: 'natural_window',
    label: '自然窗光',
    description: '柔和的自然光效果',
    systemPromptBlock: `natural window light - soft, diffused daylight feel`,
    userPromptBlock: `**Lighting: NATURAL WINDOW (自然窗光)**
Soft, diffused daylight from window source.

**Setup:**
- Large window as main light source
- 90° angle to subject
- Sheer curtain to diffuse if too harsh
- Reflector on shadow side

**Light Quality:**
- Soft, organic light gradation
- Natural-looking shadows
- Authentic, lifestyle feel
- True color rendering

**Best For:**
- Lifestyle and editorial shots
- Natural, organic brand aesthetics
- Soft fabric like cotton, linen
- Morning/afternoon golden light

**Tips:**
- Shoot during overcast days for softest light
- Avoid direct sunlight (too harsh)
- Use reflector to fill shadows
- Best 2 hours after sunrise or before sunset`
  },
  high_key: {
    id: 'high_key',
    label: '高调光',
    description: '明亮清新，适合童装和运动装',
    systemPromptBlock: `high key lighting - bright, airy, minimal shadows`,
    userPromptBlock: `**Lighting: HIGH KEY (高调光)**
Bright, airy lighting with minimal shadows.

**Light Setup:**
- Multiple soft light sources
- Background lit separately (bright white)
- Very soft shadows or shadowless
- Even illumination everywhere

**Effect:**
- Clean, bright, optimistic mood
- Pure white or very light background
- Fresh, youthful energy
- Maximum detail visibility

**Best For:**
- Children's clothing
- Sportswear and activewear
- Summer collections
- Clean, minimal brand aesthetics

**Technical:**
- Watch for overexposure
- Maintain fabric texture in highlights
- Background 1-2 stops brighter than subject`
  },
  low_key: {
    id: 'low_key',
    label: '低调光',
    description: '深沉质感，适合高端和正装',
    systemPromptBlock: `low key lighting - dramatic shadows, moody atmosphere`,
    userPromptBlock: `**Lighting: LOW KEY (低调光)**
Dramatic lighting with deep shadows and mood.

**Light Setup:**
- Single main light source
- Minimal or no fill
- Dark background
- Directional, sculpting light

**Effect:**
- Dramatic contrast
- Deep, rich shadows
- Premium, luxurious feel
- Emphasizes texture and form

**Best For:**
- Premium/luxury items
- Leather goods
- Dark formal wear
- Artistic brand imagery

**Technical:**
- Expose for highlights
- Let shadows go dark
- Use negative fill (black card) to deepen shadows`
  },
  three_point: {
    id: 'three_point',
    label: '三点布光',
    description: '专业三点布光系统',
    systemPromptBlock: `three-point lighting setup - key, fill, and back light for professional dimension`,
    userPromptBlock: `**Lighting: THREE-POINT (三点布光)**
Classic professional lighting setup with key, fill, and back light.

**Light Setup:**
- KEY LIGHT: Main light at 45° angle, 45° elevation
- FILL LIGHT: Opposite side, 50% power of key
- BACK LIGHT: Behind subject, creates rim/separation

**Light Ratios:**
- Key: 100%
- Fill: 50%
- Back: 75%

**Effect:**
- Professional, dimensional lighting
- Controlled shadow density
- Good subject separation
- Versatile for all garment types

**Best For:**
- Professional catalog work
- Consistent product photography
- When you need reliable, repeatable results
- Mixed garment types in same shoot`
  }
}

/**
 * 光影模式预设类别
 */
export const LIGHTING_PRESETS = createPresetCategory<LightingModeId>(
  'lighting',
  '光影模式',
  LIGHTING_PRESET_DEFINITIONS
)

// ==================== 解析函数 ====================

/**
 * 解析布局模式
 * Resolve Layout Mode
 *
 * @param mode 原始布局模式值
 * @returns 解析后的布局模式
 */
export function resolveLayoutMode(mode: LayoutModeId | string | undefined | null): ResolvedLayoutModeId {
  if (!mode || mode === 'none') {
    return 'none'
  }

  if (mode === 'random') {
    // 随机选择时只包含非真人拍摄方式
    const options: ResolvedLayoutModeId[] = [
      'flat_lay',
      'hanging',
      'ghost_mannequin',
      'creative_flat_lay',
      'styled_set',
      'studio_white',
      'folded'
    ]
    return options[Math.floor(Math.random() * options.length)]
  }

  const normalizeMap: Record<string, ResolvedLayoutModeId> = {
    // 基础布局
    flat_lay: 'flat_lay',
    flatlay: 'flat_lay',
    flat: 'flat_lay',
    hanging: 'hanging',
    hanger: 'hanging',
    invisible_hanger: 'hanging',
    ghost_mannequin: 'ghost_mannequin',
    ghost: 'ghost_mannequin',
    mannequin: 'ghost_mannequin',
    invisible_mannequin: 'ghost_mannequin',
    hanger_visible: 'hanger_visible',
    visible_hanger: 'hanger_visible',
    rack: 'hanger_visible',
    // 真人模式
    on_model: 'on_model',
    model: 'on_model',
    live_model: 'on_model',
    lifestyle: 'lifestyle',
    contextual: 'lifestyle',
    // 非真人创意拍摄方式
    creative_flat_lay: 'creative_flat_lay',
    creative: 'creative_flat_lay',
    artistic_flat: 'creative_flat_lay',
    styled_set: 'styled_set',
    outfit: 'styled_set',
    coordination: 'styled_set',
    set: 'styled_set',
    detail_closeup: 'detail_closeup',
    detail: 'detail_closeup',
    closeup: 'detail_closeup',
    macro: 'detail_closeup',
    texture_focus: 'texture_focus',
    texture: 'texture_focus',
    fabric: 'texture_focus',
    material: 'texture_focus',
    studio_white: 'studio_white',
    white_background: 'studio_white',
    pure_white: 'studio_white',
    amazon: 'studio_white',
    folded: 'folded',
    fold: 'folded',
    stacked: 'folded',
    retail_fold: 'folded'
  }

  return normalizeMap[mode] || 'none'
}

/**
 * 解析填充模式
 * Resolve Fill Mode
 *
 * @param mode 原始填充模式值
 * @returns 解析后的填充模式
 */
export function resolveFillMode(mode: FillModeId | string | undefined | null): ResolvedFillModeId {
  if (!mode || mode === 'none') {
    return 'none'
  }

  if (mode === 'random') {
    const options: ResolvedFillModeId[] = ['filled', 'flat', 'stuffed']
    return options[Math.floor(Math.random() * options.length)]
  }

  const normalizeMap: Record<string, ResolvedFillModeId> = {
    filled: 'filled',
    ghost_mannequin: 'filled',
    '3d': 'filled',
    volumetric: 'filled',
    flat: 'flat',
    natural_flat: 'flat',
    natural: 'flat',
    stuffed: 'stuffed',
    padded: 'stuffed',
    filled_soft: 'stuffed',
    pinned: 'pinned',
    clipped: 'pinned',
    tailored: 'pinned',
    invisible_form: 'invisible_form',
    form: 'invisible_form',
    acrylic: 'invisible_form'
  }

  return normalizeMap[mode] || 'none'
}

/**
 * 解析光影模式
 * Resolve Lighting Mode
 *
 * @param mode 原始光影模式值
 * @returns 光影模式 ID
 */
export function resolveLightingMode(mode: LightingModeId | string | undefined | null): LightingModeId {
  if (!mode) {
    return 'auto'
  }

  const normalizeMap: Record<string, LightingModeId> = {
    auto: 'auto',
    soft_box: 'soft_box',
    softbox: 'soft_box',
    soft: 'soft_box',
    rim_light: 'rim_light',
    rim: 'rim_light',
    edge: 'rim_light',
    back: 'rim_light',
    natural_window: 'natural_window',
    window: 'natural_window',
    natural: 'natural_window',
    daylight: 'natural_window',
    high_key: 'high_key',
    bright: 'high_key',
    low_key: 'low_key',
    dramatic: 'low_key',
    moody: 'low_key',
    three_point: 'three_point',
    professional: 'three_point',
    standard: 'three_point'
  }

  return normalizeMap[mode] || 'auto'
}

// ==================== 平台风格解析函数 ====================

/**
 * 平台风格类型
 */
export type PlatformStyleId = 'random' | 'shein' | 'temu' | 'amazon' | 'taobao' | 'xiaohongshu'

/**
 * 解析平台风格
 * Resolve Platform Style
 *
 * @param style 原始平台风格值
 * @returns 解析后的平台风格
 */
export function resolvePlatformStyle(
  style: PlatformStyleId | string | undefined | null
): Exclude<PlatformStyleId, 'random'> {
  if (!style) return 'shein'

  if (style === 'random') {
    const options: Exclude<PlatformStyleId, 'random'>[] = ['shein', 'temu', 'amazon', 'taobao', 'xiaohongshu']
    return options[Math.floor(Math.random() * options.length)]
  }

  const validStyles: Exclude<PlatformStyleId, 'random'>[] = ['shein', 'temu', 'amazon', 'taobao', 'xiaohongshu']
  return validStyles.includes(style as any) ? (style as Exclude<PlatformStyleId, 'random'>) : 'shein'
}

// ==================== 提示词构建辅助函数 ====================

/**
 * 获取布局模式的系统提示词片段
 */
export function getLayoutSystemPromptBlock(mode: ResolvedLayoutModeId): string {
  const preset = LAYOUT_PRESETS.getPreset(mode)
  return preset?.systemPromptBlock || LAYOUT_PRESETS.getPreset('none')!.systemPromptBlock!
}

/**
 * 获取布局模式的用户提示词片段
 */
export function getLayoutUserPromptBlock(mode: ResolvedLayoutModeId): string {
  const preset = LAYOUT_PRESETS.getPreset(mode)
  return preset?.userPromptBlock || LAYOUT_PRESETS.getPreset('none')!.userPromptBlock!
}

/**
 * 获取填充模式的系统提示词片段
 */
export function getFillModeSystemPromptBlock(mode: ResolvedFillModeId): string {
  const preset = FILL_MODE_PRESETS.getPreset(mode)
  return preset?.systemPromptBlock || FILL_MODE_PRESETS.getPreset('none')!.systemPromptBlock!
}

/**
 * 获取填充模式的用户提示词片段
 */
export function getFillModeUserPromptBlock(mode: ResolvedFillModeId): string {
  const preset = FILL_MODE_PRESETS.getPreset(mode)
  return preset?.userPromptBlock || FILL_MODE_PRESETS.getPreset('none')!.userPromptBlock!
}

/**
 * 获取光影模式的系统提示词片段
 */
export function getLightingSystemPromptBlock(mode: LightingModeId): string {
  const preset = LIGHTING_PRESETS.getPreset(mode)
  return preset?.systemPromptBlock || LIGHTING_PRESETS.getPreset('auto')!.systemPromptBlock!
}

/**
 * 获取光影模式的用户提示词片段
 */
export function getLightingUserPromptBlock(mode: LightingModeId): string {
  const preset = LIGHTING_PRESETS.getPreset(mode)
  return preset?.userPromptBlock || LIGHTING_PRESETS.getPreset('auto')!.userPromptBlock!
}

/**
 * 获取 Ghost Mannequin 技术要求提示词
 */
export function getGhostMannequinSection(mode: ResolvedFillModeId): string {
  if (mode === 'filled') {
    return `[Ghost Mannequin Technical Requirements - CRITICAL]
The garment MUST appear as if worn by an invisible person with full 3D volumetric form:

**Volume Requirements:**
- Visible internal volume and fullness throughout
- Body, chest, back, shoulders, sleeves have air/filling support inside
- Form soft, rounded three-dimensional volume, like real wearing posture
- Collar, cuffs, hems show reasonable inner shadows (inner shadow effect)

**Depth & Shadow:**
- Clear outline and contact shadow between garment and background
- Inner shadows create depth perception at openings
- Garment has lift-off effect from background surface

**Critical Check:**
- NOT paper-flat or 2D appearance
- Natural human-like silhouette
- Believable "worn" appearance without visible body`
  }

  if (mode === 'flat') {
    return `[Natural Flat Styling Requirements]
- Garment lies naturally flat with authentic fabric drape
- Maintain natural fabric thickness - NOT paper-thin
- Allow natural creases and folds where fabric falls
- Clean, professional appearance with subtle dimension`
  }

  if (mode === 'stuffed') {
    return `[Stuffed Styling Requirements]
- Soft, pillowy internal volume
- Natural roundness without rigid structure
- Gentle curves, relaxed appearance
- Ideal for knitwear and soft fabrics`
  }

  if (mode === 'pinned') {
    return `[Pinned Styling Requirements]
- Strategic pinning creates controlled silhouette
- All pins completely hidden from camera
- Natural fabric flow where visible
- Fitted, catalog-perfect appearance`
  }

  if (mode === 'invisible_form') {
    return `[Invisible Form Requirements]
- Transparent support structure maintains shape
- Consistent, stable results
- Minimal retouching needed
- Professional, uniform appearance`
  }

  // mode === 'none'
  return `[Styling Guidance - AI DECIDES]
You have creative freedom to decide the best presentation style based on the garment type:
- For structured garments (jackets, blazers, dresses): Consider Ghost Mannequin for 3D volumetric effect
- For casual/soft garments (t-shirts, pajamas): Consider natural flat lay styling
- For knitwear: Consider stuffed styling for soft volume
- Analyze the reference image to determine the optimal approach`
}
