ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_verification_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.password_reset_tokens FROM anon, authenticated;

DROP POLICY IF EXISTS user_preferences_owner_select ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_owner_insert ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_owner_update ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_owner_delete ON public.user_preferences;

CREATE POLICY user_preferences_owner_select
ON public.user_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY user_preferences_owner_insert
ON public.user_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_owner_update
ON public.user_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_owner_delete
ON public.user_preferences
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS vault_notes_owner_select ON public.vault_notes;
DROP POLICY IF EXISTS vault_notes_owner_insert ON public.vault_notes;
DROP POLICY IF EXISTS vault_notes_owner_update ON public.vault_notes;
DROP POLICY IF EXISTS vault_notes_owner_delete ON public.vault_notes;

CREATE POLICY vault_notes_owner_select
ON public.vault_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY vault_notes_owner_insert
ON public.vault_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vault_notes_owner_update
ON public.vault_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vault_notes_owner_delete
ON public.vault_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS vault_embeddings_owner_select ON public.vault_embeddings;
DROP POLICY IF EXISTS vault_embeddings_owner_insert ON public.vault_embeddings;
DROP POLICY IF EXISTS vault_embeddings_owner_update ON public.vault_embeddings;
DROP POLICY IF EXISTS vault_embeddings_owner_delete ON public.vault_embeddings;

CREATE POLICY vault_embeddings_owner_select
ON public.vault_embeddings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY vault_embeddings_owner_insert
ON public.vault_embeddings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vault_embeddings_owner_update
ON public.vault_embeddings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vault_embeddings_owner_delete
ON public.vault_embeddings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_usage_owner_select ON public.daily_usage;
DROP POLICY IF EXISTS daily_usage_owner_insert ON public.daily_usage;
DROP POLICY IF EXISTS daily_usage_owner_update ON public.daily_usage;
DROP POLICY IF EXISTS daily_usage_owner_delete ON public.daily_usage;

CREATE POLICY daily_usage_owner_select
ON public.daily_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY daily_usage_owner_insert
ON public.daily_usage
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY daily_usage_owner_update
ON public.daily_usage
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY daily_usage_owner_delete
ON public.daily_usage
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
