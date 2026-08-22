import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import AuctionRoomClient from './AuctionRoomClient'

export default async function AuctionRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const supabase = await createClient()
  const cookieStore = await cookies()

  // 1. Check for logged-in user
  const { data: { user } } = await supabase.auth.getUser()
  
  let currentUser: any = null

  if (user) {
    currentUser = user
  } else {
    // 2. Check for guest bidder cookie session
    const guestCookie = cookieStore.get('bidlive_guest_session')?.value
    if (guestCookie) {
      try {
        const guestData = JSON.parse(guestCookie)
        if (guestData.guestId && guestData.auctionId === resolvedParams.id) {
          currentUser = {
            id: guestData.guestId,
            email: guestData.email,
            user_metadata: { full_name: guestData.fullName },
            isGuest: true,
          }
        }
      } catch (e) {
        console.error('Failed to parse guest cookie', e)
      }
    }
  }

  if (!currentUser) {
    redirect(`/login?next=/auctions/${resolvedParams.id}/room`)
  }

  // Fetch auction details
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('*, profiles:creator_id(full_name)')
    .eq('id', resolvedParams.id)
    .single()

  if (auctionError || !auction) {
    return <div className="p-12 text-center text-red-500">Auction not found.</div>
  }

  const isHost = auction.creator_id === currentUser.id

  // Validate participation (unless creator/host)
  if (!isHost) {
    const { data: participant } = await supabase
      .from('auction_participants')
      .select('id')
      .eq('auction_id', resolvedParams.id)
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (!participant) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-sm text-gray-500 mb-6">You are not a registered participant for this auction. Please use the invitation link provided by the host to join.</p>
            <Link href="/" className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-900 text-white rounded-xl text-sm font-semibold hover:bg-indigo-800 transition-colors">
              Return to Home
            </Link>
          </div>
        </div>
      )
    }
  }

  // Fetch items
  const { data: items } = await supabase
    .from('auction_items')
    .select('*, winner:winner_id(id, full_name, email)')
    .eq('auction_id', resolvedParams.id)
    .order('order_index', { ascending: true })

  // Determine current active item
  const currentItem = items?.find(item => item.status === 'ACTIVE') || items?.[0]

  // Fetch participants
  const { data: participants } = await supabase
    .from('auction_participants')
    .select('user_id, profiles(full_name)')
    .eq('auction_id', resolvedParams.id)

  // Fetch initial bid history for current item
  let bidHistory: any[] = []
  if (currentItem) {
    const { data: bids } = await supabase
      .from('bids')
      .select('*, profiles:bidder_id(full_name)')
      .eq('item_id', currentItem.id)
      .order('created_at', { ascending: false })
      .limit(50)
    bidHistory = bids || []
  }

  return (
    <AuctionRoomClient 
      auction={auction} 
      initialItems={items || []} 
      initialParticipants={participants || []}
      initialBidHistory={bidHistory}
      currentUser={currentUser}
    />
  )
}

