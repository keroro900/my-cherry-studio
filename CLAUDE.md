# CLAUDE.md

> Cherry Studio - A powerful AI assistant for producer.
> Electron 38 + React 19 + TypeScript + Redux Toolkit

---

## Quick Start

```bash
# Requirements: Node.js >= 22, Yarn 4.9+
yarn install     # Install dependencies
yarn dev         # Development mode with hot reload
```

---

## Project Structure

```
src/
├── main/              # Electron main process (Node.js)
│   ├── ipc.ts         # IPC hub (200+ channels)
│   ├── services/      # Backend services (MCP, Knowledge, Window, etc.)
│   ├── apiServer/     # REST API server
│   └── mcpServers/    # Built-in MCP implementations
├── renderer/          # React UI (browser context)
│   ├── aiCore/        # AI provider middleware pipeline
│   ├── pages/         # Page components
│   ├── store/         # Redux Toolkit (24 slices)
│   └── services/      # Frontend services
├── preload/           # IPC bridge (context isolation)
└── shared/            # Shared types & utilities
packages/              # Monorepo workspaces
docs/                  # Documentation
```

**Key Entry Points:**
- Main: [src/main/index.ts](src/main/index.ts)
- Renderer: [src/renderer/src/main.tsx](src/renderer/src/main.tsx)
- Store: [src/renderer/src/store/](src/renderer/src/store/)
- AI Core: [src/renderer/src/aiCore/](src/renderer/src/aiCore/)

---

## Commands

| Command | Purpose |
|---------|---------|
| `yarn dev` | Development with hot reload |
| `yarn build:check` | **Pre-commit required**: lint + test |
| `yarn lint` | ESLint + OxLint + TypeScript + format check |
| `yarn test` | Run all Vitest tests |
| `yarn test:main` | Main process tests only |
| `yarn test:renderer` | Renderer process tests only |
| `yarn typecheck` | TypeScript type checking |
| `yarn format` | Biome auto-formatting |
| `yarn i18n:sync` | Sync i18n translation keys |
| `yarn build:win` | Build for Windows |
| `yarn build:mac` | Build for macOS |
| `yarn build:linux` | Build for Linux |

---

## Code Style

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ChatWindow.tsx` |
| Hooks | camelCase, `use` prefix | `useChatHistory.ts` |
| Services | PascalCase + `Service` | `MCPService.ts` |
| Store slices | camelCase | `chat.ts`, `settings.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Interfaces/Types | PascalCase, `I` prefix optional | `ChatMessage`, `IProvider` |

### Formatting (Biome + ESLint)

```typescript
// Indentation: 2 spaces
// Line width: 120 characters
// Quotes: single quotes for JS/TS, double for JSX
// Semicolons: none (ASI)
// Trailing commas: none
// Arrow functions: always use parentheses

// Good
const handler = (event) => {
  return process(event)
}

// Bad
const handler = event => { return process(event); };
```

### Imports (auto-sorted by eslint-plugin-simple-import-sort)

```typescript
// 1. External packages
import { useEffect } from 'react'
import { useSelector } from 'react-redux'

// 2. Internal aliases (@/)
import { MCPService } from '@/services/MCPService'

// 3. Relative imports
import { ChatMessage } from './types'
```

### Logging (CRITICAL)

```typescript
// NEVER use console.log - it will fail lint

// Main process
import { loggerService } from '@logger'
const logger = loggerService.withContext('ModuleName')
logger.info('message', { context: 'data' })
logger.error('error occurred', { error: err })

// Renderer process - initialize first
loggerService.initWindowSource('windowName')
```

### Error Handling

```typescript
// Use try-catch with proper logging
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', { error, context: 'additional info' })
  throw error // Re-throw if caller needs to handle
}

// Use Result pattern for expected failures
type Result<T> = { success: true; data: T } | { success: false; error: string }
```

### Type Safety

```typescript
// Prefer explicit types over any
interface ChatConfig {
  model: string
  temperature: number
  maxTokens?: number
}

// Use Zod for runtime validation (prefer z namespace)
import * as z from 'zod'
const schema = z.object({ name: z.string() })

// Avoid type assertions unless necessary
const data = response as ChatResponse // Avoid if possible
```

---

## Testing & Verification

### Pre-commit Checklist

```bash
# MUST pass before any commit
yarn build:check   # Runs: lint + test

# If i18n errors occur:
yarn i18n:sync     # Sync translation keys first

# If format errors occur:
yarn format        # Auto-fix formatting
```

### Test Standards

- **Unit tests**: Vitest in `__tests__/` directories
- **Coverage**: Aim for critical paths, not 100%
- **Naming**: `*.test.ts` or `*.spec.ts`

```typescript
// Test file location
src/main/services/__tests__/MCPService.test.ts
src/renderer/src/hooks/__tests__/useChat.test.ts

// Test structure
describe('MCPService', () => {
  it('should connect to server', async () => {
    // Arrange
    const service = new MCPService()
    // Act
    await service.connect()
    // Assert
    expect(service.isConnected).toBe(true)
  })
})
```

### Acceptance Criteria

1. `yarn lint` passes with no errors
2. `yarn test` passes all tests
3. `yarn typecheck` reports no type errors
4. No `console.log` in source code
5. i18n keys are properly synced

---

## Git Workflow

### Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/issue-number-description` | `feature/123-add-dark-mode` |
| Bug fix | `fix/issue-number-description` | `fix/456-memory-leak` |
| Docs | `docs/description` | `docs/api-reference` |
| Hotfix | `hotfix/issue-number-description` | `hotfix/789-crash-on-start` |

### Commit Messages (Conventional Commits)

```bash
# Format: type(scope): description

feat(chat): add streaming response support
fix(mcp): resolve connection timeout issue
refactor(store): simplify chat slice logic
docs(readme): update installation guide
test(ai-core): add unit tests for middleware
chore(deps): upgrade electron to v38
```

### Pull Request

1. **Read template first**: `.github/pull_request_template.md`
2. **Target branch**: Always `main` (unless hotfix)
3. **Required sections**: What/Why/Breaking changes/Checklist
4. **Link issues**: `Fixes #123`

---

## Prohibited Actions

### DO NOT Modify

| Path | Reason |
|------|--------|
| `src/main/integration/` | Third-party integrations, managed externally |
| `packages/*/dist/` | Build outputs |
| `.yarn/` | Yarn cache, auto-managed |
| `build/` | Build configuration |

### DO NOT Introduce

- **New dependencies** without explicit approval
- **Redux schema changes** during feature freeze (see PR template)
- **IndexedDB schema changes** without migration plan
- **Breaking API changes** without deprecation period
- **`console.log`** - use `loggerService` instead
- **Template literals in `t()` function** - causes unpredictable i18n

### DO NOT

```typescript
// WRONG: console.log
console.log('debug')           // Use logger.info() instead

// WRONG: Template in t()
t(`key.${variable}`)           // Use t(key, { variable }) instead

// WRONG: any without justification
const data: any = response     // Add proper types

// WRONG: Direct state mutation
state.items.push(item)         // Use Redux Toolkit's immer pattern
```

---

## Memory System Architecture

> ⚠️ **代码债务提醒** (2026-01 审查)

### Current Status

| 类别 | 数量 | 状态 |
|------|:----:|:----:|
| 统一入口类 (Unified/Integrated/Master*) | 7 | 需整合 |
| RRF 算法重复 | 4 | 需抽取 |
| 类型定义重复 (MemoryEntry) | 3 | 需统一 |
| TODO 注释 | 14 | 待完成 |
| @deprecated 标记 | 35 | 待迁移 |

### Recommended Entry Points

| 功能 | 推荐入口 | 废弃入口 |
|------|---------|---------|
| 记忆检索 | `IntegratedMemoryCoordinator` | UnifiedMemoryManager, MasterMemoryManager |
| VCP 记忆 | `VCPMemoryAdapter` | LightMemoService (VCP), DeepMemoService (VCP) |
| 类型定义 | `memory/types/index.ts` | IntegratedMemoryCoordinator 中的 MemoryEntry |
| RRF 融合 | `memory/utils/RRFUtils.ts` | 其他 applyRRF/rrfFuse 实现 |

### Key Files

| 用途 | 文件 |
|------|------|
| 架构文档 | [src/main/memory/README.md](src/main/memory/README.md) |
| 类型定义 | [src/main/memory/types/index.ts](src/main/memory/types/index.ts) |
| 协调器 | [src/main/services/memory/IntegratedMemoryCoordinator.ts](src/main/services/memory/IntegratedMemoryCoordinator.ts) |
| 编码限制 | [docs/zh/CODING-CONSTRAINTS.md](docs/zh/CODING-CONSTRAINTS.md) |
| 代码逻辑 | [docs/zh/MEMORY-LOGIC.md](docs/zh/MEMORY-LOGIC.md) |

### DO NOT

- ❌ 创建新的 `Unified*`, `Integrated*`, `Master*` 入口类
- ❌ 重复实现 RRF 算法 (使用 `memory/utils/RRFUtils`)
- ❌ 重新定义 `MemoryEntry` 类型 (使用 `memory/types`)
- ❌ 创建新的独立 IPC Handler 文件 (使用 `MemoryIpcModule`)
- ❌ 在新代码中引用 `@deprecated` 模块

---

## Documentation Index

### Guides
- [Development Guide](docs/en/guides/development.md)
- [Branching Strategy](docs/en/guides/branching-strategy.md)
- [Test Plan](docs/en/guides/test-plan.md)
- [Logging Guide](docs/en/guides/logging.md)
- [i18n Guide](docs/en/guides/i18n.md)

### References
- [App Upgrade](docs/en/references/app-upgrade.md)
- [Message System](docs/zh/references/message-system.md)
- [Database](docs/zh/references/database.md)
- [Services](docs/zh/references/services.md)

### Architecture
- [VCP Architecture](docs/VCP-ARCHITECTURE.md)
- [VCP Integration](docs/VCP-INTEGRATION.md)

---

## Quick Reference

### IPC Communication

```typescript
// Main process - register handler
ipcMain.handle('channel:action', async (event, data) => {
  return await processData(data)
})

// Renderer process - call handler
const result = await window.api.invoke('channel:action', data)
```

### Redux Pattern

```typescript
// Slice definition
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload)
    }
  }
})

// Component usage
const messages = useSelector((state: RootState) => state.chat.messages)
const dispatch = useDispatch()
dispatch(addMessage(newMessage))
```

### AI Core Middleware

```typescript
// Middleware pipeline: Request -> Middleware[] -> Provider -> Response
const middleware: Middleware = {
  name: 'retry',
  process: async (request, next) => {
    try {
      return await next(request)
    } catch (error) {
      return await next(request) // Retry once
    }
  }
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| i18n sort errors | Run `yarn i18n:sync` first |
| Formatting errors | Run `yarn format` |
| Type errors | Run `yarn typecheck` for details |
| Test failures | Run `yarn test:ui` for interactive mode |
| Build errors | Delete `node_modules`, `out/`, run `yarn install` |
