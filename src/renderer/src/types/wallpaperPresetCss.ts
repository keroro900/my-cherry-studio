/**
 * 壁纸预设CSS生成器
 * Wallpaper Preset CSS Generator
 *
 * 每个壁纸预设包含完整的CSS样式，参考 Cherry Studio 原生自定义CSS功能
 */

/**
 * 壁纸预设配置
 */
export interface WallpaperPresetConfig {
  id: string
  name: string // i18n key
  thumbnail: string
  themeMode?: 'light' | 'dark' | 'both'
  // Light theme config
  light?: {
    wallpaperUrl?: string
    wallpaperGradient?: string
    // Colors
    colorBackground: string
    colorBackgroundSoft: string
    colorBackgroundMute: string
    navbarBackground: string
    sidebarBackground: string
    chatBackgroundUser: string
    chatBackgroundAssistant: string
    // Overlay
    contentOverlayStart: string
    contentOverlayEnd: string
    // Input bar
    inputbarBackground: string
    inputbarBorder: string
    // Code
    codeBackground: string
    codeTextColor: string
    codeBlockBg: string
    codeBlockBorder: string
    // Text
    textPrimary: string
    textSecondary: string
    // Focus color (RGB format for alpha variations)
    focusColorRgb: string // e.g., "60, 130, 220"
    // Sidebar glass
    sidebarGlassStart: string
    sidebarGlassEnd: string
    sidebarGlassTint: string
    sidebarBorder: string
  }
  // Dark theme config
  dark?: {
    wallpaperUrl?: string
    wallpaperGradient?: string
    // Colors
    colorBackground: string
    colorBackgroundSoft: string
    colorBackgroundMute: string
    navbarBackground: string
    sidebarBackground: string
    chatBackgroundUser: string
    chatBackgroundAssistant: string
    // Overlay
    contentOverlayStart: string
    contentOverlayEnd: string
    // Input bar
    inputbarBackground: string
    inputbarBorder: string
    // Code
    codeBackground: string
    codeTextColor: string
    codeBlockBg: string
    codeBlockBorder: string
    // Text
    textPrimary: string
    textSecondary: string
    // Focus color (RGB format)
    focusColorRgb: string
    // Sidebar glass
    sidebarGlassStart: string
    sidebarGlassEnd: string
    sidebarGlassTint: string
    sidebarBorder: string
  }
}

/**
 * 生成壁纸预设CSS
 */
export function generatePresetCss(config: WallpaperPresetConfig): string {
  const css: string[] = []

  // 通用变量
  css.push(`/* Wallpaper Preset: ${config.id} */`)
  css.push(`:root {
  --color-black-soft: rgba(115, 114, 114, 0.5);
  --color-white-soft: rgba(248, 247, 242, 0.5);
  --common-border-radius: 8px;
  --transition-duration: 0.5s;
  --transition-easing: ease-in-out;
  --content-bgcolor-soft: var(--sidebar-item-hover-bg, rgba(255,255,255,.06));
  --content-bgcolor-hard: var(--sidebar-item-active-bg, rgba(255,255,255,.12));
  --box-shadow: 0 6px 18px rgba(0,0,0,.08);
}`)

  // Body背景
  css.push(`
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
}`)

  // 亮色主题
  if (config.light) {
    const l = config.light
    const wallpaperCss = l.wallpaperUrl
      ? `url('${l.wallpaperUrl}')`
      : l.wallpaperGradient || 'none'

    css.push(`
/* Light Theme */
body[theme-mode="light"] {
  --color-background: ${l.colorBackground};
  --color-background-soft: ${l.colorBackgroundSoft};
  --color-background-mute: ${l.colorBackgroundMute};
  --navbar-background: ${l.navbarBackground};
  --sidebar-background: ${l.sidebarBackground};
  --chat-background: var(--color-white-soft);
  --chat-background-user: ${l.chatBackgroundUser};
  --chat-background-assistant: ${l.chatBackgroundAssistant};

  --chat-background-image: ${wallpaperCss};
  --content-overlay-color-start: ${l.contentOverlayStart};
  --content-overlay-color-end: ${l.contentOverlayEnd};

  --inputbar-background-color: ${l.inputbarBackground};
  --inputbar-border-color: ${l.inputbarBorder};
  --code-background-color: ${l.codeBackground};
  --code-text-color: ${l.codeTextColor};
  --pre-code-text-color: rgba(30, 30, 30, 0.9);
  --code-block-bg: ${l.codeBlockBg};
  --code-block-border-color: ${l.codeBlockBorder};

  --text-color-primary: ${l.textPrimary};
  --text-color-secondary: ${l.textSecondary};
  --sidebar-text-color: var(--text-color-secondary);
  --sidebar-icon-color: var(--text-color-secondary);
  --input-focus-border-color-rgb: ${l.focusColorRgb};
  --input-focus-border-color: rgba(var(--input-focus-border-color-rgb), 0.9);
  --input-focus-shadow: 0 0 0 3px rgba(var(--input-focus-border-color-rgb), 0.15);
  --icon-button-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.1);
  --sidebar-item-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.08);
  --sidebar-item-active-bg: rgba(var(--input-focus-border-color-rgb), 0.15);
  --sidebar-item-active-text-color: var(--input-focus-border-color);
  --sidebar-item-active-border-color: var(--input-focus-border-color);
  --chat-bubble-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04);
  --chat-bubble-accent-line-color: rgba(var(--input-focus-border-color-rgb), 0.5);

  --sidebar-glass-start: ${l.sidebarGlassStart};
  --sidebar-glass-end: ${l.sidebarGlassEnd};
  --sidebar-glass-tint: ${l.sidebarGlassTint};
  --sidebar-border: ${l.sidebarBorder};
}`)
  }

  // 暗色主题
  if (config.dark) {
    const d = config.dark
    const wallpaperCss = d.wallpaperUrl
      ? `url('${d.wallpaperUrl}')`
      : d.wallpaperGradient || 'none'

    css.push(`
/* Dark Theme */
body[theme-mode="dark"] {
  --color-background: ${d.colorBackground};
  --color-background-soft: ${d.colorBackgroundSoft};
  --color-background-mute: ${d.colorBackgroundMute};
  --navbar-background: ${d.navbarBackground};
  --sidebar-background: ${d.sidebarBackground};
  --chat-background: var(--color-black-soft);
  --chat-background-user: ${d.chatBackgroundUser};
  --chat-background-assistant: ${d.chatBackgroundAssistant};

  --chat-background-image: ${wallpaperCss};
  --content-overlay-color-start: ${d.contentOverlayStart};
  --content-overlay-color-end: ${d.contentOverlayEnd};

  --inputbar-background-color: ${d.inputbarBackground};
  --inputbar-border-color: ${d.inputbarBorder};
  --code-background-color: ${d.codeBackground};
  --code-text-color: ${d.codeTextColor};
  --pre-code-text-color: rgba(200, 205, 210, 0.9);
  --code-block-bg: ${d.codeBlockBg};
  --code-block-border-color: ${d.codeBlockBorder};

  --text-color-primary: ${d.textPrimary};
  --text-color-secondary: ${d.textSecondary};
  --sidebar-text-color: var(--text-color-secondary);
  --sidebar-icon-color: var(--text-color-secondary);
  --input-focus-border-color-rgb: ${d.focusColorRgb};
  --input-focus-border-color: rgba(var(--input-focus-border-color-rgb), 0.9);
  --input-focus-shadow: 0 0 0 3px rgba(var(--input-focus-border-color-rgb), 0.2);
  --icon-button-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.12);
  --sidebar-item-hover-bg: rgba(var(--input-focus-border-color-rgb), 0.1);
  --sidebar-item-active-bg: rgba(var(--input-focus-border-color-rgb), 0.2);
  --sidebar-item-active-text-color: var(--input-focus-border-color);
  --sidebar-item-active-border-color: var(--input-focus-border-color);
  --chat-bubble-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0, 0, 0, 0.18);
  --chat-bubble-accent-line-color: rgba(var(--input-focus-border-color-rgb), 0.5);

  --sidebar-glass-start: ${d.sidebarGlassStart};
  --sidebar-glass-end: ${d.sidebarGlassEnd};
  --sidebar-glass-tint: ${d.sidebarGlassTint};
  --sidebar-border: ${d.sidebarBorder};
}`)
  }

  // 共享组件样式
  css.push(`
/* Shared Component Styles */
body {
  color: var(--text-color-primary);
  background-color: var(--color-background);
  transition: background-color var(--transition-duration) var(--transition-easing), color var(--transition-duration) var(--transition-easing);
}

#app-sidebar {
  position: relative;
  background: transparent !important;
  overflow: hidden;
  isolation: isolate;
}

#app-sidebar::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, var(--sidebar-glass-start) 0%, var(--sidebar-glass-end) 100%),
    radial-gradient(120% 100% at 50% 0%, var(--sidebar-glass-tint) 0%, transparent 70%);
  backdrop-filter: blur(5px) saturate(1.2);
  -webkit-backdrop-filter: blur(5px) saturate(1.2);
}

#app-sidebar > * {
  position: relative;
  z-index: 1;
}

#app-sidebar .item:hover,
#app-sidebar div[class^="Icon"]:hover {
  background-color: var(--content-bgcolor-soft);
  box-shadow: var(--box-shadow);
  border-radius: 12px;
}

#app-sidebar .active,
#app-sidebar div[class^="Icon"].active {
  background-color: var(--content-bgcolor-hard);
  box-shadow: var(--box-shadow);
  border-radius: 12px;
  outline: 1px solid var(--sidebar-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  #app-sidebar::before {
    background: linear-gradient(180deg, var(--sidebar-glass-start), var(--sidebar-glass-end));
  }
}

#content-container {
  background-image: linear-gradient(var(--content-overlay-color-start), var(--content-overlay-color-end)), var(--chat-background-image);
  background-repeat: no-repeat;
  background-position: center 30%;
  background-size: cover;
}

#content-container #messages {
  background-color: transparent;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Input Bar */
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

.inputbar-container:focus-within {
  border-color: var(--input-focus-border-color);
  box-shadow: var(--input-focus-shadow);
}

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
  height: auto;
  min-height: 24px;
}

.inputbar-container textarea::placeholder {
  color: var(--text-color-secondary);
  opacity: 1;
}

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

.inputbar-container .icon-button:active {
  background-color: rgba(var(--input-focus-border-color-rgb), 0.15);
}

/* Code Blocks */
code {
  background-color: var(--code-background-color);
  color: var(--code-text-color);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  transition: background-color var(--transition-duration) var(--transition-easing),
    color var(--transition-duration) var(--transition-easing);
}

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

/* Chat Message Bubbles */
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

.chat-message-bubble.user {
  background-color: var(--chat-background-user);
  align-self: flex-end;
}

.chat-message-bubble.assistant {
  background-color: var(--chat-background-assistant);
  align-self: flex-start;
}

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
}`)

  return css.join('\n')
}

/**
 * 新版壁纸预设（包含完整CSS）
 */
export interface WallpaperPresetV2 {
  id: string
  name: string // i18n key
  thumbnail: string
  themeMode?: 'light' | 'dark' | 'both'
  /** 预设CSS - 完整的样式表 */
  presetCss: string
}
