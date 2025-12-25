# 童装电商AI工作流优化计划

> 基于SHEIN爆款分析 + Nanobanana Pro模型优化方案
> 创建日期: 2025-12-12

---

## 一、SHEIN爆款图片风格分析

### 1.1 产品展示风格分类

根据提供的SHEIN童装图片，识别出以下主要展示风格：

| 风格类型 | 特点 | 适用场景 | 示例 |
|---------|------|---------|------|
| **Flat Lay 平铺** | 衣服平铺+道具装饰，俯拍视角 | 套装展示、睡衣、家居服 | 彩虹睡衣套装、爱心印花套装 |
| **挂拍 Hanger** | 衣架悬挂，简洁背景 | 单品展示、卫衣、外套 | 校园风开衫、字母卫衣 |
| **场景搭配** | 主题背景+配饰道具 | IP联名、节日款 | 万圣节蜘蛛侠、加菲猫套装 |
| **模特实拍** | 真人模特穿着展示 | 高端款、亲子装 | 圣诞亲子睡衣 |

### 1.2 爆款图案印花类型

从图片中识别的热门图案类型：

#### A. IP角色联名 (高销量)
- **经典卡通**: 加菲猫(Garfield)、大力水手(Popeye)、猫和老鼠(Tom & Jerry)
- **动画IP**: 汪汪队(PAW Patrol)、CoComelon、Nick 90s复古
- **潮流IP**: TRALALA鲨鱼、Sparklyn粉猫

#### B. 图案元素 (中高销量)
- **几何图形**: 爱心❤️、星星⭐、蝴蝶结🎀、彩虹🌈
- **字母文字**: "LOVE"、"B"字母贴布、"NEW YORK"
- **动物图案**: 恐龙、兔子、小熊、蝴蝶

#### C. 风格主题 (稳定销量)
- **学院风**: 字母贴布、条纹、格纹
- **甜美风**: 蝴蝶结、爱心、粉色系
- **运动风**: 数字、球队风格、撞色拼接

### 1.3 色彩趋势分析

| 色系 | 热门组合 | 适用风格 |
|-----|---------|---------|
| **粉色系** | 粉+白、粉+灰、粉+紫 | 女童甜美、公主风 |
| **蓝色系** | 蓝+白、蓝+黄、蓝+红 | 男童运动、海洋风 |
| **中性色** | 灰+白、米+棕、黑+白 | 学院风、简约风 |
| **撞色系** | 红+蓝+黄、橙+蓝 | IP联名、运动风 |

### 1.4 摄影风格特点

#### Flat Lay 平铺风格要点：
```
- 背景: 浅色木纹/白色毛绒毯/米色针织布
- 道具: 与服装主题相关的小物件
  - 爱心服装 → 爱心装饰、粉色花朵
  - 恐龙服装 → 恐龙玩具、星星装饰
  - 睡衣套装 → 毛绒玩具、枕头
- 构图: 45度斜放或正放，留白适中
- 光线: 柔和自然光，无强烈阴影
```

#### 挂拍风格要点：
```
- 背景: 纯色墙面/木板墙/简约场景
- 衣架: 木质衣架或儿童专用衣架
- 配饰: 帽子、包包、鞋子搭配
- 构图: 居中或三分法，突出服装
```

---

## 二、节点优化任务清单

### 2.1 图案生成节点 (GeminiPatternNode)

| 任务 | 优先级 | 状态 | 说明 |
|-----|-------|------|------|
| 添加SHEIN爆款风格预设 | P0 | ⬜ 待开始 | 基于分析添加10+新预设 |
| 优化无缝平铺提示词 | P0 | ⬜ 待开始 | 强化seamless要求 |
| 添加IP风格生成模式 | P1 | ⬜ 待开始 | 支持类IP角色生成 |
| 优化色彩控制提示词 | P1 | ⬜ 待开始 | 更精准的色彩指导 |

### 2.2 电商实拍图节点 (GeminiEcomNode)

| 任务 | 优先级 | 状态 | 说明 |
|-----|-------|------|------|
| 添加Flat Lay平铺模式 | P0 | ⬜ 待开始 | SHEIN主流展示方式 |
| 添加挂拍模式 | P0 | ⬜ 待开始 | 单品展示方式 |
| 优化道具搭配提示词 | P1 | ⬜ 待开始 | 智能道具推荐 |
| 添加背景风格预设 | P1 | ⬜ 待开始 | 木纹/毛绒/纯色等 |

### 2.3 模特生成节点 (GeminiModelNode)

| 任务 | 优先级 | 状态 | 说明 |
|-----|-------|------|------|
| 优化童模年龄段描述 | P0 | ⬜ 待开始 | 4-7岁精准描述 |
| 添加SHEIN风格预设 | P0 | ⬜ 待开始 | 年轻活力风格 |
| 优化姿态自然度 | P1 | ⬜ 待开始 | 更自然的童模姿态 |
| 添加场景背景预设 | P1 | ⬜ 待开始 | 与服装主题匹配 |

---

## 三、Nanobanana Pro 完美流水线方案

### 3.1 流水线架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    完美童装电商流水线                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [输入] ──► [图案生成] ──► [Mockup贴图] ──► [电商展示图] ──► [输出] │
│                                                                 │
│  Stage 1: 图案设计                                               │
│  ├── 风格选择 (IP风格/几何图案/字母文字)                           │
│  ├── 色彩方案 (粉色系/蓝色系/撞色系)                               │
│  └── 图案生成 (Nanobanana Pro)                                   │
│                                                                 │
│  Stage 2: 服装贴图                                               │
│  ├── 底衣选择 (T恤/卫衣/套装)                                     │
│  ├── 贴图位置 (胸前/全身/裤子)                                    │
│  └── Mockup生成 (Gemini Edit)                                   │
│                                                                 │
│  Stage 3: 电商展示                                               │
│  ├── 展示模式 (Flat Lay/挂拍/模特)                               │
│  ├── 背景风格 (木纹/毛绒/场景)                                    │
│  └── 最终渲染 (Gemini Generate)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 各阶段详细配置

#### Stage 1: 图案生成 (Nanobanana Pro)

**推荐参数配置:**
```json
{
  "model": "nanobanana-pro",
  "style_preset": "shein_kids_cute",
  "output_format": "seamless_tile",
  "resolution": "1024x1024",
  "color_mode": "vibrant_pastel"
}
```

**新增风格预设:**
- `shein_kawaii` - 日系可爱风
- `shein_sporty` - 运动活力风
- `shein_preppy` - 学院风
- `shein_ip_style` - IP角色风
- `shein_geometric` - 几何图案风

#### Stage 2: Mockup贴图 (Gemini Edit)

**贴图模式:**
- `placement_print` - 胸前印花 (T恤、卫衣)
- `allover_print` - 全身印花 (睡衣、裤子)
- `set_mockup` - 套装贴图 (上衣+裤子)

#### Stage 3: 电商展示 (Gemini Generate)

**展示模式预设:**
```typescript
const DISPLAY_MODES = {
  flat_lay: {
    name: 'Flat Lay 平铺',
    background: ['wood_texture', 'white_fur', 'knit_fabric'],
    props: ['themed_toys', 'accessories', 'flowers'],
    angle: 'top_down_45deg'
  },
  hanger: {
    name: '挂拍展示',
    background: ['white_wall', 'wood_panel', 'gradient'],
    props: ['hat', 'bag', 'shoes'],
    angle: 'front_straight'
  },
  model: {
    name: '模特实拍',
    background: ['studio', 'lifestyle', 'outdoor'],
    pose: ['natural', 'playful', 'confident'],
    angle: 'eye_level'
  }
}
```

---

## 四、新增预设模块设计

### 4.1 SHEIN爆款风格预设

```typescript
// constants/sheinPresets.ts

export const SHEIN_PATTERN_PRESETS = [
  // IP角色风格
  {
    id: 'ip_kawaii_animal',
    name: 'Kawaii动物IP',
    prompt: 'Cute kawaii animal character, big eyes, soft pastel colors, chibi style, friendly expression, suitable for kids clothing print',
    tags: ['IP', '可爱', '动物']
  },
  {
    id: 'ip_cartoon_hero',
    name: '卡通英雄IP',
    prompt: 'Cartoon hero character, bold colors, dynamic pose, comic style, energetic and fun, suitable for boys clothing',
    tags: ['IP', '男童', '英雄']
  },

  // 几何图案
  {
    id: 'geo_hearts_scatter',
    name: '爱心散点',
    prompt: 'Scattered heart pattern, various sizes, pink and red tones, playful arrangement, seamless tile for fabric',
    tags: ['几何', '爱心', '女童']
  },
  {
    id: 'geo_rainbow_stripe',
    name: '彩虹条纹',
    prompt: 'Rainbow stripe pattern, soft pastel colors, horizontal or diagonal stripes, cheerful and bright',
    tags: ['几何', '彩虹', '中性']
  },

  // 字母文字
  {
    id: 'text_varsity_letter',
    name: '学院字母',
    prompt: 'Varsity style letter patch, chenille texture, classic college font, navy and white colors',
    tags: ['文字', '学院风', '中性']
  },
  {
    id: 'text_love_script',
    name: 'LOVE手写体',
    prompt: 'Handwritten "LOVE" script, romantic cursive font, pink or red color, with small hearts',
    tags: ['文字', '甜美', '女童']
  }
]

export const SHEIN_DISPLAY_PRESETS = [
  {
    id: 'flat_lay_cozy',
    name: '温馨平铺',
    background: 'soft white fur blanket or knit texture',
    props: 'matching accessories, small plush toys, dried flowers',
    lighting: 'soft natural daylight, no harsh shadows',
    composition: '45-degree angle, centered garment, props around edges'
  },
  {
    id: 'flat_lay_wood',
    name: '木纹平铺',
    background: 'light wood grain texture, rustic feel',
    props: 'themed decorations matching the print, simple accessories',
    lighting: 'warm natural light, slight shadows for depth',
    composition: 'straight top-down or slight angle, clean arrangement'
  },
  {
    id: 'hanger_minimal',
    name: '简约挂拍',
    background: 'clean white or light gray wall',
    props: 'wooden hanger, optional hat or bag',
    lighting: 'even studio lighting, soft shadows',
    composition: 'centered, full garment visible, minimal distractions'
  }
]
```

### 4.2 年龄段优化预设

```typescript
export const SHEIN_AGE_PRESETS = {
  young_girls_4_7: {
    label: 'Young Girls (4-7岁)',
    appearance: 'cute young girl, 4-7 years old, innocent expression, natural hair',
    pose: 'playful, natural, slightly shy or curious',
    style_keywords: ['cute', 'sweet', 'playful', 'innocent']
  },
  young_boys_4_7: {
    label: 'Young Boys (4-7岁)',
    appearance: 'energetic young boy, 4-7 years old, bright smile, neat hair',
    pose: 'active, confident, adventurous',
    style_keywords: ['cool', 'sporty', 'fun', 'adventurous']
  },
  toddler_1_3: {
    label: 'Toddler (1-3岁)',
    appearance: 'adorable toddler, 1-3 years old, chubby cheeks, soft features',
    pose: 'sitting, standing with support, natural baby movements',
    style_keywords: ['adorable', 'soft', 'gentle', 'precious']
  }
}
```

---

## 五、实施计划

### Phase 1: 基础优化 (本周)

- [ ] 创建 `constants/sheinPresets.ts` 预设文件
- [ ] 更新 `GeminiPatternNode` 添加新风格预设
- [ ] 更新 `GeminiEcomNode` 添加Flat Lay模式
- [ ] 优化系统提示词，融入SHEIN风格要求

### Phase 2: 流水线优化 (下周)

- [ ] 设计完整的Nanobanana Pro工作流模板
- [ ] 添加智能道具推荐功能
- [ ] 优化Mockup贴图质量
- [ ] 添加批量生成支持

### Phase 3: 预设模块升级 (后续)

- [ ] 添加更多IP风格预设
- [ ] 添加季节性预设 (圣诞、万圣节等)
- [ ] 添加平台特定预设 (SHEIN/TEMU/Amazon)
- [ ] 用户自定义预设功能

---

## 六、关键提示词优化

### 6.1 图案生成核心提示词

```
[SHEIN Kids Pattern Generation]

You are an expert textile designer creating patterns for SHEIN kids clothing.

STYLE REQUIREMENTS:
- Target: Young children 4-7 years old
- Aesthetic: Cute, playful, age-appropriate
- Colors: Vibrant but not overwhelming, pastel-friendly
- Appeal: Must attract both children and parents

PATTERN TYPES:
1. Character/IP Style: Cute animals, cartoon characters, friendly faces
2. Geometric: Hearts, stars, rainbows, polka dots, stripes
3. Text/Letter: Varsity letters, cute phrases, brand-style logos
4. Themed: Dinosaurs, unicorns, space, ocean, sports

TECHNICAL REQUIREMENTS:
- Seamless tileable pattern
- Print-ready resolution (300 DPI equivalent)
- Clear motifs at fabric scale (5-8cm real size)
- No visible repeat seams when tiled

OUTPUT: Generate a seamless pattern tile suitable for children's clothing fabric printing.
```

### 6.2 电商展示图核心提示词

```
[SHEIN E-commerce Product Photo]

You are a professional e-commerce photographer for SHEIN kids clothing.

FLAT LAY STYLE:
- Background: Soft textured surface (white fur, light wood, knit fabric)
- Arrangement: Garment laid flat, slightly angled (30-45 degrees)
- Props: Theme-matching accessories, small toys, decorative items
- Lighting: Soft natural daylight, even illumination, minimal shadows
- Composition: Clean, uncluttered, Instagram-worthy aesthetic

QUALITY STANDARDS:
- High resolution, sharp details
- True-to-life colors
- Professional product photography quality
- Ready for e-commerce listing

MOOD: Fresh, inviting, appealing to young parents shopping online
```

### 6.3 模特生成核心提示词

```
[SHEIN Kids Model Photo]

You are a children's fashion photographer creating SHEIN-style product photos.

MODEL REQUIREMENTS:
- Age: 4-7 years old (Young Girls/Boys category)
- Expression: Natural, happy, age-appropriate
- Pose: Relaxed, playful, not overly posed
- Hair/Styling: Clean, natural, age-appropriate

PHOTO STYLE:
- Lighting: Soft, flattering, even illumination
- Background: Clean studio or lifestyle setting
- Mood: Cheerful, energetic, appealing to parents
- Quality: High-resolution, professional grade

IMPORTANT:
- Child must look natural and comfortable
- Clothing must be clearly visible and well-fitted
- Background should complement but not distract from the garment
```

---

## 七、文件修改清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `constants/sheinPresets.ts` | 新建 | SHEIN风格预设 |
| `constants/ecomPresets.ts` | 更新 | 添加Flat Lay预设 |
| `constants/promptPresets.ts` | 更新 | 添加新图案预设 |
| `constants/system-prompts.ts` | 更新 | 优化系统提示词 |
| `nodes/image/GeminiPatternNode/executor.ts` | 更新 | 集成新预设 |
| `nodes/image/GeminiEcomNode/executor.ts` | 更新 | 添加展示模式 |
| `components/ConfigForms/PatternConfigForm.tsx` | 更新 | 添加预设选择器 |
| `components/ConfigForms/EcomPresetSelector.tsx` | 更新 | 添加展示模式 |

---

## 八、节点间协作设计 (1+1=2 效果)

### 8.1 节点协作架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        节点协作生态系统                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ VisionPrompt│───►│ PatternNode │───►│  EditNode   │───►│  EcomNode   │  │
│  │   (分析)    │    │  (图案生成)  │    │ (Mockup贴图)│    │ (电商展示)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                 │                  │                  │          │
│         ▼                 ▼                  ▼                  ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ promptJson  │    │ patternTile │    │ mockupImage │    │ finalImage  │  │
│  │ (结构化数据) │    │ (无缝图案)   │    │ (贴图服装)   │    │ (电商成品)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                                                       │          │
│         └───────────────────────────────────────────────────────┘          │
│                              共享上下文                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ModelNode (模特生成)                          │   │
│  │  可从任意阶段接入：promptJson / mockupImage / 原始服装图               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 数据流协议设计

#### A. 统一的上下文传递格式

```typescript
// 节点间共享的上下文数据结构
interface WorkflowContext {
  // 服装分析结果 (来自 VisionPrompt)
  garmentAnalysis?: {
    style: string           // 风格类型: 'kawaii' | 'sporty' | 'preppy' | 'ip_theme'
    colors: string[]        // 主色调: ['pink', 'white', 'gold']
    patterns: string[]      // 图案元素: ['hearts', 'ribbons', 'stars']
    ipCharacter?: string    // IP角色: 'Hello Kitty' | 'Garfield'
    targetAge: string       // 目标年龄: '4-7' | '8-12'
    targetGender: string    // 目标性别: 'girl' | 'boy' | 'unisex'
  }

  // 图案生成参数 (传递给 PatternNode)
  patternParams?: {
    stylePreset: string     // 风格预设ID
    colorScheme: string[]   // 配色方案
    density: string         // 密度: 'sparse' | 'medium' | 'dense'
    seamlessMode: boolean   // 是否无缝
  }

  // 贴图参数 (传递给 EditNode)
  mockupParams?: {
    printType: string       // 印花类型: 'placement' | 'allover' | 'set'
    printPosition: string   // 印花位置: 'chest' | 'full' | 'pants'
    scaleMode: string       // 缩放模式: 'auto' | 'tile' | 'fit'
  }

  // 展示参数 (传递给 EcomNode)
  displayParams?: {
    displayMode: string     // 展示模式: 'flat_lay' | 'hanger' | 'model'
    background: string      // 背景风格
    props: string[]         // 道具列表
    lighting: string        // 光线风格
  }
}
```

#### B. 节点输出标准化

```typescript
// 每个节点的标准输出格式
interface NodeOutput {
  // 主要输出
  image?: string           // 单图输出
  images?: string[]        // 多图输出

  // 元数据 (供下游节点使用)
  metadata: {
    nodeType: string       // 节点类型
    timestamp: number      // 生成时间
    config: object         // 使用的配置

    // 分析结果 (VisionPrompt 特有)
    analysis?: object

    // 图案信息 (PatternNode 特有)
    patternInfo?: {
      seamless: boolean
      colorPalette: string[]
      motifSize: string
    }

    // 贴图信息 (EditNode 特有)
    mockupInfo?: {
      printType: string
      garmentType: string
    }
  }

  // 上下文传递 (供下游节点继承)
  context?: WorkflowContext
}
```

### 8.3 智能参数继承机制

#### A. VisionPrompt → PatternNode 协作

```typescript
// VisionPrompt 分析服装后，自动推荐图案生成参数
function derivePatternParams(analysis: GarmentAnalysis): PatternParams {
  return {
    // 根据服装风格推荐图案类型
    patternType: mapStyleToPattern(analysis.style),
    // 根据服装颜色推荐配色
    colorScheme: analysis.colors,
    // 根据目标年龄推荐密度
    density: analysis.targetAge === '4-7' ? 'medium' : 'dense',
    // 根据IP角色推荐风格
    stylePreset: analysis.ipCharacter
      ? `ip_${analysis.ipCharacter.toLowerCase()}`
      : `${analysis.style}_default`
  }
}

// 风格到图案类型的映射
const STYLE_TO_PATTERN_MAP = {
  'kawaii': 'cartoon',
  'sporty': 'geometric',
  'preppy': 'geometric',
  'ip_theme': 'cartoon',
  'sweet': 'floral',
  'street': 'abstract'
}
```

#### B. PatternNode → EditNode 协作

```typescript
// PatternNode 生成图案后，自动推荐贴图参数
function deriveMockupParams(patternInfo: PatternInfo, garmentType: string): MockupParams {
  return {
    // 根据图案类型推荐印花方式
    printType: patternInfo.seamless ? 'allover' : 'placement',
    // 根据服装类型推荐位置
    printPosition: garmentType === 'pants' ? 'full' : 'chest',
    // 根据图案密度推荐缩放
    scaleMode: patternInfo.seamless ? 'tile' : 'fit',
    // 传递配色信息用于智能染色
    dyeColor: patternInfo.colorPalette[0]
  }
}
```

#### C. EditNode → EcomNode 协作

```typescript
// EditNode 生成 Mockup 后，自动推荐展示参数
function deriveDisplayParams(mockupInfo: MockupInfo, context: WorkflowContext): DisplayParams {
  const style = context.garmentAnalysis?.style || 'default'

  return {
    // 根据服装类型推荐展示模式
    displayMode: mockupInfo.garmentType === 'set' ? 'flat_lay' : 'hanger',
    // 根据风格推荐背景
    background: STYLE_TO_BACKGROUND_MAP[style],
    // 根据风格推荐道具
    props: STYLE_TO_PROPS_MAP[style],
    // 根据风格推荐光线
    lighting: style === 'sweet' ? 'warm_soft' : 'neutral_even'
  }
}

// 风格到背景的映射
const STYLE_TO_BACKGROUND_MAP = {
  'kawaii': 'white_fur',
  'sporty': 'wood_texture',
  'preppy': 'gray_gradient',
  'sweet': 'pink_knit',
  'ip_theme': 'themed_scene'
}

// 风格到道具的映射
const STYLE_TO_PROPS_MAP = {
  'kawaii': ['plush_toy', 'ribbon', 'stars'],
  'sporty': ['ball', 'sneakers', 'cap'],
  'preppy': ['books', 'glasses', 'badge'],
  'sweet': ['flowers', 'hearts', 'candy'],
  'ip_theme': ['ip_toys', 'themed_items']
}
```

### 8.4 提示词协同优化

#### A. 跨节点提示词一致性

```typescript
// 确保各节点提示词风格一致的基础模板
const UNIFIED_STYLE_KEYWORDS = {
  shein: {
    quality: 'professional e-commerce quality, SHEIN standard',
    mood: 'young, trendy, Instagram-worthy',
    target: 'young parents shopping for kids 4-7 years old'
  },
  temu: {
    quality: 'clear product visibility, value-focused',
    mood: 'practical, trustworthy, detail-oriented',
    target: 'budget-conscious shoppers'
  }
}

// 各节点使用统一的风格关键词
function buildUnifiedPrompt(nodeType: string, platform: string): string {
  const keywords = UNIFIED_STYLE_KEYWORDS[platform]

  const basePrompt = `
[Platform Style: ${platform.toUpperCase()}]
Quality Standard: ${keywords.quality}
Mood & Aesthetic: ${keywords.mood}
Target Audience: ${keywords.target}
`
  return basePrompt
}
```

#### B. 上下文感知的提示词增强

```typescript
// PatternNode 感知 VisionPrompt 的分析结果
function enhancePatternPrompt(basePrompt: string, context: WorkflowContext): string {
  if (!context.garmentAnalysis) return basePrompt

  const analysis = context.garmentAnalysis

  return `${basePrompt}

[Context from Garment Analysis]
- Detected Style: ${analysis.style}
- Color Palette: ${analysis.colors.join(', ')}
- Pattern Elements: ${analysis.patterns.join(', ')}
${analysis.ipCharacter ? `- IP Character: ${analysis.ipCharacter}` : ''}

[Coordination Requirement]
Generate a pattern that harmonizes with the detected garment style.
Maintain color consistency with the original garment.
${analysis.ipCharacter ? `Include elements inspired by ${analysis.ipCharacter} character.` : ''}
`
}

// EcomNode 感知整个流水线的上下文
function enhanceEcomPrompt(basePrompt: string, context: WorkflowContext): string {
  const parts = [basePrompt]

  if (context.garmentAnalysis) {
    parts.push(`
[Garment Context]
Style: ${context.garmentAnalysis.style}
Target: ${context.garmentAnalysis.targetAge} ${context.garmentAnalysis.targetGender}
`)
  }

  if (context.patternParams) {
    parts.push(`
[Pattern Context]
Style Preset: ${context.patternParams.stylePreset}
Color Scheme: ${context.patternParams.colorScheme.join(', ')}
`)
  }

  parts.push(`
[Coordination Requirement]
Ensure the final e-commerce photo reflects all upstream design decisions.
Props and background should complement the garment's style and pattern.
Maintain visual consistency throughout the product presentation.
`)

  return parts.join('\n')
}
```

### 8.5 协作效果验证清单

| 协作路径 | 预期效果 | 验证方法 |
|---------|---------|---------|
| VisionPrompt → PatternNode | 图案风格与服装分析一致 | 对比分析结果和生成图案 |
| PatternNode → EditNode | 贴图比例和位置合理 | 检查图案在服装上的呈现 |
| EditNode → EcomNode | 展示风格与服装主题匹配 | 检查背景道具是否协调 |
| 全流程 → ModelNode | 模特风格与整体一致 | 检查模特年龄、姿态、场景 |

### 8.6 实现优先级

| 任务 | 优先级 | 复杂度 | 说明 |
|-----|-------|-------|------|
| 统一上下文数据结构 | P0 | 中 | 定义 WorkflowContext 接口 |
| 节点输出标准化 | P0 | 低 | 统一 metadata 格式 |
| VisionPrompt → PatternNode 协作 | P1 | 中 | 实现参数推导逻辑 |
| PatternNode → EditNode 协作 | P1 | 中 | 实现贴图参数推导 |
| EditNode → EcomNode 协作 | P1 | 中 | 实现展示参数推导 |
| 跨节点提示词一致性 | P2 | 低 | 统一风格关键词 |
| 上下文感知提示词增强 | P2 | 高 | 实现动态提示词生成 |

---

## 九、完整工作流模板

### 9.1 SHEIN 童装爆款生成流程

```yaml
name: SHEIN Kids Bestseller Generator
description: 从创意到电商成品的完整流水线

nodes:
  - id: input
    type: image_input
    config:
      label: "参考图片/灵感图"

  - id: vision_analysis
    type: vision_prompt
    inputs:
      image: input.image
    config:
      styleMode: daily
      ageGroup: small_kid
      gender: female

  - id: pattern_gen
    type: gemini_pattern
    inputs:
      reference: input.image
      context: vision_analysis.promptJson
    config:
      patternType: seamless
      stylePreset: auto  # 根据分析自动选择
      density: medium
      colorTone: auto    # 根据分析自动选择

  - id: mockup_top
    type: gemini_edit
    inputs:
      garment: base_tshirt.image
      pattern: pattern_gen.patternImage
    config:
      editMode: placement_print
      position: chest

  - id: mockup_pants
    type: gemini_edit
    inputs:
      garment: base_pants.image
      pattern: pattern_gen.patternImage
    config:
      editMode: allover_print
      scaleMode: tile

  - id: ecom_display
    type: gemini_ecom
    inputs:
      top: mockup_top.image
      bottom: mockup_pants.image
    config:
      layout: flat_lay
      stylePreset: auto  # 根据上下文自动选择
      fillMode: filled

  - id: model_photo
    type: gemini_model
    inputs:
      promptJson: vision_analysis.promptJson
      garmentImages: [mockup_top.image, mockup_pants.image]
    config:
      ageGroup: small_kid
      gender: female
      scenePreset: home

outputs:
  - pattern: pattern_gen.patternImage
  - mockup_set: [mockup_top.image, mockup_pants.image]
  - ecom_photo: ecom_display.images
  - model_photo: model_photo.modelImage
```

### 9.2 快速单品生成流程

```yaml
name: Quick Single Item Generator
description: 快速生成单品电商图

nodes:
  - id: pattern_gen
    type: gemini_pattern
    config:
      patternType: tshirt_front
      stylePreset: ip_kawaii_animal

  - id: mockup
    type: gemini_edit
    inputs:
      garment: base_tshirt.image
      graphic: pattern_gen.graphicImage
    config:
      editMode: placement_print

  - id: ecom_display
    type: gemini_ecom
    inputs:
      garment: mockup.image
    config:
      layout: hanger
      stylePreset: shein

outputs:
  - graphic: pattern_gen.graphicImage
  - mockup: mockup.image
  - ecom_photo: ecom_display.images
```

---

---

## 十、统一JSON提示词系统设计

### 10.1 设计目标

将VisionPrompt节点升级为**统一提示词生成中心**，支持三种输出模式：
- **模特提示词JSON** - 用于GeminiModelNode生成模特图
- **图案提示词JSON** - 用于GeminiPatternNode生成图案
- **电商图提示词JSON** - 用于GeminiEcomNode生成电商展示图

### 10.2 JSON Schema 定义

#### A. 模特提示词JSON (现有格式扩展)

```typescript
interface ModelPromptJson {
  // 基础信息
  type: 'model'
  version: '2.0'

  // 模特描述
  age_years: number
  gender: 'male' | 'female'
  age_group: 'small_kid' | 'big_kid' | 'adult'
  ethnicity: string
  appearance: string

  // 服装描述
  subject: string
  garment_style: string
  garment_colors: string[]

  // 场景描述
  scene_preset: string
  foreground: string
  midground: string
  background: string

  // 技术参数
  composition: string
  visual_guidance: string
  color_tone: string
  lighting_mood: string
  camera_params: string

  // 附加信息
  has_hat: boolean
  has_mask: boolean
  ip_brand?: string
  ip_desc?: string

  // 输出提示词
  caption: string
  video_prompt: string
}
```

#### B. 图案提示词JSON (新增)

```typescript
interface PatternPromptJson {
  // 基础信息
  type: 'pattern'
  version: '1.0'

  // 图案风格
  pattern_style: string           // 'kawaii' | 'sporty' | 'preppy' | 'ip_theme' | 'sweet'
  pattern_type: string            // 'seamless' | 'placement' | 'allover'
  target_gender: 'girl' | 'boy' | 'unisex'
  target_age: string              // '4-7' | '8-12' | 'adult'

  // 元素描述
  main_elements: string[]         // ['hearts', 'stars', 'animals']
  secondary_elements: string[]    // ['sparkles', 'dots', 'ribbons']
  ip_character?: string           // 'Hello Kitty' | 'Garfield' | null

  // 色彩方案
  color_palette: string[]         // ['#FF69B4', '#FFFFFF', '#FFD700']
  color_mood: string              // 'pastel' | 'vibrant' | 'muted' | 'neon'
  background_color: string        // '#FFFFFF'

  // 布局参数
  density: 'sparse' | 'medium' | 'dense'
  symmetry: 'none' | 'horizontal' | 'vertical' | 'radial'
  scale: 'small' | 'medium' | 'large'

  // 技术要求
  seamless_required: boolean
  print_ready: boolean
  resolution_hint: string         // '1024x1024' | '2048x2048'

  // 生成提示词
  style_prompt: string            // 完整的风格描述
  element_prompt: string          // 元素描述
  technical_prompt: string        // 技术要求
  full_prompt: string             // 合并后的完整提示词
}
```

#### C. 电商图提示词JSON (新增)

```typescript
interface EcomPromptJson {
  // 基础信息
  type: 'ecom'
  version: '1.0'

  // 展示模式
  display_mode: 'flat_lay' | 'hanger' | 'scene' | 'model'
  platform_style: 'shein' | 'temu' | 'amazon' | 'taobao' | 'xiaohongshu'

  // 服装信息 (从图片分析)
  garment_type: string            // 'set' | 'top' | 'bottom' | 'dress'
  garment_style: string           // 'kawaii' | 'sporty' | 'preppy'
  garment_colors: string[]
  has_print: boolean
  print_description?: string

  // 背景设置
  background_type: string         // 'white_fur' | 'wood_texture' | 'colored_wall'
  background_color?: string

  // 道具推荐
  suggested_props: string[]       // ['plush_toy', 'ribbon', 'flowers']
  prop_placement: string          // 'corners' | 'sides' | 'scattered'

  // 光线设置
  lighting_style: string          // 'natural_soft' | 'studio_even' | 'warm_ambient'
  shadow_style: string            // 'minimal' | 'soft' | 'dramatic'

  // 构图参数
  composition: string             // '45_degree' | 'top_down' | 'front_straight'
  garment_angle: number           // 0-45 度
  fill_mode: 'filled' | 'flat'    // Ghost Mannequin 效果

  // 生成提示词
  background_prompt: string
  props_prompt: string
  lighting_prompt: string
  composition_prompt: string
  full_prompt: string             // 合并后的完整提示词
}
```

### 10.3 VisionPrompt 节点升级设计

#### A. 新增配置项

```typescript
// 在 configSchema.fields 中添加
{
  key: 'outputMode',
  label: '输出模式',
  type: 'select',
  required: true,
  default: 'model',
  options: [
    { label: '模特提示词', value: 'model' },
    { label: '图案提示词', value: 'pattern' },
    { label: '电商图提示词', value: 'ecom' },
    { label: '全部输出', value: 'all' }
  ],
  description: '选择生成的提示词类型'
}
```

#### B. 新增输出端口

```typescript
outputs: [
  // 现有输出
  { id: 'promptJson', label: '提示词 JSON', dataType: 'json' },
  { id: 'caption', label: '图片描述', dataType: 'text' },
  { id: 'videoPrompt', label: '视频提示词', dataType: 'text' },

  // 新增输出
  { id: 'modelPromptJson', label: '模特提示词', dataType: 'json' },
  { id: 'patternPromptJson', label: '图案提示词', dataType: 'json' },
  { id: 'ecomPromptJson', label: '电商图提示词', dataType: 'json' }
]
```

#### C. 系统提示词模板

```typescript
// 图案分析系统提示词
const PATTERN_ANALYSIS_PROMPT = `
你是一位专业的童装图案设计师和纺织品专家。
分析输入的服装图片，提取图案设计相关信息，生成用于AI图案生成的结构化JSON。

# 分析要点
1. 识别图案风格（可爱/运动/学院/IP主题/甜美等）
2. 提取主要图案元素（爱心、星星、动物、文字等）
3. 分析色彩方案（主色、辅色、背景色）
4. 判断图案密度和布局特点
5. 识别是否为IP角色图案

# JSON 输出格式
{
  "type": "pattern",
  "version": "1.0",
  "pattern_style": "...",
  "pattern_type": "seamless|placement|allover",
  "target_gender": "girl|boy|unisex",
  "target_age": "4-7|8-12|adult",
  "main_elements": ["..."],
  "secondary_elements": ["..."],
  "ip_character": "...|null",
  "color_palette": ["#...", "#..."],
  "color_mood": "pastel|vibrant|muted|neon",
  "background_color": "#...",
  "density": "sparse|medium|dense",
  "symmetry": "none|horizontal|vertical|radial",
  "scale": "small|medium|large",
  "seamless_required": true|false,
  "print_ready": true,
  "resolution_hint": "1024x1024",
  "style_prompt": "...",
  "element_prompt": "...",
  "technical_prompt": "...",
  "full_prompt": "..."
}
`

// 电商图分析系统提示词
const ECOM_ANALYSIS_PROMPT = `
你是一位专业的电商产品摄影师和视觉营销专家。
分析输入的服装图片，生成用于AI电商图生成的结构化JSON。

# 分析要点
1. 识别服装类型（套装/上衣/下装/连衣裙）
2. 分析服装风格和目标受众
3. 推荐最佳展示模式（平铺/挂拍/场景）
4. 推荐背景和道具搭配
5. 设计光线和构图方案

# JSON 输出格式
{
  "type": "ecom",
  "version": "1.0",
  "display_mode": "flat_lay|hanger|scene|model",
  "platform_style": "shein|temu|amazon",
  "garment_type": "set|top|bottom|dress",
  "garment_style": "...",
  "garment_colors": ["..."],
  "has_print": true|false,
  "print_description": "...",
  "background_type": "white_fur|wood_texture|colored_wall",
  "background_color": "#...",
  "suggested_props": ["..."],
  "prop_placement": "corners|sides|scattered",
  "lighting_style": "natural_soft|studio_even|warm_ambient",
  "shadow_style": "minimal|soft|dramatic",
  "composition": "45_degree|top_down|front_straight",
  "garment_angle": 30,
  "fill_mode": "filled|flat",
  "background_prompt": "...",
  "props_prompt": "...",
  "lighting_prompt": "...",
  "composition_prompt": "...",
  "full_prompt": "..."
}
`
```

### 10.4 下游节点接口设计

#### A. GeminiPatternNode 接收 patternPromptJson

```typescript
// 新增输入端口
inputs: [
  { id: 'reference', label: '参考图片', dataType: 'image', required: false },
  { id: 'patternPromptJson', label: '图案提示词', dataType: 'json', required: false }
]

// 执行器中处理
async execute(inputs, config, context) {
  // 如果有 patternPromptJson 输入，优先使用
  if (inputs.patternPromptJson) {
    const json = inputs.patternPromptJson as PatternPromptJson
    // 从 JSON 构建提示词
    const prompt = this.buildPromptFromJson(json)
    // 使用 JSON 中的配置覆盖默认配置
    config = { ...config, ...this.extractConfigFromJson(json) }
  }
  // ... 继续执行
}
```

#### B. GeminiEcomNode 接收 ecomPromptJson

```typescript
// 新增输入端口
inputs: [
  { id: 'top', label: '上衣图片', dataType: 'image', required: true },
  { id: 'bottom', label: '下装图片', dataType: 'image', required: false },
  { id: 'ecomPromptJson', label: '电商图提示词', dataType: 'json', required: false }
]

// 执行器中处理
async execute(inputs, config, context) {
  // 如果有 ecomPromptJson 输入，优先使用
  if (inputs.ecomPromptJson) {
    const json = inputs.ecomPromptJson as EcomPromptJson
    // 从 JSON 构建提示词
    const prompt = this.buildPromptFromJson(json)
    // 使用 JSON 中的配置
    config = {
      ...config,
      layout: json.display_mode,
      stylePreset: json.platform_style,
      fillMode: json.fill_mode
    }
  }
  // ... 继续执行
}
```

### 10.5 工作流示例

```yaml
name: 智能童装电商流水线
description: 使用统一JSON提示词系统的完整流水线

nodes:
  - id: input
    type: image_input

  # 分析服装，生成三种提示词
  - id: vision_analysis
    type: vision_prompt
    inputs:
      image_1: input.image
    config:
      outputMode: all  # 输出所有类型的提示词

  # 使用图案提示词生成新图案
  - id: pattern_gen
    type: gemini_pattern
    inputs:
      reference: input.image
      patternPromptJson: vision_analysis.patternPromptJson

  # 使用电商图提示词生成展示图
  - id: ecom_display
    type: gemini_ecom
    inputs:
      top: mockup.image
      ecomPromptJson: vision_analysis.ecomPromptJson

  # 使用模特提示词生成模特图
  - id: model_photo
    type: gemini_model
    inputs:
      promptJson: vision_analysis.modelPromptJson
      garmentImages: [mockup.image]
```

### 10.6 合并提示词节点设计

#### 现状分析

当前有两个功能相似的提示词节点：
- **VisionPromptNode** - 使用视觉模型分析图片
- **QwenPromptNode** - 使用 Qwen 模型分析图片

两者输入输出几乎相同，只是使用的模型不同。

#### 合并方案：统一提示词节点 (UnifiedPromptNode)

```typescript
// nodes/ai/UnifiedPromptNode/index.ts

export const UnifiedPromptNode: NodeDefinition = {
  metadata: {
    type: 'unified_prompt',
    label: '智能提示词',
    icon: '🎯',
    category: 'ai',
    version: '2.0.0',
    description: '统一的AI提示词生成节点，支持多种输出模式'
  },

  inputs: [
    { id: 'image_1', label: '图片 1 (主图)', dataType: 'image', required: true },
    { id: 'image_2', label: '图片 2 (可选)', dataType: 'image', required: false },
    { id: 'image_3', label: '图片 3 (可选)', dataType: 'image', required: false }
  ],

  outputs: [
    // 通用输出
    { id: 'promptJson', label: '提示词 JSON', dataType: 'json' },
    { id: 'caption', label: '描述文本', dataType: 'text' },
    { id: 'videoPrompt', label: '视频提示词', dataType: 'text' },

    // 专用输出 (根据 outputMode 激活)
    { id: 'modelPromptJson', label: '模特提示词', dataType: 'json' },
    { id: 'patternPromptJson', label: '图案提示词', dataType: 'json' },
    { id: 'ecomPromptJson', label: '电商图提示词', dataType: 'json' }
  ],

  configSchema: {
    fields: [
      // ========== 模型选择 ==========
      {
        key: 'modelProvider',
        label: '模型类型',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动选择', value: 'auto' },
          { label: 'Gemini Vision', value: 'gemini' },
          { label: 'Qwen VL', value: 'qwen' },
          { label: 'GPT-4 Vision', value: 'gpt4v' }
        ]
      },
      {
        key: 'providerId',
        label: '模型服务',
        type: 'model-selector',
        required: false
      },

      // ========== 输出模式 (核心) ==========
      {
        key: 'outputMode',
        label: '输出模式',
        type: 'select',
        default: 'model',
        options: [
          { label: '🧑 模特提示词', value: 'model' },
          { label: '🎨 图案提示词', value: 'pattern' },
          { label: '📸 电商图提示词', value: 'ecom' },
          { label: '📦 全部输出', value: 'all' }
        ],
        description: '选择生成的提示词类型，决定使用哪个系统提示词'
      },

      // ========== 通用配置 ==========
      {
        key: 'ageGroup',
        label: '年龄段',
        type: 'select',
        default: 'small_kid',
        options: [
          { label: 'Young Girls/Boys (4-7岁)', value: 'small_kid' },
          { label: 'Kids (8-12岁)', value: 'big_kid' },
          { label: '成人', value: 'adult' }
        ]
      },
      {
        key: 'gender',
        label: '性别',
        type: 'select',
        default: 'female',
        options: [
          { label: '女', value: 'female' },
          { label: '男', value: 'male' }
        ]
      },

      // ========== 模特模式专用 ==========
      {
        key: 'styleMode',
        label: '风格模式',
        type: 'select',
        default: 'daily',
        options: [
          { label: '日常感 (iPhone美学)', value: 'daily' },
          { label: '商拍感 (专业摄影)', value: 'commercial' }
        ],
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },
      {
        key: 'scenePreset',
        label: '场景预设',
        type: 'select',
        default: 'home',
        options: [
          { label: '室内家居', value: 'home' },
          { label: '户外场景', value: 'outdoor' },
          { label: '摄影棚', value: 'studio' }
        ],
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },
      {
        key: 'ethnicityPreset',
        label: '人种预设',
        type: 'select',
        default: 'asian',
        options: [
          { label: '亚洲人', value: 'asian' },
          { label: '欧美白人', value: 'caucasian' },
          { label: '非裔', value: 'african_american' },
          { label: '混血', value: 'mixed' }
        ],
        showWhen: { field: 'outputMode', value: ['model', 'all'] }
      },

      // ========== 图案模式专用 ==========
      {
        key: 'patternType',
        label: '图案类型',
        type: 'select',
        default: 'seamless',
        options: [
          { label: '无缝平铺', value: 'seamless' },
          { label: '胸前大图', value: 'placement' },
          { label: '全身印花', value: 'allover' }
        ],
        showWhen: { field: 'outputMode', value: ['pattern', 'all'] }
      },
      {
        key: 'patternStyle',
        label: '图案风格',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动识别', value: 'auto' },
          { label: 'Kawaii可爱', value: 'kawaii' },
          { label: '运动活力', value: 'sporty' },
          { label: '学院风', value: 'preppy' },
          { label: 'IP主题', value: 'ip_theme' },
          { label: '甜美风', value: 'sweet' }
        ],
        showWhen: { field: 'outputMode', value: ['pattern', 'all'] }
      },

      // ========== 电商图模式专用 ==========
      {
        key: 'displayMode',
        label: '展示模式',
        type: 'select',
        default: 'flat_lay',
        options: [
          { label: 'Flat Lay 平铺', value: 'flat_lay' },
          { label: '挂拍展示', value: 'hanger' },
          { label: '场景搭配', value: 'scene' }
        ],
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },
      {
        key: 'platformStyle',
        label: '平台风格',
        type: 'select',
        default: 'shein',
        options: [
          { label: 'SHEIN', value: 'shein' },
          { label: 'TEMU', value: 'temu' },
          { label: 'Amazon', value: 'amazon' },
          { label: '淘宝', value: 'taobao' },
          { label: '小红书', value: 'xiaohongshu' }
        ],
        showWhen: { field: 'outputMode', value: ['ecom', 'all'] }
      },

      // ========== 通用高级配置 ==========
      {
        key: 'constraintPrompt',
        label: '约束提示词',
        type: 'textarea',
        required: false,
        placeholder: '自定义约束条件...'
      },
      {
        key: 'temperature',
        label: '创意度',
        type: 'number',
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1
      }
    ]
  }
}
```

#### 执行器设计

```typescript
// nodes/ai/UnifiedPromptNode/executor.ts

export class UnifiedPromptExecutor extends BaseNodeExecutor {
  constructor() {
    super('unified_prompt')
  }

  async execute(inputs, config, context) {
    const outputMode = config.outputMode || 'model'

    // 根据 outputMode 选择系统提示词
    const systemPrompt = this.getSystemPrompt(outputMode, config)

    // 调用视觉模型
    const result = await this.callVisionModel(inputs, systemPrompt, config)

    // 解析 JSON 结果
    const json = this.parseJsonResponse(result)

    // 根据 outputMode 构建输出
    return this.buildOutput(json, outputMode)
  }

  private getSystemPrompt(mode: string, config: any): string {
    switch (mode) {
      case 'model':
        return this.buildModelSystemPrompt(config)
      case 'pattern':
        return this.buildPatternSystemPrompt(config)
      case 'ecom':
        return this.buildEcomSystemPrompt(config)
      case 'all':
        return this.buildAllModesSystemPrompt(config)
      default:
        return this.buildModelSystemPrompt(config)
    }
  }

  private buildOutput(json: any, mode: string) {
    const outputs: Record<string, any> = {
      promptJson: json,
      caption: json.caption || json.full_prompt || '',
      videoPrompt: json.video_prompt || ''
    }

    // 根据模式设置专用输出
    if (mode === 'model' || mode === 'all') {
      outputs.modelPromptJson = json.type === 'model' ? json : this.extractModelJson(json)
    }
    if (mode === 'pattern' || mode === 'all') {
      outputs.patternPromptJson = json.type === 'pattern' ? json : this.extractPatternJson(json)
    }
    if (mode === 'ecom' || mode === 'all') {
      outputs.ecomPromptJson = json.type === 'ecom' ? json : this.extractEcomJson(json)
    }

    return this.success(outputs)
  }
}
```

### 10.7 迁移计划

| 阶段 | 任务 | 说明 |
|-----|------|------|
| Phase 1 | 创建 UnifiedPromptNode | 新建统一节点，保留旧节点 |
| Phase 2 | 添加三种输出模式 | 实现 model/pattern/ecom 系统提示词 |
| Phase 3 | 测试新节点 | 验证各模式输出正确 |
| Phase 4 | 标记旧节点 deprecated | VisionPromptNode, QwenPromptNode |
| Phase 5 | 迁移现有工作流 | 提供迁移工具或指南 |
| Phase 6 | 移除旧节点 | 清理代码 |

### 10.8 实现优先级 (更新)

| 任务 | 优先级 | 说明 |
|-----|-------|------|
| 创建 UnifiedPromptNode 节点 | P0 | 合并两个提示词节点 |
| 定义三种 JSON Schema | P0 | ModelPromptJson, PatternPromptJson, EcomPromptJson |
| 实现 outputMode 切换逻辑 | P0 | 根据模式选择系统提示词 |
| 添加条件显示配置项 | P1 | showWhen 实现 |
| GeminiPatternNode 接收 JSON 输入 | P1 | 添加 patternPromptJson 输入 |
| GeminiEcomNode 接收 JSON 输入 | P1 | 添加 ecomPromptJson 输入 |
| 标记旧节点 deprecated | P2 | 保持向后兼容 |
| 测试完整流水线 | P2 | 验证 JSON 传递和使用 |

---

*文档版本: v1.3*
*最后更新: 2025-12-12*
*新增: 节点间协作设计、完整工作流模板、统一JSON提示词系统、合并提示词节点设计*
