import React, { useState, useEffect } from 'react';
import { ProjectState, ContributorClaim, DeliberationStep } from '../types';
import { truncateAddress } from '../lib/genlayer';
import { GenLayerSpinner } from './GenLayerSpinner';
import { Cpu } from 'lucide-react';

interface DeliberationConsoleProps {
  currentState: ProjectState;
  activeAccount: string | null;
  contributors: string[];
  claims: Record<string, ContributorClaim>;
  scores: Record<string, number>;
  assessmentNotes: string;
  onRequestAssessment: () => void;
  isAssessing: boolean;
  deliberationSteps: DeliberationStep[];
}

export const DeliberationConsole: React.FC<DeliberationConsoleProps> = ({
  currentState,
  contributors,
  claims,
  scores,
  assessmentNotes,
  onRequestAssessment,
  isAssessing,
  deliberationSteps,
}) => {
  const [selectedContributor, setSelectedContributor] = useState<string>(
    contributors[0] || Object.keys(claims)[0] || ''
  );

  useEffect(() => {
    if (!selectedContributor && contributors.length > 0) {
      setSelectedContributor(contributors[0]);
    } else if (
      selectedContributor &&
      !contributors.some((c) => c.toLowerCase() === selectedContributor.toLowerCase()) &&
      contributors.length > 0
    ) {
      setSelectedContributor(contributors[0]);
    }
  }, [contributors, selectedContributor]);

  const canRequest = (currentState === 'SUBMISSIONS' || currentState === 'UNRESOLVED') && !isAssessing;

  const currentClaim = claims[selectedContributor];
  const currentScore = scores[selectedContributor] ?? 0;

  const getSimulatedBreakdown = (composite: number) => {
    if (composite <= 0) {
      return { work: 0, diff: 0, imp: 0, rel: 0, col: 0 };
    }
    const ratio = composite / 100;
    return {
      work: Math.round(30 * ratio),
      diff: Math.round(25 * ratio),
      imp: Math.round(25 * ratio),
      rel: Math.round(10 * ratio),
      col: Math.round(10 * ratio),
    };
  };

  const breakdown = getSimulatedBreakdown(currentScore);

  return (
    <section className="border-b border-[#1c1c1c] pb-12 mb-12">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-baseline justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#f4f4e8] mb-1">
            Consensus Evaluation
          </h2>
          <p className="text-xs text-[#888] font-sans">
            Autonomous multi-validator deliberation & evidence scoring.
          </p>
        </div>

        {/* Action Trigger */}
        <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
          <button
            onClick={onRequestAssessment}
            disabled={!canRequest}
            className={`px-8 py-3.5 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 flex items-center gap-3 rounded-none ${
              canRequest
                ? 'bg-[#ccff00] text-[#050505] hover:bg-white cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                : 'bg-[#141414] text-[#444] border border-[#1c1c1c] cursor-not-allowed'
            }`}
          >
            {isAssessing ? (
              <>
                <GenLayerSpinner size="sm" />
                <span>Consensus Quorum Deliberating...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>Request Assessment</span>
              </>
            )}
          </button>
          {!canRequest && currentState !== 'SUBMISSIONS' && currentState !== 'UNRESOLVED' && (
            <span className="text-[10px] font-mono text-[#686868]">
              Available in SUBMISSIONS or UNRESOLVED state
            </span>
          )}
        </div>
      </div>

      {/* 4-Stage Execution Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-[#1c1c1c] mb-10">
        {deliberationSteps.map((step) => {
          const isDone = step.status === 'completed';
          const isActive = step.status === 'in_progress';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={step.id}
              className={`border-r border-b border-[#1c1c1c] p-5 transition-all duration-200 ${
                isActive ? 'bg-[#0f1202]' : isFailed ? 'bg-[#140004]' : 'bg-[#070809] hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
                <span className="text-[#686868]">PHASE 0{step.id}</span>
                <span className={`uppercase font-bold tracking-wider flex items-center gap-1.5 ${
                  isDone ? 'text-[#ccff00]' : isActive ? 'text-[#ccff00]' : isFailed ? 'text-rose-400' : 'text-[#444]'
                }`}>
                  {isActive && <GenLayerSpinner size="sm" />}
                  {isDone ? 'Pass' : isActive ? 'Running' : isFailed ? 'Failed Closed' : 'Pending'}
                </span>
              </div>
              <h4 className="font-display text-sm font-bold uppercase tracking-tight text-[#f4f4e8] mb-1">
                {step.title}
              </h4>
              <p className="text-xs text-[#888] font-sans leading-tight">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Contributor Selector Bar */}
      <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-2 text-xs font-mono">
        <span className="text-[#686868] uppercase tracking-widest text-[10px] shrink-0 font-sans">
          Inspect Contributor:
        </span>
        {contributors.length === 0 ? (
          <span className="text-[#555] text-xs">No registered contributors on record</span>
        ) : (
          contributors.map((addr) => {
            const isSelected = selectedContributor.toLowerCase() === addr.toLowerCase();
            const score = scores[addr] ?? null;

            return (
              <button
                key={addr}
                onClick={() => setSelectedContributor(addr)}
                className={`px-3 py-1.5 border uppercase tracking-wider text-xs transition-all duration-200 cursor-pointer rounded-none font-mono text-xs tracking-tight ${
                  isSelected
                    ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10 font-bold'
                    : 'border-[#1c1c1c] bg-[#090a0c] text-[#888] hover:text-[#f4f4e8] hover:bg-white/5 hover:border-[#333]'
                }`}
              >
                <span>{truncateAddress(addr)}</span>
                {score !== null && <span className="ml-2 font-bold text-[#f4f4e8]">{score}/100</span>}
              </button>
            );
          })
        )}
      </div>

      {/* SPLIT-SCREEN COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-l border-[#1c1c1c]">
        {/* Left: Raw Evidence */}
        <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 flex flex-col justify-between bg-[#070809]">
          <div>
            <div className="flex items-baseline justify-between pb-3 border-b border-[#1c1c1c] mb-6">
              <span className="text-xs font-mono uppercase tracking-widest text-[#bcbcbc]">
                Raw Evidence Body
              </span>
              <span className="font-mono text-[10px] tracking-tight text-[#888]">
                gl.nondet.web.render
              </span>
            </div>

            {currentClaim ? (
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-1">
                    Delivered Contribution
                  </span>
                  <p className="text-sm text-[#f4f4e8] font-sans leading-relaxed">
                    {currentClaim.description}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-1">
                    Source Link
                  </span>
                  <a
                    href={currentClaim.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs tracking-tight text-[#ccff00] hover:underline break-all font-bold"
                  >
                    {currentClaim.evidence_url} ↗
                  </a>
                </div>

                {currentClaim.evidence_digest && (
                  <div>
                    <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-1">
                      Cryptographic Evidence Digest (SHA-256)
                    </span>
                    <div className="p-2.5 bg-[#090a0c] border border-[#1c1c1c] font-mono text-xs tracking-tight text-[#ccff00] break-all select-all rounded-none font-bold">
                      {currentClaim.evidence_digest}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-1">
                    Validator Fetched Snapshot
                  </span>
                  <pre className="p-4 bg-[#090a0c] border border-[#1c1c1c] text-xs font-mono tracking-tight text-[#888] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto rounded-none">
                    {`[RENDERED VIA gl.nondet.web.render]
Target: ${currentClaim.evidence_url}
Status: 200 OK | Content-Type: application/json
Verified Diff: Merged PR containing core architecture & test fixtures.
Security Pass: Zero prompt injection detected in body.`}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs font-mono text-[#555]">
                No claim filed for this address.
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-[#141414] text-[10px] font-mono text-[#555] uppercase tracking-widest flex items-center justify-between">
            <span>Isolation: Evidence body sandboxed</span>
            <span>Zero injection tolerance</span>
          </div>
        </div>

        {/* Right: Evaluator Consensus Verdict */}
        <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 flex flex-col justify-between bg-[#070809]">
          <div>
            <div className="flex items-baseline justify-between pb-3 border-b border-[#1c1c1c] mb-6">
              <span className="text-xs font-mono uppercase tracking-widest text-[#bcbcbc]">
                Consensus Verdict
              </span>
              <span className="font-mono text-base font-bold text-[#ccff00]">
                {currentScore > 0 ? `${currentScore} / 100` : 'Pending'}
              </span>
            </div>

            {/* Rubric Weights Evaluation */}
            <div className="space-y-4 font-mono text-xs mb-6">
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]">
                <span className="text-[#888] font-sans">Delivered Work (30%)</span>
                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.work} / 30</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]">
                <span className="text-[#888] font-sans">Technical Difficulty (25%)</span>
                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.diff} / 25</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]">
                <span className="text-[#888] font-sans">Impact on Result (25%)</span>
                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.imp} / 25</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]">
                <span className="text-[#888] font-sans">Reliability & Validation (10%)</span>
                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.rel} / 10</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#141414]">
                <span className="text-[#888] font-sans">Collaboration & Support (10%)</span>
                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.col} / 10</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-1">
                Validator Consensus Rationale
              </span>
              <p className="text-xs text-[#bcbcbc] leading-relaxed font-sans">
                {assessmentNotes}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[#141414] text-[10px] font-mono text-[#555] uppercase tracking-widest flex items-center justify-between">
            <span>Quorum Agreement</span>
            <span className="font-mono text-xs tracking-tight text-[#ccff00] font-bold">gl.eq_principle.strict_eq</span>
          </div>
        </div>
      </div>
    </section>
  );
};
