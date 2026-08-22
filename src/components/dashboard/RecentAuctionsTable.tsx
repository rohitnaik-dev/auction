'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Package, ExternalLink, ArrowRight, Gavel, Sparkles, Trophy, Calendar, Clock, ImageIcon } from 'lucide-react'
import clsx from 'clsx'

interface AuctionItem {
  id: string
  title: string
  description?: string
  starting_price: number
  current_bid?: number
  min_bid_increment?: number
  status: 'PENDING' | 'ACTIVE' | 'ENDED'
  image_url?: string
  winner_id?: string
}

interface Auction {
  id: string
  title: string
  description?: string
  status: 'SCHEDULED' | 'LIVE' | 'ENDED'
  start_time: string
  end_time: string
  created_at: string
  auction_items?: AuctionItem[]
}

export default function RecentAuctionsTable({ auctions }: { auctions: Auction[] }) {
  const [expandedAuctionId, setExpandedAuctionId] = useState<string | null>(
    auctions.length > 0 ? auctions[0].id : null
  )

  const toggleExpand = (auctionId: string) => {
    setExpandedAuctionId(prev => (prev === auctionId ? null : auctionId))
  }

  if (!auctions || auctions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-700 mx-auto mb-3">
          <Gavel className="w-6 h-6" />
        </div>
        <p className="text-gray-600 font-medium mb-2">You haven't created any auctions yet.</p>
        <Link 
          href="/auctions/create" 
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
        >
          Create your first auction &rarr;
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {auctions.map((auction) => {
        const isExpanded = expandedAuctionId === auction.id
        const items = auction.auction_items || []
        const startDate = new Date(auction.start_time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
        const startTime = new Date(auction.start_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })

        return (
          <div
            key={auction.id}
            className={clsx(
              "rounded-2xl border transition-all duration-200 overflow-hidden",
              isExpanded 
                ? "bg-white border-indigo-200 shadow-md ring-1 ring-indigo-500/10" 
                : "bg-white border-gray-100 hover:border-gray-200 shadow-2xs hover:shadow-xs"
            )}
          >
            {/* Auction Header Row - Clickable */}
            <div
              onClick={() => toggleExpand(auction.id)}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none hover:bg-gray-50/70 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-base">{auction.title}</h3>
                    <span
                      className={clsx(
                        "text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                        auction.status === 'LIVE' ? "bg-red-100 text-red-700 animate-pulse" :
                        auction.status === 'SCHEDULED' ? "bg-amber-100 text-amber-800" :
                        "bg-gray-100 text-gray-700"
                      )}
                    >
                      {auction.status}
                    </span>
                    <span className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {startDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {startTime}
                    </span>
                    {auction.description && (
                      <span className="line-clamp-1 max-w-md text-gray-400">
                        • {auction.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons & Chevron */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                {auction.status === 'LIVE' ? (
                  <Link
                    href={`/auctions/${auction.id}/room`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                  >
                    Enter Live Room
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link
                    href={`/auctions/${auction.id}/invite`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Manage & Invite
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}

                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Toggle details"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Items List Drawer */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/60 p-5 sm:p-6 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-600" />
                    Auction Items Roster ({items.length})
                  </h4>
                  <span className="text-xs text-gray-500 font-medium">Click on Manage & Invite to edit or invite bidders</span>
                </div>

                {items.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-200">
                    <p className="text-sm text-gray-500">No items added to this auction yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs hover:shadow-xs transition-shadow flex gap-4"
                      >
                        {/* Item Image */}
                        {item.image_url ? (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0 relative group">
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h5 className="font-bold text-gray-900 text-sm truncate" title={item.title}>
                                #{idx + 1}. {item.title}
                              </h5>
                              <span
                                className={clsx(
                                  "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex-shrink-0",
                                  item.status === 'ACTIVE' ? "bg-amber-100 text-amber-800" :
                                  item.status === 'ENDED' ? "bg-gray-100 text-gray-600" :
                                  "bg-blue-50 text-blue-700"
                                )}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                              {item.description || 'No description provided.'}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Starting</span>
                              <span className="font-semibold text-gray-700">₹{Number(item.starting_price).toLocaleString()}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                                {item.status === 'ENDED' ? 'Final Bid' : 'Current Bid'}
                              </span>
                              <span className="font-bold text-indigo-700">
                                ₹{Number(item.current_bid || item.starting_price).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
