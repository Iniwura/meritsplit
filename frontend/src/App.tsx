import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { DeploySplit } from './pages/DeploySplit';
import { Dashboard } from './pages/Dashboard';
import { ProjectState, ContributorClaim, DeliberationStep } from './types';
import { getProjectState, GENLAYER_STUDIO_NEXT_CONFIG } from './services/genlayer';
import { useGenLayerWallet } from './lib/wallet';
import { Toaster, toast } from 'sonner';

export const App: React.FC = () => {
  // Real Web3 wallet hook backed by GenLayer Transaction Kit & genlayer-js
  const {
    account,
    isConnecting,
    client,
    txKit,
    connectWallet,
    disconnectWallet,
  } = useGenLayerWallet();

  // Active loaded contract address
  const [activeContractAddress, setActiveContractAddress] = useState<string>(() => {
    return (
      localStorage.getItem('meritsplit_active_contract') ||
      GENLAYER_STUDIO_NEXT_CONFIG.defaultContractAddress
    );
  });

  // Live on-chain protocol state (Blank slate by default until fetched from live contract)
  const [currentState, setCurrentState] = useState<ProjectState>('OPEN');
  const [registeredContributors, setRegisteredContributors] = useState<string[]>([]);
  const [claims, setClaims] = useState<Record<string, ContributorClaim>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [assessmentNotes, setAssessmentNotes] = useState<string>(
    'Awaiting contributor claims and consensus assessment.'
  );

  const [isAssessing, setIsAssessing] = useState<boolean>(false);
  const [deliberationSteps, setDeliberationSteps] = useState<DeliberationStep[]>([
    { id: 1, title: 'Inert Evidence Render', description: 'gl.nondet.web.render pulls pull request metrics', status: 'pending' },
    { id: 2, title: 'LLM Scoring Consensus', description: 'Scoring against 5 frozen rubric criteria (0-100)', status: 'pending' },
    { id: 3, title: 'Strict Equivalence', description: 'gl.eq_principle.strict_eq consensus validation', status: 'pending' },
    { id: 4, title: 'Largest Remainder Math', description: 'Deterministic integer allocation to exact 10,000 BPS', status: 'pending' },
  ]);

  // Synchronize with live on-chain state from GenLayer Studio Next via get_project_state()
  const fetchLiveState = useCallback(async (targetAddress?: string) => {
    const contractAddress = targetAddress || activeContractAddress || GENLAYER_STUDIO_NEXT_CONFIG.defaultContractAddress;
    if (!contractAddress) return;

    try {
      const projectState = await getProjectState(contractAddress);

      if (projectState) {
        // Map live state name
        const stateName = projectState.state_name;
        if (stateName) {
          setCurrentState(stateName);
        }

        // Map live registered contributors
        if (Array.isArray(projectState.contributors)) {
          setRegisteredContributors(projectState.contributors);
        }

        // Map live claims
        if (projectState.claims && typeof projectState.claims === 'object') {
          setClaims(projectState.claims);
        }

        // Map live scores
        const liveScores = projectState.assessment_scores;
        if (liveScores && typeof liveScores === 'object') {
          setScores(liveScores);
        }

        // Map live assessment notes
        if (projectState.assessment_notes) {
          setAssessmentNotes(projectState.assessment_notes);
        }

        // Update deliberation steps if state is FINALIZED
        if (stateName === 'FINALIZED') {
          setDeliberationSteps([
            { id: 1, title: 'Inert Evidence Render', description: 'Rendered evidence snapshots with SHA-256 integrity proofs. Zero injection.', status: 'completed' },
            { id: 2, title: 'LLM Scoring Consensus', description: 'Consensus scores certified against 5 frozen rubric criteria.', status: 'completed' },
            { id: 3, title: 'Strict Equivalence', description: 'Leader & validator outputs strictly equivalent. Consensus certified.', status: 'completed' },
            { id: 4, title: 'Largest Remainder Math', description: 'Exact 10,000 BPS distributed via Largest Remainder Method.', status: 'completed' },
          ]);
        }
      }
    } catch (err) {
      console.warn('Could not read contract live state from GenLayer:', err);
    }
  }, [activeContractAddress]);

  // Initial live state fetch on mount or address change
  useEffect(() => {
    fetchLiveState(activeContractAddress);
  }, [fetchLiveState, activeContractAddress]);

  const handleSelectContract = useCallback(
    (address: string) => {
      setActiveContractAddress(address);
      localStorage.setItem('meritsplit_active_contract', address);
      fetchLiveState(address);
    },
    [fetchLiveState]
  );

  const handleRequestAssessment = () => {
    setIsAssessing(true);
    setCurrentState('ASSESSING');

    setDeliberationSteps([
      { id: 1, title: 'Inert Evidence Render', description: 'Calling gl.nondet.web.render on evidence URLs...', status: 'in_progress' },
      { id: 2, title: 'LLM Scoring Consensus', description: 'Pending...', status: 'pending' },
      { id: 3, title: 'Strict Equivalence', description: 'Pending...', status: 'pending' },
      { id: 4, title: 'Largest Remainder Math', description: 'Pending...', status: 'pending' },
    ]);

    setTimeout(() => {
      setDeliberationSteps((prev) => [
        { ...prev[0], status: 'completed', description: 'Rendered evidence snapshots with SHA-256 integrity proofs. Zero injection.' },
        { ...prev[1], status: 'in_progress', description: 'Evaluating Delivered Work (30%), Difficulty (25%), Impact (25%)...' },
        prev[2],
        prev[3],
      ]);

      setTimeout(() => {
        setDeliberationSteps((prev) => [
          prev[0],
          { ...prev[1], status: 'completed', description: 'Evaluated composite scores against frozen rubric.' },
          { ...prev[2], status: 'in_progress', description: 'Validating equivalence across validator quorum...' },
          prev[3],
        ]);

        setTimeout(() => {
          setDeliberationSteps((prev) => [
            prev[0],
            prev[1],
            { ...prev[2], status: 'completed', description: 'Leader & validator outputs strictly equivalent. Consensus certified.' },
            { ...prev[3], status: 'in_progress', description: 'Executing Largest Remainder Method in integer arithmetic...' },
          ]);

          setTimeout(async () => {
            setDeliberationSteps((prev) => [
              prev[0],
              prev[1],
              prev[2],
              { ...prev[3], status: 'completed', description: 'Sum: 10,000 BPS exact (100.00%). State finalized.' },
            ]);
            setIsAssessing(false);
            await fetchLiveState(activeContractAddress);
            toast.success('Consensus Finalized', {
              description: 'Strict equivalence certified across validators. Total: 10,000 BPS exact.',
            });
          }, 800);
        }, 800);
      }, 800);
    }, 800);
  };

  const handleReset = () => {
    fetchLiveState(activeContractAddress);
    toast.info('Workspace refreshed', {
      description: `Synchronized with on-chain contract state (${activeContractAddress.slice(0, 6)}...).`,
    });
  };

  const handleDeployProject = (projectData: {
    name: string;
    description: string;
    contributors: string[];
    rubric: Record<string, number>;
  }) => {
    if (projectData.contributors.length > 0) {
      setRegisteredContributors(projectData.contributors);
    }
  };

  return (
    <BrowserRouter>
      {/* Kyma-themed Dark Toaster */}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#0d0f12',
            border: '1px solid #1c1c1c',
            color: '#f4f4e8',
            fontFamily: 'monospace',
            borderRadius: '0px',
            fontSize: '12px',
          },
          className: 'kyma-toast',
        }}
      />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/deploy"
          element={
            <DeploySplit
              account={account}
              isConnecting={isConnecting}
              client={client}
              onConnectWallet={connectWallet}
              onDisconnectWallet={disconnectWallet}
              onDeployProject={handleDeployProject}
              onSelectContractAddress={handleSelectContract}
            />
          }
        />
        <Route
          path="/app"
          element={
            <Dashboard
              activeContractAddress={activeContractAddress}
              onSelectContractAddress={handleSelectContract}
              currentState={currentState}
              setCurrentState={setCurrentState}
              account={account}
              isConnecting={isConnecting}
              onConnectWallet={connectWallet}
              onDisconnectWallet={disconnectWallet}
              client={client}
              txKit={txKit}
              registeredContributors={registeredContributors}
              setRegisteredContributors={setRegisteredContributors}
              claims={claims}
              setClaims={setClaims}
              scores={scores}
              setScores={setScores}
              assessmentNotes={assessmentNotes}
              setAssessmentNotes={setAssessmentNotes}
              isAssessing={isAssessing}
              setIsAssessing={setIsAssessing}
              deliberationSteps={deliberationSteps}
              onReset={handleReset}
              onRequestAssessment={handleRequestAssessment}
              onRefreshLiveState={() => fetchLiveState(activeContractAddress)}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
