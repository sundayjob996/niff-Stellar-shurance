import {
  Injectable,
  Logger,
  BadGatewayException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getNetworkConfig } from "../config/network.config";
import { filterHorizonOperations } from "./filters/horizon-field.filter";
import { HorizonTransactionResponse } from "./dto/horizon-transaction.dto";
import { RedisService } from "../cache/redis.service";

const CACHE_TTL_SECONDS = 15;
const CACHE_PREFIX = "horizon:txcache:";
const RL_KEY_PREFIX = "horizon:rl:";
const RL_WINDOW_MS = 60_000;
const RL_MAX_REQUESTS = 30;

/**
 * Stellar address format: 56 uppercase alphanumeric characters starting with G.
 */
const STELLAR_ADDRESS_RE = /^G[A-Z0-9]{55}$/;

@Injectable()
export class HorizonService {
  private readonly logger = new Logger(HorizonService.name);
  private readonly horizonUrl: string;
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const networkConfig = getNetworkConfig();
    this.horizonUrl = networkConfig.horizonUrl;
    this.maxRequests = this.config.get<number>("HORIZON_RATE_LIMIT_MAX", RL_MAX_REQUESTS);
    this.windowMs = this.config.get<number>("HORIZON_RATE_LIMIT_WINDOW_MS", RL_WINDOW_MS);
  }

  async checkRateLimit(account: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const key = `${RL_KEY_PREFIX}${account}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const member = `${now}-${Math.random()}`;

    try {
      const client = this.redis.getClient();
      const pipeline = client.multi();
      pipeline.zremrangebyscore(key, "-inf", String(windowStart));
      pipeline.zcard(key);
      pipeline.zadd(key, now, member);
      pipeline.expire(key, Math.ceil(this.windowMs / 1000));
      const results = await pipeline.exec();
      const count = (results?.[1]?.[1] as number) ?? 0;

      if (count >= this.maxRequests) {
        const oldest = await client.zrange(key, 0, 0, "WITHSCORES");
        const oldestTs = oldest?.[1] ? Number(oldest[1]) : now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldestTs + this.windowMs - now) / 1000));
        return { allowed: false, retryAfterSeconds };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    } catch (err) {
      this.logger.warn(`Rate limit check failed for ${account}: ${err}`);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  async getTransactions(
    account: string,
    cursor?: string,
    limit = 20,
  ): Promise<HorizonTransactionResponse> {
    if (!STELLAR_ADDRESS_RE.test(account)) {
      throw new BadRequestException("Invalid Stellar account address");
    }

    const clampedLimit = Math.min(Math.max(1, limit), 200);
    const cacheKey = `${CACHE_PREFIX}${account}:${cursor ?? "start"}:${clampedLimit}`;

    const cached = await this.redis.get<HorizonTransactionResponse>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${account}`);
      return cached;
    }

    const url = this.buildHorizonUrl(account, cursor, clampedLimit);
    const raw = await this.fetchFromHorizon(url);
    const records = this.extractRecords(raw);
    const filtered = filterHorizonOperations(records);
    const nextCursor = this.extractNextCursor(raw);

    const response: HorizonTransactionResponse = {
      records: filtered,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    };

    await this.redis.set(cacheKey, response, CACHE_TTL_SECONDS);

    return response;
  }

  private buildHorizonUrl(account: string, cursor?: string, limit = 20): string {
    const base = `${this.horizonUrl}/accounts/${encodeURIComponent(account)}/operations`;
    const params = new URLSearchParams({
      limit: String(limit),
      order: "desc",
    });
    if (cursor) params.set("cursor", cursor);
    return `${base}?${params.toString()}`;
  }

  private async fetchFromHorizon(url: string): Promise<Record<string, unknown>> {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(this.getHorizonApiKey()
          ? { Authorization: `Bearer ${this.getHorizonApiKey()}` }
          : {}),
      };

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Horizon returned HTTP ${res.status}`);
      }

      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      this.logger.error(`Horizon fetch failed: ${err}`);
      throw new BadGatewayException("Horizon is unreachable");
    }
  }

  private getHorizonApiKey(): string | undefined {
    return this.config.get<string>("HORIZON_API_KEY") ?? undefined;
  }

  private extractRecords(raw: Record<string, unknown>): Record<string, unknown>[] {
    try {
      const embedded = raw["_embedded"] as Record<string, unknown> | undefined;
      const records = embedded?.["records"];
      if (!Array.isArray(records)) return [];
      return records as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  private extractNextCursor(raw: Record<string, unknown>): string | undefined {
    try {
      const links = raw["_links"] as Record<string, unknown> | undefined;
      const next = links?.["next"] as Record<string, unknown> | undefined;
      const href = next?.["href"] as string | undefined;
      if (!href) return undefined;
      const url = new URL(href);
      return url.searchParams.get("cursor") ?? undefined;
    } catch {
      return undefined;
    }
  }
}
