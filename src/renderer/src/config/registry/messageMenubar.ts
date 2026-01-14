import { TopicType } from '@renderer/types'

export type MessageMenubarScope = TopicType

export type MessageMenubarButtonId =
  | 'user-regenerate'
  | 'user-edit'
  | 'copy'
  | 'assistant-regenerate'
  | 'assistant-mention-model'
  | 'translate'
  | 'useful'
  | 'notes'
  | 'delete'
  | 'trace'
  | 'more-menu'

export type MessageMenubarScopeConfig = {
  buttonIds: MessageMenubarButtonId[]
  dropdownRootAllowKeys?: string[]
}

export const DEFAULT_MESSAGE_MENUBAR_SCOPE: MessageMenubarScope = TopicType.Chat

export const DEFAULT_MESSAGE_MENUBAR_BUTTON_IDS: MessageMenubarButtonId[] = [
  'user-regenerate',
  'user-edit',
  'copy',
  'assistant-regenerate',
  'assistant-mention-model',
  'translate',
  'useful',
  'notes',
  'delete',
  'trace',
  'more-menu'
]

export const SESSION_MESSAGE_MENUBAR_BUTTON_IDS: MessageMenubarButtonId[] = [
  'copy',
  'translate',
  'notes',
  'delete',
  'more-menu'
]

// 群聊消息工具栏按钮 - 比 Session 更丰富
export const GROUPCHAT_MESSAGE_MENUBAR_BUTTON_IDS: MessageMenubarButtonId[] = [
  'user-edit', // 允许编辑用户消息
  'copy',
  'translate',
  'useful', // 标记为有用
  'notes',
  'delete',
  'more-menu' // 包含编辑、分支、多选、保存、导出
]

const messageMenubarRegistry = new Map<MessageMenubarScope, MessageMenubarScopeConfig>([
  [DEFAULT_MESSAGE_MENUBAR_SCOPE, { buttonIds: [...DEFAULT_MESSAGE_MENUBAR_BUTTON_IDS] }],
  [TopicType.Chat, { buttonIds: [...DEFAULT_MESSAGE_MENUBAR_BUTTON_IDS] }],
  [TopicType.Session, { buttonIds: [...SESSION_MESSAGE_MENUBAR_BUTTON_IDS], dropdownRootAllowKeys: ['save', 'export'] }],
  [TopicType.GroupChat, { buttonIds: [...GROUPCHAT_MESSAGE_MENUBAR_BUTTON_IDS], dropdownRootAllowKeys: ['edit', 'save', 'export'] }]
])

export const registerMessageMenubarConfig = (scope: MessageMenubarScope, config: MessageMenubarScopeConfig) => {
  const clonedConfig: MessageMenubarScopeConfig = {
    buttonIds: [...config.buttonIds],
    dropdownRootAllowKeys: config.dropdownRootAllowKeys ? [...config.dropdownRootAllowKeys] : undefined
  }
  messageMenubarRegistry.set(scope, clonedConfig)
}

export const getMessageMenubarConfig = (scope: MessageMenubarScope): MessageMenubarScopeConfig => {
  if (messageMenubarRegistry.has(scope)) {
    return messageMenubarRegistry.get(scope) as MessageMenubarScopeConfig
  }
  return messageMenubarRegistry.get(DEFAULT_MESSAGE_MENUBAR_SCOPE) as MessageMenubarScopeConfig
}
