'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'

const guestJoinSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  email: z.string().email('Please enter a valid email address.'),
  token: z.string().min(1, 'Invalid invite token.'),
})

export async function joinAuctionAsGuestAction(formData: FormData) {
  const rawData = {
    fullName: (formData.get('fullName') as string) || '',
    email: (formData.get('email') as string) || '',
    token: (formData.get('token') as string) || '',
  }

  const validation = guestJoinSchema.safeParse(rawData)
  if (!validation.success) {
    redirect(`/join/${encodeURIComponent(rawData.token)}?error=${encodeURIComponent(validation.error.issues[0].message)}`)
  }

  const { fullName, email, token } = validation.data
  const supabase = await createClient()
  const cookieStore = await cookies()

  // 1. Check if a registered user is currently logged in
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (currentUser) {
    // 1a. Registered user joining with active account
    const { data: invitation, error: inviteError } = await supabase
      .from('auction_invitations')
      .select('auction_id, status, expires_at')
      .eq('token', token)
      .maybeSingle()

    const isExpired = invitation?.expires_at && new Date(invitation.expires_at) < new Date()

    if (inviteError || !invitation || invitation.status !== 'ACTIVE' || isExpired) {
      redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent('This auction invitation is invalid or has expired.')}`)
    }

    const auctionId = invitation.auction_id

    await supabase.from('profiles').upsert({
      id: currentUser.id,
      full_name: fullName || currentUser.user_metadata?.full_name || 'Participant'
    })

    const { data: existingParticipant } = await supabase
      .from('auction_participants')
      .select('id')
      .eq('auction_id', auctionId)
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (!existingParticipant) {
      await supabase.from('auction_participants').insert({
        auction_id: auctionId,
        user_id: currentUser.id,
      })
    }

    revalidatePath(`/auctions/${auctionId}/room`)
    revalidatePath('/dashboard')
    redirect(`/auctions/${auctionId}/room`)
  }

  // 2. Guest Bidder: Call the SECURITY DEFINER RPC join_auction_as_guest
  const { data: rpcResult, error: rpcError } = await supabase.rpc('join_auction_as_guest', {
    p_token: token,
    p_full_name: fullName,
    p_email: email,
  })

  if (rpcError) {
    console.error('Guest join RPC error:', rpcError)
    redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent('Failed to join auction. Please check your link and try again.')}`)
  }

  if (!rpcResult?.success) {
    redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent(rpcResult?.error || 'Invalid or expired invitation.')}`)
  }

  const { guest_id: guestId, auction_id: auctionId } = rpcResult

  // 3. Set secure guest session cookie
  cookieStore.set('bidlive_guest_session', JSON.stringify({
    guestId,
    fullName,
    email,
    auctionId,
    role: 'GUEST'
  }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })

  revalidatePath(`/auctions/${auctionId}/room`)
  revalidatePath('/dashboard')
  redirect(`/auctions/${auctionId}/room`)
}

