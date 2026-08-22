import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AuctionRoomClient from './AuctionRoomClient'

export default async function AuctionRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
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

  // Validate participation (unless creator)
  if (auction.creator_id !== user.id) {
    const { data: participant } = await supabase
      .from('auction_participants')
      .select('id')
      .eq('auction_id', resolvedParams.id)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-500 mb-6">You are not a participant in this auction. An invitation is required.</p>
            <a href="/dashboard" className="text-indigo-600 font-medium hover:text-indigo-700">Return to Dashboard</a>
          </div>
        </div>
      )
    }
  }

  // Fetch items
  const { data: items } = await supabase
    .from('auction_items')
    .select('*')
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
      currentUser={user}
    />
  )
}
