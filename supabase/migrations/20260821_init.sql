-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Tables Creation
-- ==========================================

-- Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Automatic Profile Creation Trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auctions
DO $$ BEGIN
    CREATE TYPE auction_status AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS auctions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status auction_status DEFAULT 'DRAFT' NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auction Items
DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('PENDING', 'ACTIVE', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS auction_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    starting_price NUMERIC(10, 2) NOT NULL CHECK (starting_price >= 0),
    current_bid NUMERIC(10, 2) DEFAULT 0,
    min_bid_increment NUMERIC(10, 2) NOT NULL CHECK (min_bid_increment > 0),
    status item_status DEFAULT 'PENDING' NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Item Images
CREATE TABLE IF NOT EXISTS item_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Participants
CREATE TABLE IF NOT EXISTS auction_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(auction_id, user_id)
);

-- Invitations
DO $$ BEGIN
    CREATE TYPE invitation_status AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS auction_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
    token UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMPTZ,
    status invitation_status DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Bids
CREATE TABLE IF NOT EXISTS bids (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE NOT NULL,
    bidder_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==========================================
-- 2. Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_auctions_creator ON auctions(creator_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_items_auction ON auction_items(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_item ON bids(item_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_participants_auction ON auction_participants(auction_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON auction_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON auction_invitations(token);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ==========================================
-- 3. Stored Procedures (Race Condition Prevention)
-- ==========================================

CREATE OR REPLACE FUNCTION place_bid(
    p_item_id UUID,
    p_bidder_id UUID,
    p_amount NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_auction_id UUID;
    v_creator_id UUID;
    v_auction_status auction_status;
    v_item_status item_status;
    v_starting_price NUMERIC;
    v_current_bid NUMERIC;
    v_min_increment NUMERIC;
    v_highest_bidder UUID;
    v_is_participant BOOLEAN;
BEGIN
    -- 1. Lock the auction item row for update to prevent concurrent race conditions
    SELECT 
        ai.auction_id,
        a.creator_id,
        a.status,
        ai.status,
        ai.starting_price,
        ai.current_bid,
        ai.min_bid_increment,
        (SELECT bidder_id FROM bids WHERE item_id = p_item_id ORDER BY amount DESC, created_at ASC LIMIT 1) as current_highest_bidder
    INTO 
        v_auction_id,
        v_creator_id,
        v_auction_status,
        v_item_status,
        v_starting_price,
        v_current_bid,
        v_min_increment,
        v_highest_bidder
    FROM auction_items ai
    JOIN auctions a ON ai.auction_id = a.id
    WHERE ai.id = p_item_id
    FOR UPDATE OF ai;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    -- 2. Validate auction and item states
    IF v_auction_status != 'LIVE' THEN
        RAISE EXCEPTION 'Auction is not LIVE';
    END IF;

    IF v_item_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Item is not ACTIVE';
    END IF;

    -- 3. Host is not allowed to place bids on their own auction
    IF v_creator_id = p_bidder_id THEN
        RAISE EXCEPTION 'The host cannot place bids on their own auction';
    END IF;

    -- 4. Validate participation
    SELECT EXISTS (
        SELECT 1 FROM auction_participants 
        WHERE auction_id = v_auction_id AND user_id = p_bidder_id
    ) INTO v_is_participant;

    IF NOT v_is_participant THEN
        RAISE EXCEPTION 'User is not a participant in this auction';
    END IF;

    -- 5. Validate bid amount
    IF p_amount < v_starting_price THEN
        RAISE EXCEPTION 'Bid amount must be at least the starting price of %', v_starting_price;
    END IF;

    IF v_current_bid > 0 THEN
        IF p_amount < (v_current_bid + v_min_increment) THEN
            RAISE EXCEPTION 'Bid must be at least % (minimum increment of % required)', (v_current_bid + v_min_increment), v_min_increment;
        END IF;
    END IF;

    -- 6. Validate consecutive bids
    IF v_highest_bidder IS NOT NULL AND v_highest_bidder = p_bidder_id THEN
        RAISE EXCEPTION 'You are already the highest bidder';
    END IF;

    -- 7. Insert new bid
    INSERT INTO bids (item_id, bidder_id, amount)
    VALUES (p_item_id, p_bidder_id, p_amount);

    -- 8. Update current_bid on item
    UPDATE auction_items 
    SET current_bid = p_amount, updated_at = NOW()
    WHERE id = p_item_id;

    -- 9. Notify previous highest bidder if outbid
    IF v_highest_bidder IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, message)
        VALUES (v_highest_bidder, 'OUTBID', 'You have been outbid on an item.');
    END IF;

    RETURN json_build_object('success', true, 'amount', p_amount, 'item_id', p_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


CREATE OR REPLACE FUNCTION sell_current_item(
    p_auction_id UUID,
    p_item_id UUID,
    p_host_id UUID
) RETURNS JSON AS $$
DECLARE
    v_creator_id UUID;
    v_highest_bidder UUID;
    v_highest_bid_amount NUMERIC;
    v_next_item_id UUID;
BEGIN
    -- 1. Check host authorization
    SELECT creator_id INTO v_creator_id
    FROM auctions
    WHERE id = p_auction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auction not found';
    END IF;

    IF v_creator_id != p_host_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the auction host can sell items';
    END IF;

    -- 2. Lock the current item row
    PERFORM 1 FROM auction_items WHERE id = p_item_id AND auction_id = p_auction_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found in this auction';
    END IF;

    -- 3. Determine highest bidder atomically
    SELECT bidder_id, amount
    INTO v_highest_bidder, v_highest_bid_amount
    FROM bids
    WHERE item_id = p_item_id
    ORDER BY amount DESC, created_at ASC
    LIMIT 1;

    -- 4. Mark item as ended
    UPDATE auction_items
    SET status = 'ENDED',
        winner_id = v_highest_bidder,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- 5. Send notification to winner if any
    IF v_highest_bidder IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, message)
        VALUES (v_highest_bidder, 'WON', 'Congratulations! You won an item in the auction.');
    END IF;

    -- 6. Find next pending item
    SELECT id INTO v_next_item_id
    FROM auction_items
    WHERE auction_id = p_auction_id AND status = 'PENDING'
    ORDER BY order_index ASC
    LIMIT 1;

    IF v_next_item_id IS NOT NULL THEN
        UPDATE auction_items
        SET status = 'ACTIVE', updated_at = NOW()
        WHERE id = v_next_item_id;

        RETURN json_build_object(
            'success', true, 
            'ended_item_id', p_item_id, 
            'winner_id', v_highest_bidder,
            'next_item_id', v_next_item_id,
            'auction_status', 'LIVE'
        );
    ELSE
        UPDATE auctions
        SET status = 'ENDED', updated_at = NOW()
        WHERE id = p_auction_id;

        RETURN json_build_object(
            'success', true, 
            'ended_item_id', p_item_id, 
            'winner_id', v_highest_bidder,
            'next_item_id', null,
            'auction_status', 'ENDED'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ==========================================
-- 4. Row Level Security (RLS)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read, but only owner can update
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auctions: Anyone can read public info. Creator can manage.
DROP POLICY IF EXISTS "Auctions are viewable by everyone." ON auctions;
DROP POLICY IF EXISTS "Creators can insert auctions." ON auctions;
DROP POLICY IF EXISTS "Creators can update own auctions." ON auctions;
DROP POLICY IF EXISTS "Creators can delete own auctions." ON auctions;
CREATE POLICY "Auctions are viewable by everyone." ON auctions FOR SELECT USING (true);
CREATE POLICY "Creators can insert auctions." ON auctions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own auctions." ON auctions FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete own auctions." ON auctions FOR DELETE USING (auth.uid() = creator_id);

-- Auction Items: Viewable by everyone. Creator manages.
DROP POLICY IF EXISTS "Items are viewable by everyone." ON auction_items;
DROP POLICY IF EXISTS "Creators can insert items." ON auction_items;
DROP POLICY IF EXISTS "Creators can update items." ON auction_items;
DROP POLICY IF EXISTS "Creators can delete items." ON auction_items;
CREATE POLICY "Items are viewable by everyone." ON auction_items FOR SELECT USING (true);
CREATE POLICY "Creators can insert items." ON auction_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auctions WHERE id = auction_items.auction_id AND creator_id = auth.uid())
);
CREATE POLICY "Creators can update items." ON auction_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auctions WHERE id = auction_items.auction_id AND creator_id = auth.uid())
);
CREATE POLICY "Creators can delete items." ON auction_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM auctions WHERE id = auction_items.auction_id AND creator_id = auth.uid())
);

-- Item Images: Viewable by everyone. Creator manages.
DROP POLICY IF EXISTS "Images are viewable by everyone." ON item_images;
DROP POLICY IF EXISTS "Creators can insert images." ON item_images;
DROP POLICY IF EXISTS "Creators can delete images." ON item_images;
CREATE POLICY "Images are viewable by everyone." ON item_images FOR SELECT USING (true);
CREATE POLICY "Creators can insert images." ON item_images FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auction_items ai JOIN auctions a ON ai.auction_id = a.id WHERE ai.id = item_images.item_id AND a.creator_id = auth.uid())
);
CREATE POLICY "Creators can delete images." ON item_images FOR DELETE USING (
    EXISTS (SELECT 1 FROM auction_items ai JOIN auctions a ON ai.auction_id = a.id WHERE ai.id = item_images.item_id AND a.creator_id = auth.uid())
);

-- Participants: Viewable by creator and all participants in the auction.
DROP POLICY IF EXISTS "Participants viewable by creator and themselves." ON auction_participants;
DROP POLICY IF EXISTS "Participants viewable by anyone in the same auction." ON auction_participants;
DROP POLICY IF EXISTS "Users can join if they have token (handled via RPC usually, but allow insert for themselves)." ON auction_participants;
CREATE POLICY "Participants viewable by anyone in the same auction." ON auction_participants FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM auctions WHERE id = auction_participants.auction_id AND creator_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM auction_participants ap WHERE ap.auction_id = auction_participants.auction_id AND ap.user_id = auth.uid())
);
CREATE POLICY "Users can join if they have token." ON auction_participants FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Invitations: Invitations viewable by token lookup or by creator.
DROP POLICY IF EXISTS "Invitations viewable by creator." ON auction_invitations;
DROP POLICY IF EXISTS "Invitations are viewable by everyone if they know the token." ON auction_invitations;
DROP POLICY IF EXISTS "Creators can create invitations." ON auction_invitations;
DROP POLICY IF EXISTS "Creators can update invitations." ON auction_invitations;
CREATE POLICY "Invitations are viewable by everyone if they know the token." ON auction_invitations FOR SELECT USING (true);
CREATE POLICY "Creators can create invitations." ON auction_invitations FOR INSERT WITH CHECK (
    auth.uid() = created_by
);
CREATE POLICY "Creators can update invitations." ON auction_invitations FOR UPDATE USING (
    auth.uid() = created_by
);

-- Bids: Viewable by everyone. Inserted ONLY via RPC.
DROP POLICY IF EXISTS "Bids are viewable by everyone." ON bids;
CREATE POLICY "Bids are viewable by everyone." ON bids FOR SELECT USING (true);

-- Notifications: Viewable and updatable by owner.
DROP POLICY IF EXISTS "Users can view own notifications." ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications." ON notifications;
CREATE POLICY "Users can view own notifications." ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications." ON notifications FOR UPDATE USING (auth.uid() = user_id);


-- ==========================================
-- 5. Realtime Setup
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'auctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'auction_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_items;
  END IF;
END $$;

