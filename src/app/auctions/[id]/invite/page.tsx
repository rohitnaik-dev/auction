import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import InvitePageClient from './InvitePageClient'
import { Gavel } from 'lucide-react'
import Link from 'next/link'

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: auction } = await supabase
    .from('auctions')
    .select('title, creator_id, status')
    .eq('id', resolvedParams.id)
    .single()

  if (!auction || auction.creator_id !== user.id) {
    redirect('/dashboard')
  }

  // Fetch existing active invitations
  const { data: invitations } = await supabase
    .from('auction_invitations')
    .select('token')
    .eq('auction_id', resolvedParams.id)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })

  const initialTokens = invitations?.map(inv => inv.token) || []

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-indigo-900 font-semibold">
          <Gavel className="w-5 h-5" />
          BidLive
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Dashboard
        </Link>
      </header>
      
      <main className="flex-1 px-4">
        <InvitePageClient 
          auctionId={resolvedParams.id} 
          title={auction.title} 
          status={auction.status}
          initialTokens={initialTokens} 
        />
      </main>
    </div>
  )
}

