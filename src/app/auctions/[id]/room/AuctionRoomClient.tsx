'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { placeBidAction, sellCurrentItemAction, endAuctionAction } from './actions'
import { formatDistanceToNow } from 'date-fns'
import { Clock, Users, ArrowUpCircle, Trophy, AlertCircle, Gavel, Loader2, Sparkles, Zap, Wifi } from 'lucide-react'
import clsx from 'clsx'

// Lightweight Web Audio Chime & Gavel Synthesizer (zero bundle overhead)
const playAudioFeedback = (type: 'bid' | 'gavel' | 'outbid') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    if (type === 'bid') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12) // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (type === 'gavel') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } else if (type === 'outbid') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function AuctionRoomClient({ 
  auction, 
  initialItems, 
  initialParticipants, 
  initialBidHistory,
  currentUser
}: any) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<any[]>(initialItems)
  const [activeItem, setActiveItem] = useState<any>(
    initialItems.find((i: any) => i.status === 'ACTIVE') || initialItems[0]
  )
  const [bidHistory, setBidHistory] = useState<any[]>(initialBidHistory)
  const [participants, setParticipants] = useState<any[]>(initialParticipants)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [bidError, setBidError] = useState<string | null>(null)
  const [isBidding, setIsBidding] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [auctionStatus, setAuctionStatus] = useState<string>(auction.status)
  const [isConnected, setIsConnected] = useState(true)

  // In-memory Profile Cache (Eliminates repeated network queries on incoming bids)
  const profileCache = useRef<Map<string, string>>(new Map())

  // Seed cache with initial users
  useEffect(() => {
    if (currentUser?.id) {
      profileCache.current.set(currentUser.id, String(currentUser.user_metadata?.full_name || 'You'))
    }
    if (auction?.creator_id && auction?.profiles?.full_name) {
      profileCache.current.set(auction.creator_id, String(auction.profiles.full_name))
    }
    if (Array.isArray(initialParticipants)) {
      initialParticipants.forEach((p: any) => {
        if (p?.user_id && p?.profiles?.full_name) {
          profileCache.current.set(p.user_id, String(p.profiles.full_name))
        }
      })
    }
  }, [currentUser, auction, initialParticipants])

  // Use refs for stable event handler access
  const activeItemRef = useRef<any>(activeItem)
  useEffect(() => {
    activeItemRef.current = activeItem
  }, [activeItem])

  const endDateTime = new Date(auction.end_time).getTime()
  const isCreator = currentUser.id === auction.creator_id
  const isLive = auctionStatus === 'LIVE'

  const currentBidNumber = Number(activeItem?.current_bid || 0)
  const startingPriceNumber = Number(activeItem?.starting_price || 0)
  const minIncrementNumber = Number(activeItem?.min_bid_increment || 1)

  const currentHighestBid = currentBidNumber > 0 ? currentBidNumber : startingPriceNumber
  const minNextBid = currentBidNumber > 0 
    ? (currentBidNumber + minIncrementNumber) 
    : startingPriceNumber

  // Verify winning state strictly for current active item
  const highestBidderId = (activeItem && bidHistory.length > 0 && bidHistory[0]?.item_id === activeItem.id) 
    ? bidHistory[0].bidder_id 
    : null
  const isWinning = Boolean(highestBidderId && highestBidderId === currentUser.id)

  // 1. Countdown Timer & Expiration Handler
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = endDateTime - now

      if (distance <= 0) {
        clearInterval(timer)
        setTimeLeft('ENDED')
        if (auctionStatus === 'LIVE') {
          setAuctionStatus('ENDED')
          if (isCreator) {
            endAuctionAction(auction.id).catch(console.error)
          }
        }
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [endDateTime, auctionStatus, isCreator, auction.id])

  // 2. Stable Supabase Realtime Subscription with In-Memory Caching
  useEffect(() => {
    const roomChannel = supabase.channel(`auction_room_${auction.id}`, {
      config: { presence: { key: currentUser.id } }
    })

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState()
        const onlineIds = new Set<string>()
        for (const id in state) {
          const presences = state[id] as any[]
          if (presences && presences.length > 0 && presences[0]?.user_id) {
            onlineIds.add(presences[0].user_id)
          }
        }
        setOnlineUsers(onlineIds)
      })
      .on('presence', { event: 'join' }, async ({ newPresences }: { newPresences: any[] }) => {
        if (newPresences && newPresences.length > 0) {
          const joinedUser = newPresences[0] as any
          setOnlineUsers(prev => new Set([...Array.from(prev), joinedUser.user_id]))

          // Check memory cache first
          if (!profileCache.current.has(joinedUser.user_id)) {
            supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', joinedUser.user_id)
              .maybeSingle()
              .then(({ data }: { data: any }) => {
                if (data) {
                  profileCache.current.set(data.id, data.full_name || 'Participant')
                  setParticipants(current => {
                    if (current.some(p => p.user_id === data.id)) return current
                    return [...current, { user_id: data.id, profiles: data }]
                  })
                }
              })
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
        if (leftPresences && leftPresences.length > 0) {
          const leftUserId = (leftPresences[0] as any).user_id
          setOnlineUsers(prev => {
            const next = new Set(Array.from(prev))
            next.delete(leftUserId)
            return next
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, async (payload: any) => {
        const currentActive = activeItemRef.current
        if (payload.new && currentActive && payload.new.item_id === currentActive.id) {
          const bidderId = (payload.new.bidder_id as string) || ''
          let bidderName = bidderId ? profileCache.current.get(bidderId) : undefined

          if (bidderId && !bidderName) {
            // Fetch and cache if not in memory
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', bidderId)
              .maybeSingle()

            const resolvedName: string = profile?.full_name || 'Bidder'
            bidderName = resolvedName
            profileCache.current.set(bidderId, resolvedName)
          }

          const newBid = { ...payload.new, profiles: { full_name: bidderName || 'Bidder' } }
          
          setBidHistory(prev => [newBid, ...prev.filter(b => b.id !== newBid.id)])
          
          // Sound & Haptic feedback
          if (bidderId === currentUser.id) {
            playAudioFeedback('bid')
          } else if (highestBidderId === currentUser.id) {
            playAudioFeedback('outbid')
          } else {
            playAudioFeedback('bid')
          }

          // Update active item current bid
          setActiveItem((prev: any) => ({
            ...prev,
            current_bid: payload.new.amount
          }))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_items', filter: `auction_id=eq.${auction.id}` }, (payload: any) => {
        const updatedItem = payload.new
        setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item))
        
        // Trigger Confetti & Gavel Sound if item ended
        if (updatedItem.status === 'ENDED') {
          playAudioFeedback('gavel')
          if (updatedItem.winner_id === currentUser.id) {
            import('canvas-confetti').then((confetti) => {
              confetti.default({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899']
              })
            })
          }
        }

        const currentActive = activeItemRef.current
        if (currentActive && updatedItem.id === currentActive.id) {
          setActiveItem(updatedItem)
        } else if (updatedItem.status === 'ACTIVE') {
          setActiveItem(updatedItem)
          // Fetch fresh bid history for the newly active item
          supabase
            .from('bids')
            .select('*, profiles:bidder_id(full_name)')
            .eq('item_id', updatedItem.id)
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }: { data: any }) => setBidHistory(data || []))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auction.id}` }, (payload: any) => {
        setAuctionStatus(payload.new.status)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          await roomChannel.track({ user_id: currentUser.id })
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false)
        }
      })

    return () => {
      supabase.removeChannel(roomChannel)
    }
  }, [auction.id, currentUser.id, supabase, highestBidderId])

  // Handle Bid Placement with dynamic custom amount
  const handlePlaceBidAmount = async (amount: number) => {
    setBidError(null)

    if (!activeItem) {
      setBidError("No item is currently active for bidding.")
      return
    }

    if (isWinning) {
      setBidError("You are already the highest bidder.")
      return
    }

    setIsBidding(true)
    try {
      const res = await placeBidAction(activeItem.id, amount)
      if (res?.error) {
        setBidError(res.error)
      }
    } catch (err: any) {
      setBidError(err?.message || "Failed to place bid.")
    } finally {
      setIsBidding(false)
    }
  }

  const handlePlaceBidClick = async (e: React.FormEvent) => {
    e.preventDefault()
    await handlePlaceBidAmount(minNextBid)
  }

  // Handle Selling Item
  const handleSellItem = async () => {
    if (!activeItem) return
    setBidError(null)
    setIsSelling(true)
    try {
      const res = await sellCurrentItemAction(auction.id, activeItem.id)
      if (res?.error) {
        setBidError(res.error)
      }
    } catch (err: any) {
      setBidError(err?.message || "Failed to sell item.")
    } finally {
      setIsSelling(false)
    }
  }

  // End Auction manually (for creators)
  const handleEndAuction = async () => {
    setBidError(null)
    const res = await endAuctionAction(auction.id)
    if (res?.error) {
      setBidError(res.error)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Gavel className="w-5 h-5 text-indigo-700" />
            {auction.title}
          </h1>
          <p className="text-sm text-gray-500">Organized by {auction.profiles?.full_name || 'Host'}</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <div className={clsx("w-2.5 h-2.5 rounded-full animate-pulse", isConnected ? (isLive ? "bg-red-500" : "bg-emerald-500") : "bg-amber-500")} />
            <span className="font-semibold text-xs text-gray-800 tracking-wide">{isConnected ? auctionStatus : 'Reconnecting...'}</span>
          </div>
          <div className="bg-gray-100 px-4 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2 font-mono text-base sm:text-lg font-bold text-gray-800">
            <Clock className="w-4 h-4 text-gray-500" />
            {timeLeft || '00:00:00'}
          </div>
          {isCreator && isLive && (
             <button onClick={handleEndAuction} className="text-sm text-red-600 font-medium hover:text-red-700 transition-colors">
               End Auction
             </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Item & Bidding */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Item Card */}
          {activeItem ? (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500"></div>
              
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {activeItem.image_url && (
                  <div className="md:w-64 h-52 flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-xs relative">
                    <img 
                      src={activeItem.image_url} 
                      alt={activeItem.title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3">
                    {activeItem.status === 'ACTIVE' ? 'Current Item' : `Item Status: ${activeItem.status}`}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{activeItem.title}</h2>
                  <p className="text-gray-600 text-base leading-relaxed">{activeItem.description || "No description provided."}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Starting Price</p>
                  <p className="text-2xl font-semibold text-gray-800">₹{startingPriceNumber.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Current Bid</p>
                  <p className="text-4xl font-bold text-indigo-700">₹{Number(currentHighestBid).toLocaleString()}</p>
                </div>
              </div>

              {/* Bidding Controls */}
              {isLive && activeItem.status === 'ACTIVE' ? (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  {isCreator ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <Gavel className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-indigo-900">Host Controls</h3>
                          <p className="text-indigo-700">Conclude bidding on this item and activate the next one.</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleSellItem}
                        disabled={isSelling}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSelling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Sell Item'
                        )}
                      </button>
                    </div>
                  ) : isWinning ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-green-900">You are winning!</h3>
                          <p className="text-green-700">You hold the current highest bid at ₹{Number(currentHighestBid).toLocaleString()}.</p>
                        </div>
                      </div>
                      <span className="text-green-600 font-semibold flex items-center gap-1 text-sm bg-green-100 px-3 py-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4" /> Top Bidder
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBidClick} className="flex flex-col gap-4">
                      {/* Main Next Bid Button */}
                      <button 
                        type="submit"
                        disabled={!isLive || isBidding}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white px-8 py-5 rounded-2xl font-bold text-2xl shadow-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBidding ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Placing Bid...
                          </>
                        ) : (
                          <>
                            Bid ₹{minNextBid.toLocaleString()}
                            <ArrowUpCircle className="w-6 h-6" />
                          </>
                        )}
                      </button>

                      {/* Quick-Bid Increment Chips */}
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          Quick Bid:
                        </span>
                        {[1, 2, 5].map((multiplier) => {
                          const quickAmount = currentBidNumber > 0 
                            ? currentBidNumber + (minIncrementNumber * multiplier)
                            : startingPriceNumber + (minIncrementNumber * (multiplier - 1))
                          return (
                            <button
                              key={multiplier}
                              type="button"
                              disabled={!isLive || isBidding}
                              onClick={() => handlePlaceBidAmount(quickAmount)}
                              className="flex-1 py-2 px-3 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              +₹{(minIncrementNumber * multiplier).toLocaleString()} (₹{quickAmount.toLocaleString()})
                            </button>
                          )
                        })}
                      </div>
                    </form>
                  )}
                  {bidError && (
                    <p className="mt-3 text-red-600 flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {bidError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-8 bg-gray-100 rounded-2xl p-6 text-center border border-gray-200">
                  <p className="text-gray-600 font-medium text-lg">
                    {auctionStatus === 'ENDED' 
                      ? 'This auction has concluded.' 
                      : activeItem.status === 'ENDED' 
                        ? 'This item has ended.' 
                        : 'Bidding has not started yet.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
             <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
               <p className="text-gray-500 text-lg">No items available in this auction.</p>
             </div>
          )}

          {/* All Items Roster */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Auction Catalog ({items.length} items)</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={clsx(
                    "p-4 rounded-2xl border flex items-center justify-between transition-all",
                    item.id === activeItem?.id ? "border-indigo-500 bg-indigo-50/40 shadow-sm" : "border-gray-200 bg-gray-50/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0">
                      {idx + 1}
                    </span>
                    {item.image_url && (
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-10 h-10 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-white" 
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 line-clamp-1">{item.title}</p>
                      <p className="text-xs text-gray-500">
                        Starting: ₹{Number(item.starting_price).toLocaleString()} • Current: ₹{Number(item.current_bid || item.starting_price).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={clsx(
                    "text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider",
                    item.status === 'ACTIVE' ? "bg-amber-100 text-amber-800" :
                    item.status === 'ENDED' ? "bg-gray-200 text-gray-600" : "bg-blue-50 text-blue-700"
                  )}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Participants & History */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Live Bid History */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col max-h-[500px]">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
              Bid History
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">{bidHistory.length} bids</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {bidHistory.length > 0 ? (
                bidHistory.map((bid, i) => (
                  <div key={bid.id} className={clsx(
                    "flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                    i === 0 ? "bg-amber-50 border-amber-200 scale-100 shadow-xs" : "bg-white border-gray-100 opacity-85 scale-98"
                  )}>
                    <div>
                      <p className="font-semibold text-gray-900">₹{Number(bid.amount).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        {bid.bidder_id === currentUser.id ? 'You' : (bid.profiles?.full_name || 'Participant')}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">
                      {formatDistanceToNow(new Date(bid.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">No bids placed yet.</p>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Participants ({participants.length})
            </h3>
            <ul className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
              {participants.map((p: any) => {
                const isOnline = onlineUsers.has(p.user_id)
                const name = p.profiles?.full_name || 'Participant'
                const initial = name.charAt(0).toUpperCase() || 'P'
                return (
                  <li key={p.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {initial}
                      </div>
                      <span className="text-sm font-medium text-gray-800">
                        {name} {p.user_id === currentUser.id && '(You)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={clsx("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
                      <span className="text-xs text-gray-500">{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

