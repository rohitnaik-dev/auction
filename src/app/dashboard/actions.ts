'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function seedDemoAuction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

  // Ensure profile exists (in case trigger or signup missed it)
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || 'Auction Organizer'
    })
  }

  // Create Auction
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      creator_id: user.id,
      title: "Weekend Collectors Auction",
      description: "An exclusive selection of vintage cameras, classic timepieces, and rare collectibles.",
      status: 'SCHEDULED',
      start_time: now.toISOString(),
      end_time: oneHourLater.toISOString(),
    })
    .select()
    .single()

  if (auctionError) return { error: auctionError.message }

  // Create Items
  const items = [
    {
      auction_id: auction.id,
      title: "Vintage Film Camera",
      description: "Professional 35mm camera in excellent condition. Includes original leather case and a 50mm f/1.4 lens.",
      starting_price: 5000,
      min_bid_increment: 500,
      image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80",
      status: 'PENDING',
      order_index: 0
    },
    {
      auction_id: auction.id,
      title: "Mechanical Watch",
      description: "A beautifully restored 1960s mechanical chronograph with a leather strap. Fully serviced.",
      starting_price: 12000,
      min_bid_increment: 1000,
      image_url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80",
      status: 'PENDING',
      order_index: 1
    },
    {
      auction_id: auction.id,
      title: "Classic Vinyl Collection",
      description: "A curated collection of 10 original press classic rock vinyl records in near-mint condition.",
      starting_price: 3000,
      min_bid_increment: 200,
      image_url: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&auto=format&fit=crop&q=80",
      status: 'PENDING',
      order_index: 2
    },
    {
      auction_id: auction.id,
      title: "Handcrafted Guitar",
      description: "A custom-built acoustic guitar featuring rosewood back and sides with a solid spruce top.",
      starting_price: 15000,
      min_bid_increment: 1500,
      image_url: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&auto=format&fit=crop&q=80",
      status: 'PENDING',
      order_index: 3
    }
  ]

  await supabase.from('auction_items').insert(items)

  revalidatePath('/dashboard')
  return { success: true }
}
