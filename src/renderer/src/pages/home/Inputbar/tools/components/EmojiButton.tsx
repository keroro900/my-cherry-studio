import { ActionIconButton } from '@renderer/components/Buttons'
import EmojiPicker from '@renderer/components/EmojiPicker'
import { useTimer } from '@renderer/hooks/useTimer'
import { Popover, Tooltip } from 'antd'
import { SmilePlus } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  setInputValue: (updater: string | ((prev: string) => string)) => void
  resizeTextArea: () => void
}

const EmojiButton = ({ setInputValue, resizeTextArea }: Props) => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { setTimeoutTimer } = useTimer()

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setTimeoutTimer(
        'handleEmojiSelect',
        () => {
          setInputValue((prev) => {
            const textArea = document.querySelector('.inputbar textarea') as HTMLTextAreaElement | null
            if (!textArea) {
              return prev + emoji
            }

            const cursorPosition = textArea.selectionStart ?? prev.length
            const newText = prev.slice(0, cursorPosition) + emoji + prev.slice(cursorPosition)

            // Focus and set cursor after emoji
            setTimeoutTimer(
              'handleEmojiSelect_focus',
              () => {
                textArea.focus()
                const newCursorPos = cursorPosition + emoji.length
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
      content={<EmojiPicker onEmojiClick={handleEmojiSelect} />}>
      <Tooltip placement="top" title={t('chat.input.emoji', 'Emoji')} mouseLeaveDelay={0} arrow>
        <ActionIconButton aria-label={t('chat.input.emoji', 'Emoji')}>
          <SmilePlus size={18} />
        </ActionIconButton>
      </Tooltip>
    </Popover>
  )
}

export default memo(EmojiButton)
