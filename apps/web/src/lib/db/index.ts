import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/needpipsforporsche?sslmode=disable';

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 2000, // 2s timeout
  query_timeout: 3000,
});

export default pool;
