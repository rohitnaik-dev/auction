'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import crypto from 'crypto'

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

  // 1. Verify Invitation
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

  // 2. Check if a user is currently logged in as a full account
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const cookieStore = await cookies()

  if (currentUser) {
    // Registered user joining
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
  } else {
    // 3. Guest Bidder: Do NOT create an auth.users account
    // Generate a guest UUID
    const guestId = crypto.randomUUID()

    // Create guest profile (role: 'GUEST')
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: guestId,
      full_name: fullName,
      email: email,
      role: 'GUEST'
    })

    if (profileError) {
      console.error('Guest profile error:', profileError)
      redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent('Failed to create guest participant profile.')}`)
    }

    // Add to auction participants
    const { error: participantError } = await supabase.from('auction_participants').insert({
      auction_id: auctionId,
      user_id: guestId,
    })

    if (participantError) {
      console.error('Guest participant error:', participantError)
      redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent('Failed to register guest in auction.')}`)
    }

    // Set secure guest session cookie
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
  }

  revalidatePath(`/auctions/${auctionId}/room`)
  revalidatePath('/dashboard')
  redirect(`/auctions/${auctionId}/room`)
}

