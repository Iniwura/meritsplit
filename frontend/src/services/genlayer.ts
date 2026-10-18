import { createClient, chains } from 'genlayer-js';
import { MERIT_SPLIT_CONTRACT_CODE } from './contractCode';
import { ProjectStateResponse, ProjectState, ContributorClaim } from '../types';

export const GENLAYER_STUDIO_NEXT_CONFIG = {
  chainId: Number((import.meta as any).env?.VITE_GENLAYER_CHAIN_ID) || 61997,
  chainIdHex: '0xf22d',
  chainName: 'GenLayer Studio Next Testnet',
  rpcUrl: (import.meta as any).env?.VITE_GENLAYER_RPC_URL || 'https://studio-next.genlayer.com/api',
  nativeCurrency: {
    name: 'GenLayer GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  blockExplorerUrl: 'https://studio-next.genlayer.com',
  defaultContractAddress: (import.meta as any).env?.VITE_CONTRACT_ADDRESS || '0x3CDc767088d81aA2e781E1E28e2000f893117B6f',
};

// GenLayer chain configured for Studio Next
export const studioNextChain = {
  ...chains.studionet,
  id: GENLAYER_STUDIO_NEXT_CONFIG.chainId,
  name: GENLAYER_STUDIO_NEXT_CONFIG.chainName,
  rpcUrls: {
    default: {
      http: [GENLAYER_STUDIO_NEXT_CONFIG.rpcUrl],
    },
  },
  nativeCurrency: GENLAYER_STUDIO_NEXT_CONFIG.nativeCurrency,
  blockExplorers: {
    default: {
      name: 'Studio Next Explorer',
      url: GENLAYER_STUDIO_NEXT_CONFIG.blockExplorerUrl,
    },
  },
};

// Dedicated read-only client for querying on-chain state without wallet prompt
export const readOnlyClient = createClient({
  chain: studioNextChain as any,
});

/**
 * Normalizes an EVM address to 0x lower-case hex
 */
export function normalizeAddress(addr: string): `0x${string}` {
  const clean = addr.trim().toLowerCase();
  return (clean.startsWith('0x') ? clean : `0x${clean}`) as `0x${string}`;
}

/**
 * Read the comprehensive on-chain project state:
 * Creator, project name, frozen rubric, state code, whitelisted contributors,
 * committed claims with digests, certified scores, and 10,000 BPS allocations.
 */
export async function getProjectState(contractAddress: string): Promise<ProjectStateResponse | null> {
  const addr = normalizeAddress(contractAddress);
  try {
    const rawState = (await readOnlyClient.readContract({
      address: addr,
      functionName: 'get_project_state',
      args: [],
    })) as any;

    if (!rawState) return null;

    // Normalize rubric if it returned as JSON string
    let rubric = rawState.rubric;
    if (typeof rubric === 'string') {
      try {
        rubric = JSON.parse(rubric);
      } catch {
        // preserve string if not JSON
      }
    }

    return {
      creator: rawState.creator || '',
      project_name: rawState.project_name || 'MeritSplit Contract',
      rubric: rubric || {},
      state_code: typeof rawState.state_code === 'number' ? rawState.state_code : 0,
      state_name: (rawState.state_name || 'OPEN') as ProjectState,
      contributors: Array.isArray(rawState.contributors) ? rawState.contributors : [],
      claims: (rawState.claims && typeof rawState.claims === 'object') ? rawState.claims : {},
      assessment_scores: (rawState.assessment_scores && typeof rawState.assessment_scores === 'object') ? rawState.assessment_scores : {},
      final_allocations: (rawState.final_allocations && typeof rawState.final_allocations === 'object') ? rawState.final_allocations : {},
      total_basis_points: typeof rawState.total_basis_points === 'number' ? rawState.total_basis_points : 0,
      is_exact_10000: !!rawState.is_exact_10000,
      assessment_notes: rawState.assessment_notes || '',
    };
  } catch (err) {
    console.warn(`[getProjectState] Failed to query ${contractAddress}:`, err);
    throw err;
  }
}

/**
 * Public view returning verified allocations, basis points, and percentages
 */
export async function getAllocations(contractAddress: string): Promise<any> {
  const addr = normalizeAddress(contractAddress);
  try {
    return await readOnlyClient.readContract({
      address: addr,
      functionName: 'get_allocations',
      args: [],
    });
  } catch (err) {
    console.warn(`[getAllocations] Failed to query ${contractAddress}:`, err);
    throw err;
  }
}

/**
 * Deploy a new MeritSplit Intelligent Contract to GenLayer Studio Next.
 * Passes project_name, serialized rubric weights, and creator address to MeritSplit.__init__.
 * If contributors are specified, automatically whitelists them in sequence.
 */
export async function deploySplitContract(
  client: any,
  params: {
    projectName: string;
    rubric: Record<string, number> | string;
    creator: string;
    contributors?: string[];
  }
): Promise<{ contractAddress: string; txHash: string; receipt?: any }> {
  if (!client) {
    throw new Error('Wallet client not initialized. Please connect MetaMask to Studio Next.');
  }

  const rubricStr = typeof params.rubric === 'string'
    ? params.rubric
    : JSON.stringify(params.rubric, Object.keys(params.rubric).sort());

  const creatorAddr = normalizeAddress(params.creator);
  const projectName = params.projectName.trim() || 'MeritSplit Sprint';

  console.log('[deploySplitContract] Deploying MeritSplit to Studio Next...', {
    projectName,
    creator: creatorAddr,
    rubric: rubricStr,
  });

  // Call client.deployContract
  const txHash = await client.deployContract({
    code: MERIT_SPLIT_CONTRACT_CODE,
    args: [projectName, rubricStr, creatorAddr],
  });

  console.log('[deploySplitContract] Broadcast txHash:', txHash);

  // Wait for deployment confirmation
  let receipt: any = null;
  let deployedAddress = '';

  try {
    receipt = await client.waitForTransactionReceipt({
      hash: txHash,
    });
    console.log('[deploySplitContract] Receipt received:', receipt);

    deployedAddress =
      receipt?.data?.contract_address ||
      receipt?.data?.contractAddress ||
      receipt?.recipient ||
      receipt?.to_address ||
      receipt?.txDataDecoded?.contractAddress ||
      '';
  } catch (receiptErr) {
    console.warn('[deploySplitContract] waitForTransactionReceipt warning:', receiptErr);
  }

  // Fallback address generation if node does not return explicit recipient immediately
  if (!deployedAddress) {
    // Attempt getTransaction lookup
    try {
      const tx = await client.getTransaction({ hash: txHash });
      deployedAddress = tx?.recipient || tx?.to_address || (tx?.data as any)?.contract_address || '';
    } catch {
      // ignore
    }
  }

  // Final fallback to txHash-derived address if needed
  if (!deployedAddress) {
    deployedAddress = (txHash.slice(0, 42) as `0x${string}`);
  }

  // Whitelist initial contributors if supplied
  if (params.contributors && params.contributors.length > 0 && deployedAddress) {
    for (const c of params.contributors) {
      if (c && c.trim()) {
        try {
          await registerContributor(client, deployedAddress, c.trim());
        } catch (regErr) {
          console.warn(`[deploySplitContract] Failed to register initial contributor ${c}:`, regErr);
        }
      }
    }
  }

  return {
    contractAddress: deployedAddress,
    txHash,
    receipt,
  };
}

/**
 * Register a contributor address (creator only, in OPEN state)
 */
export async function registerContributor(
  client: any,
  contractAddress: string,
  contributorAddress: string
): Promise<{ txHash: string; receipt?: any }> {
  if (!client) throw new Error('Wallet client not initialized');
  const contractAddr = normalizeAddress(contractAddress);
  const targetAddr = normalizeAddress(contributorAddress);

  const txHash = await client.writeContract({
    address: contractAddr,
    functionName: 'register_contributor',
    args: [targetAddr],
  });

  let receipt: any = null;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash });
  } catch {
    // receipt polling fallback
  }

  return { txHash, receipt };
}

/**
 * Freeze rubric criteria and transition contract state from OPEN to SUBMISSIONS.
 */
export async function freezeRubricAndOpenSubmissions(
  client: any,
  contractAddress: string
): Promise<{ txHash: string; receipt?: any }> {
  if (!client) throw new Error('Wallet client not initialized');
  const contractAddr = normalizeAddress(contractAddress);

  const txHash = await client.writeContract({
    address: contractAddr,
    functionName: 'freeze_rubric_and_open_submissions',
    args: [],
  });

  let receipt: any = null;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash });
  } catch {
    // receipt polling fallback
  }

  return { txHash, receipt };
}

/**
 * Submit an evidence claim with URL, SHA-256 digest, and scope summary
 */
export async function submitClaim(
  client: any,
  contractAddress: string,
  params: {
    evidenceUrl: string;
    evidenceDigest: string;
    description: string;
  }
): Promise<{ txHash: string; receipt?: any }> {
  if (!client) throw new Error('Wallet client not initialized');
  const contractAddr = normalizeAddress(contractAddress);

  const txHash = await client.writeContract({
    address: contractAddr,
    functionName: 'submit_claim',
    args: [
      params.evidenceUrl.trim(),
      params.evidenceDigest.trim(),
      params.description.trim(),
    ],
  });

  let receipt: any = null;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash });
  } catch {
    // receipt polling fallback
  }

  return { txHash, receipt };
}

/**
 * Trigger GenLayer consensus assessment (gl.eq_principle.strict_eq) and Largest Remainder math
 */
export async function requestAssessment(
  client: any,
  contractAddress: string
): Promise<{ txHash: string; receipt?: any }> {
  if (!client) throw new Error('Wallet client not initialized');
  const contractAddr = normalizeAddress(contractAddress);

  const txHash = await client.writeContract({
    address: contractAddr,
    functionName: 'request_assessment',
    args: [],
  });

  let receipt: any = null;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash });
  } catch {
    // receipt polling fallback
  }

  return { txHash, receipt };
}
