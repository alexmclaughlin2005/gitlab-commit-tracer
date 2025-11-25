/**
 * Test database connection
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { testConnection, closeConnection } from '../src/db/connection';

async function main() {
  console.log('Testing database connection...\n');

  // Debug: Print DATABASE_URL (hide password)
  const dbUrl = process.env.DATABASE_URL || 'NOT SET';
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`DATABASE_URL: ${maskedUrl}\n`);

  const isConnected = await testConnection();

  if (isConnected) {
    console.log('\n✅ Database connection successful!');
    console.log('You can now run: npm run db:push');
  } else {
    console.log('\n❌ Database connection failed!');
    console.log('Please check your DATABASE_URL environment variable.');
    process.exit(1);
  }

  await closeConnection();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
