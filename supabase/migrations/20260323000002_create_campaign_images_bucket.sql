-- Create campaign-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "authenticated can upload campaign images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-images');

-- Allow authenticated users to delete
CREATE POLICY "authenticated can delete campaign images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-images');

-- Allow public read
CREATE POLICY "public can read campaign images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'campaign-images');
