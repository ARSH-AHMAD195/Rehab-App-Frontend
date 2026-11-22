import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { completionService } from '../../services/apiServices';
import { ToastProvider } from '../ui/toast';
import { SkipExerciseModal } from './SkipExerciseModal';
import type { ChecklistItem } from '../../types/api';

vi.mock('../../lib/firebase', () => ({ firebaseAuth: { currentUser: null } }));

const item = { itemId: 'i1', exercise: { name: 'Walking' } } as unknown as ChecklistItem;

describe('SkipExerciseModal', () => {
  it('starts with no reason chosen and refuses to skip until one is', async () => {
    const complete = vi.spyOn(completionService, 'complete').mockResolvedValue({} as never);
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SkipExerciseModal item={item} date="2026-11-22" onClose={() => {}} />
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /Skip for today/ }));
    expect(await screen.findByText('Please choose a reason.')).toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('No time'));
    await userEvent.click(screen.getByRole('button', { name: /Skip for today/ }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(expect.objectContaining({ status: 'SKIPPED', reason: 'No time' }), expect.any(String)));
  });
});
