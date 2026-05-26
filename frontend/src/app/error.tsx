'use client';

import { RouteError } from '@/components/route-error';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} area="Application" segment="global" />;
}
