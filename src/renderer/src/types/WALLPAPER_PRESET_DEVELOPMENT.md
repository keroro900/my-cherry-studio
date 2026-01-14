# 壁纸预设开发文档 🎨

## 概述

Cherry Studio 的壁纸预设系统允许开发者创建完整的主题预设，每个预设包含：
- 壁纸图片（URL或CSS渐变）
- 完整的组件样式（侧边栏、聊天气泡、输入栏、代码块等）
- 亮色/暗色模式支持

---

# 📁 第一部分：文件位置说明

## 所有相关文件的完整路径

```
cherry-studio/
└── src/
    └── renderer/
        └── src/
            ├── types/
            │   ├── wallpaperPresetCss.ts    ← CSS生成器（不需要修改）
            │   ├── wallpaperPresets.ts      ← ⭐ 预设配置（添加新预设在这里！）
            │   └── WALLPAPER_PRESET_DEVELOPMENT.md  ← 本文档
            │
            ├── context/
            │   └── GlobalStyleProvider.tsx  ← CSS注入器（不需要修改）
            │
            ├── pages/settings/DisplaySettings/
            │   ├── UnifiedPresetModal.tsx   ← 预设选择弹窗（不需要修改）
            │   └── DisplaySettings.tsx      ← 显示设置页面（不需要修改）
            │
            └── i18n/locales/
                ├── zh-CN.json               ← ⭐ 中文翻译（需要添加）
                ├── en-US.json               ← ⭐ 英文翻译（需要添加）
                └── [其他语言].json          ← 可选：其他语言翻译
```

### 你只需要修改这两个文件！

| 文件 | 路径 | 作用 |
|-----|------|------|
| **wallpaperPresets.ts** | `src/renderer/src/types/wallpaperPresets.ts` | 添加新预设配置 |
| **zh-CN.json** | `src/renderer/src/i18n/locales/zh-CN.json` | 添加预设名称翻译 |

---

## 架构

```
预设配置 (WallpaperPresetConfig)
    ↓
CSS生成器 (generatePresetCss)
    ↓
预设对象 (WallpaperPresetV2)
    ↓
注入页面 (GlobalStyleProvider)
```

## CSS优先级

```
基础CSS < 预设CSS < 自定义CSS
```

用户的自定义CSS可以覆盖预设样式。

---

# 👶 第二部分：宝宝级教程 - 一步一步添加新预设

## 🚀 快速开始：3分钟添加一个新预设

### 第1步：打开预设配置文件

1. 打开 VS Code 或你的代码编辑器
2. 按 `Ctrl+P`（Mac: `Cmd+P`）
3. 输入 `wallpaperPresets.ts` 并回车
4. 文件路径：`src/renderer/src/types/wallpaperPresets.ts`

### 第2步：找到添加位置

在文件中找到 `PRESET_CONFIGS` 数组，它长这样：

```typescript
// 在文件的大约第 20-30 行附近
const PRESET_CONFIGS: WallpaperPresetConfig[] = [
  {
    id: 'preset-sakura',
    // ... 第一个预设的配置
  },
  {
    id: 'preset-pink-anime',
    // ... 第二个预设的配置
  },
  // ... 更多预设

  // ⬇️ 在最后一个预设的 } 后面添加你的新预设！
]
```

### 第3步：复制模板并粘贴

在数组的最后一个 `}` 后面（但在 `]` 之前），添加一个逗号，然后粘贴以下模板：

```typescript
  // ⬆️ 上一个预设的结尾，记得加逗号！
  {
    id: 'preset-你的预设英文名',           // 改成你的预设ID
    name: 'wallpaper.preset.你的预设英文名', // 改成你的i18n key
    thumbnail: '亮色壁纸的URL',             // 改成你的缩略图URL
    themeMode: 'both',

    // === 亮色模式配置 ===
    light: {
      wallpaperUrl: '亮色壁纸的URL',
      colorBackground: 'rgba(240, 240, 240, 0.35)',
      colorBackgroundSoft: 'rgba(245, 245, 245, 0.75)',
      colorBackgroundMute: 'rgba(235, 235, 235, 0.38)',
      navbarBackground: 'var(--color-white-soft)',
      sidebarBackground: 'rgba(240, 240, 240, 0.6)',
      chatBackgroundUser: 'rgba(你的主题色RGB, 0.75)',
      chatBackgroundAssistant: 'rgba(200, 200, 200, 0.5)',
      contentOverlayStart: 'rgba(主题色RGB, 0.12)',
      contentOverlayEnd: 'rgba(主题色RGB深, 0.22)',
      inputbarBackground: 'rgba(250, 250, 250, 0.7)',
      inputbarBorder: 'rgba(主题色RGB, 0.45)',
      codeBackground: 'rgba(230, 230, 230, 0.5)',
      codeTextColor: 'rgba(50, 50, 50, 0.85)',
      codeBlockBg: 'rgba(245, 245, 245, 0.75)',
      codeBlockBorder: 'rgba(主题色RGB, 0.2)',
      textPrimary: 'rgba(30, 30, 30, 0.9)',
      textSecondary: 'rgba(80, 80, 80, 0.75)',
      focusColorRgb: '主题色R, 主题色G, 主题色B',
      sidebarGlassStart: 'rgba(主题色RGB, 0.5)',
      sidebarGlassEnd: 'rgba(主题色RGB深, 0.3)',
      sidebarGlassTint: 'rgba(强调色RGB, 0.1)',
      sidebarBorder: 'rgba(主题色RGB, 0.3)'
    },

    // === 暗色模式配置 ===
    dark: {
      wallpaperUrl: '暗色壁纸的URL',
      colorBackground: 'rgba(30, 30, 30, 0.3)',
      colorBackgroundSoft: 'rgba(40, 40, 40, 0.75)',
      colorBackgroundMute: 'rgba(35, 35, 35, 0.75)',
      navbarBackground: 'var(--color-black-soft)',
      sidebarBackground: 'rgba(30, 30, 30, 0.6)',
      chatBackgroundUser: 'rgba(主题色深RGB, 0.8)',
      chatBackgroundAssistant: 'rgba(50, 50, 50, 0.5)',
      contentOverlayStart: 'rgba(主题色深RGB, 0.2)',
      contentOverlayEnd: 'rgba(主题色更深RGB, 0.3)',
      inputbarBackground: 'rgba(40, 40, 40, 0.75)',
      inputbarBorder: 'rgba(主题色RGB, 0.4)',
      codeBackground: 'rgba(35, 35, 35, 0.5)',
      codeTextColor: 'rgba(200, 200, 200, 0.85)',
      codeBlockBg: 'rgba(35, 35, 35, 0.8)',
      codeBlockBorder: 'rgba(主题色RGB, 0.2)',
      textPrimary: 'rgba(230, 230, 230, 0.9)',
      textSecondary: 'rgba(170, 170, 170, 0.75)',
      focusColorRgb: '主题色R, 主题色G, 主题色B',
      sidebarGlassStart: 'rgba(主题色深RGB, 0.3)',
      sidebarGlassEnd: 'rgba(主题色更深RGB, 0.2)',
      sidebarGlassTint: 'rgba(强调色RGB, 0.08)',
      sidebarBorder: 'rgba(主题色RGB, 0.25)'
    }
  }
  // ⬇️ 这里是数组的结尾 ]
```

### 第4步：添加翻译

1. 打开翻译文件：`src/renderer/src/i18n/locales/zh-CN.json`
2. 找到其他 `wallpaper.preset.xxx` 的翻译（搜索 "wallpaper.preset"）
3. 添加你的预设名称：

```json
{
  "wallpaper.preset.你的预设英文名": "你的预设中文名"
}
```

4. 同样的，在 `en-US.json` 中添加英文名称

### 第5步：保存并测试

1. 保存所有修改的文件
2. 运行 `yarn dev` 启动开发模式
3. 打开设置 → 显示 → 预设主题 → 管理预设
4. 你的新预设应该出现在列表中了！

---

## 📝 详细示例：创建"初音未来"预设

### 完整代码示例

下面是一个完整的、可以直接复制使用的预设代码：

```typescript
  // 在 PRESET_CONFIGS 数组中添加
  {
    id: 'preset-miku',
    name: 'wallpaper.preset.miku',
    thumbnail: 'https://example.com/miku-light.jpg',
    themeMode: 'both',

    // 初音未来 - 亮色模式（日常/演唱会白天场景）
    light: {
      wallpaperUrl: 'https://example.com/miku-light.jpg',
      // 背景：薄荷绿/蓝绿色调
      colorBackground: 'rgba(230, 250, 250, 0.35)',
      colorBackgroundSoft: 'rgba(240, 252, 252, 0.75)',
      colorBackgroundMute: 'rgba(225, 248, 248, 0.38)',
      navbarBackground: 'var(--color-white-soft)',
      sidebarBackground: 'rgba(230, 250, 250, 0.6)',
      // 聊天气泡：初音蓝绿色
      chatBackgroundUser: 'rgba(57, 197, 187, 0.7)',
      chatBackgroundAssistant: 'rgba(200, 230, 230, 0.5)',
      // 内容遮罩
      contentOverlayStart: 'rgba(57, 197, 187, 0.12)',
      contentOverlayEnd: 'rgba(40, 150, 145, 0.22)',
      // 输入栏
      inputbarBackground: 'rgba(245, 255, 255, 0.7)',
      inputbarBorder: 'rgba(57, 197, 187, 0.45)',
      // 代码
      codeBackground: 'rgba(225, 248, 248, 0.5)',
      codeTextColor: 'rgba(30, 60, 60, 0.85)',
      codeBlockBg: 'rgba(235, 252, 252, 0.75)',
      codeBlockBorder: 'rgba(57, 197, 187, 0.2)',
      // 文字
      textPrimary: 'rgba(25, 55, 55, 0.9)',
      textSecondary: 'rgba(50, 100, 100, 0.75)',
      // 焦点色：初音蓝绿
      focusColorRgb: '57, 197, 187',
      // 侧边栏玻璃
      sidebarGlassStart: 'rgba(57, 197, 187, 0.5)',
      sidebarGlassEnd: 'rgba(40, 150, 145, 0.3)',
      sidebarGlassTint: 'rgba(0, 220, 200, 0.12)',
      sidebarBorder: 'rgba(57, 197, 187, 0.3)'
    },

    // 初音未来 - 暗色模式（演唱会夜晚/荧光棒场景）
    dark: {
      wallpaperUrl: 'https://example.com/miku-dark.jpg',
      // 背景：深蓝绿色调
      colorBackground: 'rgba(20, 45, 45, 0.3)',
      colorBackgroundSoft: 'rgba(30, 55, 55, 0.75)',
      colorBackgroundMute: 'rgba(25, 50, 50, 0.75)',
      navbarBackground: 'var(--color-black-soft)',
      sidebarBackground: 'rgba(20, 45, 45, 0.6)',
      // 聊天气泡：深蓝绿色
      chatBackgroundUser: 'rgba(35, 120, 115, 0.8)',
      chatBackgroundAssistant: 'rgba(40, 65, 65, 0.5)',
      // 内容遮罩
      contentOverlayStart: 'rgba(30, 90, 85, 0.2)',
      contentOverlayEnd: 'rgba(20, 60, 55, 0.3)',
      // 输入栏
      inputbarBackground: 'rgba(30, 55, 55, 0.75)',
      inputbarBorder: 'rgba(57, 197, 187, 0.4)',
      // 代码
      codeBackground: 'rgba(25, 50, 50, 0.5)',
      codeTextColor: 'rgba(180, 230, 225, 0.85)',
      codeBlockBg: 'rgba(25, 50, 50, 0.8)',
      codeBlockBorder: 'rgba(57, 197, 187, 0.2)',
      // 文字
      textPrimary: 'rgba(220, 250, 248, 0.9)',
      textSecondary: 'rgba(150, 200, 195, 0.75)',
      // 焦点色：保持初音蓝绿
      focusColorRgb: '57, 197, 187',
      // 侧边栏玻璃
      sidebarGlassStart: 'rgba(57, 180, 170, 0.3)',
      sidebarGlassEnd: 'rgba(40, 130, 125, 0.2)',
      sidebarGlassTint: 'rgba(0, 255, 230, 0.1)',
      sidebarBorder: 'rgba(57, 197, 187, 0.25)'
    }
  }
```

### 翻译文件修改

**zh-CN.json:**
```json
"wallpaper.preset.miku": "初音未来"
```

**en-US.json:**
```json
"wallpaper.preset.miku": "Hatsune Miku"
```

---

## 🔧 常见问题解答 (FAQ)

### Q: 我添加的预设没有显示出来？

**检查清单：**
1. ✅ 确保在上一个预设的 `}` 后面加了逗号 `,`
2. ✅ 确保 `id` 是唯一的，以 `preset-` 开头
3. ✅ 保存了文件
4. ✅ 重新运行 `yarn dev`

### Q: 预设名称显示的是 key 而不是中文？

**解决方法：**
- 检查 `zh-CN.json` 中是否添加了对应的翻译
- 确保 `name` 字段的值和翻译 key 完全一致

### Q: 壁纸图片不显示？

**解决方法：**
- 确保 URL 是完整的 `https://` 开头的链接
- 确保图片可以公开访问（在浏览器中直接打开试试）
- 检查是否有跨域问题

### Q: 颜色看起来不对？

**检查清单：**
- `rgba()` 格式是否正确：`rgba(红, 绿, 蓝, 透明度)`
- RGB 值范围是 0-255
- 透明度范围是 0-1（0 是完全透明，1 是完全不透明）

---

## 📐 颜色格式速查表

### rgba 格式

```
rgba(红色值, 绿色值, 蓝色值, 透明度)

红/绿/蓝值：0-255
透明度：0.0 - 1.0

例如：
- rgba(255, 0, 0, 0.5)     → 半透明红色
- rgba(0, 255, 0, 1.0)     → 完全不透明绿色
- rgba(100, 150, 200, 0.3) → 30%透明度的蓝灰色
```

### focusColorRgb 格式

```
只写 RGB 值，用逗号分隔，不要写 rgba()

例如：
- '255, 100, 150'   → 粉色
- '57, 197, 187'    → 蓝绿色
- '100, 180, 255'   → 蓝色
```

### 颜色提取工具推荐

1. **浏览器取色器**：在壁纸图片上右键 → 检查 → 使用取色器
2. **在线工具**：https://imagecolorpicker.com/
3. **Photoshop/GIMP**：使用吸管工具

---

## 📂 文件结构详细说明

### wallpaperPresets.ts 文件结构

```typescript
// 📍 文件位置: src/renderer/src/types/wallpaperPresets.ts

// ======= 第1部分：导入 =======
import { type WallpaperPresetConfig, type WallpaperPresetV2, generatePresetCss } from './wallpaperPresetCss'

// ======= 第2部分：预设配置数组（你要修改的地方！）=======
const PRESET_CONFIGS: WallpaperPresetConfig[] = [
  {
    // 第1个预设配置
    id: 'preset-sakura',
    name: 'wallpaper.preset.sakura',
    thumbnail: '...',
    themeMode: 'both',
    light: { /* ... */ },
    dark: { /* ... */ }
  },
  {
    // 第2个预设配置
    id: 'preset-pink-anime',
    // ...
  },
  // ...更多预设...

  // ⬇️⬇️⬇️ 在这里添加你的新预设！⬇️⬇️⬇️
  {
    id: 'preset-your-new-preset',
    // ...你的新预设配置
  }
]  // ← 数组结束

// ======= 第3部分：导出（不需要修改）=======
export const WALLPAPER_PRESETS_V2: WallpaperPresetV2[] = PRESET_CONFIGS.map((config) => ({
  id: config.id,
  name: config.name,
  thumbnail: config.thumbnail,
  themeMode: config.themeMode,
  presetCss: generatePresetCss(config)
}))

export function getAllPresetConfigs(): WallpaperPresetConfig[] {
  return PRESET_CONFIGS
}
```

### 翻译文件位置

```
src/renderer/src/i18n/locales/
├── zh-CN.json    ← 中文（简体）
├── zh-TW.json    ← 中文（繁体）
├── en-US.json    ← 英语
├── ja-JP.json    ← 日语
├── ko-KR.json    ← 韩语
├── ru-RU.json    ← 俄语
└── ...           ← 其他语言
```

**在翻译文件中找到添加位置：**
搜索 `wallpaper.preset` 关键字，然后在附近添加你的翻译。

---

## 🔄 完整工作流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        添加新预设的完整流程                        │
└─────────────────────────────────────────────────────────────────┘

   第1步                  第2步                  第3步
┌──────────┐         ┌──────────┐         ┌──────────┐
│  准备素材  │   →    │  写配置   │   →    │  加翻译   │
└──────────┘         └──────────┘         └──────────┘
     │                    │                    │
     ▼                    ▼                    ▼
 • 找壁纸图片         • 打开                 • 打开
   (亮色+暗色)         wallpaperPresets.ts    zh-CN.json
 • 提取主题色         • 复制模板             • 添加中文名
 • 确定缩略图         • 填写配置             • 同步到其他语言

                         │
                         ▼
                    第4步：测试
                  ┌──────────┐
                  │ yarn dev │
                  └──────────┘
                         │
                         ▼
                  设置 → 显示 → 预设主题
                         │
                         ▼
                    检查效果！
```

---

# 🎨 第三部分：预设设计核心原则

### 1. 角色/风格一致性原则

**每个预设必须围绕一个明确的角色或风格主题**，所有颜色、效果都要服务于这个主题：

| 预设类型 | 示例 | 设计方向 |
|---------|------|---------|
| 角色预设 | 五条悟、玛奇玛 | 提取角色标志性颜色（眼睛、服装、能力特效） |
| 游戏预设 | 原神、星穹铁道 | 使用游戏UI配色、标志性元素颜色 |
| 氛围预设 | 赛博朋克、星空夜 | 提取场景主色调、光影特征 |
| 风格预设 | 粉色动漫、梦幻 | 统一的色彩情绪（温暖/冷酷/浪漫） |

### 2. 亮色/暗色双模式要求

**重要：每个预设应该同时支持亮色和暗色模式**，使用 `themeMode: 'both'`。

#### 同一角色的双模式设计

```typescript
{
  id: 'preset-character-name',
  name: 'wallpaper.preset.character_name',
  themeMode: 'both',  // 必须支持双模式

  // 亮色模式：使用角色的明亮场景/日间版本
  light: {
    wallpaperUrl: 'https://...角色-亮色场景.jpg',
    // 浅色背景 + 角色主题色的淡化版本
  },

  // 暗色模式：使用角色的暗色场景/夜间版本/战斗场景
  dark: {
    wallpaperUrl: 'https://...角色-暗色场景.jpg',
    // 深色背景 + 角色主题色的深化版本
  }
}
```

#### 壁纸选择指南

| 模式 | 壁纸类型 | 示例 |
|-----|---------|------|
| 亮色 | 日常场景、明亮背景、柔和光线 | 角色在阳光下、花丛中、蓝天白云 |
| 暗色 | 战斗场景、夜晚、能力释放 | 角色在黑夜中、能力特效、星空下 |

### 3. 配色提取方法

#### 步骤一：分析壁纸主色

```
1. 打开壁纸图片
2. 使用取色器提取以下颜色：
   - 主色调（占比最大的颜色）
   - 强调色（角色眼睛/能力/服装亮点）
   - 背景色（场景背景的主要颜色）
   - 辅助色（点缀颜色）
```

#### 步骤二：建立配色方案

```typescript
// 以五条悟为例
const GOJO_COLORS = {
  // 主题色：无量空处的蓝色
  primary: '#64B4FF',        // 蓝色（眼睛、六眼）
  primaryDark: '#3D8BD9',    // 深蓝
  primaryLight: '#A0D4FF',   // 浅蓝

  // 强调色：领域展开特效
  accent: '#00FFFF',         // 青色光芒

  // 背景色
  bgLight: '#F0F8FF',        // 亮色模式背景（天空蓝）
  bgDark: '#1A2A40',         // 暗色模式背景（深邃蓝）
}
```

#### 步骤三：应用到组件

| 组件 | 亮色模式应用 | 暗色模式应用 |
|-----|-------------|-------------|
| 侧边栏玻璃 | 主题色淡化 (opacity: 0.2-0.3) | 主题色深化 (opacity: 0.3-0.4) |
| 聊天气泡-用户 | 主题色中等透明度 (0.7-0.8) | 主题色深色版 (0.7-0.8) |
| 输入栏边框 | 主题色 (opacity: 0.4-0.5) | 主题色 (opacity: 0.3-0.4) |
| 焦点色 | 强调色 RGB | 强调色 RGB |
| 代码块 | 背景色淡化 | 背景色深化 |

### 4. 风格匹配要求

#### 动作/战斗类角色

```typescript
// 如：电锯人、咒术回战角色
{
  // 使用高对比度、锐利的颜色
  focusColorRgb: '200, 80, 80',  // 鲜艳的红色
  sidebarGlassTint: 'rgba(200, 60, 60, 0.08)',  // 微弱的红色调
  // 边框更明显
  inputbarBorder: 'rgba(180, 70, 70, 0.4)',
}
```

#### 温柔/治愈类角色

```typescript
// 如：间谍过家家、Fate樱
{
  // 使用柔和、温暖的颜色
  focusColorRgb: '255, 100, 150',  // 柔和粉色
  sidebarGlassTint: 'rgba(255, 180, 200, 0.12)',  // 温柔的粉色调
  // 边框柔和
  inputbarBorder: 'rgba(255, 150, 180, 0.45)',
}
```

#### 科技/赛博类

```typescript
// 如：赛博朋克、科幻题材
{
  // 使用霓虹、高饱和颜色
  focusColorRgb: '0, 255, 255',  // 青色
  sidebarGlassTint: 'rgba(0, 255, 255, 0.08)',  // 霓虹青色调
  // 边框发光感
  inputbarBorder: 'rgba(0, 200, 200, 0.4)',
}
```

#### 自然/梦幻类

```typescript
// 如：初音未来、自然风景
{
  // 使用自然、清新的颜色
  focusColorRgb: '57, 197, 187',  // 蓝绿色
  sidebarGlassTint: 'rgba(0, 200, 200, 0.1)',  // 清新蓝绿
  // 边框自然
  inputbarBorder: 'rgba(0, 180, 180, 0.4)',
}
```

---

## 创建新预设

### 1. 定义预设配置

在 `wallpaperPresets.ts` 的 `PRESET_CONFIGS` 数组中添加新配置：

```typescript
const PRESET_CONFIGS: WallpaperPresetConfig[] = [
  // ... 其他预设
  {
    id: 'preset-my-theme',           // 唯一ID，必须以 'preset-' 开头
    name: 'wallpaper.preset.my_theme', // i18n key
    thumbnail: 'https://example.com/thumbnail.jpg',  // 缩略图URL
    themeMode: 'both',               // 推荐使用 'both' 支持双模式
    light: { /* 亮色模式配置 */ },
    dark: { /* 暗色模式配置 */ }
  }
]
```

### 2. 主题颜色配置

每个主题模式需要配置以下颜色：

```typescript
interface ThemeModeColors {
  // 壁纸
  wallpaperUrl: string              // 壁纸图片URL或CSS渐变

  // 背景色
  colorBackground: string           // 主背景色（带透明度）
  colorBackgroundSoft: string       // 柔和背景色
  colorBackgroundMute: string       // 静音背景色
  navbarBackground: string          // 导航栏背景
  sidebarBackground: string         // 侧边栏背景

  // 聊天气泡
  chatBackgroundUser: string        // 用户消息背景
  chatBackgroundAssistant: string   // AI消息背景

  // 内容区域
  contentOverlayStart: string       // 内容遮罩渐变起始色
  contentOverlayEnd: string         // 内容遮罩渐变结束色

  // 输入栏
  inputbarBackground: string        // 输入栏背景
  inputbarBorder: string            // 输入栏边框

  // 代码
  codeBackground: string            // 行内代码背景
  codeTextColor: string             // 行内代码文字
  codeBlockBg: string               // 代码块背景
  codeBlockBorder: string           // 代码块边框

  // 文字
  textPrimary: string               // 主文字颜色
  textSecondary: string             // 次要文字颜色

  // 焦点色（RGB格式，用于box-shadow）
  focusColorRgb: string             // 例: '100, 180, 255'

  // 侧边栏玻璃效果
  sidebarGlassStart: string         // 玻璃渐变起始色
  sidebarGlassEnd: string           // 玻璃渐变结束色
  sidebarGlassTint: string          // 玻璃色调
  sidebarBorder: string             // 侧边栏边框
}
```

### 3. 颜色设计指南

#### 透明度使用

```
背景色：0.3 - 0.75（让壁纸透出）
聊天气泡：0.5 - 0.8（保证可读性）
输入栏：0.65 - 0.75（半透明效果）
代码块：0.5 - 0.8（清晰显示代码）
```

#### 亮色模式模板

```typescript
light: {
  wallpaperUrl: 'https://...角色-明亮场景.jpg',

  // 背景：使用角色主题色的极淡版本
  colorBackground: 'rgba(240, 248, 255, 0.35)',       // 主题色淡化
  colorBackgroundSoft: 'rgba(245, 250, 255, 0.75)',   // 更淡
  colorBackgroundMute: 'rgba(230, 245, 255, 0.38)',   // 静音色
  navbarBackground: 'var(--color-white-soft)',
  sidebarBackground: 'rgba(240, 248, 255, 0.6)',

  // 聊天气泡：主题色中等透明度
  chatBackgroundUser: 'rgba(180, 220, 255, 0.8)',     // 用户-主题色
  chatBackgroundAssistant: 'rgba(200, 210, 220, 0.5)', // AI-中性色

  // 内容遮罩：轻微遮罩
  contentOverlayStart: 'rgba(主题色, 0.15)',
  contentOverlayEnd: 'rgba(主题色深, 0.25)',

  // 输入栏：主题色边框
  inputbarBackground: 'rgba(240, 248, 255, 0.7)',
  inputbarBorder: 'rgba(主题色, 0.5)',

  // 代码：淡色背景
  codeBackground: 'rgba(230, 240, 250, 0.5)',
  codeTextColor: 'rgba(40, 60, 80, 0.85)',            // 深色文字
  codeBlockBg: 'rgba(240, 248, 255, 0.75)',
  codeBlockBorder: 'rgba(主题色, 0.25)',

  // 文字：深色
  textPrimary: 'rgba(30, 50, 70, 0.9)',
  textSecondary: 'rgba(60, 90, 120, 0.75)',

  // 焦点色：角色强调色
  focusColorRgb: '100, 180, 255',

  // 侧边栏玻璃：主题色调
  sidebarGlassStart: 'rgba(主题色, 0.6)',
  sidebarGlassEnd: 'rgba(主题色深, 0.35)',
  sidebarGlassTint: 'rgba(强调色, 0.12)',
  sidebarBorder: 'rgba(主题色, 0.3)'
}
```

#### 暗色模式模板

```typescript
dark: {
  wallpaperUrl: 'https://...角色-暗色场景.jpg',

  // 背景：使用角色主题色的深色版本
  colorBackground: 'rgba(20, 35, 55, 0.3)',           // 深色基调
  colorBackgroundSoft: 'rgba(30, 45, 65, 0.75)',
  colorBackgroundMute: 'rgba(25, 40, 60, 0.75)',
  navbarBackground: 'var(--color-black-soft)',
  sidebarBackground: 'rgba(20, 35, 50, 0.6)',

  // 聊天气泡：深色版主题色
  chatBackgroundUser: 'rgba(40, 70, 110, 0.8)',       // 用户-深色主题
  chatBackgroundAssistant: 'rgba(35, 55, 80, 0.5)',   // AI-深色中性

  // 内容遮罩：深色遮罩
  contentOverlayStart: 'rgba(主题深色, 0.2)',
  contentOverlayEnd: 'rgba(主题更深, 0.3)',

  // 输入栏：深色背景+主题边框
  inputbarBackground: 'rgba(30, 50, 75, 0.65)',
  inputbarBorder: 'rgba(主题色, 0.5)',

  // 代码：深色背景
  codeBackground: 'rgba(25, 45, 70, 0.5)',
  codeTextColor: 'rgba(180, 200, 220, 0.85)',         // 浅色文字
  codeBlockBg: 'rgba(25, 45, 70, 0.7)',
  codeBlockBorder: 'rgba(主题色, 0.2)',

  // 文字：浅色
  textPrimary: 'rgba(220, 235, 250, 0.9)',
  textSecondary: 'rgba(160, 185, 210, 0.75)',

  // 焦点色：角色强调色（保持一致）
  focusColorRgb: '100, 180, 255',

  // 侧边栏玻璃：深色主题调
  sidebarGlassStart: 'rgba(深色主题, 0.7)',
  sidebarGlassEnd: 'rgba(更深主题, 0.4)',
  sidebarGlassTint: 'rgba(强调色, 0.1)',
  sidebarBorder: 'rgba(主题色, 0.2)'
}
```

---

## 完整示例：创建角色预设

### 以"五条悟"为例

```typescript
// 1. 确定角色特征
// - 眼睛：蓝色（六眼）
// - 能力：无量空处（蓝紫色空间）
// - 标志色：蓝色、白色、黑色

// 2. 提取配色方案
const GOJO_COLORS = {
  blue: '#64B4FF',
  deepBlue: '#3D6BA8',
  lightBlue: '#E8F4FF',
  cyan: '#00E5FF',  // 能力特效色
}

// 3. 创建预设配置
const GOJO_CONFIG: WallpaperPresetConfig = {
  id: 'preset-gojo',
  name: 'wallpaper.preset.gojo_satoru',
  thumbnail: 'https://...gojo-light.jpg',  // 使用亮色版作为缩略图
  themeMode: 'both',

  // 亮色模式：五条悟日常/帅气场景
  light: {
    wallpaperUrl: 'https://...gojo-casual.jpg',
    colorBackground: 'rgba(232, 244, 255, 0.35)',
    colorBackgroundSoft: 'rgba(240, 248, 255, 0.75)',
    colorBackgroundMute: 'rgba(225, 240, 255, 0.38)',
    navbarBackground: 'var(--color-white-soft)',
    sidebarBackground: 'rgba(235, 245, 255, 0.6)',
    chatBackgroundUser: 'rgba(100, 180, 255, 0.75)',  // 蓝色
    chatBackgroundAssistant: 'rgba(210, 225, 240, 0.5)',
    contentOverlayStart: 'rgba(100, 150, 200, 0.12)',
    contentOverlayEnd: 'rgba(70, 120, 170, 0.22)',
    inputbarBackground: 'rgba(245, 250, 255, 0.7)',
    inputbarBorder: 'rgba(100, 180, 255, 0.45)',
    codeBackground: 'rgba(230, 245, 255, 0.5)',
    codeTextColor: 'rgba(30, 60, 90, 0.85)',
    codeBlockBg: 'rgba(240, 248, 255, 0.75)',
    codeBlockBorder: 'rgba(100, 180, 255, 0.2)',
    textPrimary: 'rgba(25, 50, 75, 0.9)',
    textSecondary: 'rgba(60, 95, 130, 0.75)',
    focusColorRgb: '100, 180, 255',  // 蓝色焦点
    sidebarGlassStart: 'rgba(100, 160, 220, 0.5)',
    sidebarGlassEnd: 'rgba(70, 130, 190, 0.3)',
    sidebarGlassTint: 'rgba(0, 229, 255, 0.1)',  // 青色调（能力色）
    sidebarBorder: 'rgba(100, 180, 255, 0.3)'
  },

  // 暗色模式：五条悟战斗/无量空处场景
  dark: {
    wallpaperUrl: 'https://...gojo-battle.jpg',  // 无量空处场景
    colorBackground: 'rgba(25, 40, 65, 0.3)',
    colorBackgroundSoft: 'rgba(35, 50, 75, 0.75)',
    colorBackgroundMute: 'rgba(30, 45, 70, 0.75)',
    navbarBackground: 'var(--color-black-soft)',
    sidebarBackground: 'rgba(25, 40, 60, 0.6)',
    chatBackgroundUser: 'rgba(50, 90, 140, 0.8)',  // 深蓝色
    chatBackgroundAssistant: 'rgba(40, 60, 90, 0.5)',
    contentOverlayStart: 'rgba(30, 55, 90, 0.2)',
    contentOverlayEnd: 'rgba(20, 40, 70, 0.3)',
    inputbarBackground: 'rgba(30, 50, 75, 0.75)',
    inputbarBorder: 'rgba(100, 160, 220, 0.4)',
    codeBackground: 'rgba(25, 45, 70, 0.5)',
    codeTextColor: 'rgba(180, 210, 240, 0.85)',
    codeBlockBg: 'rgba(25, 45, 70, 0.8)',
    codeBlockBorder: 'rgba(100, 160, 220, 0.2)',
    textPrimary: 'rgba(225, 240, 255, 0.9)',
    textSecondary: 'rgba(160, 190, 220, 0.75)',
    focusColorRgb: '100, 180, 255',  // 保持一致的蓝色焦点
    sidebarGlassStart: 'rgba(100, 150, 220, 0.3)',  // 带蓝色调的玻璃
    sidebarGlassEnd: 'rgba(60, 100, 180, 0.2)',
    sidebarGlassTint: 'rgba(0, 229, 255, 0.1)',  // 青色调（能力色）
    sidebarBorder: 'rgba(100, 180, 255, 0.25)'
  }
}
```

---

## 预设质量检查清单

### 设计一致性
- [ ] 亮色和暗色模式使用同一角色/主题
- [ ] 配色从壁纸中提取，与角色风格匹配
- [ ] 焦点色使用角色的标志性颜色
- [ ] 侧边栏玻璃色调与主题一致

### 可读性
- [ ] 亮色模式：深色文字在浅色背景上清晰可读
- [ ] 暗色模式：浅色文字在深色背景上清晰可读
- [ ] 代码块文字与背景对比度足够
- [ ] 聊天气泡内容清晰可见

### 视觉效果
- [ ] 侧边栏玻璃效果透出壁纸
- [ ] 聊天气泡颜色与主题协调
- [ ] 输入栏焦点状态有明显的主题色反馈
- [ ] 整体配色和谐，没有突兀的颜色

### 技术要求
- [ ] `themeMode` 设置为 `'both'`（推荐）
- [ ] 透明度值在合理范围内
- [ ] 壁纸URL可访问且稳定
- [ ] 添加了对应的i18n翻译

---

## 生成的CSS结构

`generatePresetCss()` 函数会生成完整的 CSS 样式。以下是完整的 CSS 结构参考：

### 完整 CSS 模板参考

```css
/* ================================================== */
/* === 全局通用变量 (:root) === */
/* ================================================== */
:root {
    /* 通用颜色 */
    --color-black-soft: rgba(115, 114, 114, 0.5);
    --color-white-soft: rgba(248, 247, 242, 0.5);

    /* 通用样式 */
    --common-border-radius: 8px;
    --transition-duration: 0.5s;
    --transition-easing: ease-in-out;

    /* 内容区背景色 */
    --content-bgcolor-soft: var(--sidebar-item-hover-bg, rgba(255,255,255,.06));
    --content-bgcolor-hard: var(--sidebar-item-active-bg, rgba(255,255,255,.12));

    /* 阴影 */
    --box-shadow: 0 6px 18px rgba(0,0,0,.08);
}

/* ================================================== */
/* === 壁纸背景设置 === */
/* ================================================== */
body {
    background-image: var(--chat-background-image);
    background-repeat: no-repeat;
    background-position: center 30%;
    background-size: cover;
    background-attachment: fixed;
    background-color: transparent !important;
}

#content-container {
    background-image: none !important;
}

/* ================================================== */
/* === 亮色主题 (Light Theme) === */
/* ================================================== */
body[theme-mode="light"] {
    /* --- 核心调色板 --- */
    --color-background: rgba(231, 251, 251, 0.35);
    --color-background-soft: rgba(247, 253, 251, 0.75);
    --color-background-mute: rgba(213, 246, 231, 0.38);

    /* --- 布局背景 --- */
    --navbar-background: var(--color-white-soft);
    --sidebar-background: rgba(245, 248, 250, 0.6);
    --chat-background: var(--color-white-soft);

    /* --- 聊天气泡 --- */
    --chat-background-user: rgba(192, 255, 187, 0.8);      /* 用户消息 - 主题色 */
    --chat-background-assistant: rgba(200, 200, 200, 0.5); /* AI消息 - 中性色 */

    /* --- 壁纸和遮罩 --- */
    --chat-background-image: url('https://your-wallpaper-url.jpg');
    --content-overlay-color-start: rgba(240, 245, 245, 0.2);
    --content-overlay-color-end: rgba(220, 230, 230, 0.3);

    /* --- 输入栏 --- */
    --inputbar-background-color: rgba(250, 250, 250, 0.65);
    --inputbar-border-color: rgba(200, 205, 210, 0.6);

    /* --- 代码样式 --- */
    --code-background-color: rgba(230, 230, 230, 0.5);
    --code-text-color: rgba(50, 50, 50, 0.85);
    --pre-code-text-color: rgba(30, 30, 30, 0.9);
    --code-block-bg: rgba(242, 245, 248, 0.7);
    --code-block-border-color: rgba(0, 0, 0, 0.07);

    /* --- 文字颜色 --- */
    --text-color-primary: rgba(40, 40, 40, 0.9);
    --text-color-secondary: rgba(80, 80, 80, 0.75);
    --sidebar-text-color: var(--text-color-secondary);
    --sidebar-icon-color: var(--text-color-secondary);

    /* --- 焦点色（RGB格式，用于动态计算） --- */
    --input-focus-border-color-rgb: 60, 130, 220;  /* ⭐ 主题色 RGB */
    --input-focus-border-color: rgba(var(--input-focus-border-color-rgb), 0.9);
    --input-focus-shadow: 0 0 0 3px rgba(var(--input-focus-border-color-rgb), 0.15);

    /* --- 交互状态 --- */
    --icon-button-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.1);
    --sidebar-item-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.08);
    --sidebar-item-active-bg: rgba(var(--input-focus-border-color-rgb), 0.15);
    --sidebar-item-active-text-color: var(--input-focus-border-color);
    --sidebar-item-active-border-color: var(--input-focus-border-color);

    /* --- 聊天气泡装饰 --- */
    --chat-bubble-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04);
    --chat-bubble-accent-line-color: rgba(var(--input-focus-border-color-rgb), 0.5);

    /* --- 侧边栏玻璃效果 --- */
    --sidebar-glass-start: rgba(255,255,255,.65);
    --sidebar-glass-end:   rgba(255,255,255,.35);
    --sidebar-glass-tint:  rgba(59,130,246,.18);  /* 主题色调 */
    --sidebar-border:      rgba(255,255,255,.45);
}

/* ================================================== */
/* === 暗色主题 (Dark Theme) === */
/* ================================================== */
body[theme-mode="dark"] {
    /* --- 核心调色板 --- */
    --color-background: rgba(43, 42, 42, 0.3);
    --color-background-soft: rgba(48, 48, 48, 0.75);
    --color-background-mute: rgba(40, 44, 52, 0.75);

    /* --- 布局背景 --- */
    --navbar-background: var(--color-black-soft);
    --sidebar-background: rgba(35, 38, 43, 0.6);
    --chat-background: var(--color-black-soft);

    /* --- 聊天气泡 --- */
    --chat-background-user: rgba(65, 72, 85, 0.8);
    --chat-background-assistant: rgba(48, 52, 60, 0.5);

    /* --- 壁纸和遮罩 --- */
    --chat-background-image: url('https://your-dark-wallpaper-url.jpg');
    --content-overlay-color-start: rgba(10, 75, 122, 0.2);
    --content-overlay-color-end: rgba(10, 75, 122, 0.3);

    /* --- 输入栏 --- */
    --inputbar-background-color: rgba(45, 48, 54, 0.65);
    --inputbar-border-color: rgba(70, 75, 82, 0.6);

    /* --- 代码样式 --- */
    --code-background-color: rgba(60, 65, 75, 0.5);
    --code-text-color: rgba(185, 189, 195, 0.85);
    --pre-code-text-color: rgba(200, 205, 210, 0.9);
    --code-block-bg: rgba(40, 43, 50, 0.7);
    --code-block-border-color: rgba(255, 255, 255, 0.1);

    /* --- 文字颜色 --- */
    --text-color-primary: rgba(225, 230, 235, 0.9);
    --text-color-secondary: rgba(170, 175, 180, 0.75);
    --sidebar-text-color: var(--text-color-secondary);
    --sidebar-icon-color: var(--text-color-secondary);

    /* --- 焦点色（RGB格式） --- */
    --input-focus-border-color-rgb: 70, 150, 230;  /* ⭐ 主题色 RGB */
    --input-focus-border-color: rgba(var(--input-focus-border-color-rgb), 0.9);
    --input-focus-shadow: 0 0 0 3px rgba(var(--input-focus-border-color-rgb), 0.2);

    /* --- 交互状态 --- */
    --icon-button-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.12);
    --sidebar-item-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.1);
    --sidebar-item-active-bg: rgba(var(--input-focus-border-color-rgb), 0.2);
    --sidebar-item-active-text-color: var(--input-focus-border-color);
    --sidebar-item-active-border-color: var(--input-focus-border-color);

    /* --- 聊天气泡装饰 --- */
    --chat-bubble-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0, 0, 0, 0.18);
    --chat-bubble-accent-line-color: rgba(var(--input-focus-border-color-rgb), 0.5);

    /* --- 侧边栏玻璃效果 --- */
    --sidebar-glass-start: rgba(50, 50, 55, 0.65);
    --sidebar-glass-end:   rgba(40, 40, 45, 0.35);
    --sidebar-glass-tint:  rgba(70, 150, 230, 0.15);
    --sidebar-border:      rgba(80, 80, 90, 0.45);
}

/* ================================================== */
/* === 基础样式应用 === */
/* ================================================== */

body {
    color: var(--text-color-primary);
    background-color: var(--color-background);
    transition: background-color var(--transition-duration) var(--transition-easing),
                color var(--transition-duration) var(--transition-easing);
}

/* --- 内容区遮罩渐变 --- */
#content-container {
    background-image: linear-gradient(
        var(--content-overlay-color-start),
        var(--content-overlay-color-end)
    ),
    var(--chat-background-image);
    background-repeat: no-repeat;
    background-position: center 30%;
    background-size: cover;
}

/* ================================================== */
/* === 侧边栏玻璃效果（高级） === */
/* ================================================== */

#app-sidebar {
    position: relative;
    background: transparent !important;
    overflow: hidden;
    isolation: isolate;  /* 防止滤镜外溢 */
}

/* 玻璃效果伪元素 */
#app-sidebar::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;

    /* 双层渐变：基础渐变 + 主题色调 */
    background:
        linear-gradient(180deg,
            var(--sidebar-glass-start) 0%,
            var(--sidebar-glass-end) 100%),
        radial-gradient(120% 100% at 50% 0%,
            var(--sidebar-glass-tint) 0%,
            transparent 70%);

    /* 毛玻璃效果 */
    backdrop-filter: blur(5px) saturate(1.2);
    -webkit-backdrop-filter: blur(5px) saturate(1.2);
}

/* 确保内容在玻璃效果之上 */
#app-sidebar > * {
    position: relative;
    z-index: 1;
}

/* 侧边栏项目悬停效果 */
#app-sidebar .item:hover,
#app-sidebar div[class^="Icon"]:hover {
    background-color: var(--content-bgcolor-soft);
    box-shadow: var(--box-shadow);
    border-radius: 12px;
}

/* 侧边栏激活项目 */
#app-sidebar .active,
#app-sidebar div[class^="Icon"].active {
    background-color: var(--content-bgcolor-hard);
    box-shadow: var(--box-shadow);
    border-radius: 12px;
    outline: 1px solid var(--sidebar-border);
}

/* 不支持 backdrop-filter 的降级方案 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    #app-sidebar::before {
        background: linear-gradient(180deg,
            var(--sidebar-glass-start),
            var(--sidebar-glass-end));
    }
}

/* ================================================== */
/* === 输入栏样式 === */
/* ================================================== */

.inputbar-container {
    background-color: var(--inputbar-background-color);
    border: 1px solid var(--inputbar-border-color);
    border-radius: var(--common-border-radius);
    padding: 6px 8px;
    align-items: center;
    gap: 5px;
    transition: border-color var(--transition-duration) var(--transition-easing),
                background-color var(--transition-duration) var(--transition-easing),
                box-shadow var(--transition-duration) var(--transition-easing);
}

/* 输入栏聚焦状态 */
.inputbar-container:focus-within {
    border-color: var(--input-focus-border-color);
    box-shadow: var(--input-focus-shadow);
}

/* 输入框 */
.inputbar-container textarea {
    flex-grow: 1;
    background-color: transparent;
    border: none;
    outline: none;
    resize: none;
    padding: 8px 5px;
    color: var(--text-color-primary);
    font-family: inherit;
    font-size: 1em;
}

.inputbar-container textarea::placeholder {
    color: var(--text-color-secondary);
    opacity: 1;
}

/* 图标按钮 */
.inputbar-container .icon-button {
    background-color: transparent;
    border: none;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color-secondary);
    transition: background-color var(--transition-duration) var(--transition-easing),
                color var(--transition-duration) var(--transition-easing);
}

.inputbar-container .icon-button:hover {
    background-color: var(--icon-button-hover-bg);
    color: var(--input-focus-border-color);
}

/* ================================================== */
/* === 代码块样式 === */
/* ================================================== */

/* 行内代码 */
code {
    background-color: var(--code-background-color);
    color: var(--code-text-color);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
    transition: background-color var(--transition-duration) var(--transition-easing),
                color var(--transition-duration) var(--transition-easing);
}

/* 代码块 */
pre {
    background-color: var(--code-block-bg);
    border: 1px solid var(--code-block-border-color);
    border-radius: var(--common-border-radius);
    padding: 1em;
    overflow-x: auto;
    margin: 1em 0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    transition: background-color var(--transition-duration) var(--transition-easing),
                border-color var(--transition-duration) var(--transition-easing);
}

pre code {
    background-color: transparent;
    color: var(--pre-code-text-color);
    padding: 0;
    font-size: 0.9em;
    border-radius: 0;
}

/* ================================================== */
/* === 聊天气泡样式 === */
/* ================================================== */

.chat-message-bubble {
    padding: 10px 15px;
    border-radius: var(--common-border-radius);
    max-width: 80%;
    line-height: 1.5;
    word-wrap: break-word;
    position: relative;
    box-shadow: var(--chat-bubble-shadow);
    transition: background-color var(--transition-duration) var(--transition-easing),
                box-shadow var(--transition-duration) var(--transition-easing);
}

/* 用户消息 */
.chat-message-bubble.user {
    background-color: var(--chat-background-user);
    align-self: flex-end;
}

/* AI消息 */
.chat-message-bubble.assistant {
    background-color: var(--chat-background-assistant);
    align-self: flex-start;
}

/* 装饰线（底部） */
.chat-message-bubble::after {
    content: '';
    position: absolute;
    bottom: 6px;
    right: 12px;
    width: clamp(20px, 15%, 35px);
    height: 2.5px;
    background-color: var(--chat-bubble-accent-line-color);
    border-radius: 2px;
    opacity: 0.6;
    transition: background-color var(--transition-duration) var(--transition-easing),
                opacity var(--transition-duration) var(--transition-easing);
}

.chat-message-bubble:hover::after {
    opacity: 0.85;
}

/* 边框装饰 */
.chat-message-bubble::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid var(--chat-bubble-accent-line-color);
    pointer-events: none;
    opacity: .4;
    transition: opacity var(--transition-duration) var(--transition-easing);
}

.chat-message-bubble:hover::before {
    opacity: .7;
}
```

---

## CSS 变量完整参考表

### 核心背景变量

| 变量名 | 说明 | 亮色模式示例 | 暗色模式示例 |
|-------|------|-------------|-------------|
| `--color-background` | 主背景色 | `rgba(231, 251, 251, 0.35)` | `rgba(43, 42, 42, 0.3)` |
| `--color-background-soft` | 柔和背景 | `rgba(247, 253, 251, 0.75)` | `rgba(48, 48, 48, 0.75)` |
| `--color-background-mute` | 静音背景 | `rgba(213, 246, 231, 0.38)` | `rgba(40, 44, 52, 0.75)` |
| `--chat-background-image` | 壁纸 URL | `url('...')` | `url('...')` |

### 布局背景变量

| 变量名 | 说明 |
|-------|------|
| `--navbar-background` | 导航栏背景 |
| `--sidebar-background` | 侧边栏背景 |
| `--chat-background` | 聊天区背景 |

### 聊天气泡变量

| 变量名 | 说明 |
|-------|------|
| `--chat-background-user` | 用户消息背景（使用主题色） |
| `--chat-background-assistant` | AI消息背景（使用中性色） |
| `--chat-bubble-shadow` | 气泡阴影 |
| `--chat-bubble-accent-line-color` | 气泡装饰线颜色 |

### 输入栏变量

| 变量名 | 说明 |
|-------|------|
| `--inputbar-background-color` | 输入栏背景 |
| `--inputbar-border-color` | 输入栏边框 |
| `--input-focus-border-color` | 聚焦时边框色 |
| `--input-focus-shadow` | 聚焦时阴影 |

### 代码样式变量

| 变量名 | 说明 |
|-------|------|
| `--code-background-color` | 行内代码背景 |
| `--code-text-color` | 行内代码文字 |
| `--code-block-bg` | 代码块背景 |
| `--code-block-border-color` | 代码块边框 |
| `--pre-code-text-color` | 代码块内文字 |

### 侧边栏玻璃效果变量

| 变量名 | 说明 | 示例值 |
|-------|------|--------|
| `--sidebar-glass-start` | 玻璃渐变起始色 | `rgba(255,255,255,.65)` |
| `--sidebar-glass-end` | 玻璃渐变结束色 | `rgba(255,255,255,.35)` |
| `--sidebar-glass-tint` | 主题色调（可设为 transparent） | `rgba(59,130,246,.18)` |
| `--sidebar-border` | 侧边栏边框 | `rgba(255,255,255,.45)` |

### 交互状态变量

| 变量名 | 说明 |
|-------|------|
| `--input-focus-border-color-rgb` | 焦点色 RGB（重要！用于派生其他颜色） |
| `--icon-button-hover-bg` | 图标按钮悬停背景 |
| `--sidebar-item-hover-bg` | 侧边栏项目悬停背景 |
| `--sidebar-item-active-bg` | 侧边栏项目激活背景 |

---

## 🎯 CSS 变量与预设配置的对应关系

预设配置中的字段会生成对应的 CSS 变量：

| 预设配置字段 | 生成的 CSS 变量 |
|-------------|----------------|
| `wallpaperUrl` | `--chat-background-image` |
| `colorBackground` | `--color-background` |
| `colorBackgroundSoft` | `--color-background-soft` |
| `chatBackgroundUser` | `--chat-background-user` |
| `chatBackgroundAssistant` | `--chat-background-assistant` |
| `inputbarBackground` | `--inputbar-background-color` |
| `inputbarBorder` | `--inputbar-border-color` |
| `focusColorRgb` | `--input-focus-border-color-rgb` |
| `sidebarGlassStart` | `--sidebar-glass-start` |
| `sidebarGlassEnd` | `--sidebar-glass-end` |
| `sidebarGlassTint` | `--sidebar-glass-tint` |

---

## 国际化

在 `locales/` 目录下添加预设名称的翻译：

```json
// zh-CN.json
{
  "wallpaper.preset.gojo_satoru": "五条悟"
}

// en-US.json
{
  "wallpaper.preset.gojo_satoru": "Gojo Satoru"
}
```

---

## 调试技巧

1. **查看生成的CSS**：
```typescript
import { getAllPresetConfigs } from '@renderer/types/wallpaperPresets'
import { generatePresetCss } from '@renderer/types/wallpaperPresetCss'

const configs = getAllPresetConfigs()
const myConfig = configs.find(c => c.id === 'preset-my-theme')
console.log(generatePresetCss(myConfig))
```

2. **使用自定义CSS覆盖**：
在设置中使用自定义CSS来测试颜色调整，找到合适的值后再更新预设配置。

3. **测试双模式**：
快速切换亮色/暗色模式，检查两种模式下的视觉效果是否都符合角色风格。

---

## 注意事项

1. **壁纸来源**：使用可靠的图片托管服务，确保图片长期可用
2. **图片大小**：推荐使用高清图片（1920x1080以上），但文件大小控制在2MB以内
3. **颜色对比**：确保文字与背景有足够对比度（WCAG AA标准）
4. **效果**：避免使用过于不清晰的图片或太简单的CSS效果
5. **兼容性**：`backdrop-filter` 在部分浏览器可能不支持，预设应在不支持的情况下也能正常显示

---

# 📋 第四部分：快速参考卡

## 🚨 新手常犯的错误

### 错误 1：忘记加逗号

```typescript
// ❌ 错误 - 缺少逗号
  }   // 上一个预设
  {   // 新预设
    id: 'preset-new',
    // ...
  }

// ✅ 正确 - 记得在 } 后面加逗号
  },  // 上一个预设，加逗号！
  {   // 新预设
    id: 'preset-new',
    // ...
  }
```

### 错误 2：ID 不以 preset- 开头

```typescript
// ❌ 错误
id: 'miku',
id: 'my-theme',

// ✅ 正确
id: 'preset-miku',
id: 'preset-my-theme',
```

### 错误 3：focusColorRgb 格式错误

```typescript
// ❌ 错误 - 不要用 rgba()
focusColorRgb: 'rgba(255, 100, 150, 1)',

// ❌ 错误 - 不要用 #hex
focusColorRgb: '#FF6496',

// ✅ 正确 - 只写 R, G, B 值
focusColorRgb: '255, 100, 150',
```

### 错误 4：忘记添加翻译

```typescript
// 预设配置
name: 'wallpaper.preset.miku',

// ❌ 忘记在 zh-CN.json 添加翻译
// 结果：界面显示 "wallpaper.preset.miku" 而不是 "初音未来"

// ✅ 记得添加翻译
// zh-CN.json: "wallpaper.preset.miku": "初音未来"
```

### 错误 5：壁纸 URL 无法访问

```typescript
// ❌ 可能无法访问
wallpaperUrl: 'http://example.com/image.jpg',  // http 可能被阻止
wallpaperUrl: 'file:///C:/image.jpg',           // 本地路径无效

// ✅ 使用 https 公开链接
wallpaperUrl: 'https://example.com/image.jpg',
```

---

## 📌 快速复制模板

### 最简模板（复制后只需改 5 处）

复制以下代码，修改标记 `[改这里]` 的地方：

```typescript
  {
    id: 'preset-[改这里-英文名]',
    name: 'wallpaper.preset.[改这里-英文名]',
    thumbnail: '[改这里-壁纸URL]',
    themeMode: 'both',
    light: {
      wallpaperUrl: '[改这里-亮色壁纸URL]',
      colorBackground: 'rgba(245, 245, 245, 0.35)',
      colorBackgroundSoft: 'rgba(250, 250, 250, 0.75)',
      colorBackgroundMute: 'rgba(240, 240, 240, 0.38)',
      navbarBackground: 'var(--color-white-soft)',
      sidebarBackground: 'rgba(245, 245, 245, 0.6)',
      chatBackgroundUser: 'rgba([改这里-主题RGB], 0.75)',
      chatBackgroundAssistant: 'rgba(200, 200, 200, 0.5)',
      contentOverlayStart: 'rgba([改这里-主题RGB], 0.12)',
      contentOverlayEnd: 'rgba([改这里-主题RGB], 0.22)',
      inputbarBackground: 'rgba(250, 250, 250, 0.7)',
      inputbarBorder: 'rgba([改这里-主题RGB], 0.45)',
      codeBackground: 'rgba(235, 235, 235, 0.5)',
      codeTextColor: 'rgba(50, 50, 50, 0.85)',
      codeBlockBg: 'rgba(245, 245, 245, 0.75)',
      codeBlockBorder: 'rgba([改这里-主题RGB], 0.2)',
      textPrimary: 'rgba(30, 30, 30, 0.9)',
      textSecondary: 'rgba(80, 80, 80, 0.75)',
      focusColorRgb: '[改这里-主题RGB不带括号]',
      sidebarGlassStart: 'rgba([改这里-主题RGB], 0.5)',
      sidebarGlassEnd: 'rgba([改这里-主题RGB], 0.3)',
      sidebarGlassTint: 'rgba([改这里-主题RGB], 0.1)',
      sidebarBorder: 'rgba([改这里-主题RGB], 0.3)'
    },
    dark: {
      wallpaperUrl: '[改这里-暗色壁纸URL]',
      colorBackground: 'rgba(30, 30, 30, 0.3)',
      colorBackgroundSoft: 'rgba(40, 40, 40, 0.75)',
      colorBackgroundMute: 'rgba(35, 35, 35, 0.75)',
      navbarBackground: 'var(--color-black-soft)',
      sidebarBackground: 'rgba(30, 30, 30, 0.6)',
      chatBackgroundUser: 'rgba([改这里-深色主题RGB], 0.8)',
      chatBackgroundAssistant: 'rgba(50, 50, 50, 0.5)',
      contentOverlayStart: 'rgba([改这里-深色主题RGB], 0.2)',
      contentOverlayEnd: 'rgba([改这里-深色主题RGB], 0.3)',
      inputbarBackground: 'rgba(40, 40, 40, 0.75)',
      inputbarBorder: 'rgba([改这里-主题RGB], 0.4)',
      codeBackground: 'rgba(35, 35, 35, 0.5)',
      codeTextColor: 'rgba(200, 200, 200, 0.85)',
      codeBlockBg: 'rgba(35, 35, 35, 0.8)',
      codeBlockBorder: 'rgba([改这里-主题RGB], 0.2)',
      textPrimary: 'rgba(230, 230, 230, 0.9)',
      textSecondary: 'rgba(170, 170, 170, 0.75)',
      focusColorRgb: '[改这里-主题RGB不带括号]',
      sidebarGlassStart: 'rgba([改这里-深色主题RGB], 0.3)',
      sidebarGlassEnd: 'rgba([改这里-深色主题RGB], 0.2)',
      sidebarGlassTint: 'rgba([改这里-主题RGB], 0.08)',
      sidebarBorder: 'rgba([改这里-主题RGB], 0.25)'
    }
  }
```

---

## 🎯 透明度速查表

| 组件 | 亮色模式透明度 | 暗色模式透明度 | 说明 |
|------|--------------|--------------|------|
| colorBackground | 0.30 - 0.40 | 0.25 - 0.35 | 主背景，透出壁纸 |
| colorBackgroundSoft | 0.70 - 0.80 | 0.70 - 0.80 | 柔和背景 |
| sidebarBackground | 0.55 - 0.65 | 0.55 - 0.65 | 侧边栏 |
| chatBackgroundUser | 0.70 - 0.80 | 0.75 - 0.85 | 用户消息气泡 |
| chatBackgroundAssistant | 0.45 - 0.55 | 0.45 - 0.55 | AI消息气泡 |
| inputbarBackground | 0.65 - 0.75 | 0.70 - 0.80 | 输入栏 |
| inputbarBorder | 0.40 - 0.50 | 0.35 - 0.45 | 输入栏边框 |
| codeBackground | 0.45 - 0.55 | 0.45 - 0.55 | 行内代码 |
| codeBlockBg | 0.70 - 0.80 | 0.75 - 0.85 | 代码块 |

---

## 🌈 常用颜色 RGB 参考

| 颜色名称 | RGB 值 | 适合的角色/风格 |
|---------|--------|----------------|
| 樱花粉 | 255, 183, 197 | 治愈系、少女角色 |
| 天空蓝 | 135, 206, 235 | 清新、自由风格 |
| 初音绿 | 57, 197, 187 | 初音未来、自然系 |
| 血红色 | 180, 50, 50 | 战斗系、电锯人 |
| 紫罗兰 | 138, 43, 226 | 神秘系、魔法角色 |
| 金色 | 255, 215, 0 | 皇室、高贵风格 |
| 霓虹青 | 0, 255, 255 | 赛博朋克、科技感 |
| 薰衣草 | 230, 230, 250 | 温柔、梦幻风格 |
| 深海蓝 | 30, 60, 114 | 深邃、冷酷角色 |
| 橙色 | 255, 165, 0 | 活力、热情角色 |

---

## ✨ 检查清单（提交前确认）

- [ ] `id` 以 `preset-` 开头且唯一
- [ ] `name` 格式为 `wallpaper.preset.xxx`
- [ ] `themeMode` 设置为 `'both'`
- [ ] `thumbnail` URL 可以访问
- [ ] `light.wallpaperUrl` 和 `dark.wallpaperUrl` 都可以访问
- [ ] 在 `zh-CN.json` 添加了中文翻译
- [ ] 在 `en-US.json` 添加了英文翻译
- [ ] 上一个预设后面有逗号 `,`
- [ ] `focusColorRgb` 格式正确（只有 RGB 值，没有 rgba）
- [ ] 亮色和暗色模式都测试过
- [ ] 文字在两种模式下都清晰可读

---

## 🆘 还是不会？

1. **参考现有预设**：打开 `wallpaperPresets.ts`，复制一个现有预设，只改壁纸 URL 和颜色
2. **使用调试工具**：在设置的"自定义CSS"中先测试颜色，找到满意的值后再写入预设
3. **寻求帮助**：在项目 Issues 中提问

---

**文档版本**: 2.0
**最后更新**: 2025年
