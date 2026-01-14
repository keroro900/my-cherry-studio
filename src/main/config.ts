import { isDev, isWin } from '@main/constant'

import { getDataPath } from './utils'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  if (isDev && app) {
    app.setPath('userData', app.getPath('userData') + 'Dev')
  }
} catch {
  // electron 未就绪
}

export const DATA_PATH = getDataPath()

export const titleBarOverlayDark = {
  height: 42,
  color: isWin ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0)',
  symbolColor: '#fff'
}

export const titleBarOverlayLight = {
  height: 42,
  color: 'rgba(255,255,255,0)',
  symbolColor: '#000'
}

global.CHERRYAI_CLIENT_SECRET = import.meta.env.MAIN_VITE_CHERRYAI_CLIENT_SECRET
