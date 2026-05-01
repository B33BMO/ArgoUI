/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import MonacoEditor from '@monaco-editor/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HTMLPreviewProps {
  content: string;
  filePath?: string;
  hideToolbar?: boolean;
}

interface SelectedElement {
  path: string; // DOM "html > body > div:nth-child(2) > p:nth-child(1)"
  html: string; // outerHTML
  startLine?: number;
  endLine?: number;
}

/**
 *
 *
 */
const HTMLPreview: React.FC<HTMLPreviewProps> = ({ content, filePath, hideToolbar = false }) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [htmlCode, setHtmlCode] = useState(content);
  const [inspectorMode, setInspectorMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: SelectedElement } | null>(null);
  const [messageApi, messageContextHolder] = Message.useMessage();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // iframe
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // Write HTML content
    iframeDoc.open();

    // Inject <base> tag to support relative paths
    let finalHtml = htmlCode;
    if (filePath) {
      // Get directory of the file
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      // Construct file:// protocol base URL
      const baseUrl = `file://${fileDir}`;

      // Check if base tag exists
      if (!finalHtml.match(/<base\s+href=/i)) {
        if (finalHtml.match(/<head>/i)) {
          finalHtml = finalHtml.replace(/<head>/i, `<head><base href="${baseUrl}">`);
        } else if (finalHtml.match(/<html>/i)) {
          finalHtml = finalHtml.replace(/<html>/i, `<html><head><base href="${baseUrl}"></head>`);
        } else {
          finalHtml = `<head><base href="${baseUrl}"></head>${finalHtml}`;
        }
      }
    }

    iframeDoc.write(finalHtml);
    iframeDoc.close();

    if (inspectorMode) {
      injectInspectorScript(iframeDoc);
    }
  }, [htmlCode, inspectorMode]);

  /**
   * iframe
   */
  const injectInspectorScript = (iframeDoc: Document) => {
    const script = iframeDoc.createElement('script');
    script.textContent = `
      (function() {
        let hoveredElement = null;
        let overlay = null;

        function createOverlay() {
          overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.border = '2px solid #2196F3';
          overlay.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '999999';
          overlay.style.boxSizing = 'border-box';
          document.body.appendChild(overlay);
        }

        function updateOverlay(element) {
          if (!overlay) createOverlay();
          const rect = element.getBoundingClientRect();
          overlay.style.top = rect.top + window.scrollY + 'px';
          overlay.style.left = rect.left + window.scrollX + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.display = 'block';
        }

        function hideOverlay() {
          if (overlay) {
            overlay.style.display = 'none';
          }
        }

        function getElementPath(element) {
          const path = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
              selector += '#' + element.id;
              path.unshift(selector);
              break;
            } else {
              let sibling = element;
              let nth = 1;
              while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.nodeName.toLowerCase() === selector) {
                  nth++;
                }
              }
              if (nth > 1) {
                selector += ':nth-child(' + nth + ')';
              }
            }
            path.unshift(selector);
            element = element.parentElement;
          }
          return path.join(' > ');
        }

        document.addEventListener('mousemove', function(e) {
          hoveredElement = e.target;
          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            updateOverlay(hoveredElement);
          } else {
            hideOverlay();
          }
        });

        document.addEventListener('mouseleave', function() {
          hideOverlay();
        });

        document.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            const elementInfo = {
              path: getElementPath(hoveredElement),
              html: hoveredElement.outerHTML,
            };

            window.parent.postMessage({
              type: 'element-selected',
              data: elementInfo
            }, '*');
          }
        });

        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();

          if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
            const elementInfo = {
              path: getElementPath(hoveredElement),
              html: hoveredElement.outerHTML,
            };

            window.parent.postMessage({
              type: 'element-contextmenu',
              data: {
                element: elementInfo,
                x: e.clientX,
                y: e.clientY
              }
            }, '*');
          }
        });
      })();
    `;
    iframeDoc.body.appendChild(script);
  };

  /**
   * iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected') {
        const elementInfo: SelectedElement = event.data.data;
        setSelectedElement(elementInfo);
        messageApi.info(t('preview.html.elementSelected', { path: elementInfo.path }));
      } else if (event.data.type === 'element-contextmenu') {
        const { element, x, y } = event.data.data;

        const iframe = iframeRef.current;
        if (iframe) {
          const iframeRect = iframe.getBoundingClientRect();
          setContextMenu({
            x: iframeRect.left + x,
            y: iframeRect.top + y,
            element: element,
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [messageApi]);

  /**
   */
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  /**
   */
  const handleCopyHTML = useCallback(
    (html: string) => {
      void navigator.clipboard.writeText(html);
      messageApi.success(t('preview.html.copySuccess'));
      setContextMenu(null);
    },
    [messageApi, t]
  );

  /**
   */
  const handleDownload = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filePath?.split('/').pop() || 'document'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   */
  const handleToggleEdit = () => {
    if (editMode) {
      setHtmlCode(htmlCode);
    }
    setEditMode(!editMode);
  };

  /**
   */
  const handleToggleInspector = () => {
    setInspectorMode(!inspectorMode);
    if (!inspectorMode) {
      messageApi.info(t('preview.html.inspectorEnabled'));
    }
  };

  return (
    <div className='h-full w-full flex flex-col bg-bg-1'>
      {messageContextHolder}

      {}
      {!hideToolbar && (
        <div className='flex items-center justify-between h-40px px-12px bg-bg-2 border-b border-border-base flex-shrink-0'>
          <div className='flex items-center gap-8px'>
            {}
            <button
              onClick={handleToggleEdit}
              className={`px-12px py-4px rd-4px text-12px transition-colors ${editMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`}
            >
              {editMode ? `💾 ${t('common.save')}` : `✏️ ${t('common.edit')}`}
            </button>

            {}
            <button
              onClick={handleToggleInspector}
              className={`px-12px py-4px rd-4px text-12px transition-colors ${inspectorMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`}
              title={t('preview.html.inspectorTooltip')}
            >
              🔍 {inspectorMode ? t('preview.html.inspecting') : t('preview.html.inspectorButton')}
            </button>

            {}
            {selectedElement && (
              <div className='text-12px text-t-secondary ml-8px'>
                {t('preview.html.selectedLabel')} <code className='bg-bg-3 px-4px rd-2px'>{selectedElement.path}</code>
              </div>
            )}
          </div>

          <div className='flex items-center gap-8px'>
            {}
            <button
              onClick={handleDownload}
              className='flex items-center gap-4px px-8px py-4px rd-4px cursor-pointer hover:bg-bg-3 transition-colors'
              title={t('preview.html.downloadHtml')}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                className='text-t-secondary'
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' y1='15' x2='12' y2='3' />
              </svg>
              <span className='text-12px text-t-secondary'>{t('common.download')}</span>
            </button>
          </div>
        </div>
      )}

      {}
      <div className='flex-1 flex overflow-hidden'>
        {}
        {editMode && (
          <div className='flex-1 overflow-hidden border-r border-border-base'>
            <MonacoEditor
              height='100%'
              language='html'
              theme={currentTheme === 'dark' ? 'vs-dark' : 'vs'}
              value={htmlCode}
              onChange={(value) => setHtmlCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        )}

        {}
        <div className={`${editMode ? 'flex-1' : 'w-full'} overflow-auto bg-white`}>
          <iframe
            ref={iframeRef}
            className='w-full h-full border-0'
            sandbox='allow-scripts allow-same-origin'
            title='HTML Preview'
          />
        </div>
      </div>

      {}
      {contextMenu && (
        <div
          className='fixed bg-bg-1 border border-border-base rd-6px shadow-lg py-4px z-9999'
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors'
            onClick={() => handleCopyHTML(contextMenu.element.html)}
          >
            📋 {t('preview.html.copyElementHtml')}
          </div>
          <div
            className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors'
            onClick={() => {
              console.log('[HTMLPreview] Element info:', contextMenu.element);
              messageApi.info(t('preview.html.printedToConsole'));
              setContextMenu(null);
            }}
          >
            🔍 {t('preview.html.viewElementInfo')}
          </div>
        </div>
      )}
    </div>
  );
};

export default HTMLPreview;
