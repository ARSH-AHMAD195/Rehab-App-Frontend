import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IDLE_MS, readLastActivity, writeLastActivity } from '../lib/idle';
import { t } from '../lib/i18n';
import { Button, Modal } from './ui';

const WARNING_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Signs out after a period of inactivity (shared devices are common in clinics and homes).
 * Activity is shared across tabs via localStorage, so working in one tab keeps the others alive.
 * A session left idle with no tab open is ended by AuthProvider when it's restored.
 */
export const IdleLogout = () => {
  const { logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastWrite > 5_000) {
        lastWrite = now;
        writeLastActivity(now);
      }
    };
    markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - Math.max(lastActivity.current, readLastActivity());
      if (idle >= IDLE_MS) {
        clearInterval(tick);
        void logout('idle');
      } else {
        setSecondsLeft(idle >= IDLE_MS - WARNING_MS ? Math.ceil((IDLE_MS - idle) / 1000) : null);
      }
    }, 1_000);

    return () => {
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [logout]);

  if (secondsLeft === null) return null;

  return (
    <Modal title="Are you still there?">
      <p className="text-sm text-slate-700" aria-live="polite">
        {t('For your privacy you’ll be signed out in {n} seconds due to inactivity.', { n: secondsLeft })}
      </p>
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => void logout()}>
          {t('Sign out now')}
        </Button>
        <Button className="flex-1" onClick={() => (lastActivity.current = Date.now())}>
          {t('Stay signed in')}
        </Button>
      </div>
    </Modal>
  );
};
