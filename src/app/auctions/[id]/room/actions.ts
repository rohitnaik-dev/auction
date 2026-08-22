'use server'

import { createClient } from '@/utils/supabase/server'

export async function placeBidAction(itemId: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in to place bids.' }
  }

  // Call the Postgres RPC function to safely place a bid and prevent race conditions
  const { data, error } = await supabase.rpc('place_bid', {
    p_item_id: itemId,
    p_bidder_id: user.id,
    p_amount: amount
  })

  if (error) {
    console.error('Bid error:', error)
    return { error: error.message }
  }

  return { success: true, data }
}

export async function sellCurrentItemAction(auctionId: string, currentItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in.' }
  }

  // Call the atomic Postgres RPC procedure with row-level locking
  const { data, error } = await supabase.rpc('sell_current_item', {
    p_auction_id: auctionId,
    p_item_id: currentItemId,
    p_host_id: user.id
  })

  if (error) {
    console.error('Sell item error:', error)
    return { error: error.message }
  }

  return { success: true, data }
}

export async function endAuctionAction(auctionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: auction } = await supabase
    .from('auctions')
    .select('creator_id')
    .eq('id', auctionId)
    .maybeSingle()

  if (!auction || auction.creator_id !== user.id) {
    return { error: 'Unauthorized: Only the host can end the auction' }
  }

  // End all active/pending items
  await supabase
    .from('auction_items')
    .update({ status: 'ENDED' })
    .eq('auction_id', auctionId)
    .in('status', ['PENDING', 'ACTIVE'])

  // Mark auction ended
  const { error } = await supabase
    .from('auctions')
    .update({ status: 'ENDED' })
    .eq('id', auctionId)

  if (error) return { error: error.message }

  return { success: true }
}

