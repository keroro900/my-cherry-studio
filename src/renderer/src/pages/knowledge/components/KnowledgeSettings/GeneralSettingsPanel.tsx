import InputEmbeddingDimension from '@renderer/components/InputEmbeddingDimension'
import ModelSelector from '@renderer/components/ModelSelector'
import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { DEFAULT_KNOWLEDGE_DOCUMENT_COUNT } from '@renderer/config/constant'
import { isEmbeddingModel } from '@renderer/config/models'
import { useProviders } from '@renderer/hooks/useProvider'
import { getModelUniqId } from '@renderer/services/ModelService'
import type { KnowledgeBase, KnowledgeType } from '@renderer/types'
import { Input, Select, Slider } from 'antd'
import { useTranslation } from 'react-i18next'

import { SettingsItem, SettingsPanel } from './styles'

interface GeneralSettingsPanelProps {
  newBase: KnowledgeBase
  setNewBase: React.Dispatch<React.SetStateAction<KnowledgeBase>>
  handlers: {
    handleEmbeddingModelChange: (value: string) => void
    handleDimensionChange: (value: number | null) => void
  }
}

const KNOWLEDGE_TYPE_OPTIONS: Array<{ value: KnowledgeType; label: string; description: string }> = [
  { value: 'general', label: '通用知识库', description: '适用于文档、网页等通用场景' },
  { value: 'fashion', label: 'Fashion 时尚', description: '服装图片分析、趋势元数据提取' }
]

const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({ newBase, setNewBase, handlers }) => {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const { handleEmbeddingModelChange, handleDimensionChange } = handlers

  return (
    <SettingsPanel>
      <SettingsItem>
        <div className="settings-label">{t('common.name')}</div>
        <Input
          placeholder={t('common.name')}
          value={newBase.name}
          onChange={(e) => setNewBase((prev) => ({ ...prev, name: e.target.value }))}
        />
      </SettingsItem>

      <SettingsItem>
        <div className="settings-label">
          {t('knowledge.type') || '知识库类型'}
          <InfoTooltip title="选择知识库类型，Fashion 类型支持服装图片分析和元数据提取" placement="right" />
        </div>
        <Select
          style={{ width: '100%' }}
          value={newBase.knowledgeType || 'general'}
          onChange={(value: KnowledgeType) => setNewBase((prev) => ({ ...prev, knowledgeType: value }))}
          options={KNOWLEDGE_TYPE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: (
              <div>
                <div>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{opt.description}</div>
              </div>
            )
          }))}
        />
      </SettingsItem>

      <SettingsItem>
        <div className="settings-label">
          {t('models.embedding_model')}
          <InfoTooltip title={t('models.embedding_model_tooltip')} placement="right" />
        </div>
        <ModelSelector
          providers={providers}
          predicate={isEmbeddingModel}
          style={{ width: '100%' }}
          placeholder={t('settings.models.empty')}
          value={getModelUniqId(newBase.model)}
          onChange={handleEmbeddingModelChange}
        />
      </SettingsItem>

      <SettingsItem>
        <div className="settings-label">
          {t('knowledge.dimensions')}
          <InfoTooltip title={t('knowledge.dimensions_size_tooltip')} placement="right" />
        </div>
        <InputEmbeddingDimension
          value={newBase.dimensions}
          onChange={handleDimensionChange}
          model={newBase.model}
          disabled={!newBase.model}
        />
      </SettingsItem>

      <SettingsItem>
        <div className="settings-label">
          {t('knowledge.document_count')}
          <InfoTooltip title={t('knowledge.document_count_help')} placement="right" />
        </div>
        <Slider
          style={{ width: '97%' }}
          min={1}
          max={50}
          step={1}
          value={newBase.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT}
          marks={{ 1: '1', 6: t('knowledge.document_count_default'), 30: '30', 50: '50' }}
          onChange={(value) => setNewBase((prev) => ({ ...prev, documentCount: value }))}
        />
      </SettingsItem>
    </SettingsPanel>
  )
}

export default GeneralSettingsPanel
