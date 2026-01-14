# 编码限制和规范

> **目的**: 防止代码重复和架构混乱，确保新代码遵循统一规范

---

## 记忆系统编码规范

### 1. 禁止创建新的"统一"入口

当前已有 **7 个** 统一入口类，**严禁** 创建更多：

```typescript
// ❌ 禁止
class UnifiedNewService { }
class IntegratedNewManager { }
class MasterNewCoordinator { }
class NewMemoryService { }

// ✅ 正确 - 使用现有入口
import { getIntegratedMemoryCoordinator } from '@main/services/memory/IntegratedMemoryCoordinator'
const coordinator = getIntegratedMemoryCoordinator()
```

**推荐入口**:
| 场景 | 使用 |
|------|------|
| 记忆检索/存储 | `IntegratedMemoryCoordinator` |
| VCP 服务调用 | `VCPMemoryAdapter` |
| 底层存储 | `MemoryService` |

### 2. RRF 算法必须复用

**唯一来源**: `src/main/memory/utils/RRFUtils.ts`

```typescript
// ✅ 正确
import { rrfFuse, weightedRRFFuse, calculateRRFScore } from '@main/memory/utils/RRFUtils'

const fusedResults = rrfFuse(resultsArray, { k: 60 })

// ❌ 错误 - 不要重复实现
function myApplyRRF(results: any[]) {
  // 自己实现 RRF... 禁止！
}
```

### 3. 类型定义必须统一

**唯一来源**: `src/main/memory/types/index.ts`

```typescript
// ✅ 正确
import type { MemoryEntry, MemoryType, RetrievalMode } from '@main/memory/types'

// ❌ 错误 - 不要重新定义
interface MemoryEntry {
  id: string
  content: string
  // ... 禁止！
}
```

### 4. IPC Handler 注册规范

**禁止创建新的独立 Handler 文件**

新增 IPC 必须通过 `MemoryIpcModule` 注册：

```typescript
// ✅ 正确 - 在 MemoryIpcModule.ts 中添加
// src/main/services/memory/MemoryIpcModule.ts
const modules = [
  { name: 'AdvancedMemory', register: registerAdvancedMemoryIpcHandlers },
  { name: 'UnifiedMemory', register: registerUnifiedMemoryIpcHandlers },
  // 新增在这里...
  { name: 'NewFeature', register: registerNewFeatureIpcHandlers }
]

// ❌ 错误 - 不要创建新的顶层 Handler 文件
// src/main/services/NewFeatureIpcHandler.ts  <- 禁止！
```

---

## 废弃代码处理

### @deprecated 标记的代码

1. **不要在新代码中引用** `@deprecated` 模块
2. **使用注释中建议的替代方案**
3. **参考迁移指南进行重构**

```typescript
// ❌ 错误 - 引用已废弃模块
import { LightMemoService } from '@main/services/vcp/BuiltinServices/LightMemoService'

// ✅ 正确 - 使用替代方案
import { VCPMemoryAdapter } from '@main/memory/adapters/VCPMemoryAdapter'
```

### VCP BuiltinServices 废弃列表

| 废弃服务 | 替代方案 | 迁移方式 |
|---------|---------|---------|
| `LightMemoService.ts` | `VCPMemoryAdapter.lightMemoSearch()` | 直接替换 |
| `DeepMemoService.ts` | `DeepMemoRetriever.retrieve()` | 直接替换 |
| `MemoryMasterService.ts` (VCP) | `IntegratedMemoryCoordinator` | 重构调用 |

---

## 通用编码限制

### 禁止的模式

```typescript
// ❌ 禁止 console.log
console.log('debug')  // 使用 logger.info() 替代

// ❌ 禁止 any 无注释
const data: any = response  // 添加 @ts-expect-error 或正确类型

// ❌ 禁止 t() 中使用模板字符串
t(`key.${variable}`)  // 使用 t(key, { variable }) 替代

// ❌ 禁止直接修改 Redux state
state.items.push(item)  // 使用 Immer 模式
```

### 文件创建限制

| 路径 | 限制 |
|------|------|
| `src/main/services/*IpcHandler.ts` | 禁止新建顶层 Handler |
| `src/main/services/Unified*.ts` | 禁止新建 Unified 类 |
| `src/main/services/Integrated*.ts` | 禁止新建 Integrated 类 |
| `src/main/services/Master*.ts` | 禁止新建 Master 类 |

---

## 检查清单

提交代码前确认:

- [ ] 没有创建新的"统一入口"类
- [ ] RRF 算法使用 `memory/utils/RRFUtils.ts`
- [ ] 类型定义使用 `memory/types/index.ts`
- [ ] IPC 通过 `MemoryIpcModule` 注册
- [ ] 没有引用 `@deprecated` 模块
- [ ] 运行 `yarn lint` 通过
- [ ] 运行 `yarn typecheck` 通过

---

*最后更新: 2026-01*
