/**
 * Git 服务
 *
 * 提供结构化的 Git 操作，用于 Cherry Code IDE 功能
 * 通过 IPC 暴露给渲染进程使用
 */

import { exec } from 'child_process'
import { promisify } from 'util'

import { loggerService } from '@logger'

const execAsync = promisify(exec)
const logger = loggerService.withContext('GitService')

// ==================== 类型定义 ====================

export interface GitStatus {
  branch: string
  tracking?: string
  ahead: number
  behind: number
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
  conflicts: string[]
  isClean: boolean
  isRepo: boolean
}

export interface GitFileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unmerged'
  oldPath?: string // For renamed files
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: Date
  message: string
  body?: string
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
  tracking?: string
  ahead?: number
  behind?: number
}

export interface GitDiff {
  files: GitDiffFile[]
  additions: number
  deletions: number
}

export interface GitDiffFile {
  path: string
  additions: number
  deletions: number
  binary: boolean
  hunks: GitDiffHunk[]
}

export interface GitDiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

export interface GitRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface GitStash {
  index: number
  message: string
  branch: string
  date: Date
}

// ==================== Git 服务类 ====================

class GitService {
  /**
   * 检查目录是否是 Git 仓库
   */
  async isGitRepository(cwd: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取仓库根目录
   */
  async getRepoRoot(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd })
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * 获取 Git 状态
   */
  async getStatus(cwd: string): Promise<GitStatus> {
    const isRepo = await this.isGitRepository(cwd)
    if (!isRepo) {
      return {
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
        isClean: true,
        isRepo: false
      }
    }

    try {
      // 获取分支信息
      const branchInfo = await this.getBranchInfo(cwd)

      // 获取文件状态
      const { stdout: statusOutput } = await execAsync('git status --porcelain=v2 --branch', { cwd })
      const lines = statusOutput.trim().split('\n')

      const staged: GitFileChange[] = []
      const unstaged: GitFileChange[] = []
      const untracked: string[] = []
      const conflicts: string[] = []

      for (const line of lines) {
        if (line.startsWith('# branch.')) continue // Skip branch info lines

        if (line.startsWith('?')) {
          // Untracked file
          untracked.push(line.substring(2))
        } else if (line.startsWith('u')) {
          // Unmerged (conflict)
          const parts = line.split('\t')
          if (parts.length > 1) {
            conflicts.push(parts[parts.length - 1])
          }
        } else if (line.startsWith('1') || line.startsWith('2')) {
          // Changed file
          const parts = line.split(' ')
          if (parts.length >= 8) {
            const xy = parts[1]
            const filePath = line.split('\t').pop() || ''

            const indexStatus = xy[0]
            const worktreeStatus = xy[1]

            // Staged changes
            if (indexStatus !== '.') {
              staged.push({
                path: filePath,
                status: this.parseStatusChar(indexStatus)
              })
            }

            // Unstaged changes
            if (worktreeStatus !== '.') {
              unstaged.push({
                path: filePath,
                status: this.parseStatusChar(worktreeStatus)
              })
            }
          }
        }
      }

      const isClean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && conflicts.length === 0

      return {
        branch: branchInfo.name,
        tracking: branchInfo.tracking,
        ahead: branchInfo.ahead,
        behind: branchInfo.behind,
        staged,
        unstaged,
        untracked,
        conflicts,
        isClean,
        isRepo: true
      }
    } catch (error) {
      logger.error('Failed to get git status', { error })
      throw error
    }
  }

  /**
   * 获取分支信息
   */
  private async getBranchInfo(cwd: string): Promise<{ name: string; tracking?: string; ahead: number; behind: number }> {
    try {
      const { stdout: branchName } = await execAsync('git branch --show-current', { cwd })
      const name = branchName.trim()

      // 获取远程跟踪信息
      let tracking: string | undefined
      let ahead = 0
      let behind = 0

      try {
        const { stdout: trackingInfo } = await execAsync(`git rev-parse --abbrev-ref ${name}@{upstream}`, { cwd })
        tracking = trackingInfo.trim()

        // 获取 ahead/behind
        const { stdout: abInfo } = await execAsync(`git rev-list --left-right --count ${name}...${tracking}`, { cwd })
        const [aheadStr, behindStr] = abInfo.trim().split(/\s+/)
        ahead = parseInt(aheadStr, 10) || 0
        behind = parseInt(behindStr, 10) || 0
      } catch {
        // No tracking branch
      }

      return { name, tracking, ahead, behind }
    } catch (error) {
      logger.error('Failed to get branch info', { error })
      return { name: 'HEAD', ahead: 0, behind: 0 }
    }
  }

  /**
   * 解析状态字符
   */
  private parseStatusChar(char: string): GitFileChange['status'] {
    switch (char) {
      case 'A':
        return 'added'
      case 'M':
        return 'modified'
      case 'D':
        return 'deleted'
      case 'R':
        return 'renamed'
      case 'C':
        return 'copied'
      case 'U':
        return 'unmerged'
      default:
        return 'modified'
    }
  }

  /**
   * 暂存文件
   */
  async stageFiles(cwd: string, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      await execAsync('git add -A', { cwd })
    } else {
      const pathsArg = paths.map((p) => `"${p}"`).join(' ')
      await execAsync(`git add ${pathsArg}`, { cwd })
    }
    logger.info('Files staged', { paths: paths.length === 0 ? 'all' : paths })
  }

  /**
   * 取消暂存文件
   */
  async unstageFiles(cwd: string, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      await execAsync('git reset HEAD', { cwd })
    } else {
      const pathsArg = paths.map((p) => `"${p}"`).join(' ')
      await execAsync(`git reset HEAD ${pathsArg}`, { cwd })
    }
    logger.info('Files unstaged', { paths: paths.length === 0 ? 'all' : paths })
  }

  /**
   * 提交更改
   */
  async commit(cwd: string, message: string, options?: { amend?: boolean; noVerify?: boolean }): Promise<GitCommit> {
    let cmd = 'git commit'
    if (options?.amend) cmd += ' --amend'
    if (options?.noVerify) cmd += ' --no-verify'
    cmd += ` -m "${message.replace(/"/g, '\\"')}"`

    await execAsync(cmd, { cwd })

    // 获取刚创建的提交信息
    const commits = await this.getLog(cwd, 1)
    logger.info('Commit created', { hash: commits[0]?.shortHash })
    return commits[0]
  }

  /**
   * 获取提交历史
   */
  async getLog(cwd: string, limit = 50, options?: { path?: string; author?: string }): Promise<GitCommit[]> {
    let cmd = `git log -${limit} --format="%H|%h|%an|%ae|%aI|%s|%b---END---"`
    if (options?.path) cmd += ` -- "${options.path}"`
    if (options?.author) cmd += ` --author="${options.author}"`

    const { stdout } = await execAsync(cmd, { cwd })
    const commits: GitCommit[] = []

    const entries = stdout.split('---END---').filter((e) => e.trim())
    for (const entry of entries) {
      const [hash, shortHash, author, email, dateStr, message, ...bodyParts] = entry.trim().split('|')
      commits.push({
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        body: bodyParts.join('|').trim() || undefined
      })
    }

    return commits
  }

  /**
   * 获取差异
   */
  async getDiff(cwd: string, options?: { staged?: boolean; path?: string }): Promise<string> {
    let cmd = 'git diff'
    if (options?.staged) cmd += ' --staged'
    if (options?.path) cmd += ` -- "${options.path}"`

    const { stdout } = await execAsync(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 })
    return stdout
  }

  /**
   * 获取分支列表
   */
  async getBranches(cwd: string): Promise<GitBranch[]> {
    const { stdout } = await execAsync('git branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)|%(HEAD)"', { cwd })
    const branches: GitBranch[] = []

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      const [name, , tracking, head] = line.split('|')
      const current = head === '*'
      const remote = name.startsWith('remotes/')

      branches.push({
        name: remote ? name.replace('remotes/', '') : name,
        current,
        remote,
        tracking: tracking || undefined
      })
    }

    return branches
  }

  /**
   * 切换分支
   */
  async checkout(cwd: string, branch: string, options?: { create?: boolean }): Promise<void> {
    let cmd = 'git checkout'
    if (options?.create) cmd += ' -b'
    cmd += ` "${branch}"`

    await execAsync(cmd, { cwd })
    logger.info('Checked out branch', { branch, created: options?.create })
  }

  /**
   * 获取远程列表
   */
  async getRemotes(cwd: string): Promise<GitRemote[]> {
    const { stdout } = await execAsync('git remote -v', { cwd })
    const remotes = new Map<string, GitRemote>()

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      const [name, url, type] = line.split(/\s+/)
      const remote = remotes.get(name) || { name, fetchUrl: '', pushUrl: '' }

      if (type === '(fetch)') {
        remote.fetchUrl = url
      } else if (type === '(push)') {
        remote.pushUrl = url
      }

      remotes.set(name, remote)
    }

    return Array.from(remotes.values())
  }

  /**
   * 拉取更新
   */
  async pull(cwd: string, options?: { remote?: string; branch?: string; rebase?: boolean }): Promise<string> {
    let cmd = 'git pull'
    if (options?.rebase) cmd += ' --rebase'
    if (options?.remote) cmd += ` ${options.remote}`
    if (options?.branch) cmd += ` ${options.branch}`

    const { stdout } = await execAsync(cmd, { cwd })
    logger.info('Pull completed')
    return stdout
  }

  /**
   * 推送更改
   */
  async push(cwd: string, options?: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean }): Promise<string> {
    let cmd = 'git push'
    if (options?.force) cmd += ' --force'
    if (options?.setUpstream) cmd += ' -u'
    if (options?.remote) cmd += ` ${options.remote}`
    if (options?.branch) cmd += ` ${options.branch}`

    const { stdout } = await execAsync(cmd, { cwd })
    logger.info('Push completed')
    return stdout
  }

  /**
   * 获取文件内容（特定版本）
   */
  async showFile(cwd: string, path: string, ref = 'HEAD'): Promise<string> {
    const { stdout } = await execAsync(`git show ${ref}:"${path}"`, { cwd })
    return stdout
  }

  /**
   * 丢弃工作区更改
   */
  async discardChanges(cwd: string, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      await execAsync('git checkout -- .', { cwd })
    } else {
      const pathsArg = paths.map((p) => `"${p}"`).join(' ')
      await execAsync(`git checkout -- ${pathsArg}`, { cwd })
    }
    logger.info('Changes discarded', { paths: paths.length === 0 ? 'all' : paths })
  }

  /**
   * 重置到特定提交
   */
  async reset(cwd: string, ref: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
    await execAsync(`git reset --${mode} ${ref}`, { cwd })
    logger.info('Reset completed', { ref, mode })
  }

  /**
   * 创建 Stash
   */
  async stash(cwd: string, message?: string): Promise<void> {
    let cmd = 'git stash push'
    if (message) cmd += ` -m "${message}"`

    await execAsync(cmd, { cwd })
    logger.info('Changes stashed', { message })
  }

  /**
   * 应用 Stash
   */
  async stashPop(cwd: string, index = 0): Promise<void> {
    await execAsync(`git stash pop stash@{${index}}`, { cwd })
    logger.info('Stash applied', { index })
  }

  /**
   * 获取 Stash 列表
   */
  async getStashList(cwd: string): Promise<GitStash[]> {
    const { stdout } = await execAsync('git stash list --format="%gd|%s|%ai"', { cwd })
    const stashes: GitStash[] = []

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      const [indexStr, message, dateStr] = line.split('|')
      const index = parseInt(indexStr.match(/\d+/)?.[0] || '0', 10)
      const branchMatch = message.match(/WIP on (.+?):/)

      stashes.push({
        index,
        message,
        branch: branchMatch?.[1] || 'unknown',
        date: new Date(dateStr)
      })
    }

    return stashes
  }

  /**
   * 获取文件 blame 信息
   */
  async blame(cwd: string, path: string): Promise<Array<{ hash: string; author: string; date: Date; line: number; content: string }>> {
    const { stdout } = await execAsync(`git blame --line-porcelain "${path}"`, { cwd })
    const lines = stdout.split('\n')
    const result: Array<{ hash: string; author: string; date: Date; line: number; content: string }> = []

    let currentHash = ''
    let currentAuthor = ''
    let currentDate = new Date()
    let currentLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.match(/^[0-9a-f]{40}/)) {
        const parts = line.split(' ')
        currentHash = parts[0].substring(0, 8)
        currentLine = parseInt(parts[2], 10)
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7)
      } else if (line.startsWith('author-time ')) {
        currentDate = new Date(parseInt(line.substring(12), 10) * 1000)
      } else if (line.startsWith('\t')) {
        result.push({
          hash: currentHash,
          author: currentAuthor,
          date: currentDate,
          line: currentLine,
          content: line.substring(1)
        })
      }
    }

    return result
  }

  /**
   * 初始化仓库
   */
  async init(cwd: string): Promise<void> {
    await execAsync('git init', { cwd })
    logger.info('Repository initialized', { cwd })
  }

  /**
   * 克隆仓库
   */
  async clone(url: string, targetDir: string, options?: { branch?: string; depth?: number }): Promise<void> {
    let cmd = `git clone "${url}" "${targetDir}"`
    if (options?.branch) cmd += ` -b ${options.branch}`
    if (options?.depth) cmd += ` --depth ${options.depth}`

    await execAsync(cmd)
    logger.info('Repository cloned', { url, targetDir })
  }
}

// ==================== 单例导出 ====================

let gitService: GitService | null = null

export function getGitService(): GitService {
  if (!gitService) {
    gitService = new GitService()
  }
  return gitService
}

export default GitService
