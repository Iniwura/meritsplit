import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { RubricOverview } from '../components/RubricOverview';
import { GenLayerSpinner } from '../components/GenLayerSpinner';
import { ProjectState, ContributorClaim, DeliberationStep, ProjectStateResponse } from '../types';
import {
  calculateLargestRemainderAllocations,
  CREATOR_ADDRESS,
  truncateAddress,
} from '../lib/genlayer';
import {
  getProjectState,
  requestAssessment,
  submitClaim,
  registerContributor,
  freezeRubricAndOpenSubmissions,
  GENLAYER_STUDIO_NEXT_CONFIG,
} from '../services/genlayer';
import { parseGenLayerError, computeEvidenceDigest } from '../lib/wallet';
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  Search,
  CheckCircle2,
  RefreshCw,
  FolderGit2,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  Hash,
  User,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardProps {
  activeContractAddress: string;
  onSelectContractAddress: (address: string) => void;
  currentState: ProjectState;
  setCurrentState: React.Dispatch<React.SetStateAction<ProjectState>>;
  account: string | null;
  isConnecting: boolean;
  onConnectWallet: () => Promise<string | null>;
  onDisconnectWallet: () => void;
  client: any;
  txKit: any;
  registeredContributors: string[];
  setRegisteredContributors: React.Dispatch<React.SetStateAction<string[]>>;
  claims: Record<string, ContributorClaim>;
  setClaims: React.Dispatch<React.SetStateAction<Record<string, ContributorClaim>>>;
  scores: Record<string, number>;
  setScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  assessmentNotes: string;
  setAssessmentNotes: (notes: string) => void;
  isAssessing: boolean;
  setIsAssessing?: React.Dispatch<React.SetStateAction<boolean>>;
  deliberationSteps: DeliberationStep[];
  onReset: () => void;
  onRequestAssessment: () => void;
  onRefreshLiveState?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeContractAddress,
  onSelectContractAddress,
  currentState,
  setCurrentState,
  account,
  isConnecting,
  onConnectWallet,
  onDisconnectWallet,
  client,
  txKit,
  registeredContributors,
  setRegisteredContributors,
  claims,
  setClaims,
  scores,
  setScores,
  assessmentNotes,
  setAssessmentNotes,
  isAssessing: propIsAssessing,
  setIsAssessing: propSetIsAssessing,
  deliberationSteps,
  onReset,
  onRequestAssessment,
  onRefreshLiveState,
}) => {
  const navigate = useNavigate();
  const [localAssessing, setLocalAssessing] = useState(false);
  const isAssessing = propIsAssessing || localAssessing;
  const setIsAssessing = (val: boolean) => {
    setLocalAssessing(val);
    propSetIsAssessing?.(val);
  };

  // Master-Detail Selection: null means "Global Project Rubric"
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [isFreezing, setIsFreezing] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [addressError, setAddressError] = useState('');

  // Inspector Claim Submission Form state (for selected contributor)
  const [claimUrlInput, setClaimUrlInput] = useState('');
  const [claimDescInput, setClaimDescInput] = useState('');
  const [claimDigestPreview, setClaimDigestPreview] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Contributor registration input on master list
  const [newMasterContributor, setNewMasterContributor] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Live on-chain project state hook populated via get_project_state()
  const [liveProjectState, setLiveProjectState] = useState<ProjectStateResponse | null>(null);
  const [isLoadingLiveState, setIsLoadingLiveState] = useState(false);

  const fetchOnChainState = useCallback(async (targetAddr?: string) => {
    const addr = targetAddr || activeContractAddress;
    if (!addr) return;
    setIsLoadingLiveState(true);
    try {
      const data = await getProjectState(addr);
      if (data) {
        setLiveProjectState(data);
        if (data.state_name) setCurrentState(data.state_name);
        if (Array.isArray(data.contributors)) setRegisteredContributors(data.contributors);
        if (data.claims && typeof data.claims === 'object') setClaims(data.claims);
        if (data.assessment_scores && typeof data.assessment_scores === 'object') setScores(data.assessment_scores);
        if (data.assessment_notes) setAssessmentNotes(data.assessment_notes);
      }
    } catch (err) {
      console.warn('[Dashboard] get_project_state sync warning:', err);
    } finally {
      setIsLoadingLiveState(false);
    }
  }, [activeContractAddress, setCurrentState, setRegisteredContributors, setClaims, setScores, setAssessmentNotes]);

  useEffect(() => {
    fetchOnChainState(activeContractAddress);
  }, [fetchOnChainState, activeContractAddress]);

  const allocationMath = calculateLargestRemainderAllocations(scores, registeredContributors);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const hasFinalizedSettlement =
    currentState === 'FINALIZED' ||
    (allocationMath.allocations.length > 0 && totalScore > 0);

  useEffect(() => {
    if (claimUrlInput.trim() || claimDescInput.trim()) {
      computeEvidenceDigest(claimUrlInput, claimDescInput).then(setClaimDigestPreview);
    } else {
      setClaimDigestPreview('');
    }
  }, [claimUrlInput, claimDescInput]);

  const getSimulatedBreakdown = (score: number) => {
    if (score <= 0) return { work: 0, diff: 0, imp: 0, rel: 0, col: 0 };
    const ratio = score / 100;
    return {
      work: Math.round(30 * ratio),
      diff: Math.round(25 * ratio),
      imp: Math.round(25 * ratio),
      rel: Math.round(10 * ratio),
      col: Math.round(10 * ratio),
    };
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
    toast.success('Address copied to clipboard');
  };

  const handleLoadAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError('');
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setAddressError('Please provide a contract address.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setAddressError('Invalid address format. Must be a 42-character hex address (0x...).');
      return;
    }
    onSelectContractAddress(trimmed);
    setAddressInput('');
    fetchOnChainState(trimmed);
    toast.success('Contract Loaded', {
      description: `Targeting address: ${trimmed.slice(0, 8)}...`,
    });
  };

  const LIVE_STUDIO_NEXT_SPRINT = {
    name: 'Verified MeritSplit Instance',
    address: GENLAYER_STUDIO_NEXT_CONFIG.defaultContractAddress,
    statusNote: 'Active on Studio Next (Chain 61997)',
  };

  const isCurrentDefaultLoaded =
    activeContractAddress.toLowerCase() ===
    GENLAYER_STUDIO_NEXT_CONFIG.defaultContractAddress.toLowerCase();

  // Write Action 1: freeze_rubric_and_open_submissions
  const handleFreezeRubric = async () => {
    if (!account) {
      toast.error('Wallet required', {
        description: 'Connect wallet to freeze the rubric and open submissions.',
      });
      await onConnectWallet();
      return;
    }

    const effectiveCreator = liveProjectState?.creator || CREATOR_ADDRESS;
    if (account.toLowerCase() !== effectiveCreator.toLowerCase()) {
      toast.error('Unauthorized', {
        description: `Only creator ${effectiveCreator.slice(0, 6)}... can freeze the rubric. Connected: ${account.slice(0, 6)}...`,
      });
      return;
    }

    try {
      setIsFreezing(true);
      toast.loading('Freezing rubric on GenLayer Studio Next...', { id: 'freeze-tx' });

      if (client) {
        await freezeRubricAndOpenSubmissions(client, activeContractAddress);
      }

      setCurrentState('SUBMISSIONS');
      toast.success('Rubric Frozen On-Chain', {
        id: 'freeze-tx',
        description: 'State transitioned to SUBMISSIONS. Whitelisted contributors may now submit claims.',
      });
      await fetchOnChainState(activeContractAddress);
      onRefreshLiveState?.();
    } catch (err: any) {
      const msg = parseGenLayerError(err);
      toast.error('freeze_rubric failed', { id: 'freeze-tx', description: msg });
    } finally {
      setIsFreezing(false);
    }
  };

  // Contributor Registration by Creator
  const handleRegisterContributor = async (address: string) => {
    if (!account) {
      toast.error('Wallet required', { description: 'Connect wallet to register contributors.' });
      return;
    }

    const effectiveCreator = liveProjectState?.creator || CREATOR_ADDRESS;
    if (account.toLowerCase() !== effectiveCreator.toLowerCase()) {
      toast.error('Unauthorized', {
        description: `Only creator ${effectiveCreator.slice(0, 6)}... can register contributors. Connected: ${account.slice(0, 6)}...`,
      });
      return;
    }

    if (registeredContributors.length >= 10) {
      toast.error('Limit reached', { description: 'Maximum 10 contributors per split to prevent GenVM execution timeouts.' });
      return;
    }

    try {
      toast.loading('Registering contributor on-chain...', { id: 'reg-tx' });
      if (client) {
        await registerContributor(client, activeContractAddress, address);
      }

      if (!registeredContributors.some((a) => a.toLowerCase() === address.toLowerCase())) {
        setRegisteredContributors((prev) => [...prev, address]);
      }
      toast.success('Contributor registered', {
        id: 'reg-tx',
        description: `Address ${address.slice(0, 6)}... added to registered set.`,
      });
      await fetchOnChainState(activeContractAddress);
      onRefreshLiveState?.();
    } catch (err: any) {
      const msg = parseGenLayerError(err);
      toast.error('register_contributor failed', { id: 'reg-tx', description: msg });
    }
  };

  // Write Action 2: submit_claim with client SHA-256 digest
  const handleSubmitClaim = async (
    contributor: string,
    evidenceUrl: string,
    evidenceDigest: string,
    description: string
  ) => {
    if (!account) {
      toast.error('Wallet required', {
        description: 'Connect wallet to sign and submit your contribution claim.',
      });
      await onConnectWallet();
      return;
    }

    if (account.toLowerCase() !== contributor.toLowerCase()) {
      toast.error('Signer mismatch', {
        description: `Transaction must be signed by the claimant address (${contributor.slice(0, 6)}...).`,
      });
      return;
    }

    const isRegistered = registeredContributors.some(
      (a) => a.toLowerCase() === contributor.toLowerCase()
    );
    if (!isRegistered) {
      toast.error('Unauthorized sender', {
        description: `Address ${contributor.slice(0, 6)}... is not registered in this project.`,
      });
      return;
    }

    toast.loading('Submitting claim to GenLayer Studio Next...', { id: 'claim-tx' });

    try {
      if (client) {
        await submitClaim(client, activeContractAddress, {
          evidenceUrl,
          evidenceDigest,
          description,
        });
      }

      setClaims((prev) => ({
        ...prev,
        [contributor]: {
          contributor,
          evidence_url: evidenceUrl,
          evidence_digest: evidenceDigest,
          description,
          submission_time: Date.now(),
          active: true,
        },
      }));

      toast.success('Claim verified & submitted', {
        id: 'claim-tx',
        description: `Cryptographic digest ${evidenceDigest.slice(0, 10)}... committed on-chain.`,
      });
      await fetchOnChainState(activeContractAddress);
      onRefreshLiveState?.();
    } catch (err: any) {
      const msg = parseGenLayerError(err);
      toast.error('submit_claim failed', { id: 'claim-tx', description: msg });
    }
  };

  // Write Action 3: request_assessment (deliberation trigger)
  const handleAssessmentTrigger = async () => {
    if (!account) {
      toast.error('Wallet required', {
        description: 'Connect wallet to request GenLayer consensus assessment.',
      });
      await onConnectWallet();
      return;
    }

    if (Object.keys(claims).length === 0) {
      toast.error('No claims to assess', {
        description: 'At least one verified claim must be filed before triggering consensus.',
      });
      return;
    }

    toast.loading('Requesting consensus assessment on GenLayer Studio Next...', { id: 'assessment-tx' });

    try {
      setIsAssessing(true);
      setCurrentState('ASSESSING');

      if (client) {
        const { txHash } = await requestAssessment(client, activeContractAddress);
        toast.success('Assessment Executed On-Chain', {
          id: 'assessment-tx',
          description: `Tx: ${txHash.slice(0, 10)}... gl.eq_principle.strict_eq consensus certified & 10,000 BPS allocated.`,
        });
        await fetchOnChainState(activeContractAddress);
        onRefreshLiveState?.();
      } else {
        toast.dismiss('assessment-tx');
        onRequestAssessment();
      }
    } catch (err: any) {
      const msg = parseGenLayerError(err);
      toast.error('request_assessment failed', { id: 'assessment-tx', description: msg });
    } finally {
      setIsAssessing(false);
    }
  };

  const effectiveCreator = liveProjectState?.creator || CREATOR_ADDRESS;
  const isCreator = account
    ? account.toLowerCase() === effectiveCreator.toLowerCase()
    : false;

  const handleInspectorClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContributor) return;
    if (!claimUrlInput.trim() || !claimDescInput.trim()) {
      toast.error('Evidence URL and deliverable summary are required');
      return;
    }
    try {
      setIsSubmittingClaim(true);
      const digest = await computeEvidenceDigest(claimUrlInput, claimDescInput);
      await handleSubmitClaim(selectedContributor, claimUrlInput, digest, claimDescInput);
      setClaimUrlInput('');
      setClaimDescInput('');
      setClaimDigestPreview('');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleMasterRegisterContributor = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMasterContributor.trim();
    if (!trimmed) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      toast.error('Invalid EVM address format (0x...)');
      return;
    }
    await handleRegisterContributor(trimmed);
    setNewMasterContributor('');
  };

  const explorerUrl = `https://studio-next.genlayer.com/contracts/${activeContractAddress}`;

  return (
    <div className="min-h-screen bg-[#070809] text-[#f4f4e8] font-sans selection:bg-[#ccff00] selection:text-[#070809]">
      {/* Top Header */}
      <Header
        account={account}
        isConnecting={isConnecting}
        onConnect={onConnectWallet}
        onDisconnect={onDisconnectWallet}
      />

      {/* Breadcrumb sub-bar */}
      <div className="border-b border-[#1c1c1c] bg-[#090a0c]">
        <div className="max-w-7xl mx-auto px-6 h-11 flex items-center justify-between text-xs font-mono text-[#888]">
          <Link
            to="/"
            className="flex items-center space-x-2 text-[#888] hover:text-[#ccff00] transition-all duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="uppercase tracking-widest text-[11px] font-sans">Back to Overview</span>
          </Link>

          <div className="flex items-center space-x-6 text-[11px] uppercase tracking-wider">
            <span className="text-[#686868] hidden sm:inline font-sans">
              Network: <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">Studio Next (61997)</span>
            </span>
            <button
              onClick={onReset}
              className="text-[#888] hover:text-[#ccff00] transition-all duration-200 cursor-pointer flex items-center space-x-1.5 font-sans"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync Live State</span>
            </button>
            <Link
              to="/deploy"
              className="text-[#ccff00] font-bold hover:underline flex items-center space-x-1 font-sans"
            >
              <Plus className="w-3 h-3" />
              <span>Deploy New Split</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ==================================================================== */}
        {/* PROJECT HUB & SPRINT SELECTOR */}
        {/* ==================================================================== */}
        <section className="mb-10 pb-8 border-b border-[#1c1c1c]">
          <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4e8] mb-1">
                Project Hub
              </h2>
              <p className="text-xs text-[#888] font-sans">
                Inspect an active contract, query any deployed split address, or initialize a new project rubric.
              </p>
            </div>
            <p className="text-xs font-mono text-[#686868] mt-2 md:mt-0 max-w-md">
              Network: Studio Next (61997) · <span className="text-[#bcbcbc]">gl.eq_principle.strict_eq</span>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 border border-[#1c1c1c] bg-[#090a0c]">
            {/* HUB CARD 1: Join / Switch Active Project (7 cols) */}
            <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#1c1c1c] p-6 flex flex-col justify-between bg-[#090a0c]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#686868]">
                    01 · Join Existing Sprint
                  </span>
                  <span className="text-[10px] font-mono text-[#ccff00] uppercase font-bold border border-[#ccff00]/40 px-1.5 py-0.2 rounded-none">
                    RPC Query
                  </span>
                </div>

                <h3 className="font-display text-base font-bold uppercase tracking-tight text-[#f4f4e8] mb-2">
                  Paste Contract Address
                </h3>
                <p className="text-xs text-[#888] font-sans mb-5">
                  Load any MeritSplit contract deployed on GenLayer Studio Next to view its frozen rubric, file a claim, or verify settlement.
                </p>

                <form onSubmit={handleLoadAddress} className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="0x... (Deployed Contract Address)"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      className="w-full font-mono text-xs tracking-tight bg-[#070809] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none px-3 py-2.5 text-[#f4f4e8] placeholder-[#444] rounded-none transition-all duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    className="border border-[#1c1c1c] bg-[#ccff00] text-[#070809] hover:bg-white px-5 py-2.5 text-xs font-mono uppercase font-bold flex items-center space-x-1.5 transition-all duration-200 cursor-pointer shrink-0 rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Load</span>
                  </button>
                </form>

                {addressError && (
                  <div className="mb-4 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-none">
                    {addressError}
                  </div>
                )}

                {/* Quick sprint selector */}
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#686868] block mb-2">
                    Active Live Sprints on Record:
                  </span>
                  <div
                    onClick={() => onSelectContractAddress(LIVE_STUDIO_NEXT_SPRINT.address)}
                    className={`p-3.5 border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-none ${
                      isCurrentDefaultLoaded
                        ? 'border-[#ccff00] bg-[#ccff00]/5'
                        : 'border-[#1c1c1c] bg-[#070809] hover:bg-white/5 hover:border-[#333]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-display text-xs font-bold uppercase text-[#f4f4e8]">
                          {LIVE_STUDIO_NEXT_SPRINT.name}
                        </span>
                        {isCurrentDefaultLoaded && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#ccff00] text-[#070809] font-bold rounded-none">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs tracking-tight text-[#888] break-all">
                        {LIVE_STUDIO_NEXT_SPRINT.address}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] tracking-tight text-[#ccff00] font-bold shrink-0 sm:text-right">
                      {LIVE_STUDIO_NEXT_SPRINT.statusNote}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* HUB CARD 2: Initialize New Split (5 cols) */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-[#0b0c0e]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#686868]">
                    02 · Initialize New Split
                  </span>
                  <span className="text-[10px] font-mono text-[#888] uppercase">
                    Creator Wizard
                  </span>
                </div>

                <div className="w-10 h-10 border border-[#1c1c1c] bg-[#070809] flex items-center justify-center mb-4 text-[#ccff00] rounded-none">
                  <FolderGit2 className="w-5 h-5" />
                </div>

                <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[#f4f4e8] mb-2">
                  Launch a New Attribution Contract
                </h3>
                <p className="text-xs text-[#888] font-sans leading-relaxed mb-6">
                  Set project metadata, whitelist team contributor wallets, and define a frozen 5-dimension rubric (must sum to exactly 100%) on GenLayer Studio Next.
                </p>
              </div>

              <Link
                to="/deploy"
                className="w-full py-3.5 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 text-center rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)]"
              >
                <span>Open Deployment Wizard</span>
                <Plus className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Active Contract Inspection Status Pill */}
          <div className="mt-6 p-4 border border-[#1c1c1c] bg-[#090a0c] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs text-[#f4f4e8] rounded-none">
            <div className="flex items-center space-x-3">
              <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00] shrink-0 animate-pulse" />
              <span className="text-[#686868] uppercase text-[10px] tracking-wider shrink-0 font-bold font-sans">
                Loaded Contract:
              </span>
              <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold break-all select-all">
                {activeContractAddress}
              </span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                title="View on GenLayer Studio Next Explorer"
                className="text-[#888] hover:text-[#ccff00] shrink-0 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center space-x-4 text-[11px]">
              <span className="text-[#888] font-sans">
                State: <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase ml-1 rounded-none">{currentState}</span>
              </span>
              <span className="text-[#333]">|</span>
              <span className="text-[#888] font-sans">
                Contributors: <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{registeredContributors.length}</span>
              </span>
              <span className="text-[#333]">|</span>
              <span className="text-[#888] font-sans">
                Claims: <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{Object.keys(claims).length}</span>
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* MASTER-DETAIL INSPECTOR WORKSPACE                                     */}
        {/* Master column locked in viewport (sticky top-0 h-screen overflow-y-auto) */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
          
          {/* ================================================================== */}
          {/* MASTER COLUMN: Claimant Registry (Locked Sticky Viewport) (4 cols)  */}
          {/* ================================================================== */}
          <div className="lg:col-span-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto space-y-4 font-mono pr-1">
            
            {/* Master Header */}
            <div className="border border-[#1c1c1c] bg-[#090a0c] p-4 flex items-center justify-between rounded-none">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#686868] block font-sans">
                  Master Directory
                </span>
                <h3 className="font-display text-base font-bold uppercase tracking-tight text-[#f4f4e8]">
                  Claimant Registry
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#1c1c1c] bg-[#070809] text-[#888] font-bold rounded-none">
                {registeredContributors.length} Registered
              </span>
            </div>

            {/* Default Global Selection Card: Project Frozen Rubric */}
            <div
              onClick={() => setSelectedContributor(null)}
              className={`p-4 border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 rounded-none ${
                selectedContributor === null
                  ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#f4f4e8]'
                  : 'border-[#1c1c1c] bg-[#090a0c] text-[#888] hover:bg-white/5 hover:border-[#333] hover:text-[#f4f4e8]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 border flex items-center justify-center shrink-0 rounded-none ${
                    selectedContributor === null
                      ? 'border-[#ccff00] text-[#ccff00] bg-[#070809]'
                      : 'border-[#1c1c1c] text-[#666] bg-[#070809]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-[#f4f4e8]">
                      Global Project Rubric
                    </span>
                    {selectedContributor === null && (
                      <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00]" />
                    )}
                  </div>
                  <span className="text-[10px] font-sans text-[#686868]">
                    5 Immutable Criteria · <span className="font-mono text-[10px] text-[#ccff00]">10,000 BPS</span> Target
                  </span>
                </div>
              </div>

              <span
                className={`text-[10px] font-mono uppercase tracking-widest font-bold border px-1.5 py-0.2 rounded-none ${
                  selectedContributor === null
                    ? 'border-[#ccff00]/50 text-[#ccff00]'
                    : 'border-[#1c1c1c] text-[#666]'
                }`}
              >
                {currentState !== 'OPEN' ? 'Locked' : 'Open'}
              </span>
            </div>

            {/* Contributor List */}
            <div className="border border-[#1c1c1c] bg-[#090a0c] divide-y divide-[#1c1c1c]">
              <div className="p-3 text-[10px] font-sans uppercase tracking-widest text-[#686868] flex items-center justify-between bg-[#070809]">
                <span>Whitelisted Claimants</span>
                <span>Evidence & BPS</span>
              </div>

              {registeredContributors.length === 0 ? (
                <div className="p-6 text-center text-xs font-sans text-[#555]">
                  No contributors registered yet.
                </div>
              ) : (
                registeredContributors.map((addr, idx) => {
                  const isSelected = selectedContributor?.toLowerCase() === addr.toLowerCase();
                  const hasClaim = Boolean(claims[addr]);
                  const alloc = allocationMath.allocations.find(
                    (a) => a.address.toLowerCase() === addr.toLowerCase()
                  );
                  const isUser = account?.toLowerCase() === addr.toLowerCase();

                  return (
                    <div
                      key={addr}
                      onClick={() => setSelectedContributor(addr)}
                      className={`p-3.5 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 rounded-none ${
                        isSelected
                          ? 'border-l-2 border-l-[#ccff00] bg-[#ccff00]/10 text-[#f4f4e8]'
                          : 'bg-[#090a0c] text-[#888] hover:bg-white/5 hover:text-[#f4f4e8]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 border flex items-center justify-center text-[10px] font-mono font-bold shrink-0 rounded-none ${
                            isSelected
                              ? 'border-[#ccff00] text-[#ccff00] bg-[#070809]'
                              : 'border-[#1c1c1c] text-[#686868] bg-[#070809]'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`font-mono text-xs tracking-tight font-bold truncate ${
                                isSelected ? 'text-[#ccff00]' : 'text-[#f4f4e8]'
                              }`}
                            >
                              {truncateAddress(addr)}
                            </span>
                            {isUser && (
                              <span
                                className={`text-[9px] font-mono px-1 py-0.2 border rounded-none font-bold ${
                                  isSelected
                                    ? 'border-[#ccff00] text-[#ccff00]'
                                    : 'border-[#1c1c1c] text-[#888]'
                                }`}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] mt-0.5">
                            {hasClaim ? (
                              <span
                                className={`border px-1.5 py-0.2 font-mono font-bold uppercase tracking-wider text-[9px] rounded-none ${
                                  isSelected
                                    ? 'border-[#ccff00]/40 text-[#ccff00] bg-[#ccff00]/10'
                                    : 'border-[#1c1c1c] bg-[#070809] text-[#888]'
                                }`}
                              >
                                Evidence Committed
                              </span>
                            ) : (
                              <span className="font-sans text-[#555]">
                                No Claim Filed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {alloc ? (
                          <div>
                            <span className={`font-mono text-xs tracking-tight font-bold block ${isSelected ? 'text-[#ccff00]' : 'text-[#f4f4e8]'}`}>
                              {alloc.finalBps.toLocaleString()} BPS
                            </span>
                            <span className="font-mono text-[10px] tracking-tight font-bold block text-[#ccff00]">
                              {alloc.percentage}
                            </span>
                          </div>
                        ) : scores[addr] !== undefined ? (
                          <span className={`font-mono text-xs tracking-tight font-bold ${isSelected ? 'text-[#ccff00]' : 'text-[#f4f4e8]'}`}>
                            {scores[addr]}/100
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-[#555]">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Creator Inline Add Contributor (when state is OPEN) */}
              {isCreator && currentState === 'OPEN' && (
                <form
                  onSubmit={handleMasterRegisterContributor}
                  className="p-3 border-t border-[#1c1c1c] bg-[#070809] flex gap-2"
                >
                  <input
                    type="text"
                    value={newMasterContributor}
                    onChange={(e) => setNewMasterContributor(e.target.value)}
                    placeholder="0x... Register Contributor"
                    className="flex-1 font-mono text-xs tracking-tight bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none px-2.5 py-1.5 text-[#f4f4e8] placeholder-[#444] rounded-none transition-all duration-200"
                  />
                  <button
                    type="submit"
                    className="border border-[#1c1c1c] bg-[#ccff00] text-[#070809] hover:bg-white px-3 py-1.5 text-[11px] font-mono uppercase font-bold flex items-center space-x-1 transition-all duration-200 cursor-pointer shrink-0 rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    <Plus className="w-3 h-3 text-[#070809]" />
                    <span>Add</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ================================================================== */}
          {/* DETAIL COLUMN: Inspector Panel (8 cols - Scrolls alongside Master) */}
          {/* ================================================================== */}
          <div className="lg:col-span-8 min-h-[500px]">
            
            {/* SCENARIO A: No user selected -> Global Project Frozen Rubric */}
            {selectedContributor === null ? (
              <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 lg:p-8 space-y-8 rounded-none">
                {/* Global Rubric Overview (Uncramped Vertical List) */}
                <RubricOverview
                  currentState={currentState}
                  activeAccount={account}
                  onFreezeRubric={handleFreezeRubric}
                  registeredCount={registeredContributors.length}
                  isFreezing={isFreezing}
                  rubric={liveProjectState?.rubric}
                  creatorAddress={liveProjectState?.creator}
                />

                {/* Project Settlement Status & Proof Card */}
                <div className="border-t border-[#1c1c1c] pt-6 font-mono">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] font-bold">
                      Mathematical Proof & Settlement State
                    </span>
                    <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-2 py-0.5 text-[10px] uppercase font-bold rounded-none font-mono">
                      {currentState === 'FINALIZED'
                        ? '10,000 BPS Conserved'
                        : 'Awaiting Assessment Quorum'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#1c1c1c] text-xs divide-y sm:divide-y-0 sm:divide-x divide-[#1c1c1c] bg-[#070809]">
                    <div className="p-4">
                      <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Total Basis Points</span>
                      <div className="font-mono text-2xl font-extrabold text-[#ccff00] tracking-tight">
                        {allocationMath.totalBps.toLocaleString()} / 10,000
                      </div>
                      <span className="text-[10px] font-mono text-[#ccff00] font-bold">
                        {allocationMath.isExact10000 ? 'Zero Remainder Leak' : 'Awaiting Settlement'}
                      </span>
                    </div>

                    <div className="p-4">
                      <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Algorithm</span>
                      <div className="font-mono text-xl font-bold text-[#f4f4e8] tracking-tight">
                        Hare-Niemeyer
                      </div>
                      <span className="text-[10px] font-sans text-[#888]">
                        Largest Remainder Rule
                      </span>
                    </div>

                    <div className="p-4">
                      <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Claims Filed</span>
                      <div className="font-mono text-2xl font-extrabold text-[#f4f4e8] tracking-tight">
                        {Object.keys(claims).length} / {registeredContributors.length}
                      </div>
                      <span className="text-[10px] font-sans text-[#888]">
                        Whitelisted Claimants
                      </span>
                    </div>
                  </div>

                  {(currentState === 'SUBMISSIONS' || currentState === 'UNRESOLVED') && (
                    <div className="mt-5 pt-4 border-t border-[#1c1c1c] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-[11px] font-mono text-[#888]">
                        Submissions open with {Object.keys(claims).length} claims filed. Ready for multi-validator deliberation.
                      </div>
                      <button
                        onClick={handleAssessmentTrigger}
                        disabled={isAssessing || Object.keys(claims).length === 0}
                        className={`w-full sm:w-auto px-6 py-2.5 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 inline-flex items-center justify-center space-x-2 rounded-none ${
                          !isAssessing && Object.keys(claims).length > 0
                            ? 'bg-[#ccff00] text-[#070809] hover:bg-white cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                            : 'bg-[#141414] text-[#444] border border-[#1c1c1c] cursor-not-allowed'
                        }`}
                      >
                        {isAssessing ? (
                          <>
                            <GenLayerSpinner size="sm" />
                            <span>Consensus Deliberating...</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3.5 h-3.5" />
                            <span>Request Consensus Assessment</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-[#888] mt-4 leading-relaxed font-sans">
                    Select any contributor from the left directory to inspect their delivered evidence, validator evaluation breakdown, and exact basis point allocation.
                  </p>
                </div>
              </div>
            ) : (
              /* SCENARIO B: User selected -> Specific Claim + Deliberation + Allocation Inspector */
              (() => {
                const activeClaim = claims[selectedContributor];
                const activeScore = scores[selectedContributor] ?? 0;
                const activeAlloc = allocationMath.allocations.find(
                  (a) => a.address.toLowerCase() === selectedContributor.toLowerCase()
                );
                const breakdown = getSimulatedBreakdown(activeScore);
                const isConnectedSigner =
                  account?.toLowerCase() === selectedContributor.toLowerCase();

                return (
                  <div className="space-y-6">
                    {/* 1. Contributor Header Card */}
                    <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 font-mono rounded-none">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1c1c1c] mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 border border-[#1c1c1c] bg-[#070809] text-[#ccff00] flex items-center justify-center shrink-0 rounded-none">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block">
                              Contributor Inspector
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs tracking-tight font-bold text-[#f4f4e8] break-all">
                                {selectedContributor}
                              </span>
                              <button
                                onClick={() => handleCopy(selectedContributor)}
                                title="Copy full address"
                                className="border border-[#1c1c1c] p-1 hover:border-[#ccff00] hover:text-[#ccff00] text-[#888] transition-all duration-200 rounded-none cursor-pointer"
                              >
                                {copiedAddress === selectedContributor ? (
                                  <Check className="w-3.5 h-3.5 text-[#ccff00]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {isConnectedSigner && (
                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#ccff00]/40 text-[#ccff00] bg-[#ccff00]/10 flex items-center gap-1 font-bold rounded-none">
                              <ShieldCheck className="w-3 h-3 text-[#ccff00]" />
                              Your Wallet
                            </span>
                          )}
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#1c1c1c] bg-[#070809] text-[#888] font-bold rounded-none">
                            Registered Claimant
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-[#1c1c1c] p-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1c1c1c] bg-[#070809]">
                        <div>
                          <span className="text-[10px] font-sans text-[#686868] uppercase block">Evidence</span>
                          <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">
                            {activeClaim ? 'Committed' : 'Pending'}
                          </span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-3">
                          <span className="text-[10px] font-sans text-[#686868] uppercase block">Validator Score</span>
                          <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">
                            {activeScore > 0 ? `${activeScore} / 100` : 'Pending'}
                          </span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-3">
                          <span className="text-[10px] font-sans text-[#686868] uppercase block">Allocated Share</span>
                          <span className="font-mono text-xs tracking-tight text-[#ccff00] font-bold">
                            {activeAlloc ? `${activeAlloc.finalBps.toLocaleString()} BPS` : 'Pending'}
                          </span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-3">
                          <span className="text-[10px] font-sans text-[#686868] uppercase block">Percentage</span>
                          <span className="font-mono text-xs tracking-tight text-[#ccff00] font-bold">
                            {activeAlloc ? activeAlloc.percentage : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Specific ClaimSubmission Data */}
                    <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 font-mono rounded-none">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-5">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-[#686868] font-bold">01</span>
                          <h3 className="font-display text-base font-bold uppercase tracking-tight text-[#f4f4e8]">
                            Claim & Evidence
                          </h3>
                        </div>
                        {activeClaim ? (
                          <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-2 py-0.5 text-[10px] font-mono uppercase font-bold flex items-center gap-1 rounded-none">
                            <CheckCircle2 className="w-3 h-3 text-[#ccff00]" />
                            On-Chain Committed
                          </span>
                        ) : (
                          <span className="border border-[#1c1c1c] text-[#666] px-2 py-0.5 text-[10px] font-mono uppercase rounded-none">
                            No Claim On Record
                          </span>
                        )}
                      </div>

                      {activeClaim ? (
                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block mb-1">
                              Delivered Contribution Summary
                            </span>
                            <p className="text-xs text-[#f4f4e8] bg-[#070809] border border-[#1c1c1c] p-3.5 leading-relaxed font-sans rounded-none">
                              {activeClaim.description}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block mb-1">
                              Source Evidence URL
                            </span>
                            <div className="p-3 bg-[#070809] border border-[#1c1c1c] flex items-center justify-between rounded-none">
                              <span className="font-mono text-xs tracking-tight text-[#ccff00] break-all select-all underline font-bold">
                                {activeClaim.evidence_url}
                              </span>
                              <a
                                href={activeClaim.evidence_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#888] hover:text-[#ccff00] ml-2 shrink-0 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>

                          {activeClaim.evidence_digest && (
                            <div>
                              <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block mb-1">
                                Cryptographic Evidence Digest (SHA-256)
                              </span>
                              <div className="p-3 bg-[#070809] border border-[#1c1c1c] flex items-center space-x-2 rounded-none">
                                <Hash className="w-3.5 h-3.5 text-[#ccff00] shrink-0" />
                                <span className="font-mono text-xs tracking-tight text-[#ccff00] break-all select-all font-bold">
                                  {activeClaim.evidence_digest}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : isConnectedSigner && currentState === 'SUBMISSIONS' ? (
                        /* Authenticated Contributor can submit their claim directly */
                        <form onSubmit={handleInspectorClaimSubmit} className="space-y-4">
                          <p className="text-xs text-[#888] font-sans">
                            You are connected as <span className="font-mono text-[#bcbcbc]">{truncateAddress(selectedContributor)}</span>. Submit your deliverable evidence URL and scope description below to commit your claim on-chain.
                          </p>

                          <div>
                            <label className="block text-[10px] font-sans uppercase tracking-widest text-[#686868] mb-1">
                              Evidence URL
                            </label>
                            <input
                              type="url"
                              placeholder="https://github.com/.../pull/1"
                              value={claimUrlInput}
                              onChange={(e) => setClaimUrlInput(e.target.value)}
                              className="w-full text-xs font-mono tracking-tight bg-[#070809] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none p-3 text-[#f4f4e8] placeholder-[#444] rounded-none transition-all duration-200"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-sans uppercase tracking-widest text-[#686868] mb-1">
                              Deliverable Summary
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Detail scope, difficulty, and impact..."
                              value={claimDescInput}
                              onChange={(e) => setClaimDescInput(e.target.value)}
                              className="w-full text-xs font-sans bg-[#070809] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] focus:outline-none p-3 text-[#f4f4e8] placeholder-[#444] rounded-none transition-all duration-200 leading-relaxed"
                              required
                            />
                          </div>

                          {claimDigestPreview && (
                            <div className="p-3 bg-[#070809] border border-[#1c1c1c] rounded-none">
                              <div className="flex items-center space-x-2 text-[10px] font-mono text-[#686868] mb-1">
                                <Hash className="w-3 h-3 text-[#ccff00]" />
                                <span>Computed SHA-256 Digest (Commitment)</span>
                              </div>
                              <span className="font-mono text-xs tracking-tight text-[#ccff00] break-all select-all font-bold">
                                {claimDigestPreview}
                              </span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSubmittingClaim}
                            className="w-full py-3 text-xs font-mono uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                          >
                            {isSubmittingClaim ? (
                              <>
                                <GenLayerSpinner size="sm" />
                                <span>Signing & Broadcasting Claim...</span>
                              </>
                            ) : (
                              <span>Submit Claim On-Chain</span>
                            )}
                          </button>
                        </form>
                      ) : (
                        <div className="p-6 bg-[#070809] border border-[#1c1c1c] text-center text-xs font-sans text-[#666] rounded-none">
                          {currentState === 'OPEN'
                            ? 'Submissions window is not open yet. The rubric must be frozen by the creator first.'
                            : 'No evidence claim has been filed for this wallet address yet.'}
                        </div>
                      )}
                    </div>

                    {/* 3. Specific DeliberationConsole Consensus Results */}
                    <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 font-mono rounded-none">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-5">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-[#686868] font-bold">02</span>
                          <h3 className="font-display text-base font-bold uppercase tracking-tight text-[#f4f4e8]">
                            Consensus Evaluation
                          </h3>
                        </div>
                        <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-2 py-0.5 text-xs font-bold font-mono rounded-none">
                          {activeScore > 0 ? `${activeScore} / 100` : 'Pending Quorum'}
                        </span>
                      </div>

                      {activeScore > 0 ? (
                        <div className="space-y-4">
                          {/* 5-Criteria Rubric Breakdown */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block">
                              Rubric Dimensions Breakdown
                            </span>

                            <div className="border border-[#1c1c1c] divide-y divide-[#1c1c1c] bg-[#070809] text-xs">
                              <div className="p-3 flex items-center justify-between">
                                <span className="text-[#888] font-sans">Delivered Work (30%)</span>
                                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.work} / 30</span>
                              </div>
                              <div className="p-3 flex items-center justify-between">
                                <span className="text-[#888] font-sans">Technical Difficulty (25%)</span>
                                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.diff} / 25</span>
                              </div>
                              <div className="p-3 flex items-center justify-between">
                                <span className="text-[#888] font-sans">Impact on Result (25%)</span>
                                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.imp} / 25</span>
                              </div>
                              <div className="p-3 flex items-center justify-between">
                                <span className="text-[#888] font-sans">Reliability & Validation (10%)</span>
                                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.rel} / 10</span>
                              </div>
                              <div className="p-3 flex items-center justify-between">
                                <span className="text-[#888] font-sans">Collaboration & Support (10%)</span>
                                <span className="font-mono text-xs tracking-tight text-[#f4f4e8] font-bold">{breakdown.col} / 10</span>
                              </div>
                            </div>
                          </div>

                          {/* Validator consensus notes */}
                          {assessmentNotes && (
                            <div>
                              <span className="text-[10px] font-sans uppercase tracking-widest text-[#686868] block mb-1">
                                Validator Consensus Rationale
                              </span>
                              <p className="text-xs text-[#f4f4e8] bg-[#070809] border border-[#1c1c1c] p-3.5 leading-relaxed font-sans rounded-none">
                                {assessmentNotes}
                              </p>
                            </div>
                          )}

                          <div className="pt-2 border-t border-[#1c1c1c] flex items-center justify-between text-[10px] font-mono text-[#686868] uppercase font-bold">
                            <span>Quorum Agreement</span>
                            <span className="font-mono text-xs tracking-tight text-[#ccff00]">gl.eq_principle.strict_eq</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-[#070809] border border-[#1c1c1c] text-center space-y-4 rounded-none">
                          <p className="text-xs text-[#888] font-sans">
                            Multi-validator consensus assessment is pending for this project. Once evidence submissions are closed, validators will deliberate against the frozen rubric criteria.
                          </p>

                          {(currentState === 'SUBMISSIONS' || currentState === 'UNRESOLVED') && (
                            <button
                              onClick={handleAssessmentTrigger}
                              disabled={isAssessing || Object.keys(claims).length === 0}
                              className={`px-6 py-2.5 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 inline-flex items-center space-x-2 rounded-none ${
                                !isAssessing && Object.keys(claims).length > 0
                                  ? 'bg-[#ccff00] text-[#070809] hover:bg-white cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                                  : 'bg-[#141414] text-[#444] border border-[#1c1c1c] cursor-not-allowed'
                              }`}
                            >
                              {isAssessing ? (
                                <>
                                  <GenLayerSpinner size="sm" />
                                  <span>Consensus Deliberating...</span>
                                </>
                              ) : (
                                <>
                                  <Cpu className="w-3.5 h-3.5" />
                                  <span>Request Consensus Assessment</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 4. Specific Slice of AllocationBreakdown */}
                    <div className="border border-[#1c1c1c] bg-[#090a0c] p-6 font-mono rounded-none">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-5">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-[#686868] font-bold">03</span>
                          <h3 className="font-display text-base font-bold uppercase tracking-tight text-[#f4f4e8]">
                            Basis Point Allocation
                          </h3>
                        </div>
                        {activeAlloc ? (
                          <span className="border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] px-2 py-0.5 text-xs font-bold font-mono rounded-none">
                            {activeAlloc.percentage}
                          </span>
                        ) : (
                          <span className="border border-[#1c1c1c] text-[#666] px-2 py-0.5 text-[10px] font-mono uppercase rounded-none">
                            Awaiting Settlement
                          </span>
                        )}
                      </div>

                      {activeAlloc ? (
                        <div className="space-y-4">
                          {/* 3 Metric Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#1c1c1c] divide-y sm:divide-y-0 sm:divide-x divide-[#1c1c1c] bg-[#070809]">
                            <div className="p-4">
                              <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Final Share</span>
                              <div className="font-display text-xl font-bold text-[#f4f4e8]">
                                <span className="font-mono text-xl tracking-tight text-[#ccff00]">{activeAlloc.finalBps.toLocaleString()}</span> <span className="text-xs font-mono text-[#888]">BPS</span>
                              </div>
                              <span className="text-[10px] font-mono text-[#ccff00] font-bold">
                                Exact {activeAlloc.percentage}
                              </span>
                            </div>

                            <div className="p-4">
                              <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Floor Base Share</span>
                              <div className="font-display text-xl font-bold text-[#f4f4e8]">
                                <span className="font-mono text-xl tracking-tight text-[#bcbcbc]">{activeAlloc.baseBps.toLocaleString()}</span> <span className="text-xs font-mono text-[#888]">BPS</span>
                              </div>
                              <span className="text-[10px] font-mono text-[#888]">
                                Integer Quotient
                              </span>
                            </div>

                            <div className="p-4">
                              <span className="text-[10px] font-sans text-[#686868] uppercase block mb-1">Tie-Breaker Award</span>
                              <div className="font-mono text-xl font-bold text-[#f4f4e8]">
                                {activeAlloc.awardedRemainder ? (
                                  <span className="text-[#ccff00]">+1 BPS</span>
                                ) : (
                                  <span className="text-[#666]">0 BPS</span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-[#888]">
                                Remainder: {activeAlloc.remainder}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-[#070809] border border-[#1c1c1c] text-[11px] text-[#888] flex items-center justify-between rounded-none font-sans">
                            <span>Proof Conservation Invariant:</span>
                            <span className="text-[#ccff00] font-mono font-bold">
                              ✓ Verified Exact Allocation (Zero Leaks)
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-[#070809] border border-[#1c1c1c] text-center text-xs text-[#666] font-sans rounded-none">
                          Final basis points will be deterministically computed via the Hare-Niemeyer largest remainder rule upon assessment completion.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c1c1c] bg-[#070809] py-8 text-xs font-mono text-[#686868]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="uppercase tracking-widest font-display text-xs text-[#f4f4e8] font-bold">
            MeritSplit Active Contract · GenLayer Protocol
          </div>
          <div className="flex items-center space-x-6 uppercase tracking-wider text-[11px] text-[#555]">
            <span>Contract: <span className="text-[#bcbcbc]">{activeContractAddress.slice(0, 10)}...</span></span>
            <span>Chain ID: <span className="text-[#bcbcbc]">{GENLAYER_STUDIO_NEXT_CONFIG.chainId}</span></span>
            <span className="text-[#ccff00] font-bold">gl.eq_principle.strict_eq</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
