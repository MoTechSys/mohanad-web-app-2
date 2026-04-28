import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Sparkles, Store, User } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/i18n/ar';
import { cn } from '@/lib/cn';

/**
 * LoginPage — Foundation login screen.
 *
 *   • Full-bleed Emerald gradient backdrop with floating glass orbs
 *     (Framer Motion driven, GPU-friendly).
 *   • Subtle SVG grain overlay for texture (no extra image asset).
 *   • Centred glass card containing a polished login form.
 *   • Submission is intentionally a no-op in Foundation — we surface
 *     a toast directing the user to Phase 2.
 */
export function LoginPage(): JSX.Element {
  const toast = useToast();
  const history = useHistory();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.info(t('login.notImplemented'));
      history.push('/dashboard');
    }, 600);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-emerald">
      {/* Floating glass orbs */}
      <motion.div
        aria-hidden
        className="absolute -top-40 -end-32 h-96 w-96 rounded-full bg-primary-300/40 blur-3xl"
        animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 11, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 -start-24 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl"
        animate={{ y: [0, -22, 0], x: [0, 14, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 13, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/3 start-1/4 h-48 w-48 rounded-full bg-white/40 blur-3xl"
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 7, ease: 'easeInOut' }}
      />

      {/* Grain texture */}
      <div className="absolute inset-0 bg-grain opacity-60 mix-blend-multiply pointer-events-none" />

      <div className="relative z-10 min-h-screen grid place-items-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card glass className="border-white/60 shadow-glow">
            {/* Logo */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow">
                <Store className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold text-ink">{t('app.name')}</h1>
              <p className="text-sm text-gray-600">{t('login.subtitle')}</p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Input
                label={t('login.username')}
                placeholder={t('login.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
                autoComplete="username"
                required
              />
              <Input
                label={t('login.password')}
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {t('login.rememberMe')}
                </label>
                <button
                  type="button"
                  className="text-primary-700 hover:text-primary-800"
                  onClick={() => toast.info('سيتم تفعيل استعادة كلمة المرور لاحقاً')}
                >
                  {t('login.forgotPassword')}
                </button>
              </div>

              <Button type="submit" fullWidth size="lg" isLoading={submitting}>
                {submitting ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>

            {/* Foot note */}
            <p
              className={cn('mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-500')}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary-600" />
              <span>اتصال آمن — Helmet + CORS مُفعَّل</span>
            </p>
          </Card>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-primary-900/70">
            <Sparkles className="h-3.5 w-3.5" />
            مرحلة الـ Foundation — تسجيل الدخول الفعلي يأتي في المرحلة 2
          </p>
        </motion.div>
      </div>
    </div>
  );
}
