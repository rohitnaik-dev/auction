import Link from "next/link";
import { Gavel, Clock, Users, ShieldCheck, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900">
            <Gavel className="w-7 h-7" />
            <span className="text-xl font-bold tracking-tight">BidLive</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-indigo-900 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="py-20 lg:py-32 px-4 text-center max-w-4xl mx-auto">
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6">
            Bid live. <br />
            <span className="text-indigo-600">Win what matters.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            A premium real-time auction platform designed for collectors and organizers. Secure, lightning-fast, and beautiful.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auctions/create"
              className="inline-flex items-center justify-center gap-2 bg-indigo-900 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-indigo-800 transition-colors shadow-sm"
            >
              Create an Auction
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-900 border border-gray-200 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              Join an Auction
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-white py-24 border-t border-gray-100 flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">Built for serious auctions</h2>
              <p className="mt-4 text-lg text-gray-500">Everything you need to host or participate in high-stakes live events.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-time Bidding</h3>
                <p className="text-gray-500">Experience the thrill of a real auction room with sub-second bid updates via WebSockets.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Live Presence</h3>
                <p className="text-gray-500">See exactly who is in the room with you. Track active participants as they join and leave.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
                <p className="text-gray-500">Invite-only auctions with secure tokens. Server-validated bids ensure zero manipulation.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-white border-t border-gray-100 py-8 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} BidLive Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
