'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { 
  ChevronDown, 
  ChevronUp, 
  Package, 
  ExternalLink, 
  ArrowRight, 
  Gavel, 
  Calendar, 
  Clock, 
  ImageIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Loader2, 
  UploadCloud, 
  AlertCircle 
} from 'lucide-react'
import clsx from 'clsx'
import { addAuctionItemAction, updateAuctionItemAction, deleteAuctionItemAction } from '@/app/dashboard/actions'

interface AuctionItem {
  id: string
  auction_id?: string
  title: string
  description?: string
  starting_price: number
  current_bid?: number
  min_bid_increment?: number
  status: 'PENDING' | 'ACTIVE' | 'ENDED'
  image_url?: string | null
  winner_id?: string | null
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

export default function RecentAuctionsTable({ auctions: initialAuctions }: { auctions: Auction[] }) {
  const [auctions, setAuctions] = useState<Auction[]>(initialAuctions)
  const [expandedAuctionId, setExpandedAuctionId] = useState<string | null>(
    initialAuctions.length > 0 ? initialAuctions[0].id : null
  )

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<AuctionItem | null>(null)

  // Item Form State
  const [itemForm, setItemForm] = useState({
    title: '',
    description: '',
    startingPrice: '',
    minBidIncrement: '100',
    imageUrl: '',
  })
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleExpand = (auctionId: string) => {
    setExpandedAuctionId(prev => (prev === auctionId ? null : auctionId))
  }

  // Handle Image File Upload with Canvas compression
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, WEBP, GIF).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Image file must be under 10MB.')
      return
    }

    setFormError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string
      const img = new window.Image()
      img.onload = () => {
        const maxDim = 1200
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
          setItemForm(prev => ({ ...prev, imageUrl: compressedDataUrl }))
        } else {
          setItemForm(prev => ({ ...prev, imageUrl: rawDataUrl }))
        }
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  }

  // Open Add Item Modal
  const handleOpenAddModal = (auctionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAuctionId(auctionId)
    setItemForm({
      title: '',
      description: '',
      startingPrice: '',
      minBidIncrement: '100',
      imageUrl: '',
    })
    setFormError('')
    setImageInputMode('upload')
    setIsAddModalOpen(true)
  }

  // Open Edit Item Modal
  const handleOpenEditModal = (auctionId: string, item: AuctionItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAuctionId(auctionId)
    setEditingItem(item)
    setItemForm({
      title: item.title,
      description: item.description || '',
      startingPrice: String(item.starting_price || 0),
      minBidIncrement: String(item.min_bid_increment || 100),
      imageUrl: item.image_url || '',
    })
    setFormError('')
    setImageInputMode(item.image_url && !item.image_url.startsWith('data:') ? 'url' : 'upload')
    setIsEditModalOpen(true)
  }

  // Save New Item
  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!selectedAuctionId) return

    const title = itemForm.title.trim()
    const sp = parseFloat(itemForm.startingPrice)
    const mbi = parseFloat(itemForm.minBidIncrement)

    if (!title) {
      setFormError('Item title is required.')
      return
    }
    if (isNaN(sp) || sp < 0) {
      setFormError('Starting price must be a valid non-negative number.')
      return
    }
    if (isNaN(mbi) || mbi <= 0) {
      setFormError('Minimum bid increment must be greater than 0.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await addAuctionItemAction(selectedAuctionId, {
        title,
        description: itemForm.description,
        starting_price: sp,
        min_bid_increment: mbi,
        image_url: itemForm.imageUrl,
      })

      if (res?.error) {
        setFormError(res.error)
      } else if (res?.item) {
        // Optimistically update local state
        setAuctions(prev => prev.map(auc => {
          if (auc.id === selectedAuctionId) {
            return {
              ...auc,
              auction_items: [...(auc.auction_items || []), res.item]
            }
          }
          return auc
        }))
        setIsAddModalOpen(false)
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to add item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Save Edit Item
  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!selectedAuctionId || !editingItem) return

    const title = itemForm.title.trim()
    const sp = parseFloat(itemForm.startingPrice)
    const mbi = parseFloat(itemForm.minBidIncrement)

    if (!title) {
      setFormError('Item title is required.')
      return
    }
    if (isNaN(sp) || sp < 0) {
      setFormError('Starting price must be a valid non-negative number.')
      return
    }
    if (isNaN(mbi) || mbi <= 0) {
      setFormError('Minimum bid increment must be greater than 0.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await updateAuctionItemAction(editingItem.id, selectedAuctionId, {
        title,
        description: itemForm.description,
        starting_price: sp,
        min_bid_increment: mbi,
        image_url: itemForm.imageUrl,
      })

      if (res?.error) {
        setFormError(res.error)
      } else if (res?.item) {
        // Optimistically update local state
        setAuctions(prev => prev.map(auc => {
          if (auc.id === selectedAuctionId) {
            return {
              ...auc,
              auction_items: (auc.auction_items || []).map(it => it.id === editingItem.id ? res.item : it)
            }
          }
          return auc
        }))
        setIsEditModalOpen(false)
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Item
  const handleDeleteItem = async () => {
    if (!selectedAuctionId || !editingItem) return
    if (!confirm(`Are you sure you want to delete "${editingItem.title}"?`)) return

    setIsSubmitting(true)
    try {
      const res = await deleteAuctionItemAction(editingItem.id, selectedAuctionId)
      if (res?.error) {
        setFormError(res.error)
      } else {
        setAuctions(prev => prev.map(auc => {
          if (auc.id === selectedAuctionId) {
            return {
              ...auc,
              auction_items: (auc.auction_items || []).filter(it => it.id !== editingItem.id)
            }
          }
          return auc
        }))
        setIsEditModalOpen(false)
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete item.')
    } finally {
      setIsSubmitting(false)
    }
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
    <>
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
                  <button
                    type="button"
                    onClick={(e) => handleOpenAddModal(auction.id, e)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>

                  {auction.status === 'LIVE' ? (
                    <Link
                      href={`/auctions/${auction.id}/room`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                    >
                      Enter Room
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
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      Auction Items Roster ({items.length})
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => handleOpenAddModal(auction.id, e)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-xl shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add New Item to this Auction
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300">
                      <p className="text-sm text-gray-500 mb-3">No items added to this auction yet.</p>
                      <button
                        type="button"
                        onClick={(e) => handleOpenAddModal(auction.id, e)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-900 text-white rounded-xl text-xs font-semibold hover:bg-indigo-800 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add First Item
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs hover:shadow-xs transition-shadow flex gap-4 relative group"
                        >
                          {/* Item Image */}
                          {item.image_url ? (
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0 relative">
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="w-full h-full object-cover"
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
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditModal(auction.id, item, e)}
                                    className="p-1 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                                    title="Edit Item"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    className={clsx(
                                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                      item.status === 'ACTIVE' ? "bg-amber-100 text-amber-800" :
                                      item.status === 'ENDED' ? "bg-gray-100 text-gray-600" :
                                      "bg-blue-50 text-blue-700"
                                    )}
                                  >
                                    {item.status}
                                  </span>
                                </div>
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

      {/* Add / Edit Item Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false)
                setIsEditModalOpen(false)
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-700">
                {isEditModalOpen ? <Edit3 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  {isEditModalOpen ? 'Edit Auction Item' : 'Add Item to Auction'}
                </h3>
                <p className="text-xs text-gray-500">Provide details, starting price, and item photo.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={isEditModalOpen ? handleSaveEditItem : handleSaveNewItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Item Title *</label>
                <input
                  type="text"
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  placeholder="e.g. 1974 Vintage Leica Camera"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Provenance, condition, accessories included..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                />
              </div>

              {/* Image Upload / URL Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Item Image</label>
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        imageInputMode === 'upload' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        imageInputMode === 'url' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Image URL
                    </button>
                  </div>
                </div>

                {imageInputMode === 'upload' ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />

                    {itemForm.imageUrl ? (
                      <div className="p-3 bg-white rounded-2xl border border-indigo-200 flex items-center justify-between gap-4 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <img
                            src={itemForm.imageUrl}
                            alt="Uploaded Item"
                            className="w-12 h-12 rounded-xl object-cover border border-gray-200 bg-gray-50"
                          />
                          <div>
                            <p className="text-xs font-bold text-gray-900">Image Uploaded</p>
                            <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Ready
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setItemForm(prev => ({ ...prev, imageUrl: '' }))
                              if (fileInputRef.current) fileInputRef.current.value = ''
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-2xl p-5 text-center cursor-pointer bg-gray-50 hover:bg-indigo-50/20 transition-all group select-none"
                      >
                        <UploadCloud className="w-6 h-6 text-indigo-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-bold text-gray-800">
                          Click to upload image <span className="text-gray-400 font-normal">or drag & drop</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WEBP or GIF up to 10MB</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      value={itemForm.imageUrl}
                      onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-xs"
                      placeholder="https://... or image link"
                    />
                    {itemForm.imageUrl && (
                      <img
                        src={itemForm.imageUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-indigo-200 shadow-2xs flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Starting Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={itemForm.startingPrice}
                    onChange={(e) => setItemForm({ ...itemForm, startingPrice: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                    placeholder="e.g. 5000"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Min Bid Increment (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={itemForm.minBidIncrement}
                    onChange={(e) => setItemForm({ ...itemForm, minBidIncrement: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                    placeholder="e.g. 500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                {isEditModalOpen && (
                  <button
                    type="button"
                    onClick={handleDeleteItem}
                    disabled={isSubmitting}
                    className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setIsEditModalOpen(false)
                  }}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-xs shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : isEditModalOpen ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
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

