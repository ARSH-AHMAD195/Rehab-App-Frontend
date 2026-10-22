import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bell, Check } from 'lucide-react';
import { notificationService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useToast } from '../ui/toast';
import type { AppNotification } from '../../types/api';

export const NotificationDropdown = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Polls every 30s while the tab is visible (React Query pauses in background tabs)
  const { data } = useQuery({ queryKey: qk.notifications, queryFn: notificationService.getNotifications, refetchInterval: 30_000 });
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id?: string) => (id ? notificationService.markAsRead(id) : notificationService.markAllRead()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
    onError: () => toast.error('Could not update notifications. Please try again.'),
  });

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => !containerRef.current?.contains(e.target as Node) && setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2.5 text-slate-700 transition-colors hover:bg-slate-100 hover:text-teal-800"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white py-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-2">
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markRead.mutate(undefined)} className="text-sm font-medium text-teal-800 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-600">No notifications right now</li>
            ) : (
              notifications.map((n) => (
                <li key={n._id} className={cn('flex items-start gap-1', !n.isRead && 'bg-teal-50/50')}>
                  <button type="button" onClick={() => openNotification(n)} className="flex flex-1 items-start gap-3 p-3.5 text-left hover:bg-slate-50">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-teal-100 p-2 text-teal-800">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm text-slate-900', !n.isRead && 'font-semibold')}>
                          {n.title}
                          {!n.isRead && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="shrink-0 text-xs text-slate-600">{formatDate(n.createdAt, { month: 'short', day: 'numeric' })}</span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-700">{n.message}</span>
                    </span>
                  </button>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n._id)}
                      className="m-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-teal-800"
                      aria-label={`Mark "${n.title}" as read`}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
