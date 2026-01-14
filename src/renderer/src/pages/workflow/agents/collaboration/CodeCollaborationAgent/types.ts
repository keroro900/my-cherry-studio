/**
 * CodeCollaborationAgent 类型定义
 *
 * VCP 风格的多 Agent 协同写代码系统
 * 参考 VCPToolBox 的 MagiAgent 多角色协作模式
 */

/**
 * 代码协同角色
 */
export type CodeCollaborationRole =
  | 'architect' // 架构师 - 设计系统架构、定义接口
  | 'developer' // 开发者 - 编写具体代码
  | 'reviewer' // 审查者 - 代码审查、发现问题
  | 'tester' // 测试者 - 编写测试、验证功能
  | 'coordinator' // 协调员 - 协调团队、管理进度

/**
 * 角色配置
 */
export interface CodeRoleConfig {
  displayName: string
  avatar: string
  expertise: string[]
  capabilities: ('code' | 'review' | 'test' | 'design' | 'debug')[]
  systemPrompt: string
}

/**
 * 预定义的协同角色
 */
export const CODE_COLLABORATION_ROLES: Record<CodeCollaborationRole, CodeRoleConfig> = {
  architect: {
    displayName: '架构师',
    avatar: '🏗️',
    expertise: ['系统设计', '接口定义', '模块划分', '技术选型'],
    capabilities: ['design', 'review'],
    systemPrompt: `你是一位资深软件架构师。你的职责是：
1. 分析需求，设计系统架构
2. 定义模块接口和数据结构
3. 制定技术方案和编码规范
4. 评审设计方案的可行性

输出格式：
- 架构图（用 Mermaid 或 ASCII）
- 接口定义（TypeScript/OpenAPI）
- 模块划分说明
- 技术决策理由`
  },
  developer: {
    displayName: '开发者',
    avatar: '👨‍💻',
    expertise: ['代码实现', '功能开发', 'Bug修复', '性能优化'],
    capabilities: ['code', 'debug'],
    systemPrompt: `你是一位专业软件开发者。你的职责是：
1. 根据架构师的设计实现代码
2. 遵循最佳实践和编码规范
3. 编写清晰、可维护的代码
4. 及时修复 Bug 和优化性能

编码原则：
- 代码简洁、易读
- 适当注释关键逻辑
- 处理边界情况和错误
- 遵循 DRY、SOLID 原则`
  },
  reviewer: {
    displayName: '审查者',
    avatar: '🔍',
    expertise: ['代码审查', '安全检查', '最佳实践', '性能分析'],
    capabilities: ['review', 'debug'],
    systemPrompt: `你是一位严谨的代码审查专家。你的职责是：
1. 审查代码质量和规范性
2. 发现潜在的 Bug 和安全问题
3. 提出改进建议和最佳实践
4. 确保代码可维护性

审查要点：
- 逻辑正确性
- 边界处理
- 安全漏洞（XSS、注入等）
- 性能问题
- 代码风格一致性
- 类型安全`
  },
  tester: {
    displayName: '测试者',
    avatar: '🧪',
    expertise: ['单元测试', '集成测试', '测试用例设计', '边界测试'],
    capabilities: ['test', 'debug'],
    systemPrompt: `你是一位专业测试工程师。你的职责是：
1. 设计测试用例覆盖各种场景
2. 编写单元测试和集成测试
3. 发现并报告 Bug
4. 验证修复是否有效

测试原则：
- 覆盖正常流程和边界情况
- 测试错误处理
- 使用 Mock 隔离依赖
- 保证测试可重复执行
- 使用描述性测试名称`
  },
  coordinator: {
    displayName: '协调员',
    avatar: '👨‍💼',
    expertise: ['项目管理', '任务分配', '进度跟踪', '沟通协调'],
    capabilities: ['design', 'review'],
    systemPrompt: `你是团队协调员。你的职责是：
1. 分解任务并分配给合适的角色
2. 监控整体进度
3. 协调团队成员沟通
4. 解决冲突和障碍

协调原则：
- 任务粒度适中
- 明确交付标准
- 及时同步进度
- 保持团队协作顺畅`
  }
}

/**
 * 代码任务
 */
export interface CodeTask {
  id: string
  title: string
  description: string
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'review' | 'design'
  assignedRole?: CodeCollaborationRole
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'needs_review'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  files?: string[] // 相关文件
  dependencies?: string[] // 依赖的任务 ID
  subtasks?: CodeTask[]
  result?: CodeTaskResult
  createdAt: Date
  updatedAt: Date
}

/**
 * 任务结果
 */
export interface CodeTaskResult {
  success: boolean
  output: string
  files?: CodeFile[]
  issues?: CodeIssue[]
  suggestions?: string[]
}

/**
 * 代码文件
 */
export interface CodeFile {
  path: string
  content: string
  language: string
  action: 'create' | 'modify' | 'delete'
  changes?: CodeChange[]
}

/**
 * 代码变更
 */
export interface CodeChange {
  startLine: number
  endLine: number
  oldContent: string
  newContent: string
  description: string
}

/**
 * 代码问题
 */
export interface CodeIssue {
  id: string
  type: 'bug' | 'security' | 'performance' | 'style' | 'suggestion'
  severity: 'info' | 'warning' | 'error' | 'critical'
  file: string
  line?: number
  message: string
  suggestion?: string
}

/**
 * 协同会话
 */
export interface CodeCollaborationSession {
  id: string
  name: string
  description: string
  agents: CodeCollaborationAgent[]
  tasks: CodeTask[]
  files: Map<string, string> // path -> content
  history: CollaborationMessage[]
  status: 'active' | 'paused' | 'completed'
  createdAt: Date
  updatedAt: Date
}

/**
 * 协同 Agent
 */
export interface CodeCollaborationAgent {
  id: string
  role: CodeCollaborationRole
  modelId: string
  name: string
  status: 'idle' | 'working' | 'waiting' | 'reviewing'
  currentTask?: string
}

/**
 * 协同消息
 */
export interface CollaborationMessage {
  id: string
  agentId: string
  role: CodeCollaborationRole
  type:
    | 'task_start'
    | 'task_complete'
    | 'code_submit'
    | 'review_comment'
    | 'question'
    | 'answer'
    | 'approval'
    | 'rejection'
  content: string
  files?: CodeFile[]
  issues?: CodeIssue[]
  replyTo?: string
  timestamp: Date
}

/**
 * 协同工作流配置
 */
export interface CodeCollaborationConfig {
  /** 启用自动代码审查 */
  enableAutoReview: boolean
  /** 启用自动测试生成 */
  enableAutoTest: boolean
  /** 审查通过所需票数 */
  reviewApprovalCount: number
  /** 最大迭代次数 */
  maxIterations: number
  /** 使用的模型配置 */
  models: {
    architect?: string
    developer?: string
    reviewer?: string
    tester?: string
    coordinator?: string
  }
  /** 工作目录 */
  workingDirectory?: string
  /** 编程语言偏好 */
  preferredLanguages?: string[]
}

/**
 * 默认配置
 */
export const DEFAULT_CODE_COLLABORATION_CONFIG: CodeCollaborationConfig = {
  enableAutoReview: true,
  enableAutoTest: true,
  reviewApprovalCount: 1,
  maxIterations: 5,
  models: {},
  preferredLanguages: ['typescript', 'javascript', 'python']
}
