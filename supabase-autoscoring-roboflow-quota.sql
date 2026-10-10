-- Roboflow AI trial only: bounded billable requests; no client table access.
CREATE TABLE IF NOT EXISTS public.autoscoring_roboflow_usage (
  day_utc date NOT NULL,
  bucket text NOT NULL,
  call_count integer NOT NULL DEFAULT 0 CHECK (call_count >= 0),
  PRIMARY KEY (day_utc, bucket)
);
ALTER TABLE public.autoscoring_roboflow_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autoscoring_roboflow_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.autoscoring_roboflow_consume_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  user_id uuid := auth.uid();
  day_key date := pg_catalog.timezone('UTC', pg_catalog.now())::date;
  user_bucket text;
  user_used integer := 0;
  total_used integer := 0;
BEGIN
  IF user_id IS NULL OR NOT public.is_admin() THEN RETURN false; END IF;
  user_bucket := 'user:' || user_id::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(82011, 20261010);
  SELECT call_count INTO user_used FROM public.autoscoring_roboflow_usage
  WHERE day_utc = day_key AND bucket = user_bucket;
  SELECT call_count INTO total_used FROM public.autoscoring_roboflow_usage
  WHERE day_utc = day_key AND bucket = 'global';
  IF coalesce(user_used, 0) >= 25 OR coalesce(total_used, 0) >= 100 THEN
    RETURN false;
  END IF;
  INSERT INTO public.autoscoring_roboflow_usage(day_utc, bucket, call_count)
  VALUES(day_key, user_bucket, 1)
  ON CONFLICT(day_utc, bucket) DO UPDATE
    SET call_count = public.autoscoring_roboflow_usage.call_count + 1;
  INSERT INTO public.autoscoring_roboflow_usage(day_utc, bucket, call_count)
  VALUES(day_key, 'global', 1)
  ON CONFLICT(day_utc, bucket) DO UPDATE
    SET call_count = public.autoscoring_roboflow_usage.call_count + 1;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.autoscoring_roboflow_consume_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autoscoring_roboflow_consume_quota() TO authenticated;
