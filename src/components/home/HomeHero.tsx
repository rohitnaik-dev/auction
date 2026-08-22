'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Link2, KeyRound, X, Sparkles, Loader2, ClipboardPaste } from 'lucide-react'

export default function HomeHero() {
  const router = useRouter()
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [error, setError] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)

  const extractToken = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed)
        const segments = url.pathname.split('/').filter(Boolean)
        const joinIdx = segments.indexOf('join')
        if (joinIdx !== -1 && segments[joinIdx + 1]) {
          return segments[joinIdx + 1]
        }
        return segments[segments.length - 1] || ''
      }
    } catch {
      // fallback
    }
    if (trimmed.includes('/join/')) {
      const parts = trimmed.split('/join/')
      return parts[parts.length - 1].split('?')[0].split('/')[0]
    }
    return trimmed
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const token = extractToken(inviteInput)

    if (!token) {
      setError('Please paste the auction invite link or enter the invite code.')
      return
    }

    setIsNavigating(true)
    router.push(`/join/${token}`)
  }

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setInviteInput(text)
          setError('')
        }
      }
    } catch {
      // Clipboard access denied or not supported
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Link
          href="/register?message=Register+first+to+create+an+auction&next=%2Fauctions%2Fcreate"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-900 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-800 transition-all shadow-sm group"
        >
          Create an Auction
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
        <button
          type="button"
          onClick={() => {
            setError('')
            setInviteInput('')
            setIsJoinOpen(true)
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-indigo-900 border border-gray-200 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all shadow-sm hover:border-gray-300"
        >
          <Link2 className="w-5 h-5 text-indigo-600" />
          Join an Auction
        </button>
      </div>

      {/* Join Auction Modal */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsJoinOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-700">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Join an Auction</h3>
                <p className="text-sm text-gray-500">Enter your exclusive room invite</p>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl mb-6 flex items-start gap-3 text-sm text-indigo-900">
              <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Paste the link of the auction, given by the auction host to enter the live room and place bids.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 bg-red-50 text-red-800 text-sm rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Auction Link or Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="https://.../join/your-token or your-token"
                    className="w-full px-4 py-3.5 pr-24 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-indigo-700 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    Paste
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isNavigating || !inviteInput.trim()}
                  className="flex-1 py-3 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entering...
                    </>
                  ) : (
                    <>
                      Enter Auction Room
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
