import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function JoinAuctionPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join/${resolvedParams.token}&message=Create an account or log in to join this auction.`)
  }

  // Ensure profile exists for the user
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || 'Participant',
    })
  }

  // Find invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('auction_invitations')
    .select('auction_id, status, expires_at')
    .eq('token', resolvedParams.token)
    .maybeSingle()

  const isExpired = invitation?.expires_at && new Date(invitation.expires_at) < new Date()

  if (inviteError || !invitation || invitation.status !== 'ACTIVE' || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-500 mb-6">This invitation link is invalid or has expired.</p>
          <a href="/dashboard" className="text-indigo-600 font-medium hover:text-indigo-700">Return to Dashboard</a>
        </div>
      </div>
    )
  }

  // Check if already participant
  const { data: existingParticipant } = await supabase
    .from('auction_participants')
    .select('id')
    .eq('auction_id', invitation.auction_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existingParticipant) {
    // Add as participant
    await supabase
      .from('auction_participants')
      .insert({
        auction_id: invitation.auction_id,
        user_id: user.id
      })
  }

  // Redirect to auction room
  redirect(`/auctions/${invitation.auction_id}/room`)
}

