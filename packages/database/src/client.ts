import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');

export const sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
export const db = drizzle(sql, { schema });
