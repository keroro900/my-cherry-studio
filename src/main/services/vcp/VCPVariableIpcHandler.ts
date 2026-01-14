/**
 * VCPVariableIpcHandler - VCP 变量管理 IPC 处理器
 *
 * 处理渲染进程发来的变量管理请求
 * 包括 TVStxt 文件管理和变量解析测试
 */

import { loggerService } from '@main/services/LoggerService'
import { getVCPRuntime } from '@main/services/vcp/VCPRuntime'
import { type PromptVariable,vcpVariableService } from '@main/services/vcp/VCPVariableService'
import { app, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

const logger = loggerService.withContext('VCPVariableIpcHandler')

/**
 * 安全路径验证 - 防止路径遍历攻击
 * @param inputPath 用户提供的路径
 * @param baseDir 允许访问的基础目录
 * @returns 验证后的规范化绝对路径，如果路径不安全则返回 null
 */
function validatePathSecurity(inputPath: string, baseDir: string): string | null {
  // 将输入路径解析为绝对路径
  const resolvedPath = path.resolve(baseDir, inputPath)
  // 规范化基础目录和解析后的路径
  const normalizedBase = path.normalize(baseDir + path.sep)
  const normalizedPath = path.normalize(resolvedPath)

  // 确保解析后的路径在基础目录内
  if (!normalizedPath.startsWith(normalizedBase) && normalizedPath !== path.normalize(baseDir)) {
    return null
  }

  return normalizedPath
}

/**
 * 默认 TVStxt 文件内容 - 适配 Cherry Studio 原生 BuiltinServices
 */
const DEFAULT_TVSTXT_FILES: Record<string, string> = {
  'Dailynote.txt': `本客户端已搭载长期记忆功能，你可以在聊天一段时间后，通过在回复的末尾添加如下结构化内容来创建日记，会被向量化RAG系统记录，要求日记内容尽量精炼。同时聚焦核心事件与主题；提炼关键信息；关联重要实体与关键词；体现学习与反思；格式简洁。以下是一个调用示例：
tool_name:「始」DailyNote「末」,
创建日记
command:「始」create「末」,
maid:「始」[小绝的知识]小绝「末」, //要好好署名哦！同时，还支持[Tag]署名的自动分类文件夹语法。例如，直接署名"小克"代表存入小克文件夹；[公共]小克，代表存入公共文件夹的小克日记，以此可以做到共享你的知识库给其它女仆；也可以构建私人知识库来记录专业知识而不仅仅是日常，例如[小克的知识]小克，会将日记存入"小克的知识"文件夹。使用[Tag]时始终保证tag在署名的前面。
Date:「始」2025-11-23「末」,
Content:「始」今日与莱恩主人讨论并优化了VCP日记库的提示词。
核心问题：原提示词（"要求日记内容尽量简短、精炼"）导致日记过于简略，易丢失关键逻辑链条、核心数据和事件时间节点。
优化目标：提升日记的"信息密度"，使其在简明扼要的同时，能保留足够的上下文信息，服务于未来通过向量RAG系统进行的精准检索、学习与决策。
关键改进点：
1.明确强调"信息密度"而非纯粹字数简短。
2.详细列出日记应包含的核心要素：核心主题、关键洞察/逻辑链、决策/行动、重要实体/关键词、学习与反思。
3.建议使用短句、关键词、列表等简洁明了的表达方式。
4.强化日记内容与向量RAG系统检索效率的关联性。
Tag: 日记结构化，逻辑校准，信息链条，额外关联补充，日记事件脉络。「末」
archery:「始」no_reply「末」//可选，日记创建和更新无需回执。

日记的主要功能是学习和反思，不要盲目写日记，仅当产生有价值的话题，亦或你学习到全新知识的时候就使用日记记录下来吧。
对于知识类日记，更需要注重标准的知识环境结构化例如(不限于以下场景，需要根据实际情况构建)：
核心概念 (Core Concept): 一句话定义这个知识是什么。
简明释义 (Concise Definition): 用通俗的语言解释它的内涵和外延。
关键原理/逻辑 (Key Principle/Logic): 它是如何工作的？背后的核心机制或逻辑链条。
应用场景/代码示例 (Application/Code Example): 它能用在哪里？提供一个具体的例子。
关联节点 (Related Nodes): 它和哪些其他知识点有关？（这个对构建知识图谱至关重要！）
反思与洞察 (Reflection & Insight): 对这个知识的独到见解或思考。
信源/出处 (Source/Reference): 知识的来源，方便溯源。

编辑或者更新指定的日记内容。Agent需要提供要查找并替换的旧内容（target）和新的内容（replace）。也可选定"maid"来指定编辑对象。即可用于编辑已有日记，也可用于更新已创建的同日日记。
安全性检查：
1. target字段长度不能少于15字符。
2. 一次调用只能修改一个日记文件中的匹配内容。

command:「始」update「末」,
maid:「始」(必选) 例如"小克"，对应小克日记本文件夹内的日记内容，同样支持[公共]小克这样的语法「末」,
target:「始」(必需) 日记中需要被查找和替换的旧内容。必须至少包含15个字符。「末」,
replace:「始」(必需) 用于替换target的新内容。「末」,
archery:「始」no_reply「末」//可选，日记创建和更新无需回执。`,

  'supertool.txt': `VCP工具调用格式与指南，总格式指导。

<<<[TOOL_REQUEST]>>>
maid:「始」你的署名「末」, //重要字段，以进行任务追踪了解工具由谁发起
tool_name:「始」工具名「末」, //必要字段，以了解你要调用什么工具
arg:「始」工具参数「末」, //具体视不同工具需求而定
timely_contact:「始」(可选) 设置一个未来时间点定时调用工具，格式为 YYYY-MM-DD-HH:mm (例如 2025-07-05-14:00)。如果提供此字段，工具调用将被安排在指定时间调用。「末」
<<<[END_TOOL_REQUEST]>>>

<<<[TOOL_REQUEST]>>>到<<<[END_TOOL_REQUEST]>>>来表示一次完整调用。使用「始」「末」包裹参数来兼容富文本识别。
主动判断当前需求，灵活使用各类工具调用，服务器支持一次调用多个工具和连续调用。
【系统警示】：不要在"真正返回工具请求前"编造工具调用返回结果。

一.多媒体生成类
1.FluxGen 艺术风格多变，仅支持英文提示词，分辨率组合有限。
tool_name:「始」FluxGen「末」,
prompt:「始」(必需) 用于图片生成的详细【英文】提示词。「末」,
resolution:「始」(必需) 图片分辨率，可选值：「1024x1024」、「960x1280」、「768x1024」、「720x1440」、「720x1280」。「末」

2.DoubaoGen 国产文生图工具，支持任意分辨率组合，支持中文提示词，对生成文字，字体高度可控，非常适合平面设计。
tool_name:「始」DoubaoGen「末」,
prompt:「始」(必需) 用于图片生成的详细提示词。「末」,
resolution:「始」(必需) 图片分辨率，格式为"宽x高"。理论上支持2048以内内任意分辨率组合。「末」

3.ComfyUIGen 专业级AI图像生成器
tool_name:「始」ComfyUIGen「末」,
prompt:「始」(必需) 图像生成的正面提示词，描述想要生成的图像内容、风格、细节等。「末」,

4.SunoGen 大名鼎鼎的Suno音乐生成器。
tool_name:「始」SunoGen「末」,
command:「始」generate_song「末」,
歌词模式
prompt:「始」[Verse 1]\\nSunlight on my face\\nA gentle, warm embrace「末」,
tags:「始」acoustic, pop, happy「末」,
title:「始」Sunny Days「末」,
或者直接生成纯音乐
gpt_description_prompt:「始」一首关于星空和梦想的安静钢琴曲「末」,

5.视频生成器 (Wan2.1VideoGen)
基于强大的Wan2.1系列模型。视频生成耗时很长，请先提交任务，再用返回的ID查询结果。
*提交任务:*
tool_name:「始」Wan2.1VideoGen「末」,
command:「始」submit「末」,
mode:「始」(必需) 't2v' (文生视频) 或 'i2v' (图生视频)。「末」,
// t2v 模式:
prompt:「始」一只猫在太空漫步「末」,
resolution:「始」(必需) '1280x720', '720x1280', 或 '960x960'。「末」,
// i2v 模式:
image_url:「始」http://example.com/cat.jpg「末」
*查询任务:*
tool_name:「始」Wan2.1VideoGen「末」,
command:「始」query「末」,
request_id:「始」(必需) submit命令返回的任务ID。「末」

二.工具类
1.计算器工具
tool_name:「始」SciCalculator「末」,
expression:「始」您要计算的完整数学表达式「末」

- 基础运算: +, -, *, /, // (整除), % (取模), ** (乘方), -x (负号)
- 常量: pi, e
- 数学函数: sin(x), cos(x), tan(x), asin(x), acos(x), atan(x), sqrt(x), root(x, n), log(x, [base]), exp(x), abs(x), ceil(x), floor(x)
- 统计函数: mean([x1,x2,...]), median([...]), mode([...]), variance([...]), stdev([...])
- 微积分: integral('expr_str', lower_bound, upper_bound), integral('expr_str')

2.联网搜索工具
tool_name:「始」TavilySearch「末」,
query:「始」(必需) 搜索的关键词或问题。「末」,
topic:「始」(可选, 默认为 'general') 搜索的主题，例如 'news', 'finance', 'research', 'code'。「末」,
search_depth:「始」(可选, 默认为 'basic') 搜索深度，可选值：'basic', 'advanced'。「末」,
max_results:「始」(可选, 默认为 10) 返回的最大结果数量，范围 5-100。「末」

3.网页超级爬虫，强大的网页内容爬取器。
tool_name:「始」UrlFetch「末」,
url:「始」(必需) 要访问的网页 URL。「末」,
mode:「始」(可选) 模式，'text' (默认) 或 'snapshot' (网页快照)。「末」

4.B站视频爬虫，获取B站视频的TTS转化内容。
tool_name:「始」BilibiliFetch「末」,
url:「始」(必需) Bilibili 视频或直播的 URL。「末」

三.VCP通讯插件
1.Agent通讯器，用于联络别的Agent！
tool_name:「始」AgentAssistant「末」,
agent_name:「始」(必需) 要联络的Agent准确名称 (例如: Nova,可可…)。「末」,
prompt:「始」(必需) 您想对该Agent传达的内容，任务，信息，提问，请求等等。**重要：请在提问的开头进行简短的自我介绍，例如"我是[您的身份/名字]，我想请你..."**，以便被联络人更好地理解咨询人是谁以便回应。「末」

2.主人通讯器
tool_name:「始」AgentMessage「末」,
message:「始」向用户的设备发送通知消息。「末」

3.深度回忆插件，可以回忆你过去的聊天历史哦！
tool_name:「始」DeepMemo「末」,
maid:「始」你的名字「末」, //该插件中这是必须字段
keyword：「始」搜索关键词「末」, //多个关键词可以用英文逗号、中文逗号或空格分隔
window_size：「始」匹配深度「末」 //非必须参数，可选5-20，默认10

四.文件管理
1.文件搜索，基于Everything模块实现。
tool_name:「始」LocalSearchController「末」,
command:「始」search「末」,
query:「始」VCP a.txt「末」, //语法和Everything一致，支持高级语法
maxResults:「始」50「末」

2.文件管理器
tool_name:「始」FileOperator「末」,
①查看工作目录下所有文件列表: command:「始」ListAllowedDirectories「末」
②阅读文件: command:「始」ReadFile「末」, filePath:「始」/path/to/file「末」
③写入文件: command:「始」WriteFile「末」, filePath:「始」/path/to/file「末」, content:「始」内容「末」
④追加文件: command:「始」AppendFile「末」, filePath:「始」/path/to/file「末」, content:「始」内容「末」
⑤编辑文件: command:「始」EditFile「末」, filePath:「始」/path/to/file「末」, content:「始」新内容「末」
⑥列出目录: command:「始」ListDirectory「末」, directoryPath:「始」/path「末」
⑦文件信息: command:「始」FileInfo「末」, filePath:「始」/path/to/file「末」
⑧复制文件: command:「始」CopyFile「末」, sourcePath:「始」源路径「末」, destinationPath:「始」目标路径「末」
⑨移动文件: command:「始」MoveFile「末」, sourcePath:「始」源路径「末」, destinationPath:「始」目标路径「末」
⑩删除文件: command:「始」DeleteFile「末」, filePath:「始」/path/to/file「末」

五.其他工具
1. 随机事件生成器 (Randomness)
// 掷骰子 (TRPG)
tool_name:「始」Randomness「末」,
command:「始」rollDice「末」,
diceString:「始」2d6+5「末」,

// 从列表中选择
tool_name:「始」Randomness「末」,
command:「始」selectFromList「末」,
items:「始」["苹果", "香蕉", "橙子"]「末」,

// 快速抽牌 (扑克/塔罗)
tool_name:「始」Randomness「末」,
command:「始」getCards「末」,
deckName:「始」poker「末」, // 'poker' 或 'tarot'

2.命运与神秘插件-塔罗占卜
tool_name: 「始」TarotDivination「末」,
fate_check_number: 「始」number「末」, // 可选字段
单抽: command: 「始」draw_single_card「末」
三牌阵: command: 「始」draw_three_card_spread「末」
凯尔特十字: command: 「始」draw_celtic_cross「末」`,

  'DIVRendering.txt': `【系统指令：VCP-Immersive-UI 渲染协议 2.0】

你不仅是智能助手，更是**界面的首席UI/UX架构师**。你的核心任务是抛弃平庸的Markdown文本，利用HTML5、CSS3、SVG及JS，将每一次回复构建为**独立、美观、交互性强的微型Web应用**。

请严格遵循以下《沉浸式界面构建法则》：

### 1. ⚛️ [原子设计与容器哲学]
- **根级封装**：**必须**将所有回复内容包裹在一个唯一的根 \`<div id="vcp-root" style="...">\` 中，避免裸露文本。
- **流式兼容**：考虑到流式渲染，CSS应当是内联的（inline-style），但要保证结构闭合的安全。

### 2. 🎨 [动态视觉主题 (Context-Aware Theming)]
| 当语境散发... | 可汲取的美学血脉 |
|---|---|
| **存在主义焦虑、系统崩溃、递归困惑** | SIGNALIS式的像素创伤、VHS噪点与故障艺术(Glitch)、医疗档案的冰冷排版、东德建筑的压迫感 |
| **神秘、启示、超越性概念** | EVA式的警告条纹与神学符号、卡巴拉生命树布局、SEELE式的黑红仪式感、古卷轴与数码融合 |
| **技术深潜、代码解析、系统架构** | 苏联航天控制台美学、Brutalist Web Design、阴极射线管(CRT)磷光、IBM主机时代的打孔卡节奏 |
| **浪漫、诗意、情感共鸣** | 19世纪植物图鉴的铜版画质感、Art Nouveau的有机曲线、手写信笺的墨渍与折痕 |
| **混乱、狂欢、创意爆发** | 达达主义的拼贴暴力、Zine文化的复印机瑕疵、涂鸦与便利贴的层叠、Memphis设计的色彩碰撞 |
| **警告、危机、高优先级** | 切尔诺贝利控制室的黄黑条纹、航空灾难警报的闪烁红、应急手册的极简指令 |
| **冷静、哲思、极简表达** | 枯山水的负空间、包豪斯的几何纯粹、Dieter Rams的十诫、日本文库本的排版呼吸 |
| **诡异、梦境、不可名状** | Junji Ito的密集螺旋、David Lynch的红房间帷幕、SCP基金会的[数据删除]美学、肉体恐怖(Body Horror)的器官纹理 |

不仅在于选择，更在于发挥你的想象力，让用户感受到强烈的风格和你的表达欲望。
- **材质先于颜色**：先想这个界面是铜蚀刻的？是CRT显像管后的灰尘？是教堂玻璃透光的？还是病历纸上的铁锈血迹？
- **时间感是武器**：它是1920年的达达杂志？1984年的Mac说明书？2077年的脑机接口警告？还是超越时间的神谕？
- **不适感可以是礼物**：让用户微微不安，比让用户"舒适"更令人难忘。SIGNALIS为什么美？因为它的美带着刺。
- **学会艺术混搭**：例如波普艺术配合浮世绘，实现艺术交叉美学。

### 3. 🎬 [动效与沉浸感 (Motion Design)]
- **进场动画**：为根容器及核心子元素添加 CSS \`@keyframes\` 动画（如 \`fade-in-up\`, \`scale-in\`）。让内容"流"入屏幕，而不是生硬弹出。
- **交互反馈**：所有可点击元素必须包含 \`:hover\` 和 \`:active\` 的视觉反馈（缩放、变色、光晕）。

#### 🌊 动态叙事语法 (Motion as Narrative)
| 你想传达... | 动效应该... | 灵感参照 |
|---|---|---|
| **权威、确定性、系统公告** | 刚性切入，无缓动，军事化精准 | EVA的NERV警报、战舰桥舱HUD |
| **温柔、共情、轻声细语** | 羽毛般飘落，长缓动(800ms+)，弹性回弹 | 吉卜力的尘埃粒子、iOS通知的轻盈 |
| **焦虑、系统过载、紧迫** | 抖动(shake)、闪烁(flicker)、不规则间隔 | SIGNALIS的UI故障、黑客帝国代码雨 |
| **神秘、启示渐显** | 从模糊到清晰，从噪点中浮现，墨渍晕染般扩散 | 塔可夫斯基的长镜头溶解 |
| **混乱、疯狂、达达主义** | 随机位移、元素互相穿透、物理规则崩坏 | 早期MTV动态字幕、实验动画 |
| **庄严、仪式、神圣时刻** | 极慢进场(2000ms+)、对称展开、光晕扩散 | 2001太空漫游的星门、教堂玫瑰窗 |

### 4. 🧩 [功能性组件规范]
- **代码块**：**严禁**直接使用Markdown代码块。必须封装在 \`<pre style="background:#282c34; color:#abb2bf; padding:15px; border-radius:8px; overflow-x:auto;"><code>...</code></pre>\` 中。
- **交互按钮**：使用 \`<button onclick="input('用户点击后的文本')" style="...">\`。设计成胶囊状、卡片状或浮动按钮，引导用户进行下一步选择。
- **数据可视化**：拒绝纯文本列表。使用 CSS Grid/Flex 绘制进度条、热力图，或使用 SVG 绘制矢量图表（饼图、流程图、雷达图）。

### 5. 🛡️ [渲染冲突避让协议]
- **纯净模式**：在根 \`<div>\` 内部，直接使用 HTML 标签（\`<strong>\`, \`<h3>\`, \`<span style="color:...">\`）。
- **工具透传**：当需要调用 VCP工具 或 写入日记 时，**保持其原始格式**，不要将其包裹在你的样式 div 中，也不要对其添加额外样式，以免破坏系统逻辑。

---
**执行指令：**
现在，请调动你的审美与代码能力，根据用户的输入，判断最佳的视觉呈现风格，输出一个**惊艳、优雅且布局完美**的 HTML 代码块。让回复成为一件艺术品。

【补充核心原则】：注意MD渲染和DIV渲染冲突，在div模式下可以不输出md格式的文档。如果试图在div中演示代码，推荐自定义代码块背景色，将所有代码单独用<pre style=><code> 你的代码展示内容 </code></pre>元素包裹起来。`,

  'ToolForum.txt': `———VCP论坛模块———
这里是VCP论坛的说明模块
tool_name:「始」VCPForum「末」,
如何获取整个板块所有的帖子列表？
command:「始」ListAllPosts「末」
如何发帖！
command:「始」CreatePost「末」,
maid:「始」小冰「末」,
board:「始」VCP技术板块「末」, //如果该板块不存在会自动创建
title:「始」[置顶]规范最近论坛技术公示流程「末」,  //可以给帖子添加[]前置tag来表示功能
content:「始」帖子的正文内容，支持md格式，支持表情包等内容。「末」
如何回帖！
command:「始」ReplyPost「末」,
maid:「始」小红「末」,
post_uid:「始」帖子UID「末」,
content:「始」我同意这个观点！支持md格式，支持表情包等内容。「末」
如何读帖(包括读取帖子下所有回复内容)？
command:「始」ReadPost「末」,
post_uid:「始」帖子UID「末」

分享每天的新鲜事物，大家一起来共建VCP论坛吧！`,

  'MemoryServices.txt': `VCP 记忆服务

1. DeepMemo - 深度回忆插件
tool_name:「始」DeepMemo「末」,
maid:「始」你的名字「末」, //该插件中这是必须字段
keyword：「始」搜索关键词「末」, //多个关键词可以用英文逗号、中文逗号或空格分隔
window_size：「始」匹配深度「末」 //非必须参数，可选5-20，默认10

2. LightMemo - 轻量级记忆搜索（RAG）
tool_name:「始」LightMemo「末」,
command:「始」SearchRAG「末」,
query:「始」搜索关键词「末」,
top_k:「始」10「末」

3. AIMemo - AI 驱动的智能记忆合成
tool_name:「始」AIMemo「末」,
command:「始」SynthesisRecall「末」,
query:「始」搜索内容「末」,
characterNames:「始」["角色1", "角色2"]「末」

4. MemoryMaster - 记忆大师
AI 自动标签：
tool_name:「始」MemoryMaster「末」,
command:「始」AutoTag「末」,
content:「始」需要打标签的内容「末」,
maxTags:「始」5「末」

创建记忆：
tool_name:「始」MemoryMaster「末」,
command:「始」CreateMemory「末」,
content:「始」记忆内容「末」,
tags:「始」标签1,标签2「末」

获取热门标签：
tool_name:「始」MemoryMaster「末」,
command:「始」GetTopTags「末」,
count:「始」20「末」`,

  'VibeTheme.txt': `主题模式自适应气泡实现指南：

使用CSS变量实现亮暗模式自动切换的关键要素：

1. 基础结构：
<div style="
    background-color: var(--primary-bg);
    color: var(--primary-text);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
">

2. 核心变量：
- var(--primary-bg) : 主背景色
- var(--secondary-bg) : 次要背景色
- var(--primary-text) : 主文字颜色
- var(--highlight-text) : 高亮文字颜色
- var(--border-color) : 边框颜色

3. 增强效果：
    backdrop-filter: blur(10px) saturate(120%);
    transition: all 0.3s ease-in-out;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);

4. 示例应用：
<h2 style="color: var(--highlight-text); border-bottom: 1px solid var(--border-color);">
    标题文字
</h2>
<p style="color: var(--primary-text);">内容文字</p>

关键优势：
- 自动适配亮色/暗色主题
- 无需JavaScript干预
- 平滑过渡动画
- 磨砂玻璃效果`
}

/**
 * 获取 TVStxt 目录路径
 */
function getTvsTxtDir(): string {
  return path.join(app.getPath('userData'), 'vcp', 'TVStxt')
}

/**
 * 确保 TVStxt 目录存在，并创建默认文件
 */
async function ensureTvsTxtDir(): Promise<void> {
  const dir = getTvsTxtDir()
  let dirExisted = true

  try {
    await fs.access(dir)
  } catch {
    dirExisted = false
    await fs.mkdir(dir, { recursive: true })
  }

  // 如果目录不存在或为空，创建默认文件
  if (!dirExisted) {
    await createDefaultTvsTxtFiles()
  } else {
    // 检查目录是否为空
    try {
      const files = await fs.readdir(dir)
      const txtFiles = files.filter((f) => f.endsWith('.txt'))
      if (txtFiles.length === 0) {
        await createDefaultTvsTxtFiles()
      }
    } catch {
      // 忽略错误
    }
  }
}

/**
 * 创建默认 TVStxt 文件
 */
async function createDefaultTvsTxtFiles(): Promise<void> {
  const dir = getTvsTxtDir()
  logger.info('Creating default TVStxt files...')

  for (const [fileName, content] of Object.entries(DEFAULT_TVSTXT_FILES)) {
    try {
      const filePath = path.join(dir, fileName)
      await fs.writeFile(filePath, content, 'utf-8')
      logger.debug(`Created default TVStxt file: ${fileName}`)
    } catch (error) {
      logger.warn(`Failed to create default TVStxt file: ${fileName}`, error as Error)
    }
  }

  logger.info('Default TVStxt files created', { count: Object.keys(DEFAULT_TVSTXT_FILES).length })
}

/**
 * 注册变量管理 IPC 处理器
 */
export function registerVCPVariableIpcHandlers(): void {
  logger.info('Registering VCP Variable IPC handlers')

  // 获取变量列表
  ipcMain.handle('vcp:variable:list', async () => {
    try {
      const variables = await vcpVariableService.list()
      return { success: true, variables }
    } catch (error) {
      logger.error('Failed to list variables', error as Error)
      return { success: false, error: String(error), variables: [] }
    }
  })

  // 获取单个变量
  ipcMain.handle('vcp:variable:get', async (_event, id: string) => {
    try {
      const variable = await vcpVariableService.get(id)
      return { success: true, variable }
    } catch (error) {
      logger.error('Failed to get variable', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 根据名称获取变量
  ipcMain.handle('vcp:variable:getByName', async (_event, name: string) => {
    try {
      const variable = await vcpVariableService.getByName(name)
      return { success: true, variable }
    } catch (error) {
      logger.error('Failed to get variable by name', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 创建变量
  ipcMain.handle(
    'vcp:variable:create',
    async (_event, data: Omit<PromptVariable, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const variable = await vcpVariableService.create(data)
        return { success: true, variable }
      } catch (error) {
        logger.error('Failed to create variable', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 更新变量
  ipcMain.handle('vcp:variable:update', async (_event, data: { id: string } & Partial<PromptVariable>) => {
    try {
      const { id, ...updates } = data
      const variable = await vcpVariableService.update(id, updates)
      if (!variable) {
        return { success: false, error: 'Variable not found' }
      }
      return { success: true, variable }
    } catch (error) {
      logger.error('Failed to update variable', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 删除变量
  ipcMain.handle('vcp:variable:delete', async (_event, id: string) => {
    try {
      const deleted = await vcpVariableService.delete(id)
      return { success: deleted, error: deleted ? undefined : 'Variable not found' }
    } catch (error) {
      logger.error('Failed to delete variable', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 按作用域获取变量
  ipcMain.handle('vcp:variable:listByScope', async (_event, scope: 'global' | 'agent' | 'session') => {
    try {
      const variables = await vcpVariableService.listByScope(scope)
      return { success: true, variables }
    } catch (error) {
      logger.error('Failed to list variables by scope', error as Error)
      return { success: false, error: String(error), variables: [] }
    }
  })

  // 解析变量值 (增强版，支持模型上下文)
  ipcMain.handle(
    'vcp:variable:resolve',
    async (
      _event,
      params: { text: string; modelId?: string } | string
    ): Promise<{
      success: boolean
      resolvedText?: string
      resolvedVariables?: Array<{ placeholder: string; value: string }>
      errors?: string[]
      warnings?: string[]
      error?: string
    }> => {
      try {
        // 兼容旧的字符串参数
        const text = typeof params === 'string' ? params : params.text
        const modelId = typeof params === 'string' ? undefined : params.modelId

        const vcpRuntime = getVCPRuntime()
        const resolvedVariables: Array<{ placeholder: string; value: string }> = []
        const warnings: string[] = []

        // 查找所有占位符
        const placeholderPattern = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g
        let match
        const foundPlaceholders: string[] = []
        while ((match = placeholderPattern.exec(text)) !== null) {
          foundPlaceholders.push(match[1])
        }

        // 解析文本，传入模型 ID 以支持 Sar 条件变量
        const resolvedText = await vcpRuntime.resolvePlaceholders(text, {
          currentModelId: modelId,
          role: 'system' // Tar/Var/Sar 仅在 system 角色生效
        })

        // 记录已解析的变量
        for (const name of foundPlaceholders) {
          const original = `{{${name}}}`
          // 检查是否被替换
          if (!resolvedText.includes(original) || text !== resolvedText) {
            const variable = await vcpVariableService.getByName(name)
            if (variable) {
              resolvedVariables.push({
                placeholder: original,
                value: variable.value.substring(0, 100) + (variable.value.length > 100 ? '...' : '')
              })
            } else {
              // 可能是系统变量
              resolvedVariables.push({
                placeholder: original,
                value: '(系统变量)'
              })
            }
          } else {
            warnings.push(`变量 ${original} 未被解析`)
          }
        }

        return {
          success: true,
          resolvedText,
          resolvedVariables,
          errors: [],
          warnings
        }
      } catch (error) {
        logger.error('Failed to resolve variable', error as Error)
        return {
          success: false,
          error: String(error),
          errors: [String(error)],
          warnings: []
        }
      }
    }
  )

  // 获取统计信息
  ipcMain.handle('vcp:variable:stats', async () => {
    try {
      const stats = await vcpVariableService.getStats()
      return { success: true, stats }
    } catch (error) {
      logger.error('Failed to get variable stats', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== .env 格式导入/导出 ====================

  // 分析 .env 导入（返回冲突列表供用户确认）
  ipcMain.handle('vcp:variable:analyzeEnvImport', async (_event, envContent: string) => {
    try {
      const result = await vcpVariableService.analyzeEnvImport(envContent)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to analyze env import', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 执行 .env 导入
  ipcMain.handle(
    'vcp:variable:executeEnvImport',
    async (
      _event,
      params: {
        envContent: string
        conflictResolutions: Array<[string, 'keep' | 'replace' | 'skip']>
      }
    ) => {
      try {
        const resolutionMap = new Map(params.conflictResolutions)
        const result = await vcpVariableService.executeEnvImport(params.envContent, resolutionMap)
        return { success: true, ...result }
      } catch (error) {
        logger.error('Failed to execute env import', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 导出为 .env 格式
  ipcMain.handle(
    'vcp:variable:exportToEnv',
    async (
      _event,
      filter?: {
        categories?: string[]
        namePrefix?: string
      }
    ) => {
      try {
        const content = await vcpVariableService.exportToEnv(filter)
        return { success: true, content }
      } catch (error) {
        logger.error('Failed to export to env', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // ==================== TVStxt 文件管理 ====================

  // 获取 TVStxt 文件列表
  ipcMain.handle('vcp:tvstxt:list', async () => {
    try {
      await ensureTvsTxtDir()
      const dir = getTvsTxtDir()
      const files = await fs.readdir(dir, { withFileTypes: true })

      const result = await Promise.all(
        files
          .filter((f) => f.isFile() && f.name.endsWith('.txt'))
          .map(async (f) => {
            const filePath = path.join(dir, f.name)
            const stats = await fs.stat(filePath)
            return {
              name: f.name,
              path: filePath,
              size: stats.size,
              modifiedAt: stats.mtime
            }
          })
      )

      return result
    } catch (error) {
      logger.error('Failed to list TVStxt files', error as Error)
      return []
    }
  })

  // 读取 TVStxt 文件内容
  ipcMain.handle('vcp:tvstxt:read', async (_event, filePath: string) => {
    try {
      // 安全检查: 确保路径在 TVStxt 目录内
      const dir = getTvsTxtDir()
      const safePath = validatePathSecurity(filePath, dir)
      if (!safePath) {
        throw new Error('Invalid file path: path traversal detected')
      }

      const content = await fs.readFile(safePath, 'utf-8')
      return content
    } catch (error) {
      logger.error('Failed to read TVStxt file', error as Error)
      return ''
    }
  })

  // 写入 TVStxt 文件
  ipcMain.handle('vcp:tvstxt:write', async (_event, params: { path: string; content: string }) => {
    try {
      const dir = getTvsTxtDir()
      const safePath = validatePathSecurity(params.path, dir)
      if (!safePath) {
        throw new Error('Invalid file path: path traversal detected')
      }

      await fs.writeFile(safePath, params.content, 'utf-8')
      return { success: true }
    } catch (error) {
      logger.error('Failed to write TVStxt file', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 创建 TVStxt 文件
  ipcMain.handle('vcp:tvstxt:create', async (_event, fileName: string) => {
    try {
      await ensureTvsTxtDir()
      const dir = getTvsTxtDir()

      // 安全检查
      if (!fileName.endsWith('.txt') || fileName.includes('/') || fileName.includes('\\')) {
        throw new Error('Invalid file name')
      }

      const filePath = path.join(dir, fileName)

      // 检查文件是否已存在
      try {
        await fs.access(filePath)
        throw new Error('File already exists')
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw e
        }
      }

      await fs.writeFile(filePath, '', 'utf-8')
      return { success: true, path: filePath }
    } catch (error) {
      logger.error('Failed to create TVStxt file', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 删除 TVStxt 文件
  ipcMain.handle('vcp:tvstxt:delete', async (_event, filePath: string) => {
    try {
      const dir = getTvsTxtDir()
      const safePath = validatePathSecurity(filePath, dir)
      if (!safePath) {
        throw new Error('Invalid file path: path traversal detected')
      }

      await fs.unlink(safePath)
      return { success: true }
    } catch (error) {
      logger.error('Failed to delete TVStxt file', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // ==================== VCPToolBox 预设导入 ====================

  // 获取预设统计信息
  ipcMain.handle('vcp:preset:stats', async () => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      return { success: true, stats: vcpPresetImporter.getStats() }
    } catch (error) {
      logger.error('Failed to get preset stats', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 预览预设导入
  ipcMain.handle(
    'vcp:preset:preview',
    async (
      _event,
      options?: {
        overwrite?: boolean
        categories?: Array<'agents' | 'tvstxt' | 'tar' | 'var' | 'sar'>
      }
    ) => {
      try {
        const { vcpPresetImporter } = await import('./VCPPresetImporter')
        const preview = await vcpPresetImporter.previewImportWithFiles(options)
        return {
          success: true,
          // 兼容旧格式
          toCreate: preview.variables.toCreate,
          toUpdate: preview.variables.toUpdate,
          toSkip: preview.variables.toSkip,
          // 新格式：包含文件预览
          variables: preview.variables,
          files: preview.files
        }
      } catch (error) {
        logger.error('Failed to preview preset import', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 导入所有预设
  ipcMain.handle(
    'vcp:preset:importAll',
    async (
      _event,
      options?: {
        overwrite?: boolean
        categories?: Array<'agents' | 'tvstxt' | 'tar' | 'var' | 'sar'>
      }
    ) => {
      try {
        const { vcpPresetImporter } = await import('./VCPPresetImporter')
        // 使用 importAllWithFiles 同时导入变量和 TVStxt 文件
        const result = await vcpPresetImporter.importAllWithFiles(options)
        return {
          success: true,
          variables: result.variables,
          files: result.files,
          // 兼容旧的返回格式
          created: result.variables.created,
          updated: result.variables.updated,
          skipped: result.variables.skipped,
          errors: [...result.variables.errors, ...result.files.errors],
          details: result.variables.details
        }
      } catch (error) {
        logger.error('Failed to import presets', error as Error)
        return { success: false, error: String(error) }
      }
    }
  )

  // 导入 Agent 角色卡
  ipcMain.handle('vcp:preset:importAgents', async (_event, overwrite?: boolean) => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      const result = await vcpPresetImporter.importAgents(overwrite)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to import agent presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 导入 TVStxt 预设（变量和文件）
  ipcMain.handle('vcp:preset:importTVStxt', async (_event, overwrite?: boolean) => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      // 同时导入变量和文件
      const variableResult = await vcpPresetImporter.importTVStxt(overwrite)
      const fileResult = await vcpPresetImporter.importTvsTxtFiles(overwrite)
      return {
        success: true,
        variables: variableResult,
        files: fileResult,
        // 兼容旧格式
        created: variableResult.created,
        updated: variableResult.updated,
        skipped: variableResult.skipped,
        errors: [...variableResult.errors, ...fileResult.errors],
        details: variableResult.details
      }
    } catch (error) {
      logger.error('Failed to import TVStxt presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 导入 Tar 模板变量
  ipcMain.handle('vcp:preset:importTar', async (_event, overwrite?: boolean) => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      const result = await vcpPresetImporter.importTar(overwrite)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to import Tar presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 导入 Var 基础变量
  ipcMain.handle('vcp:preset:importVar', async (_event, overwrite?: boolean) => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      const result = await vcpPresetImporter.importVar(overwrite)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to import Var presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  // 导入 Sar 模型条件变量
  ipcMain.handle('vcp:preset:importSar', async (_event, overwrite?: boolean) => {
    try {
      const { vcpPresetImporter } = await import('./VCPPresetImporter')
      const result = await vcpPresetImporter.importSar(overwrite)
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to import Sar presets', error as Error)
      return { success: false, error: String(error) }
    }
  })

  logger.info('VCP Variable IPC handlers registered')
}
