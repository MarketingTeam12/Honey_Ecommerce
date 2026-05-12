import { publicAnonKey, projectId } from '@/utils/supabase/info';

// Store demo token globally
let demoToken: string | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize demo token by calling the backend
 */
export async function initializeDemoToken(): Promise<void> {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      // Validate publicAnonKey before making the request
      if (!publicAnonKey || publicAnonKey === 'undefined' || publicAnonKey === 'null') {
        throw new Error('Invalid publicAnonKey');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/demo-token`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}` // Required by Supabase Edge Functions
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token && data.token.includes('.')) {
          demoToken = data.token;
          console.log('âœ… Demo authentication ready');
          return;
        }
      }
      
      // Backend not deployed or error occurred
      throw new Error('Backend not available');
    } catch (error: any) {
      // Silently fail - backend not deployed
      if (error.name === 'AbortError' || error.message === 'Failed to fetch' || error.message.includes('Backend')) {
        // These are expected when backend is not deployed
        throw new Error('Backend not available');
      }
      throw error;
    }
  })();
  
  return initPromise;
}

/**
 * Builds standard headers for Supabase Edge Function requests.
 * 
 * For authenticated users: Sends real JWT Bearer token in Authorization header
 * For demo users: Sends demo JWT token if available, otherwise publicAnonKey
 * For anonymous: Sends publicAnonKey as Bearer token (it IS a valid JWT for anon access)
 * 
 * IMPORTANT: Supabase Edge Functions REQUIRE Authorization header - publicAnonKey is a valid JWT
 * 
 * @param accessToken - The user's access token (real JWT or mock-token-*)
 * @returns Headers object for fetch requests
 */
export function buildHeaders(accessToken?: string | null): Record<string, string> {
  // Validate that we have a public anon key
  if (!publicAnonKey || publicAnonKey === 'undefined' || publicAnonKey === 'null') {
    console.error('âŒ [buildHeaders] CRITICAL: publicAnonKey is invalid!', publicAnonKey);
    throw new Error('Missing valid publicAnonKey - please check Supabase configuration');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': publicAnonKey, // Always send apikey for Supabase
  };
  
  // Check if token is a real JWT (contains dots) vs mock token
  const isMockToken = accessToken?.startsWith('mock-token-');
  const looksLikeJWT = accessToken && !isMockToken && accessToken.includes('.');
  
  if (looksLikeJWT) {
    // Real JWT from authenticated user
    headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('ðŸ” [buildHeaders] Using authenticated user JWT');
    console.log('   JWT preview:', accessToken.substring(0, 50) + '...');
  } else if (isMockToken && demoToken && demoToken.includes('.') && demoToken !== publicAnonKey) {
    // Demo mode: only use demo JWT when caller explicitly provides a mock token.
    // This avoids sending an expirable demo token on public endpoints like signup.
    headers['Authorization'] = `Bearer ${demoToken}`;
    console.log('ðŸ” [buildHeaders] Using demo JWT token');
    console.log('   Demo token preview:', demoToken.substring(0, 50) + '...');
  } else {
    // Fallback: Always send publicAnonKey as Bearer token
    // The publicAnonKey IS a valid JWT for anonymous access to Supabase Edge Functions
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
    console.log('ðŸ” [buildHeaders] Using publicAnonKey for anonymous access');
    console.log('   publicAnonKey preview:', publicAnonKey.substring(0, 50) + '...');
    console.log('   accessToken provided:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
    console.log('   demoToken available:', demoToken ? 'yes' : 'no');
  }
  
  return headers;
}

/**
 * Async version of buildHeaders (kept for compatibility)
 */
export async function buildHeadersAsync(accessToken?: string | null): Promise<Record<string, string>> {
  return buildHeaders(accessToken);
}

/**
 * Returns the bearer token string if it's a real JWT, otherwise returns null.
 */
export function getBearerToken(accessToken?: string | null): string | null {
  const isMockToken = accessToken?.startsWith('mock-token-');
  const looksLikeJWT = accessToken && !isMockToken && accessToken.includes('.');
  return looksLikeJWT ? accessToken : null;
}

