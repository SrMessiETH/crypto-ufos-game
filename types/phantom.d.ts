// Add TypeScript declaration for Phantom wallet
interface PhantomProvider {
  publicKey: { toString(): string } | null;
  isPhantom: boolean;
  isConnected: boolean;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signTransaction: (transaction: any) => Promise<any>;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args: any) => void) => void;
  request: (request: { method: string; params?: any }) => Promise<any>;
}

interface Window {
  solana?: PhantomProvider;
  phantom?: {
    solana?: PhantomProvider;
  };
}
