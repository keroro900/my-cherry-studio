/**
 * 模特换装配置面板
 *
 * 配置模特图片生成的参数，支持多图输入和提示词编辑
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateModelConfig } from '@renderer/store/imageStudio'
import type { UploadFile } from 'antd'
import { Checkbox, Collapse, Input, Radio, Select, Slider, Upload } from 'antd'
import { ImagePlus, User, Wand2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { PromptEnhancer } from '../../common'

const ModelConfigPanel: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const config = useAppSelector((state) => state.imageStudio.modelConfig)
  const [clothesFiles, setClothesFiles] = useState<UploadFile[]>([])
  const [modelFile, setModelFile] = useState<UploadFile | null>(null)

  const handleClothesUpload = useCallback(({ fileList }: { fileList: UploadFile[] }) => {
    setClothesFiles(fileList.slice(0, 3))
  }, [])

  const handleModelUpload = useCallback(({ file }: { file: UploadFile }) => {
    setModelFile(file)
  }, [])

  const handleRemoveClothes = useCallback((index: number) => {
    setClothesFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <Container>
      {/* 服装图片上传 */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <ImagePlus size={16} />
            {t('image_studio.model.clothes_image')}
          </SectionTitle>
          <ImageCount>{clothesFiles.length}/3</ImageCount>
        </SectionHeader>

        <UploadArea>
          {clothesFiles.map((file, index) => (
            <UploadedImage key={file.uid}>
              <img
                src={file.thumbUrl || (file.originFileObj ? URL.createObjectURL(file.originFileObj as Blob) : '')}
                alt=""
              />
              <RemoveButton onClick={() => handleRemoveClothes(index)}>
                <DeleteOutlined />
              </RemoveButton>
              <ImageLabel>
                {index === 0
                  ? t('image_studio.model.top_clothes')
                  : index === 1
                    ? t('image_studio.model.bottom_clothes')
                    : t('image_studio.model.accessory')}
              </ImageLabel>
            </UploadedImage>
          ))}

          {clothesFiles.length < 3 && (
            <Upload
              accept="image/*"
              showUploadList={false}
              multiple
              beforeUpload={() => false}
              onChange={handleClothesUpload}
              fileList={clothesFiles}>
              <AddImageButton>
                <PlusOutlined />
                <span>{t('image_studio.model.add_clothes')}</span>
              </AddImageButton>
            </Upload>
          )}
        </UploadArea>
      </Section>

      {/* 模特参考图（可选） */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <User size={16} />
            {t('image_studio.model.model_reference')}
          </SectionTitle>
          <OptionalTag>{t('image_studio.optional')}</OptionalTag>
        </SectionHeader>

        {modelFile ? (
          <UploadedModelImage>
            <img
              src={
                modelFile.thumbUrl ||
                (modelFile.originFileObj ? URL.createObjectURL(modelFile.originFileObj as Blob) : '')
              }
              alt=""
            />
            <RemoveButton onClick={() => setModelFile(null)}>
              <DeleteOutlined />
            </RemoveButton>
          </UploadedModelImage>
        ) : (
          <Upload.Dragger
            accept="image/*"
            showUploadList={false}
            beforeUpload={() => false}
            onChange={handleModelUpload}>
            <UploadContent>
              <User size={24} />
              <span>{t('image_studio.model.upload_model_ref')}</span>
              <UploadHint>{t('image_studio.model.model_ref_hint')}</UploadHint>
            </UploadContent>
          </Upload.Dragger>
        )}
      </Section>

      {/* 模特设置 */}
      <Section>
        <SectionTitle>{t('image_studio.model.model_settings')}</SectionTitle>

        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.model.age_group')}</FormLabel>
            <Select
              value={config.ageGroup}
              onChange={(value) => dispatch(updateModelConfig({ ageGroup: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: 'small_kid', label: t('image_studio.model.age_small_kid') },
                { value: 'big_kid', label: t('image_studio.model.age_big_kid') },
                { value: 'adult', label: t('image_studio.model.age_adult') }
              ]}
            />
          </FormItem>
          <FormItem>
            <FormLabel>{t('image_studio.model.gender')}</FormLabel>
            <Radio.Group
              value={config.gender}
              onChange={(e) => dispatch(updateModelConfig({ gender: e.target.value }))}
              buttonStyle="solid"
              size="small">
              <Radio.Button value="female">{t('image_studio.model.gender_female')}</Radio.Button>
              <Radio.Button value="male">{t('image_studio.model.gender_male')}</Radio.Button>
            </Radio.Group>
          </FormItem>
        </FormGrid>

        <FormItem style={{ marginTop: 12 }}>
          <FormLabel>{t('image_studio.model.ethnicity')}</FormLabel>
          <Select
            value={config.ethnicity || 'asian'}
            onChange={(value) => dispatch(updateModelConfig({ ethnicity: value }))}
            size="small"
            style={{ width: '100%' }}
            options={[
              { value: 'asian', label: t('image_studio.model.ethnicity_asian') },
              { value: 'caucasian', label: t('image_studio.model.ethnicity_caucasian') },
              { value: 'african', label: t('image_studio.model.ethnicity_african') },
              { value: 'mixed', label: t('image_studio.model.ethnicity_mixed') }
            ]}
          />
        </FormItem>
      </Section>

      {/* 场景与姿态 */}
      <Section>
        <SectionTitle>{t('image_studio.model.scene_pose')}</SectionTitle>
        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.model.scene')}</FormLabel>
            <Select
              value={config.scenePreset}
              onChange={(value) => dispatch(updateModelConfig({ scenePreset: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: 'indoor', label: t('image_studio.model.scene_indoor') },
                { value: 'outdoor', label: t('image_studio.model.scene_outdoor') },
                { value: 'solid', label: t('image_studio.model.scene_solid') },
                { value: 'urban', label: t('image_studio.model.scene_urban') },
                { value: 'studio', label: t('image_studio.model.scene_studio') }
              ]}
            />
          </FormItem>
          <FormItem>
            <FormLabel>{t('image_studio.model.pose')}</FormLabel>
            <Select
              value={config.poseStyle}
              onChange={(value) => dispatch(updateModelConfig({ poseStyle: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: 'natural', label: t('image_studio.model.pose_natural') },
                { value: 'fashion', label: t('image_studio.model.pose_fashion') },
                { value: 'commercial', label: t('image_studio.model.pose_commercial') },
                { value: 'dynamic', label: t('image_studio.model.pose_dynamic') }
              ]}
            />
          </FormItem>
        </FormGrid>
      </Section>

      {/* 图片设置 */}
      <Section>
        <SectionTitle>{t('image_studio.image_settings')}</SectionTitle>
        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.image_size')}</FormLabel>
            <Select
              value={config.imageSize}
              onChange={(value) => dispatch(updateModelConfig({ imageSize: value }))}
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
              onChange={(value) => dispatch(updateModelConfig({ aspectRatio: value }))}
              size="small"
              style={{ width: '100%' }}
              options={[
                { value: '1:1', label: '1:1' },
                { value: '3:4', label: '3:4' },
                { value: '4:3', label: '4:3' },
                { value: '9:16', label: '9:16' },
                { value: '16:9', label: '16:9' }
              ]}
            />
          </FormItem>
        </FormGrid>
      </Section>

      {/* 输出选项 */}
      <Section>
        <SectionTitle>{t('image_studio.model.output_options')}</SectionTitle>
        <CheckboxGroup>
          <Checkbox
            checked={config.keepBackground}
            onChange={(e) => dispatch(updateModelConfig({ keepBackground: e.target.checked }))}>
            {t('image_studio.model.keep_background')}
          </Checkbox>
          <Checkbox
            checked={config.showFullBody}
            onChange={(e) => dispatch(updateModelConfig({ showFullBody: e.target.checked }))}>
            {t('image_studio.model.show_full_body')}
          </Checkbox>
        </CheckboxGroup>
      </Section>

      {/* 提示词编辑器 */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <Wand2 size={16} />
            {t('image_studio.prompt.title')}
          </SectionTitle>
        </SectionHeader>

        <PromptEditor>
          <PromptSection>
            <PromptLabelRow>
              <PromptLabel>{t('image_studio.model.style_desc')}</PromptLabel>
              <PromptEnhancer
                value={config.styleDescription || ''}
                module="model"
                mode="style"
                moduleConfig={config}
                onApply={(enhanced) => dispatch(updateModelConfig({ styleDescription: enhanced }))}
              />
            </PromptLabelRow>
            <Input.TextArea
              value={config.styleDescription || ''}
              onChange={(e) => dispatch(updateModelConfig({ styleDescription: e.target.value }))}
              placeholder={t('image_studio.model.style_desc_placeholder')}
              rows={2}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </PromptSection>

          <PromptSection>
            <PromptLabel>{t('image_studio.prompt.negative')}</PromptLabel>
            <Input.TextArea
              value={config.negativePrompt || ''}
              onChange={(e) => dispatch(updateModelConfig({ negativePrompt: e.target.value }))}
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
                    value={config.batchCount || 1}
                    onChange={(value) => dispatch(updateModelConfig({ batchCount: value }))}
                    marks={{ 1: '1', 4: '4', 8: '8' }}
                  />
                </FormItem>
                <FormItem>
                  <FormLabel>{t('image_studio.seed')}</FormLabel>
                  <Input
                    type="number"
                    value={config.seed || ''}
                    onChange={(e) =>
                      dispatch(updateModelConfig({ seed: e.target.value ? Number(e.target.value) : undefined }))
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

export default ModelConfigPanel

// ============================================================================
// 样式
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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

const OptionalTag = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  padding: 2px 6px;
  background: var(--color-background-soft);
  border-radius: 4px;
`

const UploadArea = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

const UploadedModelImage = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
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
  width: 20px;
  height: 20px;
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

  ${UploadedImage}:hover &,
  ${UploadedModelImage}:hover & {
    opacity: 1;
  }
`

const ImageLabel = styled.span`
  position: absolute;
  bottom: 4px;
  left: 4px;
  padding: 2px 6px;
  font-size: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
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
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const UploadContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-3);
  font-size: 12px;
  padding: 16px;
`

const UploadHint = styled.span`
  font-size: 11px;
  color: var(--color-text-4);
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

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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

const PromptLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
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
