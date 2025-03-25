"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { ArrowLeft, Trophy, Medal, Crown, Coins } from "lucide-react"
import Link from "next/link"

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

// Player data interface
interface PlayerData {
  id: string
  name: string
  ufos: number
  rank?: number
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<PlayerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Initialize Firebase
        const app = initializeApp(FIREBASE_CONFIG)
        const db = getFirestore(app)

        // Query the collection
        const q = query(collection(db, "UFOSperWallet"), orderBy("UFOS", "desc"), limit(100))

        const querySnapshot = await getDocs(q)

        // Process the data
        const leaderboardData: PlayerData[] = querySnapshot.docs.map((doc, index) => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.Name || "Unknown Player",
            ufos: data.UFOS || 0,
            rank: index + 1,
          }
        })

        setPlayers(leaderboardData)
      } catch (err) {
        console.error("Error fetching leaderboard data:", err)
        setError("Failed to load leaderboard data. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboardData()
  }, [])

  // Function to get rank icon based on position
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-400" />
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-300" />
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />
    return <span className="text-gray-400 font-bold">{rank}</span>
  }

  // Function to get player name color based on rank
  const getPlayerNameColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400" // Gold
    if (rank === 2) return "text-gray-300" // Silver
    if (rank === 3) return "text-amber-600" // Bronze
    return "text-white" // White for all others
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back to Game
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Coins className="h-5 w-5" />
              <span className="font-medium">Ranked by $UFOS</span>
            </div>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-4 text-center">
            <CardTitle className="text-2xl flex items-center text-yellow-400 justify-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-400" />
              Crypto $UFOs Leaderboard
            </CardTitle>
          </CardHeader>

          {!loading && !error && (
            <div className="py-4 text-center bg-gray-800/50">
              <div className="flex items-center justify-center gap-2">
                <Coins className="h-5 w-5 text-yellow-400" />
                <span className="text-lg font-bold text-yellow-400">
                  {players.reduce((total, player) => total + player.ufos, 0).toLocaleString()}
                </span>
                <span className="text-gray-300">Total $UFOS Farmed</span>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center text-red-400">
                <p>{error}</p>
              </div>
            ) : loading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800 text-gray-300 text-sm">
                      <th className="py-3 px-4 text-left">Rank</th>
                      <th className="py-3 px-4 text-left">Player</th>
                      <th className="py-3 px-4 text-right">$UFOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex justify-center items-center w-8 h-8">
                            {getRankIcon(player.rank || 0)}
                          </div>
                        </td>
                        <td className={`py-4 px-4 font-medium ${getPlayerNameColor(player.rank || 0)}`}>
                          {player.name}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-yellow-400">
                          {player.ufos.toLocaleString()}
                        </td>
                      </tr>
                    ))}

                    {players.length === 0 && !loading && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-400">
                          No players found. Be the first to join!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

