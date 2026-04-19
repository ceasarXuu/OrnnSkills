import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'smol-toml';

export interface LLMSafetyOptions {
  enabled: boolean;
  windowMs: number;
  maxRequestsPerWindow: number;
  maxConcurrentRequests: number;
  maxEstimatedTokensPerWindow: number;
}

export interface LLMRequestGuardInput {
  provider: string;
  modelName: string;
  estimatedTokens: number;
}

export interface LLMRequestGuardTicket {
  id: string;
  estimatedTokens: number;
  startedAt: number;
  bypassed: boolean;
}

type LLMSafetyReason = 'request_rate' | 'concurrency' | 'token_budget';

interface CompletedRequestRecord {
  timestamp: number;
  totalTokens: number;
}

interface InFlightReservation extends LLMRequestGuardInput {
  id: string;
  startedAt: number;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  return fallback;
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readSafetyConfigFromToml(): Partial<LLMSafetyOptions> {
  const configPath = join(homedir(), '.ornn', 'config', 'settings.toml');
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = parse(readFileSync(configPath, 'utf-8')) as {
      llm_safety?: {
        enabled?: boolean;
        window_ms?: number;
        max_requests_per_window?: number;
        max_concurrent_requests?: number;
        max_estimated_tokens_per_window?: number;
      };
    };
    const safety = parsed.llm_safety;
    if (!safety) {
      return {};
    }
    return {
      enabled: safety.enabled,
      windowMs: safety.window_ms,
      maxRequestsPerWindow: safety.max_requests_per_window,
      maxConcurrentRequests: safety.max_concurrent_requests,
      maxEstimatedTokensPerWindow: safety.max_estimated_tokens_per_window,
    };
  } catch {
    return {};
  }
}

const FILE_LLM_SAFETY_OPTIONS = readSafetyConfigFromToml();

const DEFAULT_LLM_SAFETY_OPTIONS: LLMSafetyOptions = {
  enabled: readBooleanEnv('ORNN_LLM_SAFETY_ENABLED', FILE_LLM_SAFETY_OPTIONS.enabled ?? true),
  windowMs: readNumberEnv('ORNN_LLM_SAFETY_WINDOW_MS', FILE_LLM_SAFETY_OPTIONS.windowMs ?? 60_000),
  maxRequestsPerWindow: readNumberEnv(
    'ORNN_LLM_MAX_REQUESTS_PER_WINDOW',
    FILE_LLM_SAFETY_OPTIONS.maxRequestsPerWindow ?? 12
  ),
  maxConcurrentRequests: readNumberEnv(
    'ORNN_LLM_MAX_CONCURRENT_REQUESTS',
    FILE_LLM_SAFETY_OPTIONS.maxConcurrentRequests ?? 2
  ),
  maxEstimatedTokensPerWindow: readNumberEnv(
    'ORNN_LLM_MAX_ESTIMATED_TOKENS_PER_WINDOW',
    FILE_LLM_SAFETY_OPTIONS.maxEstimatedTokensPerWindow ?? 48_000
  ),
};

export class LLMRateLimitError extends Error {
  readonly reason: LLMSafetyReason;
  readonly details: Record<string, number | string>;

  constructor(reason: LLMSafetyReason, message: string, details: Record<string, number | string>) {
    super(message);
    this.name = 'LLMRateLimitError';
    this.reason = reason;
    this.details = details;
  }
}

export function resolveLLMSafetyOptions(overrides?: Partial<LLMSafetyOptions>): LLMSafetyOptions {
  return {
    enabled: overrides?.enabled ?? DEFAULT_LLM_SAFETY_OPTIONS.enabled,
    windowMs: Math.max(1, Math.floor(overrides?.windowMs ?? DEFAULT_LLM_SAFETY_OPTIONS.windowMs)),
    maxRequestsPerWindow: Math.max(
      1,
      Math.floor(overrides?.maxRequestsPerWindow ?? DEFAULT_LLM_SAFETY_OPTIONS.maxRequestsPerWindow)
    ),
    maxConcurrentRequests: Math.max(
      1,
      Math.floor(overrides?.maxConcurrentRequests ?? DEFAULT_LLM_SAFETY_OPTIONS.maxConcurrentRequests)
    ),
    maxEstimatedTokensPerWindow: Math.max(
      1,
      Math.floor(
        overrides?.maxEstimatedTokensPerWindow ?? DEFAULT_LLM_SAFETY_OPTIONS.maxEstimatedTokensPerWindow
      )
    ),
  };
}

export class LLMRequestGuard {
  private readonly options: LLMSafetyOptions;
  private readonly completed: CompletedRequestRecord[] = [];
  private readonly inFlight = new Map<string, InFlightReservation>();

  constructor(options?: Partial<LLMSafetyOptions>) {
    this.options = resolveLLMSafetyOptions(options);
  }

  acquire(input: LLMRequestGuardInput): LLMRequestGuardTicket {
    if (!this.options.enabled) {
      return {
        id: 'bypassed',
        estimatedTokens: input.estimatedTokens,
        startedAt: Date.now(),
        bypassed: true,
      };
    }

    const now = Date.now();
    this.prune(now);

    if (this.inFlight.size >= this.options.maxConcurrentRequests) {
      throw new LLMRateLimitError(
        'concurrency',
        `LLM safety limit blocked request: concurrent ceiling reached for ${input.provider}/${input.modelName}`,
        {
          provider: input.provider,
          model: input.modelName,
          inFlight: this.inFlight.size,
          maxConcurrentRequests: this.options.maxConcurrentRequests,
        }
      );
    }

    if (this.completed.length >= this.options.maxRequestsPerWindow) {
      throw new LLMRateLimitError(
        'request_rate',
        `LLM safety limit blocked request: request ceiling reached for ${input.provider}/${input.modelName}`,
        {
          provider: input.provider,
          model: input.modelName,
          requestsInWindow: this.completed.length,
          maxRequestsPerWindow: this.options.maxRequestsPerWindow,
          windowMs: this.options.windowMs,
        }
      );
    }

    const usedTokens = this.getUsedTokens();
    if (usedTokens + input.estimatedTokens > this.options.maxEstimatedTokensPerWindow) {
      throw new LLMRateLimitError(
        'token_budget',
        `LLM safety limit blocked request: rolling token budget exceeded for ${input.provider}/${input.modelName}`,
        {
          provider: input.provider,
          model: input.modelName,
          usedTokens,
          estimatedTokens: input.estimatedTokens,
          maxEstimatedTokensPerWindow: this.options.maxEstimatedTokensPerWindow,
          windowMs: this.options.windowMs,
        }
      );
    }

    const reservation: InFlightReservation = {
      id: randomUUID(),
      estimatedTokens: Math.max(1, Math.floor(input.estimatedTokens)),
      provider: input.provider,
      modelName: input.modelName,
      startedAt: now,
    };
    this.inFlight.set(reservation.id, reservation);

    return {
      id: reservation.id,
      estimatedTokens: reservation.estimatedTokens,
      startedAt: reservation.startedAt,
      bypassed: false,
    };
  }

  succeed(ticket: LLMRequestGuardTicket, actualTotalTokens?: number | null): void {
    const reservation = this.releaseReservation(ticket);
    if (!reservation) return;
    this.completed.push({
      timestamp: Date.now(),
      totalTokens:
        typeof actualTotalTokens === 'number' && Number.isFinite(actualTotalTokens) && actualTotalTokens > 0
          ? Math.floor(actualTotalTokens)
          : reservation.estimatedTokens,
    });
    this.prune(Date.now());
  }

  fail(ticket: LLMRequestGuardTicket): void {
    if (ticket.bypassed) return;
    const reservation = this.releaseReservation(ticket);
    if (!reservation) return;
    this.completed.push({
      timestamp: Date.now(),
      totalTokens: 0,
    });
    this.prune(Date.now());
  }

  snapshot(): {
    inFlight: number;
    completedRequests: number;
    usedTokens: number;
    options: LLMSafetyOptions;
  } {
    this.prune(Date.now());
    return {
      inFlight: this.inFlight.size,
      completedRequests: this.completed.length,
      usedTokens: this.getUsedTokens(),
      options: { ...this.options },
    };
  }

  private releaseReservation(ticket: LLMRequestGuardTicket): InFlightReservation | null {
    if (ticket.bypassed) return null;
    const reservation = this.inFlight.get(ticket.id) || null;
    if (reservation) {
      this.inFlight.delete(ticket.id);
    }
    return reservation;
  }

  private getUsedTokens(): number {
    let total = 0;
    for (const item of this.completed) {
      total += item.totalTokens;
    }
    for (const item of this.inFlight.values()) {
      total += item.estimatedTokens;
    }
    return total;
  }

  private prune(now: number): void {
    const cutoff = now - this.options.windowMs;
    while (this.completed.length > 0 && this.completed[0] && this.completed[0].timestamp < cutoff) {
      this.completed.shift();
    }
  }
}

let sharedGuard: LLMRequestGuard | null = null;

export function getSharedLLMRequestGuard(): LLMRequestGuard {
  if (!sharedGuard) {
    sharedGuard = new LLMRequestGuard();
  }
  return sharedGuard;
}

export function resetSharedLLMRequestGuard(): void {
  sharedGuard = null;
}
