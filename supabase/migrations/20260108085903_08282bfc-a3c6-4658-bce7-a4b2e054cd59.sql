-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy: All approved users can view active announcements
CREATE POLICY "Approved users can view active announcements"
ON public.announcements
FOR SELECT
USING (is_approved(auth.uid()) AND is_active = true);

-- Policy: Management+ can create announcements
CREATE POLICY "Management can create announcements"
ON public.announcements
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role) OR
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'founder'::app_role) OR
  has_role(auth.uid(), 'management'::app_role)
);

-- Policy: Management+ can update announcements
CREATE POLICY "Management can update announcements"
ON public.announcements
FOR UPDATE
USING (
  has_role(auth.uid(), 'developer'::app_role) OR
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'founder'::app_role) OR
  has_role(auth.uid(), 'management'::app_role)
);

-- Policy: Management+ can delete announcements
CREATE POLICY "Management can delete announcements"
ON public.announcements
FOR DELETE
USING (
  has_role(auth.uid(), 'developer'::app_role) OR
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'founder'::app_role) OR
  has_role(auth.uid(), 'management'::app_role)
);

-- Add HR permission to update user passwords (via admin API call from edge function)
-- HR can now view all profiles with email info - already allowed by staff policy

-- Add index for faster announcement queries
CREATE INDEX idx_announcements_active ON public.announcements (is_active, created_at DESC);

-- Enable HR to manage roles more extensively
DROP POLICY IF EXISTS "HR and above can manage roles" ON public.user_roles;
CREATE POLICY "HR and above can manage roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'developer'::app_role) OR
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'founder'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role) OR
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'founder'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role)
);