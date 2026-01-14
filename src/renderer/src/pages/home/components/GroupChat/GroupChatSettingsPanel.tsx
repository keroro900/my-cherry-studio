/**
 * GroupChatSettingsPanel - 群聊设置面板
 *
 * 提供群聊配置界面：
 * - 发言模式选择
 * - GroupPrompt (群组设定)
 * - InvitePrompt (邀请提示词)
 * - 统一模型设置
 */

import { SettingOutlined } from '@ant-design/icons'
import type { SpeakingMode, GroupChatConfig } from '@renderer/services/GroupChatService'
import { Button, Drawer, Form, Input, Select, Switch, Tooltip } from 'antd'
import type { FC } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { TextArea } = Input
const { Option } = Select

export interface GroupChatSettings {
  speakingMode: SpeakingMode
  groupPrompt: string
  invitePrompt: string
  useUnifiedModel: boolean
  unifiedModel?: string
  enableContextSanitizer: boolean
}

export interface GroupChatSettingsPanelProps {
  settings: GroupChatSettings
  onChange: (settings: GroupChatSettings) => void
  disabled?: boolean
  availableModels?: Array<{ id: string; name: string }>
}

const DEFAULT_INVITE_PROMPT = `现在轮到你{{VCPChatAgentName}}发言了。系统已经为大家总结了上文的发言，请根据上下文继续对话。`

const DEFAULT_GROUP_PROMPT = `例如：现在这里是用户家的聊天室...`

/**
 * 群聊设置面板
 */
export const GroupChatSettingsPanel: FC<GroupChatSettingsPanelProps> = ({
  settings,
  onChange,
  disabled = false,
  availableModels = []
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const handleSettingChange = <K extends keyof GroupChatSettings>(
    key: K,
    value: GroupChatSettings[K]
  ) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <>
      <Tooltip title={t('groupchat.settings', '群聊设置')}>
        <SettingsButton
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setIsOpen(true)}
        />
      </Tooltip>

      <Drawer
        title={t('groupchat.settings', '群聊设置')}
        placement="right"
        width={400}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        destroyOnClose={false}
      >
        <Form layout="vertical">
          {/* 发言模式 */}
          <Form.Item label={t('groupchat.speaking_mode', '发言模式')}>
            <Select
              value={settings.speakingMode}
              onChange={(value) => handleSettingChange('speakingMode', value)}
              disabled={disabled}
            >
              <Option value="mention">{t('groupchat.mode_mention', '@提及模式')}</Option>
              <Option value="sequential">{t('groupchat.mode_sequential', '顺序发言')}</Option>
              <Option value="naturerandom">{t('groupchat.mode_naturerandom', '自然随机')}</Option>
              <Option value="invitation">{t('groupchat.mode_invitation', '邀请发言')}</Option>
              <Option value="random">{t('groupchat.mode_random', '随机发言')}</Option>
            </Select>
            <ModeDescription>
              {settings.speakingMode === 'mention' && t('groupchat.mode_mention_desc', '使用 @助手名 来指定回复者')}
              {settings.speakingMode === 'sequential' && t('groupchat.mode_sequential_desc', '按成员顺序依次发言')}
              {settings.speakingMode === 'naturerandom' && t('groupchat.mode_naturerandom_desc', '根据上下文智能选择发言者')}
              {settings.speakingMode === 'invitation' && t('groupchat.mode_invitation_desc', '只有被邀请的助手才会发言')}
              {settings.speakingMode === 'random' && t('groupchat.mode_random_desc', '随机选择助手发言')}
            </ModeDescription>
          </Form.Item>

          {/* 群组设定 */}
          <Form.Item label={t('groupchat.group_prompt', '群设定 (GroupPrompt)')}>
            <TextArea
              value={settings.groupPrompt}
              onChange={(e) => handleSettingChange('groupPrompt', e.target.value)}
              placeholder={DEFAULT_GROUP_PROMPT}
              rows={4}
              disabled={disabled}
            />
            <FieldDescription>
              {t('groupchat.group_prompt_desc', '所有助手共享的背景设定，会注入到每个助手的系统提示词中')}
            </FieldDescription>
          </Form.Item>

          {/* 邀请提示词 */}
          <Form.Item label={t('groupchat.invite_prompt', '发言设定 (InvitePrompt)')}>
            <TextArea
              value={settings.invitePrompt || DEFAULT_INVITE_PROMPT}
              onChange={(e) => handleSettingChange('invitePrompt', e.target.value)}
              placeholder={DEFAULT_INVITE_PROMPT}
              rows={4}
              disabled={disabled}
            />
            <FieldDescription>
              {t('groupchat.invite_prompt_desc', '使用 {{VCPChatAgentName}} 作为被邀请发言的Agent名称占位符')}
            </FieldDescription>
          </Form.Item>

          {/* 统一模型 */}
          <Form.Item>
            <SwitchRow>
              <span>{t('groupchat.unified_model', '启用群组统一模型')}</span>
              <Switch
                checked={settings.useUnifiedModel}
                onChange={(checked) => handleSettingChange('useUnifiedModel', checked)}
                disabled={disabled}
              />
            </SwitchRow>
            <FieldDescription>
              {t('groupchat.unified_model_desc', '所有成员使用同一个模型进行对话')}
            </FieldDescription>
          </Form.Item>

          {settings.useUnifiedModel && availableModels.length > 0 && (
            <Form.Item label={t('groupchat.select_model', '选择模型')}>
              <Select
                value={settings.unifiedModel}
                onChange={(value) => handleSettingChange('unifiedModel', value)}
                disabled={disabled}
                placeholder={t('groupchat.select_model_placeholder', '选择统一使用的模型')}
              >
                {availableModels.map((model) => (
                  <Option key={model.id} value={model.id}>
                    {model.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 上下文净化 */}
          <Form.Item>
            <SwitchRow>
              <span>{t('groupchat.context_sanitizer', '上下文净化')}</span>
              <Switch
                checked={settings.enableContextSanitizer}
                onChange={(checked) => handleSettingChange('enableContextSanitizer', checked)}
                disabled={disabled}
              />
            </SwitchRow>
            <FieldDescription>
              {t('groupchat.context_sanitizer_desc', '将 HTML 转换为 Markdown 以减少 token 用量')}
            </FieldDescription>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

// Styled Components
const SettingsButton = styled(Button)`
  color: var(--color-text-2);

  &:hover {
    color: var(--color-primary);
  }
`

const ModeDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
`

const FieldDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
`

const SwitchRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export default GroupChatSettingsPanel
