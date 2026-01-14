import { loggerService } from '@logger'
import { defaultLanguage } from '@shared/config/constant'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Original translation
import enUS from './locales/en-us.json'
import zhCN from './locales/zh-cn.json'
import zhTW from './locales/zh-tw.json'
// Machine translation
import deDE from './translate/de-de.json'
import elGR from './translate/el-gr.json'
import esES from './translate/es-es.json'
import frFR from './translate/fr-fr.json'
import jaJP from './translate/ja-jp.json'
import ptPT from './translate/pt-pt.json'
import roRO from './translate/ro-ro.json'
import ruRU from './translate/ru-ru.json'

const logger = loggerService.withContext('I18N')

const deepMerge = <T extends Record<string, unknown>>(base: T, override: T): T => {
  const result: Record<string, unknown> = { ...base }
  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key]
    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === 'object' &&
      typeof overrideValue === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, overrideValue as Record<string, unknown>)
    } else {
      result[key] = overrideValue
    }
  }
  return result as T
}

const resources = Object.fromEntries(
  [
    ['en-US', enUS],
    ['zh-CN', zhCN],
    ['zh-TW', deepMerge(zhCN, zhTW)],
    ['de-DE', deepMerge(enUS, deDE)],
    ['el-GR', deepMerge(enUS, elGR)],
    ['es-ES', deepMerge(enUS, esES)],
    ['fr-FR', deepMerge(enUS, frFR)],
    ['ja-JP', deepMerge(enUS, jaJP)],
    ['pt-PT', deepMerge(enUS, ptPT)],
    ['ro-RO', deepMerge(enUS, roRO)],
    ['ru-RU', deepMerge(enUS, ruRU)]
  ].map(([locale, translation]) => [locale, { translation }])
)

export const getLanguage = () => {
  return localStorage.getItem('language') || navigator.language || defaultLanguage
}

export const getLanguageCode = () => {
  return getLanguage().split('-')[0]
}

i18n.use(initReactI18next).init({
  resources,
  lng: getLanguage(),
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false
  },
  saveMissing: true,
  missingKeyHandler: (_1, _2, key) => {
    logger.error(`Missing key: ${key}`)
  }
})

export default i18n
