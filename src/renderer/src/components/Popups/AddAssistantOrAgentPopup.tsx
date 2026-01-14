import { TopView } from '@renderer/components/TopView'
import { cn } from '@renderer/utils'
import { Modal } from 'antd'
import { Bot, ImageIcon, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type OptionType = 'assistant' | 'agent' | 'image'

interface ShowParams {
  onSelect: (type: OptionType) => void
}

interface Props extends ShowParams {
  resolve: (data: { type?: OptionType }) => void
}

const PopupContainer: React.FC<Props> = ({ onSelect, resolve }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [hoveredOption, setHoveredOption] = useState<OptionType | null>(null)

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve({})
  }

  const handleSelect = (type: OptionType) => {
    setOpen(false)
    onSelect(type)
    resolve({ type })
  }

  AddAssistantOrAgentPopup.hide = onCancel

  return (
    <Modal
      title={t('chat.add.option.title')}
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered
      footer={null}
      width={700}>
      <div className="grid grid-cols-3 gap-4 py-4">
        {/* Assistant Option */}
        <button
          type="button"
          onClick={() => handleSelect('assistant')}
          className="group flex cursor-pointer flex-col items-center gap-3 rounded-lg bg-[var(--color-background-soft)] p-5 transition-all hover:bg-[var(--color-hover)]"
          onMouseEnter={() => setHoveredOption('assistant')}
          onMouseLeave={() => setHoveredOption(null)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-list-item)] transition-colors">
            <MessageSquare
              size={22}
              className={cn(
                'transition-colors',
                hoveredOption === 'assistant' ? 'text-[var(--color-primary)]' : 'text-[var(--color-icon-white)]'
              )}
            />
          </div>
          <div className="text-center">
            <h3 className="mb-1 font-semibold text-[var(--color-text-1)] text-sm">{t('chat.add.assistant.title')}</h3>
            <p className="text-[var(--color-text-2)] text-xs">{t('chat.add.assistant.description')}</p>
          </div>
        </button>

        {/* Image Assistant Option */}
        <button
          type="button"
          onClick={() => handleSelect('image')}
          className="group flex cursor-pointer flex-col items-center gap-3 rounded-lg bg-[var(--color-background-soft)] p-5 transition-all hover:bg-[var(--color-hover)]"
          onMouseEnter={() => setHoveredOption('image')}
          onMouseLeave={() => setHoveredOption(null)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-list-item)] transition-colors">
            <ImageIcon
              size={22}
              className={cn(
                'transition-colors',
                hoveredOption === 'image' ? 'text-[#10B981]' : 'text-[var(--color-icon-white)]'
              )}
            />
          </div>
          <div className="text-center">
            <h3 className="mb-1 font-semibold text-[var(--color-text-1)] text-sm">
              {t('chat.add.image_assistant.title', '图片助手')}
            </h3>
            <p className="text-[var(--color-text-2)] text-xs">
              {t('chat.add.image_assistant.description', '生成电商、模特、图案等图片')}
            </p>
          </div>
        </button>

        {/* Agent Option */}
        <button
          onClick={() => handleSelect('agent')}
          type="button"
          className="group flex cursor-pointer flex-col items-center gap-3 rounded-lg bg-[var(--color-background-soft)] p-5 transition-all hover:bg-[var(--color-hover)]"
          onMouseEnter={() => setHoveredOption('agent')}
          onMouseLeave={() => setHoveredOption(null)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-list-item)] transition-colors">
            <Bot
              size={22}
              className={cn(
                'transition-colors',
                hoveredOption === 'agent' ? 'text-[var(--color-primary)]' : 'text-[var(--color-icon-white)]'
              )}
            />
          </div>
          <div className="text-center">
            <h3 className="mb-1 font-semibold text-[var(--color-text-1)] text-sm">{t('agent.add.title')}</h3>
            <p className="text-[var(--color-text-2)] text-xs">{t('agent.add.description')}</p>
          </div>
        </button>
      </div>
    </Modal>
  )
}

const TopViewKey = 'AddAssistantOrAgentPopup'

export default class AddAssistantOrAgentPopup {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show(props: ShowParams) {
    return new Promise<{ type?: OptionType }>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
