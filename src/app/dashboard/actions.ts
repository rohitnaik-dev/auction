'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addAuctionItemAction(
  auctionId: string, 
  itemData: {
    title: string
    description?: string
    starting_price: number
    min_bid_increment: number
    image_url?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in.' }
  }

  // Verify creator ownership
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, creator_id')
    .eq('id', auctionId)
    .maybeSingle()

  if (!auction || auction.creator_id !== user.id) {
    return { error: 'Unauthorized: Only the auction creator can add items.' }
  }

  // Get current max order_index
  const { data: existingItems } = await supabase
    .from('auction_items')
    .select('order_index')
    .eq('auction_id', auctionId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrderIndex = (existingItems && existingItems.length > 0) ? (existingItems[0].order_index + 1) : 0

  const { data: newItem, error } = await supabase
    .from('auction_items')
    .insert({
      auction_id: auctionId,
      title: itemData.title.trim(),
      description: itemData.description?.trim() || '',
      starting_price: Number(itemData.starting_price),
      current_bid: Number(itemData.starting_price),
      min_bid_increment: Number(itemData.min_bid_increment) || 100,
      image_url: itemData.image_url?.trim() || null,
      status: 'PENDING',
      order_index: nextOrderIndex
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/auctions/${auctionId}/room`)
  return { success: true, item: newItem }
}

export async function updateAuctionItemAction(
  itemId: string,
  auctionId: string,
  itemData: {
    title: string
    description?: string
    starting_price: number
    min_bid_increment: number
    image_url?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in.' }
  }

  // Verify creator ownership
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, creator_id')
    .eq('id', auctionId)
    .maybeSingle()

  if (!auction || auction.creator_id !== user.id) {
    return { error: 'Unauthorized: Only the auction creator can edit items.' }
  }

  const { data: updatedItem, error } = await supabase
    .from('auction_items')
    .update({
      title: itemData.title.trim(),
      description: itemData.description?.trim() || '',
      starting_price: Number(itemData.starting_price),
      min_bid_increment: Number(itemData.min_bid_increment) || 100,
      image_url: itemData.image_url?.trim() || null,
    })
    .eq('id', itemId)
    .eq('auction_id', auctionId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/auctions/${auctionId}/room`)
  return { success: true, item: updatedItem }
}

export async function deleteAuctionItemAction(itemId: string, auctionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in.' }
  }

  // Verify creator ownership
  const { data: auction } = await supabase
    .from('auctions')
    .select('id, creator_id')
    .eq('id', auctionId)
    .maybeSingle()

  if (!auction || auction.creator_id !== user.id) {
    return { error: 'Unauthorized: Only the auction creator can delete items.' }
  }

  const { error } = await supabase
    .from('auction_items')
    .delete()
    .eq('id', itemId)
    .eq('auction_id', auctionId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/auctions/${auctionId}/room`)
  return { success: true }
}

