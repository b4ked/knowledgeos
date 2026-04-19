import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password"),
  name: text("name"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  plan: text("plan").default("free").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey().notNull().default(1),
  globalCompilationModel: text('global_compilation_model').default('gpt-4o').notNull(),
  globalQueryModel: text('global_query_model').default('gpt-4o').notNull(),
  globalImageModel: text('global_image_model').default('gpt-4o-mini').notNull(),
  enforceGlobalModels: boolean('enforce_global_models').default(true).notNull(),
  compileMaxOutputTokens: integer('compile_max_output_tokens').default(8192).notNull(),
  queryMaxOutputTokens: integer('query_max_output_tokens').default(2048).notNull(),
  imageExtractMaxOutputTokens: integer('image_extract_max_output_tokens').default(1536).notNull(),
  enableOpenAIImageEnrichment: boolean('enable_openai_image_enrichment').default(false).notNull(),
  ingestionMaxFilesPerJob: integer('ingestion_max_files_per_job').default(200).notNull(),
  ingestionMaxFileSizeMb: integer('ingestion_max_file_size_mb').default(50).notNull(),
  ingestionRequestsPerMinute: integer('ingestion_requests_per_minute').default(120).notNull(),
  ingestionMaxConcurrentJobsPerOwner: integer('ingestion_max_concurrent_jobs_per_owner').default(2).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
})

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
})

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  llmProvider: text("llm_provider").default("openai"),
  conventions: jsonb("conventions").default({}),
  presets: jsonb("presets").default([]),
  vaultMode: text("vault_mode").default("cloud"), // 'cloud' | 'local'
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const vaultNotes = pgTable('vault_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  folder: text('folder').notNull(), // 'raw' | 'wiki'
  slug: text('slug').notNull(),     // e.g. 'projects/my-note'
  filename: text('filename').notNull(),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('vault_notes_user_folder_slug_idx').on(t.userId, t.folder, t.slug),
])

export const dailyUsage = pgTable('daily_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(), // YYYY-MM-DD UTC
  compileCount: integer('compile_count').default(0).notNull(),
  chatCount: integer('chat_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('daily_usage_user_date_idx').on(t.userId, t.date),
])

export const vaultEmbeddings = pgTable('vault_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  folder: text('folder').notNull(), // 'raw' | 'wiki'
  slug: text('slug').notNull(),
  contentHash: text('content_hash').notNull(),
  embedding: jsonb('embedding').$type<number[]>().notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('vault_embeddings_user_folder_slug_idx').on(t.userId, t.folder, t.slug),
])
