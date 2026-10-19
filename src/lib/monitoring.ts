// Error reporting. Opt-in: set VITE_SENTRY_DSN at build time. Without it the Sentry SDK is
// not even bundled (the import below is statically dropped) and errors go to the console.
//
// This app handles health data, so reports are scrubbed: no request/response bodies, no
// user identity beyond the opaque id, and URLs have record ids stripped.
type Sentry = typeof import('@sentry/react');

const loadSentry = import.meta.env.VITE_SENTRY_DSN ? () => import('@sentry/react') : null;
let sentry: Sentry | null = null;

const scrubUrl = (url = '') => url.replace(/\/[0-9a-f]{24}\b/gi, '/:id').replace(/\?.*$/, '');

export const initMonitoring = async () => {
  if (!loadSentry) return;
  sentry = await loadSentry();
  sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    release: import.meta.env.VITE_APP_VERSION,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        event.request.url = scrubUrl(event.request.url);
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      // Console output and form inputs can contain patient data
      if (crumb.category === 'console' || crumb.category === 'ui.input') return null;
      if (crumb.data?.url) crumb.data.url = scrubUrl(String(crumb.data.url));
      return crumb;
    },
  });
};

export const reportError = (error: unknown, context?: Record<string, unknown>) => {
  if (sentry) sentry.captureException(error, { extra: context });
  else console.error(error, context ?? '');
};

export const setMonitoringUser = (user: { _id: string; role: string } | null) => {
  sentry?.setUser(user ? { id: user._id, segment: user.role } : null);
};
