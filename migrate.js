require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (!directUrl) {
    console.error('No DIRECT_URL or DATABASE_URL found in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase external connections
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260821_init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration script...');
    await client.query(sql);
    console.log('Migration executed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

runMigration();
