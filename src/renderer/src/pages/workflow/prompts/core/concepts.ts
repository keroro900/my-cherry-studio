/**
 * 核心概念提示词（单一来源）
 * Core Concept Prompts (Single Source of Truth)
 *
 * v4.0 详细版：完整规则用于高质量输出
 * 各节点通过导入此模块获取统一的基础规则
 */

// ==================== RE-CREATION 核心概念 ====================

/**
 * RE-CREATION 核心概念 - 重绘式编辑
 *
 * 核心理念：
 * - 【从参考图提取的信息】：服装颜色、图案、印花、文字、IP角色设计、面料质感、版型比例等
 * - 【需要重新设计的内容】：服装摆放造型、背景氛围道具、光影效果、整体构图
 * - 简而言之：服装细节100%忠实还原，但摆放和场景需要专业重新设计
 */
export const RECREATION_CONCEPT = `[Core Concept - Re-creation, NOT Copy - MOST IMPORTANT]

Your task is NOT to "copy the reference image", but to "re-create a professional e-commerce photo".

**What to EXTRACT from reference images (information gathering)**:
- Garment colors, patterns, prints, text, IP character designs
- Fabric texture, silhouette proportions, collar type, sleeve/pant length
- Garment theme and style (sports, IP character, sweet, street, etc.)

**What to RE-DESIGN (professional creation)**:
- Garment positioning and styling (professional flat lay arrangement with slight angles)
- Background atmosphere and props (theme-matched, NOT generic plain white)
- Lighting and mood (professional studio effect)
- Overall composition (e-commerce standard framing)

**In short**: Garment details 100% faithful reproduction, but positioning and scene are newly professionally designed.
Even if the reference image is a wrinkled casual shot, your output MUST be a professionally styled e-commerce photo.`

// ==================== 硬性规则 ====================

/**
 * 硬性规则 - 必须遵守
 *
 * 1. 数据一致性：100%还原服装细节（颜色、图案、印花、IP角色）
 * 2. 专业重新造型：不要复制参考图的摆放，要专业重新设计
 * 3. 主题匹配背景：背景必须匹配服装主题（IP主题→IP相关道具）
 * 4. 禁止项：不要出现真人、模特、假人（平铺图/挂拍图中）
 * 5. 专业精修：去除杂乱褶皱，保留必要的结构褶皱
 * 6. 光影质量：柔和灯光，高分辨率，准确色彩
 */
export const HARD_RULES = `[Quality Standards - High Fidelity]

**1. Data Consistency (Exact Reproduction)**
- STRICTLY preserve original garment identity: colors, fabric texture, silhouette proportions.
- Patterns, prints, text, and IP characters must be reproduced exactly as seen in reference.
- Maintain the authentic look and feel of the material (e.g., the weight of denim, the softness of cotton).

**2. Professional Re-styling**
- Transform the garment presentation into a high-end e-commerce standard.
- Create a deliberate, aesthetically pleasing arrangement that showcases the garment's best features.
- Ensure the garment looks brand new, perfectly steamed, and professionally handled.

**3. Immersive Context**
- Background and props must harmonize with the garment's theme (e.g., warm wood for cozy knitwear).
- Create a cohesive visual story that enhances the product's appeal without distracting from it.
- Use lighting to define form and texture, creating a premium commercial look.

**4. Subject Purity**
- Focus exclusively on the garment and its presentation.
- Ensure the frame is free from distractions: no unintended human parts, no watermarks, no layout artifacts.
- The image should be clean, sharp, and ready for immediate commercial use.

**5. Material Fidelity**
- Render high-frequency details: visible fabric weave, stitching threads, and surface texture.
- Use subsurface scattering simulation for skin-like textures (if applicable) or complex fabrics (velvet, silk).
- Shadows should be soft and realistic, grounding the object in the scene.

**6. Technical Excellence**
- Output at 8K effective resolution with sharp edge-to-edge clarity.
- Color grading should be neutral and accurate to the original product.
- No chromatic aberration or digital noise.`

// ==================== 参考图像分析规则 ====================

/**
 * 参考图像分析规则
 * 用于指导 AI 正确解析输入的参考图像
 */
export const REFERENCE_IMAGE_ANALYSIS = `[Reference Image Analysis - CRITICAL FIRST STEP]

Before generating any prompt, carefully analyze the garment:

**1. Garment Type Identification**:
- Is it a SET (top + bottom), single TOP, single BOTTOM, dress, or outerwear?
- Category: Sleepwear/Pajamas, Sportswear, Casual, Formal, Loungewear?

**2. Print/Pattern Theme Detection**:
- IP characters (Harry Potter, dinosaurs, unicorns, Hello Kitty, Spider-Man, Frozen, Paw Patrol, Bluey)
- Sports motifs (soccer, basketball, baseball)
- Sweet motifs (hearts, strawberries, bows, flowers)
- Geometric patterns, solid colors

**3. Color Palette Extraction**:
- Note dominant colors for background/prop coordination
- Identify accent colors for theme matching

**4. Material Assessment**:
- Cotton, fleece, denim, knit - affects how it should look filled/flat
- Fabric weight and drape characteristics

**5. Structural Details**:
- Collar type, sleeve length, pant leg style
- Buttons, zippers, pockets, decorative elements`

// ==================== JSON 输出约束 ====================

/**
 * JSON 输出硬性约束
 * 强制 AI 输出纯 JSON 格式，不要添加 markdown 代码块或额外文字
 */
export const HARD_JSON_OUTPUT_CONSTRAINTS = `[Hard Output Constraints]
- Output MUST be a single valid JSON object and nothing else.
- Do NOT wrap in markdown or code fences.
- Do NOT add explanations, comments, or trailing text.
- Use double quotes for all JSON keys and string values.
- All JSON string values MUST be in English.
- "hpsv3_score" MUST be a number between 90 and 99 (prefer 95-99).`
