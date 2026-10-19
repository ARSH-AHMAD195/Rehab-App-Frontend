import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { reportError } from '../lib/monitoring';
import { buttonClass } from './ui';

// A failed lazy chunk usually means a new version was deployed while this tab was open.
const isStaleChunk = (error: unknown) =>
  error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);

/** Router-level error screen: render crashes and failed page-chunk loads in any route. */
export const RouteError = () => {
  const error = useRouteError();
  const staleChunk = isStaleChunk(error);

  useEffect(() => {
    if (!staleChunk && !isRouteErrorResponse(error)) reportError(error);
  }, [error, staleChunk]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div role="alert" className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">{staleChunk ? 'A new version is available' : 'Something went wrong'}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {staleChunk
            ? 'Fit for Surgery was updated while this page was open. Reload to continue.'
            : 'An unexpected error occurred while displaying this page. Your saved data is not affected.'}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className={buttonClass('primary')}>
            Reload page
          </button>
          {!staleChunk && (
            <Link to="/" reloadDocument className={buttonClass('secondary')}>
              Go to home
            </Link>
          )}
        </div>
      </div>
    </main>
  );
};
