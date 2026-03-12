-- Add auto-delete policy for system_logs (2 days retention)
-- First, enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to delete old system logs
CREATE OR REPLACE FUNCTION public.delete_old_system_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.system_logs
  WHERE created_at < NOW() - INTERVAL '2 days';
END;
$$;

-- Schedule the cleanup job to run every hour
SELECT cron.schedule(
  'cleanup-old-system-logs',
  '0 * * * *',  -- Every hour at minute 0
  'SELECT public.delete_old_system_logs()'
);

-- Update RLS policy to allow only developer, founder, management to view system logs
DROP POLICY IF EXISTS "Staff can view system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Staff can insert system logs" ON public.system_logs;

CREATE POLICY "Leadership can view system logs" 
ON public.system_logs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'developer'::app_role) OR 
  has_role(auth.uid(), 'founder'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role)
);

CREATE POLICY "Leadership can insert system logs" 
ON public.system_logs 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role) OR 
  has_role(auth.uid(), 'founder'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role)
);