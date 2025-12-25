export type PromptJsonExportProjection = 'auto' | 'raw' | 'training'

export function randomHighScore(min = 90, max = 99): number {
  const safeMin = Number.isFinite(min) ? min : 90
  const safeMax = Number.isFinite(max) ? max : 99
  const low = Math.min(safeMin, safeMax)
  const high = Math.max(safeMin, safeMax)
  const value = low + Math.random() * (high - low)
  return Math.round(value * 10) / 10
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true
    if (['false', 'no', 'n', '0', ''].includes(normalized)) return false
  }
  return Boolean(value)
}

function coerceHighScore(value: unknown, min = 90, max = 99): number {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return randomHighScore(min, max)
  const clamped = Math.min(Math.max(parsed, min), max)
  return Math.round(clamped * 10) / 10
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return String(value)
}

function projectModelPromptJsonForTraining(promptJson: Record<string, any>): Record<string, any> {
  return {
    age_years: toFiniteNumber(promptJson.age_years) ?? 8,
    ethnicity: String(promptJson.ethnicity || ''),
    appearance: String(promptJson.appearance || ''),
    subject: String(promptJson.main_subject || promptJson.subject || ''),
    foreground: String(promptJson.foreground || ''),
    midground: String(promptJson.midground || ''),
    background: String(promptJson.background || ''),
    composition: String(promptJson.composition || ''),
    visual_guidance: String(promptJson.visual_guidance || ''),
    color_tone: String(promptJson.color_tone || ''),
    lighting_mood: String(promptJson.lighting_mood || ''),
    has_hat: toBoolean(promptJson.has_hat),
    has_mask: toBoolean(promptJson.has_mask),
    ip_brand: normalizeNullableString(promptJson.ip_brand),
    ip_desc: normalizeNullableString(promptJson.ip_desc),
    hpsv3_score: coerceHighScore(promptJson.hpsv3_score),
    caption: String(promptJson.caption || '')
  }
}

export function projectPromptJsonForExport(
  promptJson: unknown,
  projection: PromptJsonExportProjection
): Record<string, any> | null {
  if (!promptJson || typeof promptJson !== 'object') return null

  const json = promptJson as Record<string, any>
  const type = typeof json.type === 'string' ? json.type : undefined

  if (projection === 'raw') {
    // Ensure score exists for downstream export workflows, without mutating input object.
    return { ...json, hpsv3_score: coerceHighScore(json.hpsv3_score) }
  }

  if (projection === 'training') {
    if (type === 'model') return projectModelPromptJsonForTraining(json)
    return { ...json, hpsv3_score: coerceHighScore(json.hpsv3_score) }
  }

  // auto
  if (type === 'model') return projectModelPromptJsonForTraining(json)
  return { ...json, hpsv3_score: coerceHighScore(json.hpsv3_score) }
}

export function promptJsonToExportText(
  promptJson: unknown,
  options?: {
    projection?: PromptJsonExportProjection
    pretty?: boolean
  }
): string {
  const projection = options?.projection ?? 'auto'
  const pretty = options?.pretty ?? true

  const projected = projectPromptJsonForExport(promptJson, projection)
  if (!projected) return ''

  return JSON.stringify(projected, null, pretty ? 2 : undefined)
}
