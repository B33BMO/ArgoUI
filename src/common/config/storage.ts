/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackend, AcpBackendAll, AcpBackendConfig } from '@/common/types/acpTypes';
import type { SpeechToTextConfig } from '@/common/types/speech';
import { storage } from '@office-ai/platform';

/**
 * @description
 */
export const ChatStorage = storage.buildStorage<IChatConversationRefer>('agent.chat');

export const ChatMessageStorage = storage.buildStorage('agent.chat.message');

export const ConfigStorage = storage.buildStorage<IConfigStorageRefer>('agent.config');

export const EnvStorage = storage.buildStorage<IEnvStorageRefer>('agent.env');

export interface IConfigStorageRefer {
  'gemini.config': {
    authType: string;
    proxy: string;
    GOOGLE_GEMINI_BASE_URL?: string;
    /** @deprecated Use accountProjects instead. Kept for backward compatibility migration. */
    GOOGLE_CLOUD_PROJECT?: string;
    /*GCP project IDs stored per Google account*/
    accountProjects?: Record<string, string>;
    yoloMode?: boolean;
    /** Preferred session mode for new conversations*/
    preferredMode?: string;
    /** Preferred model ID for new conversations*/
    preferredModelId?: string;
  };
  'codex.config'?: {
    cliPath?: string;
    yoloMode?: boolean;
    sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
  };
  'acp.config': {
    [backend in AcpBackend]?: {
      authMethodId?: string;
      authToken?: string;
      lastAuthTime?: number;
      cliPath?: string;
      yoloMode?: boolean;
      /** Preferred session mode for new conversations*/
      preferredMode?: string;
      /** Preferred model ID for new conversations*/
      preferredModelId?: string;
      /** LLM prompt timeout in seconds (default: 300)*/
      promptTimeout?: number;
    };
  };
  /** Global LLM prompt timeout in seconds (default: 300). Per-backend promptTimeout overrides this. */
  'acp.promptTimeout'?: number;
  /** Idle timeout in minutes before an ACP agent process is killed to reclaim memory (default: 5). */
  'acp.agentIdleTimeout'?: number;
  /** User-defined custom ACP agents (isPreset !== true, require defaultCliPath). */
  'acp.customAgents'?: AcpBackendConfig[];
  /** Preset assistant configurations (isPreset === true, prompt-only, no CLI). */
  assistants?: AcpBackendConfig[];
  // Cached initialize results per ACP backend (persisted across sessions)
  'acp.cachedInitializeResult'?: Record<string, import('@/common/types/acpTypes').AcpInitializeResult>;
  // Cached model lists per ACP backend for Guid page pre-selection
  'acp.cachedModels'?: Record<string, import('@/common/types/acpTypes').AcpModelInfo>;
  // Cached config options per ACP backend for Guid page pre-selection
  'acp.cachedConfigOptions'?: Record<string, import('@/common/types/acpTypes').AcpSessionConfigOption[]>;
  // Cached modes per ACP backend for Guid page / AgentModeSelector
  'acp.cachedModes'?: Record<string, import('@/common/types/acpTypes').AcpSessionModes>;
  'model.config': IProvider[];
  'mcp.config': IMcpServer[];
  'mcp.agentInstallStatus': Record<string, string[]>;
  language: string;
  theme: string;
  colorScheme: string;
  /** Persisted app-wide UI zoom factor for Display settings */
  'ui.zoomFactor'?: number;
  /*Auto-enable WebUI in desktop mode*/
  'webui.desktop.enabled'?: boolean;
  /*Allow remote access in desktop mode*/
  'webui.desktop.allowRemote'?: boolean;
  /*WebUI port in desktop mode*/
  'webui.desktop.port'?: number;
  customCss: string;
  'css.themes': ICssTheme[]; // Custom CSS themes list
  'css.activeThemeId': string; // Currently active theme ID
  'gemini.defaultModel': string | { id: string; useModel: string };
  'aionrs.config'?: {
    /** Preferred session mode for new conversations*/
    preferredMode?: string;
  };
  'aionrs.defaultModel'?: { id: string; useModel: string };
  'tools.imageGenerationModel': TProviderWithModel & {
    /** @deprecated Image generation is now controlled via built-in MCP server toggle */
    switch?: boolean;
  };
  'tools.speechToText'?: SpeechToTextConfig;
  'workspace.pasteConfirm'?: boolean;
  'upload.saveToWorkspace'?: boolean;
  // Last selected agent type on guid page
  'guid.lastSelectedAgent'?: string;
  // Migration flag: fix assistant enabled default value issue
  'migration.assistantEnabledFixed'?: boolean;
  // Migration flag: add default enabled skills for cowork assistant
  /** @deprecated Use migration.builtinDefaultSkillsAdded_v2 instead */
  'migration.coworkDefaultSkillsAdded'?: boolean;
  // Migration flag: add default enabled skills for all builtin assistants
  'migration.builtinDefaultSkillsAdded_v2'?: boolean;
  // Migration flag: add promptsI18n for all builtin assistants
  'migration.promptsI18nAdded'?: boolean;
  /** Migration flag: split 'assistants' into presets-only + 'acp.customAgents' (user-defined customs). */
  'migration.assistantsSplitCustom'?: boolean;
  /** Migration flag: Electron desktop config has been imported to server config */
  'migration.electronConfigImported'?: boolean;
  // Minimize to system tray when closing window
  'system.closeToTray'?: boolean;
  // Show system notification when task completes
  'system.notificationEnabled'?: boolean;
  // Show system notification when scheduled task completes
  'system.cronNotificationEnabled'?: boolean;
  // Prevent system sleep to ensure scheduled tasks run
  'system.keepAwake'?: boolean;
  // Automatically preview newly created Office files in the current workspace
  'system.autoPreviewOfficeFiles'?: boolean;
  // Telegram assistant default model
  'assistant.telegram.defaultModel'?: {
    id: string;
    useModel: string;
  };
  // Telegram assistant agent selection
  'assistant.telegram.agent'?: {
    backend: string;
    customAgentId?: string;
    name?: string;
  };
  // Lark assistant default model
  'assistant.lark.defaultModel'?: {
    id: string;
    useModel: string;
  };
  // Lark assistant agent selection
  'assistant.lark.agent'?: {
    backend: string;
    customAgentId?: string;
    name?: string;
  };
  // DingTalk assistant default model
  'assistant.dingtalk.defaultModel'?: {
    id: string;
    useModel: string;
  };
  // DingTalk assistant agent selection
  'assistant.dingtalk.agent'?: {
    backend: string;
    customAgentId?: string;
    name?: string;
  };
  // WeChat assistant default model
  'assistant.weixin.defaultModel'?: {
    id: string;
    useModel: string;
  };
  // WeChat assistant agent selection
  'assistant.weixin.agent'?: {
    backend: string;
    customAgentId?: string;
    name?: string;
  };
  // WeCom assistant default model
  'assistant.wecom.defaultModel'?: {
    id: string;
    useModel: string;
  };
  // WeCom assistant agent selection
  'assistant.wecom.agent'?: {
    backend: string;
    customAgentId?: string;
    name?: string;
  };
  // Skills Market: whether the aionui-skills builtin skill is enabled
  'skillsMarket.enabled'?: boolean;
  // Desktop Pet: whether the desktop pet feature is enabled
  'pet.enabled'?: boolean;
  // Desktop Pet: size in pixels (200, 280, or 360)
  'pet.size'?: number;
  // Desktop Pet: do not disturb mode (pet stays idle, ignores AI events)
  'pet.dnd'?: boolean;
  // Desktop Pet: whether tool-call confirmations are routed to the pet's bubble
  // (true) or remain in the main chat window (false). Default true.
  'pet.confirmEnabled'?: boolean;
}

export interface IEnvStorageRefer {
  'aionui.dir': {
    workDir: string;
    cacheDir: string;
  };
}

/**
 * Conversation source type - identifies where the conversation was created
 */
export type ConversationSource = 'aionui' | 'telegram' | 'lark' | 'dingtalk' | 'weixin' | 'wecom' | (string & {});

interface IChatConversation<T, Extra> {
  createTime: number;
  modifyTime: number;
  name: string;
  desc?: string;
  id: string;
  type: T;
  extra: Extra;
  model: TProviderWithModel;
  status?: 'pending' | 'running' | 'finished' | undefined;
  /*Conversation source, defaults to aionui*/
  source?: ConversationSource;
  /** Channel chat isolation ID (e.g. user:xxx, group:xxx) */
  channelChatId?: string;
}

export interface TokenUsageData {
  totalTokens: number;
}

export type TChatConversation =
  | IChatConversation<
      'gemini',
      {
        workspace: string;
        customWorkspace?: boolean; // true false
        webSearchEngine?: 'google' | 'default';
        lastTokenUsage?: TokenUsageData; // token
        contextFileName?: string;
        contextContent?: string;
        // System rules support
        presetRules?: string; // System rules, injected at initialization
        /*Enabled skills list for filtering SkillManager skills*/
        enabledSkills?: string[];
        /** skills / Snapshot of actually loaded skills (persisted on first message)*/
        loadedSkills?: Array<{ name: string; description: string }>;
        /*Preset assistant ID for displaying name and avatar in conversation panel*/
        presetAssistantId?: string;
        /*Whether this conversation is pinned*/
        pinned?: boolean;
        /** / Pin timestamp in milliseconds*/
        pinnedAt?: number;
        /** Persisted session mode for resume support*/
        sessionMode?: string;
        /** Explicit marker for temporary health-check conversations */
        isHealthCheck?: boolean;
        /** Cron job ID that spawned this conversation */
        cronJobId?: string;
      }
    >
  | Omit<
      IChatConversation<
        'acp',
        {
          workspace?: string;
          backend: AcpBackend;
          cliPath?: string;
          customWorkspace?: boolean;
          agentName?: string;
          customAgentId?: string; // UUID for identifying specific custom agent
          presetContext?: string; // Preset context from smart assistant
          /*Enabled skills list for filtering SkillManager skills*/
          enabledSkills?: string[];
          /*Builtin auto-injected skills to exclude*/
          excludeBuiltinSkills?: string[];
          /*Snapshot of actually loaded skills*/
          loadedSkills?: Array<{ name: string; description: string }>;
          /*Preset assistant ID for displaying name and avatar in conversation panel*/
          presetAssistantId?: string;
          /*Whether this conversation is pinned*/
          pinned?: boolean;
          /** / Pin timestamp in milliseconds*/
          pinnedAt?: number;
          /*ACP backend session UUID for session resume*/
          acpSessionId?: string;
          /** Conversation ID that owns the ACP session*/
          acpSessionConversationId?: string;
          /*Last update time of ACP session*/
          acpSessionUpdatedAt?: number;
          /** Last context usage from usage_update */
          lastTokenUsage?: TokenUsageData;
          /** Context window capacity from usage_update */
          lastContextLimit?: number;
          /** Persisted session mode for resume support*/
          sessionMode?: string;
          /** Persisted model ID for resume support*/
          currentModelId?: string;
          /** Cached config options from ACP backend*/
          cachedConfigOptions?: import('@/common/types/acpTypes').AcpSessionConfigOption[];
          /** Pending config option selections from Guid page*/
          pendingConfigOptions?: Record<string, string>;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Cron job ID that spawned this conversation */
          cronJobId?: string;
        }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'codex',
        {
          workspace?: string;
          cliPath?: string;
          customWorkspace?: boolean;
          sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'; // Codex sandbox permission mode
          presetContext?: string; // Preset context from smart assistant
          /*Enabled skills list for filtering SkillManager skills*/
          enabledSkills?: string[];
          /*Snapshot of actually loaded skills*/
          loadedSkills?: Array<{ name: string; description: string }>;
          /*Preset assistant ID for displaying name and avatar in conversation panel*/
          presetAssistantId?: string;
          /*Whether this conversation is pinned*/
          pinned?: boolean;
          /** / Pin timestamp in milliseconds*/
          pinnedAt?: number;
          /** Persisted session mode for resume support*/
          sessionMode?: string;
          /** User-selected Codex model from Guid page*/
          codexModel?: string;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Cron job ID that spawned this conversation */
          cronJobId?: string;
        }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'openclaw-gateway',
        {
          workspace?: string;
          backend?: AcpBackendAll;
          agentName?: string;
          customWorkspace?: boolean;
          /** Gateway configuration */
          gateway?: {
            host?: string;
            port?: number;
            token?: string;
            password?: string;
            useExternalGateway?: boolean;
            cliPath?: string;
          };
          /** Session key for resume */
          sessionKey?: string;
          /** Runtime validation snapshot used for post-switch strong checks */
          runtimeValidation?: {
            expectedWorkspace?: string;
            expectedBackend?: string;
            expectedAgentName?: string;
            expectedCliPath?: string;
            expectedModel?: string;
            expectedIdentityHash?: string | null;
            switchedAt?: number;
          };
          /*Enabled skills list*/
          enabledSkills?: string[];
          /*Snapshot of actually loaded skills*/
          loadedSkills?: Array<{ name: string; description: string }>;
          /*Preset assistant ID*/
          presetAssistantId?: string;
          /*Whether this conversation is pinned*/
          pinned?: boolean;
          /** / Pin timestamp in milliseconds*/
          pinnedAt?: number;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Cron job ID that spawned this conversation */
          cronJobId?: string;
        }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'nanobot',
        {
          workspace?: string;
          customWorkspace?: boolean;
          /*Enabled skills list*/
          enabledSkills?: string[];
          /*Snapshot of actually loaded skills*/
          loadedSkills?: Array<{ name: string; description: string }>;
          /*Preset assistant ID*/
          presetAssistantId?: string;
          /*Whether this conversation is pinned*/
          pinned?: boolean;
          /** / Pin timestamp in milliseconds*/
          pinnedAt?: number;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Cron job ID that spawned this conversation */
          cronJobId?: string;
        }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'remote',
        {
          workspace?: string;
          customWorkspace?: boolean;
          /** Remote agent config ID (FK to remote_agents table) */
          remoteAgentId: string;
          /** Remote session key for resume */
          sessionKey?: string;
          /** Enabled skills list */
          enabledSkills?: string[];
          /** Snapshot of actually loaded skills */
          loadedSkills?: Array<{ name: string; description: string }>;
          /** Preset assistant ID */
          presetAssistantId?: string;
          /** Whether this conversation is pinned */
          pinned?: boolean;
          /** Pin timestamp in milliseconds */
          pinnedAt?: number;
          /** Explicit marker for temporary health-check conversations */
          isHealthCheck?: boolean;
          /** Cron job ID that spawned this conversation */
          cronJobId?: string;
        }
      >,
      'model'
    >
  | IChatConversation<
      'aionrs',
      {
        workspace: string;
        customWorkspace?: boolean;
        proxy?: string;
        /** System rules injected at initialization */
        presetRules?: string;
        /** Enabled skills list */
        enabledSkills?: string[];
        /** Snapshot of actually loaded skills */
        loadedSkills?: Array<{ name: string; description: string }>;
        /** Preset assistant ID */
        presetAssistantId?: string;
        /** Whether this conversation is pinned */
        pinned?: boolean;
        /** Pin timestamp in milliseconds */
        pinnedAt?: number;
        /** Max tokens per response */
        maxTokens?: number;
        /** Max agentic turns */
        maxTurns?: number;
        /** Persisted session mode for resume support */
        sessionMode?: string;
        /** Explicit marker for temporary health-check conversations */
        isHealthCheck?: boolean;
        /** Last token usage stats */
        lastTokenUsage?: TokenUsageData;
        /** Cron job ID that spawned this conversation */
        cronJobId?: string;
      }
    >;

export type IChatConversationRefer = {
  'chat.history': TChatConversation[];
};

export type ModelType =
  | 'text'
  | 'vision'
  | 'function_calling'
  | 'image_generation'
  | 'web_search'
  | 'reasoning'
  | 'embedding'
  | 'rerank'
  | 'excludeFromPrimary';

export type ModelCapability = {
  type: ModelType;
  /**
   * trueundefined
   */
  isUserSelected?: boolean;
};

export interface IProvider {
  id: string;
  platform: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string[];
  /**
   */
  capabilities?: ModelCapability[];
  /**
   * token
   */
  contextLimit?: number;
  /**
   * platform 'new-api'
   * Per-model protocol overrides. Maps model name to protocol string.
   * Only used when platform is 'new-api'.
   * e.g. { "gemini-2.5-pro": "gemini", "claude-sonnet-4": "anthropic", "gpt-4o": "openai" }
   */
  modelProtocols?: Record<string, string>;
  /**
   * AWS Bedrock specific configuration
   * Only used when platform is 'bedrock'
   */
  bedrockConfig?: {
    authMethod: 'accessKey' | 'profile';
    region: string;
    // For access key method
    accessKeyId?: string;
    secretAccessKey?: string;
    // For profile method
    profile?: string;
  };
  /**
   * true
   * Provider enabled state, defaults to true
   */
  enabled?: boolean;
  /**
   * true
   * Individual model enabled states, defaults to all true
   */
  modelEnabled?: Record<string, boolean>;
  /**
   * Model health check results (for UI display only, does not affect enabled state)
   */
  modelHealth?: Record<
    string,
    {
      status: 'unknown' | 'healthy' | 'unhealthy';
      lastCheck?: number; // timestamp
      latency?: number; // / latency in milliseconds
      error?: string; // error message
    }
  >;
}

export type TProviderWithModel = Omit<IProvider, 'model'> & {
  useModel: string;
};

// MCP Server Configuration Types
export type McpTransportType = 'stdio' | 'sse' | 'http';

export interface IMcpServerTransportStdio {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface IMcpServerTransportSSE {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportHTTP {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportStreamableHTTP {
  type: 'streamable_http';
  url: string;
  headers?: Record<string, string>;
}

export type IMcpServerTransport =
  | IMcpServerTransportStdio
  | IMcpServerTransportSSE
  | IMcpServerTransportHTTP
  | IMcpServerTransportStreamableHTTP;

export interface IMcpServer {
  id: string;
  name: string;
  description?: string;
  enabled: boolean; // CLI agents
  transport: IMcpServerTransport;
  tools?: IMcpTool[];
  status?: 'connected' | 'disconnected' | 'error' | 'testing';
  lastConnected?: number;
  createdAt: number;
  updatedAt: number;
  originalJson: string;
  /** Built-in MCP server managed by AionUi (hide edit/delete in UI) */
  builtin?: boolean;
}

/** Stable ID for the built-in image generation MCP server */
export const BUILTIN_IMAGE_GEN_ID = 'builtin-image-gen';

export interface IMcpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  _meta?: Record<string, unknown>;
}

/**
 * CSS Theme configuration interface
 * Used to store user-defined CSS skins
 */
export interface ICssTheme {
  id: string; // Unique identifier
  name: string; // Theme name
  cover?: string; // Cover image base64 or URL
  css: string; // CSS style code
  isPreset?: boolean; // Whether it's a preset theme
  createdAt: number; // Creation time
  updatedAt: number; // Update time
}
