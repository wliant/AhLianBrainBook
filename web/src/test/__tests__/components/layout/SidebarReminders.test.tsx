import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SidebarReminders } from '@/components/layout/SidebarReminders';
import { server } from '../../../mocks/server';
import type { Reminder } from '@/types';

// Mock next/navigation (needed by TiptapEditor inside ReminderEditDialog)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
}));

const API_BASE = 'http://localhost:8080';

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: 'reminder-1',
  neuronId: 'neuron-1',
  reminderType: 'ONCE',
  triggerAt: new Date(Date.now() + 3_600_000).toISOString(),
  recurrencePattern: null,
  recurrenceInterval: null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  title: 'Review notes',
  description: null,
  descriptionText: null,
  neuronTitle: 'Test Neuron',
  ...overrides,
});

describe('SidebarReminders', () => {
  it('renders nothing when there are no reminders', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () => HttpResponse.json([]))
    );

    const { container } = render(<SidebarReminders />);

    // Wait for fetch to complete — still nothing rendered
    await new Promise((r) => setTimeout(r, 100));
    expect(container.firstChild).toBeNull();
  });

  it('renders reminder count badge when reminders exist', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder(), makeReminder({ id: 'reminder-2', title: 'Second' })])
      )
    );

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows reminder title in expanded list', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder({ title: 'Check deployment' })])
      )
    );

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('Check deployment')).toBeInTheDocument();
    });
  });

  it('falls back to neuronTitle when title is absent', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder({ title: null, neuronTitle: 'My Neuron' })])
      )
    );

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('My Neuron')).toBeInTheDocument();
    });
  });

  it('collapses reminder list when header button is clicked', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder({ title: 'Collapsible item' })])
      )
    );
    const user = userEvent.setup();

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('Collapsible item')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Reminders/i }));

    expect(screen.queryByText('Collapsible item')).not.toBeInTheDocument();
  });

  it('opens edit dialog when a reminder row is clicked', async () => {
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder({ title: 'Click me' })])
      )
    );
    const user = userEvent.setup();

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Click me'));

    await waitFor(() => {
      expect(screen.getByText('Edit Reminder')).toBeInTheDocument();
    });
  });

  it('marks overdue reminders with red bell icon', async () => {
    const pastTrigger = new Date(Date.now() - 3_600_000).toISOString();
    server.use(
      http.get(`${API_BASE}/api/reminders`, () =>
        HttpResponse.json([makeReminder({ triggerAt: pastTrigger })])
      )
    );

    const { container } = render(<SidebarReminders />);

    await waitFor(() => {
      expect(container.querySelector('.text-red-500')).toBeInTheDocument();
    });
  });

  it('updates reminder in list after save from dialog', async () => {
    const original = makeReminder({ title: 'Old title' });
    server.use(
      http.get(`${API_BASE}/api/reminders`, () => HttpResponse.json([original])),
      http.put(
        `${API_BASE}/api/neurons/${original.neuronId}/reminders/${original.id}`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...original, title: body.title as string });
        }
      )
    );
    const user = userEvent.setup();

    render(<SidebarReminders />);

    await waitFor(() => {
      expect(screen.getByText('Old title')).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByText('Old title'));
    await waitFor(() => expect(screen.getByText('Edit Reminder')).toBeInTheDocument());

    // Clear and type new title
    const input = screen.getByPlaceholderText('Optional title…');
    await user.clear(input);
    await user.type(input, 'New title');

    // Save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('New title')).toBeInTheDocument();
    });
  });
});
