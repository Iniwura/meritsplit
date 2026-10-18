import { useState, useEffect, useCallback } from 'react';
import { createClient, chains } from 'genlayer-js';
import { createTransactionKit } from '@genlayer/transaction-kit';
import { toast } from 'sonner';

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

// GenLayer chain object configured for Studio Next
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
};

/**
 * Computes client-side cryptographic SHA-256 digest of evidence data.
 * Used for tamper-proof evidence commitments before on-chain dispatch.
 */
export async function computeEvidenceDigest(evidenceUrl: string, description: string): Promise<string> {
  const payload = `${evidenceUrl.trim()}::${description.trim()}`;
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

/**
 * Parses raw GenLayer RPC or EVM errors into clean user-facing error strings.
 */
export function parseGenLayerError(err: unknown): string {
  if (!err) return 'Unknown transaction error';
  const raw = String((err as any)?.message || err);

  if (raw.includes('User rejected') || raw.includes('ACTION_REJECTED')) {
    return 'Transaction rejected by user in wallet.';
  }
  if (raw.includes('unregistered') || raw.includes('is not a registered contributor')) {
    return 'Unauthorized: Address is not a registered contributor for this project.';
  }
  if (raw.includes('Only creator') || raw.includes('creator')) {
    return 'Permission denied: Only the project creator can execute this action.';
  }
  if (raw.includes('State is not OPEN') || raw.includes('Can only freeze in OPEN state')) {
    return 'Invalid state: Rubric can only be frozen when state is OPEN.';
  }
  if (raw.includes('Submissions closed') || raw.includes('State is not SUBMISSIONS')) {
    return 'Invalid state: Submissions window is closed.';
  }
  if (raw.includes('consensus disagreement') || raw.includes('UNRESOLVED')) {
    return 'Fail-closed: Validators failed to reach consensus. State moved to UNRESOLVED.';
  }
  if (raw.includes('insufficient funds')) {
    return 'Insufficient GEN balance for gas.';
  }

  // Return clean trimmed message
  return raw.replace(/(\r\n|\n|\r)/gm, ' ').slice(0, 160);
}

export function useGenLayerWallet() {
  const [account, setAccount] = useState<string | null>(() => {
    return localStorage.getItem('meritsplit_connected_account') || null;
  });
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [txKit, setTxKit] = useState<any>(null);

  // Initialize client when provider and account are available
  const initClient = useCallback((walletAccount: string, ethereumProvider: any) => {
    try {
      const glClient = createClient({
        chain: studioNextChain as any,
        provider: ethereumProvider,
        account: walletAccount as any,
      });

      const kit = createTransactionKit({
        chain: studioNextChain as any,
        provider: ethereumProvider,
        account: walletAccount as any,
      });

      setClient(glClient);
      setTxKit(kit);
    } catch (e) {
      console.warn('GenLayer client initialization note:', e);
    }
  }, []);

  const switchOrAddNetwork = async (provider: any) => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GENLAYER_STUDIO_NEXT_CONFIG.chainIdHex }],
      });
    } catch (switchError: any) {
      // Error code 4902 indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: GENLAYER_STUDIO_NEXT_CONFIG.chainIdHex,
                chainName: GENLAYER_STUDIO_NEXT_CONFIG.chainName,
                rpcUrls: [GENLAYER_STUDIO_NEXT_CONFIG.rpcUrl],
                nativeCurrency: GENLAYER_STUDIO_NEXT_CONFIG.nativeCurrency,
                blockExplorerUrls: [GENLAYER_STUDIO_NEXT_CONFIG.blockExplorerUrl],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add GenLayer Studio Next network to wallet');
        }
      } else {
        throw switchError;
      }
    }
  };

  const connectWallet = async () => {
    const provider = (window as any).ethereum;
    if (!provider) {
      toast.error('MetaMask or Web3 wallet not detected', {
        description: 'Please install MetaMask to interact with GenLayer Intelligent Contracts.',
      });
      return null;
    }

    try {
      setIsConnecting(true);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected in wallet');
      }

      const selectedAccount = accounts[0];
      setAccount(selectedAccount);
      localStorage.setItem('meritsplit_connected_account', selectedAccount);

      // Verify chain
      try {
        await switchOrAddNetwork(provider);
      } catch (chainErr: any) {
        toast.warning('Network mismatch', {
          description: `Please switch your wallet to GenLayer Studio Next (Chain ID ${GENLAYER_STUDIO_NEXT_CONFIG.chainId}).`,
        });
      }

      initClient(selectedAccount, provider);

      toast.success('Wallet connected', {
        description: `Connected to ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)} on Studio Next.`,
      });

      return selectedAccount;
    } catch (err: any) {
      const msg = parseGenLayerError(err);
      toast.error('Connection failed', { description: msg });
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setClient(null);
    setTxKit(null);
    localStorage.removeItem('meritsplit_connected_account');
    toast.info('Wallet disconnected', {
      description: 'Session disconnected from MeritSplit protocol.',
    });
  };

  // Listen to provider events
  useEffect(() => {
    const provider = (window as any).ethereum;
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
      } else {
        const nextAccount = accounts[0];
        setAccount(nextAccount);
        localStorage.setItem('meritsplit_connected_account', nextAccount);
        initClient(nextAccount, provider);
        toast.info('Active account changed', {
          description: `Switched to ${nextAccount.slice(0, 6)}...${nextAccount.slice(-4)}.`,
        });
      }
    };

    const handleChainChanged = (hexChain: string) => {
      const parsedId = parseInt(hexChain, 16);
      setChainId(parsedId);
      if (parsedId !== GENLAYER_STUDIO_NEXT_CONFIG.chainId) {
        toast.warning('Network switched', {
          description: `Target network is GenLayer Studio Next (${GENLAYER_STUDIO_NEXT_CONFIG.chainId}). Current: ${parsedId}.`,
        });
      }
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    // Auto-reconnect if account stored
    const cached = localStorage.getItem('meritsplit_connected_account');
    if (cached) {
      provider
        .request({ method: 'eth_accounts' })
        .then((accs: string[]) => {
          if (accs && accs.some((a) => a.toLowerCase() === cached.toLowerCase())) {
            setAccount(cached);
            initClient(cached, provider);
          } else {
            localStorage.removeItem('meritsplit_connected_account');
            setAccount(null);
          }
        })
        .catch(() => {
          // ignore silent check failures
        });
    }

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [initClient]);

  return {
    account,
    chainId,
    isConnecting,
    isConnected: !!account,
    client,
    txKit,
    connectWallet,
    disconnectWallet,
  };
}
