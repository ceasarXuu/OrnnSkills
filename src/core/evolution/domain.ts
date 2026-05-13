import type { RuntimeType } from '../../types/index.js';

export type EvolutionRunStatus =
  | 'collecting'
  | 'analyzing'
  | 'proposed'
  | 'skipped'
  | 'applying'
  | 'applied'
  | 'deploying'
  | 'deployed'
  | 'verifying'
  | 'verified'
  | 'regressed'
  | 'failed'
  | 'rolled_back';

export type EvolutionRiskLevel = 'low' | 'medium' | 'high';

export type EvolutionProposalStatus =
  | 'draft'
  | 'ready'
  | 'needs_review'
  | 'applied'
  | 'rejected'
  | 'expired';

export interface EvolutionEvidenceRef {
  kind: 'trace' | 'session' | 'episode' | 'decision_event' | 'version' | 'note';
  id: string;
  summary?: string | null;
}

export interface EvolutionEpisode {
  episodeId: string;
  projectPath: string;
  runtime: RuntimeType;
  skillIds: string[];
  traceIds: string[];
  sessionIds: string[];
  startedAt: string;
  lastActivityAt: string;
  status: 'collecting' | 'ready_for_analysis' | 'closed' | 'split';
}

export interface EvolutionProposal {
  proposalId: string;
  episodeId: string;
  skillId: string;
  runtime: RuntimeType;
  changeType: string;
  targetSection?: string | null;
  reason: string;
  evidence: string[];
  confidence: number;
  riskLevel: EvolutionRiskLevel;
  previewDiff?: string | null;
  status: EvolutionProposalStatus;
}

export interface EvolutionApplication {
  proposalId: string;
  appliedAt: string;
  revision: number;
  previousRevision: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
}

export interface EvolutionVerification {
  verifiedAt: string;
  revision: number;
  outcome: 'improved' | 'neutral' | 'regressed' | 'inconclusive';
  evidence: string[];
  reason: string;
}

export interface EvolutionRun {
  runId: string;
  episodeId: string;
  skillId: string;
  runtime: RuntimeType;
  status: EvolutionRunStatus;
  createdAt: string;
  updatedAt: string;
  proposal?: EvolutionProposal | null;
  application?: EvolutionApplication | null;
  verification?: EvolutionVerification | null;
  evidence?: EvolutionEvidenceRef[];
  failureReason?: string | null;
}

export function createEvolutionRun(run: EvolutionRun): EvolutionRun {
  return {
    ...run,
    proposal: run.proposal ?? null,
    application: run.application ?? null,
    verification: run.verification ?? null,
    evidence: run.evidence ?? [],
    failureReason: run.failureReason ?? null,
  };
}
