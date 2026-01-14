import { useTheme } from '@renderer/context/ThemeProvider'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Sticker {
  id: string
  url: string
  filename: string
  packName: string
}

interface StickerPack {
  name: string
  path: string
  count: number
}

interface Props {
  onStickerSelect: (sticker: Sticker) => void
}

const StickerPicker: FC<Props> = ({ onStickerSelect }) => {
  const { theme } = useTheme()
  const { t } = useTranslation()
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [packs, setPacks] = useState<StickerPack[]>([])
  const [selectedPack, setSelectedPack] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStickers = async () => {
      try {
        setLoading(true)
        const [allStickers, allPacks] = await Promise.all([
          window.api.sticker.getAll(),
          window.api.sticker.getPacks()
        ])
        setStickers(allStickers)
        setPacks(allPacks)
      } catch (error) {
        console.error('Failed to load stickers:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStickers()
  }, [])

  const handleImportPack = useCallback(async () => {
    try {
      const result = await window.api.file.select({
        properties: ['openDirectory']
      })
      if (result && result.length > 0) {
        const sourcePath = result[0].path
        const importResult = await window.api.sticker.importPack(sourcePath)
        if (importResult.success) {
          // Reload stickers and packs
          const [allStickers, allPacks] = await Promise.all([
            window.api.sticker.getAll(),
            window.api.sticker.getPacks()
          ])
          setStickers(allStickers)
          setPacks(allPacks)
        }
      }
    } catch (error) {
      console.error('Failed to import sticker pack:', error)
    }
  }, [])

  const filteredStickers =
    selectedPack === 'all' ? stickers : stickers.filter((s) => s.packName === selectedPack)

  const handleStickerClick = useCallback(
    (sticker: Sticker) => {
      onStickerSelect(sticker)
    },
    [onStickerSelect]
  )

  return (
    <Container className={theme}>
      <Header>
        <PackTabs>
          <PackTab $active={selectedPack === 'all'} onClick={() => setSelectedPack('all')}>
            {t('chat.input.sticker.all', 'All')}
          </PackTab>
          {packs.map((pack) => (
            <PackTab key={pack.name} $active={selectedPack === pack.name} onClick={() => setSelectedPack(pack.name)}>
              {pack.name} ({pack.count})
            </PackTab>
          ))}
        </PackTabs>
        <ImportButton onClick={handleImportPack} title={t('chat.input.sticker.import', 'Import Pack')}>
          +
        </ImportButton>
      </Header>

      <StickerGrid>
        {loading ? (
          <EmptyState>{t('common.loading', 'Loading...')}</EmptyState>
        ) : filteredStickers.length === 0 ? (
          <EmptyState>
            {t('chat.input.sticker.empty', 'No stickers. Click + to import a pack.')}
          </EmptyState>
        ) : (
          filteredStickers.map((sticker) => (
            <StickerItem key={sticker.id} onClick={() => handleStickerClick(sticker)}>
              <StickerImage src={sticker.url} alt={sticker.filename} loading="lazy" />
            </StickerItem>
          ))
        )}
      </StickerGrid>
    </Container>
  )
}

const Container = styled.div`
  width: 320px;
  height: 320px;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-radius: 8px;
  overflow: hidden;

  &.dark {
    background: var(--color-background-soft);
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--color-border);
  gap: 8px;
`

const PackTabs = styled.div`
  display: flex;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  &::-webkit-scrollbar {
    display: none;
  }
`

const PackTab = styled.button<{ $active: boolean }>`
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  color: ${(props) => (props.$active ? 'white' : 'var(--color-text)')};
  cursor: pointer;
  white-space: nowrap;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background-mute)')};
  }
`

const ImportButton = styled.button`
  width: 28px;
  height: 28px;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const StickerGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
  align-content: start;
`

const StickerItem = styled.div`
  aspect-ratio: 1;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
`

const StickerImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`

const EmptyState = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 14px;
  padding: 40px;
  text-align: center;
`

export default StickerPicker
