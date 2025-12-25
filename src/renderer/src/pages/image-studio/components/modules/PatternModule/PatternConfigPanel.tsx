/**
 * 图案设计配置面板
 *
 * 配置图案生成的参数，支持多图输入和提示词编辑
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updatePatternConfig } from '@renderer/store/imageStudio'
import { Collapse, Input, InputNumber, Radio, Select, Slider, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { ImagePlus, Palette, Sparkles, Wand2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 风格预设
const STYLE_PRESETS = [
  { value: 'floral', icon: '🌸' },
  { value: 'geometric', icon: '◆' },
  { value: 'abstract', icon: '🎨' },
  { value: 'cartoon', icon: '🎪' },
  { value: 'nature', icon: '🌿' },
  { value: 'tribal', icon: '◈' },
  { value: 'watercolor', icon: '💧' },
  { value: 'vintage', icon: '📜' },
  { value: 'modern', icon: '⬡' },
  { value: 'minimalist', icon: '○' }
]

const PatternConfigPanel: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const config = useAppSelector((state) => state.imageStudio.patternConfig)
  const [refFiles, setRefFiles] = useState<UploadFile[]>([])

  const handleRefUpload = useCallback(({ fileList }: { fileList: UploadFile[] }) => {
    setRefFiles(fileList.slice(0, 4))
  }, [])

  const handleRemoveRef = useCallback((index: number) => {
    setRefFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <Container>
      {/* 生成模式 */}
      <Section>
        <SectionTitle>{t('image_studio.pattern.mode')}</SectionTitle>
        <ModeGrid>
          {['mode_a', 'mode_b', 'mode_c'].map((mode) => (
            <ModeCard
              key={mode}
              $active={config.generationMode === mode}
              onClick={() => dispatch(updatePatternConfig({ generationMode: mode }))}
            >
              <ModeIcon>
                {mode === 'mode_a' ? '🔀' : mode === 'mode_b' ? '🔄' : '✨'}
              </ModeIcon>
              <ModeName>{t(`image_studio.pattern.${mode}`)}</ModeName>
              <ModeDesc>{t(`image_studio.pattern.${mode}_desc`)}</ModeDesc>
            </ModeCard>
          ))}
        </ModeGrid>
      </Section>

      {/* 参考图上传（Mode A/B） */}
      {config.generationMode !== 'mode_c' && (
        <Section>
          <SectionHeader>
            <SectionTitle>
              <ImagePlus size={16} />
              {t('image_studio.pattern.reference')}
            </SectionTitle>
            <ImageCount>{refFiles.length}/4</ImageCount>
          </SectionHeader>

          <UploadArea>
            {refFiles.map((file, index) => (
              <UploadedImage key={file.uid}>
                <img
                  src={file.thumbUrl || (file.originFileObj ? URL.createObjectURL(file.originFileObj as Blob) : '')}
                  alt=""
                />
                <RemoveButton onClick={() => handleRemoveRef(index)}>
                  <DeleteOutlined />
                </RemoveButton>
                <ImageLabel>{t('image_studio.pattern.ref')} {index + 1}</ImageLabel>
              </UploadedImage>
            ))}

            {refFiles.length < 4 && (
              <Upload
                accept="image/*"
                showUploadList={false}
                multiple
                beforeUpload={() => false}
                onChange={handleRefUpload}
                fileList={refFiles}
              >
                <AddImageButton>
                  <PlusOutlined />
                  <span>{t('image_studio.pattern.add_ref')}</span>
                </AddImageButton>
              </Upload>
            )}
          </UploadArea>
        </Section>
      )}

      {/* 风格预设 */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <Palette size={16} />
            {t('image_studio.pattern.style_preset')}
          </SectionTitle>
        </SectionHeader>

        <StyleGrid>
          {STYLE_PRESETS.map((style) => (
            <StyleOption
              key={style.value}
              $active={config.stylePreset === style.value}
              onClick={() => dispatch(updatePatternConfig({ stylePreset: style.value }))}
            >
              <StyleIcon>{style.icon}</StyleIcon>
              <StyleName>{t(`image_studio.pattern.style_${style.value}`)}</StyleName>
            </StyleOption>
          ))}
        </StyleGrid>
      </Section>

      {/* 输出类型 */}
      <Section>
        <SectionTitle>{t('image_studio.pattern.output_type')}</SectionTitle>
        <Radio.Group
          value={config.outputType}
          onChange={(e) => dispatch(updatePatternConfig({ outputType: e.target.value }))}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="pattern_only">{t('image_studio.pattern.output_pattern')}</Radio.Button>
          <Radio.Button value="set">{t('image_studio.pattern.output_set')}</Radio.Button>
        </Radio.Group>
      </Section>

      {/* 图案设置 */}
      <Section>
        <SectionTitle>{t('image_studio.pattern.settings')}</SectionTitle>
        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.pattern.type')}</FormLabel>
            <Select
              value={config.patternType}
              onChange={(value) => dispatch(updatePatternConfig({ patternType: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: 'seamless', label: t('image_studio.pattern.type_seamless') },
                { value: 'half_drop', label: t('image_studio.pattern.type_half_drop') },
                { value: 'brick', label: t('image_studio.pattern.type_brick') },
                { value: 'mirror', label: t('image_studio.pattern.type_mirror') }
              ]}
            />
          </FormItem>
          <FormItem>
            <FormLabel>{t('image_studio.pattern.density')}</FormLabel>
            <Slider
              min={1}
              max={5}
              value={config.density === 'sparse' ? 1 : config.density === 'medium' ? 3 : 5}
              onChange={(value) => {
                const density = value <= 2 ? 'sparse' : value <= 4 ? 'medium' : 'dense'
                dispatch(updatePatternConfig({ density }))
              }}
              marks={{ 1: t('image_studio.pattern.density_sparse'), 3: t('image_studio.pattern.density_medium'), 5: t('image_studio.pattern.density_dense') }}
            />
          </FormItem>
        </FormGrid>

        <FormItem style={{ marginTop: 12 }}>
          <FormLabel>{t('image_studio.pattern.color_tone')}</FormLabel>
          <ColorToneGrid>
            {['auto', 'bright', 'soft', 'dark', 'high_contrast'].map((tone) => (
              <ColorToneOption
                key={tone}
                $active={config.colorTone === tone}
                $tone={tone}
                onClick={() => dispatch(updatePatternConfig({ colorTone: tone }))}
              >
                {t(`image_studio.pattern.color_${tone}`)}
              </ColorToneOption>
            ))}
          </ColorToneGrid>
        </FormItem>
      </Section>

      {/* 图片设置 */}
      <Section>
        <SectionTitle>{t('image_studio.image_settings')}</SectionTitle>
        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.image_size')}</FormLabel>
            <Select
              value={config.imageSize}
              onChange={(value) => dispatch(updatePatternConfig({ imageSize: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: '1K', label: '1K (1024)' },
                { value: '2K', label: '2K (2048)' },
                { value: '4K', label: '4K (4096)' }
              ]}
            />
          </FormItem>
          <FormItem>
            <FormLabel>{t('image_studio.aspect_ratio')}</FormLabel>
            <Select
              value={config.aspectRatio}
              onChange={(value) => dispatch(updatePatternConfig({ aspectRatio: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: '1:1', label: '1:1' },
                { value: '3:4', label: '3:4' },
                { value: '4:3', label: '4:3' }
              ]}
            />
          </FormItem>
        </FormGrid>
      </Section>

      {/* 提示词编辑器 */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <Wand2 size={16} />
            {t('image_studio.prompt.title')}
          </SectionTitle>
          <PromptActions>
            <ActionButton title={t('image_studio.prompt.optimize')}>
              <Sparkles size={14} />
            </ActionButton>
          </PromptActions>
        </SectionHeader>

        <PromptEditor>
          <PromptSection>
            <PromptLabel>{t('image_studio.pattern.design_prompt')}</PromptLabel>
            <Input.TextArea
              value={config.designPrompt || ''}
              onChange={(e) => dispatch(updatePatternConfig({ designPrompt: e.target.value }))}
              placeholder={t('image_studio.pattern.design_prompt_placeholder')}
              rows={3}
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </PromptSection>

          <PromptSection>
            <PromptLabel>{t('image_studio.pattern.color_prompt')}</PromptLabel>
            <Input.TextArea
              value={config.colorPrompt || ''}
              onChange={(e) => dispatch(updatePatternConfig({ colorPrompt: e.target.value }))}
              placeholder={t('image_studio.pattern.color_prompt_placeholder')}
              rows={2}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </PromptSection>

          <PromptSection>
            <PromptLabel>{t('image_studio.prompt.negative')}</PromptLabel>
            <Input.TextArea
              value={config.negativePrompt || ''}
              onChange={(e) => dispatch(updatePatternConfig({ negativePrompt: e.target.value }))}
              placeholder={t('image_studio.prompt.negative_placeholder')}
              rows={2}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </PromptSection>
        </PromptEditor>
      </Section>

      {/* 高级设置 */}
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'advanced',
            label: <AdvancedLabel>{t('image_studio.advanced_settings')}</AdvancedLabel>,
            children: (
              <AdvancedSettings>
                <FormItem>
                  <FormLabel>{t('image_studio.batch_count')}</FormLabel>
                  <Slider
                    min={1}
                    max={8}
                    value={config.batchSize || 1}
                    onChange={(value) => dispatch(updatePatternConfig({ batchSize: value }))}
                    marks={{ 1: '1', 4: '4', 8: '8' }}
                  />
                </FormItem>
                <FormItem>
                  <FormLabel>{t('image_studio.pattern.tile_scale')}</FormLabel>
                  <Slider
                    min={1}
                    max={4}
                    step={0.5}
                    value={config.tileScale || 1}
                    onChange={(value) => dispatch(updatePatternConfig({ tileScale: value }))}
                    marks={{ 1: '1x', 2: '2x', 4: '4x' }}
                  />
                </FormItem>
                <FormItem>
                  <FormLabel>{t('image_studio.seed')}</FormLabel>
                  <Input
                    type="number"
                    value={config.seed || ''}
                    onChange={(e) =>
                      dispatch(updatePatternConfig({ seed: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    placeholder={t('image_studio.seed_placeholder')}
                    size="small"
                  />
                </FormItem>
              </AdvancedSettings>
            )
          }
        ]}
      />
    </Container>
  )
}

export default PatternConfigPanel

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
`

const ImageCount = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`

const ModeCard = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'transparent')};

  &:hover {
    border-color: var(--color-primary);
  }
`

const ModeIcon = styled.span`
  font-size: 20px;
`

const ModeName = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-1);
  text-align: center;
`

const ModeDesc = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  text-align: center;
`

const UploadArea = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
`

const UploadedImage = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const RemoveButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;

  ${UploadedImage}:hover & {
    opacity: 1;
  }
`

const ImageLabel = styled.span`
  position: absolute;
  bottom: 2px;
  left: 2px;
  padding: 1px 4px;
  font-size: 9px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
`

const AddImageButton = styled.div`
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  color: var(--color-text-3);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const StyleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
`

const StyleOption = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'transparent')};

  &:hover {
    border-color: var(--color-primary);
  }
`

const StyleIcon = styled.span`
  font-size: 18px;
`

const StyleName = styled.span`
  font-size: 10px;
  color: var(--color-text-2);
  text-align: center;
`

const ColorToneGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const ColorToneOption = styled.div<{ $active: boolean; $tone: string }>`
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => {
    if (props.$active) return 'var(--color-primary-soft)'
    switch (props.$tone) {
      case 'bright':
        return 'linear-gradient(135deg, #fff8e1, #ffe0b2)'
      case 'soft':
        return 'linear-gradient(135deg, #f3e5f5, #e1bee7)'
      case 'dark':
        return 'linear-gradient(135deg, #424242, #616161)'
      case 'high_contrast':
        return 'linear-gradient(135deg, #fff, #000)'
      default:
        return 'transparent'
    }
  }};
  color: ${(props) => (props.$tone === 'dark' ? '#fff' : 'var(--color-text-2)')};

  &:hover {
    border-color: var(--color-primary);
  }
`

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`

const FormItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FormLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
`

const PromptActions = styled.div`
  display: flex;
  gap: 4px;
`

const ActionButton = styled.button`
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-soft);
  }
`

const PromptEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 8px;
`

const PromptSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PromptLabel = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-2);
`

const AdvancedLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
`

const AdvancedSettings = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
`
