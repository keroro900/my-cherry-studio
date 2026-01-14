/**
 * VectorBackendSettings - 向量数据库后端选择组件
 *
 * 允许用户在不同的向量数据库后端之间切换:
 * - libsql: SQLite 持久化存储 (默认)
 * - usearch: USearch npm 预编译高性能索引
 * - vexus: Rust 原生 (vexus-lite) 最高性能
 * - memory: 内存存储 (开发测试用)
 */

import { InfoTooltip } from '@renderer/components/TooltipIcons'
import { Alert, Radio, Space } from 'antd'
import type { RadioChangeEvent } from 'antd/es/radio'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export type VectorBackendType = 'libsql' | 'usearch' | 'vexus' | 'memory'

interface VectorBackendSettingsProps {
  value?: VectorBackendType
  onChange?: (value: VectorBackendType) => void
  disabled?: boolean
}

/**
 * 后端选项定义
 */
const BACKEND_OPTIONS: Array<{
  value: VectorBackendType
  label: string
  labelKey: string
  description: string
  descriptionKey: string
  performance: 'low' | 'medium' | 'high'
  persistent: boolean
}> = [
  {
    value: 'libsql',
    label: 'LibSQL',
    labelKey: 'memory.vector_backend.libsql',
    description: 'SQLite persistent storage, good compatibility',
    descriptionKey: 'memory.vector_backend.libsql_desc',
    performance: 'medium',
    persistent: true
  },
  {
    value: 'usearch',
    label: 'USearch',
    labelKey: 'memory.vector_backend.usearch',
    description: 'High-performance HNSW, npm prebuilt binaries',
    descriptionKey: 'memory.vector_backend.usearch_desc',
    performance: 'high',
    persistent: true
  },
  {
    value: 'vexus',
    label: 'Vexus',
    labelKey: 'memory.vector_backend.vexus',
    description: 'Rust native (vexus-lite), highest performance',
    descriptionKey: 'memory.vector_backend.vexus_desc',
    performance: 'high',
    persistent: true
  },
  {
    value: 'memory',
    label: 'Memory',
    labelKey: 'memory.vector_backend.memory',
    description: 'In-memory storage, for development/testing',
    descriptionKey: 'memory.vector_backend.memory_desc',
    performance: 'high',
    persistent: false
  }
]

const VectorBackendSettings: FC<VectorBackendSettingsProps> = ({ value = 'libsql', onChange, disabled = false }) => {
  const { t } = useTranslation()

  const handleChange = (e: RadioChangeEvent) => {
    onChange?.(e.target.value as VectorBackendType)
  }

  // 获取翻译文本，如果没有则使用默认值
  const getLabel = (option: (typeof BACKEND_OPTIONS)[0]) => {
    const translated = t(option.labelKey, { defaultValue: '' })
    return translated || option.label
  }

  const getDescription = (option: (typeof BACKEND_OPTIONS)[0]) => {
    const translated = t(option.descriptionKey, { defaultValue: '' })
    return translated || option.description
  }

  // 性能标签颜色
  const getPerformanceColor = (performance: 'low' | 'medium' | 'high') => {
    switch (performance) {
      case 'high':
        return 'var(--color-success)'
      case 'medium':
        return 'var(--color-warning)'
      case 'low':
        return 'var(--color-error)'
    }
  }

  return (
    <Container>
      <HeaderRow>
        <Label>
          {t('memory.vector_backend.title', { defaultValue: 'Vector Backend' })}
          <InfoTooltip
            title={t('memory.vector_backend.tooltip', {
              defaultValue: 'Select vector database backend. Changing this will require rebuilding the index.'
            })}
          />
        </Label>
      </HeaderRow>

      <StyledAlert
        message={t('memory.vector_backend.warning', {
          defaultValue: 'Switching backend will require rebuilding the index'
        })}
        type="warning"
        showIcon
        banner
      />

      <Radio.Group value={value} onChange={handleChange} disabled={disabled} style={{ width: '100%' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {BACKEND_OPTIONS.map((option) => (
            <OptionCard key={option.value} $selected={value === option.value}>
              <Radio value={option.value}>
                <OptionContent>
                  <OptionHeader>
                    <OptionLabel>{getLabel(option)}</OptionLabel>
                    <OptionBadges>
                      <PerformanceBadge $color={getPerformanceColor(option.performance)}>
                        {option.performance === 'high' ? '🚀' : option.performance === 'medium' ? '⚡' : '🐢'}
                        {t(`memory.vector_backend.performance_${option.performance}`, {
                          defaultValue: option.performance
                        })}
                      </PerformanceBadge>
                      {option.persistent ? (
                        <PersistentBadge>
                          💾 {t('memory.vector_backend.persistent', { defaultValue: 'Persistent' })}
                        </PersistentBadge>
                      ) : (
                        <VolatileBadge>
                          ⚠️ {t('memory.vector_backend.volatile', { defaultValue: 'Volatile' })}
                        </VolatileBadge>
                      )}
                    </OptionBadges>
                  </OptionHeader>
                  <OptionDescription>{getDescription(option)}</OptionDescription>
                </OptionContent>
              </Radio>
            </OptionCard>
          ))}
        </Space>
      </Radio.Group>
    </Container>
  )
}

// Styled components
const Container = styled.div`
  width: 100%;
`

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
`

const Label = styled.div`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 16px;

  .ant-alert-message {
    font-size: 12px;
  }
`

const OptionCard = styled.div<{ $selected: boolean }>`
  padding: 12px 16px;
  border: 1px solid ${(props) => (props.$selected ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  background: ${(props) => (props.$selected ? 'var(--color-primary-bg)' : 'var(--color-background)')};
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  .ant-radio-wrapper {
    width: 100%;
    align-items: flex-start;
  }
`

const OptionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 8px;
`

const OptionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

const OptionLabel = styled.span`
  font-weight: 500;
  font-size: 14px;
`

const OptionBadges = styled.div`
  display: flex;
  gap: 6px;
`

const PerformanceBadge = styled.span<{ $color: string }>`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${(props) => props.$color}20;
  color: ${(props) => props.$color};
  display: flex;
  align-items: center;
  gap: 2px;
`

const PersistentBadge = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-success-bg);
  color: var(--color-success);
`

const VolatileBadge = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
`

const OptionDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
`

export default VectorBackendSettings
