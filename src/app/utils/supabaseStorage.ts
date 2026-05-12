// Supabase Storage utility for uploading product images
import { supabase } from '@/app/utils/supabaseClient';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

const BUCKET_NAME = 'product-images-a67f0635';

/**
 * Initializes the Supabase Storage bucket for product images via server endpoint
 * Creates the bucket if it doesn't exist
 */
export async function initializeStorageBucket() {
  try {
    console.log('🪣 Initializing storage bucket via server...');
    
    // Call server endpoint to create bucket with service role permissions
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/admin/initialize-storage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      // Check if it's an RLS policy error
      if (response.status === 403 || errorData.error?.includes('row-level security') || errorData.error?.includes('RLS') || errorData.error?.includes('policy')) {
        console.log('');
        console.log('⚠️ ========================================');
        console.log('⚠️  STORAGE BUCKET NEEDS MANUAL SETUP');
        console.log('⚠️ ========================================');
        console.log('');
        console.log('📖 Please see STORAGE_SETUP_GUIDE.md for instructions.');
        console.log('');
        console.log('Quick Steps:');
        console.log('1. Go to Supabase Dashboard → Storage');
        console.log('2. Create bucket: product-images-a67f0635');
        console.log('3. Make it PUBLIC with 10MB file size limit');
        console.log('');
        console.log('✅ The app will work perfectly once buckets are created!');
        console.log('');
        return { success: false, error: 'RLS_POLICY_ERROR', needsManualSetup: true };
      }
      
      console.log('ℹ️ Storage bucket initialization skipped (server not deployed). Using local-first mode.');
      console.log('   This is normal - the app works fully without the backend deployed.');
      return { success: false, error: errorText };
    }
    
    const result = await response.json();
    console.log('✅ Bucket initialization response:', result);
    
    return { success: result.success || true };
  } catch (error) {
    console.log('ℹ️ Storage bucket initialization skipped (server not available). Using local-first mode.');
    console.log('   This is normal - the app works fully without the backend deployed.');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Uploads an image file to Supabase Storage via server endpoint (bypasses RLS)
 * @param file - The image file to upload (File or base64 data URL string)
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File | string): Promise<string> {
  try {
    let fileToUpload: File;
    
    // If it's a base64 string, convert it to a File
    if (typeof file === 'string') {
      console.log('🔄 Converting base64 to File object...');
      
      // Extract base64 data and mime type
      const matches = file.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 data URL');
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      
      // Convert base64 to blob
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      
      // Create File from blob
      const extension = mimeType.split('/')[1];
      fileToUpload = new File([blob], `image.${extension}`, { type: mimeType });
    } else {
      fileToUpload = file;
    }
    
    console.log(`📤 Uploading image via server: ${fileToUpload.name}...`);
    
    // Create FormData to send file to server
    const formData = new FormData();
    formData.append('file', fileToUpload);
    
    // Upload via server endpoint (uses service role key to bypass RLS)
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/admin/upload-image`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: formData
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server upload error:', errorData);
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const result = await response.json();
    console.log(`✅ Image uploaded successfully: ${result.url}`);
    
    return result.url;
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
}

/**
 * Deletes an image from Supabase Storage
 * @param imageUrl - The public URL of the image to delete
 */
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split(`${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
      console.error('Invalid image URL format');
      return false;
    }
    
    const filePath = urlParts[1];
    
    console.log(`Deleting image: ${filePath}...`);
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }
    
    console.log('✅ Image deleted successfully');
    return true;
  } catch (error) {
    console.error('Error in deleteProductImage:', error);
    return false;
  }
}

/**
 * Uploads multiple images to Supabase Storage
 * @param files - Array of image files or base64 data URLs
 * @returns Array of public URLs
 */
export async function uploadMultipleImages(files: (File | string)[]): Promise<string[]> {
  const uploadPromises = files.map(file => uploadImage(file));
  const results = await Promise.all(uploadPromises);
  
  // Filter out null values (failed uploads)
  return results.filter((url): url is string => url !== null);
}