const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require(path.resolve(__dirname, '../frontend/node_modules/genlayer-js'));

const STUDIO_NEXT_RPC = 'https://studio-next.genlayer.com/api';
const STUDIO_NEXT_CHAIN_ID = 61997;

// Configure studioNextChain matching studioDevnet with ID 61997 and Studio Next RPC
const studioNextChain = {
  ...chains.studionet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: 'GenLayer Studio Next Testnet',
  rpcUrls: {
    default: { http: [STUDIO_NEXT_RPC] },
    public: { http: [STUDIO_NEXT_RPC] },
  },
};

const DEPLOYER_PRIVATE_KEY = '0xdd22642e2821e76b3c09a4926fee39ce8e8d2e1c9d2eb395d5fac63a35f460a1';

async function main() {
  console.log('--- MeritSplit Protocol Deployment to Studio Next ---');
  console.log('Target RPC:', STUDIO_NEXT_RPC);
  console.log('Chain ID:', STUDIO_NEXT_CHAIN_ID);

  const account = createAccount(DEPLOYER_PRIVATE_KEY);
  console.log('Deployer Address:', account.address);

  const client = createClient({
    chain: studioNextChain,
    account,
  });

  const contractPath = path.resolve(__dirname, '../contracts/merit_split.py');
  console.log('Reading contract from:', contractPath);
  const contractCode = fs.readFileSync(contractPath, 'utf8');

  console.log('Estimating transaction fees from Studio Next...');
  const feeEstimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });
  console.log('Fee Estimate derived successfully.');
  console.log('Fee value (wei):', feeEstimate.feeValue?.toString());

  console.log('Submitting deployContract transaction to GenLayer consensus...');
  const txHash = await client.deployContract({
    code: contractCode,
    fees: feeEstimate,
    args: ['MeritSplit Protocol', ''],
  });

  console.log('Deployment Transaction Hash:', txHash);
  console.log('Waiting for transaction finalization...');

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 60,
    interval: 3000,
  });

  console.log('Receipt received!');
  console.log('Status:', receipt.status);

  const tx = await client.getTransaction({ hash: txHash });
  console.log('Tx Execution Result:', tx.txExecutionResultName);
  console.log('Deployed Contract Recipient:', tx.recipient);

  const deployedAddress = tx.recipient || receipt.contractAddress || receipt.txDataDecoded?.contractAddress;

  if (tx.txExecutionResultName === 'FINISHED_WITH_RETURN' && deployedAddress) {
    console.log('\n==================================================');
    console.log('MERITSPLIT CONTRACT DEPLOYED & INITIALIZED ON-CHAIN!');
    console.log('Contract Address:', deployedAddress);
    console.log('Explorer URL: https://studio-next.genlayer.com/contracts/' + deployedAddress);
    console.log('==================================================\n');

    console.log('Verifying get_project_state via readContract...');
    const state = await client.readContract({
      address: deployedAddress,
      functionName: 'get_project_state',
      args: [],
    });
    console.log('Initial On-Chain State:', JSON.stringify(state, null, 2));
  } else {
    console.error('Deployment Failed with Execution Result:', tx.txExecutionResultName);
    if (tx.consensus_data?.leader_receipt?.[0]?.genvm_result) {
      console.error('stderr:', tx.consensus_data.leader_receipt[0].genvm_result.stderr);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nDeployment Error:', err);
  process.exit(1);
});
