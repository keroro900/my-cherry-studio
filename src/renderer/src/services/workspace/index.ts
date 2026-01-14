/**
 * Workspace Services
 *
 * 工作区相关服务模块，移植自 Eclipse Theia
 */

// 内容替换器
export { ContentReplacer, ContentReplacerV2, contentReplacer, contentReplacerV2 } from './ContentReplacer'
export type { IContentReplacer, Replacement, ReplacementResult } from './ContentReplacer'

// 工作区函数
export {
  WorkspaceFunctions,
  getDirectoryStructure,
  readFileContent,
  findFilesByPattern,
  getFileList,
  searchInFiles
} from './WorkspaceFunctions'
export type {
  FileEntry,
  DirectoryStructureOptions,
  FileSearchOptions,
  ReadFileOptions,
  FileDiagnostic
} from './WorkspaceFunctions'
