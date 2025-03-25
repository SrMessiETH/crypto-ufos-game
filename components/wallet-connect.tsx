"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from 'lucide-react'
import { toast } from "sonner"

interface WalletConnectProps {
  onConnect: (wallet: string) => void
  onDisconnect: () => void
  isLoading?: boolean
}

export default function WalletConnect({ onConnect, onDisconnect, isLoading = false }: WalletConnectProps) {
  const [connected, setConnected] = useState<boolean>(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  
  // Use refs to prevent multiple connection attempts and callbacks
  const hasInitialized = useRef(false)
  const hasCalledOnConnect = useRef(false)
  const currentWalletAddress = useRef<string | null>(null)

  // Safe connect callback that prevents duplicate calls
  const safeOnConnect = useCallback((address: string) => {
    if (hasCalledOnConnect.current && currentWalletAddress.current === address) {
      return; // Prevent duplicate calls with the same address
    }
    
    currentWalletAddress.current = address;
    hasCalledOnConnect.current = true;
    onConnect(address);
  }, [onConnect]);

  // Safe disconnect callback
  const safeOnDisconnect = useCallback(() => {
    hasCalledOnConnect.current = false;
    currentWalletAddress.current = null;
    onDisconnect();
  }, [onDisconnect]);

  // Check if wallet is already connected on component mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const checkWalletConnection = async () => {
      try {
        if (typeof window !== "undefined") {
          const provider = window.phantom?.solana || window.solana

          if (provider?.isPhantom && provider?.isConnected && provider?.publicKey) {
            const address = provider.publicKey.toString()
            setWalletAddress(address)
            setConnected(true)
            safeOnConnect(address)
          }
        }
      } catch (error) {
        console.log("No pre-existing connection found")
      }
    }

    checkWalletConnection()
  }, [safeOnConnect]);

  // Set up event listeners for wallet connection changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const provider = window.phantom?.solana || window.solana
    if (!provider?.isPhantom) return;
    
    const handleConnect = (publicKey: any) => {
      if (publicKey) {
        const address = publicKey.toString()
        setWalletAddress(address)
        setConnected(true)
        safeOnConnect(address)
      }
    }

    const handleDisconnect = () => {
      setWalletAddress("")
      setConnected(false)
      safeOnDisconnect()
    }

    const handleAccountChange = () => {
      if (provider.publicKey) {
        const address = provider.publicKey.toString()
        setWalletAddress(address)
        safeOnConnect(address)
      } else {
        setWalletAddress("")
        setConnected(false)
        safeOnDisconnect()
      }
    }

    // Add event listeners
    provider.on("connect", handleConnect)
    provider.on("disconnect", handleDisconnect)
    provider.on("accountChanged", handleAccountChange)

    // Return cleanup function
    return () => {
      // Phantom doesn't provide a way to remove listeners
      // This is a limitation of the current Phantom API
    }
  }, [safeOnConnect, safeOnDisconnect]);

  const connectWallet = useCallback(async () => {
    if (isConnecting || isLoading) return;

    if (typeof window === "undefined") return;

    const provider = window.phantom?.solana || window.solana;

    if (!provider || !provider.isPhantom) {
      toast.error("Phantom wallet not found", {
        description: "Please install Phantom wallet extension and refresh the page.",
      });
      window.open("https://phantom.app/", "_blank");
      return;
    }

    setIsConnecting(true);

    try {
      // Use a timeout to prevent hanging if the wallet doesn't respond
      const connectWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Connection timeout")), 10000);
        });

        try {
          const result = await Promise.race([provider.connect(), timeoutPromise]);
          return result;
        } catch (error) {
          throw error;
        }
      };

      await connectWithTimeout();
      
      // Connection successful, wallet events will handle the rest
      // We don't call onConnect here because the event listener will do it
    } catch (error) {
      console.error("Error connecting to Phantom wallet:", error);

      // Check if it's a rate limit error
      const errorString = String(error);
      if (errorString.includes("rate limit")) {
        toast.error("Connection Rate Limited", {
          description: "Too many connection attempts. Please wait a moment and try again.",
        });
      } else {
        toast.error("Connection Failed", {
          description: "Could not connect to Phantom wallet. Please try again.",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isLoading]);

  const disconnectWallet = useCallback(async () => {
    if (isLoading) return;
    
    if (typeof window === "undefined") return;

    const provider = window.phantom?.solana || window.solana;

    if (!provider || !provider.isPhantom) return;

    try {
      await provider.disconnect();
      // We don't call onDisconnect here because the event listener will do it
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  }, [isLoading]);

  // Handle SSR
  if (typeof window === "undefined") {
    return null;
  }

  // Check if Phantom is installed
  const provider = window.phantom?.solana || window.solana;
  const isPhantomInstalled = provider && provider.isPhantom;

  if (!isPhantomInstalled) {
    return (
      <Button
        variant="outline"
        className="bg-purple-900 hover:bg-purple-800 text-white border-purple-700"
        onClick={() => window.open("https://phantom.app/", "_blank")}
      >
        <img src="/phantom-icon.png" alt="Phantom" className="w-5 h-5 mr-2" />
        Install Phantom
      </Button>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-300 hidden sm:block">
          {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
        </div>
        <Button
          variant="outline"
          className="bg-purple-900 hover:bg-purple-800 text-white border-purple-700"
          onClick={disconnectWallet}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <img src="/phantom-icon.png" alt="Phantom" className="w-5 h-5 mr-2" />
          )}
          {isLoading ? "Loading..." : "Disconnect"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="bg-purple-900 hover:bg-purple-800 text-white border-purple-700"
      onClick={connectWallet}
      disabled={isConnecting || isLoading}
    >
      {isConnecting || isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {isConnecting ? "Connecting..." : "Loading..."}
        </>
      ) : (
        <>
          <img src="/phantom-icon.png" alt="Phantom" className="w-5 h-5 mr-2" />
          Connect Wallet
        </>
      )}
    </Button>
  );
}

// Add TypeScript declaration for Phantom wallet
declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

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
