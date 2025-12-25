import { VideoCameraOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

import type { CustomTagProps } from '../CustomTag'
import CustomTag from '../CustomTag'

type Props = {
  size?: number
  showTooltip?: boolean
  showLabel?: boolean
} & Omit<CustomTagProps, 'size' | 'tooltip' | 'icon' | 'color' | 'children'>

export const VideoGenerationTag = ({ size, showTooltip, showLabel, ...restProps }: Props) => {
  const { t } = useTranslation()

  return (
    <CustomTag
      size={size}
      color="#eb2f96"
      icon={<VideoCameraOutlined style={{ fontSize: size }} />}
      tooltip={showTooltip ? t('models.type.video_generation') : undefined}
      {...restProps}>
      {showLabel ? t('models.type.video_generation') : ''}
    </CustomTag>
  )
}
