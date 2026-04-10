import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL ?? "postgresql://localhost:5432/knowledgeos"

// prepare: false is needed for Supabase/PgBouncer pooled connections
const client = postgres(connectionString, { prepare: false })

export const db = drizzle({ client, schema })
