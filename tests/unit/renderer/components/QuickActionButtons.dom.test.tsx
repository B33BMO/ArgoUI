import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuickActionButtons from '@renderer/pages/guid/components/QuickActionButtons';

const { navigateMock, onStatusChangedMock, getStatusInvokeMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  onStatusChangedMock: vi.fn(() => vi.fn()),
  getStatusInvokeMock: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  webui: {
    getStatus: {
      invoke: getStatusInvokeMock,
    },
    statusChanged: {
      on: onStatusChangedMock,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@icon-park/react', () => ({
  Earth: () => React.createElement('span', { 'data-testid': 'earth-icon' }, 'Earth'),
}));

vi.mock('@renderer/pages/guid/index.module.css', () => ({
  default: {
    guidQuickActions: 'guidQuickActions',
  },
}));

describe('QuickActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the repo link from the repo quick action', () => {
    const onOpenLink = vi.fn();

    render(<QuickActionButtons onOpenLink={onOpenLink} inactiveBorderColor='#ccc' activeShadow='none' />);

    fireEvent.click(screen.getByText('conversation.welcome.quickActionStar').closest('div') as HTMLElement);
    expect(onOpenLink).toHaveBeenCalledWith('https://github.com/iOfficeAI/AionUi');
  });

  it('navigates to the WebUI settings page from the WebUI quick action', () => {
    render(<QuickActionButtons onOpenLink={vi.fn()} inactiveBorderColor='#ccc' activeShadow='none' />);

    fireEvent.click(screen.getByText(/settings\.webui/).closest('div') as HTMLElement);
    expect(navigateMock).toHaveBeenCalledWith('/settings/webui');
  });
});
