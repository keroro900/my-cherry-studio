/**
 * 工作流配置表单公共工具函数
 *
 * 统一管理各配置表单中重复使用的工具函数
 */

/**
 * 将预设数组转换为表单选项格式
 * @param opts 预设数组，包含 id 和 name 属性
 * @returns 表单选项数组
 */
export function toFormOptions<T extends { id: string; name: string; description?: string }>(
  opts: T[]
): Array<{ label: string; value: string; description?: string }> {
  return opts.map((o) => ({
    label: o.name,
    value: o.id,
    description: o.description
  }))
}

/**
 * 将对象格式的预设转换为表单选项格式
 * @param presets 预设对象，key 为 id，value 包含 name 和可选 description
 * @returns 表单选项数组
 */
export function presetsToFormOptions<T extends { name: string; description?: string }>(
  presets: Record<string, T>
): Array<{ label: string; value: string; description?: string }> {
  return Object.entries(presets).map(([id, preset]) => ({
    label: preset.name,
    value: id,
    description: preset.description
  }))
}

/**
 * 生成图片输入端口配置
 * @param count 端口数量
 * @param prefix 端口 ID 前缀，默认 'image'
 * @param labelTemplate 标签模板函数，默认 "图片 {n}"
 * @returns 端口配置数组
 */
export function generateImageInputPorts(
  count: number,
  prefix = 'image',
  labelTemplate?: (index: number) => string
): Array<{
  id: string
  label: string
  dataType: 'image'
  required: boolean
  description: string
}> {
  const ports: Array<{
    id: string
    label: string
    dataType: 'image'
    required: boolean
    description: string
  }> = []
  for (let i = 1; i <= count; i++) {
    const defaultLabel = i === 1 ? `图片 ${i} (主图)` : `图片 ${i}`
    ports.push({
      id: `${prefix}_${i}`,
      label: labelTemplate ? labelTemplate(i) : defaultLabel,
      dataType: 'image' as const,
      required: i === 1,
      description: i === 1 ? '主要参考图片' : `可选参考图片 ${i}`
    })
  }
  return ports
}

/**
 * 从配置中安全获取值，支持默认值
 * @param config 配置对象
 * @param key 键名
 * @param defaultValue 默认值
 */
export function getConfigValue<T>(config: Record<string, any>, key: string, defaultValue: T): T {
  const value = config[key]
  return value !== undefined ? value : defaultValue
}

/**
 * 批量更新配置
 * 支持单个 key-value 或对象形式的批量更新
 */
export function createConfigUpdater(onUpdateConfig: (keyOrUpdates: string | Record<string, any>, value?: any) => void) {
  return {
    update: (key: string, value: any) => onUpdateConfig(key, value),
    batchUpdate: (updates: Record<string, any>) => onUpdateConfig(updates),
    updateMultiple: (...pairs: [string, any][]) => {
      const updates = Object.fromEntries(pairs)
      onUpdateConfig(updates)
    }
  }
}

/**
 * 验证端口 ID 是否合法
 */
export function isValidPortId(id: string): boolean {
  return /^[a-z][a-z0-9_]*$/i.test(id)
}

/**
 * 生成唯一的端口 ID
 */
export function generateUniquePortId(prefix: string, existingIds: string[]): string {
  let index = 1
  let id = `${prefix}_${index}`
  while (existingIds.includes(id)) {
    index++
    id = `${prefix}_${index}`
  }
  return id
}
