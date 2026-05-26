'use client';

/**
 * QuorumProgressBar — displays approve/reject vote breakdown with a quorum threshold marker.
 *
 * Props:
 *   approvePct         — percentage of votes that are approvals (0–100)
 *   rejectPct          — percentage of votes that are rejections (0–100)
 *   quorumThresholdPct — participation threshold required for quorum (0–100)
 */

export interface QuorumProgressBarProps {
  approvePct: number;
  rejectPct: number;
  quorumThresholdPct: number;
}

export function QuorumProgressBar({ approvePct, rejectPct, quorumThresholdPct }: QuorumProgressBarProps) {
  const totalPct = approvePct + rejectPct;
  const quorumMet = totalPct >= quorumThresholdPct;

  // Clamp segments to [0, 100]
  const approveWidth = Math.min(approvePct, 100);
  const rejectWidth = Math.min(rejectPct, 100 - approveWidth);
  const markerLeft = Math.min(quorumThresholdPct, 100);

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={totalPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Voting progress: ${approvePct}% approve, ${rejectPct}% reject, ${quorumThresholdPct}% quorum threshold`}
        className="relative h-3 w-full overflow-visible rounded-full bg-gray-200"
      >
        {/* Approve segment (green) */}
        <div
          className="absolute left-0 top-0 h-full rounded-l-full bg-green-500 transition-all duration-500"
          style={{ width: `${approveWidth}%` }}
          data-testid="approve-segment"
        />
        {/* Reject segment (red) */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-500"
          style={{ left: `${approveWidth}%`, width: `${rejectWidth}%` }}
          data-testid="reject-segment"
        />
        {/* Quorum threshold marker */}
        <div
          className="absolute top-[-4px] h-[calc(100%+8px)] w-0.5 bg-gray-700"
          style={{ left: `${markerLeft}%` }}
          aria-hidden="true"
          data-testid="quorum-marker"
          title={`Quorum threshold: ${quorumThresholdPct}%`}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          Approve {approvePct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
          Reject {rejectPct}%
        </span>
        <span className="flex items-center gap-1">
          {quorumMet ? (
            <span className="font-medium text-green-700" aria-label="Quorum met">
              ✓ Quorum met
            </span>
          ) : (
            <span className="text-gray-500">
              Quorum: {quorumThresholdPct}%
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
