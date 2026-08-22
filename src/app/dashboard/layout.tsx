import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Gavel, LayoutDashboard, PlusCircle, LogOut } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2 text-indigo-900">
          <Gavel className="w-6 h-6" />
          <span className="text-lg font-semibold tracking-tight">BidLive</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-gray-900 bg-gray-50 rounded-lg font-medium">
            <LayoutDashboard className="w-5 h-5 text-gray-500" />
            Dashboard
          </Link>
          <Link href="/auctions/create" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <PlusCircle className="w-5 h-5 text-gray-400" />
            Create Auction
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{profile?.full_name}</span>
              <span className="text-xs text-gray-500 truncate w-32">{user.email}</span>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
              <LogOut className="w-5 h-5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
