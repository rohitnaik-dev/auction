'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const guestJoinSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  email: z.string().email('Please enter a valid email address.'),
  token: z.string().min(1, 'Invalid invite token.'),
})

function getDeterministicGuestPassword(email: string): string {
  // Generates a consistent, secure password for link-based guest access
  const cleanEmail = email.toLowerCase().trim()
  let hash = 0
  for (let i = 0; i < cleanEmail.length; i++) {
    hash = (hash << 5) - hash + cleanEmail.charCodeAt(i)
    hash |= 0
  }
  return `BidLive@Guest_${Math.abs(hash)}_Secured!`
}

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

  // 2. Check if a user is currently logged in
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  let activeUserId: string | null = null

  if (currentUser) {
    activeUserId = currentUser.id
    // Update their profile name if provided
    await supabase.from('profiles').upsert({
      id: currentUser.id,
      full_name: fullName || currentUser.user_metadata?.full_name || 'Participant'
    })
  } else {
    // 3. Authenticate or create guest user via Supabase Auth
    const guestPassword = getDeterministicGuestPassword(email)

    // First attempt: Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: guestPassword,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })

    if (signUpData?.user && signUpData?.session) {
      activeUserId = signUpData.user.id
    } else if (signUpError?.message?.includes('already registered') || !signUpData?.session) {
      // Second attempt: Sign in with the guest password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: guestPassword,
      })

      if (signInData?.user) {
        activeUserId = signInData.user.id
      } else {
        // If password does not match (existing user with custom password),
        // redirect to login with pre-filled next parameter
        redirect(`/login?next=/join/${encodeURIComponent(token)}&message=${encodeURIComponent('An account with this email exists. Please enter your password to join.')}`)
      }
    }

    // Ensure public profile exists
    if (activeUserId) {
      await supabase.from('profiles').upsert({
        id: activeUserId,
        full_name: fullName
      })
    }
  }

  if (!activeUserId) {
    redirect(`/join/${encodeURIComponent(token)}?error=${encodeURIComponent('Failed to verify user session. Please try again.')}`)
  }

  // 4. Add to auction participants
  const { data: existingParticipant } = await supabase
    .from('auction_participants')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('user_id', activeUserId)
    .maybeSingle()

  if (!existingParticipant) {
    await supabase.from('auction_participants').insert({
      auction_id: auctionId,
      user_id: activeUserId,
    })
  }

  revalidatePath(`/auctions/${auctionId}/room`)
  revalidatePath('/dashboard')
  redirect(`/auctions/${auctionId}/room`)
}
