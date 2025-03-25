"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Activity, ZoomIn, ZoomOut } from "lucide-react"
import { toast, Toaster } from "sonner"; // Add Toaster to imports
import { initializeApp } from "firebase/app"
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, setDoc } from "firebase/firestore"
import WalletConnect from "@/components/wallet-connect"

// Firebase configuration from environment variables
const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Game asset paths
const GAME_ASSETS = {
  background: "/Background.png",
  landMap: "/Landgg.png",
  batteryEmpty: "/Battery_Empty.png",
  batteryFull: "/Battery_Full.png",
  batteryBroken: "/Battery_Broken.png",
  batteryCharging: "/charging1.png",
  ice: "/Ice3.png",
  water: "/water.png",
  mineral: "/Mineral.png",
  coin: "/Coin_Anim.gif",
  powerCellCharger: "/PowerCellCharger.png",
  market: "/Marketgg.png",
  iceMiner: "/Ice_Miner.png",
  workshop: "/workshop.png",
  waterFilter: "/waterfilter.png",
  crown: "/crown.png",
  inventory: "/inventory.png",
  claim: "/claim.png",
  marketBg: "/marketbg.png",
  labBg: "/labbg.png",
  ufoLogo: "/UFO_v3.gif",
  buy: "/buy.png",
  sell: "/sell.png",
  phantomIcon: "/phantom-icon.png",
}

// Add these constants at the top of the file, after the GAME_ASSETS definition
const API_URL = "https://mainnet.helius-rpc.com/?api-key=3d0ad7ca-7869-4a97-9d3e-a57131ae89db"
const COLLECTION_ADDRESS = "53UVubjHQpC4RmUnDGU1PV3f2bYFk6GcWb3SgtYFMHTb"

// First, let's add a new interface for power cell slots and a function to determine available slots
// Add this after the determineUserTier function
interface PowerCellSlot {
  id: number
  isCharging: boolean
  isClaimable: boolean
  timeStamp: Date | null
  progress: number
}

// Function to determine how many power cell slots a user gets based on NFT count
function getPowerCellSlots(nftCount: number): number {
  if (nftCount >= 100) return 5
  if (nftCount >= 50) return 4
  if (nftCount >= 30) return 3
  if (nftCount >= 10) return 2
  return 1
}

// Define the type for user data
interface UserData {
  wallet: string
  name: string
  nfts: number
  ufos: number
  emptyPowerCell: number
  fullPowerCell: number
  brokenPowerCell: number
  ice: number
  water: number
  halite: number
  chargingPowerCell: number
  claimableFullPowerCell: number
  scavengerWorking: number
  scavengerWorkingEnd: number
  chargingWaterFilter: number
  claimableWater: number
  chargingWorkShop: number
  claimableEmptyPowerCell: number
  timeStamp: Date | null
  timeStampScavenger: Date | null
  timeStampW: Date | null
  timeStampS: Date | null
  timeStampDailyClaim: Date | null
  // New fields for multiple power cell slots
  powerCellSlots?: PowerCellSlot[]
}

// Default user data
const defaultUserData: UserData = {
  wallet: "",
  name: "Guest",
  nfts: 0,
  ufos: 100,
  emptyPowerCell: 1,
  fullPowerCell: 0,
  brokenPowerCell: 0,
  ice: 100,
  water: 0,
  halite: 0,
  chargingPowerCell: 0,
  claimableFullPowerCell: 0,
  scavengerWorking: 0,
  scavengerWorkingEnd: 0,
  chargingWaterFilter: 0,
  claimableWater: 0,
  chargingWorkShop: 0,
  claimableEmptyPowerCell: 0,
  timeStamp: null,
  timeStampScavenger: null,
  timeStampW: null,
  timeStampS: null,
  timeStampDailyClaim: null,
  powerCellSlots: [],
}

// For the first error, we need to define an interface for the asset items
// Add this interface before the fetchAssetsByGroup function:
interface AssetItem {
  ownership: {
    owner: string
  }
  [key: string]: any // For other properties we're not explicitly using
}

// Add these functions after the defaultUserData definition and before the CryptoUFOsGame component
// Fetch metadata for an NFT from the URI
async function fetchNFTMetadata(metadataURI: string) {
  try {
    const response = await fetch(metadataURI)
    const metadata = await response.json()
    return metadata
  } catch (error) {
    console.error("Error fetching metadata:", error)
    return null
  }
}

// Then modify the fetchAssetsByGroup function to use this type:
async function fetchAssetsByGroup(collectionAddress: string, publicKey: string) {
  try {
    let page: number | null = 1
    const ownedNFTs = []

    while (page) {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "my-id",
          method: "getAssetsByGroup",
          params: {
            groupKey: "collection",
            groupValue: collectionAddress,
            page: page,
            limit: 1000,
          },
        }),
      })

      const { result } = await response.json()
      if (result && result.items) {
        const ownedAssets = result.items.filter((item: AssetItem) => item.ownership.owner === publicKey)
        ownedNFTs.push(...ownedAssets)
      }

      if (result.total !== 1000) {
        page = null // Use null instead of false to exit the loop
      } else {
        page++
      }
    }

    return ownedNFTs.length // Return the count of NFTs owned
  } catch (error) {
    console.error("Error fetching assets by group:", error)
    return 0 // In case of error, return 0
  }
}

// Add a new function to determine user tier based on NFT count
function determineUserTier(nftCount: number) {
  if (nftCount >= 150) return 11
  if (nftCount >= 100) return 10
  if (nftCount >= 90) return 9
  if (nftCount >= 80) return 8
  if (nftCount >= 70) return 7
  if (nftCount >= 60) return 6
  if (nftCount >= 50) return 5
  if (nftCount >= 40) return 4
  if (nftCount >= 30) return 3
  if (nftCount >= 20) return 2
  if (nftCount >= 10) return 1
  return 0
}

export default function CryptoUFOsGame() {
  const [userData, setUserData] = useState<UserData>(defaultUserData)
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [isMarketOpen, setIsMarketOpen] = useState(false)
  const [isLaboratoryOpen, setIsLaboratoryOpen] = useState(false)
  const [activeMarketTab, setActiveMarketTab] = useState("buy")
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [transferAmount, setTransferAmount] = useState(0)
  const [transferWallet, setTransferWallet] = useState("")
  const [isNameFormOpen, setIsNameFormOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [progressBars, setProgressBars] = useState({
    powerCell: 0,
    scavenger: 0,
    waterFilter: 0,
    workshop: 0,
  })
  const [firebaseApp, setFirebaseApp] = useState<any>(null)
  const [firestore, setFirestore] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [walletConnected, setWalletConnected] = useState(false)
  const [isLoadingUserData, setIsLoadingUserData] = useState(false)
  const [powerCellSlots, setPowerCellSlots] = useState<PowerCellSlot[]>([])

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1)

  // Use refs to prevent multiple data loading attempts
  const isDataLoading = useRef(false)
  const currentWalletAddress = useRef<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const scrollLeft = useRef(0)
  const scrollTop = useRef(0)

  // Initialize Firebase
  useEffect(() => {
    try {
      const app = initializeApp(FIREBASE_CONFIG)
      const db = getFirestore(app)
      setFirebaseApp(app)
      setFirestore(db)
      setIsLoading(false)
    } catch (error) {
      console.error("Error initializing Firebase:", error)
      toast.error("Failed to connect to database", {
        description: "Using local data instead.",
        duration: 3000, // 3 seconds
      })
      setIsLoading(false)
    }
  }, [])

  // Handle wallet connection
  const handleWalletConnect = (walletAddress: string) => {
    // Prevent multiple simultaneous data loading attempts
    if (isDataLoading.current || currentWalletAddress.current === walletAddress) {
      return
    }

    isDataLoading.current = true
    currentWalletAddress.current = walletAddress

    setWalletConnected(true)
    setIsLoading(true)
    setIsLoadingUserData(true)

    try {
      if (firestore) {
        // Check if user exists in database
        const fetchUserData = async () => {
          try {
            // Fetch NFT count for the wallet
            let nftCount = 0
            try {
              if (typeof window !== "undefined" && window.solana?.publicKey) {
                const publicKey = window.solana.publicKey.toString()
                nftCount = await fetchAssetsByGroup(COLLECTION_ADDRESS, publicKey)
              }
            } catch (error) {
              console.error("Error fetching NFT data:", error)
            }

            const q = query(collection(firestore, "UFOSperWallet"), where("Wallet", "==", walletAddress))
            const querySnapshot = await getDocs(q)

            if (!querySnapshot.empty) {
              // User exists, load their data
              const docData = querySnapshot.docs[0].data()

              // Convert Firebase data to our UserData format
              const userData: UserData = {
                wallet: docData.Wallet || walletAddress,
                name: docData.Name || "Player",
                nfts: nftCount || docData.NFTs || 0, // Use fetched NFT count or fallback to stored value
                ufos: docData.UFOS || 100,
                emptyPowerCell: docData.EmptyPowerCell || 1,
                fullPowerCell: docData.FullPowerCell || 0,
                brokenPowerCell: docData.BrokenPowerCell || 0,
                ice: docData.Ice || 100,
                water: docData.Water || 0,
                halite: docData.Halite || 0,
                chargingPowerCell: docData.ChargingPowerCell || 0,
                claimableFullPowerCell: docData.ClaimableFullPowerCell || 0,
                scavengerWorking: docData.ScavengerWorking || 0,
                scavengerWorkingEnd: docData.ScavengerWorkingEnd || 0,
                chargingWaterFilter: docData.ChargingWaterFilter || 0,
                claimableWater: docData.ClaimableWater || 0,
                chargingWorkShop: docData.ChargingWorkShop || 0,
                claimableEmptyPowerCell: docData.ClaimableEmptyPowerCell || 0,
                timeStamp: docData.TimeStamp ? new Date(docData.TimeStamp.seconds * 1000) : null,
                timeStampScavenger: docData.TimeStampScavenger
                  ? new Date(docData.TimeStampScavenger.seconds * 1000)
                  : null,
                timeStampW: docData.TimeStampW ? new Date(docData.TimeStampW.seconds * 1000) : null,
                timeStampS: docData.TimeStampS ? new Date(docData.TimeStampS.seconds * 1000) : null,
                timeStampDailyClaim: docData.TimeStampDailyClaim
                  ? new Date(docData.TimeStampDailyClaim.seconds * 1000)
                  : null,
                // Load PowerCellSlots from database if they exist
                powerCellSlots: docData.PowerCellSlots
                  ? docData.PowerCellSlots.map((slot: any) => ({
                      ...slot,
                      timeStamp: slot.timeStamp ? new Date(slot.timeStamp.seconds * 1000) : null,
                    }))
                  : [],
              }

              // Update NFT count in database if it changed
              if (nftCount > 0 && nftCount !== docData.NFTs) {
                const docRef = doc(firestore, "UFOSperWallet", querySnapshot.docs[0].id)
                await updateDoc(docRef, {
                  NFTs: nftCount,
                })
              }

              setUserData(userData)
              // Also set the power cell slots directly
              if (userData.powerCellSlots && userData.powerCellSlots.length > 0) {
                setPowerCellSlots(userData.powerCellSlots)
              } else {
                // Initialize slots if they don't exist
                const availableSlots = getPowerCellSlots(userData.nfts)
                const newSlots = Array.from({ length: availableSlots }, (_, i) => ({
                  id: i,
                  isCharging: false,
                  isClaimable: false,
                  timeStamp: null,
                  progress: 0,
                }))
                setPowerCellSlots(newSlots)
              }

              toast.success("Data Loaded", {
                description: "Your game data has been loaded successfully.",
                duration: 3000, // 3 seconds
              })
            } else {
              // User doesn't exist, create new user
              const newUserData = {
                ...defaultUserData,
                wallet: walletAddress,
                nfts: nftCount || 0,
              }

              // Initialize power cell slots based on NFT count
              const availableSlots = getPowerCellSlots(newUserData.nfts)
              const initialSlots = Array.from({ length: availableSlots }, (_, i) => ({
                id: i,
                isCharging: false,
                isClaimable: false,
                timeStamp: null,
                progress: 0,
              }))

              newUserData.powerCellSlots = initialSlots
              setPowerCellSlots(initialSlots)

              // Create new user document
              await setDoc(doc(collection(firestore, "UFOSperWallet")), {
                Wallet: walletAddress,
                Name: newUserData.name,
                NFTs: newUserData.nfts,
                UFOS: newUserData.ufos,
                EmptyPowerCell: newUserData.emptyPowerCell,
                FullPowerCell: newUserData.fullPowerCell,
                BrokenPowerCell: newUserData.brokenPowerCell,
                Ice: newUserData.ice,
                Water: newUserData.water,
                Halite: newUserData.halite,
                ChargingPowerCell: newUserData.chargingPowerCell,
                ClaimableFullPowerCell: newUserData.claimableFullPowerCell,
                ScavengerWorking: newUserData.scavengerWorking,
                ScavengerWorkingEnd: newUserData.scavengerWorkingEnd,
                ChargingWaterFilter: newUserData.chargingWaterFilter,
                ClaimableWater: newUserData.claimableWater,
                ChargingWorkShop: newUserData.chargingWorkShop,
                ClaimableEmptyPowerCell: newUserData.claimableEmptyPowerCell,
                TimeStamp: null,
                TimeStampScavenger: null,
                TimeStampW: null,
                TimeStampS: null,
                TimeStampDailyClaim: null,
                PowerCellSlots: initialSlots,
              })

              setUserData(newUserData)
              toast.success("Welcome!", {
                description: "New account created. Let's start playing!",
                duration: 3000, // 3 seconds
              })
            }
          } catch (error) {
            console.error("Error in fetchUserData:", error)
            // Set default data with connected wallet on error
            setUserData({
              ...defaultUserData,
              wallet: walletAddress,
            })
            toast.error("Error loading data", {
              description: "Using default data instead.",
              duration: 3000, // 3 seconds
            })
          } finally {
            setIsLoading(false)
            setIsLoadingUserData(false)
            isDataLoading.current = false
          }
        }

        fetchUserData()
      } else {
        // No firestore, just set the wallet and default data
        setUserData({
          ...defaultUserData,
          wallet: walletAddress,
        })
        setIsLoading(false)
        setIsLoadingUserData(false)
        isDataLoading.current = false
      }
    } catch (error) {
      console.error("Error in handleWalletConnect:", error)
      // Set default data with connected wallet
      setUserData({
        ...defaultUserData,
        wallet: walletAddress,
      })
      setIsLoading(false)
      setIsLoadingUserData(false)
      isDataLoading.current = false
    }
  }

  // Handle wallet disconnect
  const handleWalletDisconnect = () => {
    setWalletConnected(false)
    setUserData(defaultUserData)
    setIsLoadingUserData(false)
    isDataLoading.current = false
    currentWalletAddress.current = null
  }

  // Replace the saveUserData function with this updated version:

  // Save user data to Firebase
  const saveUserData = async (updatedData: UserData) => {
    if (!firestore || !walletConnected) return

    try {
      const walletAddress = updatedData.wallet

      const q = query(collection(firestore, "UFOSperWallet"), where("Wallet", "==", walletAddress))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const docRef = doc(firestore, "UFOSperWallet", querySnapshot.docs[0].id)

        // Create a safe version of the data for Firestore
        // Use a Record type to allow any string keys
        const safeData: Record<string, any> = {
          Name: updatedData.name,
          UFOS: updatedData.ufos,
          EmptyPowerCell: updatedData.emptyPowerCell,
          FullPowerCell: updatedData.fullPowerCell,
          BrokenPowerCell: updatedData.brokenPowerCell,
          Ice: updatedData.ice,
          Water: updatedData.water,
          Halite: updatedData.halite,
          ChargingPowerCell: updatedData.chargingPowerCell,
          ClaimableFullPowerCell: updatedData.claimableFullPowerCell,
          ScavengerWorking: updatedData.scavengerWorking,
          ScavengerWorkingEnd: updatedData.scavengerWorking,
          ChargingWaterFilter: updatedData.chargingWaterFilter,
          ClaimableWater: updatedData.claimableWater,
          ChargingWorkShop: updatedData.chargingWorkShop,
          ClaimableEmptyPowerCell: updatedData.claimableEmptyPowerCell,
        }

        // Only add valid dates to the data object
        if (updatedData.timeStamp instanceof Date && !isNaN(updatedData.timeStamp.getTime())) {
          safeData.TimeStamp = updatedData.timeStamp
        }

        if (updatedData.timeStampScavenger instanceof Date && !isNaN(updatedData.timeStampScavenger.getTime())) {
          safeData.TimeStampScavenger = updatedData.timeStampScavenger
        }

        if (updatedData.timeStampW instanceof Date && !isNaN(updatedData.timeStampW.getTime())) {
          safeData.TimeStampW = updatedData.timeStampW
        }

        if (updatedData.timeStampS instanceof Date && !isNaN(updatedData.timeStampS.getTime())) {
          safeData.TimeStampS = updatedData.timeStampS
        }

        if (updatedData.timeStampDailyClaim instanceof Date && !isNaN(updatedData.timeStampDailyClaim.getTime())) {
          safeData.TimeStampDailyClaim = updatedData.timeStampDailyClaim
        }

        // Add PowerCellSlots if they exist and are valid
        if (updatedData.powerCellSlots && Array.isArray(updatedData.powerCellSlots)) {
          // Create a safe copy of the slots with valid dates
          const safePowerCellSlots = updatedData.powerCellSlots.map((slot) => {
            const safeSlot = { ...slot }
            // If timeStamp is invalid, set it to null
            if (!(safeSlot.timeStamp instanceof Date) || isNaN(safeSlot.timeStamp.getTime())) {
              safeSlot.timeStamp = null
            }
            return safeSlot
          })

          safeData.PowerCellSlots = safePowerCellSlots
        }

        // Update the document with the safe data
        await updateDoc(docRef, safeData)
      }
    } catch (error) {
      console.error("Error saving user data:", error)
      toast.error("Failed to save data to database", {
        description: "Your changes are only saved locally.",
        duration: 3000, // 3 seconds
      })
    }
  }

  // Update progress bars
  useEffect(() => {
    const interval = setInterval(() => {
      updateProgressBars()
    }, 1000)

    return () => clearInterval(interval)
  }, [userData, powerCellSlots])

  // Handle zoom with wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()

        // Determine zoom direction
        const delta = e.deltaY < 0 ? 0.1 : -0.1
        const newZoomLevel = Math.max(0.5, Math.min(2, zoomLevel + delta))

        setZoomLevel(newZoomLevel)
      }
    }

    // Add event listener for wheel events
    document.addEventListener("wheel", handleWheel, { passive: false })

    // Clean up
    return () => {
      document.removeEventListener("wheel", handleWheel)
    }
  }, [zoomLevel])

  // Zoom in function
  const zoomIn = () => {
    setZoomLevel(Math.min(2, zoomLevel + 0.1))
  }

  // Zoom out function
  const zoomOut = () => {
    setZoomLevel(Math.max(0.5, zoomLevel - 0.1))
  }

  // Remove the useEffect that initializes power cell slots since we now handle this in fetchUserData
  // Replace this useEffect:

  const updateProgressBars = () => {
    const now = new Date()

    // Update power cell slots progress
    const updatedSlots = powerCellSlots.map((slot) => {
      if (slot.isCharging && slot.timeStamp) {
        const elapsed = (now.getTime() - slot.timeStamp.getTime()) / 1000
        const total = 12 * 60 * 60
        const progress = Math.min(100, (elapsed / total) * 100)

        // Auto-complete if 100%
        if (progress >= 100) {
          handlePowerCellSlotComplete(slot.id)
          return {
            ...slot,
            isCharging: false,
            isClaimable: true,
            progress: 100,
          }
        }

        return {
          ...slot,
          progress,
        }
      }
      return slot
    })

    setPowerCellSlots(updatedSlots)

    // Original progress bars
    const powerCellElapsed = userData.timeStamp ? (now.getTime() - userData.timeStamp.getTime()) / 1000 : 0
    const powerCellTotal = 12 * 60 * 60
    const powerCellProgress = Math.min(100, (powerCellElapsed / powerCellTotal) * 100)

    // Scavenger (6 hours)
    const scavengerElapsed = userData.timeStampScavenger
      ? (now.getTime() - userData.timeStampScavenger.getTime()) / 1000
      : 0
    const scavengerTotal = 6 * 60 * 60
    const scavengerProgress = Math.min(100, (scavengerElapsed / scavengerTotal) * 100)

    // Water Filter (8 hours)
    const waterFilterElapsed = userData.timeStampW ? (now.getTime() - userData.timeStampW.getTime()) / 1000 : 0
    const waterFilterTotal = 8 * 60 * 60
    const waterFilterProgress = Math.min(100, (waterFilterElapsed / waterFilterTotal) * 100)

    // Workshop (10 hours)
    const workshopElapsed = userData.timeStampS ? (now.getTime() - userData.timeStampS.getTime()) / 1000 : 0
    const workshopTotal = 10 * 60 * 60
    const workshopProgress = Math.min(100, (workshopElapsed / workshopTotal) * 100)

    setProgressBars({
      powerCell: powerCellProgress,
      scavenger: scavengerProgress,
      waterFilter: waterFilterProgress,
      workshop: workshopProgress,
    })

    // Auto-complete processes
    if (powerCellProgress >= 100 && userData.chargingPowerCell > 0) {
      handlePowerCellComplete()
    }

    if (scavengerProgress >= 100 && userData.scavengerWorking > 0) {
      handleScavengerComplete()
    }

    if (waterFilterProgress >= 100 && userData.chargingWaterFilter > 0) {
      handleWaterFilterComplete()
    }

    if (workshopProgress >= 100 && userData.chargingWorkShop > 0) {
      handleWorkshopComplete()
    }
  }

  // Handle map dragging
  useEffect(() => {
    const mapElement = mapRef.current

    if (!mapElement) return

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true
      startX.current = e.pageX
      startY.current = e.pageY
      scrollLeft.current = mapElement.scrollLeft
      scrollTop.current = mapElement.scrollTop
      mapElement.style.cursor = "grabbing"
    }

    const handleMouseUp = () => {
      isDragging.current = false
      mapElement.style.cursor = "grab"
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return

      const x = e.pageX
      const y = e.pageY
      const walkX = (x - startX.current) * 2
      const walkY = (y - startY.current) * 2

      mapElement.scrollLeft = scrollLeft.current - walkX
      mapElement.scrollTop = scrollTop.current - walkY
    }

    mapElement.addEventListener("mousedown", handleMouseDown as unknown as EventListener)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousemove", handleMouseMove as unknown as EventListener)

    return () => {
      mapElement.removeEventListener("mousedown", handleMouseDown as unknown as EventListener)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("mousemove", handleMouseMove as unknown as EventListener)
    }
  }, [])

  // Game action handlers
  const handlePowerCellComplete = () => {
    const updatedUserData = {
      ...userData,
      chargingPowerCell: 0,
      claimableFullPowerCell: userData.claimableFullPowerCell + 1,
      timeStamp: null,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Charged!", {
      description: "Your power cell is now fully charged and ready to claim.",
      duration: 3000, // 3 seconds
    })
  }

  const handleScavengerComplete = () => {
    const iceFound = Math.floor(Math.random() * 200) + 200
    const ufosFound = Math.floor(Math.random() * 90) + 100
    const emptyPowerCellFound = Math.random() < 0.5 ? 1 : 0
    const brokenPowerCellFound = emptyPowerCellFound === 0 ? 1 : 0

    const updatedUserData = {
      ...userData,
      scavengerWorking: 0,
      scavengerWorkingEnd: 1,
      ice: userData.ice + iceFound,
      ufos: userData.ufos + ufosFound,
      emptyPowerCell: userData.emptyPowerCell + emptyPowerCellFound,
      brokenPowerCell: userData.brokenPowerCell + brokenPowerCellFound,
      timeStampScavenger: null,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Ice Mining Complete!", {
      description: `Found ${iceFound} Ice and ${ufosFound} UFOS!`,
      duration: 3000, // 3 seconds
    })
  }

  const handleWaterFilterComplete = () => {
    const updatedUserData = {
      ...userData,
      chargingWaterFilter: 0,
      claimableWater: 1,
      timeStampW: null,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Water Filtering Complete!", {
      description: "Your water filter has finished processing.",  
      duration: 3000, // 3 seconds   
    })
  }

  const handleWorkshopComplete = () => {
    const updatedUserData = {
      ...userData,
      chargingWorkShop: 0,
      claimableEmptyPowerCell: 1,
      timeStampS: null,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Workshop Complete!", {
      description: "Your workshop has finished repairing power cells.",
      duration: 3000, // 3 seconds
    })
  }

  const startPowerCellCharging = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.emptyPowerCell < 1) {
      toast.error("Not Enough Empty Power Cells", {
        description: "You need at least one empty power cell to start charging.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.chargingPowerCell > 0) {
      toast.error("Already Charging", {
        description: "You already have a power cell charging.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      emptyPowerCell: userData.emptyPowerCell - 1,
      chargingPowerCell: 1,
      timeStamp: new Date(),
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Charging Started", {
      description: "Your power cell will be ready in 12 hours.",
      duration: 3000, // 3 seconds
    })
  }

  const claimFullPowerCell = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.claimableFullPowerCell < 1) {
      toast.error("No Power Cells to Claim", {
        description: "You don't have any fully charged power cells to claim.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      claimableFullPowerCell: userData.claimableFullPowerCell - 1,
      fullPowerCell: userData.fullPowerCell + 1,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Claimed", {
      description: "You've claimed a fully charged power cell!",
      duration: 3000, // 3 seconds
    })
  }

  const startScavenger = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.fullPowerCell < 1) {
      toast.error("Not Enough Full Power Cells", {
        description: "You need at least one full power cell to start the ice miner.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.scavengerWorking > 0) {
      toast.error("Already Mining", {
        description: "Your ice miner is already working.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      fullPowerCell: userData.fullPowerCell - 1,
      scavengerWorking: 1,
      timeStampScavenger: new Date(),
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Ice Mining Started", {
      description: "Your ice miner will complete in 6 hours.",
      duration: 3000, // 3 seconds
    })
  }

  const claimScavengerResults = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.scavengerWorkingEnd < 1) {
      toast.error("Nothing to Claim", {
        description: "Your ice miner hasn't completed its work yet.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      scavengerWorkingEnd: 0,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Mining Results Claimed", {
      description: "You've claimed your ice mining results!",
      duration: 3000, // 3 seconds
    })
  }

  const startWaterFilter = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.fullPowerCell < 1 || userData.ice < 1000) {
      toast.error("Insufficient Resources", {
        description: "You need 1 full power cell and 1000 ice to start the water filter.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.chargingWaterFilter > 0) {
      toast.error("Already Filtering", {
        description: "Your water filter is already working.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      fullPowerCell: userData.fullPowerCell - 1,
      ice: userData.ice - 1000,
      chargingWaterFilter: 1,
      timeStampW: new Date(),
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Water Filtering Started", {
      description: "Your water filter will complete in 8 hours.",
      duration: 3000, // 3 seconds
    })
  }

  const claimWaterFilterResults = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.claimableWater < 1) {
      toast.error("Nothing to Claim", {
        description: "Your water filter hasn't completed its work yet.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const waterGained = Math.floor(Math.random() * 5) + 1
    const haliteGained = Math.floor(Math.random() * 2) + 1
    const emptyPowerCellGained = Math.random() < 0.5 ? 1 : 0
    const brokenPowerCellGained = emptyPowerCellGained === 0 ? 1 : 0

    const updatedUserData = {
      ...userData,
      claimableWater: 0,
      water: userData.water + waterGained,
      halite: userData.halite + haliteGained,
      emptyPowerCell: userData.emptyPowerCell + emptyPowerCellGained,
      brokenPowerCell: userData.brokenPowerCell + brokenPowerCellGained,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Water Filter Results Claimed", {
      description: `You gained ${waterGained} water and ${haliteGained} minerals!`,
      duration: 3000, // 3 seconds
    })
  }

  const startWorkshop = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.fullPowerCell < 1 || userData.brokenPowerCell < 10 || userData.water < 5 || userData.halite < 2) {
      toast.error("Insufficient Resources", {
        description: "You need 1 full power cell, 10 broken power cells, 5 water, and 2 minerals.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.chargingWorkShop > 0) {
      toast.error("Already Working", {
        description: "Your workshop is already repairing power cells.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      fullPowerCell: userData.fullPowerCell - 1,
      brokenPowerCell: userData.brokenPowerCell - 10,
      water: userData.water - 5,
      halite: userData.halite - 2,
      chargingWorkShop: 1,
      timeStampS: new Date(),
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Workshop Started", {
      description: "Your workshop will complete repairs in 10 hours.",
      duration: 3000, // 3 seconds
    })
  }

  const claimWorkshopResults = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.claimableEmptyPowerCell < 1) {
      toast.error("Nothing to Claim", {
        description: "Your workshop hasn't completed its work yet.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const emptyPowerCellGained = Math.random() < 0.5 ? 2 : 1
    const brokenPowerCellGained = Math.random() < 0.3 ? 1 : 0

    const updatedUserData = {
      ...userData,
      claimableEmptyPowerCell: 0,
      emptyPowerCell: userData.emptyPowerCell + emptyPowerCellGained,
      brokenPowerCell: userData.brokenPowerCell + brokenPowerCellGained,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Workshop Results Claimed", {
      description: `You gained ${emptyPowerCellGained} empty power cells!`,
      duration: 3000, // 3 seconds
    })
  }

  const buyEmptyPowerCell = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.ufos < 50) {
      toast.error("Not Enough UFOS", {
        description: "You need 50 UFOS to buy an empty power cell.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      ufos: userData.ufos - 50,
      emptyPowerCell: userData.emptyPowerCell + 1,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Purchase Successful", {
      description: "You bought 1 empty power cell for 50 UFOS.",
      duration: 3000, // 3 seconds
    })
  }

  const sellFullPowerCell = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.fullPowerCell < 1) {
      toast.error("Not Enough Full Power Cells", {
        description: "You need at least one full power cell to sell.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      fullPowerCell: userData.fullPowerCell - 1,
      ufos: userData.ufos + 100,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Sale Successful", {
      description: "You sold 1 full power cell for 100 UFOS.",
      duration: 3000, // 3 seconds
    })
  }

  // Modify the claimDailyReward function to use the NFT count for reward calculation
  const claimDailyReward = () => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const now = new Date()
    const lastClaim = userData.timeStampDailyClaim || new Date(0)
    const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastClaim < 24) {
      const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim)
      toast.error("Daily Reward Not Available", {
        description: `You can claim again in ${hoursRemaining} hours.`,
        duration: 3000, // 3 seconds
      })
      return
    }

    // Calculate reward based on NFT count
    const tier = determineUserTier(userData.nfts)
    const rewardAmount = userData.nfts * 5 + tier * 10 // Base reward plus tier bonus

    const updatedUserData = {
      ...userData,
      ufos: userData.ufos + rewardAmount,
      timeStampDailyClaim: new Date(),
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Daily Reward Claimed", {
      description: `You received ${rewardAmount} UFOS for holding ${userData.nfts} Crypto UFOs NFTs!`,
      duration: 3000, // 3 seconds
    })
  }

  const handleTransferUfos = async (e: FormEvent) => {
    e.preventDefault()

    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (transferWallet === userData.wallet) {
      toast.error("Invalid Transfer", {
        description: "You cannot transfer UFOS to yourself.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (transferAmount <= 0 || transferAmount > userData.ufos) {
      toast.error("Invalid Amount", {
        description: "Please enter a valid amount to transfer.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (!firestore) {
      toast.error("Database Not Connected", {
        description: "Cannot transfer UFOS without database connection.",
        duration: 3000, // 3 seconds
      })
      return
    }

    try {
      // Check if recipient wallet exists
      const q = query(collection(firestore, "UFOSperWallet"), where("Wallet", "==", transferWallet))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        toast.error("Recipient Not Found", {
          description: "The recipient wallet does not exist in the database.",
          duration: 3000, // 3 seconds
        })
        return
      }

      // Get recipient data
      const recipientData = querySnapshot.docs[0].data()
      const recipientDocRef = doc(firestore, "UFOSperWallet", querySnapshot.docs[0].id)

      // Update sender's UFOS
      const updatedUserData = {
        ...userData,
        ufos: userData.ufos - transferAmount,
      }

      setUserData(updatedUserData)
      saveUserData(updatedUserData)

      // Update recipient's UFOS
      await updateDoc(recipientDocRef, {
        UFOS: (recipientData.UFOS || 0) + transferAmount,
      })

      toast("Transfer Successful", {
        description: `You transferred ${transferAmount} UFOS to ${transferWallet.substring(0, 6)}...`,
        duration: 3000, // 3 seconds
      })

      setIsTransferFormOpen(false)
      setTransferAmount(0)
      setTransferWallet("")
    } catch (error) {
      console.error("Error transferring UFOS:", error)
      toast.error("Transfer Failed", {
        description: "There was an error processing your transfer.",
        duration: 3000, // 3 seconds
      })
    }
  }

  const handleChangeName = async (e: FormEvent) => {
    e.preventDefault()

    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (!newName.trim()) {
      toast.error("Invalid Name", {
        description: "Please enter a valid name.",
        duration: 3000, // 3 seconds
      })
      return
    }

    const updatedUserData = {
      ...userData,
      name: newName,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Name Changed", {
      description: `Your name has been updated to ${newName}.`,
      duration: 3000, // 3 seconds
    })

    setIsNameFormOpen(false)
    setNewName("")
  }

  // Format time remaining for progress bars
  const formatTimeRemaining = (progress: number, totalHours: number) => {
    if (progress >= 100) return "Complete!"

    const totalSeconds = totalHours * 3600
    const remainingSeconds = totalSeconds * (1 - progress / 100)
    const hours = Math.floor(remainingSeconds / 3600)
    const minutes = Math.floor((remainingSeconds % 3600) / 60)
    const seconds = Math.floor(remainingSeconds % 60)

    return `${hours}h ${minutes}m ${seconds}s`
  }

  // Helper function to get the correct battery image based on state
  const getBatteryImage = (isCharging: boolean, isClaimable: boolean) => {
    if (isCharging) return GAME_ASSETS.batteryCharging
    if (isClaimable) return GAME_ASSETS.batteryFull
    return GAME_ASSETS.batteryEmpty
  }

  const handlePowerCellSlotComplete = (slotId: number) => {
    const updatedSlots = powerCellSlots.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          isCharging: false,
          isClaimable: true,
          timeStamp: null,
        }
      }
      return slot
    })

    setPowerCellSlots(updatedSlots)

    // Update user data
    const updatedUserData = {
      ...userData,
      powerCellSlots: updatedSlots,
      claimableFullPowerCell: userData.claimableFullPowerCell + 1,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Charged!", {
      description: "Your power cell is now fully charged and ready to claim.",
      duration: 3000, // 3 seconds
    })
  }

  const startPowerCellSlotCharging = (slotId: number) => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (userData.emptyPowerCell < 1) {
      toast.error("Not Enough Empty Power Cells", {
        description: "You need at least one empty power cell to start charging.",
        duration: 3000, // 3 seconds
      })
      return
    }

    // Check if this slot is already charging or claimable
    const slot = powerCellSlots.find((s) => s.id === slotId)
    if (slot?.isCharging) {
      toast.error("Already Charging", {
        description: "This slot is already charging a power cell.",
        duration: 3000, // 3 seconds
      })
      return
    }

    if (slot?.isClaimable) {
      toast.error("Claim First", {
        description: "Please claim the charged power cell first.",
        duration: 3000, // 3 seconds
      })
      return
    }

    // Update the slot
    const updatedSlots = powerCellSlots.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          isCharging: true,
          isClaimable: false,
          timeStamp: new Date(),
          progress: 0,
        }
      }
      return slot
    })

    setPowerCellSlots(updatedSlots)

    // Update user data
    const updatedUserData = {
      ...userData,
      emptyPowerCell: userData.emptyPowerCell - 1,
      powerCellSlots: updatedSlots,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Charging Started", {
      description: "Your power cell will be ready in 12 hours.",
      duration: 3000, // 3 seconds
    })
  }

  const claimPowerCellSlot = (slotId: number) => {
    if (!walletConnected) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet to play the game.",
        duration: 3000, // 3 seconds
      })
      return
    }

    // Check if this slot has a claimable power cell
    const slot = powerCellSlots.find((s) => s.id === slotId)
    if (!slot?.isClaimable) {
      toast.error("Nothing to Claim", {
        description: "This slot doesn't have a fully charged power cell to claim.",
        duration: 3000, // 3 seconds
      })
      return
    }

    // Update the slot
    const updatedSlots = powerCellSlots.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          isCharging: false,
          isClaimable: false,
          timeStamp: null,
          progress: 0,
        }
      }
      return slot
    })

    setPowerCellSlots(updatedSlots)

    // Update user data
    const updatedUserData = {
      ...userData,
      fullPowerCell: userData.fullPowerCell + 1,
      claimableFullPowerCell: userData.claimableFullPowerCell - 1,
      powerCellSlots: updatedSlots,
    }

    setUserData(updatedUserData)
    saveUserData(updatedUserData)

    toast("Power Cell Claimed", {
      description: "You've claimed a fully charged power cell!",
      duration: 3000, // 3 seconds
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading game data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Add the Toaster component here */}
      <Toaster richColors position="top-right" />
      
      {/* Wallet Connection */}
      <div className="fixed top-5 left-5 z-50">
        <WalletConnect
          onConnect={handleWalletConnect}
          onDisconnect={handleWalletDisconnect}
          isLoading={isLoadingUserData || isLoading}
        />
      </div>

      {/* Zoom Controls */}
      <div className="fixed bottom-5 right-5 z-50 flex gap-2">
        <Button variant="outline" size="icon" onClick={zoomIn} className="bg-black/50 hover:bg-black/70">
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={zoomOut} className="bg-black/50 hover:bg-black/70">
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Game map */}
      <div ref={mapContainerRef} className="relative w-full h-screen overflow-hidden">
        <div
          ref={mapRef}
          className="relative w-full h-screen overflow-auto cursor-grab"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: "transform 0.1s ease-out",
          }}
        >
          <div
            className="relative w-[5000px] h-[5000px]"
            style={{
              backgroundImage: `url(${GAME_ASSETS.background})`,
              backgroundSize: "cover",
              backgroundRepeat: "repeat",
            }}
          >
            {/* Game buildings */}
            <div
              className="absolute top-[100px] left-[800px] w-[1000px] h-[1000px] bg-contain bg-no-repeat"
              style={{ backgroundImage: `url(${GAME_ASSETS.landMap})` }}
            >
              {/* Laboratory */}
              <Button
                variant="ghost"
                className="absolute top-[250px] left-[100px] w-[250px] h-[250px] bg-contain bg-no-repeat hover:scale-105 transition-transform"
                onClick={() => setIsLaboratoryOpen(true)}
                style={{
                  backgroundImage: `url(${GAME_ASSETS.powerCellCharger})`,
                  background: "cover", // Ensures the background image fully covers the button
                  backgroundColor: "transparent",
                }}
              />

              {/* Market */}
              <Button
                variant="ghost"
                className="absolute top-[50px] left-[450px] w-[250px] h-[250px] bg-contain bg-no-repeat hover:scale-105 transition-transform"
                onClick={() => setIsMarketOpen(true)}
                style={{ backgroundImage: `url(${GAME_ASSETS.market})`, backgroundColor: "transparent" }}
              />

              {/* Scavenger */}
              <Button
                variant="ghost"
                className="absolute top-[450px] left-[500px] w-[200px] h-[200px] bg-contain bg-no-repeat hover:scale-105 transition-transform"
                onClick={userData.scavengerWorkingEnd > 0 ? claimScavengerResults : startScavenger}
                style={{ backgroundImage: `url(${GAME_ASSETS.iceMiner})`, backgroundColor: "transparent" }}
              />

              {/* Workshop */}
              <Button
                variant="ghost"
                className="absolute top-[350px] left-[300px] w-[250px] h-[250px] bg-contain bg-no-repeat hover:scale-105 transition-transform"
                onClick={userData.claimableEmptyPowerCell > 0 ? claimWorkshopResults : startWorkshop}
                style={{ backgroundImage: `url(${GAME_ASSETS.workshop})`, backgroundColor: "transparent" }}
              />

              {/* Water Filter */}
              <Button
                variant="ghost"
                className="absolute top-[300px] left-[700px] w-[200px] h-[200px] bg-contain bg-no-repeat hover:scale-105 transition-transform"
                onClick={userData.claimableWater > 0 ? claimWaterFilterResults : startWaterFilter}
                style={{ backgroundImage: `url(${GAME_ASSETS.waterFilter})`, backgroundColor: "transparent" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Info Panel */}
      <Card className="fixed top-5 right-5 w-[300px] bg-white/40 border-white text-black z-50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-green-400">{userData.name || "Player"}</h3>
            <Button variant="outline" size="sm" onClick={() => setIsNameFormOpen(true)}>
              Change Name
            </Button>
          </div>

          <p className="text-sm mb-2">NFTs: {userData.nfts}</p>
          <p className="text-sm mb-2">
            Tier: {determineUserTier(userData.nfts)}
            <span className="text-xs text-gray-400 ml-1">
              ({userData.nfts >= 150 ? "Max Tier Reached" : `${((determineUserTier(userData.nfts) + 1)*10) - userData.nfts} more NFTs to next tier`})
            </span>
          </p>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              <img src={GAME_ASSETS.coin || "/placeholder.svg"} alt="UFOS" className="w-6 h-6 animate-pulse" />
              <span className="ml-1 text-yellow-400">{userData.ufos}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsTransferFormOpen(true)}>
              Transfer
            </Button>
            <Button variant="outline" size="sm" onClick={claimDailyReward}>
              <img src={GAME_ASSETS.claim || "/placeholder.svg"} alt="Claim" className="w-5 h-5" />
            </Button>
          </div>

          <Button variant="outline" className="w-full mb-2" onClick={() => setIsInventoryOpen(!isInventoryOpen)}>
            {isInventoryOpen ? "Hide Inventory" : "Show Inventory"}
            <img src={GAME_ASSETS.inventory || "/placeholder.svg"} alt="Inventory" className="w-5 h-5 ml-2" />
          </Button>

          {isInventoryOpen && (
            <div className="mt-2 space-y-2 p-2 bg-gray-500 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src={GAME_ASSETS.batteryEmpty || "/placeholder.svg"}
                    alt="Empty Power Cells"
                    className="w-10 h-10 mr-1"
                  />
                  <span>Empty Cells:</span>
                </div>
                <span>{userData.emptyPowerCell}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src={GAME_ASSETS.batteryFull || "/placeholder.svg"}
                    alt="Full Power Cells"
                    className="w-10 h-10 mr-1"
                  />
                  <span>Full Cells:</span>
                </div>
                <span>{userData.fullPowerCell}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src={GAME_ASSETS.batteryBroken || "/placeholder.svg"}
                    alt="Broken Power Cells"
                    className="w-10 h-10 mr-1"
                  />
                  <span>Broken Cells:</span>
                </div>
                <span>{userData.brokenPowerCell}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img src={GAME_ASSETS.ice || "/placeholder.svg"} alt="Ice" className="w-10 h-10 mr-1" />
                  <span>Ice:</span>
                </div>
                <span>{userData.ice}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img src={GAME_ASSETS.water || "/placeholder.svg"} alt="Water" className="w-10 h-10 mr-1" />
                  <span>Water:</span>
                </div>
                <span>{userData.water}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img src={GAME_ASSETS.mineral || "/placeholder.svg"} alt="Minerals" className="w-10 h-10 mr-1" />
                  <span>Minerals:</span>
                </div>
                <span>{userData.halite}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard Button */}
      <Button
      variant="ghost"
      className="fixed top-20 left-5 bg-transparent z-50 bg-contain bg-no-repeat hover:scale-105 transition-transform w-25 h-25"
      style={{ backgroundImage: `url(${GAME_ASSETS.crown})`, backgroundColor: "transparent" }}
      onClick={() => (window.location.href = "/leaderboard")}
      >
      </Button>

      {/* Laboratory Modal */}
      {isLaboratoryOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card
            className="w-[600px] bg-white/70 border-white"
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-green-400">Power Cell Charger</h2>
                  <p className="text-sm text-red-400">
                    {getPowerCellSlots(userData.nfts)} slots available (Tier {determineUserTier(userData.nfts)})
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsLaboratoryOpen(false)}>
                  X
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {powerCellSlots.map((slot) => (
                  <div key={slot.id} className="relative">
                    <Button
                      variant="ghost"
                      className="w-full h-[80px] bg-transparent border border-gray-700 rounded-md flex items-center justify-center"
                      onClick={() =>
                        slot.isClaimable ? claimPowerCellSlot(slot.id) : startPowerCellSlotCharging(slot.id)
                      }
                    >
                      <img
                        src={
                          getBatteryImage(slot.isCharging, slot.isClaimable) || "/placeholder.svg" || "/placeholder.svg"
                        }
                        alt="Power Cell"
                        className="w-24 h-24"
                        style={{
                          animation: slot.isCharging ? "pulse 2s infinite" : "none",
                        }}
                      />
                    </Button>

                    {slot.isCharging && (
                    <div className="mt-2">
                    <Progress 
                    value={slot.progress} 
                    className="h-2 w-full bg-gray-700 [&>div]:bg-green-500" 
                    />
                    <p className="text-xs mt-1">{formatTimeRemaining(slot.progress, 12)}</p>
                    </div>
                    )}

                    <div className="absolute top-1 left-1 bg-black/30 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {slot.id + 1}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-black/60 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-medium">Resources</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center">
                        <img
                          src={GAME_ASSETS.batteryEmpty || "/placeholder.svg"}
                          alt="Empty"
                          className="w-15 h-15"
                        />
                        <span className="text-xs">{userData.emptyPowerCell}</span>
                      </div>
                      <div className="flex items-center">
                        <img src={GAME_ASSETS.batteryFull || "/placeholder.svg"} alt="Full" className="w-15 h-15" />
                        <span className="text-xs">{userData.fullPowerCell}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">
                      Collect more Crypto UFOs NFTs to unlock additional charging slots!
                    </p>
                    <div className="flex items-center mt-1">
                      <span className="text-xs mr-2">NFTs: {userData.nfts}</span>
                      <Progress value={(userData.nfts / 100) * 100} className="w-24 h-2 [&>div]:bg-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Modal */}
      {isMarketOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card
            className="w-[500px] bg-black border-white"
            style={{
              backgroundImage: `url(${GAME_ASSETS.marketBg})`,
              backgroundSize: "cover",
            }}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-amber-400 ">Market</h2>
                <Button
  variant="ghost"
  size="sm"
  onClick={() => setIsMarketOpen(false)}
  className="text-white hover:text-black"
>
  X
</Button>

              </div>

              <Tabs defaultValue="buy" onValueChange={setActiveMarketTab}>
                <TabsList className="grid w-full grid-cols-2 text-gray-500">
                  <TabsTrigger value="buy" className="flex items-center justify-center text-grey-500">
                    <img src={GAME_ASSETS.buy || "/placeholder.svg"} alt="Buy" className="w-8 h-8 mr-4" />
                    Buy
                  </TabsTrigger>
                  <TabsTrigger value="sell" className="flex items-center justify-center">
                    <img src={GAME_ASSETS.sell || "/placeholder.svg"} alt="Sell" className="w-8 h-8 mr-2" />
                    Sell
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="buy" className="mt-4">
                  <div className="flex items-center justify-between p-4 border border-gray-700 rounded-md">
                    <div className="flex items-center">
                      <img
                        src={GAME_ASSETS.batteryEmpty || "/placeholder.svg"}
                        alt="Empty Power Cell"
                        className="w-24 h-24 mr-4"
                      />
                      <div>
                        <h3 className="text-xl font-medium text-l text-red-500">Empty Power Cell</h3>
                        <p className="text-l text-yellow-400">Price: 50 UFOS</p>
                      </div>
                    </div>
                    <Button onClick={buyEmptyPowerCell}>Buy 1</Button>
                  </div>
                </TabsContent>

                <TabsContent value="sell" className="mt-4">
                  <div className="flex items-center justify-between p-4 border border-gray-700 rounded-md">
                    <div className="flex items-center">
                      <img
                        src={GAME_ASSETS.batteryFull || "/placeholder.svg"}
                        alt="Full Power Cell"
                        className="w-24 h-24 mr-4"
                      />
                      <div>
                        <h3 className="text-xl font-medium text-green-500">Full Power Cell</h3>
                        <p className="text-l text-yellow-400">Price: 100 UFOS</p>
                      </div>
                    </div>
                    <Button onClick={sellFullPowerCell}>Sell 1</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transfer UFOS Form */}
      {isTransferFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card className="w-[400px] bg-black border-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-yellow-400">Transfer UFOS</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsTransferFormOpen(false)}>
                  X
                </Button>
              </div>

              <form onSubmit={handleTransferUfos} className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm">Recipient Wallet</label>
                  <Input
                    type="text"
                    value={transferWallet}
                    onChange={(e) => setTransferWallet(e.target.value)}
                    placeholder="Enter recipient wallet address"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm">Amount</label>
                  <Input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    min="1"
                    max={userData.ufos}
                    required
                  />
                  <p className="text-xs mt-1">Available: {userData.ufos} UFOS</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsTransferFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Transfer</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Change Name Form */}
      {isNameFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card className="w-[400px] bg-black border-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-green-400">Change Name</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsNameFormOpen(false)}>
                  X
                </Button>
              </div>

              <form onSubmit={handleChangeName} className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm">New Name</label>
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter your new name"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsNameFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

       {/* Progress Indicators */}
{userData.chargingPowerCell > 0 && (
  <div className="fixed top-100 left-0 transform bg-black/80 p-2 rounded-md z-40">
    <div className="flex items-center gap-2">
      <img src={GAME_ASSETS.batteryCharging || "/placeholder.svg"} alt="Charging" className="w-10 h-10" />
      <Progress value={progressBars.powerCell} className="w-40 h-2 [&>div]:bg-green-500" />
      <span className="text-xs">{formatTimeRemaining(progressBars.powerCell, 12)}</span>
    </div>
  </div>
)}

{userData.scavengerWorking > 0 && (
  <div className="fixed top-150 left-0 transform bg-black/80 p-2 rounded-md z-40">
    <div className="flex items-center gap-2">
      <img src={GAME_ASSETS.ice || "/placeholder.svg"} alt="Ice Mining" className="w-10 h-10" />
      <Progress value={progressBars.scavenger} className="w-40 h-2 [&>div]:bg-green-500" />
      <span className="text-xs">{formatTimeRemaining(progressBars.scavenger, 6)}</span>
    </div>
  </div>
)}

{userData.chargingWaterFilter > 0 && (
  <div className="fixed top-200 left-0 transform bg-black/80 p-2 rounded-md z-40">
    <div className="flex items-center gap-2">
      <img src={GAME_ASSETS.water || "/placeholder.svg"} alt="Water Filtering" className="w-5 h-5" />
      <Progress value={progressBars.waterFilter} className="w-40 h-2 [&>div]:bg-green-500" />
      <span className="text-xs">{formatTimeRemaining(progressBars.waterFilter, 8)}</span>
    </div>
  </div>
)}

{userData.chargingWorkShop > 0 && (
  <div className="fixed top-250 left-0 transform bg-black/80 p-2 rounded-md z-40">
    <div className="flex items-center gap-2">
      <Activity className="w-5 h-5 text-orange-400" />
      <Progress value={progressBars.workshop} className="w-40 h-2 [&>div]:bg-green-500" />
      <span className="text-xs">{formatTimeRemaining(progressBars.workshop, 10)}</span>
    </div>
  </div>
)}

{/* Power Cell Slot Progress Indicators */}
{powerCellSlots
  .filter((slot) => slot.isCharging)
  .map((slot, index) => (
    <div
      key={slot.id}
      className="fixed bg-black/80 p-2 rounded-md z-40"
      style={{
        top: `${300 + index * 30}px`, // Adjust vertical space (increase the value for more space between slots)
        left: "0%", // Align with the left border
        transform: "translateX(0%)", // No need to center horizontally, just align left
      }}
    >
      <div className="flex items-center gap-2">
        <img
          src={GAME_ASSETS.batteryCharging || "/placeholder.svg"}
          alt={`Charging Slot ${slot.id + 1}`}
          className="w-5 h-5"
        />
        <Progress value={slot.progress} className="w-40 h-2 [&>div]:bg-green-500" />
        <span className="text-xs">{formatTimeRemaining(slot.progress, 12)}</span>
        <span className="text-xs bg-black/60 rounded-full w-5 h-5 flex items-center justify-center">
          {slot.id + 1}
        </span>
      </div>
    </div>
  ))}
   </div>
    )
  }

// Add TypeScript declarations for Phantom wallet at the bottom of the file
// Add this at the end of the file, before the final closing brace
declare global {
  interface Window {
    solana?: PhantomProvider
    phantom?: {
      solana?: PhantomProvider
    }
  }
}

interface PhantomProvider {
  publicKey: { toString(): string } | null
  isPhantom: boolean
  isConnected: boolean
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>
  signTransaction: (transaction: any) => Promise<any>
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
  disconnect: () => Promise<void>
  on: (event: string, callback: (args: any) => void) => void
  request: (request: { method: string; params?: any }) => Promise<any>
}

