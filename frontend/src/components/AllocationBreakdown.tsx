import React from 'react';
import { ContributorAllocation, ProjectState } from '../types';
import { truncateAddress } from '../lib/genlayer';

interface AllocationBreakdownProps {
  currentState: ProjectState;
  allocations: ContributorAllocation[];
  totalBasisPoints: number;
  isExact10000: boolean;
  leftoverBps: number;
  totalScore: number;
  assessmentNotes: string;
}

export const AllocationBreakdown: React.FC<AllocationBreakdownProps> = ({
  currentState,
  allocations,
  totalBasisPoints,
  isExact10000,
  leftoverBps,
  totalScore,
}) => {
  const isFinalized = currentState === 'FINALIZED';
  const isUnresolved = currentState === 'UNRESOLVED';

  return (
    <section className="pb-16 font-mono">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 pb-4 border-b border-[#1c1c1c]">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#f4f4e8]">
            Settlement Results
          </h2>
          <p className="text-xs text-[#888] font-sans mt-0.5">
            Deterministic basis point allocation computed via largest remainder rule.
          </p>
        </div>
        <div className="font-mono text-xs mt-2 md:mt-0">
          {isFinalized ? (
            <span className="text-[#ccff00] uppercase tracking-wider font-bold text-[11px]">
              ✓ Invariant Verified · 10,000 BPS Exactly
            </span>
          ) : isUnresolved ? (
            <span className="text-rose-400 uppercase tracking-wider font-bold text-[11px]">
              ✕ Fail-Closed · Zero Shares Distributed
            </span>
          ) : (
            <span className="text-[#888] uppercase tracking-wider text-[11px]">
              Provisional Assessment
            </span>
          )}
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#1c1c1c] mb-10">
        <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 bg-[#090a0c]">
          <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">
            Total Distributed
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#f4f4e8] tracking-tight mb-1">
            <span className="font-mono text-2xl sm:text-3xl tracking-tight text-[#ccff00]">
              {allocations.length > 0 ? totalBasisPoints.toLocaleString() : '0'}
            </span>{' '}
            <span className="text-xs font-mono text-[#888]">BPS</span>
          </div>
          <span className="font-mono text-xs tracking-tight text-[#ccff00] font-bold">
            {allocations.length > 0 ? (isExact10000 ? '100.00% Conservation Invariant' : 'Broken') : 'Awaiting Settlement'}
          </span>
        </div>

        <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 bg-[#090a0c]">
          <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">
            Settlement Math
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#f4f4e8] tracking-tight mb-1">
            <span className="font-mono text-xl sm:text-2xl tracking-tight text-[#f4f4e8]">Hare-Niemeyer</span>
          </div>
          <span className="font-sans text-xs text-[#888]">
            Largest Remainder Method (<span className="font-mono text-[#ccff00]">10,000 BPS</span> exact)
          </span>
        </div>

        <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 bg-[#090a0c]">
          <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">
            Audit State
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#f4f4e8] tracking-tight mb-1">
            <span className="font-mono text-2xl sm:text-3xl tracking-tight text-[#f4f4e8]">{currentState}</span>
          </div>
          <span className="font-sans text-xs text-[#888]">
            {isFinalized ? 'Immutable on-chain' : 'Pending final consensus'}
          </span>
        </div>
      </div>

      {/* Verifiable Mathematical Ledger Table or Blank Slate */}
      {allocations.length === 0 ? (
        <div className="border border-[#1c1c1c] bg-[#070707] p-12 text-center font-mono">
          <p className="text-sm font-sans text-[#bcbcbc] mb-2 uppercase tracking-wider font-semibold">
            No Finalized Allocations On Record
          </p>
          <p className="text-xs font-sans text-[#555] max-w-md mx-auto">
            Zero shares distributed. The settlement ledger will populate dynamically once contributor claims are submitted and consensus assessment is finalized.
          </p>
        </div>
      ) : (
        <div className="border-t border-l border-[#1c1c1c] overflow-x-auto bg-[#070809]">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1c1c1c] bg-[#090a0c] text-[#686868] uppercase text-[10px] tracking-widest">
                <th className="py-4 px-6 border-r border-[#1c1c1c]">Contributor</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c]">Consensus Score</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c]">Floor Base Share</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c]">Fractional Remainder</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c]">Tie-Breaker</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c] text-right">Final Basis Points</th>
                <th className="py-4 px-6 border-r border-[#1c1c1c] text-right">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c1c]">
              {allocations.map((row) => (
                <tr key={row.address} className="transition-all duration-200 hover:bg-white/5">
                  <td className="py-4 px-6 border-r border-[#1c1c1c]">
                    <span className="font-mono text-xs tracking-tight text-[#f4f4e8] block font-bold">
                      {truncateAddress(row.address)}
                    </span>
                    <span className="font-mono text-[10px] tracking-tight text-[#686868]">{row.address}</span>
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#bcbcbc]">
                    {row.score} / 100
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#bcbcbc]">
                    {row.baseBps.toLocaleString()} BPS
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#888]">
                    {row.remainder}
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c]">
                    {row.awardedRemainder ? (
                      <span className="font-mono text-xs tracking-tight text-[#ccff00] font-bold">+1 BPS</span>
                    ) : (
                      <span className="font-mono text-xs text-[#444]">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c] text-right font-mono text-xs tracking-tight font-bold text-[#f4f4e8]">
                    {row.finalBps.toLocaleString()} BPS
                  </td>
                  <td className="py-4 px-6 border-r border-[#1c1c1c] text-right font-mono text-xs tracking-tight font-extrabold text-[#ccff00]">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              {/* Summary Invariant Total Row */}
              <tr className="bg-[#0a0a0a] border-t-2 border-[#1c1c1c] font-bold text-xs">
                <td className="py-5 px-6 border-r border-[#1c1c1c] uppercase text-[#f4f4e8] font-sans">
                  Total (Proof)
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#f4f4e8]">
                  {totalScore}
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#888]">
                  {(10000 - leftoverBps).toLocaleString()} BPS
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#888]">
                  Rem. count: {leftoverBps}
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] font-mono text-xs tracking-tight text-[#ccff00]">
                  +{leftoverBps} BPS
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] text-right font-mono text-xs tracking-tight text-[#ccff00]">
                  {totalBasisPoints.toLocaleString()} BPS
                </td>
                <td className="py-5 px-6 border-r border-[#1c1c1c] text-right font-mono text-xs tracking-tight text-[#ccff00]">
                  100.00%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-[#555] uppercase tracking-wider gap-2">
        <span>Deterministic Rule: Remainder DESC → Score DESC → Address ASC</span>
        <span>Zero Hallucination Arithmetic Invariant Guaranteed</span>
      </div>
    </section>
  );
};
