'use client'

import { useState } from 'react'
import { generateInviteToken, startAuction } from './actions'
import { Check, Copy, Link as LinkIcon, Play, Users, LogIn, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function InvitePage({ 
  auctionId, 
  title, 
  status,
  initialTokens = [] 
}: { 
  auctionId: string, 
  title: string, 
  status?: string,
  initialTokens?: string[] 
}) {
  const [tokens, setTokens] = useState<string[]>(initialTokens)
  const [copied, setCopied] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await generateInviteToken(auctionId)
      if (res.token) {
        setTokens([res.token, ...tokens])
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = (token: string, index: number) => {
    const url = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(url)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }
  
  const handleStart = async () => {
    setIsStarting(true)
    try {
      await startAuction(auctionId)
      router.push(`/auctions/${auctionId}/room`)
    } catch {
      setIsStarting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6 text-indigo-900">
          <Users className="w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight">Invite Participants</h1>
        </div>
        
        <p className="text-gray-600 mb-8">
          Auction <strong>"{title}"</strong> is created. Generate secure links to invite your participants.
        </p>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mb-8 w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
          Generate New Invite Link
        </button>

        {tokens.length > 0 && (
          <div className="space-y-3 mb-10">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Active Invites</h3>
            {tokens.map((token, idx) => {
              const url = typeof window !== 'undefined' ? `${window.location.origin}/join/${token}` : ''
              return (
                <div key={token} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-mono text-gray-700 truncate mr-4">{url}</span>
                  <button 
                    onClick={() => handleCopy(token, idx)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Copy invite link"
                  >
                    {copied === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
          {status === 'LIVE' ? (
            <button 
              onClick={() => router.push(`/auctions/${auctionId}/room`)} 
              className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              Enter Live Auction Room
            </button>
          ) : (
            <button 
              onClick={handleStart} 
              disabled={isStarting}
              className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Auction Room Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

