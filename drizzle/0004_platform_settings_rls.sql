-- Enable Row Level Security on platform_settings (missed in 0002_security_hardening.sql)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Revoke default public access
REVOKE ALL ON TABLE public.platform_settings FROM anon, authenticated;

-- Admins can read platform settings
DROP POLICY IF EXISTS platform_settings_admin_select ON public.platform_settings;
CREATE POLICY platform_settings_admin_select
ON public.platform_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Admins can update platform settings
DROP POLICY IF EXISTS platform_settings_admin_update ON public.platform_settings;
CREATE POLICY platform_settings_admin_update
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);
