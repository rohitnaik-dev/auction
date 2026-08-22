import Link from 'next/link'
import { login } from './actions'
import { ArrowRight, Gavel } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; next?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-900 mb-6">
            <Gavel className="w-8 h-8" />
            <span className="text-2xl font-semibold tracking-tight">BidLive</span>
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Welcome back</h1>
          <p className="text-gray-500 mt-2">Enter your credentials to access your account</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <form className="space-y-6" action={login}>
            {resolvedSearchParams?.message && (
              <div className="p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">
                {resolvedSearchParams.message}
              </div>
            )}
            {resolvedSearchParams?.error && (
              <div className="p-4 bg-red-50 text-red-800 text-sm rounded-xl border border-red-100">
                {resolvedSearchParams.error}
              </div>
            )}
            
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <input type="hidden" name="next" value={resolvedSearchParams?.next || '/dashboard'} />

            <button
              type="submit"
              className="w-full py-3 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
            >
              Sign In
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link href={`/register${resolvedSearchParams?.next ? `?next=${encodeURIComponent(resolvedSearchParams.next)}` : ''}`} className="font-medium text-indigo-600 hover:text-indigo-700">
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
