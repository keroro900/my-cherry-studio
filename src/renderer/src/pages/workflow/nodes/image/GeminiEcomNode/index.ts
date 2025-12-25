/**
 * Gemini 电商实拍图节点定义
 *
 * SHEIN/TEMU 风格电商主图生成：
 * - 支持 2K/4K 高清
 * - 主图、背面图、细节图
 * - 填充/平铺模式
 *
 * 使用 GeminiGenerateExecutor 执行，通过 nodeType 区分模式
 */

import type { NodeDefinition } from '../../base/types'
import { GeminiGenerateExecutor } from '../GeminiGenerateNode/executor'

export const GeminiEcomNode: NodeDefinition = {
  metadata: {
    type: 'gemini_ecom',
    label: '电商实拍图',
    icon: '🛍️',
    category: 'image',
    version: '1.0.0',
    description: 'SHEIN/TEMU 风格电商主图生成，支持 2K/4K 高清',
    tags: ['image', 'ecom', 'product', 'gemini', 'fashion']
  },

  inputs: [
    { id: 'prompt', label: '提示词', dataType: 'text', description: '电商图生成提示词（可替代配置中的提示词）' },
    { id: 'promptJson', label: '提示词JSON', dataType: 'json', description: '从智能提示词节点传入的 JSON' }
    // 图片输入端口通过 imageInputPorts 动态配置
    // 默认端口由 EcomConfigForm 的 buildImageInputPorts 函数生成
  ],

  outputs: [
    { id: 'mainImage', label: '主图', dataType: 'image', description: '生成的电商主图' },
    { id: 'backImage', label: '背面图', dataType: 'image', description: '生成的背面图' },
    { id: 'detailImages', label: '细节图', dataType: 'images', description: '生成的细节图' },
    { id: 'image', label: '图片', dataType: 'image', description: '主输出图片' },
    { id: 'images', label: '全部图片', dataType: 'images', description: '所有生成的图片' }
  ],

  configSchema: {
    fields: [
      // === 模型选择 ===
      {
        key: 'providerId',
        label: 'Provider',
        type: 'model-selector',
        modelFilter: 'image-generation',
        description: '选择 Gemini 图片生成服务'
      },

      // === 图片尺寸 ===
      {
        key: 'imageSize',
        label: '图片尺寸',
        type: 'select',
        default: '2K',
        options: [
          { label: '1K (1024px)', value: '1K' },
          { label: '2K (2048px)', value: '2K' },
          { label: '4K (4096px)', value: '4K' }
        ],
        description: '生成图片的分辨率'
      },
      {
        key: 'aspectRatio',
        label: '宽高比',
        type: 'select',
        default: '3:4',
        options: [
          { label: '3:4 电商标准', value: '3:4' },
          { label: '1:1 正方形', value: '1:1' },
          { label: '4:3 横向', value: '4:3' },
          { label: '9:16 竖屏', value: '9:16' },
          { label: '16:9 宽屏', value: '16:9' }
        ],
        description: '生成图片的宽高比'
      },

      // === 布局模式 ===
      {
        key: 'layout',
        label: '布局模式',
        type: 'select',
        default: 'flat_lay',
        options: [
          { label: '平铺展示', value: 'flat_lay' },
          { label: '模特穿搭', value: 'model_shot' },
          { label: '悬挂展示', value: 'hanging' }
        ],
        description: '服装展示方式'
      },

      // === 填充模式 ===
      {
        key: 'fillMode',
        label: '填充模式',
        type: 'select',
        default: 'filled',
        options: [
          { label: '立体填充 (推荐)', value: 'filled' },
          { label: '平面展示', value: 'flat' }
        ],
        description: '服装填充效果'
      },

      // === 风格预设 ===
      {
        key: 'stylePreset',
        label: '风格预设',
        type: 'select',
        default: 'auto',
        options: [
          { label: '自动匹配', value: 'auto' },
          { label: 'SHEIN 风格', value: 'shein' },
          { label: 'TEMU 风格', value: 'temu' },
          { label: '简约清新', value: 'minimal' },
          { label: '高端质感', value: 'premium' }
        ],
        description: '电商平台风格'
      },

      // === 输出选项 ===
      {
        key: 'enableBack',
        label: '生成背面图',
        type: 'checkbox',
        default: false,
        description: '是否生成背面展示图'
      },
      {
        key: 'enableDetail',
        label: '生成细节图',
        type: 'checkbox',
        default: false,
        description: '是否生成细节展示图'
      },
      {
        key: 'detailTypes',
        label: '细节类型',
        type: 'select',
        multiple: true,
        default: ['collar', 'print', 'fabric'],
        options: [
          { label: '领口', value: 'collar' },
          { label: '印花', value: 'print' },
          { label: '面料', value: 'fabric' },
          { label: '袖口', value: 'sleeve' },
          { label: '口袋', value: 'pocket' },
          { label: '纽扣', value: 'button' }
        ],
        description: '需要展示的细节部位',
        showWhen: { field: 'enableDetail', value: true }
      },

      // === 提示词配置 ===
      {
        key: 'garmentDescription',
        label: '服装描述',
        type: 'textarea',
        placeholder: '描述服装特点...\n例如：白色棉质T恤，圆领设计，胸前有可爱的卡通图案',
        description: '补充服装的详细描述'
      },
      {
        key: 'styleConstraint',
        label: '风格约束',
        type: 'textarea',
        placeholder: '额外的风格要求...',
        description: '对生成风格的额外约束'
      },
      {
        key: 'extraNote',
        label: '额外备注',
        type: 'textarea',
        placeholder: '其他注意事项...',
        description: '其他需要注意的内容'
      },

      // === 高级选项 ===
      {
        key: 'useSystemPrompt',
        label: '使用系统提示词',
        type: 'checkbox',
        default: true,
        description: '启用专业电商图片生成提示词'
      },
      {
        key: 'professionalRetouch',
        label: '专业修图',
        type: 'checkbox',
        default: true,
        description: '启用专业级图片后处理'
      },
      {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        default: 2,
        min: 0,
        max: 5,
        description: '生成失败时自动重试'
      },
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 180,
        min: 60,
        max: 300,
        description: '单次生成的最大等待时间（秒）'
      }
    ]
  },

  defaultConfig: {
    nodeType: 'gemini_ecom', // 标识节点类型，用于执行器判断
    imageSize: '2K',
    aspectRatio: '3:4',
    layout: 'flat_lay',
    fillMode: 'filled',
    stylePreset: 'auto',
    styleConstraint: '',
    enableBack: false,
    enableDetail: false,
    detailTypes: ['collar', 'print', 'fabric'],
    garmentDescription: '',
    extraNote: '',
    useSystemPrompt: true,
    professionalRetouch: true,
    retryCount: 2,
    timeout: 180,
    // 使用统一的 image_N 命名规范
    // image_1: 上装图片, image_2: 下装图片, image_3: 额外参考图
    // enableBack 为 true 时会动态添加 image_4 (上装背面), image_5 (下装背面)
    imageInputPorts: [
      { id: 'image_1', label: '上装图片', dataType: 'image', required: true, description: '上装服装图片 (T恤/上衣)' },
      { id: 'image_2', label: '下装图片', dataType: 'image', required: false, description: '下装服装图片 (裤子/裙子)' },
      { id: 'image_3', label: '额外参考图', dataType: 'image', required: false, description: '印花/吊牌近景，可选' }
    ]
  },

  executor: new GeminiGenerateExecutor()
}

export { GeminiGenerateExecutor as GeminiEcomExecutor }
export default GeminiEcomNode
