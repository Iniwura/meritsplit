import React from 'react';
import { ProjectState } from '../types';
import { DEFAULT_RUBRIC_CONFIG, CREATOR_ADDRESS, truncateAddress } from '../lib/genlayer';
import { GenLayerSpinner } from './GenLayerSpinner';
import { Lock, CheckCircle2 } from 'lucide-react';

interface RubricOverviewProps {
  currentState: ProjectState;
  activeAccount: string | null;
  onFreezeRubric: () => void;
  registeredCount: number;
  isFreezing?: boolean;
  rubric?: Record<string, number> | Array<{ name: string; weight: number; description?: string }>;
  creatorAddress?: string;
}

export const RubricOverview: React.FC<RubricOverviewProps> = ({
  currentState,
  activeAccount,
  onFreezeRubric,
  registeredCount,
  isFreezing = false,
  rubric,
  creatorAddress,
}) => {
  const effectiveCreator = creatorAddress || CREATOR_ADDRESS;
  const isCreator = activeAccount
    ? activeAccount.toLowerCase() === effectiveCreator.toLowerCase()
    : false;
  const isFrozen = currentState !== 'OPEN';

  const rubricItems = Array.isArray(rubric)
    ? rubric
    : rubric && typeof rubric === 'object'
    ? Object.entries(rubric).map(([name, weight]) => {
        const existing = DEFAULT_RUBRIC_CONFIG.find((d) => d.name === name);
        return {
          name,
          weight: Number(weight),
          description: existing?.description || `Evaluated against ${name} criteria.`,
        };
      })
    : DEFAULT_RUBRIC_CONFIG;

  return (
    <section className="space-y-6">
      {/* Top Metadata Line */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#686868] uppercase tracking-widest pb-4 border-b border-[#1c1c1c]">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#f4f4e8] font-sans">Project Rubric</span>
          <span className="text-[#333]">/</span>
          <span className="font-mono text-xs tracking-tight text-[#bcbcbc]">
            Target: <span className="text-[#ccff00] font-bold">10,000 BPS</span> (100.00%)
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span>
            Creator:{' '}
            <span className="font-mono text-xs tracking-tight text-[#bcbcbc]">
              {truncateAddress(effectiveCreator)}
            </span>
          </span>
          <span className="text-[#333]">·</span>
          <span className="border border-[#1c1c1c] bg-[#090a0c] text-[#bcbcbc] px-2.5 py-0.5 text-[10px] font-mono uppercase font-bold tracking-wider flex items-center gap-1.5 rounded-none">
            {isFrozen ? (
              <>
                <Lock className="w-3 h-3 text-[#ccff00]" />
                <span className="text-[#ccff00]">Locked</span>
              </>
            ) : (
              <span>Draft / Open</span>
            )}
          </span>
        </div>
      </div>

      {/* Structural Headline & Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#1c1c1c]">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4e8] mb-2">
            Project Rules
          </h2>
          <p className="text-xs sm:text-sm text-[#888] leading-relaxed font-sans">
            Predefined evaluation criteria locked on-chain prior to submission. Criteria weights guide multi-validator consensus in evaluating deliverable evidence shares with strict mathematical determinism.
          </p>
        </div>

        {/* Creator Control */}
        {currentState === 'OPEN' && (
          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            <button
              onClick={onFreezeRubric}
              disabled={isFreezing || registeredCount < 2}
              className={`px-6 py-3 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 flex items-center gap-2 cursor-pointer rounded-none ${
                !isFreezing && registeredCount >= 2
                  ? 'bg-[#ccff00] text-[#070809] hover:bg-white shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                  : 'bg-[#141414] text-[#444] border border-[#1c1c1c] cursor-not-allowed'
              }`}
            >
              {isFreezing ? (
                <>
                  <GenLayerSpinner size="sm" />
                  <span>Freezing On-Chain...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Freeze Rubric & Open Submissions</span>
                </>
              )}
            </button>
            {registeredCount < 2 && (
              <span className="text-[10px] font-mono text-[#686868]">
                Requires ≥2 registered contributors to split
              </span>
            )}
            {activeAccount && !isCreator && (
              <span className="text-[11px] font-mono text-[#686868]">
                Signer:{' '}
                <span className="font-mono text-[11px] tracking-tight text-[#bcbcbc]">
                  {truncateAddress(activeAccount)}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Uncramped Vertical Full-Width List with Hairline Borders */}
      <div className="border border-[#1c1c1c] divide-y divide-[#1c1c1c] bg-[#090a0c]">
        {rubricItems.map((crit, idx) => (
          <div
            key={crit.name}
            className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 transition-all duration-200 hover:bg-white/5"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-[#686868] font-bold">0{idx + 1}</span>
                <span className="text-[#333]">/</span>
                <h3 className="font-display text-lg font-bold text-[#f4f4e8] tracking-tight">
                  {crit.name}
                </h3>
              </div>
              <p className="text-xs text-[#888] leading-relaxed font-sans max-w-2xl">
                {crit.description}
              </p>
            </div>

            <div className="shrink-0 flex md:flex-col items-baseline md:items-end justify-between md:justify-start gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#1c1c1c]">
              <span className="font-mono text-3xl font-extrabold text-[#ccff00] tracking-tight">
                {crit.weight}%
              </span>
              <div className="flex items-center space-x-2">
                <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-2 py-0.5 text-xs font-mono tracking-tight font-bold rounded-none">
                  {crit.weight * 100} BPS
                </span>
                {isFrozen && (
                  <span className="border border-[#1c1c1c] bg-[#070809] text-[#888] px-1.5 py-0.5 text-[10px] font-mono uppercase font-bold flex items-center gap-1 rounded-none">
                    <CheckCircle2 className="w-3 h-3 text-[#ccff00]" />
                    <span>Fixed</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
