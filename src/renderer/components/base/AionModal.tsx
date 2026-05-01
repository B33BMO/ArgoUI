/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModalProps } from '@arco-design/web-react';
import { Modal, Button } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import classNames from 'classnames';
import type { CSSProperties } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';


export type ModalSize = 'small' | 'medium' | 'large' | 'xlarge' | 'full';

export const MODAL_SIZES: Record<ModalSize, { width: string; height?: string }> = {
  small: { width: '400px', height: '300px' },
  medium: { width: '600px', height: '400px' },
  large: { width: '800px', height: '600px' },
  xlarge: { width: '1000px', height: '700px' },
  full: { width: '90vw', height: '90vh' },
};

/** Header*/
export interface ModalHeaderConfig {
  /** header*/
  render?: () => React.ReactNode;
  title?: React.ReactNode;
  showClose?: boolean;
  closeIcon?: React.ReactNode;
  /** Header*/
  className?: string;
  /** Header*/
  style?: CSSProperties;
}

/** Footer*/
export interface ModalFooterConfig {
  /** footer*/
  render?: () => React.ReactNode;
  /** Footer*/
  className?: string;
  /** Footer*/
  style?: CSSProperties;
}

export interface ModalContentStyleConfig {
  /** var(--dialog-fill-0)*/
  background?: string;
  borderRadius?: string | number;
  padding?: string | number;
  /** auto*/
  overflow?: 'auto' | 'scroll' | 'hidden' | 'visible';
  height?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
}

/** AionModal Props*/
export interface AionModalProps extends Omit<ModalProps, 'title' | 'footer'> {
  children?: React.ReactNode;

  /** style width/height*/
  size?: ModalSize;

  /** Header title*/
  header?: React.ReactNode | ModalHeaderConfig;

  footer?: React.ReactNode | ModalFooterConfig | null;

  contentStyle?: ModalContentStyleConfig;

  // === Props ===
  /** @deprecated header.title*/
  title?: React.ReactNode;
  /** @deprecated header.showClose*/
  showCustomClose?: boolean;
}

// Style Constants ====================

const HEADER_BASE_CLASS = 'flex items-center justify-between pb-20px';
const TITLE_BASE_CLASS = 'text-18px font-500 text-t-primary m-0';
const CLOSE_BUTTON_CLASS =
  'w-32px h-32px flex items-center justify-center rd-8px transition-colors duration-200 cursor-pointer border-0 bg-transparent p-0 hover:bg-2 focus:outline-none';
const FOOTER_BASE_CLASS = 'flex-shrink-0 bg-transparent';

/**
 * Custom modal component
 *
 * Wrapper around Arco Design Modal with unified theme styling, preset sizes, and font scaling support
 *
 * @features
 * Preset size support (small/medium/large/xlarge/full)
 * Responsive to font scale changes
 * Flexible header/footer configuration
 * Backward compatible with old API
 * Auto viewport adaptation
 *
 * @example
 * ```tsx
 * Basic usage
 * <AionModal visible={true} onCancel={handleClose} header="">
 * </AionModal>
 *
 * Preset size
 * <AionModal visible={true} size="large" header="">
 * </AionModal>
 *
 * Custom header
 * <AionModal
 *   visible={true}
 *   header={{
 * title: ""
 *     showClose: true,
 *     className: "custom-header"
 *   }}
 * >
 * </AionModal>
 *
 * Custom footer
 * <AionModal
 *   visible={true}
 * header=""
 *   footer={
 *     <div className="flex gap-2">
 * <Button onClick={handleCancel}></Button>
 * <Button type="primary" onClick={handleOk}></Button>
 *     </div>
 *   }
 * >
 * </AionModal>
 * ```
 */
const dimensionKeys = ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight'] as const;
type DimensionKey = (typeof dimensionKeys)[number];

const formatDimensionValue = (value?: string | number) => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

const AionModal: React.FC<AionModalProps> = ({
  children,
  size,
  header,
  footer,
  contentStyle,
  title,
  showCustomClose = true,
  onCancel,
  className = '',
  style,
  ...props
}) => {
  const { fontScale } = useThemeContext();
  const { t } = useTranslation();
  const contentBg = contentStyle?.background || 'var(--dialog-fill-0)';
  const contentBorderRadius = contentStyle?.borderRadius || '16px';
  const contentPadding = contentStyle?.padding || '0';
  const contentOverflow = contentStyle?.overflow || 'auto';

  const borderRadiusVal = typeof contentBorderRadius === 'number' ? `${contentBorderRadius}px` : contentBorderRadius;
  const paddingVal = typeof contentPadding === 'number' ? `${contentPadding}px` : contentPadding;

  const safeScale = fontScale > 0 ? fontScale : 1;

  const scaleDimension = (value: CSSProperties['width']): CSSProperties['width'] => {
    if (value === undefined || value === null) return value;
    if (typeof value === 'number') {
      return Number((value / safeScale).toFixed(2));
    }
    const match = /^([0-9]+(?:\.[0-9]+)?)px$/i.exec(value.trim());
    if (match) {
      return `${parseFloat(match[1]) / safeScale}px`;
    }
    return value;
  };

  // Handle size scaling
  const modalSize = size ? MODAL_SIZES[size] : undefined;
  const baseStyle: CSSProperties = {
    ...modalSize,
    ...style,
  };

  // / Scale size-related properties (avoid side effects)
  type DimensionStyle = Partial<Pick<CSSProperties, DimensionKey>>;
  const scaledStyle: DimensionStyle = {};
  dimensionKeys.forEach((key) => {
    const raw = baseStyle[key];
    if (raw !== undefined) {
      scaledStyle[key] = scaleDimension(raw as CSSProperties['width']) as CSSProperties[DimensionKey];
    }
  });

  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...scaledStyle,
  };

  // Auto set max dimensions to fit viewport
  if (typeof window !== 'undefined') {
    const viewportGap = 32;
    if (!mergedStyle.maxWidth) {
      mergedStyle.maxWidth = `calc(100vw - ${viewportGap}px)`;
    }
    if (!mergedStyle.maxHeight) {
      mergedStyle.maxHeight = `calc(100vh - ${viewportGap}px)`;
    }
  }

  const finalStyle: CSSProperties = {
    ...mergedStyle,
    borderRadius: mergedStyle.borderRadius ?? '16px',
  };

  const bodyInlineStyle = React.useMemo<CSSProperties>(() => {
    const style: CSSProperties = {
      background: contentBg,
      overflow: contentOverflow,
    };

    (['height', 'minHeight', 'maxHeight'] as const).forEach((key) => {
      const value = contentStyle?.[key];
      if (value !== undefined) {
        style[key] = formatDimensionValue(value);
      }
    });

    return style;
  }, [contentBg, paddingVal, contentOverflow, contentStyle?.height, contentStyle?.maxHeight, contentStyle?.minHeight]);

  // Header
  const headerConfig: ModalHeaderConfig = React.useMemo(() => {
    // header
    if (header !== undefined) {
      // ReactNode title
      if (typeof header === 'string' || React.isValidElement(header)) {
        return {
          title: header,
          showClose: true,
        };
      }
      return header as ModalHeaderConfig;
    }
    // title showCustomClose
    return {
      title,
      showClose: showCustomClose,
    };
  }, [header, title, showCustomClose]);

  // Footer
  const footerConfig: ModalFooterConfig | null = React.useMemo(() => {
    if (footer === null) {
      return null;
    }

    // footer
    if (footer === undefined) {
      const cancelLabel = props.cancelText ?? t('common.cancel', { defaultValue: 'Cancel' });
      const okLabel = props.okText ?? t('common.confirm', { defaultValue: 'Confirm' });
      return {
        render: () => (
          <div className='flex justify-end gap-10px mt-10px'>
            {}
            {/* Default buttons ship with rounded corners; text can be overridden via cancelText/okText */}
            <Button onClick={onCancel} className='px-20px min-w-80px' style={{ borderRadius: 8 }}>
              {cancelLabel}
            </Button>
            <Button
              type='primary'
              onClick={props.onOk}
              loading={props.confirmLoading}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {okLabel}
            </Button>
          </div>
        ),
      };
    }

    if (React.isValidElement(footer)) {
      return {
        render: () => footer,
      };
    }
    return footer as ModalFooterConfig;
  }, [footer, onCancel, props.cancelText, props.okText, props.onOk, props.confirmLoading, t]);

  // Header
  const renderHeader = () => {
    // render
    if (headerConfig.render) {
      return (
        <div className={headerConfig.className} style={headerConfig.style}>
          {headerConfig.render()}
        </div>
      );
    }

    // title header
    if (!headerConfig.title && !headerConfig.showClose) {
      return null;
    }

    // header
    const headerClassName = classNames(HEADER_BASE_CLASS, headerConfig.className);

    const headerStyle: CSSProperties = {
      borderBottom: '1px solid var(--bg-3)',
      ...headerConfig.style,
    };

    return (
      <div className={headerClassName} style={headerStyle}>
        {headerConfig.title && <h3 className={TITLE_BASE_CLASS}>{headerConfig.title}</h3>}
        {headerConfig.showClose && (
          <button onClick={onCancel} className={CLOSE_BUTTON_CLASS} aria-label='Close'>
            {headerConfig.closeIcon || <Close size={20} fill='#86909c' />}
          </button>
        )}
      </div>
    );
  };

  // Footer
  const renderFooter = () => {
    if (!footerConfig) {
      return null;
    }

    if (footerConfig.render) {
      const footerClassName = classNames(FOOTER_BASE_CLASS, footerConfig.className);
      return (
        <div className={footerClassName} style={footerConfig.style}>
          {footerConfig.render()}
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      {...props}
      title={null}
      closable={false}
      footer={null}
      onCancel={onCancel}
      className={`aionui-modal ${className}`}
      style={finalStyle}
      getPopupContainer={() => document.body}
    >
      <div className='aionui-modal-wrapper' style={{ borderRadius: borderRadiusVal }}>
        {renderHeader()}
        <div className='aionui-modal-body-content' style={bodyInlineStyle}>
          {children}
        </div>
        {renderFooter()}
      </div>
    </Modal>
  );
};

AionModal.displayName = 'AionModal';

export default AionModal;
