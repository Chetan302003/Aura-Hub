-- Create VTC Events table for internal event management
CREATE TABLE public.vtc_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'convoy',
  game TEXT NOT NULL DEFAULT 'ETS2',
  departure_city TEXT NOT NULL,
  departure_location TEXT,
  arrival_city TEXT NOT NULL,
  arrival_location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  meetup_time TIMESTAMPTZ,
  server_name TEXT,
  required_dlcs TEXT[],
  max_participants INTEGER,
  banner_url TEXT,
  route_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create event participants/RSVPs table
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.vtc_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.vtc_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- VTC Events policies - anyone approved can view
CREATE POLICY "Approved users can view events"
ON public.vtc_events FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

-- Staff can manage events
CREATE POLICY "Staff can insert events"
ON public.vtc_events FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update events"
ON public.vtc_events FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete events"
ON public.vtc_events FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- Event participants policies
CREATE POLICY "Approved users can view participants"
ON public.event_participants FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

CREATE POLICY "Users can RSVP to events"
ON public.event_participants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "Users can update their RSVP"
ON public.event_participants FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can cancel their RSVP"
ON public.event_participants FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_vtc_events_updated_at
BEFORE UPDATE ON public.vtc_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();