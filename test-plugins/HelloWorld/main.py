#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
HelloWorld VCP 插件

VCP 协议说明：
1. 从 stdin 读取 JSON 格式的请求
2. 将 JSON 格式的响应写入 stdout
3. 响应格式：
   - 成功: {"status": "success", "result": "...", "messageForAI": "..."}
   - 失败: {"status": "error", "plugin_error": "..."}
"""

import json
import sys
import os


def main():
    try:
        # 从 stdin 读取输入
        input_data = sys.stdin.read()

        if not input_data.strip():
            output_error("No input received")
            return

        # 解析 JSON
        params = json.loads(input_data)

        # 从环境变量获取配置（VCP 会将用户配置注入环境变量）
        prefix = os.environ.get('prefix', '你好')

        # 获取命令（如果有）
        command = params.get('command', params.get('tool_command', 'hello'))

        # 根据命令执行不同操作
        if command == 'hello':
            name = params.get('name', 'World')
            result = f"{prefix}, {name}!"
            output_success(result, f"已向 {name} 问好")

        elif command == 'echo':
            message = params.get('message', '')
            result = f"Echo: {message}"
            output_success(result, f"已回显消息: {message[:50]}...")

        elif command == 'info':
            info = {
                "plugin": "HelloWorld",
                "version": "1.0.0",
                "python_version": sys.version,
                "env_prefix": prefix
            }
            output_success(json.dumps(info, ensure_ascii=False), "插件信息")

        else:
            output_error(f"Unknown command: {command}")

    except json.JSONDecodeError as e:
        output_error(f"Invalid JSON input: {e}")
    except Exception as e:
        output_error(f"Execution error: {e}")


def output_success(result, message_for_ai=None):
    """输出成功响应"""
    response = {
        "status": "success",
        "result": result
    }
    if message_for_ai:
        response["messageForAI"] = message_for_ai
    print(json.dumps(response, ensure_ascii=False))
    sys.stdout.flush()


def output_error(error_message):
    """输出错误响应"""
    response = {
        "status": "error",
        "plugin_error": error_message
    }
    print(json.dumps(response, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
