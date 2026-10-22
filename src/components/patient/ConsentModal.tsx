import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { consentService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { REQUIRED_CONSENTS } from '../../lib/constants';
import { Alert, Button, Modal } from '../ui';

/** Mandatory before using the program: every consent must be acknowledged, so it can't be dismissed. */
export const ConsentModal = () => {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const allChecked = checked.size === REQUIRED_CONSENTS.length;

  const record = useMutation({
    mutationFn: () => consentService.recordConsents(REQUIRED_CONSENTS.map(({ type }) => ({ consentType: type, agreed: true }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.myConsents }),
  });

  const toggle = (type: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <Modal title="Informed consent & prehabilitation agreement" description="Before starting your plan, please review and acknowledge each item below." size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          record.mutate();
        }}
        className="space-y-4"
      >
        {record.isError && <Alert tone="error">{errorMessage(record.error, 'Could not record your consent. Please try again.')}</Alert>}

        <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <legend className="sr-only">Required consents</legend>
          {REQUIRED_CONSENTS.map(({ type, title, text }, i) => (
            <label key={type} className={`flex cursor-pointer items-start gap-3 ${i > 0 ? 'border-t border-slate-200 pt-3' : ''}`}>
              <input
                type="checkbox"
                checked={checked.has(type)}
                onChange={() => toggle(type)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 text-teal-700 focus:ring-teal-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-700">{text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => setChecked(allChecked ? new Set() : new Set(REQUIRED_CONSENTS.map((c) => c.type)))}
          className="text-sm font-semibold text-teal-800 hover:underline"
        >
          {allChecked ? 'Clear all' : 'Select all'}
        </button>

        <Button type="submit" size="lg" className="w-full" disabled={!allChecked} loading={record.isPending}>
          Acknowledge & sign consents
        </Button>
      </form>
    </Modal>
  );
};
