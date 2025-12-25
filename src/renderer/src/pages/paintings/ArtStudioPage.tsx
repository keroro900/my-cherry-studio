/**
 * Art Studio 绘画页面
 *
 * 使用统一的配置驱动系统
 * - 根据模型自动显示/隐藏参数
 * - 统一的 API 调用格式
 * - 历史记录持久化到 unifiedPaintings store
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Navbar, NavbarCenter, NavbarRight } from '@renderer/components/app/Navbar'
import Scrollbar from '@renderer/components/Scrollbar'
import { isMac } from '@renderer/config/constant'
import { useImageGeneration } from '@renderer/hooks/useImageGeneration'
import { useAllProviders } from '@renderer/hooks/useProvider'
import FileManager from '@renderer/services/FileManager'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setGenerating } from '@renderer/store/runtime'
import {
  addPainting as addUnifiedPainting,
  removePainting as removeUnifiedPainting,
  saveArtStudioForm,
  selectFilteredPaintings
} from '@renderer/store/unifiedPaintings'
import type { UnifiedPainting } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { App, Button, Popconfirm } from 'antd'
import { debounce } from 'lodash'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import ArtStudioCanvas, { type GeneratedImage } from './components/ArtStudioCanvas'
import ArtStudioSidebar from './components/ArtStudioSidebar'
import { canEnhancePrompt, type EnhanceMode, enhancePrompt, getEnhanceModelName } from './services/PromptEnhanceService'

const logger = loggerService.withContext('ArtStudioPage')

// ============================================================================
// 样式组件
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
`

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const RightPanel = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: var(--color-background);
  width: 100px;
  min-width: 100px;
  border-left: 0.5px solid var(--color-border);
  height: calc(100vh - var(--navbar-height));
  overflow-x: hidden;

  @media (min-width: 1400px) {
    width: 120px;
  }

  @media (min-width: 1600px) {
    width: 140px;
  }
`

const CanvasWrapper = styled.div`
  position: relative;

  &:hover {
    .delete-button {
      opacity: 1;
    }
  }
`

const ThumbnailCanvas = styled.div<{ $selected?: boolean }>`
  width: 80px;
  height: 80px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'transparent')};
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: var(--color-background-mute);
    transform: scale(1.02);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (min-width: 1400px) {
    width: 100px;
    height: 100px;
  }

  @media (min-width: 1600px) {
    width: 120px;
    height: 120px;
  }
`

const DeleteButton = styled.div.attrs({ className: 'delete-button' })`
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  color: var(--color-error);
  background-color: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`

const NewButton = styled.div`
  width: 80px;
  height: 80px;
  min-height: 80px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px dashed var(--color-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-2);

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  @media (min-width: 1400px) {
    width: 100px;
    height: 100px;
    min-height: 100px;
  }

  @media (min-width: 1600px) {
    width: 120px;
    height: 120px;
    min-height: 120px;
  }
`

// ============================================================================
// 组件
// ============================================================================

const ArtStudioPage: FC = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const providers = useAllProviders()

  // 从 Redux 获取保存的表单状态和历史记录
  const savedFormState = useAppSelector((state) => state.unifiedPaintings.artStudioForm)
  const persistedPaintings = useAppSelector(selectFilteredPaintings)
  const isInitialized = useRef(false)

  // 模型选择状态（从保存的状态初始化）
  const [providerId, setProviderId] = useState<string>(savedFormState?.providerId || '')
  const [modelId, setModelId] = useState<string>(savedFormState?.modelId || '')

  // 获取当前 provider 和 model
  const { currentProvider, currentModel } = useMemo(() => {
    if (!providerId || !modelId) return { currentProvider: undefined, currentModel: undefined }
    const provider = providers.find((p) => p.id === providerId)
    const model = provider?.models?.find((m) => m.id === modelId)
    return { currentProvider: provider, currentModel: model }
  }, [providerId, modelId, providers])

  // 使用统一的图像生成 Hook（传入保存的初始值）
  const {
    values,
    isGenerating,
    error: _error,
    generatedImages: _hookGeneratedImages,
    setValue,
    setValues,
    generate,
    reset: _reset
  } = useImageGeneration(currentProvider, currentModel, savedFormState?.values)
  // 预留变量，后续可能用于显示错误状态、同步生成图片列表、重置表单
  void _error
  void _hookGeneratedImages
  void _reset

  // 页面状态（从保存的状态初始化）
  const [mode, setMode] = useState<'generate' | 'edit'>(savedFormState?.mode || 'generate')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)

  // 从持久化的 paintings 转换为 GeneratedImage 格式
  const generatedImages = useMemo<GeneratedImage[]>(() => {
    return persistedPaintings
      .filter((p) => p.status === 'success' && (p.files.length > 0 || p.urls.length > 0))
      .map((painting) => ({
        id: painting.id,
        url: painting.files[0]?.path ? FileManager.getFileUrl(painting.files[0]) : painting.urls[0] || '',
        prompt: painting.prompt,
        timestamp: painting.createdAt,
        model: painting.modelName || painting.modelId
      }))
  }, [persistedPaintings])

  // 当 mode 变化时同步到 values 中，确保 useImageGeneration 能正确判断模式
  useEffect(() => {
    if (values.mode !== mode) {
      setValue('mode', mode)
    }
  }, [mode, values.mode, setValue])

  // 防抖保存表单状态到 Redux
  const debouncedSaveForm = useMemo(
    () =>
      debounce(
        (formState: {
          providerId: string
          modelId: string
          mode: 'generate' | 'edit'
          values: Record<string, any>
        }) => {
          dispatch(saveArtStudioForm(formState))
        },
        500
      ),
    [dispatch]
  )

  // 当表单状态变化时保存到 Redux
  useEffect(() => {
    // 跳过初始化阶段
    if (!isInitialized.current) {
      isInitialized.current = true
      return
    }

    debouncedSaveForm({
      providerId,
      modelId,
      mode,
      values
    })

    return () => {
      debouncedSaveForm.cancel()
    }
  }, [providerId, modelId, mode, values, debouncedSaveForm])

  // 处理模型选择
  const handleModelChange = useCallback((newProviderId: string, newModelId: string) => {
    setProviderId(newProviderId)
    setModelId(newModelId)
  }, [])

  // 增强提示词（使用 Cherry Studio 原生模型调用）
  // 根据当前模式（生成/编辑）使用不同的增强策略
  // 编辑模式下会将参考图片一起传入模型，让模型能看到原图来生成更精准的编辑提示词
  const handleEnhancePrompt = useCallback(async () => {
    if (!values.prompt) {
      message.warning('请先输入提示词')
      return
    }

    if (!canEnhancePrompt()) {
      message.warning('请先在设置中配置默认助手模型')
      return
    }

    try {
      const modelName = getEnhanceModelName()
      const enhanceMode: EnhanceMode = mode === 'edit' ? 'edit' : 'generate'
      const modeLabel = mode === 'edit' ? '编辑指令' : '提示词'

      message.loading({ content: `正在使用 ${modelName || '默认模型'} 增强${modeLabel}...`, key: 'enhance' })

      // 获取参考图片（用于编辑模式，让模型能看到原图）
      // 支持单张图片 (values.image) 或多张图片数组 (values.images)
      let referenceImage: string | undefined
      if (mode === 'edit') {
        if (values.image) {
          referenceImage = values.image
        } else if (values.images?.length > 0) {
          // 如果有多张图片，使用第一张作为参考
          referenceImage = values.images[0]
        }
      }

      const enhanced = await enhancePrompt(values.prompt, {
        mode: enhanceMode,
        referenceImage
      })
      setValue('prompt', enhanced)
      message.success({ content: `${modeLabel}已增强`, key: 'enhance' })
    } catch (err) {
      logger.error('Enhance prompt failed:', err instanceof Error ? err : { error: err })
      message.error({ content: `提示词增强失败: ${(err as Error).message}`, key: 'enhance' })
    }
  }, [values.prompt, values.image, values.images, mode, setValue])

  // 生成图片
  const handleGenerate = useCallback(async () => {
    if (!values.prompt) {
      message.warning('请输入提示词')
      return
    }

    if (!modelId || !currentProvider || !currentModel) {
      message.warning('请选择模型')
      return
    }

    dispatch(setGenerating(true))

    try {
      message.loading({ content: '正在生成图片...', key: 'generate' })

      const result = await generate()

      if (result.success && result.images.length > 0) {
        for (const imageUrl of result.images) {
          const imageId = uuid()

          // 保存图片到本地
          let savedFiles: any[] = []
          if (imageUrl.startsWith('data:')) {
            // 移除 data:image/xxx;base64, 前缀
            const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '')
            const savedFile = await window.api.file.saveBase64Image(base64Data)
            if (savedFile) {
              savedFiles = [savedFile]
            }
          }

          // 添加到 unifiedPaintings store（会自动持久化）
          const painting: UnifiedPainting = {
            id: imageId,
            providerId,
            modelId,
            modelName: currentModel.name,
            prompt: values.prompt,
            negativePrompt: values.negative_prompt,
            params: { ...values },
            files: savedFiles,
            urls: imageUrl.startsWith('http') ? [imageUrl] : [],
            status: 'success',
            createdAt: Date.now(),
            completedAt: Date.now(),
            mode: mode === 'edit' ? 'edit' : 'generate'
          }

          dispatch(addUnifiedPainting(painting))
        }

        // 自动选中第一张新生成的图片
        if (generatedImages.length > 0) {
          setSelectedImageId(generatedImages[0].id)
        }
        message.success({ content: `成功生成 ${result.images.length} 张图片`, key: 'generate' })
      } else if (result.error) {
        message.error({ content: `生成失败: ${result.error}`, key: 'generate' })
      }
    } catch (err) {
      logger.error('Generation failed:', err instanceof Error ? err : { error: err })
      message.error({ content: `生成失败: ${(err as Error).message}`, key: 'generate' })
    } finally {
      dispatch(setGenerating(false))
    }
  }, [values, modelId, providerId, currentProvider, currentModel, mode, generate, generatedImages, dispatch])

  // 删除图片（从 unifiedPaintings store 删除，会自动持久化）
  const handleDeleteImage = useCallback(
    (imageId: string) => {
      dispatch(removeUnifiedPainting(imageId))
      if (selectedImageId === imageId) {
        setSelectedImageId(null)
      }
    },
    [selectedImageId, dispatch]
  )

  // 新建画布
  const handleNewCanvas = useCallback(() => {
    setValue('prompt', '')
    setSelectedImageId(null)
  }, [setValue])

  return (
    <PageContainer>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('paintings.title')}</NavbarCenter>
        {isMac && (
          <NavbarRight style={{ justifyContent: 'flex-end' }}>
            <Button size="small" className="nodrag" icon={<PlusOutlined />} onClick={handleNewCanvas}>
              {t('paintings.button.new.image')}
            </Button>
          </NavbarRight>
        )}
      </Navbar>

      <MainContent>
        <ArtStudioSidebar
          providerId={providerId}
          modelId={modelId}
          providers={providers}
          onModelChange={handleModelChange}
          values={values}
          onValueChange={setValue}
          onValuesChange={setValues}
          onGenerate={handleGenerate}
          onEnhancePrompt={handleEnhancePrompt}
          isGenerating={isGenerating}
          mode={mode}
          onModeChange={setMode}
        />

        <ArtStudioCanvas
          images={generatedImages}
          isGenerating={isGenerating}
          batchCount={values.n || 1}
          selectedImageId={selectedImageId}
          onSelectImage={setSelectedImageId}
        />

        {/* 右侧历史图片列表 */}
        <RightPanel>
          <NewButton onClick={handleNewCanvas}>
            <PlusOutlined />
          </NewButton>
          {generatedImages.map((img) => (
            <CanvasWrapper key={img.id}>
              <ThumbnailCanvas $selected={selectedImageId === img.id} onClick={() => setSelectedImageId(img.id)}>
                <img src={img.url} alt="" />
              </ThumbnailCanvas>
              <DeleteButton>
                <Popconfirm
                  title={t('paintings.button.delete.image.confirm')}
                  onConfirm={() => handleDeleteImage(img.id)}
                  okButtonProps={{ danger: true }}
                  placement="left">
                  <DeleteOutlined />
                </Popconfirm>
              </DeleteButton>
            </CanvasWrapper>
          ))}
        </RightPanel>
      </MainContent>
    </PageContainer>
  )
}

export default ArtStudioPage
