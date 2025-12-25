# AI Workflow Project Architecture Document

## Architectural Overview

This is a **multi-tier AI workflow automation platform** called "Keroro 作战室" (Keroro Command Center), designed for orchestrating AI-powered image/video generation and processing pipelines. The architecture consists of:

* **Python Backend (FastAPI):** Core workflow execution engine with REST API and MCP (Model Context Protocol) server support.
* **Vanilla JS Frontend:** Lightweight web-based workflow editor served by the backend.
* **Cherry Studio (Electron App):** Full-featured desktop application with advanced AI chat capabilities, knowledge management, and workflow integration.
* **Multiple AI Client Integrations:** Qwen, Gemini, Kling, RunningHub, SiliconFlow, ModelScope, OhMyGPT, and Cherryin.

The system follows a **job-based execution model** where workflows are defined as JSON configurations, executed as background jobs with progress tracking, and results stored in a file-based job directory structure.

---

## File Architecture Tables

### 1. Root Level - Configuration & Scripts

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `launch_server.py` | Entry Point | Main server launcher | Starts the FastAPI backend server | Imports `backend.server` | Primary entry point for development |
| `requirements.txt` | Config | Python dependencies | Lists all pip packages needed | Used by `pip install` | Standard Python dependency file |
| `requirements_build.txt` | Config | Build-time dependencies | PyInstaller and build tools | Used by `build.bat` | For creating standalone executables |
| `build.bat` | Scripts | Windows build script | Runs PyInstaller to create .exe | Uses `build_exe.spec` | Windows-only build automation |
| `build_exe.spec` | Config | PyInstaller spec file | Defines executable packaging | Referenced by `build.bat` | Configures bundled files and options |
| `start_backend.bat` | Scripts | Windows backend starter | Launches Python backend | Calls `launch_server.py` | Quick-start script for Windows |
| `start_backend.ps1` | Scripts | PowerShell backend starter | Same as .bat but PowerShell | Calls `launch_server.py` | Alternative for PowerShell users |
| `kill_port.bat` | Scripts | Port cleanup utility | Kills processes on specific ports | System utility | For resolving port conflicts |
| `kill_port.ps1` | Scripts | PowerShell port cleanup | Same as .bat but PowerShell | System utility | Alternative for PowerShell users |
| `kill_port_8000.bat` | Scripts | Kill port 8000 specifically | Frees port 8000 | System utility | Backend default port cleanup |
| `kill_all-nodes.bat` | Scripts | Kill all Node processes | Terminates Node.js processes | System utility | For cleaning up frontend dev servers |
| `fix-chatbox.bat` | Scripts | Chatbox repair utility | Fixes chatbox integration issues | System utility | Troubleshooting script |

### 2. Backend - Core Python Application

#### 2.1 Backend Root

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/main.py` | Entry Point | Module entry point | Allows `python -m backend` execution | Imports `server.py` | Standard Python module pattern |
| `backend/server.py` | Core | Main FastAPI server | App lifecycle, CORS, router registration | Imports all routers, config | Central server configuration |
| `backend/config.py` | Core | Configuration management | APIConfig Pydantic model, load/save config | Used by all clients | Manages API keys for 10+ AI services |
| `backend/models.py` | Core | Legacy data models | Pydantic models for API | May be deprecated | Check if still used |
| `backend/utils.py` | Core | Utility functions | Common helper functions | Used across backend | Shared utilities |
| `backend/exceptions.py` | Core | Custom exceptions | Workflow-specific error types | Used by services | Centralized error handling |
| `backend/http_pool.py` | Core | HTTP connection pooling | Manages HTTP client connections | Used by AI clients | Performance optimization |
| `backend/temp_file_manager.py` | Core | Temporary file handling | Creates/cleans temp files | Used by workflow engine | File lifecycle management |
| `backend/token_cache.py` | Core | Token caching | Caches API tokens (e.g., Kling JWT) | Used by clients | Reduces API calls |
| `backend/model_list.py` | Core | Model definitions | Lists available AI models | Used by routers | Model metadata registry |

#### 2.2 Backend Models

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/models/init.py` | Models | Package init | Exports model classes | Used by routers | Package organization |
| `backend/models/workflow_models.py` | Models | Workflow data models | Step, Workflow, WorkflowConfig Pydantic models | Used by workflow engine | Core workflow schema |
| `backend/models/job_models.py` | Models | Job data models | Job, JobStatus, JobResult models | Used by `job_manager` | Job execution schema |

#### 2.3 Backend Routers (HTTP API)

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/routers/init.py` | Routers | Package init | Exports router instances | Used by `server.py` | Package organization |
| `backend/routers/config.py` | Routers | Config API endpoints | GET/PUT /config for API keys | Uses `config.py` | Settings management API |
| `backend/routers/workflows.py` | Routers | Workflow CRUD API | List, create, update, delete workflows | Uses `workflow_models` | Workflow management |
| `backend/routers/jobs.py` | Routers | Job execution API | Start, stop, status, list jobs | Uses `job_manager` | Job lifecycle API |
| `backend/routers/models.py` | Routers | Model listing API | GET /models for available AI models | Uses `model_list` | Model discovery |
| `backend/routers/health.py` | Routers | Health check API | GET /health endpoint | Standalone | Monitoring/liveness probe |
| `backend/routers/metrics.py` | Routers | Metrics API | System metrics and stats | Uses services | Observability |
| `backend/routers/wallpaper.py` | Routers | Wallpaper API | Custom wallpaper management | File storage | UI customization feature |

#### 2.4 Backend HTTP Routes (Alternative Router Structure)

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/http_routes/init.py` | HTTP Routes | Package init | Exports route handlers | Used by `server.py` | Newer router organization |
| `backend/http_routes/config.py` | HTTP Routes | Config routes | Configuration endpoints | Uses `config.py` | May overlap with `routers/` |
| `backend/http_routes/workflows.py` | HTTP Routes | Workflow routes | Workflow CRUD operations | Uses workflow engine | May overlap with `routers/` |
| `backend/http_routes/jobs.py` | HTTP Routes | Job routes | Job management endpoints | Uses `job_manager` | May overlap with `routers/` |
| `backend/http_routes/templates.py` | HTTP Routes | Template routes | Workflow template management | Uses file storage | Template CRUD |

#### 2.5 Backend Services

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/services/init.py` | Services | Package init | Exports service classes | Used by routers | Package organization |
| `backend/services/job_manager.py` | Services | Job execution manager | Job queue, execution, status tracking | Uses clients, workflow engine | Core execution orchestrator |
| `backend/services/queue_manager.py` | Services | Queue management | Task queue for batch processing | Used by `job_manager` | Concurrency control |

#### 2.6 Backend AI Clients

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/clients/init.py` | Clients | Package init | Exports client classes | Used by workflow engine | Package organization |
| `backend/clients/qwen_client.py` | Clients | Qwen/Tongyi API client | Vision-language model calls | Uses config, `http_pool` | Alibaba Cloud Qwen integration |
| `backend/clients/gemini_client.py` | Clients | Google Gemini client | Image generation/editing | Uses config, `http_pool` | Multi-route Gemini support (T8Star, Comfly, etc.) |
| `backend/clients/kling_client.py` | Clients | Kling video client | Image-to-video generation | Uses config, `token_cache` | Kuaishou Kling API with JWT auth |
| `backend/clients/runninghub_client.py` | Clients | RunningHub client | ComfyUI workflow execution | Uses config, `http_pool` | External workflow platform |
| `backend/clients/siliconflow_client.py` | Clients | SiliconFlow client | DeepSeek and other models | Uses config, `http_pool` | Chinese AI platform |
| `backend/clients/modelscope_client.py` | Clients | ModelScope client | Alibaba ModelScope models | Uses config, `http_pool` | Qwen large models |
| `backend/clients/ohmygpt_client.py` | Clients | OhMyGPT client | GPT proxy service | Uses config, `http_pool` | API aggregator |
| `backend/clients/cherryin_client.py` | Clients | Cherryin.ai client | Multi-model API | Uses config, `http_pool` | API aggregator |

#### 2.7 Backend Prompts

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/prompts/init.py` | Prompts | Package init | Exports prompt templates | Used by clients | Package organization |
| `backend/prompts/safety_optimized.py` | Prompts | Safety prompts | Content safety guidelines | Used by vision clients | Prompt injection prevention |
| `backend/prompts/pattern_prompts.py` | Prompts | Pattern generation prompts | Textile/pattern design prompts | Used by Gemini client | Domain-specific prompts |
| `backend/prompts/ecom_prompts.py` | Prompts | E-commerce prompts | Product photography prompts | Used by Gemini client | Commercial use case |
| `backend/prompts/model_prompts.py` | Prompts | Model photography prompts | Fashion model generation | Used by Gemini client | Commercial use case |

#### 2.8 Backend Workflow Engine

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/workflow/init.py` | Workflow | Package init | Exports workflow classes | Used by services | Package organization |
| `backend/workflow/discovery.py` | Workflow | Workflow discovery | Scans and loads workflow JSON files | Uses file system | Auto-discovery of workflows |

#### 2.9 Backend MCP Server

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/mcp_server/init.py` | MCP | Package init | Exports MCP components | Used by server | Package organization |
| `backend/mcp_server/server.py` | MCP | MCP server implementation | Model Context Protocol server | Uses tools | For AI agent integration |
| `backend/mcp_server/server_simple.py` | MCP | Simplified MCP server | Lightweight MCP implementation | Uses tools | Alternative MCP server |
| `backend/mcp_server/workflow_engine.py` | MCP | MCP workflow engine | Executes workflows via MCP | Uses clients | MCP-specific execution |

#### 2.10 Backend MCP Tools

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/mcp_server/tools/init.py` | MCP Tools | Package init | Exports all MCP tools | Used by MCP server | Tool registry |
| `backend/mcp_server/tools/list_workflows.py` | MCP Tools | List workflows tool | Returns available workflows | Uses workflow discovery | MCP tool |
| `backend/mcp_server/tools/run_workflow.py` | MCP Tools | Run workflow tool | Executes a workflow | Uses workflow engine | MCP tool |
| `backend/mcp_server/tools/get_job_status.py` | MCP Tools | Job status tool | Returns job execution status | Uses `job_manager` | MCP tool |
| `backend/mcp_server/tools/job_list.py` | MCP Tools | List jobs tool | Returns all jobs | Uses `job_manager` | MCP tool |
| `backend/mcp_server/tools/job_cancel.py` | MCP Tools | Cancel job tool | Cancels running job | Uses `job_manager` | MCP tool |
| `backend/mcp_server/tools/config_load.py` | MCP Tools | Load config tool | Loads configuration | Uses `config.py` | MCP tool |
| `backend/mcp_server/tools/config_save.py` | MCP Tools | Save config tool | Saves configuration | Uses `config.py` | MCP tool |
| `backend/mcp_server/tools/template_get.py` | MCP Tools | Get template tool | Retrieves workflow template | Uses file storage | MCP tool |
| `backend/mcp_server/tools/template_save.py` | MCP Tools | Save template tool | Saves workflow template | Uses file storage | MCP tool |
| `backend/mcp_server/tools/template_delete.py` | MCP Tools | Delete template tool | Deletes workflow template | Uses file storage | MCP tool |
| `backend/mcp_server/tools/stats.py` | MCP Tools | Statistics tool | Returns system statistics | Uses services | MCP tool |
| `backend/mcp_server/tools/health_check.py` | MCP Tools | Health check tool | Returns health status | Standalone | MCP tool |
| `backend/mcp_server/tools/ai_client.py` | MCP Tools | AI client tool | Direct AI model access | Uses clients | MCP tool |
| `backend/mcp_server/tools/image_upload.py` | MCP Tools | Image upload tool | Uploads images for processing | Uses file storage | MCP tool |
| `backend/mcp_server/tools/image_process.py` | MCP Tools | Image process tool | Processes images | Uses clients | MCP tool |
| `backend/mcp_server/tools/preset_workflow.py` | MCP Tools | Preset workflow tool | Runs predefined workflows | Uses workflow engine | MCP tool |
| `backend/mcp_server/tools/batch_execute.py` | MCP Tools | Batch execute tool | Batch workflow execution | Uses `job_manager` | MCP tool |
| `backend/mcp_server/tools/step_execute.py` | MCP Tools | Step execute tool | Executes single step | Uses clients | MCP tool |
| `backend/mcp_server/tools/workflow_explorer.py` | MCP Tools | Workflow explorer tool | Explores workflow structure | Uses workflow discovery | MCP tool |

### 3. Frontend - Vanilla JavaScript Web Application

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/index.html` | Frontend | Main HTML page | Single-page app structure | Loads all JS/CSS | "Keroro 作战室" UI |
| `frontend/favicon.ico` | Frontend | Browser favicon | Site icon | Used by `index.html` | Branding |
| `frontend/js/app.js` | Frontend/JS | Main application | App initialization, event binding | Uses all other JS modules | Entry point |
| `frontend/js/api.js` | Frontend/JS | API client layer | HTTP calls to backend | Used by `workflow.js` | REST API wrapper |
| `frontend/js/workflow.js` | Frontend/JS | Workflow editor core | Step management, execution | Uses `api.js`, `node-definitions` | Core workflow logic (110KB) |
| `frontend/js/node-definitions.js` | Frontend/JS | Step type definitions | Defines 13+ step types | Used by `workflow.js` | Step schema registry |
| `frontend/js/config.js` | Frontend/JS | Configuration UI | Settings panel logic | Uses `api.js` | API key management |
| `frontend/js/ui.js` | Frontend/JS | UI utilities | DOM manipulation helpers | Used by `app.js` | UI helper functions |
| `frontend/js/utils.js` | Frontend/JS | General utilities | Common helper functions | Used across frontend | Shared utilities |
| `frontend/js/history.js` | Frontend/JS | Undo/redo history | Workflow state history | Used by `workflow.js` | State management |
| `frontend/js/validation.js` | Frontend/JS | Input validation | Form validation logic | Used by `workflow.js` | Data validation |
| `frontend/js/logger.js` | Frontend/JS | Logging utility | Console logging wrapper | Used across frontend | Debug logging |
| `frontend/js/fixes.js` | Frontend/JS | Bug fixes/patches | Runtime patches | Loaded by `index.html` | Hotfixes |
| `frontend/js/workflow-templates.js` | Frontend/JS | Template system | Save/load workflow templates | Uses `api.js` | Template management |
| `frontend/js/model-picker.js` | Frontend/JS | Model selector | AI model selection UI | Uses `api.js` | Model picker component |
| `frontend/js/model-picker-demo.js` | Frontend/JS | Model picker demo | Demo/test for model picker | Uses `model-picker.js` | Development utility |
| `frontend/js/runninghub-integration.js` | Frontend/JS | RunningHub panel | ComfyUI workflow import | Uses `api.js` | External integration |
| `frontend/css/styles.css` | Frontend/CSS | Main stylesheet | Core styles | Used by `index.html` | Primary styles |
| `frontend/css/theme.css` | Frontend/CSS | Theme variables | CSS custom properties | Used by `styles.css` | Theming system |
| `frontend/css/modern-ui.css` | Frontend/CSS | Modern UI styles | Contemporary design | Used by `index.html` | UI modernization |
| `frontend/css/improvements.css` | Frontend/CSS | UI improvements | Style enhancements | Used by `index.html` | Incremental improvements |
| `frontend/css/responsive.css` | Frontend/CSS | Responsive styles | Mobile/tablet layouts | Used by `index.html` | Responsive design |
| `frontend/css/runninghub-panel.css` | Frontend/CSS | RunningHub styles | Panel-specific styles | Used by `index.html` | Component styles |
| `frontend/images/` | Frontend/Assets | Image assets | Keroro character images | Used by `index.html` | Branding/mascot images |

### 4. Frontend ReactFlow App (Experimental)

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/reactflow-app/vite.config.ts` | ReactFlow | Vite configuration | Build configuration | Used by Vite | React app build config |
| `frontend/reactflow-app/src/App.tsx` | ReactFlow | Main React component | ReactFlow-based editor | Uses `@xyflow/react` | Experimental modern editor |

### 5. Cherry Studio - Electron Desktop Application

#### 5.1 Main Process

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cherry-studio/src/main/index.ts` | Main | Electron main entry | App initialization, window creation | Uses all services | Electron main process |
| `cherry-studio/src/main/constant.ts` | Main | Constants | App-wide constants | Used across main | Configuration constants |
| `cherry-studio/src/main/electron.d.ts` | Main | Type definitions | Electron type augmentations | TypeScript | Type safety |
| `cherry-studio/src/main/env.d.ts` | Main | Environment types | Environment variable types | TypeScript | Type safety |

#### 5.2 Main Process Services

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cherry-studio/src/main/services/AppService.ts` | Services | App lifecycle | Window management, app events | Core service | Central app service |
| `cherry-studio/src/main/services/AppMenuService.ts` | Services | Menu management | Native menu creation | Uses Electron Menu | App menu |
| `cherry-studio/src/main/services/AppUpdater.ts` | Services | Auto-update | App update checking/installation | Uses `electron-updater` | Auto-update feature |
| `cherry-studio/src/main/services/ApiServerService.ts` | Services | API server | Embedded HTTP server | Uses Express | Local API server |
| `cherry-studio/src/main/services/ConfigManager.ts` | Services | Config management | App configuration persistence | Uses `electron-store` | Settings storage |
| `cherry-studio/src/main/services/FileStorage.ts` | Services | File storage | Local file management | Uses fs | File operations |
| `cherry-studio/src/main/services/FileSystemService.ts` | Services | File system | File system operations | Uses fs | File utilities |
| `cherry-studio/src/main/services/CacheService.ts` | Services | Caching | In-memory and disk cache | Used by services | Performance optimization |
| `cherry-studio/src/main/services/BackupManager.ts` | Services | Backup | Data backup/restore | Uses FileStorage | Data protection |
| `cherry-studio/src/main/services/ExportService.ts` | Services | Export | Chat/data export | Uses FileStorage | Data export |
| `cherry-studio/src/main/services/LoggerService.ts` | Services | Logging | Application logging | Used across main | Centralized logging |
| `cherry-studio/src/main/services/NotificationService.ts` | Services | Notifications | System notifications | Uses Electron Notification | User notifications |
| `cherry-studio/src/main/services/ContextMenu.ts` | Services | Context menu | Right-click menus | Uses Electron Menu | Context menus |
| `cherry-studio/src/main/services/PowerMonitorService.ts` | Services | Power monitoring | System power events | Uses Electron powerMonitor | Power management |
| `cherry-studio/src/main/services/MCPService.ts` | Services | MCP integration | Model Context Protocol | Uses MCP SDK | AI agent integration |
| `cherry-studio/src/main/services/KnowledgeService.ts` | Services | Knowledge base | RAG/knowledge management | Uses embeddings | Knowledge retrieval |
| `cherry-studio/src/main/services/AnthropicService.ts` | Services | Anthropic API | Claude integration | Uses Anthropic SDK | Claude models |
| `cherry-studio/src/main/services/CopilotService.ts` | Services | Copilot features | AI assistant features | Uses AI services | AI assistance |
| `cherry-studio/src/main/services/CodeToolsService.ts` | Services | Code tools | Code execution/analysis | Uses sandboxing | Code features |
| `cherry-studio/src/main/services/DxtService.ts` | Services | DXT integration | External tool integration | Uses IPC | Tool integration |
| `cherry-studio/src/main/services/NodeTraceService.ts` | Services | Node tracing | Execution tracing | Uses logging | Debugging |
| `cherry-studio/src/main/services/NutstoreService.ts` | Services | Nutstore sync | Cloud sync (Nutstore) | Uses Nutstore API | Cloud storage |
| `cherry-studio/src/main/services/ObsidianVaultService.ts` | Services | Obsidian integration | Obsidian vault access | Uses fs | Note integration |
| `cherry-studio/src/main/services/OvmsManager.ts` | Services | OVMS management | OpenVINO Model Server | Uses OVMS | Local model serving |
| `cherry-studio/src/main/services/MistralClientManager.ts` | Services | Mistral client | Mistral AI integration | Uses Mistral SDK | Mistral models |
| `cherry-studio/src/main/services/ProtocolClient.ts` | Services | Protocol handling | Custom protocol handler | Uses Electron protocol | Deep linking |

#### 5.3 Main Process API Server

| Path | Module/Layer | File Purpose | Key Logic | Relationships | Notes/Assumptions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cherry-studio/src/main/apiServer/index.ts` | API Server | Server entry | Express server setup | Uses routes | HTTP API |
| `cherry-studio/src/main/apiServer/app.ts` | API Server | Express app | App configuration | Uses middleware | Express app |
| `cherry-studio/src/main/apiServer/server.ts` | API Server | Server instance | HTTP server creation | Uses `app.ts` | Server lifecycle |
| `cherry-studio/src/main/apiServer/config.ts` | API Server | Server config | API server configuration | Used by server | Configuration |
| `cherry-studio/src/main/apiServer/routes/chat.ts` | API Routes | Chat endpoint | Chat completion API | Uses services | OpenAI-compatible |
| `cherry-studio/src/main/apiServer/routes/models.ts` | API Routes | Models endpoint | Model listing API | Uses services | Model discovery |
| `cherry-studio/src/main/apiServer/routes/messages.ts` | API Routes | Messages | Message handling | Uses chat services | Chat history |