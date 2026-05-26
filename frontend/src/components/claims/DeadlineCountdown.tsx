'use client';

/**
 * DeadlineCountdown — converts a deadline ledger to a human-readable time remaining.
 *
 * Uses ~5s/ledger as the Stellar network average. The estimate is approximate;
 * the tooltip makes this explicit.
 */

import { useEffect, useState } from 'react';

const AVG_CLOSE_SECONDS = 5;

export interface DeadlineCountdownProps {
  deadlineLedger: number;
  currentLedger: number;
}

function formatRemaining(remainingLedgers: number): string {
  const totalSeconds = remainingLedgers * AVG_CLOSE_SECONDS;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function DeadlineCountdown({ deadlineLedger, currentLedger }: DeadlineCountdownProps) {
  const [ledger, setLedger] = useState(currentLedger);

  useEffect(() => {
    setLedger(currentLedger);
  }, [currentLedger]);

  useEffect(() => {
    // Advance estimated ledger every 60 seconds (one tick per minute)
    const id = setInterval(() => {
      setLedger((prev) => prev + Math.round(60 / AVG_CLOSE_SECONDS));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  if (ledger >= deadlineLedger) {
    return (
      <span className="text-sm font-medium text-muted-foreground" data-testid="deadline-expired">
        Expired
      </span>
    );
  }

  const remaining = deadlineLedger - ledger;
  const label = formatRemaining(remaining);

  return (
    <span
      className="text-sm font-medium tabular-nums"
      title={`Ledger-based estimate (~${AVG_CLOSE_SECONDS}s/ledger). Deadline: ledger ${deadlineLedger}, current: ~${ledger}`}
      data-testid="deadline-countdown"
    >
      {label}
    </span>
  );
}
