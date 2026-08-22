import HammerLoader from '@/components/ui/HammerLoader'

export default function Loading() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <HammerLoader 
        size="lg" 
        text="Loading BidLive" 
        subtext="Preparing live auctions..." 
      />
    </div>
  )
}
