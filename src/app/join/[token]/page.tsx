import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Gavel, ArrowRight, Sparkles, User, Mail, AlertCircle, Clock, Calendar } from 'lucide-react'
import { joinAuctionAsGuestAction } from './actions'

export default async function JoinAuctionPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  // 1. Fetch invitation and auction info
  const { data: invitation, error: inviteError } = await supabase
    .from('auction_invitations')
    .select('*, auctions(id, title, description, status, start_time, profiles:creator_id(full_name))')
    .eq('token', resolvedParams.token)
    .maybeSingle()

  const isExpired = invitation?.expires_at && new Date(invitation.expires_at) < new Date()

  if (inviteError || !invitation || invitation.status !== 'ACTIVE' || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-sm text-gray-500 mb-6">This auction invitation link is invalid or has expired.</p>
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-900 text-white rounded-xl text-sm font-semibold hover:bg-indigo-800 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  // 2. Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check/add participation and redirect directly to room
    const { data: existingParticipant } = await supabase
      .from('auction_participants')
      .select('id')
      .eq('auction_id', invitation.auction_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingParticipant) {
      await supabase.from('auction_participants').insert({
        auction_id: invitation.auction_id,
        user_id: user.id
      })
    }

    redirect(`/auctions/${invitation.auction_id}/room`)
  }

  const auction = (invitation as any).auctions
  const startDate = auction?.start_time ? new Date(auction.start_time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : ''

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] px-4 py-12">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-900 mb-4">
            <Gavel className="w-8 h-8" />
            <span className="text-2xl font-bold tracking-tight">BidLive</span>
          </Link>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Exclusive Auction Invite
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{auction?.title || 'Live Auction Room'}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Organized by <span className="font-semibold text-gray-700">{auction?.profiles?.full_name || 'Auction Host'}</span>
            {startDate && ` • ${startDate}`}
          </p>
        </div>

        {/* Join Card */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">Enter Your Details</h2>
            <p className="text-xs text-gray-500 mt-1">No password needed. Enter your name and email to join the live room and place bids.</p>
          </div>

          <form action={joinAuctionAsGuestAction} className="space-y-4">
            <input type="hidden" name="token" value={resolvedParams.token} />

            {resolvedSearchParams?.error && (
              <div className="p-3.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <span>{resolvedSearchParams.error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="fullName">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Sarah Jenkins"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="email">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="sarah@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 group text-sm shadow-sm mt-2"
            >
              Enter Auction Room
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <Link 
              href={`/login?next=/join/${resolvedParams.token}`}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}


