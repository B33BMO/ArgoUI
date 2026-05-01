/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { FolderClose, FolderOpen } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';

interface WorkspaceCollapseProps {
  expanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  siderCollapsed?: boolean;
}

/**
 */
const WorkspaceCollapse: React.FC<WorkspaceCollapseProps> = ({
  expanded,
  onToggle,
  header,
  children,
  className,
  siderCollapsed = false,
}) => {
  const showContent = siderCollapsed || expanded;

  return (
    <div className={classNames('workspace-collapse min-w-0', className)}>
      {}
      {!siderCollapsed && (
        <div
          className='flex items-center gap-8px h-40px px-10px cursor-pointer hover:bg-[rgba(var(--primary-6),0.14)] rd-8px transition-colors min-w-0'
          onClick={onToggle}
        >
          {/*/ 28px sider*/}
          <span className='w-28px h-28px flex items-center justify-center shrink-0'>
            {expanded ? (
              <FolderOpen size={20} className='line-height-0' />
            ) : (
              <FolderClose size={20} className='line-height-0' />
            )}
          </span>

          {}
          <div className='flex-1 min-w-0 overflow-hidden'>{header}</div>
        </div>
      )}

      {/*- 20px, icon*/}
      {showContent && (
        <div className={classNames('workspace-collapse-content min-w-0', { 'pl-20px': !siderCollapsed })}>
          {children}
        </div>
      )}
    </div>
  );
};

export default WorkspaceCollapse;
