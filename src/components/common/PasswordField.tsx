import { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { generatePassword, MIN_PASSWORD_LENGTH } from '../../lib/password';
import { Field, Input } from '../ui';

/** Temporary password for a new account, with a secure generator. Share it with the user out-of-band. */
export const TemporaryPasswordField = ({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Field
        label="Temporary password"
        error={error}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. Share it securely; the user should change it after first sign-in.`}
      >
        <Input
          name="password"
          type={visible ? 'text' : 'password'}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {visible ? 'Hide password' : 'Show password'}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(generatePassword());
            setVisible(true);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <Wand2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
          Generate strong password
        </button>
      </div>
    </div>
  );
};
