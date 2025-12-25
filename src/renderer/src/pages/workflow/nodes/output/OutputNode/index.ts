/**
 * 输出节点定义 v2.0
 *
 * 深度优化版本，支持：
 * - 多种输出模式（预览、保存、下载）
 * - 批量文件保存
 * - 灵活的文件命名模板
 * - 图片格式转换
 * - 质量压缩选项
 * - 元数据导出
 */

import type { NodeDefinition } from '../../base/types'
import { OutputExecutor } from './executor'

export const OutputNode: NodeDefinition = {
  metadata: {
    type: 'output',
    label: '输出',
    icon: '📤',
    category: 'output',
    version: '2.0.0',
    description: '多功能输出节点，支持预览、批量保存、下载',
    tags: ['output', 'save', 'download', 'display', 'export']
  },

  inputs: [
    { id: 'image', label: '图片', dataType: 'image', description: '单张图片输入' },
    { id: 'images', label: '图片列表', dataType: 'images', description: '多张图片输入' },
    { id: 'video', label: '视频', dataType: 'video', description: '视频输入' },
    { id: 'text', label: '文本', dataType: 'text', description: '文本输入' },
    { id: 'json', label: 'JSON', dataType: 'json', description: 'JSON 数据输入' },
    { id: 'any', label: '任意数据', dataType: 'any', description: '任意类型数据' }
  ],

  // 输出节点是终端节点，不需要输出端口
  outputs: [],

  configSchema: {
    fields: [
      // === 输出模式 ===
      {
        key: 'outputType',
        label: '输出模式',
        type: 'select',
        default: 'display',
        options: [
          { label: '显示预览', value: 'display' },
          { label: '保存文件', value: 'file' },
          { label: '触发下载', value: 'download' },
          { label: '预览+保存', value: 'both' }
        ],
        description: '选择输出方式'
      },

      // === 文件保存配置 ===
      {
        key: 'outputDirectory',
        label: '输出目录',
        type: 'folder-selector',
        description: '选择文件保存目录',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      },
      {
        key: 'fileNamePattern',
        label: '文件名模板',
        type: 'text',
        default: '{name}_{date}_{index}',
        placeholder: '{name}_{date}_{index}',
        description: '支持变量: {name}, {date}, {time}, {timestamp}, {index}, {uuid}',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      },
      {
        key: 'overwriteExisting',
        label: '覆盖已存在文件',
        type: 'checkbox',
        default: false,
        description: '如果文件已存在，是否覆盖',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      },

      // === 批次管理 ===
      {
        key: 'batchFolderMode',
        label: '批次文件夹',
        type: 'checkbox',
        default: true,
        description: '为每个批次创建单独的文件夹',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      },
      {
        key: 'batchFolderPattern',
        label: '批次文件夹名',
        type: 'text',
        default: 'batch_{date}_{index}',
        placeholder: 'batch_{date}_{index}',
        description: '批次文件夹命名模板',
        showWhen: { field: 'batchFolderMode', value: true }
      },

      // === 图片格式选项 ===
      {
        key: 'imageFormat',
        label: '图片格式',
        type: 'select',
        default: 'original',
        options: [
          { label: '保持原格式', value: 'original' },
          { label: 'PNG (无损)', value: 'png' },
          { label: 'JPEG (有损)', value: 'jpeg' },
          { label: 'WebP (高效)', value: 'webp' }
        ],
        description: '输出图片的格式'
      },
      {
        key: 'imageQuality',
        label: '图片质量',
        type: 'number',
        default: 90,
        min: 10,
        max: 100,
        step: 5,
        description: 'JPEG/WebP 压缩质量 (10-100)',
        showWhen: { field: 'imageFormat', value: ['jpeg', 'webp'] }
      },
      {
        key: 'maxImageSize',
        label: '最大尺寸',
        type: 'select',
        default: 'original',
        options: [
          { label: '保持原尺寸', value: 'original' },
          { label: '1K (1024px)', value: '1024' },
          { label: '2K (2048px)', value: '2048' },
          { label: '4K (4096px)', value: '4096' }
        ],
        description: '限制输出图片的最大边长'
      },

      // === 元数据选项 ===
      {
        key: 'exportMetadata',
        label: '导出元数据',
        type: 'checkbox',
        default: false,
        description: '同时导出 JSON 元数据文件',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      },
      {
        key: 'metadataFields',
        label: '元数据字段',
        type: 'select',
        default: 'basic',
        options: [
          { label: '基础信息', value: 'basic' },
          { label: '完整信息', value: 'full' },
          { label: '自定义', value: 'custom' }
        ],
        description: '选择要导出的元数据字段',
        showWhen: { field: 'exportMetadata', value: true }
      },

      // === 提示词 TXT 导出 ===
      {
        key: 'exportPromptText',
        label: '导出提示词 TXT',
        type: 'checkbox',
        default: false,
        description: '为每张导出图片额外导出一个 JSON 提示词 TXT',
        showWhen: { field: 'outputType', value: ['file', 'both', 'download'] }
      },
      {
        key: 'promptTextSuffix',
        label: '提示词后缀',
        type: 'text',
        default: '_T',
        placeholder: '_T',
        description: '例如 _T，最终文件名：<imageBase>_T.txt',
        showWhen: { field: 'exportPromptText', value: true }
      },
      {
        key: 'promptTextExtension',
        label: '提示词扩展名',
        type: 'select',
        default: 'txt',
        options: [
          { label: 'TXT', value: 'txt' },
          { label: 'JSON', value: 'json' }
        ],
        description: '文件扩展名（内容始终为 JSON 文本）',
        showWhen: { field: 'exportPromptText', value: true }
      },
      {
        key: 'promptTextProjection',
        label: '提示词投影',
        type: 'select',
        default: 'auto',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Raw', value: 'raw' },
          { label: 'Training', value: 'training' }
        ],
        description: 'auto=仅对 model 做训练投影；training=强制训练结构；raw=原样',
        showWhen: { field: 'exportPromptText', value: true }
      },
      {
        key: 'promptTextPretty',
        label: '美化格式',
        type: 'checkbox',
        default: true,
        description: '导出 JSON 是否缩进',
        showWhen: { field: 'exportPromptText', value: true }
      },

      // === 通知选项 ===
      {
        key: 'showNotification',
        label: '显示通知',
        type: 'checkbox',
        default: true,
        description: '导出完成后显示系统通知'
      },
      {
        key: 'openFolderAfterExport',
        label: '导出后打开文件夹',
        type: 'checkbox',
        default: false,
        description: '导出完成后自动打开输出目录',
        showWhen: { field: 'outputType', value: ['file', 'both'] }
      }
    ]
  },

  defaultConfig: {
    outputType: 'display',
    outputDirectory: '',
    fileNamePattern: '{name}_{date}_{index}',
    overwriteExisting: false,
    batchFolderMode: true,
    batchFolderPattern: 'batch_{date}_{index}',
    imageFormat: 'original',
    imageQuality: 90,
    maxImageSize: 'original',
    exportMetadata: false,
    metadataFields: 'basic',
    exportPromptText: false,
    promptTextSuffix: '_T',
    promptTextExtension: 'txt',
    promptTextProjection: 'auto',
    promptTextPretty: true,
    showNotification: true,
    openFolderAfterExport: false
  },

  executor: new OutputExecutor()
}

export { OutputExecutor }
export default OutputNode
