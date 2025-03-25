import type { PublicKey } from "@solana/web3.js"

export type PhantomEvent = "disconnect" | "connect" | "accountChanged"

export interface ConnectOpts {
  onlyIfTrusted: boolean
}

// We'll use the global PhantomProvider interface instead of redefining it here

// Define the PhantomProvider interface
export interface PhantomProvider {
  isPhantom: boolean
  publicKey: PublicKey | null
  isConnected: boolean
  connect: (opts?: ConnectOpts) => Promise<void>
  disconnect: () => Promise<void>
  on: (event: PhantomEvent, callback: (args: any) => void) => void
  request: (method: string, params: any) => Promise<any>
}

export const getPhantomProvider = (): PhantomProvider | undefined => {
  if (typeof window !== "undefined" && "solana" in window) {
    const provider = window.solana as any // Type assertion to 'any' to avoid TS errors
    if (provider?.isPhantom) return provider as PhantomProvider // Type assertion to PhantomProvider
  }
  return undefined
}

