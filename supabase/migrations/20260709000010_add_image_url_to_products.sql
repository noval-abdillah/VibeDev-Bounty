-- Migration: Add image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- Create product-images storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET public = true, 
    file_size_limit = 2097152, 
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Enable storage public access policy for anonymous reads
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Enable storage upload access policy for authenticated users / all users in simulation mode
CREATE POLICY "Upload Access" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-images');
