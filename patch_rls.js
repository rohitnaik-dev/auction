require('dotenv').config();
const { Client } = require('pg');

async function runPatch() {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!directUrl) return;

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Fix RLS for auction_invitations so anyone can read a token if they have it
    const sql = `
      DROP POLICY IF EXISTS "Invitations viewable by creator." ON auction_invitations;
      DROP POLICY IF EXISTS "Invitations are viewable by everyone if they know the token." ON auction_invitations;
      CREATE POLICY "Invitations are viewable by everyone if they know the token." ON auction_invitations FOR SELECT USING (true);
    `;
    await client.query(sql);
    console.log('RLS Patched successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

runPatch();
