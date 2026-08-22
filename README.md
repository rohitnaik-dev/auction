# BidLive - Real-Time Auction Platform

A production-quality real-time auction platform built with Next.js (App Router) and Supabase. Designed for collectors and organizers to host secure, live bidding events with millisecond latency.

## Features

- **Secure Authentication & Roles:** Supabase Auth for login/registration. Creator vs Participant roles.
- **Real-Time Bidding:** WebSockets (Supabase Realtime) for sub-second bid updates, current item synchronization, and auction status changes.
- **Race Condition Prevention:** Postgres Stored Procedures with row-level locking to handle simultaneous bids gracefully.
- **Live Participant Presence:** See exactly who is online in the auction room.
- **Secure Invitations:** Cryptographically secure invite links with participant validation.
- **Modern UI:** Clean, light-themed, professional aesthetic using Tailwind CSS and Lucide Icons.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Server Actions, Server Components)
- **Styling:** Tailwind CSS, `clsx`, `tailwind-merge`
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-Time:** Supabase Realtime (WebSockets)
- **Validation:** Zod

## Architecture & Engineering Decisions (Interview Discussion Points)

### 1. How WebSockets & Supabase Realtime work
The auction room connects to a specific channel (`auction:[auction_id]`). It listens to Postgres changes (`INSERT` on `bids`, `UPDATE` on `auction_items` and `auctions`) and immediately updates the UI without polling. This ensures all participants see the exact same bid history and current price at the exact same time.

### 2. Handling Race Conditions (Crucial)
In a real-time auction, two users might click "Place Bid" at the exact same millisecond. 
If we evaluated the logic on the frontend or a basic backend endpoint, both bids might be accepted, leading to an inconsistent state.
**Solution:** Bids are strictly inserted using a Postgres Stored Procedure (`place_bid`). The procedure:
1. Acquires a row-level lock (`FOR UPDATE OF ai`) on the `auction_items` row.
2. Evaluates the incoming bid against the *absolute latest* `current_bid` in the database.
3. Inserts the bid and updates the item if valid, or throws a strict Postgres exception if invalid.
This guarantees atomicity.

### 3. Authorization & Row Level Security (RLS)
Security is enforced at the database level, not just the frontend:
- **Profiles:** Users can only update their own profiles.
- **Auctions/Items:** Only the creator (enforced via `auth.uid() = creator_id`) can modify or delete the auction.
- **Bids:** Direct inserts into the `bids` table are disabled via RLS. The only way to insert a bid is through the `place_bid` RPC, which acts as a `SECURITY DEFINER` and validates the user's participation status.

### 4. Secure Invite Links
Database IDs are not exposed for joining. The creator generates a cryptographically secure UUID token (`auction_invitations`). When a user visits `/join/[token]`, the server validates the token, links the user's ID to `auction_participants`, and then redirects to the secure room.

## Local Setup

1. **Clone the repository.**
2. **Install dependencies:** `npm install`
3. **Supabase Setup:**
   - Create a new project on [Supabase](https://supabase.com/).
   - Copy `.env.example` to `.env.local` and fill in your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - In the Supabase SQL Editor, run the contents of `supabase/migrations/20260821_init.sql` to create the schema, RLS policies, and stored procedures.
4. **Run the development server:** `npm run dev`
5. **Seed Demo Data:** Once logged in, go to the Dashboard and click **Seed Demo** to instantly create a realistic "Weekend Collectors Auction" with sample items.

## Future Improvements
- **Payment Integration:** Integrate Stripe Connect for automatic holds/captures on winning bids.
- **Image Uploads:** Add Supabase Storage integration for item images (schema supports this).
- **Redis Integration:** For extreme scale (e.g., >10,000 concurrent bidders), introduce a Redis queue for bid processing before persisting to Postgres.
