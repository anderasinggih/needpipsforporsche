import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/needpipsforporsche?sslmode=disable';

const pool = new Pool({
  connectionString,
});

export default pool;
