import EmojiButton from '@renderer/pages/home/Inputbar/tools/components/EmojiButton'
import { defineTool, registerTool, TopicType } from '@renderer/pages/home/Inputbar/types'

const emojiTool = defineTool({
  key: 'emoji',
  label: (t) => t('chat.input.emoji', 'Emoji'),

  visibleInScopes: [TopicType.Chat, TopicType.Session, 'mini-window'],

  dependencies: {
    actions: ['onTextChange', 'resizeTextArea'] as const
  },

  render: (context) => {
    const { actions } = context

    return <EmojiButton setInputValue={actions.onTextChange} resizeTextArea={actions.resizeTextArea} />
  }
})

registerTool(emojiTool)

export default emojiTool
