import './FormModal.css'

import { DeleteOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import { Button, Divider, Input, Modal, Tag } from 'antd'
import type { FC, ReactNode } from 'react'
import { useMemo, useState } from 'react'

export interface PresetItem {
  id: string
  name: string
  description?: string
  tags?: string[]
  favorite?: boolean
  scope?: 'base' | 'custom'
}

interface PresetManagerModalProps {
  open: boolean
  title?: string
  basePresets: PresetItem[]
  customPresets?: PresetItem[]
  onSaveCustomPresets: (items: PresetItem[]) => void
  onClose: () => void
}

const PresetManagerModal: FC<PresetManagerModalProps> = ({
  open,
  title = '管理预设',
  basePresets,
  customPresets = [],
  onSaveCustomPresets,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'favorite' | 'tags'>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<PresetItem[]>(customPresets)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createTags, setCreateTags] = useState('')

  const allList: PresetItem[] = useMemo(() => {
    const base = basePresets.map((p) => ({ ...p, scope: 'base' as const }))
    const mine = items.map((p) => ({ ...p, scope: 'custom' as const }))
    return [...mine, ...base]
  }, [basePresets, items])

  const filtered = useMemo(() => {
    let list = allList
    if (activeTab === 'mine') list = list.filter((i) => i.scope === 'custom')
    if (activeTab === 'favorite') list = list.filter((i) => i.favorite)
    if (keyword.trim()) {
      const k = keyword.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(k) ||
          (i.description || '').toLowerCase().includes(k) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(k))
      )
    }
    return list
  }, [allList, activeTab, keyword])

  const toggleFavorite = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)))
  }

  const removePreset = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const addPreset = () => {
    if (!createName.trim()) return
    const id = `custom-${Date.now()}`
    const tags = createTags
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    setItems((prev) => [
      { id, name: createName.trim(), description: createDesc.trim(), tags, favorite: false, scope: 'custom' },
      ...prev
    ])
    setCreating(false)
    setCreateName('')
    setCreateDesc('')
    setCreateTags('')
  }

  const saveAll = () => {
    onSaveCustomPresets(items)
    onClose()
  }

  const TabButton = ({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: active ? '1px solid var(--ant-color-primary)' : '1px solid var(--color-border-mute)',
        background: active ? 'var(--ant-color-primary-bg)' : 'var(--color-bg-soft)',
        color: 'var(--color-text)'
      }}>
      {children}
    </button>
  )

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      keyboard
      maskClosable
      centered
      width={720}
      className="cherry-form-modal"
      destroyOnHidden>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Input
          aria-label="搜索预设"
          placeholder="搜索预设..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)} aria-label="新建预设">
          新建
        </Button>
        <Button onClick={saveAll} aria-label="保存预设">
          保存
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
          全部
        </TabButton>
        <TabButton active={activeTab === 'mine'} onClick={() => setActiveTab('mine')}>
          我的
        </TabButton>
        <TabButton active={activeTab === 'favorite'} onClick={() => setActiveTab('favorite')}>
          收藏
        </TabButton>
        <TabButton active={activeTab === 'tags'} onClick={() => setActiveTab('tags')}>
          风格
        </TabButton>
      </div>
      {creating && (
        <div
          style={{
            padding: 12,
            border: '1px solid var(--color-border-mute)',
            borderRadius: 8,
            background: 'var(--color-bg-soft)',
            marginBottom: 8
          }}>
          <Input placeholder="名称" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          <Input
            placeholder="描述"
            style={{ marginTop: 8 }}
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
          />
          <Input
            placeholder="标签（用逗号或空格分隔）"
            style={{ marginTop: 8 }}
            value={createTags}
            onChange={(e) => setCreateTags(e.target.value)}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={addPreset} aria-label="确认创建">
              确认
            </Button>
            <Button onClick={() => setCreating(false)} aria-label="取消创建">
              取消
            </Button>
          </div>
        </div>
      )}
      <Divider />
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {filtered.map((p) => (
          <div
            key={`${p.scope}-${p.id}`}
            style={{
              padding: 10,
              border: '1px solid var(--color-border-mute)',
              borderRadius: 8,
              background: 'var(--ant-color-bg-elevated)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10
            }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              {p.description && (
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 4 }}>{p.description}</div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {(p.tags || []).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {p.scope === 'base' && <Tag color="blue">内置</Tag>}
                {p.scope === 'custom' && <Tag color="green">我的</Tag>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="text"
                icon={p.favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={() => p.scope === 'custom' && toggleFavorite(p.id)}
                aria-label="收藏预设"
              />
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={() => p.scope === 'custom' && removePreset(p.id)}
                aria-label="删除预设"
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default PresetManagerModal
