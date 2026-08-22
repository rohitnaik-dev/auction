'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { placeBidAction, sellCurrentItemAction, endAuctionAction } from './actions'
import { formatDistanceToNow } from 'date-fns'
import { 
  Clock, 
  Users, 
  ArrowUpCircle, 
  Trophy, 
  AlertCircle, 
  Gavel, 
  Loader2, 
  Sparkles, 
  Zap, 
  Wifi, 
  Download, 
  CheckCircle2, 
  Image as ImageIcon, 
  Receipt, 
  User, 
  Package, 
  Eye, 
  X,
  ExternalLink 
} from 'lucide-react'
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
  const [zoomImage, setZoomImage] = useState<string | null>(null)

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
    if (Array.isArray(initialItems)) {
      initialItems.forEach((it: any) => {
        if (it?.winner_id && it?.winner?.full_name) {
          profileCache.current.set(it.winner_id, String(it.winner.full_name))
        }
      })
    }
  }, [currentUser, auction, initialParticipants, initialItems])

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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_items', filter: `auction_id=eq.${auction.id}` }, async (payload: any) => {
        const updatedItem = payload.new

        // Resolve Winner Name if present
        if (updatedItem.winner_id) {
          let winnerName = profileCache.current.get(updatedItem.winner_id)
          if (!winnerName) {
            const { data: winnerProf } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', updatedItem.winner_id)
              .maybeSingle()
            if (winnerProf) {
              winnerName = winnerProf.full_name
              profileCache.current.set(updatedItem.winner_id, winnerProf.full_name)
              updatedItem.winner = winnerProf
            }
          } else {
            updatedItem.winner = { id: updatedItem.winner_id, full_name: winnerName }
          }
        }

        setItems(prev => prev.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item))
        
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
          setActiveItem((prev: any) => ({ ...prev, ...updatedItem }))
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

  // Export Full Auction Report as CSV (for host)
  const handleExportCSV = () => {
    if (!items || items.length === 0) return

    const headers = [
      'Lot #',
      'Item Title',
      'Description',
      'Starting Price (INR)',
      'Final Price / Current Bid (INR)',
      'Status',
      'Winner / Buyer Name',
      'Winner ID'
    ]

    const rows = items.map((item, idx) => {
      const winnerName = item.winner?.full_name || (item.winner_id ? profileCache.current.get(item.winner_id) : '') || (item.status === 'ENDED' && item.winner_id ? 'Buyer' : 'N/A')
      const finalPrice = item.current_bid ? Number(item.current_bid) : Number(item.starting_price)
      
      return [
        `"${idx + 1}"`,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        `"${Number(item.starting_price || 0)}"`,
        `"${finalPrice}"`,
        `"${item.status}"`,
        `"${(winnerName || 'Unsold').replace(/"/g, '""')}"`,
        `"${item.winner_id || ''}"`
      ]
    })

    const totalSales = items
      .filter(i => i.status === 'ENDED' && i.winner_id)
      .reduce((sum, i) => sum + Number(i.current_bid || 0), 0)

    const metaRows = [
      [`"Auction Title"`, `"${(auction.title || '').replace(/"/g, '""')}"`],
      [`"Host / Organizer"`, `"${(auction.profiles?.full_name || 'Host').replace(/"/g, '""')}"`],
      [`"Auction Date"`, `"${new Date(auction.start_time).toLocaleDateString()}"`],
      [`"Auction Status"`, `"${auctionStatus}"`],
      [`"Total Sales Volume (INR)"`, `"${totalSales}"`],
      []
    ]

    const csvContent = [
      ...metaRows.map(r => r.join(',')),
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const cleanTitle = (auction.title || 'Auction').replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute('href', url)
    link.setAttribute('download', `${cleanTitle}_sales_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter sold items
  const soldItems = items.filter(i => i.status === 'ENDED')
  const totalSalesRevenue = soldItems
    .filter(i => i.winner_id)
    .reduce((sum, i) => sum + Number(i.current_bid || i.starting_price || 0), 0)

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Gavel className="w-5 h-5 text-indigo-700" />
            {auction.title}
          </h1>
          <p className="text-xs text-gray-500">Organized by <span className="font-semibold text-gray-700">{auction.profiles?.full_name || 'Host'}</span></p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {isCreator && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
              title="Export auction results and sales ledger to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <div className={clsx("w-2.5 h-2.5 rounded-full animate-pulse", isConnected ? (isLive ? "bg-red-500" : "bg-emerald-500") : "bg-amber-500")} />
            <span className="font-semibold text-gray-800 tracking-wide">{isConnected ? auctionStatus : 'Reconnecting...'}</span>
          </div>
          <div className="bg-gray-100 px-3.5 py-1.5 rounded-xl border border-gray-200 flex items-center gap-2 font-mono text-sm sm:text-base font-bold text-gray-800">
            <Clock className="w-4 h-4 text-gray-500" />
            {timeLeft || '00:00:00'}
          </div>
          {isCreator && isLive && (
             <button onClick={handleEndAuction} className="text-xs text-red-600 font-bold hover:text-red-700 transition-colors px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg">
               End Auction
             </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Item & Bidding */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Item Card - Prominent Display for ALL Users */}
          {activeItem ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500"></div>
              
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5" />
                  {activeItem.status === 'ACTIVE' ? 'Currently Under the Hammer' : `Item Status: ${activeItem.status}`}
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Lot #{items.findIndex(i => i.id === activeItem.id) + 1} of {items.length}
                </span>
              </div>

              {/* Product Image & Product Title Container */}
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Product Image */}
                <div className="md:w-72 h-60 sm:h-64 flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-xs relative group">
                  {activeItem.image_url ? (
                    <>
                      <img 
                        src={activeItem.image_url} 
                        alt={activeItem.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => setZoomImage(activeItem.image_url)}
                      />
                      <button
                        type="button"
                        onClick={() => setZoomImage(activeItem.image_url)}
                        className="absolute bottom-2.5 right-2.5 bg-gray-900/70 hover:bg-gray-900 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px]"
                        title="Zoom photo"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                      <ImageIcon className="w-12 h-12 mb-2 text-gray-300" />
                      <span className="text-xs font-medium">No image uploaded</span>
                    </div>
                  )}
                </div>

                {/* Product Name & Description */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2.5 tracking-tight leading-tight">
                      {activeItem.title}
                    </h2>
                    <p className="text-gray-600 text-sm sm:text-base leading-relaxed line-clamp-4">
                      {activeItem.description || "No description provided for this item."}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                    <span>Min Increment: <strong className="text-gray-800">₹{Number(minIncrementNumber).toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6 mt-4 p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Starting Price</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">₹{startingPriceNumber.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Current Highest Bid</p>
                  <p className="text-3xl sm:text-4xl font-black text-indigo-700">₹{Number(currentHighestBid).toLocaleString()}</p>
                </div>
              </div>

              {/* Bidding Controls */}
              {isLive && activeItem.status === 'ACTIVE' ? (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  {isCreator ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                          <Gavel className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-indigo-900">Host Auctioneering Controls</h3>
                          <p className="text-xs text-indigo-700 mt-0.5">Drop the gavel to sell this lot to the highest bidder and advance to the next item.</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleSellItem}
                        disabled={isSelling}
                        className="w-full sm:w-auto bg-indigo-900 hover:bg-indigo-800 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSelling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Selling...
                          </>
                        ) : (
                          <>
                            <Gavel className="w-4 h-4" />
                            Sell Item (Drop Gavel)
                          </>
                        )}
                      </button>
                    </div>
                  ) : isWinning ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-emerald-900">You are winning this lot!</h3>
                          <p className="text-xs text-emerald-700 mt-0.5">You currently hold the top bid at ₹{Number(currentHighestBid).toLocaleString()}.</p>
                        </div>
                      </div>
                      <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs bg-emerald-100 px-3 py-1.5 rounded-xl">
                        <Sparkles className="w-4 h-4" /> Top Bidder
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBidClick} className="flex flex-col gap-4">
                      {/* Main Next Bid Button */}
                      <button 
                        type="submit"
                        disabled={!isLive || isBidding}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 sm:py-5 rounded-2xl font-black text-xl sm:text-2xl shadow-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBidding ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Placing Bid...
                          </>
                        ) : (
                          <>
                            Place Bid: ₹{minNextBid.toLocaleString()}
                            <ArrowUpCircle className="w-6 h-6" />
                          </>
                        )}
                      </button>

                      {/* Quick-Bid Increment Chips */}
                      <div className="flex items-center gap-2 sm:gap-3 pt-1 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1 mr-1">
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
                              className="flex-1 py-2 px-3 rounded-xl border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              +₹{(minIncrementNumber * multiplier).toLocaleString()} (₹{quickAmount.toLocaleString()})
                            </button>
                          )
                        })}
                      </div>
                    </form>
                  )}
                  {bidError && (
                    <p className="mt-3 text-red-600 flex items-center gap-2 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {bidError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-8 bg-gray-100 rounded-2xl p-6 text-center border border-gray-200">
                  <p className="text-gray-700 font-semibold text-base">
                    {auctionStatus === 'ENDED' 
                      ? 'This auction has concluded.' 
                      : activeItem.status === 'ENDED' 
                        ? 'Bidding for this item has ended.' 
                        : 'Bidding has not started yet.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
             <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
               <p className="text-gray-500 text-base">No items available in this auction.</p>
             </div>
          )}

          {/* NEW DIV: Sold Items & Winning Buyers Ledger */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  Sold Items & Winning Buyers Ledger
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Live record of sold lots, buyer names, and hammer prices.</p>
              </div>
              <div className="flex items-center gap-3">
                {soldItems.length > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    Total Sales: ₹{totalSalesRevenue.toLocaleString()}
                  </span>
                )}
                {isCreator && (
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                )}
              </div>
            </div>

            {soldItems.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50">
                <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-600">No items have concluded yet.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">As items are sold by the host, winning buyer names and final sold prices will be listed here in real time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {soldItems.map((item, idx) => {
                  const winnerName = item.winner?.full_name || (item.winner_id ? profileCache.current.get(item.winner_id) : '') || 'Winning Bidder'
                  const isCurrentBuyer = item.winner_id === currentUser.id
                  const soldPrice = item.current_bid ? Number(item.current_bid) : Number(item.starting_price)

                  return (
                    <div 
                      key={item.id || idx}
                      className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 flex gap-4 items-center shadow-2xs hover:shadow-xs transition-shadow"
                    >
                      {/* Item Thumbnail */}
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.title} 
                          className="w-16 h-16 rounded-xl object-cover border border-emerald-200 bg-white flex-shrink-0 cursor-pointer"
                          onClick={() => setZoomImage(item.image_url)}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-emerald-100/50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      {/* Item & Buyer Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate" title={item.title}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                            SOLD
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-gray-700 mb-2">
                          <User className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">
                            Buyer: <strong className={clsx(isCurrentBuyer ? "text-emerald-700 font-extrabold" : "text-gray-900 font-bold")}>
                              {winnerName} {isCurrentBuyer && '(You)'}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100">
                          <span className="text-gray-500 text-[11px]">Start: ₹{Number(item.starting_price).toLocaleString()}</span>
                          <span className="font-extrabold text-emerald-800 text-sm">
                            ₹{soldPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Auction Catalog (All Items Roster) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span>Auction Catalog ({items.length} lots)</span>
              <span className="text-xs text-gray-400 font-normal">Live Catalog</span>
            </h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={clsx(
                    "p-4 rounded-2xl border flex items-center justify-between transition-all gap-3",
                    item.id === activeItem?.id ? "border-indigo-500 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500/20" : "border-gray-200 bg-gray-50/50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0">
                      {idx + 1}
                    </span>
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200 flex-shrink-0 bg-white cursor-pointer"
                        onClick={() => setZoomImage(item.image_url)}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Start: ₹{Number(item.starting_price).toLocaleString()} • {item.status === 'ENDED' ? 'Final' : 'Current'}: <strong className="text-gray-800">₹{Number(item.current_bid || item.starting_price).toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>
                  <span className={clsx(
                    "text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex-shrink-0",
                    item.status === 'ACTIVE' ? "bg-amber-100 text-amber-800" :
                    item.status === 'ENDED' ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700"
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

      {/* Image Full-Size Lightbox Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl p-3 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 bg-gray-900/70 hover:bg-gray-900 text-white p-2 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={zoomImage} 
              alt="Enlarged Item" 
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}

