/**
 * TavernManagement - 角色卡管理组件
 *
 * 提供 Tavern 角色卡的导入、列表、激活、删除等功能
 * 集成到 VCP Dashboard
 */

import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  HeartFilled,
  HeartOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Empty,
  List,
  message,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CharacterCardEditor from './CharacterCardEditor'
import type { CharacterCard, CharacterCardListItem } from './types'
import { useCharacterCards } from './useCharacterCards'
import { VCPTavernEditor } from '../panels'

const { Title, Text, Paragraph } = Typography

// 存储路径提示 (用户数据目录下)
const STORAGE_PATH_HINT = 'tavern/cards/'

/**
 * Tavern 管理主组件
 */
const TavernManagement: FC = () => {
  const { t } = useTranslation()
  const {
    cards,
    activeCard,
    loading,
    error,
    refreshCards,
    importCard,
    activateCard,
    deactivateCard,
    deleteCard,
    toggleFavorite,
    getCard,
    updateCard
  } = useCharacterCards()

  const [importing, setImporting] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [showStoragePath, setShowStoragePath] = useState(false)

  // 编辑器状态
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingCard, setEditingCard] = useState<CharacterCard | null>(null)

  // 标签页状态
  const [activeTab, setActiveTab] = useState<'characters' | 'presets'>('characters')

  /**
   * 处理文件导入
   */
  const handleImport = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning(t('vcp.tavern.import.selectFile', '请选择文件'))
      return
    }

    setImporting(true)

    try {
      const file = fileList[0]
      const filePath = (file as any).path || file.name

      // 判断文件类型
      const isPng = filePath.toLowerCase().endsWith('.png')
      const isJson = filePath.toLowerCase().endsWith('.json')

      if (!isPng && !isJson) {
        message.error(t('vcp.tavern.import.unsupportedFormat', '不支持的文件格式，请选择 PNG 或 JSON 文件'))
        return
      }

      const result = await importCard({
        source: isPng ? 'png' : 'json',
        path: filePath,
        saveOriginalPng: isPng
      })

      if (result) {
        message.success(t('vcp.tavern.import.success', `成功导入角色卡: ${result.name}`))
        setImportModalVisible(false)
        setFileList([])
      }
    } catch (err) {
      message.error(t('vcp.tavern.import.failed', '导入失败'))
    } finally {
      setImporting(false)
    }
  }, [fileList, importCard, t])

  /**
   * 处理激活/停用
   */
  const handleToggleActive = useCallback(
    async (card: CharacterCardListItem) => {
      if (activeCard?.id === card.id) {
        await deactivateCard()
        message.info(t('vcp.tavern.deactivated', `已停用角色: ${card.name}`))
      } else {
        const success = await activateCard(card.id)
        if (success) {
          message.success(t('vcp.tavern.activated', `已激活角色: ${card.name}`))
        }
      }
    },
    [activeCard, activateCard, deactivateCard, t]
  )

  /**
   * 处理删除
   */
  const handleDelete = useCallback(
    async (card: CharacterCardListItem) => {
      const success = await deleteCard(card.id)
      if (success) {
        message.success(t('vcp.tavern.deleted', `已删除角色: ${card.name}`))
      }
    },
    [deleteCard, t]
  )

  /**
   * 处理收藏切换
   */
  const handleToggleFavorite = useCallback(
    async (card: CharacterCardListItem) => {
      await toggleFavorite(card.id)
    },
    [toggleFavorite]
  )

  /**
   * 打开编辑器
   */
  const handleOpenEditor = useCallback(
    async (card: CharacterCardListItem) => {
      const fullCard = await getCard(card.id)
      if (fullCard) {
        setEditingCard(fullCard)
        setEditorVisible(true)
      } else {
        message.error(t('vcp.tavern.editor.loadFailed', '加载角色卡失败'))
      }
    },
    [getCard, t]
  )

  /**
   * 关闭编辑器
   */
  const handleCloseEditor = useCallback(() => {
    setEditorVisible(false)
    setEditingCard(null)
  }, [])

  /**
   * 渲染卡片项
   */
  const renderCardItem = (card: CharacterCardListItem) => {
    const isActive = activeCard?.id === card.id

    return (
      <CardItem $active={isActive}>
        <List.Item
          actions={[
            <Tooltip
              key="favorite"
              title={card.favorite ? t('vcp.tavern.unfavorite', '取消收藏') : t('vcp.tavern.favorite', '收藏')}>
              <Button
                type="text"
                icon={card.favorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                onClick={() => handleToggleFavorite(card)}
              />
            </Tooltip>,
            <Tooltip
              key="activate"
              title={isActive ? t('vcp.tavern.deactivate', '停用') : t('vcp.tavern.activate', '激活')}>
              <Button
                type="text"
                icon={
                  isActive ? (
                    <StopOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <PlayCircleOutlined style={{ color: '#52c41a' }} />
                  )
                }
                onClick={() => handleToggleActive(card)}
              />
            </Tooltip>,
            <Tooltip key="edit" title={t('vcp.tavern.edit', '编辑')}>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenEditor(card)} />
            </Tooltip>,
            <Popconfirm
              key="delete"
              title={t('vcp.tavern.confirmDelete', '确定删除此角色卡？')}
              onConfirm={() => handleDelete(card)}
              okText={t('common.confirm', '确定')}
              cancelText={t('common.cancel', '取消')}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ]}>
          <List.Item.Meta
            avatar={
              card.avatar ? (
                <Avatar src={`file://${card.avatar}`} size={48} />
              ) : (
                <Avatar size={48} style={{ backgroundColor: '#1890ff' }}>
                  {card.name.charAt(0).toUpperCase()}
                </Avatar>
              )
            }
            title={
              <Space>
                <Text strong>{card.name}</Text>
                {isActive && <Tag color="green">{t('vcp.tavern.active', '已激活')}</Tag>}
                <Tag>{card.spec === 'chara_card_v2' ? 'V2' : 'V3'}</Tag>
              </Space>
            }
            description={
              <Space direction="vertical" size={0}>
                {card.creator && (
                  <Text type="secondary">
                    {t('vcp.tavern.creator', '创作者')}: {card.creator}
                  </Text>
                )}
                {card.tags && card.tags.length > 0 && (
                  <Space size={4} wrap>
                    {card.tags.slice(0, 5).map((tag) => (
                      <Tag key={tag} style={{ margin: 0 }}>
                        {tag}
                      </Tag>
                    ))}
                    {card.tags.length > 5 && <Tag>+{card.tags.length - 5}</Tag>}
                  </Space>
                )}
                {card.usageCount !== undefined && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('vcp.tavern.usageCount', '使用次数')}: {card.usageCount}
                  </Text>
                )}
              </Space>
            }
          />
        </List.Item>
      </CardItem>
    )
  }

  return (
    <Container>
      {/* 头部 */}
      <Header>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('vcp.tavern.title', 'Tavern 酒馆')}
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0' }}>
            {t('vcp.tavern.description', '管理角色卡、世界书和注入预设')}
          </Paragraph>
        </div>
      </Header>

      {/* 标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'characters' | 'presets')}
        items={[
          {
            key: 'characters',
            label: (
              <span>
                <UserOutlined />
                {t('vcp.tavern.tabs.characters', '角色卡')}
              </span>
            ),
            children: (
              <TabContent>
                {/* 当前激活的角色卡 */}
                {activeCard && (
                  <ActiveCardSection>
                    <Card size="small" title={t('vcp.tavern.currentActive', '当前激活角色')}>
                      <Space>
                        {activeCard.avatar ? (
                          <Avatar src={`file://${activeCard.avatar}`} size={40} />
                        ) : (
                          <Avatar size={40} style={{ backgroundColor: '#52c41a' }}>
                            {activeCard.name.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                        <div>
                          <Text strong>{activeCard.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {activeCard.data?.personality?.slice(0, 50)}
                            {activeCard.data?.personality && activeCard.data.personality.length > 50 ? '...' : ''}
                          </Text>
                        </div>
                        <Button type="primary" danger size="small" icon={<StopOutlined />} onClick={deactivateCard}>
                          {t('vcp.tavern.deactivate', '停用')}
                        </Button>
                      </Space>
                    </Card>
                  </ActiveCardSection>
                )}

                {/* 错误提示 */}
                {error && (
                  <ErrorMessage>
                    <Text type="danger">{error}</Text>
                  </ErrorMessage>
                )}

                {/* 操作按钮 */}
                <ActionBar>
                  <Space>
                    <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                      {t('vcp.tavern.import.button', '导入角色卡')}
                    </Button>
                    <Button onClick={refreshCards} loading={loading}>
                      {t('common.refresh', '刷新')}
                    </Button>
                    <StorageHint onClick={() => setShowStoragePath(!showStoragePath)}>
                      <Tooltip title={t('vcp.tavern.storagePath', '查看存储位置')}>
                        <FolderOpenOutlined />
                      </Tooltip>
                    </StorageHint>
                  </Space>
                </ActionBar>
                {showStoragePath && (
                  <StoragePathText>
                    {t('vcp.tavern.storageLocation', '存储位置')}: [userData]/{STORAGE_PATH_HINT}
                  </StoragePathText>
                )}

                {/* 角色卡列表 */}
                <CardListContainer>
                  {loading && cards.length === 0 ? (
                    <LoadingContainer>
                      <Spin size="large" />
                    </LoadingContainer>
                  ) : cards.length === 0 ? (
                    <Empty description={t('vcp.tavern.empty', '暂无角色卡')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                      <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                        {t('vcp.tavern.import.button', '导入角色卡')}
                      </Button>
                    </Empty>
                  ) : (
                    <List dataSource={cards} renderItem={renderCardItem} loading={loading} />
                  )}
                </CardListContainer>
              </TabContent>
            )
          },
          {
            key: 'presets',
            label: (
              <span>
                <ThunderboltOutlined />
                {t('vcp.tavern.tabs.presets', '注入预设')}
              </span>
            ),
            children: <VCPTavernEditor />
          }
        ]}
      />

      {/* 导入对话框 */}
      <Modal
        title={t('vcp.tavern.import.title', '导入角色卡')}
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false)
          setFileList([])
        }}
        confirmLoading={importing}
        okText={t('vcp.tavern.import.confirm', '导入')}
        cancelText={t('common.cancel', '取消')}>
        <ImportContent>
          <Paragraph type="secondary">
            {t('vcp.tavern.import.hint', '支持 SillyTavern 格式的 PNG 角色卡或 JSON 文件')}
          </Paragraph>
          <Upload.Dragger
            accept=".png,.json"
            fileList={fileList}
            beforeUpload={(file) => {
              setFileList([file as any])
              return false // 阻止自动上传
            }}
            onRemove={() => {
              setFileList([])
            }}
            maxCount={1}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{t('vcp.tavern.import.dragText', '点击或拖拽文件到此处')}</p>
            <p className="ant-upload-hint">{t('vcp.tavern.import.supportText', '支持 .png 和 .json 格式')}</p>
          </Upload.Dragger>
        </ImportContent>
      </Modal>

      {/* 角色卡编辑器 */}
      <CharacterCardEditor card={editingCard} visible={editorVisible} onClose={handleCloseEditor} onSave={updateCard} />
    </Container>
  )
}

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`

const ActiveCardSection = styled.div`
  margin-bottom: 16px;

  .ant-card {
    background: var(--color-background-soft);
    border-color: var(--color-primary);
  }
`

const ErrorMessage = styled.div`
  padding: 8px 16px;
  margin-bottom: 16px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
`

const CardListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 16px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const CardItem = styled.div<{ $active?: boolean }>`
  background: var(--color-background);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 8px 16px;
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }

  .ant-list-item {
    padding: 8px 0;
    border-bottom: none;
  }
`

const ImportContent = styled.div`
  .ant-upload-drag {
    background: var(--color-background-soft);
    border-color: var(--color-border);

    &:hover {
      border-color: var(--color-primary);
    }
  }
`

const StorageHint = styled.span`
  margin-left: 8px;
  opacity: 0.4;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`

const StoragePathText = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 4px;
  font-family: monospace;
  opacity: 0.6;
`

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

export default TavernManagement
