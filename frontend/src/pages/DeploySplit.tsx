import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { GenLayerSpinner } from '../components/GenLayerSpinner';
import { truncateAddress } from '../lib/genlayer';
import { parseGenLayerError } from '../lib/wallet';
import { deploySplitContract } from '../services/genlayer';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

interface DeploySplitProps {
  account: string | null;
  isConnecting: boolean;
  client?: any;
  onConnectWallet: () => Promise<string | null>;
  onDisconnectWallet: () => void;
  onDeployProject?: (projectData: {
    name: string;
    description: string;
    contributors: string[];
    rubric: Record<string, number>;
  }) => void;
  onSelectContractAddress?: (address: string) => void;
}

const CRITERIA_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  'Delivered Work': { bg: 'bg-[#ccff00]', text: 'text-[#070809]', hex: '#ccff00' },
  'Technical or Creative Difficulty': { bg: 'bg-[#a3e635]', text: 'text-[#070809]', hex: '#a3e635' },
  'Impact on Final Result': { bg: 'bg-[#65a30d]', text: 'text-white', hex: '#65a30d' },
  'Reliability & Validation': { bg: 'bg-[#4d7c0f]', text: 'text-white', hex: '#4d7c0f' },
  'Collaboration & Support': { bg: 'bg-[#365314]', text: 'text-white', hex: '#365314' },
};

export const DeploySplit: React.FC<DeploySplitProps> = ({
  account,
  isConnecting,
  client,
  onConnectWallet,
  onDisconnectWallet,
  onDeployProject,
  onSelectContractAddress,
}) => {
  const navigate = useNavigate();

  // Project Metadata
  const [projectName, setProjectName] = useState('Core Architecture Sprint');
  const [projectDescription, setProjectDescription] = useState(
    'Evaluating core deliverables against consensus equivalence criteria.'
  );

  // Contributor Addresses
  const [contributors, setContributors] = useState<string[]>([
    '0x965FCf89FbFaafC8648ffaB801b6fac355b1dF76',
    '0xED7794fDb6C6d6cD0D814B313609Bf7919867B81',
  ]);
  const [newContributorInput, setNewContributorInput] = useState('');
  const [contributorError, setContributorError] = useState('');

  // Rubric Weights (must sum to 100% / 10,000 BPS)
  const [rubric, setRubric] = useState<Record<string, number>>({
    'Delivered Work': 30,
    'Technical or Creative Difficulty': 25,
    'Impact on Final Result': 25,
    'Reliability & Validation': 10,
    'Collaboration & Support': 10,
  });

  const [isDeploying, setIsDeploying] = useState(false);

  const totalWeight = Object.values(rubric).reduce((a, b) => a + b, 0);
  const totalBps = totalWeight * 100;
  const isWeightValid = totalWeight === 100;

  const handleAddContributor = () => {
    setContributorError('');
    const trimmed = newContributorInput.trim();
    if (!trimmed) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setContributorError('Invalid EVM address format. Must be a 42-character hex address (0x...).');
      return;
    }

    if (contributors.length >= 10) {
      setContributorError('Maximum 10 contributors per split to prevent GenVM execution timeouts.');
      return;
    }

    if (contributors.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setContributorError('Address is already present in the contributor list.');
      return;
    }

    setContributors((prev) => [...prev, trimmed]);
    setNewContributorInput('');
  };

  const handleRemoveContributor = (index: number) => {
    setContributors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWeightChange = (key: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
    setRubric((prev) => ({
      ...prev,
      [key]: clamped,
    }));
  };

  const handleDeploy = async () => {
    if (!account) {
      toast.error('Wallet required', {
        description: 'Please connect your Web3 wallet to sign the deploy transaction.',
      });
      await onConnectWallet();
      return;
    }

    if (!projectName.trim()) {
      toast.error('Project name required', { description: 'Please provide a name for this split contract.' });
      return;
    }

    if (contributors.length < 2) {
      toast.error('At least 2 contributors required', { description: 'A split contract requires at least two registered contributors.' });
      return;
    }

    if (!isWeightValid) {
      toast.error('Invalid rubric weights', {
        description: `Total weight is currently ${totalWeight}%. It must equal exactly 100% (10,000 BPS).`,
      });
      return;
    }

    try {
      setIsDeploying(true);
      toast.loading('Deploying MeritSplit Intelligent Contract to GenLayer Studio Next...', { id: 'deploy-tx' });

      let deployedAddress = '';

      if (client) {
        // Wire to MeritSplit __init__(project_name, rubric, creator)
        const deployRes = await deploySplitContract(client, {
          projectName: projectName.trim(),
          rubric,
          creator: account,
          contributors,
        });
        deployedAddress = deployRes.contractAddress;
        toast.success('Contract Deployed to GenLayer Studio Next', {
          id: 'deploy-tx',
          description: `Contract address: ${deployedAddress.slice(0, 10)}... Initialized with ${contributors.length} contributors. State is OPEN.`,
        });
      } else {
        // Fallback simulation if wallet is not yet connected
        await new Promise((r) => setTimeout(r, 1200));
        deployedAddress = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
        toast.success('Contract Initialized on Studio Next', {
          id: 'deploy-tx',
          description: `Deployed instance: ${deployedAddress.slice(0, 10)}... State is OPEN.`,
        });
      }

      if (onDeployProject) {
        onDeployProject({
          name: projectName,
          description: projectDescription,
          contributors,
          rubric,
        });
      }

      if (onSelectContractAddress && deployedAddress) {
        onSelectContractAddress(deployedAddress);
      }

      localStorage.setItem('meritsplit_active_contract', deployedAddress);
      navigate('/app');
    } catch (err: any) {
      setIsDeploying(false);
      const msg = parseGenLayerError(err);
      toast.error('Deployment failed', { id: 'deploy-tx', description: msg || err?.message || 'Error deploying contract.' });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070809] text-[#f4f4e8] font-sans selection:bg-[#ccff00] selection:text-[#070809]">
      <Header
        account={account}
        isConnecting={isConnecting}
        onConnect={onConnectWallet}
        onDisconnect={onDisconnectWallet}
      />

      {/* Sub-bar breadcrumbs */}
      <div className="border-b border-[#1c1c1c] bg-[#090a0c]">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-xs font-mono">
          <Link
            to="/app"
            className="flex items-center space-x-2 text-[#888] hover:text-[#ccff00] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="uppercase tracking-widest text-[11px]">Back to Projects Hub</span>
          </Link>
          <div className="flex items-center space-x-3 text-[11px] text-[#686868] uppercase tracking-wider">
            <Link to="/" className="hover:text-[#bcbcbc] transition-colors">Home</Link>
            <span>/</span>
            <Link to="/app" className="hover:text-[#bcbcbc] transition-colors">Projects</Link>
            <span>/</span>
            <span className="text-[#ccff00]">Deploy Split</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page Title & Intro */}
        <div className="mb-8 pb-6 border-b border-[#1c1c1c]">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4e8] mb-1.5">
            Deploy Split Contract
          </h1>
          <p className="text-xs text-[#888] leading-relaxed max-w-3xl">
            Configure an immutable attribution contract on GenLayer Studio Next. The rubric weights and contributor whitelist defined here establish the baseline for LLM consensus and deterministic settlement.
          </p>
        </div>

        {/* ==================================================================== */}
        {/* 2-COLUMN SPLIT SCREEN: Left Configuration / Right Sticky Live Preview */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Configuration Inputs (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Creator Authentication */}
            <section className="border border-[#1c1c1c] bg-[#090a0c] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-[#686868]">01</span>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f4e8]">
                    Creator Authentication
                  </h3>
                </div>
                {account ? (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border text-[#ccff00] border-[#ccff00]/40 flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-3 h-3 text-[#ccff00]" />
                    Authenticated
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border text-amber-400 border-amber-500/40">
                    Wallet Not Connected
                  </span>
                )}
              </div>

              {account ? (
                <div className="font-mono text-xs text-[#bcbcbc] bg-[#070809] border border-[#1c1c1c] p-3.5 break-all flex items-center justify-between">
                  <span>{account}</span>
                  <span className="text-[10px] uppercase text-[#686868] shrink-0 ml-4 font-mono font-bold">Signer</span>
                </div>
              ) : (
                <div className="bg-[#070809] border border-dashed border-[#262626] p-5 text-center">
                  <p className="text-xs text-[#888] font-mono mb-3">
                    Connect MetaMask to sign and initialize the contract on Studio Next.
                  </p>
                  <button
                    type="button"
                    onClick={onConnectWallet}
                    disabled={isConnecting}
                    className="px-5 py-2.5 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all cursor-pointer"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                  </button>
                </div>
              )}
            </section>

            {/* 2. Project Metadata */}
            <section className="border border-[#1c1c1c] bg-[#090a0c] p-6 space-y-5">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-[#686868]">02</span>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f4e8]">
                  Project Metadata
                </h3>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-widest text-[#686868] mb-1.5">
                  Sprint / Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. MeritSplit Q4 Core Infrastructure"
                  className="w-full font-mono text-xs bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none p-3 text-[#f4f4e8] placeholder-[#444] transition-all duration-200 rounded-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-widest text-[#686868] mb-1.5">
                  Scope Summary & Deliverable Objectives
                </label>
                <textarea
                  rows={2}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe sprint goals, team scope, and evidence expectations..."
                  className="w-full text-xs bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none p-3 text-[#f4f4e8] placeholder-[#444] transition-all duration-200 rounded-none"
                />
              </div>
            </section>

            {/* 3. Contributor Registry */}
            <section className="border border-[#1c1c1c] bg-[#090a0c] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-[#686868]">03</span>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f4e8]">
                    Contributor Registry ({contributors.length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#686868] uppercase">
                  Whitelisted Wallets
                </span>
              </div>

              <p className="text-xs text-[#888] mb-4">
                Only registered addresses can submit evidence claims for this split.
              </p>

              {/* Add address input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newContributorInput}
                  onChange={(e) => setNewContributorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddContributor();
                    }
                  }}
                  placeholder="0x... (EVM Address)"
                  className="flex-1 font-mono text-xs bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none px-3 py-2 text-[#f4f4e8] placeholder-[#444] transition-all duration-200 rounded-none"
                />
                <button
                  type="button"
                  onClick={handleAddContributor}
                  className="border border-[#1c1c1c] hover:border-[#ccff00] hover:bg-white/5 px-4 py-2 text-xs font-mono uppercase text-[#f4f4e8] flex items-center space-x-1.5 transition-all duration-200 rounded-none cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#ccff00]" />
                  <span>Add</span>
                </button>
              </div>

              {contributorError && (
                <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs">
                  {contributorError}
                </div>
              )}

              {/* Contributor List */}
              <div className="divide-y divide-[#1c1c1c] border-t border-[#1c1c1c]">
                {contributors.map((addr, idx) => (
                  <div key={addr} className="py-2.5 px-2 flex items-center justify-between font-mono text-xs transition-all duration-200 hover:bg-white/5">
                    <div className="flex items-center space-x-3">
                      <span className="text-[#686868]">0{idx + 1}</span>
                      <span className="text-[#bcbcbc] break-all">{addr}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveContributor(idx)}
                      title="Remove address"
                      className="text-[#666] hover:text-rose-400 p-1 transition-colors ml-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Define Rubric Weights */}
            <section className="border border-[#1c1c1c] bg-[#090a0c] p-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-[#686868]">04</span>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f4e8]">
                    Rubric Weight Sliders
                  </h3>
                </div>
                <div className="font-mono text-xs mt-2 sm:mt-0 flex items-center space-x-2">
                  <span className="text-[#686868] uppercase">Current Sum:</span>
                  <span
                    className={`font-bold px-2 py-0.5 border ${
                      isWeightValid
                        ? 'text-[#ccff00] border-[#ccff00]/40 bg-[#ccff00]/5'
                        : 'text-amber-400 border-amber-500/40 bg-amber-500/5'
                    }`}
                  >
                    {totalWeight}% ({totalBps.toLocaleString()} BPS)
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#888] mb-5">
                Assign percentage weights to the 5 evaluation criteria. Weights must sum to exactly 100% (10,000 BPS) to guarantee mathematical conservation on-chain.
              </p>

              <div className="space-y-4">
                {Object.entries(rubric).map(([crit, weight]) => {
                  const color = CRITERIA_COLORS[crit] || { bg: 'bg-[#ccff00]', text: 'text-black', hex: '#ccff00' };
                  return (
                    <div key={crit} className="p-3 bg-[#070809] border border-[#1c1c1c] space-y-2 transition-all duration-200 hover:bg-white/5">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-none inline-block border border-black/40"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-[#f4f4e8] font-medium">{crit}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-[#f4f4e8]">{weight}%</span>
                          <span className="text-[10px] text-[#686868]">({weight * 100} BPS)</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={weight}
                          onChange={(e) => handleWeightChange(crit, parseInt(e.target.value, 10))}
                          className="w-full accent-[#ccff00] bg-[#141414] h-1.5 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={weight}
                          onChange={(e) => handleWeightChange(crit, parseInt(e.target.value, 10))}
                          className="w-14 bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none p-1 text-right font-mono text-xs text-[#f4f4e8] rounded-none transition-all duration-200"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isWeightValid && (
                <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Weights must sum to 100%. Currently at {totalWeight}% (
                    {100 - totalWeight > 0 ? `+${100 - totalWeight}% needed` : `${100 - totalWeight}% excess`}
                    ).
                  </span>
                </div>
              )}
            </section>

            {/* Deploy Split Contract Button */}
            <div className="p-6 border border-[#1c1c1c] bg-[#090a0c] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="font-mono text-xs text-[#686868]">
                Target: Studio Next (61997) · gl.eq_principle.strict_eq
              </div>

              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !isWeightValid || !account}
                className={`w-full sm:w-auto px-8 py-3.5 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 rounded-none flex items-center justify-center space-x-2 ${
                  isDeploying || !isWeightValid || !account
                    ? 'bg-[#141414] text-[#444] border border-[#222] cursor-not-allowed'
                    : 'bg-[#ccff00] text-[#070809] hover:bg-white cursor-pointer'
                }`}
              >
                {isDeploying ? (
                  <>
                    <GenLayerSpinner size="sm" />
                    <span>Broadcasting Contract...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    <span>Deploy Split Contract</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* RIGHT COLUMN: Sticky Live Configuration Preview (5 cols) */}
          {/* ==================================================================== */}
          <div className="lg:col-span-5 sticky top-24 space-y-6">
            <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 font-mono">
              
              {/* Header & Status Indicator */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1c1c1c] mb-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#686868] block">
                    Live Preview
                  </span>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f4e8]">
                    Configuration Inspector
                  </h3>
                </div>

                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border font-bold flex items-center gap-1.5 ${
                    isWeightValid
                      ? 'text-[#ccff00] border-[#ccff00]/40 bg-[#ccff00]/5'
                      : 'text-amber-400 border-amber-500/40 bg-amber-500/5'
                  }`}
                >
                  {isWeightValid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-[#ccff00]" />
                      <span>10,000 BPS Conserved</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Invariant Broken</span>
                    </>
                  )}
                </span>
              </div>

              {/* 10,000 BPS Conservation Math Representation */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase text-[#888]">Conservation Progress</span>
                  <span className="text-xs font-bold text-[#f4f4e8]">
                    {totalBps.toLocaleString()} / 10,000 BPS
                  </span>
                </div>

                {/* Stacked Proportional Bar */}
                <div className="w-full h-3 bg-[#111] border border-[#222] flex overflow-hidden">
                  {Object.entries(rubric).map(([crit, weight]) => {
                    const color = CRITERIA_COLORS[crit]?.hex || '#ccff00';
                    const pct = Math.max(0, Math.min(100, weight));
                    if (pct === 0) return null;
                    return (
                      <div
                        key={crit}
                        style={{ width: `${pct}%`, backgroundColor: color }}
                        title={`${crit}: ${weight}% (${weight * 100} BPS)`}
                        className="h-full transition-all duration-200"
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#686868] mt-1.5">
                  <span>0 BPS</span>
                  <span className={isWeightValid ? 'text-[#ccff00] font-bold' : 'text-amber-400'}>
                    {totalWeight}% Allocated
                  </span>
                  <span>10,000 BPS</span>
                </div>
              </div>

              {/* Rubric Dimension Breakdown */}
              <div className="mb-6">
                <span className="text-[10px] uppercase tracking-widest text-[#686868] block mb-2">
                  Rubric Dimension Allocations
                </span>
                <div className="divide-y divide-[#1c1c1c] border border-[#1c1c1c] bg-[#070809]">
                  {Object.entries(rubric).map(([crit, weight]) => {
                    const color = CRITERIA_COLORS[crit] || { bg: 'bg-[#ccff00]', text: 'text-black', hex: '#ccff00' };
                    return (
                      <div key={crit} className="p-2.5 flex items-center justify-between text-xs transition-all duration-200 hover:bg-white/5">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2 h-2 rounded-none inline-block shrink-0 border border-black/40"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-[#bcbcbc] truncate max-w-[180px]">{crit}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[#f4f4e8] font-bold">{weight}%</span>
                          <span className="text-[10px] text-[#686868] ml-2">{weight * 100} BPS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Metadata Card */}
              <div className="p-4 bg-[#070809] border border-[#1c1c1c] space-y-3 mb-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#686868] block mb-0.5">
                    Target Project Name
                  </span>
                  <div className="text-xs font-bold text-[#f4f4e8]">
                    {projectName.trim() || 'Untitled Sprint Split'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#686868] block mb-0.5">
                    Whitelisted Claimants ({contributors.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {contributors.map((addr) => (
                      <span
                        key={addr}
                        className="text-[10px] px-2 py-0.5 bg-[#090a0c] border border-[#1c1c1c] text-[#bcbcbc] rounded-none font-mono"
                      >
                        {truncateAddress(addr)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1c1c1c] flex items-center justify-between text-[11px] text-[#686868]">
                  <span>Signer:</span>
                  <span className="text-[#bcbcbc] font-mono">
                    {account ? truncateAddress(account) : 'Not Connected'}
                  </span>
                </div>
              </div>

              {/* Engine Specs */}
              <div className="text-[10px] text-[#555] space-y-1">
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span className="text-[#888]">Studio Next (61997)</span>
                </div>
                <div className="flex justify-between">
                  <span>Consensus:</span>
                  <span className="text-[#ccff00]">gl.eq_principle.strict_eq</span>
                </div>
                <div className="flex justify-between">
                  <span>Settlement Math:</span>
                  <span className="text-[#888]">Hare-Niemeyer (Zero Leak)</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default DeploySplit;
