/**
 * 代码执行节点
 * Code Execution Node
 *
 * 运行自定义 JavaScript 代码处理数据：
 * - 支持所有输入数据访问
 * - 支持多输出
 * - 安全沙箱执行
 * - 支持异步代码
 */

import type { NodeDefinition } from '../../base/types'
import { CodeExecutorExecutor } from './executor'

export const CodeExecutorNode: NodeDefinition = {
  metadata: {
    type: 'code_executor',
    label: '代码执行',
    icon: '💻',
    category: 'flow',
    version: '1.0.0',
    author: 'Cherry Studio',
    description: '运行自定义 JavaScript 代码处理数据',
    tags: ['flow', 'code', 'script', 'javascript', 'transform', 'custom']
  },

  inputs: [
    {
      id: 'input1',
      label: '输入 1',
      dataType: 'any',
      required: false,
      description: '第一个输入数据，代码中使用 inputs.input1 访问'
    },
    {
      id: 'input2',
      label: '输入 2',
      dataType: 'any',
      required: false,
      description: '第二个输入数据，代码中使用 inputs.input2 访问'
    },
    {
      id: 'input3',
      label: '输入 3',
      dataType: 'any',
      required: false,
      description: '第三个输入数据，代码中使用 inputs.input3 访问'
    }
  ],

  outputs: [
    {
      id: 'output',
      label: '输出',
      dataType: 'any',
      description: '代码返回值（return 语句的值）'
    },
    {
      id: 'output1',
      label: '输出 1',
      dataType: 'any',
      description: 'outputs.output1 的值'
    },
    {
      id: 'output2',
      label: '输出 2',
      dataType: 'any',
      description: 'outputs.output2 的值'
    },
    {
      id: 'logs',
      label: '日志',
      dataType: 'json',
      description: 'console.log 的所有输出'
    }
  ],

  configSchema: {
    fields: [
      {
        key: 'code',
        label: '代码',
        type: 'code',
        required: true,
        default: `// 可用变量：
// - inputs: 所有输入数据 { input1, input2, input3 }
// - outputs: 设置多个输出 outputs.output1 = value
// - console.log(): 记录日志

// 示例：处理输入数据
const data = inputs.input1;

if (data) {
  // 设置额外输出
  outputs.output1 = typeof data;
  outputs.output2 = JSON.stringify(data).length;

  // 返回主输出
  return data;
}

return null;`,
        description: '要执行的 JavaScript 代码'
      },
      {
        key: 'async',
        label: '异步执行',
        type: 'checkbox',
        default: false,
        description: '是否作为异步函数执行（支持 await）'
      },
      {
        key: 'timeout',
        label: '超时时间',
        type: 'number',
        default: 30,
        min: 1,
        max: 300,
        description: '代码执行超时时间（秒）'
      },
      {
        key: 'errorHandling',
        label: '错误处理',
        type: 'select',
        default: 'throw',
        options: [
          { label: '抛出错误', value: 'throw' },
          { label: '返回 null', value: 'null' },
          { label: '返回错误对象', value: 'error' }
        ],
        description: '代码执行出错时的处理方式'
      }
    ]
  },

  defaultConfig: {
    code: `// 处理输入数据
const data = inputs.input1;
return data;`,
    async: false,
    timeout: 30,
    errorHandling: 'throw'
  },

  executor: new CodeExecutorExecutor()
}

export { CodeExecutorExecutor } from './executor'
export default CodeExecutorNode
