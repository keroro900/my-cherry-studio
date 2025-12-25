/**
 * 电商模块配置面板
 *
 * 配置电商图片生成的参数，支持多图输入和提示词编辑
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateEcomConfig } from '@renderer/store/imageStudio'
import { Checkbox, Collapse, Input, Radio, Select, Slider, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { ImagePlus, Sparkles, Wand2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const EcomConfigPanel: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const config = useAppSelector((state) => state.imageStudio.ecomConfig)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const handleUploadChange = useCallback(({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    setFileList(newFileList.slice(0, 6))
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <Container>
      {/* 图片上传区 - 支持多图 */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <ImagePlus size={16} />
            {t('image_studio.ecom.images')}
          </SectionTitle>
          <ImageCount>{fileList.length}/6</ImageCount>
        </SectionHeader>

        <UploadArea>
          {fileList.map((file, index) => (
            <UploadedImage key={file.uid}>
              <img src={file.thumbUrl || (file.originFileObj ? URL.createObjectURL(file.originFileObj as Blob) : '')} alt="" />
              <RemoveButton onClick={() => handleRemoveImage(index)}>
                <DeleteOutlined />
              </RemoveButton>
              <ImageLabel>
                {index === 0 ? t('image_studio.ecom.top_image') : index === 1 ? t('image_studio.ecom.bottom_image') : `图片${index + 1}`}
              </ImageLabel>
            </UploadedImage>
          ))}

          {fileList.length < 6 && (
            <Upload
              accept="image/*"
              showUploadList={false}
              multiple
              beforeUpload={() => false}
              onChange={handleUploadChange}
              fileList={fileList}
            >
              <AddImageButton>
                <PlusOutlined />
                <span>{t('image_studio.ecom.add_image')}</span>
              </AddImageButton>
            </Upload>
          )}
        </UploadArea>
      </Section>

      {/* 布局模式 */}
      <Section>
        <SectionTitle>{t('image_studio.ecom.layout')}</SectionTitle>
        <Radio.Group
          value={config.layout}
          onChange={(e) => dispatch(updateEcomConfig({ layout: e.target.value }))}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="model_shot">{t('image_studio.ecom.layout_model')}</Radio.Button>
          <Radio.Button value="flat_lay">{t('image_studio.ecom.layout_flat')}</Radio.Button>
          <Radio.Button value="hanging">{t('image_studio.ecom.layout_hanging')}</Radio.Button>
        </Radio.Group>
      </Section>

      {/* 风格预设 */}
      <Section>
        <SectionTitle>{t('image_studio.ecom.style')}</SectionTitle>
        <StyleGrid>
          {['auto', 'shein', 'temu', 'minimal', 'premium'].map((style) => (
            <StyleOption
              key={style}
              $active={config.stylePreset === style}
              onClick={() => dispatch(updateEcomConfig({ stylePreset: style }))}
            >
              {style === 'auto' ? t('image_studio.ecom.style_auto') :
               style === 'minimal' ? t('image_studio.ecom.style_minimal') :
               style === 'premium' ? t('image_studio.ecom.style_premium') : style.toUpperCase()}
            </StyleOption>
          ))}
        </StyleGrid>
      </Section>

      {/* 图片设置 */}
      <Section>
        <SectionTitle>{t('image_studio.image_settings')}</SectionTitle>
        <FormGrid>
          <FormItem>
            <FormLabel>{t('image_studio.image_size')}</FormLabel>
            <Select
              value={config.imageSize}
              onChange={(value) => dispatch(updateEcomConfig({ imageSize: value }))}
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
              onChange={(value) => dispatch(updateEcomConfig({ aspectRatio: value }))}
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
        <SectionTitle>{t('image_studio.ecom.output_options')}</SectionTitle>
        <CheckboxGroup>
          <Checkbox
            checked={config.enableBack}
            onChange={(e) => dispatch(updateEcomConfig({ enableBack: e.target.checked }))}
          >
            {t('image_studio.ecom.enable_back')}
          </Checkbox>
          <Checkbox
            checked={config.enableDetail}
            onChange={(e) => dispatch(updateEcomConfig({ enableDetail: e.target.checked }))}
          >
            {t('image_studio.ecom.enable_detail')}
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
          <PromptActions>
            <ActionButton title={t('image_studio.prompt.optimize')}>
              <Sparkles size={14} />
            </ActionButton>
          </PromptActions>
        </SectionHeader>

        <PromptEditor>
          <PromptSection>
            <PromptLabel>{t('image_studio.prompt.system')}</PromptLabel>
            <Input.TextArea
              value={config.systemPrompt || ''}
              onChange={(e) => dispatch(updateEcomConfig({ systemPrompt: e.target.value }))}
              placeholder={t('image_studio.prompt.system_placeholder')}
              rows={2}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </PromptSection>

          <PromptSection>
            <PromptLabel>{t('image_studio.ecom.garment_desc')}</PromptLabel>
            <Input.TextArea
              value={config.garmentDescription}
              onChange={(e) => dispatch(updateEcomConfig({ garmentDescription: e.target.value }))}
              placeholder={t('image_studio.ecom.garment_desc_placeholder')}
              rows={3}
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </PromptSection>

          <PromptSection>
            <PromptLabel>{t('image_studio.prompt.negative')}</PromptLabel>
            <Input.TextArea
              value={config.negativePrompt || ''}
              onChange={(e) => dispatch(updateEcomConfig({ negativePrompt: e.target.value }))}
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
                    onChange={(value) => dispatch(updateEcomConfig({ batchCount: value }))}
                    marks={{ 1: '1', 4: '4', 8: '8' }}
                  />
                </FormItem>
                <FormItem>
                  <FormLabel>{t('image_studio.seed')}</FormLabel>
                  <Input
                    type="number"
                    value={config.seed || ''}
                    onChange={(e) => dispatch(updateEcomConfig({ seed: e.target.value ? Number(e.target.value) : undefined }))}
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

export default EcomConfigPanel

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

  ${UploadedImage}:hover & {
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

const StyleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
`

const StyleOption = styled.div<{ $active: boolean }>`
  padding: 8px 12px;
  text-align: center;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) => (props.$active ? 'var(--color-primary-soft)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-2)')};

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

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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
