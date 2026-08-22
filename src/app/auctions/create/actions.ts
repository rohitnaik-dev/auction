'use server'

import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const auctionSchema = z.object({
  title: z.string().min(3, 'Auction title must be at least 3 characters.'),
  description: z.string().optional(),
  auctionDate: z.string().min(1, 'Auction date is required.'),
  startTime: z.string().min(1, 'Start time is required.'),
  endTime: z.string().min(1, 'End time is required.'),
})

const itemSchema = z.object({
  title: z.string().min(2, 'Item title must be at least 2 characters.'),
  description: z.string().optional(),
  startingPrice: z.number().min(0, 'Starting price cannot be negative.'),
  minBidIncrement: z.number().gt(0, 'Minimum bid increment must be greater than 0.'),
  imageUrl: z.string().optional(),
})

export async function createAuction(formData: FormData, itemsData: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized: Please log in first.' }
  }

  // 1. Validate Auction Details
  const rawAuction = {
    title: (formData.get('title') as string || '').trim(),
    description: (formData.get('description') as string || '').trim(),
    auctionDate: (formData.get('auctionDate') as string || '').trim(),
    startTime: (formData.get('startTime') as string || '').trim(),
    endTime: (formData.get('endTime') as string || '').trim(),
  }

  const auctionVal = auctionSchema.safeParse(rawAuction)
  if (!auctionVal.success) {
    return { error: auctionVal.error.issues[0].message }
  }

  // Verify date is strictly after today
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const auctionDateObj = new Date(`${rawAuction.auctionDate}T00:00:00`)
  if (isNaN(auctionDateObj.getTime())) {
    return { error: 'Invalid auction date format.' }
  }
  if (auctionDateObj <= todayMidnight) {
    return { error: 'Auction date must be set to a date after today.' }
  }

  const startDateTime = new Date(`${rawAuction.auctionDate}T${rawAuction.startTime}`)
  const endDateTime = new Date(`${rawAuction.auctionDate}T${rawAuction.endTime}`)

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    return { error: 'Invalid start or end time format.' }
  }

  if (endDateTime <= startDateTime) {
    return { error: 'End time must be after start time on the auction day.' }
  }

  // 2. Validate Items
  let parsedItems: any[]
  try {
    parsedItems = JSON.parse(itemsData)
  } catch {
    return { error: 'Invalid items data format.' }
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    return { error: 'Please add at least one item to the auction.' }
  }

  const formattedItems: any[] = []
  for (let i = 0; i < parsedItems.length; i++) {
    const rawItem = parsedItems[i]
    const itemVal = itemSchema.safeParse({
      title: (rawItem.title || '').trim(),
      description: (rawItem.description || '').trim(),
      startingPrice: Number(rawItem.startingPrice),
      minBidIncrement: Number(rawItem.minBidIncrement),
      imageUrl: (rawItem.imageUrl || '').trim() || undefined,
    })

    if (!itemVal.success) {
      return { error: `Item ${i + 1} (${rawItem.title || 'Untitled'}): ${itemVal.error.issues[0].message}` }
    }

    formattedItems.push({
      title: itemVal.data.title,
      description: itemVal.data.description || null,
      starting_price: itemVal.data.startingPrice,
      current_bid: 0,
      min_bid_increment: itemVal.data.minBidIncrement,
      image_url: itemVal.data.imageUrl || null,
      status: 'PENDING',
      order_index: i,
    })
  }

  // 3. Ensure host profile exists
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || 'Auction Host',
    })
  }

  // 4. Insert Auction
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      creator_id: user.id,
      title: rawAuction.title,
      description: rawAuction.description || null,
      status: 'SCHEDULED',
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
    })
    .select('id')
    .single()

  if (auctionError || !auction) {
    console.error('Auction creation error:', auctionError)
    return { error: 'Failed to create auction. ' + (auctionError?.message || '') }
  }

  // 5. Insert Items with auction_id
  const itemsWithAuctionId = formattedItems.map(item => ({
    ...item,
    auction_id: auction.id,
  }))

  const { error: itemsError } = await supabase
    .from('auction_items')
    .insert(itemsWithAuctionId)

  if (itemsError) {
    console.error('Items insertion error:', itemsError)
    // Rollback by removing the created auction
    await supabase.from('auctions').delete().eq('id', auction.id)
    return { error: 'Failed to add items to the auction. ' + itemsError.message }
  }

  return { success: true, auctionId: auction.id }
}


