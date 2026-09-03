import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA update + offline-ready prompt (Phase 10).
 *
 * The service worker is registered with `registerType: 'prompt'` (see
 * vite.config.ts) so a new build never silently swaps assets mid-transaction.
 * This component surfaces that prompt: when an update is waiting it shows a
 * small RTL toast-style banner with a "تحديث" action; it also confirms
 * offline-readiness once on first install.
 *
 * Mounted once at the app root. Renders nothing when there is no pending state.
 */
export function ReloadPrompt(): JSX.Element | null {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      // Log only; English per i18n rule.
      console.info(`[pwa] service worker registered: ${swUrl}`);
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[1000] mx-auto flex w-[min(92%,420px)] items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg"
    >
      <span className="flex-1 text-sm text-zinc-800">
        {needRefresh ? 'يتوفّر تحديث جديد للتطبيق.' : 'التطبيق جاهز للعمل دون اتصال.'}
      </span>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          تحديث
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
      >
        إغلاق
      </button>
    </div>
  );
}
