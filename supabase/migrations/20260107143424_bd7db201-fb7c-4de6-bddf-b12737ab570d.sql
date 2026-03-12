-- Create role enum for VTC Hub
CREATE TYPE public.app_role AS ENUM (
  'developer',
  'superadmin', 
  'founder',
  'management',
  'hr',
  'event_team',
  'media',
  'driver'
);

-- Create approval status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  tmp_id TEXT, -- TruckersMP ID
  avatar_url TEXT,
  approval_status approval_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Job logs table for tracking deliveries
CREATE TABLE public.job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  distance_km DECIMAL(10,2) NOT NULL DEFAULT 0,
  cargo_type TEXT,
  cargo_weight DECIMAL(10,2),
  fuel_consumed DECIMAL(10,2) DEFAULT 0,
  income DECIMAL(12,2) DEFAULT 0,
  expenses DECIMAL(12,2) DEFAULT 0,
  damage_percent DECIMAL(5,2) DEFAULT 0,
  origin_city TEXT,
  destination_city TEXT,
  delivery_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System logs for audit trail
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- App settings for version management
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user has any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('developer', 'superadmin', 'founder', 'management', 'hr')
  )
$$;

-- Function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND approval_status = 'approved'
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Anyone can insert profile on signup"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "HR and above can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'developer') OR
    public.has_role(auth.uid(), 'superadmin') OR
    public.has_role(auth.uid(), 'founder') OR
    public.has_role(auth.uid(), 'hr')
  );

-- RLS Policies for job_logs
CREATE POLICY "Users can view own job logs"
  ON public.job_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all job logs"
  ON public.job_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Users can insert own job logs"
  ON public.job_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "Users can update own recent job logs"
  ON public.job_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND created_at > now() - interval '24 hours');

CREATE POLICY "Staff can update any job log"
  ON public.job_logs FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Users can delete own recent job logs"
  ON public.job_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND created_at > now() - interval '24 hours');

-- RLS Policies for system_logs
CREATE POLICY "Staff can view system logs"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert system logs"
  ON public.system_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- RLS Policies for app_settings
CREATE POLICY "Anyone can view app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Developer can manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_logs_updated_at
  BEFORE UPDATE ON public.job_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get fleet statistics (accessible to all authenticated users)
CREATE OR REPLACE FUNCTION public.get_fleet_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_distance', COALESCE(SUM(distance_km), 0),
    'total_deliveries', COUNT(*),
    'total_fuel', COALESCE(SUM(fuel_consumed), 0),
    'total_income', COALESCE(SUM(income), 0),
    'total_expenses', COALESCE(SUM(expenses), 0),
    'total_profit', COALESCE(SUM(income - expenses), 0),
    'active_drivers', (SELECT COUNT(DISTINCT user_id) FROM public.profiles WHERE approval_status = 'approved'),
    'avg_load_weight', COALESCE(AVG(cargo_weight), 0)
  ) INTO result
  FROM public.job_logs;
  
  RETURN result;
END;
$$;

-- Function to get leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count INT DEFAULT 10)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_distance DECIMAL,
  total_deliveries BIGINT,
  total_earnings DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.avatar_url,
    COALESCE(SUM(j.distance_km), 0) as total_distance,
    COUNT(j.id) as total_deliveries,
    COALESCE(SUM(j.income), 0) as total_earnings
  FROM public.profiles p
  LEFT JOIN public.job_logs j ON p.user_id = j.user_id
  WHERE p.approval_status = 'approved'
  GROUP BY p.user_id, p.username, p.avatar_url
  ORDER BY total_distance DESC
  LIMIT limit_count;
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  
  -- Assign default driver role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'driver');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial app version
INSERT INTO public.app_settings (key, value) VALUES 
  ('version', '{"current": "1.0.0", "latest": "1.0.0"}');