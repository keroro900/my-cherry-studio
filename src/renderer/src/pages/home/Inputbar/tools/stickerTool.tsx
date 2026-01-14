import StickerButton from '@renderer/pages/home/Inputbar/tools/components/StickerButton'
import { defineTool, registerTool, TopicType } from '@renderer/pages/home/Inputbar/types'

const stickerTool = defineTool({
  key: 'sticker',
  label: (t) => t('chat.input.sticker', 'Sticker'),

  visibleInScopes: [TopicType.Chat, TopicType.Session, 'mini-window'],

  dependencies: {
    actions: ['onTextChange', 'resizeTextArea'] as const
  },

  render: (context) => {
    const { actions } = context

    return <StickerButton setInputValue={actions.onTextChange} resizeTextArea={actions.resizeTextArea} />
  }
})

registerTool(stickerTool)

export default stickerTool
