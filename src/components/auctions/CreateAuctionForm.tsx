'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createAuction } from '@/app/auctions/create/actions'
import { PlusCircle, Trash2, ArrowRight, ArrowLeft, Loader2, Edit3, Check, Image as ImageIcon, X, UploadCloud, Link as LinkIcon } from 'lucide-react'

export default function CreateAuctionForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [items, setItems] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate tomorrow's minimum date string in YYYY-MM-DD
  const minDate = useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }, [])

  const [auctionData, setAuctionData] = useState({
    title: '',
    description: '',
    auctionDate: '',
    startTime: '10:00',
    endTime: '18:00',
  })

  const [itemForm, setItemForm] = useState({
    title: '',
    description: '',
    startingPrice: '',
    minBidIncrement: '100',
    imageUrl: '',
  })

  const [error, setError] = useState('')

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, GIF).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be under 10MB.')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string
      
      // Resize & compress via Canvas for rapid network and DB performance
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

  const handleSaveItem = () => {
    setError('')
    const title = itemForm.title.trim()
    const sp = parseFloat(itemForm.startingPrice)
    const mbi = parseFloat(itemForm.minBidIncrement)

    if (!title) {
      setError('Item title is required.')
      return
    }
    if (isNaN(sp) || sp < 0) {
      setError('Starting price must be a valid non-negative number.')
      return
    }
    if (isNaN(mbi) || mbi <= 0) {
      setError('Minimum bid increment must be greater than 0.')
      return
    }

    const itemObj = {
      title,
      description: itemForm.description.trim(),
      startingPrice: sp,
      minBidIncrement: mbi,
      imageUrl: itemForm.imageUrl.trim(),
    }

    if (editingIndex !== null) {
      // Update existing item
      const updated = [...items]
      updated[editingIndex] = itemObj
      setItems(updated)
      setEditingIndex(null)
    } else {
      // Add new item
      setItems([...items, itemObj])
    }

    setItemForm({ title: '', description: '', startingPrice: '', minBidIncrement: '100', imageUrl: '' })
  }

  const handleStartEdit = (index: number) => {
    setError('')
    setEditingIndex(index)
    const target = items[index]
    setItemForm({
      title: target.title,
      description: target.description || '',
      startingPrice: target.startingPrice.toString(),
      minBidIncrement: target.minBidIncrement.toString(),
      imageUrl: target.imageUrl || '',
    })
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setItemForm({ title: '', description: '', startingPrice: '', minBidIncrement: '100', imageUrl: '' })
  }

  const handleRemoveItem = (index: number) => {
    if (editingIndex === index) {
      handleCancelEdit()
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!auctionData.title.trim() || !auctionData.auctionDate || !auctionData.startTime || !auctionData.endTime) {
      setError('Please provide all required auction details (Title, Auction Date, Start & End Times).')
      setStep(1)
      return
    }

    if (auctionData.auctionDate < minDate) {
      setError('Auction date must be set to a date after today.')
      setStep(1)
      return
    }

    const start = new Date(`${auctionData.auctionDate}T${auctionData.startTime}`)
    const end = new Date(`${auctionData.auctionDate}T${auctionData.endTime}`)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Invalid date or time entered.')
      setStep(1)
      return
    }

    if (end <= start) {
      setError('End time must be after the start time on the auction day.')
      setStep(1)
      return
    }

    let finalItems = [...items]
    // If user filled in the item form fields and didn't click "Add Item" or "Save", auto-save it if valid
    if (itemForm.title.trim() && itemForm.startingPrice && itemForm.minBidIncrement) {
      const sp = parseFloat(itemForm.startingPrice)
      const mbi = parseFloat(itemForm.minBidIncrement)
      if (!isNaN(sp) && sp >= 0 && !isNaN(mbi) && mbi > 0) {
        const itemObj = {
          title: itemForm.title.trim(),
          description: itemForm.description.trim(),
          startingPrice: sp,
          minBidIncrement: mbi,
          imageUrl: itemForm.imageUrl.trim(),
        }
        if (editingIndex !== null) {
          finalItems[editingIndex] = itemObj
        } else {
          finalItems.push(itemObj)
        }
      }
    }

    if (finalItems.length === 0) {
      setError('Please add at least one item to the auction.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', auctionData.title)
      formData.append('description', auctionData.description)
      formData.append('auctionDate', auctionData.auctionDate)
      formData.append('startTime', auctionData.startTime)
      formData.append('endTime', auctionData.endTime)

      const result = await createAuction(formData, JSON.stringify(finalItems))
      if (result?.error) {
        setError(result.error)
        if (result.error.toLowerCase().includes('date') || result.error.toLowerCase().includes('time')) {
          setStep(1)
        }
      } else if (result?.auctionId) {
        router.push(`/auctions/${result.auctionId}/invite`)
      }
    } catch (e: any) {
      setError(e?.message || 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleAction} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
      
      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${step >= 1 ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-500'}`}>1</div>
        <div className={`h-1 flex-1 mx-2 rounded ${step >= 2 ? 'bg-indigo-900' : 'bg-gray-100'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${step >= 2 ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-500'}`}>2</div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-800 text-sm rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* STEP 1: Auction Date & Info */}
      <div className={step === 1 ? 'block space-y-6' : 'hidden'}>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Auction Details</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your one-day live auction event.</p>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Auction Title</label>
          <input 
            name="title" 
            value={auctionData.title}
            onChange={(e) => setAuctionData({ ...auctionData, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
            placeholder="e.g. Rare Vintage & Collectibles Auction" 
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea 
            name="description" 
            rows={3} 
            value={auctionData.description}
            onChange={(e) => setAuctionData({ ...auctionData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
            placeholder="Describe the items, condition, and auction terms..."
          ></textarea>
        </div>

        {/* Single Auction Date Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Auction Date (Single Day Event)</label>
            <span className="text-xs text-indigo-700 font-medium">Must be after today</span>
          </div>
          <input 
            name="auctionDate" 
            type="date" 
            min={minDate}
            value={auctionData.auctionDate}
            onChange={(e) => setAuctionData({ ...auctionData, auctionDate: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
            required
          />
          <p className="text-xs text-gray-500">Past dates and today are disabled in the calendar.</p>
        </div>

        {/* Start & End Times on the Auction Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Start Time</label>
            <input 
              name="startTime" 
              type="time" 
              value={auctionData.startTime}
              onChange={(e) => setAuctionData({ ...auctionData, startTime: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">End Time</label>
            <input 
              name="endTime" 
              type="time" 
              value={auctionData.endTime}
              onChange={(e) => setAuctionData({ ...auctionData, endTime: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
              required
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            type="button" 
            onClick={() => {
              if (!auctionData.title.trim() || !auctionData.auctionDate || !auctionData.startTime || !auctionData.endTime) {
                setError('Please fill out all auction details (Title, Date, Start & End Times) before proceeding.')
                return
              }
              if (auctionData.auctionDate < minDate) {
                setError('Auction date must be set to a date after today.')
                return
              }
              setError('')
              setStep(2)
            }} 
            className="px-6 py-3 bg-indigo-900 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-indigo-800 transition-colors"
          >
            Next: Add Items
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* STEP 2: Auction Items */}
      <div className={step === 2 ? 'block space-y-6' : 'hidden'}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Auction Items ({items.length})</h2>
            <p className="text-sm text-gray-500 mt-1">Add items with descriptions, starting prices, and photos.</p>
          </div>
        </div>
        
        {/* Item Roster */}
        {items.length > 0 && (
          <div className="space-y-3 mb-6">
            {items.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  editingIndex === idx ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20' : 'bg-gray-50/80 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.title} 
                      className="w-14 h-14 object-cover rounded-xl border border-gray-200 bg-white" 
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      {idx + 1}. {item.title}
                      {editingIndex === idx && (
                        <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-normal">Editing</span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-1">{item.description || 'No description'}</p>
                    <p className="text-xs font-semibold text-indigo-700 mt-0.5">
                      Starting: ₹{Number(item.startingPrice).toLocaleString()} • Increment: ₹{Number(item.minBidIncrement).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    type="button" 
                    onClick={() => handleStartEdit(idx)} 
                    className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Item"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItem(idx)} 
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Item Form Box */}
        <div className="p-6 border border-dashed border-gray-300 rounded-3xl bg-gray-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              {editingIndex !== null ? (
                <>
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  Edit Item #{editingIndex + 1}
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  Add New Item
                </>
              )}
            </h3>
            {editingIndex !== null && (
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Item Title *</label>
              <input 
                value={itemForm.title} 
                onChange={(e) => setItemForm({...itemForm, title: e.target.value})} 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
                placeholder="e.g. 1974 Vintage Leica M4 Camera" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Description</label>
              <textarea 
                value={itemForm.description} 
                onChange={(e) => setItemForm({...itemForm, description: e.target.value})} 
                rows={2} 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
                placeholder="Details, history, provenance, condition..."
              ></textarea>
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
                          className="w-14 h-14 rounded-xl object-cover border border-gray-200 bg-gray-50"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-900">Image Uploaded</p>
                          <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Ready for live auction
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setItemForm(prev => ({ ...prev, imageUrl: '' }))
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-white hover:bg-indigo-50/20 transition-all group select-none"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-gray-800">
                        Click to upload image <span className="text-gray-400 font-normal">or drag and drop</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, WEBP or GIF up to 10MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 items-center">
                  <input
                    value={itemForm.imageUrl}
                    onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm"
                    placeholder="https://images.unsplash.com/... or image link"
                  />
                  {itemForm.imageUrl ? (
                    <div className="relative group flex-shrink-0">
                      <img
                        src={itemForm.imageUrl}
                        alt="Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-indigo-200 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setItemForm({ ...itemForm, imageUrl: '' })}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Starting Price (₹) *</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  value={itemForm.startingPrice} 
                  onChange={(e) => setItemForm({...itemForm, startingPrice: e.target.value})} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
                  placeholder="e.g. 5000" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Min Bid Increment (₹) *</label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  value={itemForm.minBidIncrement} 
                  onChange={(e) => setItemForm({...itemForm, minBidIncrement: e.target.value})} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" 
                  placeholder="e.g. 500" 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={handleSaveItem} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors shadow-xs ${
                  editingIndex !== null 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
                }`}
              >
                {editingIndex !== null ? (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes to Item
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Add Item to Auction
                  </>
                )}
              </button>
              {editingIndex !== null && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step Navigation & Submission */}
        <div className="pt-4 flex items-center justify-between">
          <button 
            type="button" 
            onClick={() => setStep(1)} 
            className="px-6 py-3 text-gray-600 font-medium flex items-center gap-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Details
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-8 py-3 bg-indigo-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-800 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing Auction...
              </>
            ) : (
              'Publish Auction'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}


