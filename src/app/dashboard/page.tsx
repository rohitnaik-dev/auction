import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { PlusCircle, Clock, CheckCircle } from 'lucide-react'
import RecentAuctionsTable from '@/components/dashboard/RecentAuctionsTable'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch metrics: Total created, Active Participations, Won Items
  const { count: createdAuctionsCount } = await supabase
    .from('auctions')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', user.id)

  const { count: participatedAuctionsCount } = await supabase
    .from('auction_participants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: wonItemsCount } = await supabase
    .from('auction_items')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', user.id)

  const { data: recentAuctions } = await supabase
    .from('auctions')
    .select('*, auction_items(*)')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-gray-500 mt-1">Manage your auctions, inspect items, and monitor bidding activity.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/auctions/create" 
            className="inline-flex items-center justify-center gap-2 bg-indigo-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-800 transition-colors shadow-sm text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            New Auction
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Clock className="w-5 h-5" />
            <h3 className="font-medium">My Auctions</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{createdAuctionsCount || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Clock className="w-5 h-5" />
            <h3 className="font-medium">Joined Auctions</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{participatedAuctionsCount || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 text-green-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-medium">Items Won</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{wonItemsCount || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Recent Auctions</h2>
            <p className="text-sm text-gray-500 mt-0.5">Click any auction to inspect all items and live statuses.</p>
          </div>
        </div>
        
        <RecentAuctionsTable auctions={(recentAuctions as any) || []} />
      </div>
    </div>
  )
}

