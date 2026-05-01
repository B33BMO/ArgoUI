/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpModelInfo } from '@/common/types/acpTypes';

/**
 */
export function getAcpModelSourceLabel(modelInfo: Pick<AcpModelInfo, 'source' | 'sourceDetail'> | null): string {
  const sourceDetail = modelInfo?.sourceDetail;
  if (sourceDetail === 'cc-switch') return 'cc-switch';
  // if (sourceDetail === 'acp-config-option') return 'ACP config';
  // if (sourceDetail === 'acp-models') return 'ACP models';
  // if (sourceDetail === 'persisted-model') return 'saved model';
  // if (sourceDetail === 'codex-stream') return 'Codex stream';

  // if (modelInfo?.source === 'configOption') return 'ACP config';
  // if (modelInfo?.source === 'models') return 'ACP models';
  return '';
}

/**
 */
export function formatAcpModelDisplayLabel(modelLabel: string, sourceLabel: string): string {
  if (!sourceLabel) return modelLabel;
  if (!modelLabel) return sourceLabel;
  return `${modelLabel} · ${sourceLabel}`;
}
