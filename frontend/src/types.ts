export type ProjectState = 'OPEN' | 'SUBMISSIONS' | 'ASSESSING' | 'FINALIZED' | 'UNRESOLVED';

export interface RubricCriteria {
  name: string;
  weight: number; // percentage (e.g. 30 = 30%)
  description: string;
}

export interface Contributor {
  address: string;
  name: string;
  role: string;
  avatar: string;
  registered: boolean;
}

export interface ContributorClaim {
  contributor: string;
  evidence_url: string;
  evidence_digest?: string;
  description: string;
  submission_time?: number;
  active: boolean;
  tags?: string[];
}

export interface EvaluatorScoreBreakdown {
  deliveredWork: number;       // out of 30
  technicalDifficulty: number; // out of 25
  impact: number;              // out of 25
  reliability: number;         // out of 10
  collaboration: number;       // out of 10
  compositeScore: number;      // sum 0 - 100
  notes: string;
}

export interface ContributorAllocation {
  address: string;
  name: string;
  score: number;
  baseBps: number;
  remainder: number;
  remainderRank?: number;
  awardedRemainder: boolean;
  finalBps: number;
  percentage: string;
}

export interface DeliberationStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  hash?: string;
  timestamp?: string;
}

export interface ProjectStateResponse {
  creator: string;
  project_name: string;
  rubric: Record<string, number>;
  state_code: number;
  state_name: ProjectState;
  contributors: string[];
  claims: Record<string, ContributorClaim>;
  assessment_scores: Record<string, number>;
  final_allocations: Record<string, number>;
  total_basis_points: number;
  is_exact_10000: boolean;
  assessment_notes: string;
  max_contributors?: number;
}
