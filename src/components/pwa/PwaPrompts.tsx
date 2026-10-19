import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../lib/hooks';
import { useInstallPrompt } from '../../lib/install';
import { reportError } from '../../lib/monitoring';
import { Button } from '../ui';
import { useToast } from '../ui/toast';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Service worker lifecycle: "ready offline" notice and an update prompt (never auto-reloads mid-form). */
export const PwaPrompts = () => {
  const toast = useToast();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Long-lived installed apps rarely navigate, so poll for new versions
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
    onRegisterError: (error) => reportError(error, { context: 'service worker registration' }),
  });

  useEffect(() => {
    if (!offlineReady) return;
    // "offlineReady" = app files cached by the service worker, not "installed to the home screen"
    toast.info('Fit for Surgery can now open even without an internet connection.');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, toast]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[65] lg:bottom-4 mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-teal-200 bg-white p-4 shadow-xl sm:flex-row sm:items-center print:hidden"
    >
      <p className="flex-1 text-sm text-slate-800">A new version of Fit for Surgery is available.</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Update now
        </Button>
      </div>
    </div>
  );
};

export const OfflineBanner = () => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-center text-sm font-medium text-white print:hidden">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You’re offline. You can keep reading this page, but changes can’t be saved until you reconnect.
    </p>
  );
};

export const InstallButton = ({ className }: { className?: string }) => {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <Button variant="secondary" size="sm" className={className} onClick={() => void install()}>
      <Download className="h-4 w-4" aria-hidden="true" />
      Install app
    </Button>
  );
};
