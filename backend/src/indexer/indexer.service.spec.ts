import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk') as Record<string, unknown>;
  return {
    ...actual,
    scValToNative: jest.fn(() => ({})),
  };
});

import { IndexerService } from './indexer.service';

describe('IndexerService', () => {
  const network = 'unittest';

  function makeConfig() {
    return {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'STELLAR_NETWORK') return network;
        if (key === 'INDEXER_GAP_ALERT_THRESHOLD_LEDGERS') return 50;
        if (key === 'INDEXER_GAP_ALERT_COOLDOWN_MS') return 60_000;
        return def;
      }),
    } as unknown as ConfigService;
  }

  it('resumes from ledger_cursors.last_processed_ledger after restart (empty RPC batch)', async () => {
    const txOps = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 900 }),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({
          network,
          lastProcessedLedger: 900,
          updatedAt: new Date(),
        }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: { findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof txOps) => Promise<void>) => fn(txOps)),
    };

    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(950),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());
    await service.processNextBatchForNetwork(network);

    expect(soroban.getEvents).toHaveBeenCalledWith(901, expect.any(Number));
    expect(txOps.ledgerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { network },
        update: expect.objectContaining({ lastProcessedLedger: 950 }),
      }),
    );
  });

  it('advances cursor inside the same transaction as raw_event upsert', async () => {
    const event = {
      txHash: 'abc',
      ledger: 42,
      ledgerClosedAt: new Date().toISOString(),
      topic: [],
      value: { _value: {} },
      contractId: { toString: () => 'C' },
    };

    const tx = {
      rawEvent: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 10 }),
        upsert: jest.fn(),
      },
      policy: { upsert: jest.fn() },
      claim: { upsert: jest.fn(), update: jest.fn() },
      vote: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    };

    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({
          network,
          lastProcessedLedger: 10,
          updatedAt: new Date(),
        }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: { findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    };

    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(55),
      getEvents: jest.fn().mockResolvedValue({ events: [event] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());
    await service.processNextBatchForNetwork(network);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.rawEvent.upsert).toHaveBeenCalled();
    expect(tx.ledgerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastProcessedLedger: 42 }),
      }),
    );
  });

  it('invalidates claim summary cache after vote ingestion', async () => {
    const tx = {
      vote: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      claim: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const claimEvents = { publish: jest.fn().mockResolvedValue(undefined) };
    const claimSummaryCache = { invalidateClaim: jest.fn().mockResolvedValue(undefined) };
    const votePubSub = { publishVote: jest.fn().mockResolvedValue(undefined) };
    const service = new IndexerService(
      {} as never,
      {} as never,
      makeConfig(),
      undefined,
      claimEvents as never,
      undefined,
      claimSummaryCache as never,
      votePubSub as never,
    );

    await (service as unknown as {
      handleVoteCast: (
        tx: typeof tx,
        topics: unknown[],
        data: Record<string, unknown>,
        event: { ledger: number; txHash: string },
      ) => Promise<void>;
    }).handleVoteCast(
      tx,
      ['vote', 42, 'GVOTER'],
      { vote: 'Approve', approve_votes: 2, reject_votes: 1 },
      { ledger: 123, txHash: 'vote-tx' },
    );

    expect(tx.vote.upsert).toHaveBeenCalled();
    expect(tx.claim.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } }),
    );
    expect(claimSummaryCache.invalidateClaim).toHaveBeenCalledWith(42);
    expect(votePubSub.publishVote).toHaveBeenCalledWith({
      claimId: 42,
      voter: 'GVOTER',
      vote: 'yes',
      yesVotes: 2,
      noVotes: 1,
      totalVotes: 3,
    });
  });

  // ── Gap alert deduplication tests ────────────────────────────────────────

  it('first gap alert fires and upserts dedup row', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const txOps = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 0 }),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ network, lastProcessedLedger: 0, updatedAt: new Date() }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: {
        findUnique: jest.fn().mockResolvedValue(null), // no prior alert
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof txOps) => Promise<void>) => fn(txOps)),
    };
    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(200),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());
    await service.processNextBatchForNetwork(network);

    const gapLogs = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('indexer_ledger_gap'),
    );
    expect(gapLogs.length).toBe(1);
    expect(prisma.ledgerGapAlertDedup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { network } }),
    );

    warnSpy.mockRestore();
  });

  it('suppressed duplicate alert is logged with reason', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const txOps = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 0 }),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ network, lastProcessedLedger: 0, updatedAt: new Date() }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: {
        // Return a recent lastFiredAt so cooldown is still active
        findUnique: jest.fn().mockResolvedValue({ network, lastFiredAt: new Date() }),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof txOps) => Promise<void>) => fn(txOps)),
    };
    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(200),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());
    await service.processNextBatchForNetwork(network);

    const suppressedLogs = logSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('indexer_ledger_gap_suppressed'),
    );
    expect(suppressedLogs.length).toBe(1);
    expect(suppressedLogs[0][0]).toContain('cooldown_active');
    // Dedup row must NOT be updated when suppressed
    expect(prisma.ledgerGapAlertDedup.upsert).not.toHaveBeenCalled();

    logSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('alert fires again after cooldown expires', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const txOps = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 0 }),
        upsert: jest.fn(),
      },
    };
    // lastFiredAt is 2 hours ago — well past the 60 s cooldown
    const expiredFiredAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ network, lastProcessedLedger: 0, updatedAt: new Date() }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: {
        findUnique: jest.fn().mockResolvedValue({ network, lastFiredAt: expiredFiredAt }),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof txOps) => Promise<void>) => fn(txOps)),
    };
    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(200),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());
    await service.processNextBatchForNetwork(network);

    const gapLogs = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('indexer_ledger_gap'),
    );
    expect(gapLogs.length).toBe(1);
    expect(prisma.ledgerGapAlertDedup.upsert).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('deduplicates gap alerts within cooldown (staging outage simulation)', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const txOps = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedLedger: 0 }),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      ledgerCursor: {
        findUnique: jest.fn().mockResolvedValue({
          network,
          lastProcessedLedger: 0,
          updatedAt: new Date(),
        }),
        create: jest.fn(),
      },
      indexerState: { findFirst: jest.fn() },
      ledgerGapAlertDedup: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ network, lastFiredAt: new Date() }),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof txOps) => Promise<void>) => fn(txOps)),
    };

    const soroban = {
      getLatestLedger: jest.fn().mockResolvedValue(200),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    const service = new IndexerService(prisma as never, soroban as never, makeConfig());

    await service.processNextBatchForNetwork(network);
    await service.processNextBatchForNetwork(network);

    const gapLogs = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('indexer_ledger_gap'),
    );
    expect(gapLogs.length).toBe(1);

    warnSpy.mockRestore();
  });
});

