/**
 * RAG-Tags 标签管理组件
 *
 * 功能:
 * - 标签列表展示
 * - 标签创建/编辑/删除
 * - 标签关系可视化
 * - 语义组管理
 */

import React, { useCallback, useState } from 'react'
import styled from 'styled-components'

import type { RAGTag, SemanticGroup } from './types'

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
`

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`

const AddButton = styled.button`
  padding: 6px 12px;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
`

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid var(--color-border);
`

const Tab = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 12px;
  font-size: 14px;
  border: none;
  border-bottom: 2px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
  background: transparent;
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-secondary)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary);
  }
`

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`

const TagGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`

const TagCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`

const TagHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const TagColor = styled.div<{ $color: string }>`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: ${(props) => props.$color};
`

const TagName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
`

const TagCount = styled.span`
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
`

const TagRelated = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
`

const RelatedTag = styled.span`
  padding: 2px 6px;
  font-size: 11px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  color: var(--color-text-secondary);
`

const SemanticGroupCard = styled.div`
  padding: 16px;
  margin-bottom: 12px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
`

const GroupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

const GroupName = styled.h4`
  margin: 0;
  font-size: 15px;
  font-weight: 500;
`

const GroupCategory = styled.span`
  padding: 2px 8px;
  font-size: 11px;
  background: var(--color-primary);
  color: white;
  border-radius: 10px;
`

const GroupWeight = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const KeywordList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const Keyword = styled.span`
  padding: 4px 10px;
  font-size: 13px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
`

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
`

const ModalContent = styled.div`
  width: 400px;
  padding: 24px;
  background: var(--color-bg-primary);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
`

const ModalTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 18px;
`

const FormGroup = styled.div`
  margin-bottom: 16px;
`

const FormLabel = styled.label`
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
`

const FormInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-soft);
  color: var(--color-text-primary);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const FormTextarea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-soft);
  color: var(--color-text-primary);
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const ColorPicker = styled.div`
  display: flex;
  gap: 8px;
`

const ColorOption = styled.button<{ $color: string; $selected?: boolean }>`
  width: 28px;
  height: 28px;
  border: 2px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'transparent')};
  border-radius: 6px;
  background: ${(props) => props.$color};
  cursor: pointer;
`

const ModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
`

const ModalButton = styled.button<{ $primary?: boolean }>`
  padding: 8px 16px;
  font-size: 14px;
  border: 1px solid ${(props) => (props.$primary ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 6px;
  background: ${(props) => (props.$primary ? 'var(--color-primary)' : 'transparent')};
  color: ${(props) => (props.$primary ? 'white' : 'var(--color-text-primary)')};
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--color-text-secondary);
`

// ==================== 颜色选项 ====================

const TAG_COLORS = [
  '#1890ff', // 蓝色
  '#52c41a', // 绿色
  '#faad14', // 黄色
  '#f5222d', // 红色
  '#722ed1', // 紫色
  '#eb2f96', // 粉色
  '#13c2c2', // 青色
  '#fa8c16' // 橙色
]

// ==================== 组件 ====================

interface RAGTagsManagerProps {
  tags: RAGTag[]
  semanticGroups: SemanticGroup[]
  onCreateTag?: (tag: Omit<RAGTag, 'id' | 'count' | 'relatedTags'>) => void
  onUpdateTag?: (tag: RAGTag) => void
  onDeleteTag?: (tagId: string) => void
  onCreateGroup?: (group: Omit<SemanticGroup, 'id'>) => void
  onUpdateGroup?: (group: SemanticGroup) => void
  onDeleteGroup?: (groupId: string) => void
  className?: string
}

export const RAGTagsManager: React.FC<RAGTagsManagerProps> = ({
  tags,
  semanticGroups,
  onCreateTag,
  onUpdateTag: _onUpdateTag,
  onDeleteTag: _onDeleteTag,
  onCreateGroup,
  onUpdateGroup: _onUpdateGroup,
  onDeleteGroup: _onDeleteGroup,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'groups'>('tags')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'tag' | 'group'>('tag')

  // 表单状态
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(TAG_COLORS[0])
  const [groupName, setGroupName] = useState('')
  const [groupCategory, setGroupCategory] = useState('')
  const [groupKeywords, setGroupKeywords] = useState('')
  const [groupWeight, setGroupWeight] = useState('1.0')

  // 打开创建标签弹窗
  const handleAddTag = useCallback(() => {
    setModalType('tag')
    setTagName('')
    setTagColor(TAG_COLORS[0])
    setShowModal(true)
  }, [])

  // 打开创建语义组弹窗
  const handleAddGroup = useCallback(() => {
    setModalType('group')
    setGroupName('')
    setGroupCategory('')
    setGroupKeywords('')
    setGroupWeight('1.0')
    setShowModal(true)
  }, [])

  // 提交表单
  const handleSubmit = useCallback(() => {
    if (modalType === 'tag') {
      if (tagName.trim()) {
        onCreateTag?.({ name: tagName.trim(), color: tagColor })
      }
    } else {
      if (groupName.trim() && groupKeywords.trim()) {
        onCreateGroup?.({
          name: groupName.trim(),
          category: groupCategory.trim() || 'custom',
          keywords: groupKeywords
            .split(/[,，\n]/)
            .map((k) => k.trim())
            .filter(Boolean),
          weight: parseFloat(groupWeight) || 1.0
        })
      }
    }
    setShowModal(false)
  }, [modalType, tagName, tagColor, groupName, groupCategory, groupKeywords, groupWeight, onCreateTag, onCreateGroup])

  return (
    <Container className={className}>
      <Header>
        <Title>RAG 标签管理</Title>
        <AddButton onClick={activeTab === 'tags' ? handleAddTag : handleAddGroup}>
          + 新建{activeTab === 'tags' ? '标签' : '语义组'}
        </AddButton>
      </Header>

      <TabBar>
        <Tab $active={activeTab === 'tags'} onClick={() => setActiveTab('tags')}>
          标签 ({tags.length})
        </Tab>
        <Tab $active={activeTab === 'groups'} onClick={() => setActiveTab('groups')}>
          语义组 ({semanticGroups.length})
        </Tab>
      </TabBar>

      <Content>
        {activeTab === 'tags' ? (
          tags.length === 0 ? (
            <EmptyState>
              <div>暂无标签</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>点击"新建标签"添加第一个标签</div>
            </EmptyState>
          ) : (
            <TagGrid>
              {tags.map((tag) => (
                <TagCard key={tag.id}>
                  <TagHeader>
                    <TagColor $color={tag.color} />
                    <TagName>{tag.name}</TagName>
                    <TagCount>{tag.count} 条</TagCount>
                  </TagHeader>
                  {tag.relatedTags.length > 0 && (
                    <TagRelated>
                      {tag.relatedTags.slice(0, 5).map((rt) => (
                        <RelatedTag key={rt}>{rt}</RelatedTag>
                      ))}
                      {tag.relatedTags.length > 5 && <RelatedTag>+{tag.relatedTags.length - 5}</RelatedTag>}
                    </TagRelated>
                  )}
                </TagCard>
              ))}
            </TagGrid>
          )
        ) : semanticGroups.length === 0 ? (
          <EmptyState>
            <div>暂无语义组</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>语义组用于将相关关键词分组，提升检索效果</div>
          </EmptyState>
        ) : (
          semanticGroups.map((group) => (
            <SemanticGroupCard key={group.id}>
              <GroupHeader>
                <GroupName>{group.name}</GroupName>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <GroupCategory>{group.category}</GroupCategory>
                  <GroupWeight>权重: {group.weight}</GroupWeight>
                </div>
              </GroupHeader>
              <KeywordList>
                {group.keywords.map((kw, i) => (
                  <Keyword key={i}>{kw}</Keyword>
                ))}
              </KeywordList>
            </SemanticGroupCard>
          ))
        )}
      </Content>

      {/* 创建弹窗 */}
      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>新建{modalType === 'tag' ? '标签' : '语义组'}</ModalTitle>

            {modalType === 'tag' ? (
              <>
                <FormGroup>
                  <FormLabel>标签名称</FormLabel>
                  <FormInput
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="输入标签名称"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>标签颜色</FormLabel>
                  <ColorPicker>
                    {TAG_COLORS.map((color) => (
                      <ColorOption
                        key={color}
                        $color={color}
                        $selected={tagColor === color}
                        onClick={() => setTagColor(color)}
                      />
                    ))}
                  </ColorPicker>
                </FormGroup>
              </>
            ) : (
              <>
                <FormGroup>
                  <FormLabel>语义组名称</FormLabel>
                  <FormInput
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="例如: color_warm"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>分类</FormLabel>
                  <FormInput
                    type="text"
                    value={groupCategory}
                    onChange={(e) => setGroupCategory(e.target.value)}
                    placeholder="例如: color, pattern, style"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>关键词 (逗号分隔)</FormLabel>
                  <FormTextarea
                    value={groupKeywords}
                    onChange={(e) => setGroupKeywords(e.target.value)}
                    placeholder="红色, 橙色, 黄色, coral, burgundy"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>权重</FormLabel>
                  <FormInput
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={groupWeight}
                    onChange={(e) => setGroupWeight(e.target.value)}
                  />
                </FormGroup>
              </>
            )}

            <ModalButtons>
              <ModalButton onClick={() => setShowModal(false)}>取消</ModalButton>
              <ModalButton $primary onClick={handleSubmit}>
                创建
              </ModalButton>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}
    </Container>
  )
}

export default RAGTagsManager
