/**
 * 输出节点配置表单 - Cherry 风格
 * 支持 output 节点的配置
 * 增强功能：批次分文件夹导出
 */

import { FolderOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Button, message, Switch } from 'antd'
import { memo, useCallback } from 'react'

import { FormCard, FormInput, FormRadioGroup, FormRow, FormSection, FormSelect } from './FormComponents'

const logger = loggerService.withContext('OutputConfigForm')

interface OutputConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
}

/**
 * 输出类型选项
 */
const OUTPUT_TYPE_OPTIONS = [
  {
    label: '显示预览',
    value: 'display',
    description: '在界面上预览输出结果'
  },
  {
    label: '保存文件',
    value: 'file',
    description: '将结果保存到指定目录'
  },
  {
    label: '下载',
    value: 'download',
    description: '触发浏览器下载'
  }
]

const PREVIEW_MODE_OPTIONS = [
  {
    label: '单图预览',
    value: 'single',
    description: '当接收多张图像时，仅预览第一张'
  },
  {
    label: '多图预览',
    value: 'multi',
    description: '预览前几张图像并显示数量摘要'
  },
  {
    label: '列表摘要',
    value: 'list',
    description: '仅显示数量与文件名摘要，适合大批量'
  }
]

function OutputConfigForm({ config, onUpdateConfig }: OutputConfigFormProps) {
  const outputType = config.outputType || 'display'
  const batchFolderMode = config.batchFolderMode ?? true // 默认开启批次分文件夹
  const batchFolderPattern = config.batchFolderPattern || 'batch_{index}'
  const previewMode = config.previewMode || 'multi'

  // 选择输出目录
  const handleSelectDirectory = useCallback(async () => {
    try {
      const folderPath = await window.api?.file?.selectFolder?.()
      if (folderPath) {
        onUpdateConfig('outputDirectory', folderPath)
        message.success('已选择输出目录')
      }
    } catch (error) {
      logger.error('选择文件夹失败', { error })
    }
  }, [onUpdateConfig])

  return (
    <div>
      <FormSection title="📤 输出设置">
        {/* 输出类型 */}
        <FormRow label="输出方式" description="选择结果的输出方式">
          <FormRadioGroup
            value={outputType}
            onChange={(value) => onUpdateConfig('outputType', value)}
            options={OUTPUT_TYPE_OPTIONS}
          />
        </FormRow>

        {/* 预览模式 */}
        {outputType === 'display' && (
          <FormRow label="预览模式" description="多图输入下的预览表现">
            <FormRadioGroup
              value={previewMode}
              onChange={(value) => onUpdateConfig('previewMode', value)}
              options={PREVIEW_MODE_OPTIONS}
            />
          </FormRow>
        )}

        {/* 文件保存设置 */}
        {(outputType === 'file' || outputType === 'both') && (
          <>
            <FormRow label="保存目录" description="文件保存的目标目录">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FormInput
                    value={config.outputDirectory || ''}
                    onChange={(value) => onUpdateConfig('outputDirectory', value)}
                    placeholder="点击右侧按钮选择目录"
                  />
                </div>
                <Button icon={<FolderOutlined />} onClick={handleSelectDirectory}>
                  选择
                </Button>
              </div>
            </FormRow>

            <FormRow label="文件名模式" description="支持变量: {date}, {time}, {index}, {type}">
              <FormInput
                value={config.fileNamePattern || ''}
                onChange={(value) => onUpdateConfig('fileNamePattern', value)}
                placeholder="例如：output_{date}_{index}"
              />
            </FormRow>

            {/* 批次分文件夹设置 */}
            <FormCard title="📁 批次分文件夹">
              <FormRow label="启用批次分文件夹" description="每个批次的输出保存到单独文件夹">
                <Switch checked={batchFolderMode} onChange={(checked) => onUpdateConfig('batchFolderMode', checked)} />
              </FormRow>

              {batchFolderMode && (
                <>
                  <FormRow label="文件夹名称模式" description="支持变量: {index}, {date}, {time}">
                    <FormInput
                      value={batchFolderPattern}
                      onChange={(value) => onUpdateConfig('batchFolderPattern', value)}
                      placeholder="例如：batch_{index}"
                    />
                  </FormRow>

                  <div style={{ fontSize: '11px', color: 'var(--color-text-3)', padding: '8px 0' }}>
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>示例输出结构：</div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        background: 'var(--color-background-soft)',
                        padding: 8,
                        borderRadius: 4
                      }}>
                      <div>📁 {config.outputDirectory || './output'}/</div>
                      <div style={{ paddingLeft: 16 }}>├── 📁 batch_1/</div>
                      <div style={{ paddingLeft: 32 }}>│ ├── image_1.png</div>
                      <div style={{ paddingLeft: 32 }}>│ └── image_2.png</div>
                      <div style={{ paddingLeft: 16 }}>├── 📁 batch_2/</div>
                      <div style={{ paddingLeft: 32 }}>│ ├── image_1.png</div>
                      <div style={{ paddingLeft: 32 }}>│ └── image_2.png</div>
                      <div style={{ paddingLeft: 16 }}>└── ...</div>
                    </div>
                  </div>
                </>
              )}
            </FormCard>

            <FormCard title="📝 提示词导出">
              <FormRow label="导出提示词 TXT" description="为每张导出图片额外导出一个 JSON 提示词 TXT，不对应则跳过">
                <Switch
                  checked={config.exportPromptText ?? false}
                  onChange={(checked) => onUpdateConfig('exportPromptText', checked)}
                />
              </FormRow>

              {config.exportPromptText && (
                <>
                  <FormRow label="提示词后缀" description="例如：_T，最终文件名：<imageBase>_T.txt">
                    <FormInput
                      value={config.promptTextSuffix || '_T'}
                      onChange={(value) => onUpdateConfig('promptTextSuffix', value)}
                      placeholder="_T"
                    />
                  </FormRow>

                  <FormRow label="扩展名" description="文件扩展名（内容始终为 JSON 文本）">
                    <FormSelect
                      value={config.promptTextExtension || 'txt'}
                      onChange={(value) => onUpdateConfig('promptTextExtension', value)}
                      options={[
                        { label: 'txt', value: 'txt' },
                        { label: 'json', value: 'json' }
                      ]}
                    />
                  </FormRow>

                  <FormRow label="投影" description="auto=仅对 model 做训练结构；training=固定训练结构；raw=原样">
                    <FormSelect
                      value={config.promptTextProjection || 'auto'}
                      onChange={(value) => onUpdateConfig('promptTextProjection', value)}
                      options={[
                        { label: 'auto', value: 'auto' },
                        { label: 'training', value: 'training' },
                        { label: 'raw', value: 'raw' }
                      ]}
                    />
                  </FormRow>

                  <FormRow label="美化格式" description="导出 JSON 是否缩进">
                    <Switch
                      checked={config.promptTextPretty ?? true}
                      onChange={(checked) => onUpdateConfig('promptTextPretty', checked)}
                    />
                  </FormRow>
                </>
              )}
            </FormCard>
          </>
        )}
      </FormSection>

      {/* 输入说明 */}
      <FormCard title="支持的输入类型">
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
          <div>
            • <strong>图片</strong>: 支持预览和保存 (PNG/JPG/WebP)
          </div>
          <div>
            • <strong>视频</strong>: 支持预览和保存 (MP4/WebM)
          </div>
          <div>
            • <strong>文本</strong>: 支持预览和保存 (TXT/JSON)
          </div>
          <div>
            • <strong>任意数据</strong>: JSON 格式显示
          </div>
          <div style={{ marginTop: 8, color: 'var(--ant-color-text-tertiary)' }}>
            提示：当上游节点输出为多张图片数组时，预览模式将决定界面展示方式，不影响文件保存或下载行为。
          </div>
        </div>
      </FormCard>
    </div>
  )
}

export default memo(OutputConfigForm)
