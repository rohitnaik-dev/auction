import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CreateAuctionForm from '@/components/auctions/CreateAuctionForm'
import { Gavel } from 'lucide-react'
import Link from 'next/link'

export default async function CreateAuctionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-indigo-900 font-semibold">
          <Gavel className="w-5 h-5" />
          BidLive
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Cancel
        </Link>
      </header>
      
      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create an Auction</h1>
            <p className="text-gray-500 mt-2">Fill in the details below to set up your real-time auction event.</p>
          </div>
          
          <CreateAuctionForm />
        </div>
      </main>
    </div>
  )
}
