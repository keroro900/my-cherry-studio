import { PictureOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

import type { CustomTagProps } from '../CustomTag'
import CustomTag from '../CustomTag'

type Props = {
  size?: number
  showTooltip?: boolean
  showLabel?: boolean
} & Omit<CustomTagProps, 'size' | 'tooltip' | 'icon' | 'color' | 'children'>

export const ImageGenerationTag = ({ size, showTooltip, showLabel, ...restProps }: Props) => {
  const { t } = useTranslation()

  return (
    <CustomTag
      size={size}
      color="#722ed1"
      icon={<PictureOutlined style={{ fontSize: size }} />}
      tooltip={showTooltip ? t('models.type.image_generation') : undefined}
      {...restProps}>
      {showLabel ? t('models.type.image_generation') : ''}
    </CustomTag>
  )
}
