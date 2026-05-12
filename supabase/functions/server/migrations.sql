-- Migration: Add file upload and delivery fields to orders table

-- Add new columns to orders table for file management
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS customer_file_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_file_name TEXT,
  ADD COLUMN IF NOT EXISTS completed_file_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_file_name TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create order_files storage bucket if not exists
-- This will be done via Supabase Storage API in the server code

-- Add comment to orders table
COMMENT ON COLUMN orders.customer_file_url IS 'URL of the file uploaded by customer';
COMMENT ON COLUMN orders.customer_file_name IS 'Original filename uploaded by customer';
COMMENT ON COLUMN orders.completed_file_url IS 'URL of the completed work file uploaded by admin';
COMMENT ON COLUMN orders.completed_file_name IS 'Filename of completed work';
COMMENT ON COLUMN orders.completed_at IS 'Timestamp when order was marked as completed';
COMMENT ON COLUMN orders.admin_notes IS 'Internal notes from admin';
