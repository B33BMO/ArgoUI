/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AionUi base components unified exports
 *
 * Provides unified export entry for all base components and types
 */

// Component Exports ====================

export { default as AionModal } from './AionModal';
export { default as AionCollapse } from './AionCollapse';
export { default as AionSelect } from './AionSelect';
export { default as AionScrollArea } from './AionScrollArea';
export { default as AionSteps } from './AionSteps';

// Type Exports ====================

// AionModal / AionModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  AionModalProps,
} from './AionModal';
export { MODAL_SIZES } from './AionModal';

// AionCollapse / AionCollapse types
export type { AionCollapseProps, AionCollapseItemProps } from './AionCollapse';

// AionSelect / AionSelect types
export type { AionSelectProps } from './AionSelect';

// AionSteps / AionSteps types
export type { AionStepsProps } from './AionSteps';
