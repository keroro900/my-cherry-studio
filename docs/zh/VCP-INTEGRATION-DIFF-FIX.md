# VCP 功能/协议对齐差异与任务清单

本文件聚焦 Cherry Studio 与外部 VCPChat / VCPToolBox 的功能与协议对齐，不评估 UI 皮肤与视觉风格。

## 范围与约束

- 仅对齐功能与协议，不做 UI 皮肤一致性评估
- 静态代码审查为主，未运行应用
- 参考仓库:
  - `external/VCPChat`
  - `external/VCPToolBox`
  - `cherry-studio/docs/VCP-ARCHITECTURE.md`

## 差异摘要 (功能与协议)

- TOOL_REQUEST 解析与 VCPToolBox 多行参数协议不兼容
  - 证据: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
  - 参考: `external/VCPToolBox/README.md`
- 异步插件回调机制缺失
  - 证据: `external/VCPToolBox/README.md`
- TOOL_RESULT 仅文本标记，缺少结构化渲染
  - 证据: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
- MeshMemo 搜索不可用 (空数据 + add/clear 未实现)
  - 证据: `cherry-studio/src/main/services/AdvancedMemoryIpcHandler.ts`
- 动态 K/Time/Group/TagMemo 语法未贯通检索链路
  - 证据: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`
  - 证据: `cherry-studio/src/main/knowledge/vcp/VCPSearchService.ts`
- VCPAgent 模板/变量未进入系统提示词
  - 证据: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts`
- vcpInfo/vcpLog 未接入前端
  - 证据: `cherry-studio/src/preload/index.ts`

## 架构差异点 (对照 VCP-ARCHITECTURE)

- `window.api.advancedMemory` 已暴露但无前端消费入口
  - 证据: `cherry-studio/src/preload/index.ts`
- vcpInfo/vcpLog 服务存在但前端未订阅
  - 证据: `cherry-studio/src/main/services/VCPInfoService.ts`
  - 证据: `cherry-studio/src/main/services/VCPLogService.ts`
- 群聊 UI 文档入口与实际入口不一致
  - 文档: `cherry-studio/docs/VCP-ARCHITECTURE.md`
  - 实际: `cherry-studio/src/renderer/src/pages/home/Chat.tsx`
- ContextPurifier/HallucinationSuppressor 未接入请求链路
  - 证据: `cherry-studio/src/main/knowledge/context/ContextPurifier.ts`
  - 证据: `cherry-studio/src/main/knowledge/context/HallucinationSuppressor.ts`
- DeepMemo Tantivy 适配未接入，仅 BM25 fallback
  - 证据: `cherry-studio/src/main/knowledge/deepMemo/DeepMemoService.ts`
- MeshMemo 数据流缺失
  - 证据: `cherry-studio/src/main/services/AdvancedMemoryIpcHandler.ts`

## 缺失与可融合功能

### 缺失核心功能

- 异步插件回调 `{{VCP_ASYNC_RESULT::PluginName::TaskID}}`
  - 参考: `external/VCPToolBox/README.md`
- 服务/混合插件类型
  - 参考: `external/VCPToolBox/README.md`
- 动态 K / Time / Group / TagMemo 修饰符贯通
  - 参考: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts`
- VCPTool 工具结果结构化渲染
  - 参考: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts`
- Flow Lock 交互模式
  - 参考: `cherry-studio/docs/VCP-ARCHITECTURE.md`

### 可融合功能 (仅功能/协议)

- VCPToolBox 异步任务回调协议
- VCPChat 工具交互气泡能力 (工具结果渲染层)
- VCPChat 全局搜索与对话分支能力 (功能入口层)
- VCPChat TTS / 语音输入能力 (多模态交互层)
- VCPChat 插件窗口能力 (工具执行结果呈现)

## 可追踪任务清单

- [ ] T-001 [P0] TOOL_REQUEST 解析兼容多行与 `key:「始」value「末」` 格式并做 key 归一化 | 验收: 覆盖多行/大小写/分隔符测试用例 | 证据: `cherry-studio/src/renderer/src/aiCore/plugins/vcpContextPlugin.ts` | 依赖: 无
- [ ] T-002 [P0] 接入异步插件回调 `{{VCP_ASYNC_RESULT::...}}` 协议 | 验收: 长耗时任务可闭环并生成结果注入 | 证据: `external/VCPToolBox/README.md` | 依赖: T-001
- [ ] T-003 [P0] MeshMemo 完成 add/clear/search 数据流并接入真实 chunks | 验收: MeshMemo 检索返回非空结果 | 证据: `cherry-studio/src/main/services/AdvancedMemoryIpcHandler.ts` | 依赖: 无
- [ ] T-004 [P0] 动态 K/Time/Group/TagMemo 语法贯通到 VCPSearchService | 验收: `[[kb:1.5::Time::Group]]` 生效 | 证据: `cherry-studio/src/main/knowledge/modes/DiaryModeParser.ts` | 依赖: 无
- [ ] T-005 [P1] TOOL_RESULT/TOOL_ERROR 结构化渲染组件接入消息流 | 验收: 工具结果非纯文本显示 | 证据: `cherry-studio/src/renderer/src/pages/home/Messages/Tools/MessageAgentTools/index.tsx` | 依赖: T-001
- [ ] T-006 [P1] VCPAgent 模板/变量渲染进入系统提示词 | 验收: 变量替换生效且可复用模板 | 证据: `cherry-studio/src/main/knowledge/agent/VCPAgentService.ts` | 依赖: 无
- [ ] T-007 [P1] ContextPurifier/HallucinationSuppressor 接入请求链路 | 验收: 请求前后净化/抑制可配置生效 | 证据: `cherry-studio/src/main/knowledge/context/ContextPurifier.ts` | 依赖: 无
- [ ] T-008 [P1] 前端接入 vcpInfo/vcpLog 事件订阅 | 验收: 调用状态与日志可视化 | 证据: `cherry-studio/src/main/services/VCPInfoService.ts` | 依赖: 无
- [ ] T-009 [P1] advancedMemory 前端消费入口 | 验收: Light/Deep/Mesh 搜索可触达 | 证据: `cherry-studio/src/preload/index.ts` | 依赖: T-003
- [ ] T-010 [P2] DeepMemo Tantivy 适配接入 | 验收: keyword backend 可切换为 tantivy | 证据: `cherry-studio/src/main/knowledge/deepMemo/DeepMemoService.ts` | 依赖: 无
- [ ] T-011 [P2] Flow Lock 模式落地 | 验收: 锁定话题与 AI 主动触发可用 | 证据: `cherry-studio/docs/VCP-ARCHITECTURE.md` | 依赖: 无
- [ ] T-012 [P2] 群聊入口与文档一致性对齐 (功能入口层) | 验收: 文档示例与实际入口一致 | 证据: `cherry-studio/docs/VCP-ARCHITECTURE.md` | 依赖: 无

## 最小验证集

- TOOL_REQUEST 解析单元测试 (多行、混合格式、key 归一化)
- 异步插件闭环测试 (任务创建 -> 回调 -> 结果注入)
- 检索协议测试 (动态 K/Time/Group/TagMemo)
