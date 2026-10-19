import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from './ui';

/** Warns before leaving a page with unsaved form input, both in-app and on tab close/reload. */
export const UnsavedChangesGuard = ({ when }: { when: boolean }) => {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  if (blocker.state !== 'blocked') return null;
  return (
    <ConfirmDialog
      title="Leave without saving?"
      message="You have unsaved changes on this page. If you leave now they will be lost."
      confirmLabel="Discard and leave"
      cancelLabel="Keep editing"
      onConfirm={() => blocker.proceed()}
      onCancel={() => blocker.reset()}
    />
  );
};
