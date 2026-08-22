'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateInviteToken(auctionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Create invitation
  const { data, error } = await supabase
    .from('auction_invitations')
    .insert({
      auction_id: auctionId,
      created_by: user.id,
      status: 'ACTIVE'
    })
    .select('token')
    .single()

  if (error) {
    console.error('Invite generation error:', error)
    return { error: 'Failed to generate invite' }
  }

  revalidatePath(`/auctions/${auctionId}/invite`)
  return { token: data.token }
}

export async function startAuction(auctionId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('auctions')
    .update({ status: 'LIVE' })
    .eq('id', auctionId)
    
  if (error) return { error: error.message }
  
  // Update first item to ACTIVE
  const { data: firstItem } = await supabase
    .from('auction_items')
    .select('id')
    .eq('auction_id', auctionId)
    .order('order_index', { ascending: true })
    .limit(1)
    .single()
    
  if (firstItem) {
    await supabase.from('auction_items').update({ status: 'ACTIVE' }).eq('id', firstItem.id)
  }

  revalidatePath(`/auctions/${auctionId}/room`)
  return { success: true }
}
