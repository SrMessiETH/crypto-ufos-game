import { toast } from "sonner"

// Define the PhantomProvider type
interface PhantomProvider {
  connect: (args?: { onlyIfTrusted: boolean }) => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
  on: (event: PhantomEvent, callback: (args: any) => void) => void
  publicKey: { toString: () => string } | null
  isConnected: boolean
}

export type PhantomEvent = "connect" | "disconnect" | "accountChanged"

export const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window !== "undefined") {
    const provider = window.phantom?.solana || window.solana

    if (provider?.isPhantom) {
      return provider
    }
  }
  return null
}

export const connectPhantomWallet = async (): Promise<string | null> => {
  const provider = getPhantomProvider()

  if (!provider) {
    toast.error("Phantom wallet not found", {
      description: "Please install Phantom wallet extension and refresh the page.",
    })
    window.open("https://phantom.app/", "_blank")
    return null
  }

  try {
    // Pass an empty object to match the expected parameter structure
    const { publicKey } = await provider.connect({ onlyIfTrusted: false })
    return publicKey.toString()
  } catch (error) {
    console.error("Error connecting to Phantom wallet:", error)
    toast.error("Failed to connect wallet", {
      description: "Please try again or use a different wallet.",
    })
    return null
  }
}

export const disconnectPhantomWallet = async (): Promise<boolean> => {
  const provider = getPhantomProvider()

  if (!provider) {
    return false
  }

  try {
    await provider.disconnect()
    return true
  } catch (error) {
    console.error("Error disconnecting from Phantom wallet:", error)
    return false
  }
}

export const getConnectedWallet = (): string | null => {
  const provider = getPhantomProvider()

  if (!provider || !provider.isConnected || !provider.publicKey) {
    return null
  }

  return provider.publicKey.toString()
}

export const listenToWalletEvents = (onConnect: (publicKey: string) => void, onDisconnect: () => void) => {
  const provider = getPhantomProvider()

  if (!provider) {
    return () => {}
  }

  provider.on("connect", ({ publicKey }) => {
    if (publicKey) {
      onConnect(publicKey.toString())
    }
  })

  provider.on("disconnect", () => {
    onDisconnect()
  })

  // Return cleanup function
  return () => {
    // Phantom doesn't provide a way to remove listeners
    // This is a limitation of the current Phantom API
  }
}
