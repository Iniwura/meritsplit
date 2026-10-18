import { ProjectState, ContributorClaim, ContributorAllocation, ProjectStateResponse } from '../types';

export const GENLAYER_STUDIO_NEXT_CONFIG = {
  rpcUrl: (import.meta as any).env?.VITE_GENLAYER_RPC_URL || 'https://studio-next.genlayer.com/api',
  chainId: Number((import.meta as any).env?.VITE_GENLAYER_CHAIN_ID) || 61997,
  chainName: 'GenLayer Studio Next Testnet',
  nativeCurrency: {
    name: 'GenLayer GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  defaultContractAddress: (import.meta as any).env?.VITE_CONTRACT_ADDRESS || '0x3CDc767088d81aA2e781E1E28e2000f893117B6f',
};

export const DEFAULT_RUBRIC_CONFIG = [
  { name: 'Delivered Work', weight: 30, description: 'Shipped functionality, PRs, codebase structure, tangible deliverables' },
  { name: 'Technical or Creative Difficulty', weight: 25, description: 'Algorithmic complexity, security rigour, non-trivial engineering' },
  { name: 'Impact on Final Result', weight: 25, description: 'Critical path contribution, systemic importance to launch' },
  { name: 'Reliability & Validation', weight: 10, description: 'PyTest suite, formal verification, documentation, edge cases' },
  { name: 'Collaboration & Support', weight: 10, description: 'Code reviews, architectural alignment, unblocking teammates' },
];

export function truncateAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const CREATOR_ADDRESS = '0xcE5348Ced92f54aE2407b41E754465DfC2E6cA78';

/**
 * Largest Remainder Method implementation in TypeScript for verification & local simulator.
 * Identical to contract logic in contracts/merit_split.py.
 */
export function calculateLargestRemainderAllocations(
  scores: Record<string, number>,
  contributorAddresses: string[]
): {
  allocations: ContributorAllocation[];
  totalBps: number;
  isExact10000: boolean;
  leftoverBps: number;
} {
  const TOTAL_BPS = 10000;
  const validScores: Record<string, number> = {};
  let totalScore = 0;

  for (const addr of contributorAddresses) {
    const s = Math.max(0, Math.min(100, Math.floor(scores[addr] || 0)));
    validScores[addr] = s;
    totalScore += s;
  }

  if (totalScore <= 0) {
    return {
      allocations: contributorAddresses.map((addr) => ({
        address: addr,
        name: truncateAddress(addr),
        score: 0,
        baseBps: 0,
        remainder: 0,
        awardedRemainder: false,
        finalBps: 0,
        percentage: '0.00%',
      })),
      totalBps: 0,
      isExact10000: false,
      leftoverBps: 0,
    };
  }

  let sumBaseBps = 0;
  const baseBpsMap: Record<string, number> = {};
  const remainderMap: Record<string, number> = {};

  for (const addr of contributorAddresses) {
    const s = validScores[addr];
    const scaled = s * TOTAL_BPS;
    const base = Math.floor(scaled / totalScore);
    const rem = scaled % totalScore;
    baseBpsMap[addr] = base;
    remainderMap[addr] = rem;
    sumBaseBps += base;
  }

  const leftoverBps = TOTAL_BPS - sumBaseBps;

  // Sort by remainder DESC, score DESC, address ASC
  const sortedAddrs = [...contributorAddresses].sort((a, b) => {
    if (remainderMap[b] !== remainderMap[a]) {
      return remainderMap[b] - remainderMap[a];
    }
    if (validScores[b] !== validScores[a]) {
      return validScores[b] - validScores[a];
    }
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  const awardedSet = new Set<string>();
  const finalBpsMap: Record<string, number> = { ...baseBpsMap };

  for (let i = 0; i < leftoverBps; i++) {
    const winner = sortedAddrs[i % sortedAddrs.length];
    finalBpsMap[winner] = (finalBpsMap[winner] || 0) + 1;
    awardedSet.add(winner);
  }

  let finalSum = 0;
  const allocations: ContributorAllocation[] = contributorAddresses.map((addr) => {
    const finalBps = finalBpsMap[addr] || 0;
    finalSum += finalBps;

    return {
      address: addr,
      name: truncateAddress(addr),
      score: validScores[addr],
      baseBps: baseBpsMap[addr] || 0,
      remainder: remainderMap[addr] || 0,
      awardedRemainder: awardedSet.has(addr),
      finalBps,
      percentage: `${(finalBps / 100).toFixed(2)}%`,
    };
  });

  return {
    allocations,
    totalBps: finalSum,
    isExact10000: finalSum === TOTAL_BPS,
    leftoverBps,
  };
}
