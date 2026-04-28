import { useEffect } from 'react';

import { useToast } from '@/components/ui/Toast';
import { setHttpToastSink } from '@/lib/http';
import { useAuthStore } from '@/stores/authStore';

/**
 * HttpBridge — connects the (React-free) axios client to the Toast
 * provider and triggers the one-shot session bootstrap on app mount.
 *
 * Renders nothing.
 */
export function HttpBridge(): null {
  const toast = useToast();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    setHttpToastSink((variant, message) => {
      toast[variant](message);
    });
    return () => setHttpToastSink(null);
  }, [toast]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return null;
}
