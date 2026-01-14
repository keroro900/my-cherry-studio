/**
 * CodeCrewOrchestrator - 多模型协同编码协调器
 *
 * 类似 CrewAI 的 Orchestrator 设计
 * 负责协调多个专业化 Agent 协作完成复杂编码任务
 */

import { loggerService } from '@logger'
import ModernAiProvider from '@renderer/aiCore/index_new'
import store from '@renderer/store'
import type { Assistant, Model, Provider } from '@renderer/types'
import { v4 as uuidv4 } from 'uuid'

import { CrewContextManager } from './context/CrewContextManager'
import { ProgressTracker } from './progress/ProgressTracker'
import { TemplateResolver } from './template/TemplateResolver'
import type {
  CodeFile,
  CodeIssue,
  ConversationEntry,
  CrewConfig,
  CrewEvent,
  CrewEventHandler,
  CrewEventType,
  CrewMember,
  CrewMemory,
  CrewPhase,
  CrewProgress,
  CrewRole,
  CrewSession,
  CrewTask,
  DecisionRecord,
  FeatureItem,
  PlanResult,
  ReflectionResult,
  RoleModelConfig,
  TaskInput,
  TaskOutput,
  TaskPriority,
  TaskType
} from './types'
import { CREW_ROLE_CONFIGS, DEFAULT_CREW_CONFIG } from './types'

const logger = loggerService.withContext('CodeCrewOrchestrator')

/**
 * 任务结果
 */
interface TaskExecutionResult {
  success: boolean
  output: TaskOutput
  duration: number
}

/**
 * CodeCrewOrchestrator - 多模型协同协调器
 */
export class CodeCrewOrchestrator {
  private session: CrewSession | null = null
  private config: CrewConfig
  private eventHandlers: Map<CrewEventType, CrewEventHandler[]> = new Map()
  private abortController: AbortController | null = null
  private providerCache: Map<string, { provider: Provider; model: Model }> = new Map()

  constructor(config?: Partial<CrewConfig>) {
    this.config = {
      ...DEFAULT_CREW_CONFIG,
      ...config
    } as CrewConfig
  }

  /**
   * 初始化会话
   */
  async initSession(params: {
    name: string
    description: string
    requirement: string
    roles?: CrewRole[]
  }): Promise<CrewSession> {
    const { name, description, roles = this.config.enabledRoles } = params

    // 创建会话
    this.session = {
      id: uuidv4(),
      name,
      description,
      members: [],
      tasks: [],
      phase: 'initialization',
      status: 'active',
      memory: this.createEmptyMemory(),
      config: this.config,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 初始化团队成员
    for (const role of roles) {
      const member = this.createMember(role)
      this.session.members.push(member)
    }

    logger.info('Session initialized', {
      sessionId: this.session.id,
      memberCount: this.session.members.length,
      roles: roles
    })

    this.emitEvent('session_started', { session: this.session })

    return this.session
  }

  /**
   * 创建团队成员
   */
  private createMember(role: CrewRole): CrewMember {
    const roleConfig = CREW_ROLE_CONFIGS[role]
    const modelConfig = this.config.roleModels[role] || {
      provider: roleConfig.recommendedProvider,
      modelId: roleConfig.recommendedModel
    }

    return {
      id: `member_${role}_${uuidv4().slice(0, 8)}`,
      role,
      name: roleConfig.displayName,
      modelConfig: modelConfig as RoleModelConfig,
      capabilities: roleConfig.capabilities,
      status: 'idle'
    }
  }

  /**
   * 创建空记忆
   */
  private createEmptyMemory(): CrewMemory {
    return {
      projectContext: {},
      conversationHistory: [],
      decisions: [],
      learnings: []
    }
  }

  /**
   * 执行完整协同任务
   */
  async execute(requirement: string): Promise<{
    files: CodeFile[]
    issues: CodeIssue[]
    summary: string
  }> {
    if (!this.session) {
      throw new Error('Session not initialized. Call initSession first.')
    }

    this.abortController = new AbortController()
    const allFiles: CodeFile[] = []
    const allIssues: CodeIssue[] = []
    const outputs: TaskOutput[] = []

    try {
      // Phase 1: 研究阶段 (可选)
      if (this.hasMemberWithRole('researcher')) {
        await this.executePhase('research', requirement, outputs, allFiles, allIssues)
      }

      // Phase 2: 设计阶段
      if (this.hasMemberWithRole('architect')) {
        await this.executePhase('design', requirement, outputs, allFiles, allIssues)
      }

      // Phase 3: 实现阶段 (可并行)
      await this.executePhase('implementation', requirement, outputs, allFiles, allIssues)

      // Phase 4: 审查阶段
      if (this.hasMemberWithRole('reviewer') || this.hasMemberWithRole('security')) {
        await this.executePhase('review', requirement, outputs, allFiles, allIssues)
      }

      // Phase 5: 测试阶段
      if (this.hasMemberWithRole('tester')) {
        await this.executePhase('testing', requirement, outputs, allFiles, allIssues)
      }

      // Phase 6: 完成
      this.updatePhase('completed')

      // 生成总结
      const summary = this.generateSummary(outputs)

      this.emitEvent('session_completed', {
        sessionId: this.session.id,
        files: allFiles,
        issues: allIssues,
        summary
      })

      return { files: allFiles, issues: allIssues, summary }
    } catch (error) {
      logger.error('Execution failed', error as Error)
      this.emitEvent('session_failed', { error })
      throw error
    }
  }

  // ==================== Plan-Act-Reflect 工作流 ====================

  /**
   * 使用 Plan-Act-Reflect 模式执行任务
   * 这是一个更结构化的工作流，包含反馈循环
   */
  async executeWithReflection(requirement: string): Promise<{
    files: CodeFile[]
    issues: CodeIssue[]
    summary: string
    reflections: ReflectionResult[]
  }> {
    if (!this.session) {
      throw new Error('Session not initialized. Call initSession first.')
    }

    this.abortController = new AbortController()

    // 初始化上下文管理器
    CrewContextManager.initialize({
      maxTokens: this.config.maxTokensPerMember || 8000
    })
    CrewContextManager.setSessionId(this.session.id)

    // 初始化进度追踪器
    ProgressTracker.initialize(this.session.id, this.session.name)

    const allFiles: CodeFile[] = []
    const allIssues: CodeIssue[] = []
    const allReflections: ReflectionResult[] = []

    try {
      // Phase 1: Plan (架构师规划)
      this.emitEvent('phase_changed', { phase: 'plan' })
      const plan = await this.planPhase(requirement)

      if (!plan.success || !plan.features.length) {
        throw new Error('Planning failed: ' + (plan.error || 'No features generated'))
      }

      // 初始化功能列表
      ProgressTracker.initFeatures(
        plan.features.map((f) => ({
          title: f.title,
          description: f.description,
          priority: this.mapPriority(f.priority),
          dependencies: f.dependencies
        }))
      )

      logger.info('Plan phase completed', {
        featureCount: plan.features.length,
        architecture: plan.architecture?.substring(0, 100)
      })

      // Phase 2-3: Act + Reflect (循环执行每个功能)
      let nextFeature = ProgressTracker.selectNextFeature()
      let revisionCount = 0
      const maxRevisions = this.config.maxRevisionsPerFeature || 3

      while (nextFeature) {
        // Convert ProgressTracker feature to FeatureItem type
        const feature: FeatureItem = {
          id: nextFeature.id,
          title: nextFeature.title,
          description: nextFeature.description || '',
          priority: this.mapPriorityToNumber(nextFeature.priority)
        }

        this.emitEvent('phase_changed', { phase: 'act', data: { feature } })

        // Act: 实现功能
        const actResult = await this.actPhase(feature, plan, requirement)

        if (actResult.files) {
          allFiles.push(...actResult.files)
        }

        // Reflect: 审查和测试
        this.emitEvent('phase_changed', { phase: 'reflect', data: { feature } })
        const reflection = await this.reflectPhase(actResult, feature, requirement)
        allReflections.push(reflection)

        if (reflection.issues) {
          allIssues.push(...reflection.issues)
        }

        // 如果需要修订且未超过最大修订次数
        if (reflection.needsRevision && revisionCount < maxRevisions) {
          this.emitEvent('phase_changed', { phase: 'revise', data: { feature, reflection } })
          const revisedResult = await this.revisePhase(actResult, reflection, requirement)

          if (revisedResult.files) {
            // 更新或添加文件
            for (const file of revisedResult.files) {
              const existingIndex = allFiles.findIndex((f) => f.path === file.path)
              if (existingIndex >= 0) {
                allFiles[existingIndex] = file
              } else {
                allFiles.push(file)
              }
            }
          }

          revisionCount++
        } else {
          // 标记完成，进入下一个功能
          ProgressTracker.markCompleted(feature.id)
          nextFeature = ProgressTracker.selectNextFeature()
          revisionCount = 0
        }
      }

      // Phase 4: 完成
      this.updatePhase('completed')

      // 生成总结
      const summary = this.generateReflectionSummary(allFiles, allIssues, allReflections)

      this.emitEvent('session_completed', {
        sessionId: this.session.id,
        files: allFiles,
        issues: allIssues,
        reflections: allReflections,
        summary
      })

      return { files: allFiles, issues: allIssues, summary, reflections: allReflections }
    } catch (error) {
      logger.error('Reflection execution failed', error as Error)
      this.emitEvent('session_failed', { error })
      throw error
    } finally {
      CrewContextManager.shutdown()
    }
  }

  /**
   * Plan 阶段: 架构师生成计划
   */
  private async planPhase(requirement: string): Promise<PlanResult> {
    const architect = this.session?.members.find((m) => m.role === 'architect')

    if (!architect) {
      // 如果没有架构师，生成简单计划
      return {
        success: true,
        features: [
          {
            id: uuidv4(),
            title: '完整实现',
            description: requirement,
            priority: 1
          }
        ]
      }
    }

    // 解析模板变量
    const resolvedRequirement = await TemplateResolver.resolve(requirement)

    const planPrompt = `作为系统架构师，请分析以下需求并生成实现计划。

## 需求
${resolvedRequirement}

## 输出格式
请按以下 JSON 格式输出：

\`\`\`json
{
  "architecture": "系统架构描述（用 Mermaid 图）",
  "features": [
    {
      "id": "feature_1",
      "title": "功能标题",
      "description": "详细描述",
      "priority": 1,
      "dependencies": [],
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "techStack": ["TypeScript", "React"],
  "conventions": "编码规范说明"
}
\`\`\`

请确保功能按优先级排序，并标明依赖关系。`

    try {
      const result = await this.callMemberAI(architect, planPrompt, 'plan')

      // 添加到上下文管理器
      CrewContextManager.addMessage(architect.id, {
        role: 'assistant',
        content: result
      })

      // 解析 JSON 输出
      const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        const planData = JSON.parse(jsonMatch[1])

        // 更新项目上下文
        if (planData.techStack) {
          this.updateProjectContext({ techStack: planData.techStack })
        }
        if (planData.conventions) {
          this.updateProjectContext({ conventions: planData.conventions })
        }

        return {
          success: true,
          architecture: planData.architecture,
          features: planData.features.map(
            (f: { id?: string; title: string; description: string; priority?: number; dependencies?: string[] }) => ({
              id: f.id || uuidv4(),
              title: f.title,
              description: f.description,
              priority: f.priority || 1,
              dependencies: f.dependencies || []
            })
          )
        }
      }

      // JSON 解析失败，返回单一功能
      return {
        success: true,
        features: [
          {
            id: uuidv4(),
            title: '完整实现',
            description: requirement,
            priority: 1
          }
        ],
        rawOutput: result
      }
    } catch (error) {
      logger.error('Plan phase failed', error as Error)
      return {
        success: false,
        features: [],
        error: (error as Error).message
      }
    }
  }

  /**
   * Act 阶段: 开发者实现功能
   */
  private async actPhase(
    feature: FeatureItem,
    plan: PlanResult,
    requirement: string
  ): Promise<{
    content: string
    files?: CodeFile[]
  }> {
    // 找到合适的开发者
    const developer = this.session?.members.find((m) => m.role === 'developer' && m.status === 'idle')
    const frontend = this.session?.members.find((m) => m.role === 'frontend' && m.status === 'idle')

    const implementer = developer || frontend
    if (!implementer) {
      throw new Error('No available developer for implementation')
    }

    // 获取上下文历史
    const history = CrewContextManager.getMemberHistoryWithLimit(implementer.id, 4000)

    const actPrompt = `作为开发者，请实现以下功能。

## 功能
**${feature.title}**
${feature.description}

## 原始需求
${requirement}

## 架构设计
${plan.architecture || '无'}

## 技术栈
${this.session?.memory.projectContext.techStack?.join(', ') || 'TypeScript'}

## 编码规范
${this.session?.memory.projectContext.conventions || '遵循项目现有规范'}

${history.length > 0 ? `## 之前的工作\n${history.map((h) => h.content).join('\n---\n')}` : ''}

## 输出要求
请输出完整可运行的代码，使用以下格式：
\`\`\`typescript:src/path/to/file.ts
// 代码内容
\`\`\``

    try {
      implementer.status = 'working'
      const result = await this.callMemberAI(implementer, actPrompt, 'implement')
      implementer.status = 'idle'

      // 添加到上下文管理器
      CrewContextManager.addMessage(implementer.id, {
        role: 'assistant',
        content: result
      })

      // 解析代码文件
      const files = this.extractCodeFiles(result)

      return { content: result, files }
    } catch (error) {
      implementer.status = 'error'
      throw error
    }
  }

  /**
   * Reflect 阶段: 审查者和测试者提供反馈
   */
  private async reflectPhase(
    actResult: { content: string; files?: CodeFile[] },
    feature: FeatureItem,
    requirement: string
  ): Promise<ReflectionResult> {
    const reviewer = this.session?.members.find((m) => m.role === 'reviewer')
    const tester = this.session?.members.find((m) => m.role === 'tester')

    const issues: CodeIssue[] = []
    const suggestions: string[] = []
    let needsRevision = false

    // 代码审查
    if (reviewer) {
      const reviewPrompt = `作为代码审查专家，请审查以下代码实现。

## 原始需求
${requirement}

## 当前功能: ${feature.title}

## 实现代码
${actResult.content}

## 审查要点
1. **需求符合度**: 实现是否满足原始需求
2. 代码质量和可读性
3. 潜在 bug 和边界情况
4. 性能问题
5. 安全问题 (OWASP Top 10)
6. 是否符合最佳实践

## 输出格式
请按以下格式输出问题：
[error/warning/info] 文件:行号 - 问题描述

最后给出总结：是否需要修改 (yes/no) 和改进建议。`

      try {
        const reviewResult = await this.callMemberAI(reviewer, reviewPrompt, 'review')

        // 解析问题
        const issueMatches = reviewResult.matchAll(/\[(error|warning|info|critical)\]\s*([^:]+):?(\d+)?\s*-\s*(.+)/gi)
        for (const match of issueMatches) {
          const [, severity, file, line, message] = match
          issues.push({
            id: uuidv4(),
            type: severity === 'error' || severity === 'critical' ? 'bug' : 'suggestion',
            severity: severity as 'info' | 'warning' | 'error' | 'critical',
            file: file.trim(),
            line: line ? parseInt(line) : undefined,
            message: message.trim(),
            source: 'reviewer'
          })
        }

        // 检查是否需要修改
        if (reviewResult.toLowerCase().includes('需要修改') || reviewResult.toLowerCase().includes('yes')) {
          needsRevision = true
        }

        // 提取建议
        const suggestionMatch = reviewResult.match(/建议[：:]\s*(.+)/g)
        if (suggestionMatch) {
          suggestions.push(...suggestionMatch.map((s) => s.replace(/建议[：:]\s*/, '')))
        }
      } catch (error) {
        logger.warn('Review phase failed', { error })
      }
    }

    // 测试检查
    if (tester && actResult.files) {
      const testPrompt = `作为测试专家，请检查以下代码的可测试性并提出测试建议。

## 原始需求
${requirement}

## 当前功能: ${feature.title}

## 代码文件
${actResult.files.map((f) => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n')}

## 检查要点
1. **需求覆盖**: 测试是否覆盖原始需求的所有场景
2. 关键函数是否有对应测试
3. 边界情况是否覆盖
4. 错误处理是否完善
5. 是否需要集成测试

## 输出格式
- 需求覆盖评估
- 测试覆盖评估
- 推荐测试用例列表
- 是否需要补充测试 (yes/no)`

      try {
        const testResult = await this.callMemberAI(tester, testPrompt, 'test')

        if (testResult.toLowerCase().includes('需要补充') || testResult.toLowerCase().includes('yes')) {
          needsRevision = true
          suggestions.push('需要补充测试用例')
        }
      } catch (error) {
        logger.warn('Test phase failed', { error })
      }
    }

    return {
      featureId: feature.id,
      issues,
      suggestions,
      needsRevision,
      timestamp: new Date()
    }
  }

  /**
   * Revise 阶段: 根据反馈修订代码
   */
  private async revisePhase(
    actResult: { content: string; files?: CodeFile[] },
    reflection: ReflectionResult,
    requirement: string
  ): Promise<{
    content: string
    files?: CodeFile[]
  }> {
    const developer = this.session?.members.find((m) => m.role === 'developer' && m.status === 'idle')

    if (!developer) {
      return actResult // 无可用开发者，返回原结果
    }

    const revisePrompt = `作为开发者，请根据审查反馈修订代码。

## 原始代码
${actResult.content}

## 审查问题
${reflection.issues.map((i) => `- [${i.severity}] ${i.file}:${i.line || '?'} - ${i.message}`).join('\n')}

## 改进建议
${reflection.suggestions.join('\n')}

## 需求参考
${requirement}

## 输出要求
请输出修订后的完整代码，使用 \`\`\`typescript:文件路径 格式。
说明你做了哪些修改。`

    try {
      developer.status = 'working'
      const result = await this.callMemberAI(developer, revisePrompt, 'revise')
      developer.status = 'idle'

      const files = this.extractCodeFiles(result)

      return { content: result, files: files.length > 0 ? files : actResult.files }
    } catch (error) {
      developer.status = 'error'
      throw error
    }
  }

  /**
   * 调用成员 AI (简化版)
   */
  private async callMemberAI(member: CrewMember, prompt: string, taskType: string): Promise<string> {
    const roleConfig = CREW_ROLE_CONFIGS[member.role]
    const { provider, model } = await this.getProviderAndModel(member.modelConfig)

    const tempAssistant: Assistant = {
      id: `crew_${member.id}`,
      name: member.name,
      prompt: roleConfig.systemPrompt,
      model,
      topics: [],
      type: 'assistant'
    }

    const aiProvider = new ModernAiProvider(model, provider)

    const result = await aiProvider.completions(
      model.id,
      {
        messages: [{ role: 'user' as const, content: prompt }],
        system: roleConfig.systemPrompt,
        temperature: member.modelConfig.temperature || 0.7,
        abortSignal: this.abortController?.signal
      },
      {
        assistant: tempAssistant,
        callType: `crew_${taskType}`,
        streamOutput: false,
        enableReasoning: false,
        isPromptToolUse: false,
        isSupportedToolUse: false,
        isImageGenerationEndpoint: false,
        enableWebSearch: false,
        enableGenerateImage: false,
        enableUrlContext: false,
        model,
        provider
      }
    )

    return result.getText()
  }

  /**
   * 提取代码文件
   */
  private extractCodeFiles(response: string): CodeFile[] {
    const files: CodeFile[] = []
    const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g
    let match

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, language, path, content] = match
      files.push({
        path: path.trim(),
        content: content.trim(),
        language,
        action: 'create'
      })
    }

    return files
  }

  /**
   * 生成反思总结
   */
  private generateReflectionSummary(files: CodeFile[], issues: CodeIssue[], reflections: ReflectionResult[]): string {
    const parts: string[] = []

    parts.push('# Plan-Act-Reflect 任务完成报告')
    parts.push('')

    parts.push('## 统计')
    parts.push(`- 生成文件: ${files.length} 个`)
    parts.push(`- 发现问题: ${issues.length} 个`)
    parts.push(`- 反思轮次: ${reflections.length} 次`)
    parts.push(`- 需修订功能: ${reflections.filter((r) => r.needsRevision).length} 个`)
    parts.push('')

    if (issues.length > 0) {
      parts.push('## 问题分布')
      const bySeverity = {
        critical: issues.filter((i) => i.severity === 'critical').length,
        error: issues.filter((i) => i.severity === 'error').length,
        warning: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length
      }
      parts.push(`- Critical: ${bySeverity.critical}`)
      parts.push(`- Error: ${bySeverity.error}`)
      parts.push(`- Warning: ${bySeverity.warning}`)
      parts.push(`- Info: ${bySeverity.info}`)
      parts.push('')
    }

    parts.push('## 生成文件')
    for (const file of files) {
      parts.push(`- ${file.path} (${file.language})`)
    }

    return parts.join('\n')
  }

  /**
   * 映射优先级数字到 ProgressTracker 优先级
   */
  private mapPriority(priority: number): 'critical' | 'high' | 'medium' | 'low' {
    if (priority >= 4) return 'critical'
    if (priority >= 3) return 'high'
    if (priority >= 2) return 'medium'
    return 'low'
  }

  /**
   * 映射 ProgressTracker 优先级到数字
   */
  private mapPriorityToNumber(priority: string): number {
    switch (priority) {
      case 'critical':
        return 4
      case 'high':
        return 3
      case 'medium':
        return 2
      case 'low':
      default:
        return 1
    }
  }

  /**
   * 执行特定阶段
   */
  private async executePhase(
    phase: CrewPhase,
    requirement: string,
    outputs: TaskOutput[],
    allFiles: CodeFile[],
    allIssues: CodeIssue[]
  ): Promise<void> {
    this.updatePhase(phase)

    const phaseTasks = this.createPhaseTasks(phase, requirement)

    // 检查是否可以并行执行
    const parallelTasks: CrewTask[] = []
    const sequentialTasks: CrewTask[] = []

    for (const task of phaseTasks) {
      if (this.canExecuteInParallel(task)) {
        parallelTasks.push(task)
      } else {
        sequentialTasks.push(task)
      }
    }

    // 先执行可并行的任务
    if (parallelTasks.length > 0) {
      const parallelPromises = parallelTasks.map((task) => this.executeTask(task, requirement, outputs))
      const parallelResults = await Promise.all(parallelPromises)

      for (const result of parallelResults) {
        if (result.success) {
          outputs.push(result.output)
          if (result.output.files) allFiles.push(...result.output.files)
          if (result.output.issues) allIssues.push(...result.output.issues)
        }
      }
    }

    // 再执行顺序任务
    for (const task of sequentialTasks) {
      const result = await this.executeTask(task, requirement, outputs)
      if (result.success) {
        outputs.push(result.output)
        if (result.output.files) allFiles.push(...result.output.files)
        if (result.output.issues) allIssues.push(...result.output.issues)
      }
    }
  }

  /**
   * 创建阶段任务
   */
  private createPhaseTasks(phase: CrewPhase, _requirement: string): CrewTask[] {
    const tasks: CrewTask[] = []
    const now = new Date()

    switch (phase) {
      case 'research':
        if (this.hasMemberWithRole('researcher')) {
          tasks.push(this.createTask('research', 'researcher', '技术调研', '调研相关技术和最佳实践', 'high', now))
        }
        break

      case 'design':
        if (this.hasMemberWithRole('architect')) {
          tasks.push(this.createTask('design', 'architect', '系统设计', '设计系统架构和接口', 'high', now))
        }
        break

      case 'implementation':
        if (this.hasMemberWithRole('developer')) {
          tasks.push(this.createTask('implement', 'developer', '后端实现', '实现核心业务逻辑', 'high', now))
        }
        if (this.hasMemberWithRole('frontend')) {
          tasks.push(this.createTask('implement', 'frontend', '前端实现', '实现 UI 组件和交互', 'high', now))
        }
        break

      case 'review':
        if (this.hasMemberWithRole('reviewer')) {
          tasks.push(this.createTask('review', 'reviewer', '代码审查', '审查代码质量和问题', 'medium', now))
        }
        if (this.hasMemberWithRole('security')) {
          tasks.push(this.createTask('audit', 'security', '安全审计', '检查安全漏洞', 'high', now))
        }
        break

      case 'testing':
        if (this.hasMemberWithRole('tester')) {
          tasks.push(this.createTask('test', 'tester', '测试编写', '编写测试用例', 'medium', now))
        }
        break
    }

    // 添加到会话任务列表
    if (this.session) {
      this.session.tasks.push(...tasks)
    }

    return tasks
  }

  /**
   * 创建任务
   */
  private createTask(
    type: TaskType,
    role: CrewRole,
    title: string,
    description: string,
    priority: TaskPriority,
    createdAt: Date
  ): CrewTask {
    return {
      id: uuidv4(),
      type,
      title,
      description,
      priority,
      status: 'pending',
      assignedRole: role,
      createdAt
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: CrewTask,
    requirement: string,
    previousOutputs: TaskOutput[]
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()

    // 找到负责这个任务的成员
    const member = this.findMemberForTask(task)
    if (!member) {
      logger.warn('No member found for task', { taskId: task.id, role: task.assignedRole })
      return {
        success: false,
        output: { content: 'No member available' },
        duration: 0
      }
    }

    // 更新状态
    task.status = 'in_progress'
    task.startedAt = new Date()
    task.assignedMemberId = member.id
    member.status = 'working'
    member.currentTask = task.id

    this.emitEvent('task_started', { task, member })

    try {
      // 构建输入
      const input: TaskInput = {
        context: requirement,
        dependencyOutputs: this.collectDependencyOutputs(task, previousOutputs)
      }

      // 调用 AI
      const output = await this.callAI(member, task, input)

      // 更新状态
      task.status = 'completed'
      task.completedAt = new Date()
      task.output = output
      member.status = 'idle'
      member.currentTask = undefined
      member.lastActiveAt = new Date()

      // 记录到会话历史
      this.addConversationEntry(member, task, output)

      this.emitEvent('task_completed', { task, member, output })

      // 如果生成了文件，发送事件
      if (output.files) {
        for (const file of output.files) {
          this.emitEvent('file_generated', { file, task, member })
        }
      }

      // 如果发现问题，发送事件
      if (output.issues) {
        for (const issue of output.issues) {
          this.emitEvent('issue_found', { issue, task, member })
        }
      }

      return {
        success: true,
        output,
        duration: Date.now() - startTime
      }
    } catch (error) {
      task.status = 'failed'
      task.error = (error as Error).message
      member.status = 'error'

      this.emitEvent('task_failed', { task, member, error })

      return {
        success: false,
        output: { content: (error as Error).message },
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 调用 AI 完成任务
   */
  private async callAI(member: CrewMember, task: CrewTask, input: TaskInput): Promise<TaskOutput> {
    const roleConfig = CREW_ROLE_CONFIGS[member.role]

    // 构建 prompt
    const prompt = this.buildPrompt(member, task, input)

    // 获取 provider 和 model
    const { provider, model } = await this.getProviderAndModel(member.modelConfig)

    // 创建临时 assistant 对象
    const tempAssistant: Assistant = {
      id: `crew_${member.id}`,
      name: member.name,
      prompt: roleConfig.systemPrompt,
      model,
      topics: [],
      type: 'assistant'
    }

    try {
      const aiProvider = new ModernAiProvider(model, provider)

      // 构建消息
      const messages = [
        {
          role: 'user' as const,
          content: prompt
        }
      ]

      const result = await aiProvider.completions(
        model.id,
        {
          messages,
          system: roleConfig.systemPrompt,
          temperature: member.modelConfig.temperature || 0.7,
          abortSignal: this.abortController?.signal
        },
        {
          assistant: tempAssistant,
          callType: 'crew_task',
          streamOutput: false,
          enableReasoning: false,
          isPromptToolUse: false,
          isSupportedToolUse: false,
          isImageGenerationEndpoint: false,
          enableWebSearch: false,
          enableGenerateImage: false,
          enableUrlContext: false,
          model,
          provider
        }
      )

      const responseText = result.getText()

      // 解析输出
      return this.parseAIOutput(responseText, task.type)
    } catch (error) {
      logger.error('AI call failed', error as Error, {
        member: member.id,
        task: task.id
      })
      throw error
    }
  }

  /**
   * 获取 Provider 和 Model
   */
  private async getProviderAndModel(modelConfig: RoleModelConfig): Promise<{ provider: Provider; model: Model }> {
    const cacheKey = `${modelConfig.provider}_${modelConfig.modelId}`

    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!
    }

    // 从 store 获取 provider
    const state = store.getState()
    const providers = state.llm.providers

    // 辅助函数：检查 provider 是否可用（启用且有模型）
    const isProviderAvailable = (p: Provider) => p.enabled !== false && p.models && p.models.length > 0

    // 根据 provider 类型找到对应的 provider
    let provider: Provider | undefined

    switch (modelConfig.provider) {
      case 'anthropic':
        provider = providers.find(
          (p: Provider) => (p.id === 'anthropic' || p.type === 'anthropic') && isProviderAvailable(p)
        )
        break
      case 'openai':
        provider = providers.find((p: Provider) => (p.id === 'openai' || p.type === 'openai') && isProviderAvailable(p))
        break
      case 'google':
        provider = providers.find(
          (p: Provider) => (p.id === 'google' || p.id === 'gemini' || p.type === 'gemini') && isProviderAvailable(p)
        )
        break
      case 'deepseek':
        // DeepSeek 通常配置为 new-api 类型
        provider = providers.find(
          (p: Provider) => (p.id === 'deepseek' || p.id.includes('deepseek')) && isProviderAvailable(p)
        )
        break
      case 'perplexity':
        // Perplexity 通常配置为 new-api 类型
        provider = providers.find(
          (p: Provider) => (p.id === 'perplexity' || p.id.includes('perplexity')) && isProviderAvailable(p)
        )
        break
      default:
        // 尝试找到任何可用的 provider
        provider = providers.find((p: Provider) => isProviderAvailable(p))
    }

    if (!provider) {
      throw new Error(`Provider not found or disabled for ${modelConfig.provider}`)
    }

    // 找到模型
    let model = provider.models?.find((m: Model) => m.id === modelConfig.modelId)

    // 如果指定模型不存在，回退到第一个可用模型并记录警告
    if (!model) {
      const fallbackModel = provider.models?.[0]
      if (fallbackModel) {
        logger.warn('Specified model not found, falling back to default', {
          requestedModel: modelConfig.modelId,
          fallbackModel: fallbackModel.id,
          provider: provider.id
        })
        model = fallbackModel
      }
    }

    if (!model) {
      throw new Error(`Model not found: ${modelConfig.modelId} (provider: ${provider.id})`)
    }

    const result = { provider, model }
    this.providerCache.set(cacheKey, result)

    return result
  }

  /**
   * 构建 Prompt
   */
  private buildPrompt(member: CrewMember, task: CrewTask, input: TaskInput): string {
    const parts: string[] = []

    // 任务描述
    parts.push(`## 任务: ${task.title}`)
    parts.push(task.description)
    parts.push('')

    // 需求上下文
    if (input.context) {
      parts.push('## 需求')
      parts.push(input.context)
      parts.push('')
    }

    // 依赖输出
    if (input.dependencyOutputs && Object.keys(input.dependencyOutputs).length > 0) {
      parts.push('## 前置工作成果')
      for (const [taskId, output] of Object.entries(input.dependencyOutputs)) {
        parts.push(`### ${taskId}`)
        parts.push(output.content)
        parts.push('')
      }
    }

    // 项目上下文
    if (this.session?.memory.projectContext) {
      const ctx = this.session.memory.projectContext
      if (ctx.techStack?.length) {
        parts.push('## 技术栈')
        parts.push(ctx.techStack.join(', '))
        parts.push('')
      }
      if (ctx.conventions) {
        parts.push('## 编码规范')
        parts.push(ctx.conventions)
        parts.push('')
      }
    }

    // 角色特定指令
    parts.push('## 你的任务')
    switch (member.role) {
      case 'architect':
        parts.push('请设计系统架构，包括模块划分、接口定义、数据结构。使用 Mermaid 绘制架构图。')
        break
      case 'developer':
        parts.push('请实现代码，输出格式为 ```typescript:文件路径 代码内容 ```')
        break
      case 'frontend':
        parts.push('请实现前端组件，使用 React + TypeScript，输出格式为 ```tsx:文件路径 代码内容 ```')
        break
      case 'reviewer':
        parts.push('请审查代码质量，输出问题列表和改进建议。')
        break
      case 'tester':
        parts.push('请编写测试用例，使用 Jest/Vitest，覆盖正常和边界情况。')
        break
      case 'researcher':
        parts.push('请调研相关技术，提供最佳实践和推荐方案。')
        break
      case 'security':
        parts.push('请进行安全审计，检查 OWASP Top 10 漏洞，输出安全报告。')
        break
      case 'devops':
        parts.push('请设计 CI/CD 流程，提供 Docker/K8s 配置。')
        break
    }

    return parts.join('\n')
  }

  /**
   * 解析 AI 输出
   */
  private parseAIOutput(response: string, _taskType: TaskType): TaskOutput {
    const output: TaskOutput = {
      content: response,
      files: [],
      issues: [],
      suggestions: []
    }

    // 提取代码块
    const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g
    let match
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, language, path, content] = match
      output.files!.push({
        path: path.trim(),
        content: content.trim(),
        language,
        action: 'create'
      })
    }

    // 提取问题 (格式: [error/warning/info] 文件:行号 - 描述)
    const issueRegex = /\[(error|warning|info|critical)\]\s*([^:]+):?(\d+)?\s*-\s*(.+)/gi
    while ((match = issueRegex.exec(response)) !== null) {
      const [, severity, file, line, message] = match
      output.issues!.push({
        id: uuidv4(),
        type: severity === 'error' || severity === 'critical' ? 'bug' : 'suggestion',
        severity: severity as 'info' | 'warning' | 'error' | 'critical',
        file: file.trim(),
        line: line ? parseInt(line) : undefined,
        message: message.trim()
      })
    }

    // 提取建议
    const suggestionRegex = /建议[：:]\s*(.+)/g
    while ((match = suggestionRegex.exec(response)) !== null) {
      output.suggestions!.push(match[1].trim())
    }

    return output
  }

  /**
   * 查找任务对应的成员
   */
  private findMemberForTask(task: CrewTask): CrewMember | undefined {
    if (!this.session) return undefined

    // 如果指定了角色，找该角色的空闲成员
    if (task.assignedRole) {
      return this.session.members.find((m) => m.role === task.assignedRole && m.status === 'idle')
    }

    // 否则根据任务类型找合适的成员
    const roleConfig = CREW_ROLE_CONFIGS
    for (const member of this.session.members) {
      const config = roleConfig[member.role]
      if (config.acceptedTaskTypes.includes(task.type) && member.status === 'idle') {
        return member
      }
    }

    return undefined
  }

  /**
   * 收集依赖输出
   */
  private collectDependencyOutputs(task: CrewTask, previousOutputs: TaskOutput[]): Record<string, TaskOutput> {
    const result: Record<string, TaskOutput> = {}

    // 获取该任务依赖的角色
    const roleConfig = CREW_ROLE_CONFIGS[task.assignedRole!]
    const dependsOn = roleConfig?.dependsOn || []

    // 从已完成的任务中收集输出
    if (this.session) {
      for (const completedTask of this.session.tasks) {
        if (
          completedTask.status === 'completed' &&
          completedTask.output &&
          dependsOn.includes(completedTask.assignedRole!)
        ) {
          result[completedTask.id] = completedTask.output
        }
      }
    }

    // 也包含之前阶段的所有输出
    previousOutputs.forEach((output, index) => {
      if (!result[`prev_${index}`]) {
        result[`prev_${index}`] = output
      }
    })

    return result
  }

  /**
   * 添加会话记录
   */
  private addConversationEntry(member: CrewMember, _task: CrewTask, output: TaskOutput): void {
    if (!this.session) return

    const entry: ConversationEntry = {
      id: uuidv4(),
      role: member.role,
      memberId: member.id,
      type: 'task_complete',
      content: output.content,
      files: output.files,
      timestamp: new Date()
    }

    this.session.memory.conversationHistory.push(entry)
  }

  /**
   * 检查是否有特定角色的成员
   */
  private hasMemberWithRole(role: CrewRole): boolean {
    return this.session?.members.some((m) => m.role === role) || false
  }

  /**
   * 检查任务是否可以并行执行
   */
  private canExecuteInParallel(task: CrewTask): boolean {
    if (!task.assignedRole) return false

    const roleConfig = CREW_ROLE_CONFIGS[task.assignedRole]

    // 如果没有依赖，可以并行
    if (!roleConfig.dependsOn || roleConfig.dependsOn.length === 0) {
      return true
    }

    // 检查依赖是否已完成
    if (this.session) {
      for (const depRole of roleConfig.dependsOn) {
        const depTask = this.session.tasks.find((t) => t.assignedRole === depRole && t.status !== 'completed')
        if (depTask) {
          return false
        }
      }
    }

    return true
  }

  /**
   * 更新阶段
   */
  private updatePhase(phase: CrewPhase): void {
    if (!this.session) return

    this.session.phase = phase
    this.session.updatedAt = new Date()

    this.emitEvent('phase_changed', { phase })
  }

  /**
   * 生成总结
   */
  private generateSummary(outputs: TaskOutput[]): string {
    const parts: string[] = []

    parts.push('# 协同任务完成报告')
    parts.push('')

    // 统计
    const fileCount = outputs.reduce((sum, o) => sum + (o.files?.length || 0), 0)
    const issueCount = outputs.reduce((sum, o) => sum + (o.issues?.length || 0), 0)

    parts.push(`## 统计`)
    parts.push(`- 生成文件: ${fileCount} 个`)
    parts.push(`- 发现问题: ${issueCount} 个`)
    parts.push(`- 参与成员: ${this.session?.members.length || 0} 人`)
    parts.push('')

    // 成员贡献
    parts.push('## 成员贡献')
    for (const member of this.session?.members || []) {
      const memberTasks = this.session?.tasks.filter(
        (t) => t.assignedMemberId === member.id && t.status === 'completed'
      )
      parts.push(`- ${member.name}: 完成 ${memberTasks?.length || 0} 个任务`)
    }

    return parts.join('\n')
  }

  /**
   * 注册事件处理器
   */
  on(eventType: CrewEventType, handler: CrewEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * 发送事件
   */
  private emitEvent(type: CrewEventType, data: Record<string, unknown>): void {
    const event: CrewEvent = {
      type,
      sessionId: this.session?.id || '',
      timestamp: new Date(),
      data
    }

    const handlers = this.eventHandlers.get(type) || []
    for (const handler of handlers) {
      try {
        handler(event)
      } catch (error) {
        logger.error('Event handler error', error as Error)
      }
    }
  }

  /**
   * 获取当前进度
   */
  getProgress(): CrewProgress | null {
    if (!this.session) return null

    const completedTasks = this.session.tasks.filter((t) => t.status === 'completed').length
    const currentTasks = this.session.tasks
      .filter((t) => t.status === 'in_progress')
      .map((t) => ({
        taskId: t.id,
        role: t.assignedRole!,
        title: t.title,
        progress: 50 // 简化处理
      }))

    const generatedFiles = this.session.tasks.reduce((sum, t) => sum + (t.output?.files?.length || 0), 0)
    const foundIssues = this.session.tasks.reduce((sum, t) => sum + (t.output?.issues?.length || 0), 0)

    return {
      sessionId: this.session.id,
      phase: this.session.phase,
      totalTasks: this.session.tasks.length,
      completedTasks,
      currentTasks,
      generatedFiles,
      foundIssues,
      startedAt: this.session.createdAt
    }
  }

  /**
   * 获取会话
   */
  getSession(): CrewSession | null {
    return this.session
  }

  /**
   * 停止执行
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    if (this.session) {
      this.session.status = 'paused'
    }
  }

  /**
   * 添加决策记录
   */
  addDecision(topic: string, decision: string, rationale: string, madeBy: CrewRole): void {
    if (!this.session) return

    const record: DecisionRecord = {
      id: uuidv4(),
      topic,
      decision,
      rationale,
      madeBy,
      timestamp: new Date()
    }

    this.session.memory.decisions.push(record)
  }

  /**
   * 更新项目上下文
   */
  updateProjectContext(context: Partial<CrewMemory['projectContext']>): void {
    if (!this.session) return

    this.session.memory.projectContext = {
      ...this.session.memory.projectContext,
      ...context
    }
  }
}

export default CodeCrewOrchestrator
