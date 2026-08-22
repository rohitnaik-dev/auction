'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// In-memory sliding window rate limiter (max 5 bids per 2 seconds per user)
const bidRateLimits = new Map<string, number[]>()

function isRateLimited(userId: string, maxRequests = 5, windowMs = 2000): boolean {
  const now = Date.now()
  const timestamps = bidRateLimits.get(userId) || []
  const recent = timestamps.filter(t => now - t < windowMs)
  
  if (recent.length >= maxRequests) {
    return true
  }
  
  recent.push(now)
  bidRateLimits.set(userId, recent)
  return false
}

export async function placeBidAction(itemId: string, amount: number) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const { data: { user } } = await supabase.auth.getUser()

  let bidderId: string | null = null

  if (user) {
    bidderId = user.id
  } else {
    const guestCookie = cookieStore.get('bidlive_guest_session')?.value
    if (guestCookie) {
      try {
        const guestData = JSON.parse(guestCookie)
        if (guestData.guestId) {
          bidderId = guestData.guestId
        }
      } catch (e) {
        console.error('Failed to parse guest cookie in placeBidAction', e)
      }
    }
  }

  if (!bidderId) {
    return { error: 'Unauthorized: Please join this auction using an invite link.' }
  }

  if (isRateLimited(bidderId)) {
    return { error: 'You are placing bids too rapidly. Please wait a second.' }
  }

  // Call the Postgres RPC function to safely place a bid and prevent race conditions
  const { data, error } = await supabase.rpc('place_bid', {
    p_item_id: itemId,
    p_bidder_id: bidderId,
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

