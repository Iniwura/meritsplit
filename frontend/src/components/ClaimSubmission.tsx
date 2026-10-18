import React, { useState } from 'react';
import { ProjectState, ContributorClaim } from '../types';
import { truncateAddress } from '../lib/genlayer';
import { submitClaim } from '../services/genlayer';
import { ExternalLink, Hash, ShieldCheck, ShieldAlert } from 'lucide-react';
import { GenLayerSpinner } from './GenLayerSpinner';

interface ClaimSubmissionProps {
  currentState: ProjectState;
  contributors: string[];
  activeAccount: string | null;
  claims: Record<string, ContributorClaim>;
  contractAddress?: string;
  client?: any;
  onSubmitClaim?: (data: {
    evidenceUrl: string;
    evidenceDigest: string;
    description: string;
  }) => Promise<void>;
  onRegisterContributor?: (address: string) => Promise<void>;
  onConnectWallet: () => Promise<string | null>;
  isCreator: boolean;
  onSuccess?: () => void;
}

export const ClaimSubmission: React.FC<ClaimSubmissionProps> = ({
  currentState,
  contributors,
  activeAccount,
  claims,
  contractAddress,
  client,
  onSubmitClaim,
  onRegisterContributor,
  onConnectWallet,
  isCreator,
  onSuccess,
}) => {
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [previewDigest, setPreviewDigest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Creator state
  const [newContributorAddress, setNewContributorAddress] = useState('');

  const isSubmissionsOpen = currentState === 'SUBMISSIONS';

  // Check if active wallet is registered
  const isRegistered =
    activeAccount &&
    contributors.some(
      (c) => c.toLowerCase() === activeAccount.toLowerCase()
    );

  // Client-side SHA-256 calculation
  const calculateDigest = async (text: string) => {
    if (!text.trim()) {
      setPreviewDigest('');
      return;
    }
    try {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setPreviewDigest(hashHex);
    } catch {
      setPreviewDigest('');
    }
  };

  React.useEffect(() => {
    const payload = `${evidenceUrl}|${description}`;
    calculateDigest(payload);
  }, [evidenceUrl, description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSubmissionsOpen) {
      setErrorMessage('Submissions are closed. The project is not in SUBMISSIONS state.');
      return;
    }

    if (!isRegistered) {
      setErrorMessage('Your active connected wallet is not whitelisted for this project.');
      return;
    }

    if (!evidenceUrl.trim() || !description.trim()) {
      setErrorMessage('Please provide both an evidence URL and deliverable description.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (onSubmitClaim) {
        await onSubmitClaim({
          evidenceUrl: evidenceUrl.trim(),
          evidenceDigest: previewDigest,
          description: description.trim(),
        });
      } else if (client && contractAddress) {
        await submitClaim(client, contractAddress, {
          evidenceUrl: evidenceUrl.trim(),
          evidenceDigest: previewDigest,
          description: description.trim(),
        });
      }
      setSuccessMessage('Claim submitted and SHA-256 digest committed on-chain.');
      setEvidenceUrl('');
      setDescription('');
      setPreviewDigest('');
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error submitting claim on-chain.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submittedClaimsList = Object.values(claims);

  return (
    <section className="border-b border-[#1c1c1c] pb-12 mb-12">
      <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#f4f4e8] mb-1">
            Evidence Claims
          </h2>
          <p className="text-xs text-[#888] font-sans">
            Verifiable deliverable evidence committed on-chain with cryptographic digests.
          </p>
        </div>
        <div className="font-mono text-xs text-[#686868] mt-2 md:mt-0 flex items-center space-x-3">
          {isSubmissionsOpen ? (
            <span className="text-[#ccff00] flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
              <span className="w-1.5 h-1.5 rounded-none bg-[#ccff00] animate-pulse" />
              Submissions Window Open
            </span>
          ) : (
            <span className="text-[#888] uppercase tracking-wider text-[11px]">○ Submissions Inactive</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 border-t border-l border-[#1c1c1c]">
        {/* Left Form: 5 cols */}
        <div className="lg:col-span-5 border-r border-b border-[#1c1c1c] p-6 lg:p-8 flex flex-col justify-between bg-[#070809]">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1c1c1c]">
              <span className="text-xs font-mono uppercase tracking-widest text-[#bcbcbc]">
                Submit Claim
              </span>
              {activeAccount ? (
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-none font-bold ${
                    isRegistered
                      ? 'text-[#ccff00] border-[#ccff00]/40 bg-[#ccff00]/10'
                      : 'text-rose-400 border-rose-500/40 bg-rose-500/5'
                  }`}
                >
                  {isRegistered ? 'Eligible Contributor' : 'Unregistered Wallet'}
                </span>
              ) : (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border text-amber-400 border-amber-500/40 rounded-none">
                  Wallet Not Connected
                </span>
              )}
            </div>

            {activeAccount && !isRegistered ? (
              <div className="p-6 border border-[#1c1c1c] bg-[#090a0c] text-center my-6 rounded-none">
                <div className="w-9 h-9 rounded-none bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h4 className="font-mono text-xs uppercase font-bold text-[#f4f4e8] tracking-wider mb-2">
                  Wallet not registered for this project.
                </h4>
                <p className="text-[11px] font-sans text-[#888] leading-relaxed max-w-sm mx-auto">
                  The connected address (<span className="font-mono text-[#bcbcbc]">{truncateAddress(activeAccount)}</span>) is not listed in the registered contributor set for this sprint. Only whitelisted contributors can submit evidence claims.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-widest text-[#686868] mb-1.5">
                    Signer Address
                  </label>
                  {activeAccount ? (
                    <div className="font-mono text-xs tracking-tight text-[#bcbcbc] bg-[#090a0c] border border-[#1c1c1c] p-3 break-all flex items-center justify-between rounded-none">
                      <span>{activeAccount}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#ccff00] shrink-0 ml-2" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onConnectWallet}
                      className="w-full text-left font-mono text-xs text-[#888] hover:text-[#ccff00] bg-[#090a0c] border border-dashed border-[#262626] hover:border-[#ccff00] p-3 transition-all duration-200 rounded-none cursor-pointer"
                    >
                      + Connect MetaMask to authenticate signer
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-widest text-[#686868] mb-1.5">
                    Evidence URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/.../pull/1"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="w-full font-mono text-xs tracking-tight bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] p-3 text-[#f4f4e8] placeholder-[#444] focus:outline-none transition-all duration-200 rounded-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-widest text-[#686868] mb-1.5">
                    Deliverable Summary
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detail scope, difficulty, impact, and verification..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs font-sans bg-[#090a0c] border border-[#1c1c1c] focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] p-3 text-[#f4f4e8] placeholder-[#444] focus:outline-none transition-all duration-200 rounded-none leading-relaxed"
                    required
                  />
                </div>

                {/* Real-time Client-side SHA-256 Digest preview */}
                {previewDigest && (
                  <div className="p-3 border border-[#1c1c1c] bg-[#090a0c] rounded-none">
                    <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-[#888] mb-1">
                      <Hash className="w-3 h-3 text-[#ccff00]" />
                      <span>Evidence SHA-256 Digest</span>
                    </div>
                    <div className="font-mono text-xs tracking-tight text-[#ccff00] break-all select-all font-bold">
                      {previewDigest}
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 border border-rose-500/30 bg-rose-500/5 text-rose-300 text-xs font-mono rounded-none">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 border border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00] text-xs font-mono rounded-none font-bold">
                    {successMessage}
                  </div>
                )}

                {activeAccount ? (
                  <button
                    type="submit"
                    disabled={!isSubmissionsOpen || !isRegistered || isSubmitting}
                    className={`w-full py-3.5 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 flex items-center justify-center gap-2 rounded-none ${
                      isSubmissionsOpen && isRegistered && !isSubmitting
                        ? 'bg-[#ccff00] text-[#070809] hover:bg-white cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                        : 'bg-[#141414] text-[#444] border border-[#1c1c1c] cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <GenLayerSpinner size="sm" />
                        <span>Signing & Broadcasting...</span>
                      </>
                    ) : (
                      <span>Submit Claim On-Chain</span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectWallet}
                    className="w-full py-3.5 font-mono text-xs uppercase font-bold tracking-widest bg-[#ccff00] text-[#070809] hover:bg-white transition-all duration-200 cursor-pointer rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    Connect Wallet to Submit
                  </button>
                )}
              </form>
            )}
          </div>

          {/* Creator contributor registration */}
          {isCreator && currentState === 'OPEN' && (
            <div className="mt-8 pt-6 border-t border-[#1c1c1c]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#686868] block mb-2">
                Creator: Register Contributor
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x..."
                  value={newContributorAddress}
                  onChange={(e) => setNewContributorAddress(e.target.value)}
                  className="flex-1 font-mono text-xs tracking-tight bg-[#090a0c] border border-[#1c1c1c] px-3 py-2 text-[#f4f4e8] placeholder-[#444] focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] rounded-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newContributorAddress.trim() && onRegisterContributor) {
                      onRegisterContributor(newContributorAddress.trim());
                      setNewContributorAddress('');
                    }
                  }}
                  className="border border-[#1c1c1c] hover:border-[#ccff00] hover:bg-white/5 px-4 py-2 text-xs font-mono uppercase text-[#f4f4e8] transition-all duration-200 rounded-none cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right List: 7 cols */}
        <div className="lg:col-span-7 border-r border-b border-[#1c1c1c] p-6 lg:p-8 flex flex-col justify-between bg-[#090a0c]">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1c1c1c]">
              <span className="text-xs font-mono uppercase tracking-widest text-[#bcbcbc]">
                Registered Claims ({submittedClaimsList.length})
              </span>
              <span className="text-[10px] font-mono text-[#686868] uppercase tracking-wider">
                Cryptographic Evidence Commitments
              </span>
            </div>

            {submittedClaimsList.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-[#555]">
                No claims filed on record.
              </div>
            ) : (
              <div className="divide-y divide-[#1c1c1c]">
                {submittedClaimsList.map((c, i) => (
                  <div key={c.contributor} className="py-5 first:pt-0 last:pb-0 transition-all duration-200 hover:bg-white/5 px-2 -mx-2">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs text-[#686868]">0{i + 1}</span>
                        <span className="font-mono text-xs tracking-tight uppercase font-bold text-[#f4f4e8]">
                          {truncateAddress(c.contributor)}
                        </span>
                      </div>
                      <a
                        href={c.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs tracking-tight text-[#ccff00] hover:underline inline-flex items-center gap-1 font-bold"
                      >
                        <span>View Evidence</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <p className="text-xs font-sans text-[#bcbcbc] leading-relaxed mb-3 font-normal">
                      {c.description}
                    </p>

                    {c.evidence_digest && (
                      <div className="font-mono text-xs tracking-tight text-[#888] bg-[#070809] border border-[#1c1c1c] p-2.5 mb-2 break-all flex items-center gap-2 rounded-none">
                        <span className="text-[#686868] shrink-0 font-bold text-[10px]">DIGEST:</span>
                        <span className="text-[#ccff00] font-bold select-all">{c.evidence_digest}</span>
                      </div>
                    )}

                    <div className="font-mono text-[10px] tracking-tight text-[#686868] flex items-center justify-between">
                      <span>ADDR: <span className="text-[#bcbcbc]">{c.contributor}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-[#1c1c1c] text-[10px] font-mono text-[#555] flex items-center justify-between uppercase tracking-wider">
            <span>Isolation: Client SHA-256 Digest Verified</span>
            <span>GenVM Consensus Ready</span>
          </div>
        </div>
      </div>
    </section>
  );
};
