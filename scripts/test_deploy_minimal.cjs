const fs = require('fs');
const path = require('path');
const { createClient, createAccount, chains } = require(path.resolve(__dirname, '../frontend/node_modules/genlayer-js'));

const studioNextChain = {
  ...chains.studionet,
  id: 61997,
  name: 'GenLayer Studio Next Testnet',
  rpcUrls: {
    default: { http: ['https://studio-next.genlayer.com/api'] },
    public: { http: ['https://studio-next.genlayer.com/api'] },
  },
};

const account = createAccount('0xdd22642e2821e76b3c09a4926fee39ce8e8d2e1c9d2eb395d5fac63a35f460a1');
const client = createClient({ chain: studioNextChain, account });

async function main() {
  const code = `# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl

DynArray = gl.storage.DynArray
TreeMap = gl.storage.TreeMap
Address = gl.Address
u256 = gl.u256

class Minimal(gl.contract.Contract):
    contributors: DynArray[Address]
    scores: TreeMap[Address, u256]

    def __init__(self):
        pass

    @gl.public.view
    def get_count(self) -> int:
        return len(self.contributors)
`;

  const fees = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n,
    validatorTimeunitsAllocation: 250n,
    rotations: [1n],
    totalMessageFees: 0n,
  });

  console.log('Deploying Minimal contract...');
  const txHash = await client.deployContract({
    code,
    fees,
    args: [],
  });
  console.log('TxHash:', txHash);

  const receipt = await client.waitForTransactionReceipt({ hash: txHash, interval: 2000, retries: 40 });
  console.log('Receipt status:', receipt.status);

  const tx = await client.getTransaction({ hash: txHash });
  console.log('Execution result:', tx.txExecutionResultName);
  console.log('Recipient (contract address):', tx.recipient);

  if (tx.txExecutionResultName === 'FINISHED_WITH_RETURN') {
    console.log('Testing readContract on', tx.recipient);
    const res = await client.readContract({
      address: tx.recipient,
      functionName: 'get_count',
      args: [],
    });
    console.log('readContract result:', res);
  } else {
    console.error('stderr:', tx.consensus_data?.leader_receipt?.[0]?.genvm_result?.stderr);
  }
}

main().catch(console.error);
