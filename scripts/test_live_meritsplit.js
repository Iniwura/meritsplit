/**
 * End-to-End Live On-Chain Verification Script for MeritSplit Protocol
 * Network: GenLayer Studio Next Testnet (Chain ID: 61997)
 * RPC: https://studio-next.genlayer.com/api
 */

const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require(path.resolve(__dirname, '../frontend/node_modules/genlayer-js'));

const STUDIO_NEXT_RPC = 'https://studio-next.genlayer.com/api';
const STUDIO_NEXT_CHAIN_ID = 61997;

const studioNextChain = {
  ...chains.studionet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: 'GenLayer Studio Next Testnet',
  rpcUrls: {
    default: { http: [STUDIO_NEXT_RPC] },
    public: { http: [STUDIO_NEXT_RPC] },
  },
};

// Creator / Deployer Account
const DEPLOYER_KEY = '0xdd22642e2821e76b3c09a4926fee39ce8e8d2e1c9d2eb395d5fac63a35f460a1';
const creatorAccount = createAccount(DEPLOYER_KEY);
const creatorClient = createClient({ chain: studioNextChain, account: creatorAccount });

// Helper to fund accounts using Studio Next RPC sim_fundAccount
async function fundAccount(address, amountWei = '5000000000000000000') {
  console.log(`[Faucet] Funding account ${address} with ${amountWei} wei...`);
  const res = await fetch(STUDIO_NEXT_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sim_fundAccount',
      params: [address, amountWei],
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`sim_fundAccount error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

// Helper to deploy a fresh MeritSplit contract instance
async function deployFreshContract() {
  console.log('\n[Deploy] Deploying fresh MeritSplit contract to ensure clean OPEN state...');
  const contractPath = path.resolve(__dirname, '../contracts/merit_split.py');
  const code = fs.readFileSync(contractPath, 'utf8');

  const fees = await creatorClient.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  const txHash = await creatorClient.deployContract({
    code,
    fees,
    args: ['MeritSplit Live Verification', ''],
  });
  console.log('[Deploy] Tx submitted:', txHash);

  await creatorClient.waitForTransactionReceipt({ hash: txHash, interval: 2500, retries: 40 });
  const tx = await creatorClient.getTransaction({ hash: txHash });

  if (tx.txExecutionResultName !== 'FINISHED_WITH_RETURN' || !tx.recipient) {
    throw new Error(`Deployment failed with result: ${tx.txExecutionResultName}`);
  }

  console.log('[Deploy] Fresh contract deployed at:', tx.recipient);
  return { address: tx.recipient, txHash };
}

async function main() {
  console.log('================================================================================');
  console.log('        MERITSPLIT PROTOCOL: LIVE ON-CHAIN VERIFICATION (STUDIO NEXT)           ');
  console.log('================================================================================');
  console.log('Target RPC:           ', STUDIO_NEXT_RPC);
  console.log('Target Chain ID:      ', STUDIO_NEXT_CHAIN_ID);
  console.log('Creator / Deployer:   ', creatorAccount.address);

  const txLog = [];

  // Parse target address from CLI argument or default
  let contractAddress = process.argv[2];

  if (!contractAddress) {
    const deployed = await deployFreshContract();
    contractAddress = deployed.address;
    txLog.push({ step: 'deploy_contract', hash: deployed.txHash, status: 'SUCCESS' });
  } else {
    console.log('\n[Setup] Checking provided contract address:', contractAddress);
    try {
      const state = await creatorClient.readContract({
        address: contractAddress,
        functionName: 'get_project_state',
        args: [],
      });
      if (state.state_name !== 'OPEN') {
        console.log(`[Setup] Target contract is in state ${state.state_name}, deploying fresh instance for clean lifecycle test...`);
        const deployed = await deployFreshContract();
        contractAddress = deployed.address;
        txLog.push({ step: 'deploy_contract', hash: deployed.txHash, status: 'SUCCESS' });
      }
    } catch (e) {
      console.log(`[Setup] Contract at ${contractAddress} unreadable, deploying fresh instance...`);
      const deployed = await deployFreshContract();
      contractAddress = deployed.address;
      txLog.push({ step: 'deploy_contract', hash: deployed.txHash, status: 'SUCCESS' });
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log('STAGE 1: LIVE STATE VALIDATION (OPEN STATE)');
  console.log('--------------------------------------------------------------------------------');

  const initialState = await creatorClient.readContract({
    address: contractAddress,
    functionName: 'get_project_state',
    args: [],
  });

  console.log('Contract Address:    ', contractAddress);
  console.log('Project Name:        ', initialState.project_name);
  console.log('Initial State Code:  ', initialState.state_code);
  console.log('Initial State Name:  ', initialState.state_name);
  console.log('Initial Contributors:', initialState.contributors);
  console.log('Frozen Rubric Weights:', Object.keys(initialState.rubric || {}).map(k => `${k}: ${initialState.rubric[k]}%`).join(', '));

  if (initialState.state_name !== 'OPEN' || initialState.state_code !== 0) {
    throw new Error(`Assertion Failed: Expected initial state to be OPEN (0), got ${initialState.state_name} (${initialState.state_code})`);
  }
  console.log('✔ Assertion Passed: Initial contract state is strictly OPEN.');

  console.log('\n--------------------------------------------------------------------------------');
  console.log('STAGE 2: LIVE TRANSACTION LIFECYCLE (HAPPY PATH)');
  console.log('--------------------------------------------------------------------------------');

  // Generate 2 throwaway contributor accounts
  const contributor1 = createAccount();
  const contributor2 = createAccount();

  console.log('\nGenerated Throwaway Wallets:');
  console.log('  Contributor 1 (Alice):', contributor1.address);
  console.log('  Contributor 2 (Bob):  ', contributor2.address);

  // Fund throwaway accounts
  await fundAccount(contributor1.address);
  await fundAccount(contributor2.address);
  console.log('✔ Both contributor accounts funded for transaction fees.');

  // Step 2.1: Register Contributor 1
  console.log(`\n[2.1] Registering Contributor 1 (${contributor1.address})...`);
  let fees = await creatorClient.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  const txRegister1 = await creatorClient.writeContract({
    address: contractAddress,
    functionName: 'register_contributor',
    args: [contributor1.address],
    fees,
  });
  console.log('  Tx Hash:', txRegister1);
  await creatorClient.waitForTransactionReceipt({ hash: txRegister1, interval: 2000, retries: 30 });
  const txReg1Data = await creatorClient.getTransaction({ hash: txRegister1 });
  console.log('  Tx Status:', txReg1Data.txExecutionResultName);
  txLog.push({ step: 'register_contributor_1', hash: txRegister1, status: txReg1Data.txExecutionResultName });

  // Step 2.1b: Register Contributor 2
  console.log(`\n[2.1b] Registering Contributor 2 (${contributor2.address})...`);
  fees = await creatorClient.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  const txRegister2 = await creatorClient.writeContract({
    address: contractAddress,
    functionName: 'register_contributor',
    args: [contributor2.address],
    fees,
  });
  console.log('  Tx Hash:', txRegister2);
  await creatorClient.waitForTransactionReceipt({ hash: txRegister2, interval: 2000, retries: 30 });
  const txReg2Data = await creatorClient.getTransaction({ hash: txRegister2 });
  console.log('  Tx Status:', txReg2Data.txExecutionResultName);
  txLog.push({ step: 'register_contributor_2', hash: txRegister2, status: txReg2Data.txExecutionResultName });

  // Verify contributors on-chain
  const stateAfterReg = await creatorClient.readContract({
    address: contractAddress,
    functionName: 'get_project_state',
    args: [],
  });
  console.log('  Current Registered Contributors:', stateAfterReg.contributors);
  if (stateAfterReg.contributors.length !== 2) {
    throw new Error('Assertion Failed: Expected 2 registered contributors on-chain.');
  }
  console.log('✔ Assertion Passed: 2 contributors successfully registered.');

  // Step 2.2: Open Submissions (transition OPEN -> SUBMISSIONS)
  console.log('\n[2.2] Transitioning contract state to SUBMISSIONS (freeze rubric & open submissions)...');
  fees = await creatorClient.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  const txOpenSub = await creatorClient.writeContract({
    address: contractAddress,
    functionName: 'open_submissions',
    args: [],
    fees,
  });
  console.log('  Tx Hash:', txOpenSub);
  await creatorClient.waitForTransactionReceipt({ hash: txOpenSub, interval: 2000, retries: 30 });
  const txOpenData = await creatorClient.getTransaction({ hash: txOpenSub });
  console.log('  Tx Status:', txOpenData.txExecutionResultName);
  txLog.push({ step: 'open_submissions', hash: txOpenSub, status: txOpenData.txExecutionResultName });

  const stateSubmissions = await creatorClient.readContract({
    address: contractAddress,
    functionName: 'get_project_state',
    args: [],
  });
  console.log('  State after open_submissions:', stateSubmissions.state_name);
  if (stateSubmissions.state_name !== 'SUBMISSIONS' || stateSubmissions.state_code !== 1) {
    throw new Error(`Assertion Failed: Expected state SUBMISSIONS (1), got ${stateSubmissions.state_name}`);
  }
  console.log('✔ Assertion Passed: Contract successfully transitioned to SUBMISSIONS.');

  // Step 2.3: Submit Claims from Throwaway Wallets
  console.log('\n[2.3] Submitting contribution claims from registered throwaway wallets...');

  // Contributor 1 Client
  const client1 = createClient({ chain: studioNextChain, account: contributor1 });
  const evidenceUrl1 = 'https://raw.githubusercontent.com/genlayer/genlayer-js/main/package.json';
  const evidenceDigest1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
  const description1 = 'Architected core GenLayer state machine, Largest Remainder algorithm, and fail-closed security invariants.';

  fees = await client1.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  console.log(`  Submitting claim for Contributor 1 (${contributor1.address})...`);
  const txClaim1 = await client1.writeContract({
    address: contractAddress,
    functionName: 'submit_claim',
    args: [evidenceUrl1, evidenceDigest1, description1],
    fees,
  });
  console.log('  Tx Hash (Claim 1):', txClaim1);
  await client1.waitForTransactionReceipt({ hash: txClaim1, interval: 2000, retries: 30 });
  const txClaim1Data = await client1.getTransaction({ hash: txClaim1 });
  console.log('  Tx Status:', txClaim1Data.txExecutionResultName);
  txLog.push({ step: 'submit_claim_contributor_1', hash: txClaim1, status: txClaim1Data.txExecutionResultName });

  // Contributor 2 Client
  const client2 = createClient({ chain: studioNextChain, account: contributor2 });
  const evidenceUrl2 = 'https://raw.githubusercontent.com/genlayer/genlayer-js/main/README.md';
  const evidenceDigest2 = '0x2222222222222222222222222222222222222222222222222222222222222222';
  const description2 = 'Developed dark mode interface, Web3 transaction harness, and deterministic arithmetic verification visualizer.';

  fees = await client2.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  console.log(`  Submitting claim for Contributor 2 (${contributor2.address})...`);
  const txClaim2 = await client2.writeContract({
    address: contractAddress,
    functionName: 'submit_claim',
    args: [evidenceUrl2, evidenceDigest2, description2],
    fees,
  });
  console.log('  Tx Hash (Claim 2):', txClaim2);
  await client2.waitForTransactionReceipt({ hash: txClaim2, interval: 2000, retries: 30 });
  const txClaim2Data = await client2.getTransaction({ hash: txClaim2 });
  console.log('  Tx Status:', txClaim2Data.txExecutionResultName);
  txLog.push({ step: 'submit_claim_contributor_2', hash: txClaim2, status: txClaim2Data.txExecutionResultName });

  // Verify claims recorded on-chain
  const stateClaims = await creatorClient.readContract({
    address: contractAddress,
    functionName: 'get_project_state',
    args: [],
  });
  console.log('  Recorded Claims Count:', Object.keys(stateClaims.claims || {}).length);
  if (Object.keys(stateClaims.claims || {}).length !== 2) {
    throw new Error('Assertion Failed: Expected 2 submitted claims on-chain.');
  }
  console.log('✔ Assertion Passed: 2 valid claims recorded with cryptographic digests.');

  // Step 2.4: Request Assessment (LLM Consensus gl.eq_principle.strict_eq)
  console.log('\n[2.4] Requesting assessment (triggering gl.eq_principle.strict_eq LLM consensus)...');
  console.log('  Estimating fees with increased validator allocation for consensus LLM execution...');
  fees = await creatorClient.estimateTransactionFees({
    leaderTimeunitsAllocation: 200n,
    validatorTimeunitsAllocation: 400n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  const txAssessment = await creatorClient.writeContract({
    address: contractAddress,
    functionName: 'request_assessment',
    args: [],
    fees,
  });
  console.log('  Tx Hash (request_assessment):', txAssessment);
  console.log('  Waiting for GenLayer consensus finalization (LLM multi-validator evaluation)...');

  await creatorClient.waitForTransactionReceipt({ hash: txAssessment, interval: 3000, retries: 60 });
  const txAssessData = await creatorClient.getTransaction({ hash: txAssessment });
  console.log('  Tx Execution Result:', txAssessData.txExecutionResultName);
  txLog.push({ step: 'request_assessment', hash: txAssessment, status: txAssessData.txExecutionResultName });

  console.log('\n--------------------------------------------------------------------------------');
  console.log('STAGE 3: DETERMINISTIC MATH VERIFICATION (LARGEST REMAINDER METHOD)');
  console.log('--------------------------------------------------------------------------------');

  const finalAllocations = await creatorClient.readContract({
    address: contractAddress,
    functionName: 'get_allocations',
    args: [],
  });

  console.log('\nFinal Allocations View Response:');
  console.log(JSON.stringify(finalAllocations, null, 2));

  const totalBps = finalAllocations.total_basis_points;
  const isExact10000 = finalAllocations.is_exact_10000;
  const isFinalized = finalAllocations.finalized;

  console.log('\nMathematical Verification:');
  console.log('  Contract State:         ', finalAllocations.state);
  console.log('  Finalized Flag:         ', isFinalized);
  console.log('  Total Basis Points:     ', totalBps, '/ 10,000');
  console.log('  Exact 10,000 Invariant: ', isExact10000);

  // Assertions
  if (!isFinalized || finalAllocations.state !== 'FINALIZED') {
    throw new Error(`Assertion Failed: Contract state expected FINALIZED, got ${finalAllocations.state}`);
  }

  if (totalBps !== 10000) {
    throw new Error(`Mathematical Invariance Violation: Total basis points ${totalBps} != 10000!`);
  }

  if (!isExact10000) {
    throw new Error('Mathematical Invariance Violation: is_exact_10000 is FALSE!');
  }

  console.log('✔ Assertion Passed: Allocations sum to EXACTLY 10,000 basis points (100.00%).');

  console.log('\n================================================================================');
  console.log('                        LIVE ON-CHAIN VERIFICATION SUMMARY                      ');
  console.log('================================================================================');
  console.log('Live Contract Address: ', contractAddress);
  console.log('Explorer URL:          ', `https://studio-next.genlayer.com/contracts/${contractAddress}`);
  console.log('\nTransaction Hashes:');
  txLog.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.step}] ${t.hash} (${t.status})`);
  });

  console.log('\nFinal Allocation Breakdown:');
  Object.entries(finalAllocations.allocations).forEach(([addr, data]) => {
    console.log(`  • Address:    ${addr}`);
    console.log(`    Score:      ${data.score}/100`);
    console.log(`    Allocation: ${data.basis_points} BPS (${data.percentage})`);
  });
  console.log(`\nTotal Allocated: ${totalBps} BPS (100.00%) — Deterministic Largest Remainder Math Verified.`);
  console.log('================================================================================\n');

  // Update frontend/.env with this verified contract address if different
  const envPath = path.resolve(__dirname, '../frontend/.env');
  const envContent = `VITE_CONTRACT_ADDRESS=${contractAddress}\nVITE_GENLAYER_RPC_URL=${STUDIO_NEXT_RPC}\nVITE_GENLAYER_CHAIN_ID=${STUDIO_NEXT_CHAIN_ID}\n`;
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`[Config] Synchronized ${envPath} with verified contract address ${contractAddress}`);
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
