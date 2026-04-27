import { useQuery } from '@tanstack/react-query';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
} from '@ionic/react';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  refreshOutline,
  serverOutline,
} from 'ionicons/icons';

import { http } from '../lib/http';
import { tokens } from '../design/tokens';
import { formatMoney } from '@grocery/shared';

type HealthResponse = {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  database: 'ok' | 'down' | 'unknown';
};

async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>('/health');
  return data;
}

export function FoundationPage() {
  const {
    data: health,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>نظام إدارة بقالة — Foundation</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="mx-auto max-w-3xl space-y-6 py-4">
          {/* Hero */}
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
              <IonIcon
                icon={serverOutline}
                style={{ fontSize: 32, color: tokens.colors.primary[600] }}
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">المرحلة الأولى — Foundation</h1>
            <p className="mt-2 text-sm text-gray-600">
              تم تجهيز البنية التحتية بنجاح. هذه الصفحة للتحقق فقط من ربط الواجهة بالـ API.
            </p>
          </div>

          {/* Health card */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">حالة الـ API</h2>
              <IonButton
                size="small"
                fill="clear"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <IonIcon slot="start" icon={refreshOutline} />
                تحديث
              </IonButton>
            </div>

            {isLoading && (
              <p className="text-sm text-gray-500">جاري الفحص…</p>
            )}

            {isError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <IonIcon icon={closeCircleOutline} />
                <span>تعذّر الاتصال بالـ API: {(error as Error).message}</span>
              </div>
            )}

            {health && (
              <ul className="space-y-2 text-sm">
                <Row
                  label="الحالة العامة"
                  value={health.status}
                  ok={health.status === 'ok'}
                />
                <Row
                  label="قاعدة البيانات"
                  value={health.database}
                  ok={health.database === 'ok'}
                />
                <Row label="الإصدار" value={health.version} />
                <Row label="مدة التشغيل" value={`${health.uptimeSeconds} ثانية`} />
                <Row
                  label="آخر فحص"
                  value={new Date(health.timestamp).toLocaleString('en-GB')}
                />
              </ul>
            )}
          </div>

          {/* Tech stack pills */}
          <div className="card p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">المكدس التقني المعتمد</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'React 18 + TS',
                'Vite 5',
                'Ionic React 8',
                'Tailwind 3',
                'TanStack Query',
                'Zustand',
                'NestJS 10',
                'Prisma 5',
                'PostgreSQL',
                'Zod',
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Sample formatter sanity check */}
          <div className="card p-5">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">اختبار formatter</h2>
            <p className="text-sm text-gray-600">
              يعرض السطر التالي تنسيق العملة من <code className="font-mono">@grocery/shared</code>:
            </p>
            <p className="mt-2 text-2xl font-bold text-primary-700 num">
              {formatMoney(1234567.89, 'YER')}
            </p>
          </div>

          <p className="text-center text-xs text-gray-400">
            المرحلة 1 من 10 — Foundation • سيتم تفعيل تسجيل الدخول في المرحلة 2
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string | number;
  ok?: boolean;
}) {
  return (
    <li className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-2 font-medium text-gray-900">
        {ok !== undefined && (
          <IonIcon
            icon={ok ? checkmarkCircleOutline : closeCircleOutline}
            style={{
              color: ok ? tokens.colors.success : tokens.colors.danger,
              fontSize: 18,
            }}
          />
        )}
        <span>{value}</span>
      </span>
    </li>
  );
}
