import { ActionIconButton } from '@renderer/components/Buttons'
import StickerPicker from '@renderer/components/StickerPicker'
import { useTimer } from '@renderer/hooks/useTimer'
import { Popover, Tooltip } from 'antd'
import { Sticker } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface StickerData {
  id: string
  url: string
  filename: string
  packName: string
}

interface Props {
  setInputValue: (updater: string | ((prev: string) => string)) => void
  resizeTextArea: () => void
}

const StickerButton = ({ setInputValue, resizeTextArea }: Props) => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { setTimeoutTimer } = useTimer()

  const handleStickerSelect = useCallback(
    (sticker: StickerData) => {
      setTimeoutTimer(
        'handleStickerSelect',
        () => {
          // Insert sticker as markdown image
          const stickerMarkdown = `![${sticker.filename}](${sticker.url})`

          setInputValue((prev) => {
            const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null
            if (!textArea) {
              return prev + stickerMarkdown
            }

            const cursorPosition = textArea.selectionStart ?? prev.length
            const newText = prev.slice(0, cursorPosition) + stickerMarkdown + prev.slice(cursorPosition)

            // Focus and set cursor after sticker
            setTimeoutTimer(
              'handleStickerSelect_focus',
              () => {
                textArea.focus()
                const newCursorPos = cursorPosition + stickerMarkdown.length
                textArea.setSelectionRange(newCursorPos, newCursorPos)
                resizeTextArea()
              },
              10
            )

            return newText
          })
          setOpen(false)
        },
        10
      )
    },
    [setTimeoutTimer, setInputValue, resizeTextArea]
  )

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="topLeft"
      arrow={false}
      styles={{
        body: {
          padding: 0,
          borderRadius: 8,
          overflow: 'hidden'
        }
      }}
      content={<StickerPicker onStickerSelect={handleStickerSelect} />}>
      <Tooltip placement="top" title={t('chat.input.sticker', 'Sticker')} mouseLeaveDelay={0} arrow>
        <ActionIconButton aria-label={t('chat.input.sticker', 'Sticker')}>
          <Sticker size={18} />
        </ActionIconButton>
      </Tooltip>
    </Popover>
  )
}

export default memo(StickerButton)
