import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarReminders } from '@/components/layout/SidebarReminders';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
}));

describe('SidebarReminders', () => {
  it('renders a link to /reminders', () => {
    render(<SidebarReminders />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/reminders');
  });

  it('shows Reminders label', () => {
    render(<SidebarReminders />);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });

  it('shows no count badge', () => {
    render(<SidebarReminders />);
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });
});
