ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" integer PRIMARY KEY NOT NULL DEFAULT 1,
  "global_compilation_model" text DEFAULT 'gpt-4o' NOT NULL,
  "global_query_model" text DEFAULT 'gpt-4o' NOT NULL,
  "global_image_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
  "enforce_global_models" boolean DEFAULT true NOT NULL,
  "compile_max_output_tokens" integer DEFAULT 8192 NOT NULL,
  "query_max_output_tokens" integer DEFAULT 2048 NOT NULL,
  "image_extract_max_output_tokens" integer DEFAULT 1536 NOT NULL,
  "enable_openai_image_enrichment" boolean DEFAULT false NOT NULL,
  "ingestion_max_files_per_job" integer DEFAULT 200 NOT NULL,
  "ingestion_max_file_size_mb" integer DEFAULT 50 NOT NULL,
  "ingestion_requests_per_minute" integer DEFAULT 120 NOT NULL,
  "ingestion_max_concurrent_jobs_per_owner" integer DEFAULT 2 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "platform_settings" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;
