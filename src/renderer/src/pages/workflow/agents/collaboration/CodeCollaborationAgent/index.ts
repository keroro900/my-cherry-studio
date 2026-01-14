/**
 * CodeCollaborationAgent - 代码协同 Agent
 *
 * VCP 风格的多 Agent 协同写代码系统
 * 实现架构师→开发者→审查者→测试者的协作流程
 */

import { loggerService } from '@logger'
import AiProviderNew from '@renderer/aiCore/index_new'
import type { AiSdkMiddlewareConfig } from '@renderer/aiCore/middleware/AiSdkMiddlewareBuilder'
import { getDefaultModel, getProviderByModel } from '@renderer/services/AssistantService'
import type { Model, Provider } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { v4 as uuid } from 'uuid'

import type {
  CodeCollaborationAgent as ICodeCollaborationAgent,
  CodeCollaborationConfig,
  CodeCollaborationRole,
  CodeCollaborationSession,
  CodeFile,
  CodeIssue,
  CodeTask,
  CodeTaskResult,
  CollaborationMessage
} from './types'
import { CODE_COLLABORATION_ROLES, DEFAULT_CODE_COLLABORATION_CONFIG } from './types'

const logger = loggerService.withContext('CodeCollaborationAgent')

/**
 * 代码协同 Agent 主类
 */
export class CodeCollaborationAgent {
  private session: CodeCollaborationSession
  private config: CodeCollaborationConfig
  private agents: Map<CodeCollaborationRole, ICodeCollaborationAgent> = new Map()
  private onMessage?: (message: CollaborationMessage) => void
  private onTaskUpdate?: (task: CodeTask) => void
  private onFileChange?: (file: CodeFile) => void

  constructor(config: Partial<CodeCollaborationConfig> = {}) {
    this.config = { ...DEFAULT_CODE_COLLABORATION_CONFIG, ...config }
    this.session = this.createSession('New Collaboration')
  }

  /**
   * 创建协同会话
   */
  private createSession(name: string): CodeCollaborationSession {
    return {
      id: uuid(),
      name,
      description: '',
      agents: [],
      tasks: [],
      files: new Map(),
      history: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * 初始化 Agent 团队
   */
  async initializeTeam(roles: CodeCollaborationRole[]): Promise<void> {
    logger.info('Initializing code collaboration team', { roles })

    for (const role of roles) {
      const roleConfig = CODE_COLLABORATION_ROLES[role]
      const agent: ICodeCollaborationAgent = {
        id: uuid(),
        role,
        modelId: this.config.models[role] || 'default',
        name: roleConfig.displayName,
        status: 'idle'
      }
      this.agents.set(role, agent)
      this.session.agents.push(agent)
    }

    logger.info('Team initialized', { agentCount: this.agents.size })
  }

  /**
   * 调用 AI 生成响应
   * 使用与正常助手相同的调用链路
   */
  private async callAI(
    role: CodeCollaborationRole,
    userPrompt: string,
    onStream?: (text: string) => void
  ): Promise<string> {
    const roleConfig = CODE_COLLABORATION_ROLES[role]
    const systemPrompt = roleConfig.systemPrompt

    // 获取默认模型和 Provider
    const model: Model = getDefaultModel()
    const provider: Provider = getProviderByModel(model)

    logger.info('Calling AI for role', { role, modelId: model.id })

    // 累积响应
    let accumulatedContent = ''

    // 创建 AI Provider
    const AI = new AiProviderNew(model, provider)

    // 创建临时助手配置
    const tempAssistant = {
      id: `code_collab_${role}_${Date.now()}`,
      name: roleConfig.displayName,
      prompt: systemPrompt,
      model: model,
      topics: [],
      type: 'assistant' as const
    }

    // 中间件配置
    const middlewareConfig: AiSdkMiddlewareConfig = {
      streamOutput: true,
      onChunk: (chunk: { type: ChunkType; text?: string }) => {
        if (chunk.type === ChunkType.TEXT_DELTA && chunk.text) {
          accumulatedContent += chunk.text
          onStream?.(chunk.text)
        }
      },
      model: model,
      enableReasoning: false,
      isPromptToolUse: false,
      isSupportedToolUse: false,
      isImageGenerationEndpoint: false,
      enableWebSearch: false,
      enableGenerateImage: false,
      enableUrlContext: false
    }

    // 调用 AI
    await AI.completions(
      model.id,
      {
        system: systemPrompt,
        prompt: userPrompt
      },
      {
        ...middlewareConfig,
        assistant: tempAssistant,
        topicId: `code_collab_${role}`,
        callType: 'chat'
      }
    )

    return accumulatedContent
  }

  /**
   * 执行代码任务
   *
   * 工作流程:
   * 1. 协调员分解任务
   * 2. 架构师设计方案
   * 3. 开发者实现代码
   * 4. 审查者代码审查
   * 5. 测试者编写测试
   * 6. 迭代修复问题
   */
  async executeTask(requirement: string): Promise<CodeTaskResult> {
    logger.info('Starting code collaboration task', { requirement })

    const mainTask = this.createTask({
      title: '代码协同任务',
      description: requirement,
      type: 'feature',
      priority: 'medium'
    })

    try {
      // 阶段 1: 协调员分解任务
      const subtasks = await this.coordinatorDecomposeTask(mainTask)
      mainTask.subtasks = subtasks

      // 阶段 2: 架构师设计
      const designResult = await this.architectDesign(requirement)
      if (!designResult.success) {
        return designResult
      }

      // 阶段 3: 开发者实现
      const devResult = await this.developerImplement(designResult)
      if (!devResult.success) {
        return devResult
      }

      // 阶段 4: 审查者审查
      if (this.config.enableAutoReview) {
        const reviewResult = await this.reviewerReview(devResult)
        if (reviewResult.issues && reviewResult.issues.length > 0) {
          // 有问题需要修复
          const fixResult = await this.developerFix(devResult, reviewResult.issues)
          devResult.files = fixResult.files
          devResult.output += '\n\n--- 修复后 ---\n' + fixResult.output
        }
      }

      // 阶段 5: 测试者测试
      if (this.config.enableAutoTest) {
        const testResult = await this.testerTest(devResult)
        devResult.files = [...(devResult.files || []), ...(testResult.files || [])]
        devResult.output += '\n\n--- 测试 ---\n' + testResult.output
      }

      // 更新任务状态
      mainTask.status = 'completed'
      mainTask.result = devResult
      this.onTaskUpdate?.(mainTask)

      logger.info('Code collaboration task completed', { taskId: mainTask.id })
      return devResult
    } catch (error) {
      logger.error('Code collaboration task failed', { error })
      mainTask.status = 'blocked'
      this.onTaskUpdate?.(mainTask)
      return {
        success: false,
        output: `协同任务失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 协调员分解任务
   */
  private async coordinatorDecomposeTask(task: CodeTask): Promise<CodeTask[]> {
    const coordinator = this.agents.get('coordinator')
    if (!coordinator) {
      // 没有协调员，返回单个任务
      return [task]
    }

    this.updateAgentStatus('coordinator', 'working', task.id)
    this.emitMessage('coordinator', 'task_start', `开始分解任务: ${task.description}`)

    // TODO: 调用 AI 分解任务
    // 这里简化为创建标准子任务
    const subtasks: CodeTask[] = [
      this.createTask({ title: '设计架构', type: 'design', assignedRole: 'architect', priority: task.priority }),
      this.createTask({ title: '实现代码', type: 'feature', assignedRole: 'developer', priority: task.priority }),
      this.createTask({ title: '代码审查', type: 'review', assignedRole: 'reviewer', priority: task.priority }),
      this.createTask({ title: '编写测试', type: 'test', assignedRole: 'tester', priority: task.priority })
    ]

    this.emitMessage('coordinator', 'task_complete', `任务已分解为 ${subtasks.length} 个子任务`)
    this.updateAgentStatus('coordinator', 'idle')

    return subtasks
  }

  /**
   * 架构师设计
   */
  private async architectDesign(requirement: string): Promise<CodeTaskResult> {
    const architect = this.agents.get('architect')
    if (!architect) {
      return { success: true, output: '跳过架构设计阶段' }
    }

    this.updateAgentStatus('architect', 'working')
    this.emitMessage('architect', 'task_start', '开始系统设计...')

    try {
      // 调用 AI 设计架构
      const prompt = `请根据以下需求设计系统架构：

需求: ${requirement}

请输出：
1. 模块结构（目录结构）
2. 核心接口定义（TypeScript 类型）
3. 技术方案和关键设计决策
4. 需要创建的文件列表

输出格式为 Markdown。`

      const designOutput = await this.callAI('architect', prompt, (text) => {
        // 可以在这里处理流式输出
        logger.debug('Architect streaming:', { text: text.slice(0, 50) })
      })

      this.emitMessage('architect', 'task_complete', '架构设计完成')
      this.updateAgentStatus('architect', 'idle')

      return {
        success: true,
        output: designOutput || '架构设计生成中...'
      }
    } catch (error) {
      logger.error('Architect design failed', { error })
      this.emitMessage('architect', 'task_complete', '架构设计失败')
      this.updateAgentStatus('architect', 'idle')
      return {
        success: false,
        output: `架构设计失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 开发者实现
   */
  private async developerImplement(designResult: CodeTaskResult): Promise<CodeTaskResult> {
    const developer = this.agents.get('developer')
    if (!developer) {
      return { success: false, output: '缺少开发者 Agent' }
    }

    this.updateAgentStatus('developer', 'working')
    this.emitMessage('developer', 'task_start', '开始代码实现...')

    try {
      // 调用 AI 实现代码
      const prompt = `请根据以下架构设计实现代码：

${designResult.output}

要求：
1. 使用 TypeScript 编写
2. 包含必要的注释
3. 处理边界情况和错误
4. 遵循最佳实践

请输出完整的代码文件，使用以下格式标注每个文件：
\`\`\`typescript:路径/文件名.ts
代码内容
\`\`\`
`

      const codeOutput = await this.callAI('developer', prompt, (text) => {
        logger.debug('Developer streaming:', { text: text.slice(0, 50) })
      })

      // 解析生成的代码文件
      const files = this.parseCodeFiles(codeOutput)

      this.emitMessage('developer', 'code_submit', '代码提交审查', files)
      this.updateAgentStatus('developer', 'waiting')

      return {
        success: true,
        output: codeOutput || '代码生成中...',
        files
      }
    } catch (error) {
      logger.error('Developer implement failed', { error })
      this.emitMessage('developer', 'task_complete', '代码实现失败')
      this.updateAgentStatus('developer', 'idle')
      return {
        success: false,
        output: `代码实现失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 从 AI 输出解析代码文件
   */
  private parseCodeFiles(output: string): CodeFile[] {
    const files: CodeFile[] = []
    // 匹配 ```typescript:path/file.ts 或 ```ts:path/file.ts 格式
    const codeBlockRegex = /```(?:typescript|ts|javascript|js|python|py|json|html|css):([^\n]+)\n([\s\S]*?)```/g

    let match
    while ((match = codeBlockRegex.exec(output)) !== null) {
      const path = match[1].trim()
      const content = match[2].trim()
      const ext = path.split('.').pop() || 'ts'

      const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        json: 'json',
        html: 'html',
        css: 'css'
      }

      files.push({
        path,
        content,
        language: languageMap[ext] || 'typescript',
        action: 'create'
      })
    }

    // 如果没有解析到文件，创建一个默认文件
    if (files.length === 0 && output.includes('```')) {
      const simpleMatch = output.match(/```(?:typescript|ts)?\n([\s\S]*?)```/)
      if (simpleMatch) {
        files.push({
          path: 'src/generated.ts',
          content: simpleMatch[1].trim(),
          language: 'typescript',
          action: 'create'
        })
      }
    }

    return files
  }

  /**
   * 审查者审查
   */
  private async reviewerReview(devResult: CodeTaskResult): Promise<CodeTaskResult> {
    const reviewer = this.agents.get('reviewer')
    if (!reviewer) {
      return { success: true, output: '跳过代码审查阶段', issues: [] }
    }

    this.updateAgentStatus('reviewer', 'reviewing')
    this.emitMessage('reviewer', 'task_start', '开始代码审查...')

    try {
      // 构建代码审查提示
      const filesInfo =
        devResult.files?.map((f) => `文件: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n') || ''

      const prompt = `请审查以下代码：

${filesInfo}

请检查：
1. 代码逻辑正确性
2. 边界情况处理
3. 安全漏洞（XSS、注入等）
4. 性能问题
5. 代码风格一致性
6. 类型安全

输出格式：
## 代码审查结果

### 发现的问题
- [严重程度: error/warning/info] 文件:行号 - 问题描述

### 改进建议
- 建议内容

### 总结
✅/⚠️/❌ 审查结论`

      const reviewOutput = await this.callAI('reviewer', prompt, (text) => {
        logger.debug('Reviewer streaming:', { text: text.slice(0, 50) })
      })

      // 解析审查结果中的问题
      const issues = this.parseIssues(reviewOutput)

      this.emitMessage('reviewer', issues.length === 0 ? 'approval' : 'review_comment', reviewOutput)
      this.updateAgentStatus('reviewer', 'idle')

      return {
        success: true,
        output: reviewOutput,
        issues
      }
    } catch (error) {
      logger.error('Reviewer review failed', { error })
      this.emitMessage('reviewer', 'task_complete', '代码审查失败')
      this.updateAgentStatus('reviewer', 'idle')
      return {
        success: false,
        output: `代码审查失败: ${error instanceof Error ? error.message : String(error)}`,
        issues: []
      }
    }
  }

  /**
   * 从审查输出解析问题
   */
  private parseIssues(output: string): CodeIssue[] {
    const issues: CodeIssue[] = []
    // 匹配 [severity] file:line - message 格式
    const issueRegex = /\[(\w+)\]\s*([^:]+):?(\d+)?\s*-\s*(.+)/g

    let match
    while ((match = issueRegex.exec(output)) !== null) {
      const severityMap: Record<string, CodeIssue['severity']> = {
        error: 'error',
        warning: 'warning',
        info: 'info',
        critical: 'critical'
      }

      issues.push({
        id: `issue_${Date.now()}_${issues.length}`,
        type: 'suggestion',
        severity: severityMap[match[1].toLowerCase()] || 'info',
        file: match[2].trim(),
        line: match[3] ? parseInt(match[3]) : undefined,
        message: match[4].trim()
      })
    }

    return issues
  }

  /**
   * 开发者修复问题
   */
  private async developerFix(devResult: CodeTaskResult, issues: CodeIssue[]): Promise<CodeTaskResult> {
    const developer = this.agents.get('developer')
    if (!developer) {
      return devResult
    }

    this.updateAgentStatus('developer', 'working')
    this.emitMessage('developer', 'task_start', `修复 ${issues.length} 个问题...`)

    try {
      // 构建修复提示
      const filesInfo =
        devResult.files?.map((f) => `文件: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n') || ''
      const issuesInfo = issues.map((i) => `- [${i.severity}] ${i.file}:${i.line || '?'} - ${i.message}`).join('\n')

      const prompt = `请修复以下代码中的问题：

## 原始代码
${filesInfo}

## 需要修复的问题
${issuesInfo}

请输出修复后的完整代码文件，使用以下格式：
\`\`\`typescript:路径/文件名.ts
修复后的代码
\`\`\`
`

      const fixOutput = await this.callAI('developer', prompt, (text) => {
        logger.debug('Developer fix streaming:', { text: text.slice(0, 50) })
      })

      const fixedFiles = this.parseCodeFiles(fixOutput)

      this.emitMessage('developer', 'task_complete', '问题修复完成')
      this.updateAgentStatus('developer', 'idle')

      return {
        success: true,
        output: fixOutput,
        files: fixedFiles.length > 0 ? fixedFiles : devResult.files
      }
    } catch (error) {
      logger.error('Developer fix failed', { error })
      this.emitMessage('developer', 'task_complete', '问题修复失败')
      this.updateAgentStatus('developer', 'idle')
      return devResult
    }
  }

  /**
   * 测试者测试
   */
  private async testerTest(devResult: CodeTaskResult): Promise<CodeTaskResult> {
    const tester = this.agents.get('tester')
    if (!tester) {
      return { success: true, output: '跳过测试阶段' }
    }

    this.updateAgentStatus('tester', 'working')
    this.emitMessage('tester', 'task_start', '开始编写测试...')

    try {
      // 构建测试提示
      const filesInfo =
        devResult.files?.map((f) => `文件: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n') || ''

      const prompt = `请为以下代码编写测试用例：

${filesInfo}

要求：
1. 使用 Jest/Vitest 测试框架
2. 覆盖正常流程和边界情况
3. 测试错误处理
4. 使用描述性测试名称
5. 使用 Mock 隔离外部依赖

请输出测试文件，使用以下格式：
\`\`\`typescript:src/__tests__/xxx.test.ts
测试代码
\`\`\`
`

      const testOutput = await this.callAI('tester', prompt, (text) => {
        logger.debug('Tester streaming:', { text: text.slice(0, 50) })
      })

      const testFiles = this.parseCodeFiles(testOutput)

      this.emitMessage('tester', 'task_complete', '测试编写完成', testFiles)
      this.updateAgentStatus('tester', 'idle')

      return {
        success: true,
        output: testOutput,
        files: testFiles
      }
    } catch (error) {
      logger.error('Tester test failed', { error })
      this.emitMessage('tester', 'task_complete', '测试编写失败')
      this.updateAgentStatus('tester', 'idle')
      return {
        success: false,
        output: `测试编写失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 创建任务
   */
  private createTask(partial: Partial<CodeTask>): CodeTask {
    const task: CodeTask = {
      id: uuid(),
      title: partial.title || '未命名任务',
      description: partial.description || '',
      type: partial.type || 'feature',
      assignedRole: partial.assignedRole,
      status: 'pending',
      priority: partial.priority || 'medium',
      dependencies: partial.dependencies,
      subtasks: partial.subtasks,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    this.session.tasks.push(task)
    return task
  }

  /**
   * 更新 Agent 状态
   */
  private updateAgentStatus(
    role: CodeCollaborationRole,
    status: ICodeCollaborationAgent['status'],
    taskId?: string
  ): void {
    const agent = this.agents.get(role)
    if (agent) {
      agent.status = status
      agent.currentTask = taskId
    }
  }

  /**
   * 发送协同消息
   */
  private emitMessage(
    role: CodeCollaborationRole,
    type: CollaborationMessage['type'],
    content: string,
    files?: CodeFile[]
  ): void {
    const agent = this.agents.get(role)
    if (!agent) return

    const message: CollaborationMessage = {
      id: uuid(),
      agentId: agent.id,
      role,
      type,
      content,
      files,
      timestamp: new Date()
    }

    this.session.history.push(message)
    this.onMessage?.(message)

    // 如果有文件变更，通知
    if (files) {
      for (const file of files) {
        this.session.files.set(file.path, file.content)
        this.onFileChange?.(file)
      }
    }
  }

  /**
   * 设置消息回调
   */
  setMessageHandler(handler: (message: CollaborationMessage) => void): void {
    this.onMessage = handler
  }

  /**
   * 设置任务更新回调
   */
  setTaskUpdateHandler(handler: (task: CodeTask) => void): void {
    this.onTaskUpdate = handler
  }

  /**
   * 设置文件变更回调
   */
  setFileChangeHandler(handler: (file: CodeFile) => void): void {
    this.onFileChange = handler
  }

  /**
   * 获取会话
   */
  getSession(): CodeCollaborationSession {
    return this.session
  }

  /**
   * 获取所有 Agent
   */
  getAgents(): ICodeCollaborationAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * 获取协同历史
   */
  getHistory(): CollaborationMessage[] {
    return this.session.history
  }

  /**
   * 获取所有文件
   */
  getFiles(): Map<string, string> {
    return this.session.files
  }
}

export default CodeCollaborationAgent
