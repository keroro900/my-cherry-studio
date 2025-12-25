/**
 * Kling 图生视频节点配置表单 - Cherry 风格
 * 支持可灵 API 的图生视频参数配置
 * 模型版本、质量模式、视频时长等默认使用外部服务设置
 * 参考: https://app.klingai.com/cn/dev/document-api/apiReference/model/imageToVideo
 */

import { Alert } from 'antd'
import { memo } from 'react'

import { FormRow, FormSection, FormSwitch, FormTextArea } from './FormComponents'

interface KlingVideoConfigFormProps {
  config: Record<string, any>
  onUpdateConfig: (key: string, value: any) => void
}

function KlingVideoConfigForm({ config, onUpdateConfig }: KlingVideoConfigFormProps) {
  return (
    <div>
      <FormSection title="视频设置">
        {/* 视频提示词 */}
        <FormRow label="🎬 视频提示词" description="可以从上游 Vision Prompt 节点自动获取 videoPrompt 字段">
          <FormTextArea
            value={config.videoPrompt || ''}
            onChange={(value) => onUpdateConfig('videoPrompt', value)}
            placeholder="描述视频中的动作和场景...&#10;例如：小女孩在公园里欢快地奔跑，阳光洒在她的脸上"
            rows={4}
          />
        </FormRow>

        {/* 使用上游提示词 */}
        <FormRow
          label="🔗 优先使用上游提示词"
          description="如果连接了 Vision Prompt 节点，将自动使用其生成的视频提示词">
          <FormSwitch
            checked={config.useUpstreamPrompt ?? true}
            onChange={(checked) => onUpdateConfig('useUpstreamPrompt', checked)}
          />
        </FormRow>

        {/* 负面提示词 */}
        <FormRow label="🚫 负面提示词" description="描述不希望出现的元素">
          <FormTextArea
            value={config.negativePrompt || ''}
            onChange={(value) => onUpdateConfig('negativePrompt', value)}
            placeholder="blur, distort, low quality, deformed..."
            rows={2}
          />
        </FormRow>
      </FormSection>

      {/* 使用提示 */}
      <Alert
        message="💡 使用提示"
        description={
          <>
            <div>• 模型版本、质量模式、视频时长等在「设置 → 外部服务 → 可灵」中配置</div>
            <div>• 输入图片的质量会直接影响生成视频的效果</div>
            <div>• 提示词应该描述动作和场景变化，而不是静态描述</div>
          </>
        }
        type="info"
        showIcon
        style={{ marginTop: '16px' }}
      />
    </div>
  )
}

export default memo(KlingVideoConfigForm)
