/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Preview
 * Preview module type definitions
 *
 * @/common/types/preview
 * Note: Core type definitions are in @/common/types/preview for IPC
 */

// common
// Re-export types from common for convenience within module
export type {
  PreviewContentType,
  PreviewHistoryTarget,
  PreviewSnapshotInfo,
  RemoteImageFetchRequest,
} from '@/common/types/preview';

/**
 * View mode
 */
export type ViewMode = 'source' | 'preview';

/**
 * Preview tab information
 */
export interface PreviewTabInfo {
  id: string;
  title: string;
  isDirty?: boolean;
}
