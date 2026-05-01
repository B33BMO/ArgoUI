/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ToolCategory {
  EXECUTION = 'execution', // shell, bash, python
  FILE_OPS = 'file_ops',
  SEARCH = 'search',
  ANALYSIS = 'analysis',
  COMMUNICATION = 'communication',
  CUSTOM = 'custom',
}

export enum OutputFormat {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  IMAGE = 'image',
  CHART = 'chart',
  DIAGRAM = 'diagram',
  TABLE = 'table',
}

export enum RendererType {
  STANDARD = 'standard',
  MARKDOWN = 'markdown', // Markdown
  CODE = 'code',
  CHART = 'chart',
  IMAGE = 'image',
  INTERACTIVE = 'interactive',
  COMPOSITE = 'composite',
}

export interface ToolAvailability {
  platforms: string[]; // ['darwin', 'linux', 'win32']
  requires?: string[];
  experimental?: boolean;
}

export interface ToolCapabilities {
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsCharts: boolean;
  supportsMarkdown: boolean;
  supportsInteraction: boolean;
  outputFormats: OutputFormat[];
}

export interface ToolRenderer {
  type: RendererType;
  config: Record<string, unknown>;
}

export interface ToolDefinition {
  id: string;
  name: string;
  displayNameKey: string; // i18n key for display name
  category: ToolCategory;
  priority: number;
  availability: ToolAvailability;
  capabilities: ToolCapabilities;
  renderer: ToolRenderer;
  icon?: string;
  descriptionKey: string; // i18n key for description
  schema?: Record<string, unknown>; // Schema
}

export interface McpToolInfo {
  name: string;
  serverName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}
