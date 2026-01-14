// Sequential Thinking MCP Server
// port https://github.com/modelcontextprotocol/servers/blob/main/src/sequentialthinking/index.ts

import { loggerService } from '@logger'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
// Fixed chalk import for ESM
import chalk from 'chalk'

import { getDynamicFusionService } from './DynamicFusionService'

const logger = loggerService.withContext('MCPServer:SequentialThinkingServer')

interface ThoughtData {
  thought: string
  thoughtNumber: number
  totalThoughts: number
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
  nextThoughtNeeded: boolean
}

class SequentialThinkingServer {
  private thoughtHistory: ThoughtData[] = []
  private branches: Record<string, ThoughtData[]> = {}

  private validateThoughtData(input: unknown): ThoughtData {
    const data = input as Record<string, unknown>

    if (!data.thought || typeof data.thought !== 'string') {
      throw new Error('Invalid thought: must be a string')
    }
    if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
      throw new Error('Invalid thoughtNumber: must be a number')
    }
    if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
      throw new Error('Invalid totalThoughts: must be a number')
    }
    if (typeof data.nextThoughtNeeded !== 'boolean') {
      throw new Error('Invalid nextThoughtNeeded: must be a boolean')
    }

    return {
      thought: data.thought,
      thoughtNumber: data.thoughtNumber,
      totalThoughts: data.totalThoughts,
      nextThoughtNeeded: data.nextThoughtNeeded,
      isRevision: data.isRevision as boolean | undefined,
      revisesThought: data.revisesThought as number | undefined,
      branchFromThought: data.branchFromThought as number | undefined,
      branchId: data.branchId as string | undefined,
      needsMoreThoughts: data.needsMoreThoughts as boolean | undefined
    }
  }

  private formatThought(thoughtData: ThoughtData): string {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } =
      thoughtData

    let prefix: string
    let context: string

    if (isRevision) {
      prefix = chalk.yellow('🔄 Revision')
      context = ` (revising thought ${revisesThought})`
    } else if (branchFromThought) {
      prefix = chalk.green('🌿 Branch')
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`
    } else {
      prefix = chalk.blue('💭 Thought')
      context = ''
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`
    const border = '─'.repeat(Math.max(header.length, thought.length) + 4)

    return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`
  }

  public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const validatedInput = this.validateThoughtData(input)

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber
      }

      this.thoughtHistory.push(validatedInput)

      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = []
        }
        this.branches[validatedInput.branchId].push(validatedInput)
      }

      const formattedThought = this.formatThought(validatedInput)
      logger.error(formattedThought)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                thought: validatedInput.thought,
                thoughtNumber: validatedInput.thoughtNumber,
                totalThoughts: validatedInput.totalThoughts,
                nextThoughtNeeded: validatedInput.nextThoughtNeeded,
                branches: Object.keys(this.branches),
                thoughtHistoryLength: this.thoughtHistory.length
              },
              null,
              2
            )
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                status: 'failed'
              },
              null,
              2
            )
          }
        ],
        isError: true
      }
    }
  }

  // ==================== 思维融合 (VCPToolBox 对标: 超动态递归融合) ====================

  /**
   * 融合多个思维步骤
   * 支持多种融合策略: consensus, debate, expansion, compression
   */
  public async fuseThoughts(input: unknown): Promise<{
    content: Array<{ type: string; text: string }>
    isError?: boolean
  }> {
    try {
      const data = input as Record<string, unknown>

      // 获取待融合的思维
      let thoughtsToFuse: string[]

      if (data.thoughtNumbers && Array.isArray(data.thoughtNumbers)) {
        // 指定思维编号
        const numbers = data.thoughtNumbers as number[]
        thoughtsToFuse = numbers
          .map((n) => this.thoughtHistory.find((t) => t.thoughtNumber === n)?.thought)
          .filter((t): t is string => !!t)
      } else if (data.branchId && typeof data.branchId === 'string') {
        // 融合分支思维
        const branchThoughts = this.branches[data.branchId] || []
        thoughtsToFuse = branchThoughts.map((t) => t.thought)
      } else {
        // 默认融合所有思维
        thoughtsToFuse = this.thoughtHistory.map((t) => t.thought)
      }

      if (thoughtsToFuse.length < 2) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Need at least 2 thoughts to fuse',
                  availableThoughts: this.thoughtHistory.length
                },
                null,
                2
              )
            }
          ],
          isError: true
        }
      }

      // 获取融合策略
      const strategyName = (data.strategy as string) || 'consensus'
      const fusionService = getDynamicFusionService()

      // 验证策略是否存在
      if (!fusionService.getStrategy(strategyName)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Unknown fusion strategy: ${strategyName}`,
                  availableStrategies: fusionService.getAvailableStrategies()
                },
                null,
                2
              )
            }
          ],
          isError: true
        }
      }

      // 执行融合 (使用字符串版本的 API)
      const context = (data.context as string) || 'Fuse the following thoughts into a coherent synthesis'
      const fusionResult = await fusionService.fuseStrings(thoughtsToFuse, context, strategyName)

      // 格式化输出
      const formattedResult = this.formatFusionResult(fusionResult, strategyName, thoughtsToFuse.length)
      logger.info(formattedResult)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                fusedThought: fusionResult.result,
                strategy: strategyName,
                inputCount: thoughtsToFuse.length,
                confidence: fusionResult.confidence,
                iterations: fusionResult.iterations,
                metadata: fusionResult.metadata
              },
              null,
              2
            )
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                status: 'fusion_failed'
              },
              null,
              2
            )
          }
        ],
        isError: true
      }
    }
  }

  /**
   * 递归融合思维 (多轮迭代直到收敛)
   */
  public async recursiveFuse(input: unknown): Promise<{
    content: Array<{ type: string; text: string }>
    isError?: boolean
  }> {
    try {
      const data = input as Record<string, unknown>

      const thoughts = this.thoughtHistory.map((t) => t.thought)
      if (thoughts.length < 2) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Need at least 2 thoughts for recursive fusion' }, null, 2)
            }
          ],
          isError: true
        }
      }

      const maxIterations = (data.maxIterations as number) || 3
      const convergenceThreshold = (data.convergenceThreshold as number) || 0.9
      const context = (data.context as string) || 'Recursively refine and synthesize these thoughts'

      const fusionService = getDynamicFusionService()
      const result = await fusionService.recursiveFuseStrings(thoughts, context, {
        maxIterations,
        convergenceThreshold,
        strategy: (data.strategy as string) || 'consensus'
      })

      logger.info(
        chalk.magenta(
          `🔄 Recursive Fusion Complete: ${result.iterations} iterations, confidence: ${result.confidence.toFixed(2)}`
        )
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                finalResult: result.result,
                iterations: result.iterations,
                confidence: result.confidence,
                converged: result.confidence >= convergenceThreshold,
                inputThoughtCount: thoughts.length
              },
              null,
              2
            )
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)
          }
        ],
        isError: true
      }
    }
  }

  private formatFusionResult(
    result: { result: string; confidence: number; iterations: number },
    strategy: string,
    inputCount: number
  ): string {
    const header = chalk.magenta(`🔀 Fusion [${strategy}] - ${inputCount} thoughts → 1`)
    const confidence = chalk.cyan(`Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    const iterations = chalk.yellow(`Iterations: ${result.iterations}`)

    return `
${header}
${confidence} | ${iterations}
────────────────────────────────────────
${result.result.substring(0, 200)}${result.result.length > 200 ? '...' : ''}
────────────────────────────────────────`
  }
}

const SEQUENTIAL_THINKING_TOOL: Tool = {
  name: 'sequentialthinking',
  description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust total_thoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
* Regular analytical steps
* Revisions of previous thoughts
* Questions about previous decisions
* Realizations about needing more analysis
* Changes in approach
* Hypothesis generation
* Hypothesis verification
- next_thought_needed: True if you need more thinking, even if at what seemed like the end
- thought_number: Current number in sequence (can go beyond initial total if needed)
- total_thoughts: Current estimate of thoughts needed (can be adjusted up/down)
- is_revision: A boolean indicating if this thought revises previous thinking
- revises_thought: If is_revision is true, which thought number is being reconsidered
- branch_from_thought: If branching, which thought number is the branching point
- branch_id: Identifier for the current branch (if any)
- needs_more_thoughts: If reaching end but realizing more thoughts needed

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set next_thought_needed to false when truly done and a satisfactory answer is reached`,
  inputSchema: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Your current thinking step'
      },
      nextThoughtNeeded: {
        type: 'boolean',
        description: 'Whether another thought step is needed'
      },
      thoughtNumber: {
        type: 'integer',
        description: 'Current thought number',
        minimum: 1
      },
      totalThoughts: {
        type: 'integer',
        description: 'Estimated total thoughts needed',
        minimum: 1
      },
      isRevision: {
        type: 'boolean',
        description: 'Whether this revises previous thinking'
      },
      revisesThought: {
        type: 'integer',
        description: 'Which thought is being reconsidered',
        minimum: 1
      },
      branchFromThought: {
        type: 'integer',
        description: 'Branching point thought number',
        minimum: 1
      },
      branchId: {
        type: 'string',
        description: 'Branch identifier'
      },
      needsMoreThoughts: {
        type: 'boolean',
        description: 'If more thoughts are needed'
      }
    },
    required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts']
  }
}

// ==================== 思维融合工具 (VCPToolBox 对标) ====================

const FUSE_THOUGHTS_TOOL: Tool = {
  name: 'fusethoughts',
  description: `Fuse multiple sequential thoughts into a coherent synthesis using various strategies.

This tool takes your thought history and combines them using one of several fusion strategies:
- consensus: Find common ground and synthesize agreement
- debate: Explore contradictions and resolve them
- expansion: Elaborate and expand on ideas
- compression: Distill to essential points

When to use:
- After completing several sequential thoughts to create a summary
- To combine branched thoughts back into a single thread
- To resolve conflicting ideas from different thought branches
- To create a final synthesis before concluding

The fusion result can be used as input for further thinking or as a final output.`,
  inputSchema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['consensus', 'debate', 'expansion', 'compression'],
        description: 'Fusion strategy to use (default: consensus)'
      },
      thoughtNumbers: {
        type: 'array',
        items: { type: 'integer', minimum: 1 },
        description: 'Specific thought numbers to fuse (optional, defaults to all)'
      },
      branchId: {
        type: 'string',
        description: 'Fuse thoughts from a specific branch (optional)'
      },
      context: {
        type: 'string',
        description: 'Additional context for the fusion process'
      }
    }
  }
}

const RECURSIVE_FUSE_TOOL: Tool = {
  name: 'recursivefuse',
  description: `Recursively fuse thoughts through multiple iterations until convergence.

This tool repeatedly applies fusion strategies to your thoughts, refining the result
with each iteration until a convergence threshold is reached or max iterations hit.

Best for:
- Complex thought chains that need multiple passes to synthesize
- When you want the highest quality synthesis possible
- Resolving deeply nested or branched thought structures

The recursive process automatically adjusts confidence based on how stable
the output becomes between iterations.`,
  inputSchema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['consensus', 'debate', 'expansion', 'compression'],
        description: 'Fusion strategy to use (default: consensus)'
      },
      maxIterations: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Maximum fusion iterations (default: 3)'
      },
      convergenceThreshold: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence threshold to stop iteration (default: 0.9)'
      },
      context: {
        type: 'string',
        description: 'Additional context for the fusion process'
      }
    }
  }
}

class ThinkingServer {
  public server: Server
  private thinkingServer: SequentialThinkingServer

  constructor() {
    this.thinkingServer = new SequentialThinkingServer()
    this.server = new Server(
      {
        name: 'sequential-thinking-server',
        version: '0.3.0' // Updated for fusion support
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.initialize()
  }

  initialize() {
    // 注册所有工具 (包含融合工具)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [SEQUENTIAL_THINKING_TOOL, FUSE_THOUGHTS_TOOL, RECURSIVE_FUSE_TOOL]
    }))

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      switch (name) {
        case 'sequentialthinking':
          return this.thinkingServer.processThought(args)

        case 'fusethoughts':
          return this.thinkingServer.fuseThoughts(args)

        case 'recursivefuse':
          return this.thinkingServer.recursiveFuse(args)

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`
              }
            ],
            isError: true
          }
      }
    })
  }
}

export default ThinkingServer
