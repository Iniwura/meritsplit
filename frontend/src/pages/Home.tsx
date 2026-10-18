import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { DEFAULT_RUBRIC_CONFIG, GENLAYER_STUDIO_NEXT_CONFIG } from '../lib/genlayer';

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#070809] text-[#f4f4e8] font-sans selection:bg-[#ccff00] selection:text-[#070809]">
      {/* Minimalist Top Bar */}
      <header className="border-b border-[#1c1c1c] sticky top-0 z-50 bg-[#070809]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <span className="font-display font-extrabold text-lg tracking-tight uppercase text-[#f4f4e8]">
              MeritSplit
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#686868] uppercase border-l border-[#222] pl-3">
              GenLayer
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-xs font-mono uppercase tracking-widest text-[#888]">
            <a href="#mechanism" className="hover:text-[#f4f4e8] transition-colors">Mechanism</a>
            <a href="#rubric" className="hover:text-[#f4f4e8] transition-colors">Frozen Rubric</a>
            <a href="#math" className="hover:text-[#f4f4e8] transition-colors">Integer Proof</a>
            <Link to="/app" className="text-[#888] hover:text-[#ccff00] transition-colors">Live Contract</Link>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              to="/app"
              className="px-5 py-2.5 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all cursor-pointer flex items-center space-x-2"
            >
              <span>Launch App</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Disciplined Scale Above the Fold */}
      <section className="max-w-7xl mx-auto px-6 pt-12 sm:pt-16 pb-12 sm:pb-16 border-b border-[#1c1c1c]">
        <div className="flex items-center space-x-3 text-xs font-mono text-[#686868] uppercase tracking-widest mb-6">
          <span className="inline-block w-2 h-2 bg-[#ccff00]" />
          <span>GenLayer Intelligent Protocol</span>
          <span className="text-[#333]">/</span>
          <span>Studio Next · Chain ID 61997</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight text-[#f4f4e8] leading-[1.08] max-w-4xl mb-5">
          Equity splits, evaluated by AI. <br />
          <span className="text-[#ccff00]">Settled on-chain.</span>
        </h1>

        <p className="text-sm sm:text-base text-[#bcbcbc] font-normal leading-relaxed max-w-2xl mb-8">
          An on-chain contribution-attribution protocol on GenLayer. Evaluates collaborative team deliverables 
          against a predefined, evidence-backed frozen rubric to allocate exact integer basis points 
          with complete mathematical determinism. Zero retroactive distortion. Zero share fabrication.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/app"
            className="px-8 py-3.5 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all cursor-pointer flex items-center space-x-2"
          >
            <span>Launch App (Project Hub)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/deploy"
            className="px-6 py-3.5 font-mono text-xs uppercase tracking-widest border border-[#222] text-[#bcbcbc] hover:text-white hover:border-[#444] transition-all flex items-center space-x-2"
          >
            <span>Initialize New Split</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#888]" />
          </Link>
        </div>
      </section>

      {/* Mechanism Timeline: Minimalist 3-Step Visual Text Flow */}
      <section id="mechanism" className="max-w-7xl mx-auto px-6 py-20 border-b border-[#1c1c1c]">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-16">
          <div>
            <span className="text-xs font-mono text-[#686868] uppercase tracking-widest block mb-2">
              Protocol Pipeline
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#f4f4e8]">
              The Mechanism Timeline
            </h2>
          </div>
          <span className="font-mono text-xs text-[#888] mt-3 md:mt-0">
            Linear, deterministic progression from creation to 10,000 BPS settlement
          </span>
        </div>

        {/* Structural Line Flow with Stark Editorial Grid Lines */}
        <div className="border-t border-[#1c1c1c]">
          {/* Step 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 py-12 border-b border-[#1c1c1c] gap-6 lg:gap-12 items-baseline">
            <div className="lg:col-span-3 flex items-center space-x-4">
              <span className="font-mono text-2xl font-bold text-[#ccff00]">01</span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#686868]">
                Phase · Setup
              </span>
            </div>
            <div className="lg:col-span-4">
              <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#f4f4e8]">
                Lock the Rubric
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm text-[#bcbcbc] leading-relaxed mb-3">
                The project creator registers eligible contributors and sets fixed evaluation weights (Delivered Work 30%, Technical Difficulty 25%, Impact 25%, Reliability 10%, Collaboration 10%). 
                The rubric is irrevocably frozen in smart contract state before any contribution submissions open.
              </p>
              <div className="font-mono text-[11px] text-[#686868] flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00]" />
                <span>On-chain Invariant: Immutable state transition [DRAFT → SUBMISSIONS]</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 py-12 border-b border-[#1c1c1c] gap-6 lg:gap-12 items-baseline">
            <div className="lg:col-span-3 flex items-center space-x-4">
              <span className="font-mono text-2xl font-bold text-[#ccff00]">02</span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#686868]">
                Phase · Submissions
              </span>
            </div>
            <div className="lg:col-span-4">
              <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#f4f4e8]">
                Commit Evidence (SHA-256)
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm text-[#bcbcbc] leading-relaxed mb-3">
                Eligible team members authenticate with their Web3 wallet and file deliverables. Every pull request URL and scope summary is hashed client-side with SHA-256 before broadcasting, anchoring an immutable cryptographic commitment on GenLayer.
              </p>
              <div className="font-mono text-[11px] text-[#686868] flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00]" />
                <span>Zero Tampering: gl.nondet.web.render sandboxes evidence bodies</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 py-12 border-b border-[#1c1c1c] gap-6 lg:gap-12 items-baseline">
            <div className="lg:col-span-3 flex items-center space-x-4">
              <span className="font-mono text-2xl font-bold text-[#ccff00]">03</span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#686868]">
                Phase · Settlement
              </span>
            </div>
            <div className="lg:col-span-4">
              <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#f4f4e8]">
                Deterministic Settlement
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm text-[#bcbcbc] leading-relaxed mb-3">
                GenLayer validators deliberate through LLM consensus (<code className="text-[#ccff00] font-mono text-xs">gl.eq_principle.strict_eq</code>) to certify integer scores (0–100). The Hare-Niemeyer Largest Remainder algorithm then calculates shares in exact integer arithmetic. 
                Sum strictly equals 10,000 basis points (100.00%).
              </p>
              <div className="font-mono text-[11px] text-[#ccff00] flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00]" />
                <span>Fail-Closed Principle: Insufficient evidence falls back to UNRESOLVED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rubric Criteria Section */}
      <section id="rubric" className="max-w-7xl mx-auto px-6 py-20 border-b border-[#1c1c1c]">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-16">
          <div>
            <span className="text-xs font-mono text-[#686868] uppercase tracking-widest block mb-2">
              Evaluation Standards
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#f4f4e8]">
              Predefined Rubric Weights
            </h2>
          </div>
          <span className="font-mono text-xs text-[#ccff00] mt-3 md:mt-0">
            Total Conservation: 100% · 10,000 Basis Points
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 border-t border-l border-[#1c1c1c]">
          {DEFAULT_RUBRIC_CONFIG.map((crit, idx) => (
            <div key={crit.name} className="border-r border-b border-[#1c1c1c] p-6 lg:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-baseline justify-between mb-6">
                  <span className="font-mono text-xs text-[#686868]">0{idx + 1}</span>
                  <span className="font-mono text-2xl font-bold text-[#ccff00]">{crit.weight}%</span>
                </div>
                <h4 className="font-display text-sm font-bold uppercase text-[#f4f4e8] mb-2">{crit.name}</h4>
                <p className="text-xs text-[#888] leading-relaxed">{crit.description}</p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#161616] font-mono text-[10px] text-[#555] uppercase">
                {crit.weight * 100} BPS Fixed Allocation
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mathematical Proof Section */}
      <section id="math" className="max-w-7xl mx-auto px-6 py-20 border-b border-[#1c1c1c]">
        <div className="max-w-4xl">
          <span className="text-xs font-mono text-[#686868] uppercase tracking-widest block mb-2">
            Mathematical Conservation
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#f4f4e8] mb-6">
            Largest Remainder <br />
            <span className="text-[#ccff00]">Settlement Algorithm</span>
          </h2>
          <p className="text-sm sm:text-base text-[#bcbcbc] leading-relaxed mb-8">
            Traditional floating point divisions introduce rounding leaks on-chain. MeritSplit enforces integer basis points
            (10,000 BPS = 100.00%) via the Hare-Niemeyer Largest Remainder Method:
          </p>

          <div className="p-6 bg-[#090a0c] border border-[#1c1c1c] font-mono text-xs text-[#bcbcbc] space-y-3 mb-8">
            <div><span className="text-[#686868]">1. Base Share:</span> floor((Score_i * 10,000) / Total_Score)</div>
            <div><span className="text-[#686868]">2. Fractional Remainder:</span> (Score_i * 10,000) % Total_Score</div>
            <div><span className="text-[#686868]">3. Leftover BPS:</span> 10,000 - sum(Base_i)</div>
            <div><span className="text-[#686868]">4. Tie-Breaker Ordering:</span> Remainder DESC → Score DESC → Contributor Address ASC</div>
            <div className="text-[#ccff00] pt-2 border-t border-[#1a1a1a]">
              Invariant Guaranteed: sum(Final_Allocations) ≡ 10,000 BPS (100.00% exact)
            </div>
          </div>

          <Link
            to="/app"
            className="inline-flex items-center space-x-2 px-8 py-4 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all cursor-pointer"
          >
            <span>Launch App (Project Hub)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Network Specifications */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-b border-[#1c1c1c]">
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#1c1c1c]">
          <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8">
            <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">Network RPC</span>
            <div className="font-mono text-sm font-bold text-[#f4f4e8] break-all">{GENLAYER_STUDIO_NEXT_CONFIG.rpcUrl}</div>
          </div>
          <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8">
            <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">Chain ID</span>
            <div className="font-display text-2xl font-bold text-[#ccff00]">{GENLAYER_STUDIO_NEXT_CONFIG.chainId}</div>
          </div>
          <div className="border-r border-b border-[#1c1c1c] p-6 lg:p-8">
            <span className="text-[10px] font-mono text-[#686868] uppercase tracking-widest block mb-2">Consensus Core</span>
            <div className="font-mono text-xs text-[#bcbcbc]">gl.eq_principle.strict_eq</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#686868]">
        <div className="uppercase tracking-widest text-[#f4f4e8] font-bold">
          MeritSplit · GenLayer Protocol
        </div>
        <div className="flex items-center space-x-6 uppercase tracking-wider text-[11px] text-[#555]">
          <Link to="/app" className="text-[#ccff00] hover:underline cursor-pointer">
            Launch App →
          </Link>
          <Link to="/deploy" className="text-[#888] hover:text-[#f4f4e8] cursor-pointer">
            Deploy Split →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Home;
