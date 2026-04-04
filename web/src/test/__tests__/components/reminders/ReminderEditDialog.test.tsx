import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ReminderEditDialog } from '@/components/reminders/ReminderEditDialog';
import { server } from '../../../mocks/server';
import type { Reminder } from '@/types';

// TiptapEditor uses next/navigation for WikiLink
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
  triggerAt: new Date(Date.now() + 86_400_000).toISOString(),
  recurrencePattern: null,
  recurrenceInterval: null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  title: null,
  description: null,
  descriptionText: null,
  neuronTitle: 'Test Neuron',
  ...overrides,
});

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSaved: vi.fn(),
};

describe('ReminderEditDialog', () => {
  it('renders dialog title when open', () => {
    render(<ReminderEditDialog reminder={makeReminder()} {...defaultProps} />);

    expect(screen.getByText('Edit Reminder')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder()}
        {...defaultProps}
        open={false}
      />
    );

    expect(screen.queryByText('Edit Reminder')).not.toBeInTheDocument();
  });

  it('pre-fills title input with existing reminder title', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder({ title: 'Existing title' })}
        {...defaultProps}
      />
    );

    const input = screen.getByPlaceholderText('Optional title…') as HTMLInputElement;
    expect(input.value).toBe('Existing title');
  });

  it('shows empty title input when title is null', () => {
    render(<ReminderEditDialog reminder={makeReminder({ title: null })} {...defaultProps} />);

    const input = screen.getByPlaceholderText('Optional title…') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('allows editing the title field', async () => {
    const user = userEvent.setup();
    render(<ReminderEditDialog reminder={makeReminder({ title: 'Old' })} {...defaultProps} />);

    const input = screen.getByPlaceholderText('Optional title…');
    await user.clear(input);
    await user.type(input, 'New title');

    expect(input).toHaveValue('New title');
  });

  it('shows one-time scheduling summary', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder({ reminderType: 'ONCE' })}
        {...defaultProps}
      />
    );

    expect(screen.getByText('One-time')).toBeInTheDocument();
  });

  it('shows recurring scheduling summary with recurrence info', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder({
          reminderType: 'RECURRING',
          recurrencePattern: 'WEEKLY',
          recurrenceInterval: 2,
        })}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getByText(/Repeats every 2 weeks/)).toBeInTheDocument();
  });

  it('shows neuron title as plain text when no brainId provided', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder({ neuronTitle: 'My Neuron' })}
        {...defaultProps}
      />
    );

    expect(screen.getByText('Linked to:')).toBeInTheDocument();
    expect(screen.getByText('My Neuron')).toBeInTheDocument();
  });

  it('shows neuron title as link when brainId and clusterId provided', () => {
    render(
      <ReminderEditDialog
        reminder={makeReminder({ neuronTitle: 'My Neuron' })}
        brainId="brain-1"
        clusterId="cluster-1"
        {...defaultProps}
      />
    );

    const link = screen.getByRole('link', { name: /My Neuron/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/brain/brain-1/cluster/cluster-1/neuron/neuron-1'
    );
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ReminderEditDialog
        reminder={makeReminder()}
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves reminder and calls onSaved on success', async () => {
    const reminder = makeReminder({ title: 'Initial' });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    server.use(
      http.put(
        `${API_BASE}/api/neurons/${reminder.neuronId}/reminders/${reminder.id}`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...reminder, title: body.title as string });
        }
      )
    );

    render(
      <ReminderEditDialog
        reminder={reminder}
        onSaved={onSaved}
        onOpenChange={onOpenChange}
        open={true}
      />
    );

    const input = screen.getByPlaceholderText('Optional title…');
    await user.clear(input);
    await user.type(input, 'Updated');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error message when save fails', async () => {
    const reminder = makeReminder();
    const user = userEvent.setup();

    server.use(
      http.put(
        `${API_BASE}/api/neurons/${reminder.neuronId}/reminders/${reminder.id}`,
        () => HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    render(<ReminderEditDialog reminder={reminder} {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Server error|Failed to save/)).toBeInTheDocument();
    });
  });

  it('disables Save button while request is in flight', async () => {
    const reminder = makeReminder();
    const user = userEvent.setup();

    let resolveRequest!: () => void;
    server.use(
      http.put(
        `${API_BASE}/api/neurons/${reminder.neuronId}/reminders/${reminder.id}`,
        () =>
          new Promise<Response>((resolve) => {
            resolveRequest = () =>
              resolve(HttpResponse.json(reminder) as unknown as Response);
          })
      )
    );

    render(<ReminderEditDialog reminder={reminder} {...defaultProps} />);

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveBtn);

    expect(saveBtn).toBeDisabled();

    resolveRequest();
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });
});
