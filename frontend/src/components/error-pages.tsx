'use client';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

interface ErrorPageProps {
  illustration: string;
  title: string;
  description: string;
}

function ErrorPageLayout({ illustration, title, description }: ErrorPageProps) {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
      <p className="text-6xl" aria-hidden="true">{illustration}</p>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground max-w-md">{description}</p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPageLayout
      illustration="🔍"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPageLayout
      illustration="🚫"
      title="Access denied"
      description="You don't have permission to view this page."
    />
  );
}

export function ErrorPage() {
  return (
    <ErrorPageLayout
      illustration="⚠️"
      title="Something went wrong"
      description="An unexpected error occurred. Please try again later."
    />
  );
}
