import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Modal } from './ui';

const IDLE_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 15) * 60_000;
const WARNING_MS = 60_000;
const STORAGE_KEY = 'ffs_last_activity';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;

const readShared = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * Signs out after a period of inactivity (shared devices are common in clinics and homes).
 * Activity is shared across tabs via localStorage, so working in one tab keeps the others alive.
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
        try {
          localStorage.setItem(STORAGE_KEY, String(now));
        } catch {
          // Private mode: per-tab tracking still works
        }
      }
    };
    markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - Math.max(lastActivity.current, readShared());
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
        For your privacy you’ll be signed out in <strong>{secondsLeft} seconds</strong> due to inactivity.
      </p>
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => void logout()}>
          Sign out now
        </Button>
        <Button className="flex-1" onClick={() => (lastActivity.current = Date.now())}>
          Stay signed in
        </Button>
      </div>
    </Modal>
  );
};
