import Link from 'next/link'
import { signup } from '@/app/login/actions'
import { ArrowRight, Gavel, Info, AlertCircle } from 'lucide-react'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; next?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-900 mb-6">
            <Gavel className="w-8 h-8" />
            <span className="text-2xl font-semibold tracking-tight">BidLive</span>
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Create an account</h1>
          <p className="text-gray-500 mt-2">Join to participate in live auctions</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <form className="space-y-5" action={signup}>
            {resolvedSearchParams?.message && (
              <div className="p-4 bg-indigo-50 text-indigo-900 text-sm rounded-xl border border-indigo-200 flex items-start gap-3 shadow-xs">
                <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium">{resolvedSearchParams.message}</p>
              </div>
            )}
            {resolvedSearchParams?.error && (
              <div className="p-4 bg-red-50 text-red-800 text-sm rounded-xl border border-red-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p>{resolvedSearchParams.error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="fullName">
                Full Name
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                name="fullName"
                type="text"
                placeholder="Rohit Naik"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">
                Email address
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">
                Password
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <input type="hidden" name="next" value={resolvedSearchParams?.next || '/dashboard'} />

            <button
              type="submit"
              className="w-full py-3 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
            >
              Create Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
