/**
 * @deprecated Scheduled for removal in v2.0.0
 * --------------------------------------------------------------------------
 * ⚠️ NOTICE: V2 DATA&UI REFACTORING (by 0xfullex)
 * --------------------------------------------------------------------------
 * STOP: Feature PRs affecting this file are currently BLOCKED.
 * Only critical bug fixes are accepted during this migration phase.
 *
 * This file is being refactored to v2 standards.
 * Any non-critical changes will conflict with the ongoing work.
 *
 * 🔗 Context & Status:
 * - Contribution Hold: https://github.com/CherryHQ/cherry-studio/issues/10954
 * - v2 Refactor PR   : https://github.com/CherryHQ/cherry-studio/pull/10162
 * --------------------------------------------------------------------------
 */
// @ts-nocheck
import type { PayloadAction } from '@reduxjs/toolkit'
import { createSelector, createSlice } from '@reduxjs/toolkit'
import { DEFAULT_CONTEXTCOUNT, DEFAULT_TEMPERATURE } from '@renderer/config/constant'
import { TopicManager } from '@renderer/hooks/useTopic'
import { DEFAULT_ASSISTANT_SETTINGS, getDefaultAssistant, getDefaultTopic } from '@renderer/services/AssistantService'
import type {
  Assistant,
  AssistantPreset,
  AssistantSettings,
  ImageAssistant,
  ImageAssistantConfig,
  ImageAssistantPreset,
  Model,
  Topic
} from '@renderer/types'
import { isImageAssistant } from '@renderer/types'
import { isEmpty, uniqBy } from 'lodash'

import type { RootState } from '.'

// 内置图片助手预设
const BUILTIN_IMAGE_ASSISTANT_PRESETS: ImageAssistantPreset[] = [
  {
    id: 'image-ecom-default',
    name: '电商图片助手',
    emoji: '🛍️',
    type: 'image',
    imageType: 'ecom',
    prompt: '你是一位专业的电商产品摄影专家。帮助用户生成高质量的产品展示图片，包括主图、细节图和场景图。',
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '3:4',
      batchCount: 1,
      moduleConfig: {
        layout: 'model_shot',
        stylePreset: 'auto',
        enableBack: false,
        enableDetail: false
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-model-default',
    name: '模特换装助手',
    emoji: '👗',
    type: 'image',
    imageType: 'model',
    prompt: '你是一位时尚摄影专家，帮助用户生成专业的模特穿搭图片。根据用户上传的服装图片，生成穿着该服装的模特照片。',
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '3:4',
      batchCount: 1,
      moduleConfig: {
        ageGroup: 'adult',
        gender: 'female',
        scenePreset: 'studio',
        poseStyle: 'natural'
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  },
  {
    id: 'image-pattern-default',
    name: '图案设计助手',
    emoji: '🎨',
    type: 'image',
    imageType: 'pattern',
    prompt:
      '你是一位图案设计专家，帮助用户生成精美的无缝图案和纹理。可以根据用户的描述或参考图创建各种风格的图案设计。',
    imageConfig: {
      imageSize: '2K',
      aspectRatio: '1:1',
      batchCount: 1,
      moduleConfig: {
        generationMode: 'mode_a',
        outputType: 'set',
        patternType: 'seamless',
        density: 'medium',
        colorTone: 'auto',
        batchSize: 1
      }
    },
    group: ['图片生成'],
    settings: DEFAULT_ASSISTANT_SETTINGS
  }
]

export interface AssistantsState {
  defaultAssistant: Assistant
  assistants: Assistant[]
  tagsOrder: string[]
  collapsedTags: Record<string, boolean>
  presets: AssistantPreset[]
  imageAssistantPresets: ImageAssistantPreset[]
  unifiedListOrder: Array<{ type: 'agent' | 'assistant'; id: string }>
}

const initialState: AssistantsState = {
  defaultAssistant: getDefaultAssistant(),
  assistants: [getDefaultAssistant()],
  tagsOrder: [],
  collapsedTags: {},
  presets: [],
  imageAssistantPresets: BUILTIN_IMAGE_ASSISTANT_PRESETS,
  unifiedListOrder: []
}

const assistantsSlice = createSlice({
  name: 'assistants',
  initialState,
  reducers: {
    updateDefaultAssistant: (state, action: PayloadAction<{ assistant: Assistant }>) => {
      // @ts-ignore ts2589
      state.defaultAssistant = action.payload.assistant
    },
    updateAssistants: (state, action: PayloadAction<Assistant[]>) => {
      state.assistants = action.payload
    },
    addAssistant: (state, action: PayloadAction<Assistant>) => {
      state.assistants.unshift(action.payload)
    },
    insertAssistant: (state, action: PayloadAction<{ index: number; assistant: Assistant }>) => {
      const { index, assistant } = action.payload

      if (index < 0 || index > state.assistants.length) {
        throw new Error(`InsertAssistant: index ${index} is out of bounds [0, ${state.assistants.length}]`)
      }

      state.assistants.splice(index, 0, assistant)
    },
    removeAssistant: (state, action: PayloadAction<{ id: string }>) => {
      state.assistants = state.assistants.filter((c) => c.id !== action.payload.id)
    },
    updateAssistant: (state, action: PayloadAction<Partial<Assistant> & { id: string }>) => {
      const { id, ...update } = action.payload
      // @ts-ignore ts2589
      state.assistants = state.assistants.map((c) => (c.id === id ? { ...c, ...update } : c))
    },
    updateAssistantSettings: (
      state,
      action: PayloadAction<{ assistantId: string; settings: Partial<AssistantSettings> }>
    ) => {
      for (const assistant of state.assistants) {
        const settings = action.payload.settings
        if (assistant.id === action.payload.assistantId) {
          for (const key in settings) {
            if (!assistant.settings) {
              assistant.settings = {
                temperature: DEFAULT_TEMPERATURE,
                contextCount: DEFAULT_CONTEXTCOUNT,
                enableMaxTokens: false,
                maxTokens: 0,
                streamOutput: true
              }
            }
            assistant.settings[key] = settings[key]
          }
        }
      }
    },
    setTagsOrder: (state, action: PayloadAction<string[]>) => {
      const newOrder = action.payload
      state.tagsOrder = newOrder
      const prevCollapsed = state.collapsedTags || {}
      const updatedCollapsed: Record<string, boolean> = { ...prevCollapsed }
      newOrder.forEach((tag) => {
        if (!(tag in updatedCollapsed)) {
          updatedCollapsed[tag] = false
        }
      })
      state.collapsedTags = updatedCollapsed
    },
    updateTagCollapse: (state, action: PayloadAction<string>) => {
      const tag = action.payload
      const prev = state.collapsedTags || {}
      state.collapsedTags = {
        ...prev,
        [tag]: !prev[tag]
      }
    },
    setUnifiedListOrder: (state, action: PayloadAction<Array<{ type: 'agent' | 'assistant'; id: string }>>) => {
      state.unifiedListOrder = action.payload
    },
    addTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      const topic = action.payload.topic
      topic.createdAt = topic.createdAt || new Date().toISOString()
      topic.updatedAt = topic.updatedAt || new Date().toISOString()
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: uniqBy([topic, ...assistant.topics], 'id')
            }
          : assistant
      )
    },
    removeTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: assistant.topics.filter(({ id }) => id !== action.payload.topic.id)
            }
          : assistant
      )
    },
    updateTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      const newTopic = action.payload.topic
      newTopic.updatedAt = new Date().toISOString()
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: assistant.topics.map((topic) => {
                const _topic = topic.id === newTopic.id ? newTopic : topic
                _topic.messages = []
                return _topic
              })
            }
          : assistant
      )
    },
    updateTopics: (state, action: PayloadAction<{ assistantId: string; topics: Topic[] }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: action.payload.topics.map((topic) =>
                isEmpty(topic.messages) ? topic : { ...topic, messages: [] }
              )
            }
          : assistant
      )
    },
    removeAllTopics: (state, action: PayloadAction<{ assistantId: string }>) => {
      state.assistants = state.assistants.map((assistant) => {
        if (assistant.id === action.payload.assistantId) {
          assistant.topics.forEach((topic) => TopicManager.removeTopic(topic.id))
          return {
            ...assistant,
            topics: [getDefaultTopic(assistant.id)]
          }
        }
        return assistant
      })
    },
    updateTopicUpdatedAt: (state, action: PayloadAction<{ topicId: string }>) => {
      outer: for (const assistant of state.assistants) {
        for (const topic of assistant.topics) {
          if (topic.id === action.payload.topicId) {
            topic.updatedAt = new Date().toISOString()
            break outer
          }
        }
      }
    },
    setModel: (state, action: PayloadAction<{ assistantId: string; model: Model }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              model: action.payload.model
            }
          : assistant
      )
    },
    // Assistant Presets
    setAssistantPresets: (state, action: PayloadAction<AssistantPreset[]>) => {
      const presets = action.payload
      state.presets = []
      presets.forEach((p) => {
        state.presets.push(p)
      })
    },
    addAssistantPreset: (state, action: PayloadAction<AssistantPreset>) => {
      state.presets.push(action.payload)
    },
    removeAssistantPreset: (state, action: PayloadAction<{ id: string }>) => {
      state.presets = state.presets.filter((c) => c.id !== action.payload.id)
    },
    updateAssistantPreset: (state, action: PayloadAction<AssistantPreset>) => {
      const preset = action.payload
      const index = state.presets.findIndex((a) => a.id === preset.id)
      if (index !== -1) {
        state.presets[index] = preset
      }
    },
    updateAssistantPresetSettings: (
      state,
      action: PayloadAction<{ assistantId: string; settings: Partial<AssistantSettings> }>
    ) => {
      for (const agent of state.presets) {
        const settings = action.payload.settings
        if (agent.id === action.payload.assistantId) {
          for (const key in settings) {
            if (!agent.settings) {
              agent.settings = { ...DEFAULT_ASSISTANT_SETTINGS }
            }
            agent.settings[key] = settings[key]
          }
        }
      }
    },
    // Image Assistant Actions
    updateImageAssistantConfig: (
      state,
      action: PayloadAction<{ assistantId: string; config: Partial<ImageAssistantConfig> }>
    ) => {
      const { assistantId, config } = action.payload
      state.assistants = state.assistants.map((assistant) => {
        if (assistant.id === assistantId && isImageAssistant(assistant)) {
          return {
            ...assistant,
            imageConfig: {
              ...assistant.imageConfig,
              ...config
            }
          }
        }
        return assistant
      })
    },
    setImageAssistantPresets: (state, action: PayloadAction<ImageAssistantPreset[]>) => {
      state.imageAssistantPresets = action.payload
    },
    addImageAssistantPreset: (state, action: PayloadAction<ImageAssistantPreset>) => {
      state.imageAssistantPresets.push(action.payload)
    },
    removeImageAssistantPreset: (state, action: PayloadAction<{ id: string }>) => {
      state.imageAssistantPresets = state.imageAssistantPresets.filter((p) => p.id !== action.payload.id)
    }
  }
})

export const {
  updateDefaultAssistant,
  updateAssistants,
  addAssistant,
  insertAssistant,
  removeAssistant,
  updateAssistant,
  addTopic,
  removeTopic,
  updateTopic,
  updateTopics,
  removeAllTopics,
  updateTopicUpdatedAt,
  setModel,
  setTagsOrder,
  updateAssistantSettings,
  updateTagCollapse,
  setUnifiedListOrder,
  setAssistantPresets,
  addAssistantPreset,
  removeAssistantPreset,
  updateAssistantPreset,
  updateAssistantPresetSettings,
  // Image Assistant Actions
  updateImageAssistantConfig,
  setImageAssistantPresets,
  addImageAssistantPreset,
  removeImageAssistantPreset
} = assistantsSlice.actions

export const selectAllTopics = createSelector([(state: RootState) => state.assistants.assistants], (assistants) =>
  assistants.flatMap((assistant: Assistant) => assistant.topics)
)

export const selectTopicsMap = createSelector([selectAllTopics], (topics) => {
  return topics.reduce((map, topic) => {
    map.set(topic.id, topic)
    return map
  }, new Map())
})

// Image Assistant Selectors
export const selectImageAssistants = createSelector(
  [(state: RootState) => state.assistants.assistants],
  (assistants) => assistants.filter(isImageAssistant) as ImageAssistant[]
)

export const selectImageAssistantPresets = (state: RootState) => state.assistants.imageAssistantPresets

export default assistantsSlice.reducer
