import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'make-a67f0635-product-images';

let supabase: any = null;

// Initialize Supabase client
function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseAnonKey) {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabase;
}

/**
 * Initialize the storage bucket for product images
 * Creates the bucket if it doesn't exist
 */
export async function initializeStorageBucket() {
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      console.warn('⚠️ Supabase client not initialized - storage disabled');
      return { success: false, error: 'Supabase not configured' };
    }

    // Check if bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return { success: false, error: listError.message };
    }

    const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await client.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        return { success: false, error: createError.message };
      }

      console.log('✅ Storage bucket created successfully');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error initializing storage bucket:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload a file to the storage bucket
 */
export async function uploadFile(file: File, path: string) {
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a signed URL for a file
 */
export async function getSignedUrl(path: string, expiresIn = 3600) {
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      return { success: false, error: 'Supabase not configured', url: null };
    }

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error getting signed URL:', error);
      return { success: false, error: error.message, url: null };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    console.error('Error getting signed URL:', error);
    return { success: false, error: error.message, url: null };
  }
}

/**
 * Delete a file from the storage bucket
 */
export async function deleteFile(path: string) {
  try {
    const client = getSupabaseClient();
    
    if (!client) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
}
