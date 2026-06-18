-- Migrate default category colours from warm palette to muted ink&acid palette.
-- Only updates rows still on the old default; user customisations are preserved.
UPDATE public.categories SET color = '#E0A422' WHERE color = '#EF9F27';
UPDATE public.categories SET color = '#2FA37C' WHERE color = '#4FB286';
UPDATE public.categories SET color = '#C24A39' WHERE color = '#C0463A';
UPDATE public.categories SET color = '#8A8A82' WHERE color = '#888780';
UPDATE public.categories SET color = '#6E63C8' WHERE color = '#7F77DD';

-- Update the seed function so future users get the new defaults.
CREATE OR REPLACE FUNCTION public.seed_default_categories(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, color, icon, role, sort_order, description) VALUES
    (_user_id, 'Nafta',  '#E0A422', 'Fuel',     'fuel',    10, 'Diesel and other fuel fill-ups'),
    (_user_id, 'Provoz', '#2FA37C', 'Droplet',  'routine', 20, 'Things that normally wear out (oil, tyres, brake pads)'),
    (_user_id, 'Servis', '#C24A39', 'Wrench',   'repair',  30, 'Unexpected breakdowns and repairs'),
    (_user_id, 'Admin',  '#8A8A82', 'Receipt',  'admin',   40, 'Insurance, parking, vignette, paperwork'),
    (_user_id, 'Tuning', '#6E63C8', 'Sparkles', 'other',   50, 'Optional extras you did not have to buy')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;