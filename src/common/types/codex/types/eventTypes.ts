/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// Codex Agent Event Types
export enum CodexAgentEventType {
  // Session and configuration events
  /**
   * prompt: ' codex'
   * payload: {
   *  session_id: string,
   *  model: string,
   *  reasoning_effort: string | null,
   *  history_log_id: number,
   *  history_entry_count: number,
   *  initial_messages: EventMsg[] | null,
   *  rollout_path: string
   * }
   * */
  SESSION_CONFIGURED = 'session_configured',

  /**
   * prompt: ' codex'
   * payload: { model_context_window: number | null }
   */
  TASK_STARTED = 'task_started',

  /**
   * prompt: ' codex'
   * payload: { last_agent_message: string | null }
   */
  TASK_COMPLETE = 'task_complete',

  // Text & reasoning events
  /**
   * prompt: ' codex'
   * payload: { delta: string }
   */
  AGENT_MESSAGE_DELTA = 'agent_message_delta',

  /**
   * prompt: ' codex'
   * payload: { message: string }
   */
  AGENT_MESSAGE = 'agent_message',

  /**
   * prompt: ' codex'
   * payload: { message: string, kind: InputMessageKind | null, images: string[] | null }
   */
  USER_MESSAGE = 'user_message',

  /**
   * prompt: 'codex,'
   * payload: { text: string }
   */
  AGENT_REASONING = 'agent_reasoning',

  /**
   * prompt: 'openAI url'
   * payload: { delta: string }
   */
  AGENT_REASONING_DELTA = 'agent_reasoning_delta',

  /**
   * prompt: 'TypeScript 'Property X does not exist''
   * payload: { text: string }
   */
  AGENT_REASONING_RAW_CONTENT = 'agent_reasoning_raw_content',

  /**
   * payload: { delta: string }
   */
  AGENT_REASONING_RAW_CONTENT_DELTA = 'agent_reasoning_raw_content_delta',

  /**
   * prompt: 'TypeScript 'Property X does not exist''
   * payload: {}
   */
  AGENT_REASONING_SECTION_BREAK = 'agent_reasoning_section_break',

  // Usage / telemetry
  /**
   * prompt: ' codex'
   * payload: { info: {
      "total_token_usage": {
        "input_tokens": 2439,
        "cached_input_tokens": 2048,
        "output_tokens": 18,
        "reasoning_output_tokens": 0,
        "total_tokens": 2457
      },
      "last_token_usage": {
        "input_tokens": 2439,
        "cached_input_tokens": 2048,
        "output_tokens": 18,
        "reasoning_output_tokens": 0,
        "total_tokens": 2457
      },
      "model_context_window": 272000
    } | null }
   */
  TOKEN_COUNT = 'token_count',

  // Command execution events
  /**
   * prompt: 'TypeScript 'Property X does not exist''
   * payload: {
      "type": "exec_command_begin",
      "call_id": "call_vufa8VWQV91WSWcc5BlFTsmQ",
      "command": [ "bash", "-lc", "ls -a" ],
      "cwd": "/Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1758954404275",
      "parsed_cmd": [
        {
        "type": "list_files",
        "cmd": "ls -a",
        "path": null
        }
      ]
    }
   */
  EXEC_COMMAND_BEGIN = 'exec_command_begin',

  /**
   * prompt: 'TypeScript 'Property X does not exist''
   * payload: { call_id: string, stream: ExecOutputStream, chunk: number[] }
   * {
      "type": "exec_command_output_delta",
      "call_id": "call_vufa8VWQV91WSWcc5BlFTsmQ",
      "stream": "stdout",
      "chunk": "LgouLgo="
    }
   */
  EXEC_COMMAND_OUTPUT_DELTA = 'exec_command_output_delta',

  /**
   * prompt: 'TypeScript 'Property X does not exist''
   * payload: {
   *  "type": "exec_command_end",
   *  "call_id": "call_vufa8VWQV91WSWcc5BlFTsmQ",
   *  "stdout": ".\\n..\\n",
   *  "stderr": "",
   *  "aggregated_output": ".\\n..\\n",
   *  "exit_code": 0,
   *  "duration": {
   *    "secs": 0,
   *    "nanos": 297701750
   *  },
   *  "formatted_output": ".\\n..\\n"
   * }
   */
  EXEC_COMMAND_END = 'exec_command_end',

  /**
   * prompt: hello.txt , ’hello codex‘
   * payload:  {
      "type": "exec_approval_request",
      "call_id": "call_W5qxMSKOP2eHaEq16QCtrhVS",
      "command": ["bash", "-lc", "echo '1231231' > hello.txt" ],
      "cwd": "/Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1758954404275",
      "reason": "Need to create hello.txt with requested content per user instruction"
    }
   */
  EXEC_APPROVAL_REQUEST = 'exec_approval_request',

  //  / Patch/file modification events
  /**
   * prompt: hello.txt , ’hello codex‘
   * payload: {
      type: 'apply_patch_approval_request',
      call_id: 'patch-7',
      changes: {
        'src/app.ts': { type: 'update', unified_diff: '--- a\n+++ b\n+console.log("hi")\n', move_path: null },
        'README.md': { type: 'add', content: '# Readme\n' },
      },
      reason: null,
      grant_root: null,
    }
   */
  APPLY_PATCH_APPROVAL_REQUEST = 'apply_patch_approval_request',

  /**
   * tips: codex sandbox_mode=read-only patch_apply_begin → patch_apply_end
   * ~/.codex/config.toml sandbox_mode = "workspace-write" apply_patch = true
   * prompt: apply_patch <<'PATCH' PATCH
   * payload: {
      "type": "patch_apply_begin",
          "call_id": "call_3tChlyDszdHuQRQTWnuZ8Jvb",
          "auto_approved": false,
          "changes": {
            "/Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1759144414815/note.txt": {
            "add": {
              "content": "This file was created via apply_patch.\nValue: 100.\n"
            }
          }
        }
      }
   */
  PATCH_APPLY_BEGIN = 'patch_apply_begin',

  /**
   * prompt: apply_patch <<'PATCH' PATCH
   * payload: {
      "type": "patch_apply_end",
      "call_id": "call_3tChlyDszdHuQRQTWnuZ8Jvb",
      "stdout": "Success. Updated the following files:\nA note.txt\n",
      "stderr": "",
      "success": true
    }
   */
  PATCH_APPLY_END = 'patch_apply_end',

  // MCP tool events
  /**
   * tips: codex mcp add 12306-mcp12306-mcp MCP , MCP https://modelscope.cn/mcp?page=1 , codex mcp list
   * prompt: 2025
   * payload: {
      "type": "mcp_tool_call_begin",
      "call_id": "call_2ZBKJbPYIBgm5qo2mzRpqi1U",
        "invocation": {
        "server": "12306-mcp",
        "tool": "get-tickets",
        "arguments": {
          "date": "2025-10-10",
          "fromStation": "SZQ",
          "toStation": "GZQ"
        }
      }
    }
   */
  MCP_TOOL_CALL_BEGIN = 'mcp_tool_call_begin',

  /**
   *
   * prompt: 2025
   * payload: {
    "type": "mcp_tool_call_end",
      "call_id": "call_VNRuLW1UoklIAK3QTL5iE47l",
      "invocation": {
        "server": "12306-mcp",
        "tool": "get-tickets",
        "arguments": {
          "date": "2025-10-10",
          "fromStation": "SZQ",
          "toStation": "GZQ"
          }
        },
        "duration": {
          "secs": 0,
          "nanos": 874102541
        },
        "result": {
          "Ok": {
          "content": [
            {
            "text": "train|origin -> destination|departure -> arrival|duration\nEXAMPLE example_origin -> example_destination 06:10 -> 06:46 duration: 00:36\n-...",
            "type": "text"
            }
          ]
        }
      }
    }
   */
  MCP_TOOL_CALL_END = 'mcp_tool_call_end',

  /**
   * payload: { tools: Record<string, McpTool> }
   */
  MCP_LIST_TOOLS_RESPONSE = 'mcp_list_tools_response',

  // Web search events
  /**
   * tipsweb_serach ~/.codex/config.toml web_search = true
   * prompt: TypeScript 5.0
   * payload: {
   *  "type":"web_search_begin",
   *  "call_id":"ws_010bdd5c4db8ef410168da04c74a648196b7e30cb864885b26"
   * }
   */
  WEB_SEARCH_BEGIN = 'web_search_begin',

  /**
   * prompt: TypeScript 5.0
   * payload: {
   *  "type":"web_search_end",
   *  "call_id":"ws_010bdd5c4db8ef410168da04c74a648196b7e30cb864885b26",
   *  "query":"TypeScript 5.0 whats new site:devblogs.microsoft.com/typescript"
   * }
   */
  WEB_SEARCH_END = 'web_search_end',

  // Conversation history & context
  /**
   * prompt: apply_patch <<'PATCH' PATCH
   * payload: {
      "type": "turn_diff",
      // eslint-disable-next-line max-len
      "unified_diff": "diff --git a//Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1759197123355/freestyle.txt b//Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1759197123355/freestyle.txt\nnew file mode 100644\nindex 0000000000000000000000000000000000000000..151e31d7a6627e3fb0df2e49b3c0c179f96e46cc\n--- /dev/null\n+++ b//Users/pojian/Library/Application Support/AionUi/aionui/codex-temp-1759197123355/freestyle.txt\n@@ -0,0 +1,2 @@\n+This file was created via apply_patch.\n+Line two says hello.\n"
    }
   */
  TURN_DIFF = 'turn_diff',

  /**
   * prompt:
   * payload: { offset: number, log_id: number, entry: HistoryEntry | null }
   */
  GET_HISTORY_ENTRY_RESPONSE = 'get_history_entry_response',

  /**
   * payload: { custom_prompts: CustomPrompt[] }
   */
  LIST_CUSTOM_PROMPTS_RESPONSE = 'list_custom_prompts_response',

  /**
   * payload: { conversation_id: string, path: string }
   */
  CONVERSATION_PATH = 'conversation_path',

  /**
   * payload: { message: string }
   */
  BACKGROUND_EVENT = 'background_event',

  /**
   * payload: { reason: TurnAbortReason }
   */
  TURN_ABORTED = 'turn_aborted',
}
