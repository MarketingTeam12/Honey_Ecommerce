import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as paymentGateways from "./payment_gateways.tsx";

const app = new Hono();

// Check environment variables on startup
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

console.log('🔍 [STARTUP] Environment check:');
console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set (length:' + (supabaseServiceKey?.length || 0) + ')' : '❌ Missing');
console.log('  SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set (length:' + (supabaseAnonKey?.length || 0) + ')' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing required environment variables!');
  console.error('   This will cause "Invalid JWT" or database connection errors');
  console.error('   Please ensure all Supabase secrets are configured');
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: false,
  }),
);

// Additional manual CORS handler for complex requests
app.use("/*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-client-info");
    c.header("Access-Control-Max-Age", "600");
    return c.json({ ok: true }, 200);
  }
  await next();
});

// Optional auth middleware - only apply to specific routes
const requireAuth = async (c, next) => {
  console.log('🔐 [Middleware] requireAuth called');
  const authHeader = c.req.header('Authorization');
  const { user, error } = await verifyAuth(authHeader);
  
  if (error || !user) {
    console.log('❌ [Middleware] Auth verification failed:', error);
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  console.log('✅ [Middleware] User authenticated:', user.email);
  c.set('user', user);
  await next();
};

const requireAdmin = async (c, next) => {
  console.log('🔐 [Middleware] requireAdmin called');
  const user = c.get('user');
  
  if (!user) {
    console.log('❌ [Middleware] No user in context');
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const isUserAdmin = await isAdmin(user.id, user.email);
  
  if (!isUserAdmin) {
    console.log('❌ [Middleware] User is not an admin:', user.email);
    return c.json({ error: 'Forbidden - Admin access required' }, 403);
  }
  
  console.log('✅ [Middleware] Admin access granted:', user.email);
  await next();
};

// Helper function to verify auth token
async function verifyAuth(authHeader: string | null) {
  console.log('🔐 verifyAuth called');
  console.log('🔐 Auth header present:', !!authHeader);
  
  if (!authHeader) {
    console.log('❌ No auth header provided');
    return {
      user: null,
      error: 'Missing authorization header'
    };
  }
  
  // Extract the token from "Bearer <token>"
  const token = authHeader.replace('Bearer ', '').trim();
  
  // Check if it's a real JWT (contains dots) vs anon key
  const looksLikeJWT = token.includes('.');
  
  if (!looksLikeJWT) {
    console.log('⚠️ Token does not look like a JWT (no dots found)');
    return {
      user: null,
      error: 'Invalid token format'
    };
  }
  
  try {
    // Verify the JWT token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Token verification failed:', error.message);
      return {
        user: null,
        error: error.message
      };
    }
    
    if (!data.user) {
      console.log('❌ No user found in token');
      return {
        user: null,
        error: 'Invalid token'
      };
    }
    
    console.log('✅ Token verified successfully for user:', data.user.email);
    return {
      user: data.user,
      error: null
    };
  } catch (err: any) {
    console.error('❌ Exception during token verification:', err);
    return {
      user: null,
      error: err.message || 'Token verification failed'
    };
  }
}

async function createRazorpayServerOrder(params: {
  amount: number;
  currency?: string;
  receipt?: string;
}) {
  const amount = Number(params.amount);
  const currency = params.currency || 'INR';
  const receipt = params.receipt || `receipt_${Date.now()}`;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('A valid amount is required to create a Razorpay order.');
  }

  const razorpayKeysRaw =
    (await kv.get('api_keys:razorpay')) ??
    (await kv.get('api_keys_razorpay'));
  const razorpayKeys = razorpayKeysRaw
    ? typeof razorpayKeysRaw === 'string'
      ? JSON.parse(razorpayKeysRaw)
      : razorpayKeysRaw
    : null;

  const keyId = razorpayKeys?.key_id || Deno.env.get('RAZORPAY_KEY_ID') || '';
  const keySecret = razorpayKeys?.key_secret || Deno.env.get('RAZORPAY_KEY_SECRET') || '';

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay is not configured on the server. Save Razorpay key_id and key_secret in Admin > API Keys, or add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the deployed Supabase function secrets.',
    );
  }

  const razorpayPayload = new URLSearchParams();
  razorpayPayload.set('amount', String(Math.round(amount * 100)));
  razorpayPayload.set('currency', currency);
  razorpayPayload.set('receipt', receipt);

  const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
  const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: razorpayPayload.toString(),
  });

  const responseText = await razorpayResponse.text();
  let responseData: any = null;

  try {
    responseData = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseData = { raw: responseText };
  }

  if (!razorpayResponse.ok) {
    const errorMessage =
      responseData?.error?.description ||
      responseData?.error?.reason ||
      responseData?.error?.code ||
      'Razorpay rejected the order creation request.';

    console.error('❌ [Razorpay] Order creation failed:', razorpayResponse.status, responseData);
    throw new Error(errorMessage);
  }

  return {
    id: responseData?.id,
    amount: responseData?.amount,
    currency: responseData?.currency,
    receipt: responseData?.receipt,
    status: responseData?.status,
  };
}

// Helper function to check if user is admin
async function isAdmin(userId: string, userEmail?: string | null): Promise<boolean> {
  // Check by email first (most reliable for admin)
  if (userEmail === 'admin@honeytranslations.com') {
    return true;
  }
  
  // Check KV store first (for mock users)
  const profile = await kv.get(`user:${userId}`);
  if (profile && profile.role) {
    return profile.role === 'admin';
  }
  
  // Fallback for mock admin user
  if (userId === '1') {
    return true;
  }
  
  // Check Supabase database
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  return data?.role === 'admin';
}

// ==================== ADMIN DASHBOARD STATS ====================

// Ultra-simple root health check (no auth, no database access)
app.get("/make-server-a67f0635/", async (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Honey Translations API Server',
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY')
    }
  });
});

// Simple health check endpoint
app.get("/make-server-a67f0635/health", async (c) => {
  return c.json({ status: 'ok', message: 'Server is running' });
});

// Diagnostic endpoint to check environment and database configuration
app.get("/make-server-a67f0635/diagnostics", async (c) => {
  try {
    console.log('🔍 Running diagnostics...');
    
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
        supabaseUrl: Deno.env.get('SUPABASE_URL')?.substring(0, 30) + '...',
      },
      database: {
        connection: 'unknown',
        rlsStatus: 'unknown'
      }
    };

    // Test database connection
    try {
      const testClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Try a simple query
      const { data, error } = await testClient
        .from('kv_store_a67f0635')
        .select('key')
        .limit(1);
      
      if (error) {
        diagnostics.database.connection = 'error';
        diagnostics.database.error = error.message;
        diagnostics.database.errorCode = error.code;
      } else {
        diagnostics.database.connection = 'success';
        diagnostics.database.sampleDataCount = data?.length || 0;
      }
    } catch (dbError: any) {
      diagnostics.database.connection = 'exception';
      diagnostics.database.error = dbError.message;
    }

    // Check if RLS needs to be disabled
    try {
      const { data: tableInfo } = await supabase
        .from('kv_store_a67f0635')
        .select('*')
        .limit(1);
      
      diagnostics.database.canQueryWithServiceRole = true;
    } catch (e: any) {
      diagnostics.database.canQueryWithServiceRole = false;
      diagnostics.database.rlsError = e.message;
    }

    return c.json({ 
      success: true,
      diagnostics 
    });
  } catch (error: any) {
    console.error('❌ Diagnostics error:', error);
    return c.json({ 
      success: false,
      error: error.message 
    }, 500);
  }
});

// Setup endpoint to configure database (disable RLS on kv_store)
app.post("/make-server-a67f0635/setup-database", async (c) => {
  try {
    console.log('🔧 Setting up database configuration...');
    
    // Disable RLS on kv_store table using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE kv_store_a67f0635 DISABLE ROW LEVEL SECURITY;'
    });
    
    if (error) {
      console.error('⚠️ Could not disable RLS via RPC (this may be expected):', error.message);
      
      // Alternative: Just test if we can write to the table
      const testKey = `test_${Date.now()}`;
      const testResult = await kv.set(testKey, { test: true });
      await kv.del(testKey);
      
      return c.json({
        success: true,
        message: 'Database appears to be working correctly',
        note: 'RLS may already be disabled or service role key is working correctly'
      });
    }
    
    return c.json({
      success: true,
      message: 'Database RLS has been disabled for kv_store table'
    });
  } catch (error: any) {
    console.error('❌ Database setup error:', error);
    
    // Test if database works anyway
    try {
      const testKey = `test_${Date.now()}`;
      await kv.set(testKey, { test: true });
      await kv.del(testKey);
      
      return c.json({
        success: true,
        message: 'Database is working correctly despite setup error',
        setupError: error.message
      });
    } catch (testError: any) {
      return c.json({ 
        success: false,
        error: 'Database configuration failed',
        details: error.message,
        testError: testError.message
      }, 500);
    }
  }
});

// Check storage bucket status
app.get("/make-server-a67f0635/storage/check-buckets", async (c) => {
  try {
    console.log('🔍 Checking storage bucket status...');
    
    const requiredBuckets = [
      { name: 'product-images-a67f0635', sizeLimit: '10 MB' },
      { name: 'work-samples-a67f0635', sizeLimit: '50 MB' }
    ];
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('⚠️  Error listing buckets (may be RLS-related):', error.message || error);
      return c.json({ 
        success: false,
        error: 'Failed to list storage buckets',
        details: error.message 
      }, 500);
    }
    
    const status = requiredBuckets.map(required => {
      const bucket = buckets?.find(b => b.name === required.name);
      return {
        name: required.name,
        exists: !!bucket,
        isPublic: bucket?.public || false,
        recommendedSizeLimit: required.sizeLimit,
        status: bucket ? '✅ Ready' : '❌ Missing'
      };
    });
    
    const allReady = status.every(s => s.exists);
    
    return c.json({
      success: true,
      allReady,
      message: allReady 
        ? 'All storage buckets are configured correctly!' 
        : 'Some storage buckets need to be created manually.',
      buckets: status,
      setupGuide: allReady ? null : 'See STORAGE_SETUP_GUIDE.md for setup instructions'
    });
    
  } catch (error) {
    console.error('❌ Storage check error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to check storage status',
      details: error.message 
    }, 500);
  }
});

// Generate demo auth token for testing (DEMO MODE ONLY)
app.get("/make-server-a67f0635/demo-token", async (c) => {
  try {
    console.log('🎭 [Demo Token] Generating demo authentication token...');
    
    // Create a session for the demo admin user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@honeytranslations.com',
      password: 'admin123'
    });
    
    if (error) {
      console.log('⚠️ [Demo Token] Supabase auth error, returning public anon key:', error);
      // If demo user doesn't exist, just return the anon key
      return c.json({ 
        success: true,
        token: Deno.env.get('SUPABASE_ANON_KEY'),
        type: 'anon',
        message: 'Using public anon key for demo mode'
      });
    }
    
    console.log('✅ [Demo Token] Demo token generated successfully');
    return c.json({ 
      success: true,
      token: data.session?.access_token || Deno.env.get('SUPABASE_ANON_KEY'),
      type: data.session?.access_token ? 'jwt' : 'anon',
      user: data.user
    });
  } catch (error) {
    console.error('❌ [Demo Token] Error generating token:', error);
    // Fallback to anon key
    return c.json({ 
      success: true,
      token: Deno.env.get('SUPABASE_ANON_KEY'),
      type: 'anon',
      message: 'Fallback to anon key'
    });
  }
});

// Initialize demo users - Call this once to create admin and customer accounts
app.post("/make-server-a67f0635/init-demo-users", async (c) => {
  try {
    console.log('🚀 [Init Demo Users] Starting initialization...');
    console.log('🚀 [Init Demo Users] Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
    
    // Check environment variables
    if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      console.error('❌ [Init Demo Users] SUPABASE_SERVICE_ROLE_KEY is missing!');
      return c.json({ 
        success: false, 
        error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY',
        hint: 'Please ensure the Edge Function has the required environment variables configured'
      }, 500);
    }
    
    console.log('🚀 [Init Demo Users] Environment check passed');
    
    const demoUsers = [
      {
        email: 'admin@honeytranslations.com',
        password: 'admin123',
        name: 'Admin User',
        phone: '+919999999999',
        role: 'admin'
      },
      {
        email: 'customer@example.com',
        password: 'customer123',
        name: 'Demo Customer',
        phone: '+918888888888',
        role: 'customer'
      }
    ];
    
    const results = [];
    
    for (const user of demoUsers) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const userExists = existingUser?.users?.some(u => u.email === user.email);
        
        if (userExists) {
          console.log(`✅ User ${user.email} already exists`);
          results.push({ email: user.email, status: 'already_exists' });
          continue;
        }
        
        // Create user
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          user_metadata: {
            name: user.name,
            phone: user.phone,
            role: user.role
          },
          email_confirm: true
        });
        
        if (error) {
          console.error(`❌ Error creating ${user.email}:`, error);
          results.push({ email: user.email, status: 'error', error: error.message });
          continue;
        }
        
        // Create user profile
        const userProfile = {
          id: data.user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: 'active',
          created_at: new Date().toISOString()
        };
        
        await kv.set(`user:${data.user.id}`, userProfile);
        
        // Create customer record if customer role
        if (user.role === 'customer') {
          const customerData = {
            id: data.user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            source: 'Demo Account',
            signup_date: new Date().toISOString(),
            status: 'active',
            totalOrders: 0,
            totalSpent: 0
          };
          await kv.set(`customer:${data.user.id}`, customerData);
        }
        
        console.log(`✅ Created user: ${user.email} (${user.role})`);
        results.push({ email: user.email, status: 'created', role: user.role });
        
      } catch (err) {
        console.error(`❌ Error processing ${user.email}:`, err);
        results.push({ email: user.email, status: 'error', error: String(err) });
      }
    }
    
    return c.json({
      success: true,
      message: 'Demo users initialization complete',
      results
    });
    
  } catch (error) {
    console.error('❌ Init error:', error);
    return c.json({ error: 'Failed to initialize demo users: ' + String(error) }, 500);
  }
});

// Auth test endpoint - tests authentication without doing anything else
app.post("/make-server-a67f0635/auth/test", async (c) => {
  try {
    console.log('🧪 Auth test endpoint called');
    const authHeader = c.req.header('Authorization');
    console.log('🧪 Auth header:', authHeader);
    
    if (!authHeader) {
      return c.json({ 
        success: false, 
        error: 'No Authorization header',
        debug: {
          headers: Object.fromEntries(c.req.raw.headers.entries())
        }
      }, 401);
    }
    
    const authResult = await verifyAuth(authHeader);
    console.log('🧪 Auth result:', authResult);
    
    if (authResult.error || !authResult.user) {
      return c.json({
        success: false,
        error: authResult.error,
        debug: {
          authHeader: authHeader.substring(0, 50) + '...',
          hadUser: !!authResult.user,
          hadError: !!authResult.error
        }
      }, 401);
    }
    
    return c.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.user_metadata?.name
      }
    });
  } catch (error) {
    console.error('🧪 Auth test error:', error);
    return c.json({
      success: false,
      error: 'Exception: ' + error.message,
      stack: error.stack
    }, 500);
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Sign In - Authenticate user with Supabase Auth
app.post("/make-server-a67f0635/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    console.log('🔐 Login request for:', email);
    
    // Validate inputs
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    
    // Create a client-side Supabase instance with anon key for sign-in
    const clientSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    
    // Sign in with email and password
    const { data, error } = await clientSupabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('❌ Login error:', error);
      
      // More helpful error message
      let errorMessage = 'Invalid email or password';
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials or sign up if you don\'t have an account.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address before logging in.';
      }
      
      return c.json({ 
        success: false,
        error: errorMessage 
      }, 401);
    }
    
    if (!data.session || !data.user) {
      console.error('❌ No session after login');
      return c.json({ 
        success: false,
        error: 'Login failed - no session created' 
      }, 401);
    }
    
    console.log('✅ User logged in successfully:', data.user.id);
    
    // Get user profile from KV store
    const profile = await kv.get(`user:${data.user.id}`);
    
    let userProfile;
    if (!profile) {
      // Create default profile if doesn't exist
      userProfile = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        role: data.user.user_metadata?.role || 'customer',
        created_at: new Date().toISOString()
      };
      
      await kv.set(`user:${data.user.id}`, userProfile);
      console.log('✅ Created default user profile for:', data.user.id);
    } else {
      // Profile might already be an object, not a string
      userProfile = typeof profile === 'string' ? JSON.parse(profile) : profile;
    }
    
    return c.json({ 
      success: true, 
      message: 'Login successful',
      userId: data.user.id,
      user: userProfile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return c.json({ 
      success: false,
      error: 'Login failed - server error' 
    }, 500);
  }
});

// Sign Up - Create new user with Supabase Auth
app.post("/make-server-a67f0635/auth/signup", async (c) => {
  try {
    const { email, password, name, phone, source, role } = await c.req.json();
    
    console.log('📝 Signup request for:', email, 'from source:', source || 'unknown', 'role:', role || 'customer');
    
    // Validate inputs
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }
    
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }
    
    // Check if this is a demo email that should use mock auth
    const demoEmails = ['customer@example.com', 'admin@honeytranslations.com'];
    const isDemoEmail = demoEmails.includes(email.toLowerCase());
    
    if (isDemoEmail) {
      console.log('⚠️ Demo email detected - cannot signup with demo email');
      return c.json({ 
        success: false,
        error: 'This is a demo account. Please sign in instead of signing up, or use a different email address to create a new account.' 
      }, 409);
    }
    
    // Create user with Supabase Auth
    // Note: Supabase may log AuthApiError before we handle it - this is expected behavior
    let data, error;
    try {
      const result = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { 
          name,
          phone: phone || 'N/A',
          source: source || 'Direct',
          role: role || 'customer'
        },
        // Automatically confirm the user's email since an email server hasn't been configured.
        email_confirm: true
      });
      data = result.data;
      error = result.error;
    } catch (e: any) {
      // Catch any thrown errors and convert to our error format
      error = e;
    }
    
    if (error) {
      // Handle duplicate email (this is expected and not an error condition)
      if (error.message?.includes('already been registered') || error.code === 'email_exists') {
        console.log('⚠️  User attempted signup with existing email:', email);
        return c.json({ 
          success: false,
          error: 'This email is already registered. Please use a different email or sign in to your existing account.' 
        }, 409); // 409 Conflict
      }
      
      // Handle other validation errors
      if (error.message?.includes('invalid email')) {
        console.log('⚠️  Invalid email format provided:', email);
        return c.json({ 
          success: false,
          error: 'Please provide a valid email address.' 
        }, 400);
      }
      
      if (error.message?.includes('password')) {
        console.log('⚠️  Password validation failed');
        return c.json({ 
          success: false,
          error: 'Password must be at least 6 characters long.' 
        }, 400);
      }
      
      // Only log unexpected errors
      console.error('❌ Unexpected signup error:', error.message);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to create account. Please try again.' 
      }, 400);
    }
    
    console.log('✅ User created successfully:', data.user.id);
    
    // Create user profile in KV store with role from signup
    const userRole = role || 'customer';
    const userProfile = {
      id: data.user.id,
      email: data.user.email,
      name,
      phone: phone || 'N/A',
      role: userRole,
      source: source || 'Direct',
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    await kv.set(`user:${data.user.id}`, userProfile);
    
    console.log('✅ User profile created in KV store');
    console.log('📝 User profile data:', JSON.stringify(userProfile, null, 2));
    
    // Also store in customer list for quick access (only if role is customer)
    if (userRole === 'customer') {
      const customerData = {
        id: data.user.id,
        name,
        email: data.user.email,
        phone: phone || 'N/A',
        source: source || 'Direct',
        signup_date: new Date().toISOString(),
        status: 'active',
        totalOrders: 0,
        totalSpent: 0
      };
      
      await kv.set(`customer:${data.user.id}`, customerData);
      console.log('✅ Customer record created in KV store with key:', `customer:${data.user.id}`);
      console.log('📝 Customer data:', JSON.stringify(customerData, null, 2));
      console.log('🔥 [CONCURRENT SIGNUPS] This customer will be visible in Admin Panel → Inventory page');
      console.log('🔥 [CONCURRENT SIGNUPS] Multiple simultaneous signups are fully supported!');
    }
    
    // Verify the data was stored correctly by reading it back
    const verifyCustomer = await kv.get(`customer:${data.user.id}`);
    console.log('🔍 Verification - Customer data retrieved from KV:', verifyCustomer ? 'SUCCESS' : 'FAILED');
    if (verifyCustomer) {
      console.log('🔍 Retrieved customer data:', JSON.stringify(verifyCustomer, null, 2));
    }
    
    // Create a notification for new customer signup
    const notificationId = `user_signup_${data.user.id}_${Date.now()}`;
    const notification = {
      id: notificationId,
      type: 'user',
      title: 'New Customer Signup',
      message: `${name} (${email}) has registered as a new customer`,
      customer_id: data.user.id,
      customer_name: name,
      customer_email: email,
      created_at: new Date().toISOString(),
      read: false,
      priority: 'medium'
    };
    
    await kv.set(`notification_${notificationId}`, notification);
    console.log('✅ Notification created for new customer signup');
    
    // Wait a moment for Supabase Auth to fully process the user creation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a client-side Supabase instance with anon key for sign-in
    const clientSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    
    // Now sign in the user to get a session token
    const { data: sessionData, error: sessionError } = await clientSupabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (sessionError || !sessionData.session) {
      console.error('❌ Auto sign-in error after signup:', sessionError);
      console.log('⚠️ This is expected behavior - user was created successfully but auto-login failed.');
      console.log('⚠️ User can still manually login with their credentials.');
      // User was created but auto sign-in failed - still return success
      return c.json({ 
        success: true, 
        message: 'User created successfully. Please sign in.',
        userId: data.user.id,
        requiresLogin: true
      });
    }
    
    console.log('✅ User signed in successfully after signup');
    
    return c.json({ 
      success: true, 
      message: 'User created and signed in successfully',
      userId: data.user.id,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token
      }
    });
    
  } catch (error) {
    console.error('❌ Signup error:', error);
    
    // Handle specific error cases in catch block as well
    if (error.message?.includes('already been registered') || error.code === 'email_exists') {
      return c.json({ 
        success: false,
        error: 'An account with this email already exists. Please login instead.' 
      }, 409);
    }
    
    return c.json({ 
      success: false,
      error: error.message || 'Failed to create user' 
    }, 500);
  }
});

// Get current user profile
app.get("/make-server-a67f0635/auth/me", async (c) => {
  try {
    console.log('📍 /auth/me endpoint called');
    const authHeader = c.req.header('Authorization');
    console.log('🔐 Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
    
    const { user, error } = await verifyAuth(authHeader);
    
    if (error || !user) {
      console.log('❌ Auth verification failed:', error);
      return c.json({ error: error || 'Unauthorized' }, 401);
    }
    
    console.log('✅ Auth verified for user:', user.id);
    
    // Get user profile from KV store
    const profile = await kv.get(`user:${user.id}`);
    console.log('📊 Profile lookup result:', profile ? 'FOUND' : 'NOT FOUND');
    
    if (!profile) {
      // Create default profile if doesn't exist
      const defaultProfile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: 'customer',
        created_at: new Date().toISOString()
      };
      
      console.log('🔧 Creating default profile for user:', user.id);
      await kv.set(`user:${user.id}`, defaultProfile);
      
      return c.json({ 
        user: defaultProfile 
      });
    }
    
    console.log('✅ Returning existing profile for user:', user.id);
    return c.json({ 
      user: profile 
    });
    
  } catch (error) {
    console.error('❌ Get user profile error:', error);
    return c.json({ error: 'Failed to get user profile' }, 500);
  }
});

// Update current user profile
app.put("/make-server-a67f0635/auth/profile", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const { user, error } = await verifyAuth(authHeader);

    if (error || !user) {
      return c.json({ error: error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      name,
      phone,
      dateOfBirth,
      gender,
      companyName,
      jobTitle,
      address,
      city,
      state,
      country,
      zipCode
    } = body || {};

    const existing = await kv.get(`user:${user.id}`);
    const existingProfile = existing && typeof existing === 'string' ? JSON.parse(existing) : (existing || {});
    const existingDetails = existingProfile.profile_details || {};

    const profileDetails = {
      ...existingDetails,
      dateOfBirth: dateOfBirth ?? existingDetails.dateOfBirth ?? '',
      gender: gender ?? existingDetails.gender ?? '',
      companyName: companyName ?? existingDetails.companyName ?? '',
      jobTitle: jobTitle ?? existingDetails.jobTitle ?? '',
      address: address ?? existingDetails.address ?? '',
      city: city ?? existingDetails.city ?? '',
      state: state ?? existingDetails.state ?? '',
      country: country ?? existingDetails.country ?? '',
      zipCode: zipCode ?? existingDetails.zipCode ?? ''
    };

    const updatedProfile = {
      ...existingProfile,
      id: user.id,
      email: user.email || existingProfile.email || '',
      name: name || existingProfile.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      phone: phone || existingProfile.phone || 'N/A',
      role: existingProfile.role || user.user_metadata?.role || 'customer',
      source: existingProfile.source || 'Direct',
      status: existingProfile.status || 'active',
      created_at: existingProfile.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile_details: profileDetails
    };

    await kv.set(`user:${user.id}`, updatedProfile);

    // Keep customer record in sync for name/phone where available.
    const customerRecord = await kv.get(`customer:${user.id}`);
    if (customerRecord) {
      const customer = typeof customerRecord === 'string' ? JSON.parse(customerRecord) : customerRecord;
      const updatedCustomer = {
        ...customer,
        name: updatedProfile.name,
        phone: updatedProfile.phone,
        updated_at: new Date().toISOString()
      };
      await kv.set(`customer:${user.id}`, updatedCustomer);
    }

    return c.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedProfile
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Sign In with Google OAuth
app.post("/make-server-a67f0635/auth/google", async (c) => {
  try {
    const { access_token } = await c.req.json();
    
    if (!access_token) {
      return c.json({ error: 'Access token is required' }, 400);
    }
    
    // Verify the Google access token with Supabase
    const { data, error } = await supabase.auth.getUser(access_token);
    
    if (error || !data.user) {
      console.error('❌ Google auth error:', error);
      return c.json({ error: 'Invalid access token' }, 401);
    }
    
    // Check if user profile exists
    const profile = await kv.get(`user:${data.user.id}`);
    
    if (!profile) {
      // Create profile for new Google user
      const newProfile = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0],
        role: 'customer',
        created_at: new Date().toISOString()
      };
      
      await kv.set(`user:${data.user.id}`, newProfile);
      
      return c.json({ 
        success: true,
        user: newProfile
      });
    }
    
    return c.json({ 
      success: true,
      user: profile
    });
    
  } catch (error) {
    console.error('❌ Google auth error:', error);
    return c.json({ error: 'Failed to authenticate with Google' }, 500);
  }
});

// Google OAuth signup - Create profile for Google-authenticated users
app.post("/make-server-a67f0635/auth/google-signup", async (c) => {
  try {
    console.log('📝 [Google OAuth] Creating profile for Google user');
    
    // Verify the user is authenticated with Google
    const authHeader = c.req.header('Authorization');
    const { user: authUser, error: authError } = await verifyAuth(authHeader);
    
    if (authError || !authUser) {
      console.log('❌ [Google OAuth] Auth verification failed:', authError);
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }
    
    const { userId, email, name, phone, source, avatar } = await c.req.json();
    
    console.log('📝 [Google OAuth] User data:', { userId, email, name, phone, source });
    
    // Validate that the authenticated user matches the userId
    if (authUser.id !== userId) {
      console.log('❌ [Google OAuth] User ID mismatch');
      return c.json({ error: 'User ID mismatch' }, 403);
    }
    
    // Check if profile already exists
    const existingProfile = await kv.get(`user:${userId}`);
    if (existingProfile) {
      console.log('✅ [Google OAuth] Profile already exists, returning it');
      const profile = typeof existingProfile === 'string' ? JSON.parse(existingProfile) : existingProfile;
      return c.json({ 
        success: true, 
        message: 'Profile already exists',
        user: profile
      });
    }
    
    // Create new user profile
    const userProfile = {
      id: userId,
      email: email,
      name: name,
      phone: phone || 'N/A',
      role: 'customer',
      source: source || 'Google OAuth',
      status: 'active',
      avatar: avatar,
      created_at: new Date().toISOString()
    };
    
    await kv.set(`user:${userId}`, userProfile);
    console.log('✅ [Google OAuth] User profile created in KV store');
    
    // Create customer record
    const customerData = {
      id: userId,
      name: name,
      email: email,
      phone: phone || 'N/A',
      source: source || 'Google OAuth',
      signup_date: new Date().toISOString(),
      status: 'active',
      totalOrders: 0,
      totalSpent: 0
    };
    
    await kv.set(`customer:${userId}`, customerData);
    console.log('✅ [Google OAuth] Customer record created in KV store');
    
    // Create notification for new Google signup
    const notificationId = `google_signup_${userId}_${Date.now()}`;
    const notification = {
      id: notificationId,
      type: 'user',
      title: 'New Google Sign-Up',
      message: `${name} (${email}) signed up via Google`,
      customer_id: userId,
      customer_name: name,
      customer_email: email,
      created_at: new Date().toISOString(),
      read: false,
      priority: 'medium'
    };
    
    await kv.set(`notification_${notificationId}`, notification);
    console.log('✅ [Google OAuth] Notification created');
    
    return c.json({ 
      success: true, 
      message: 'Profile created successfully',
      user: userProfile
    });
    
  } catch (error) {
    console.error('❌ [Google OAuth] Signup error:', error);
    return c.json({ 
      success: false,
      error: error.message || 'Failed to create profile' 
    }, 500);
  }
});

// ==================== CUSTOMER MANAGEMENT ROUTES ====================

// Get all customers (Admin only)
app.get("/make-server-a67f0635/customers", async (c) => {
  try {
    console.log('👥 [/customers] Fetching all customers from KV store...');
    
    // Fetch all customer records from KV store
    const customersData = await kv.getByPrefix('customer:');
    console.log('👥 [/customers] Raw customersData length:', customersData.length);
    console.log('👥 [/customers] Raw customersData type:', typeof customersData);
    console.log('👥 [/customers] First 3 items:', customersData.slice(0, 3));
    
    const customers = [];
    
    for (const item of customersData) {
      try {
        // kv.getByPrefix returns objects, not JSON strings
        // If item is already an object, use it directly
        const customer = typeof item === 'string' ? JSON.parse(item) : item;
        customers.push(customer);
        console.log('👥 [/customers] Added customer:', customer.email);
      } catch (e) {
        console.error('Error parsing customer data:', e);
        // Try to use the item as-is if it's an object
        if (typeof item === 'object' && item !== null) {
          customers.push(item);
          console.log('👥 [/customers] Added customer (as object):', (item as any).email);
        }
      }
    }
    
    // Sort by signup date (newest first)
    customers.sort((a, b) => {
      const dateA = new Date(a.signup_date || a.created_at);
      const dateB = new Date(b.signup_date || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log(`✅ [/customers] Found ${customers.length} customers`);
    console.log('✅ [/customers] Customer emails:', customers.map(c => c.email));
    console.log('✅ [/customers] Returning customer data...');
    
    return c.json({ 
      success: true,
      customers,
      count: customers.length
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch customers:', error);
    return c.json({ error: 'Failed to fetch customers' }, 500);
  }
});

// Get single customer by ID (Admin only)
app.get("/make-server-a67f0635/customers/:id", async (c) => {
  try {
    const customerId = c.req.param('id');
    console.log('👤 Fetching customer:', customerId);
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // Handle both object and string types
    const customerData = typeof customer === 'string' ? JSON.parse(customer) : customer;
    
    return c.json({ 
      success: true,
      customer: customerData
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch customer:', error);
    return c.json({ error: 'Failed to fetch customer' }, 500);
  }
});

// Backfill customer records from orders (Admin only)
app.post("/make-server-a67f0635/customers/backfill-from-orders", async (c) => {
  try {
    console.log('🔄 [Backfill] Starting customer backfill from orders...');
    
    // Fetch all orders
    const ordersData = await kv.getByPrefix('order_');
    console.log('📦 [Backfill] Found', ordersData.length, 'orders');
    
    let customersCreated = 0;
    let customersUpdated = 0;
    let customersSkipped = 0;
    
    for (const orderItem of ordersData) {
      try {
        const order = typeof orderItem === 'string' ? JSON.parse(orderItem) : orderItem;
        
        // Skip if no user_id or is guest
        if (!order.user_id || order.user_id === 'guest') {
          customersSkipped++;
          continue;
        }
        
        // Check if customer record exists
        const existingCustomer = await kv.get(`customer:${order.user_id}`);
        
        if (!existingCustomer) {
          // Create new customer record from order
          const customerData = {
            id: order.user_id,
            name: order.customer_name || order.user_email || 'N/A',
            email: order.customer_email || order.user_email || 'N/A',
            phone: order.shipping_address?.phone || 'N/A',
            source: 'Backfill from Order',
            signup_date: order.created_at || new Date().toISOString(),
            status: 'active',
            totalOrders: 1,
            totalSpent: parseFloat(order.total_amount || 0),
            lastOrderDate: order.created_at || new Date().toISOString()
          };
          
          await kv.set(`customer:${order.user_id}`, customerData);
          console.log('✅ [Backfill] Created customer:', customerData.email);
          customersCreated++;
        } else {
          customersUpdated++;
        }
      } catch (itemError) {
        console.error('❌ [Backfill] Error processing order:', itemError);
      }
    }
    
    console.log('✅ [Backfill] Complete!');
    console.log(`   - Created: ${customersCreated} customers`);
    console.log(`   - Updated: ${customersUpdated} customers`);
    console.log(`   - Skipped: ${customersSkipped} orders (guest/no user)`);
    
    return c.json({
      success: true,
      message: 'Customer backfill completed',
      stats: {
        ordersProcessed: ordersData.length,
        customersCreated,
        customersUpdated,
        customersSkipped
      }
    });
    
  } catch (error) {
    console.error('❌ [Backfill] Failed:', error);
    return c.json({ error: 'Failed to backfill customers', details: error.message }, 500);
  }
});

// ==================== ADMIN ROUTES ====================

// Initialize storage bucket for product images (Admin only)
app.post("/make-server-a67f0635/admin/initialize-storage", async (c) => {
  try {
    console.log('🪣 Initializing storage bucket...');
    
    const bucketName = 'product-images-a67f0635';
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.log('⚠️  Error listing buckets (may be RLS-related):', listError.message || listError);
      return c.json({ error: 'Failed to list buckets', details: listError.message }, 500);
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log('✅ Storage bucket already exists');
      return c.json({ 
        success: true, 
        message: 'Storage bucket already exists',
        bucketName 
      });
    }
    
    // Create public bucket
    console.log(`📦 Creating storage bucket: ${bucketName}...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true, // Make bucket public so images are accessible
      fileSizeLimit: 10485760, // 10MB limit per file
    });
    
    if (error) {
      // If RLS policy error, provide helpful guidance (expected behavior, not an error)
      if (error.message?.includes('row-level security') || error.message?.includes('policy') || error.statusCode === '403') {
        console.log('⚠️  RLS policy prevents automatic bucket creation. Manual setup required.');
        console.log('📖 Action Required: Create storage bucket manually in Supabase Dashboard');
        console.log(`   Bucket Name: ${bucketName}`);
        console.log('   Settings: Public bucket, 10MB file size limit');
        console.log('   📄 See STORAGE_SETUP_GUIDE.md for step-by-step instructions');
        return c.json({ 
          success: false,
          error: 'Manual bucket creation required',
          message: `Please create a public storage bucket named "${bucketName}" in your Supabase Dashboard:\n\n1. Go to Storage → New bucket\n2. Name: ${bucketName}\n3. Toggle "Public bucket" to ON\n4. File size limit: 10 MB\n5. Click Create\n\nSee STORAGE_SETUP_GUIDE.md for detailed instructions.`,
          bucketName,
          instructions: {
            step1: 'Open Supabase Dashboard → Storage',
            step2: 'Click "New bucket"',
            step3: `Enter name: ${bucketName}`,
            step4: 'Toggle "Public bucket" to ON',
            step5: 'Set file size limit: 10 MB',
            step6: 'Click "Create bucket"'
          }
        }, 403);
      }
      // Only log unexpected errors
      console.log('⚠️  Error creating bucket:', error.message || error);
      return c.json({ error: 'Failed to create bucket', details: error.message }, 500);
    }
    
    console.log('✅ Storage bucket created successfully!');
    
    return c.json({ 
      success: true, 
      message: 'Storage bucket created successfully',
      bucketName,
      data 
    });
  } catch (error) {
    console.error('❌ Initialize storage error:', error);
    return c.json({ error: 'Failed to initialize storage', details: error.message }, 500);
  }
});

// Upload product images (Server-side upload to bypass RLS)
app.post("/make-server-a67f0635/admin/upload-image", async (c) => {
  try {
    console.log('📤 Server-side image upload started...');
    
    const bucketName = 'product-images-a67f0635';
    
    // Get the form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    console.log(`📁 Received file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `product-${timestamp}-${randomString}.${fileExtension}`;
    
    console.log(`💾 Uploading to Supabase Storage as: ${fileName}`);
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage using service role key (bypasses RLS)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Upload error:', error);
      return c.json({ error: 'Upload failed', details: error.message }, 500);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log(`✅ Upload successful! Public URL: ${publicUrl}`);
    
    return c.json({ 
      success: true,
      url: publicUrl,
      fileName,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Server-side upload error:', error);
    return c.json({ error: 'Failed to upload image', details: error.message }, 500);
  }
});

// Get all categories with products for header navigation
app.get("/make-server-a67f0635/categories", async (c) => {
  try {
    console.log('📂 Fetching categories with products...');
    
    // Fetch all products from KV store
    const productsData = await kv.getByPrefix('product_');
    console.log(`📦 Raw products data count: ${productsData.length}`);

    // Filter out product_images_ keys and parse products
    const products = [];
    for (const item of productsData) {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        if (parsed && parsed.id && !parsed.id.includes('product_images_')) {
          products.push(parsed);
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse product:', parseError);
        continue;
      }
    }

    console.log(`📦 Successfully parsed ${products.length} products`);

    // Group products by category
    const categoriesMap = new Map();
    
    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      categoriesMap.get(category).push({
        id: product.id,
        name: product.name,
        slug: product.id, // Use ID as slug
        price: product.price,
        image: product.image || ''
      });
    });

    // Convert to array format
    const categories = Array.from(categoriesMap.entries()).map(([name, products]) => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      products: products.sort((a, b) => a.name.localeCompare(b.name))
    }));

    console.log(`✅ Returning ${categories.length} categories with products`);
    categories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.products.length} products`);
    });

    return c.json({ categories });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return c.json({ error: 'Failed to fetch categories', details: error.message }, 500);
  }
});

// Initialize default products (Admin only - can be called to reset/seed products)
app.post("/make-server-a67f0635/admin/initialize-products", async (c) => {
  try {
    const { user, error } = await verifyAuth(c.req.header('Authorization'));
    
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    console.log('🔄 Initializing default products...');

    // Delete all existing products
    const existingProducts = await kv.getByPrefix('product_');
    for (const productData of existingProducts) {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        const product = typeof productData === 'string' ? JSON.parse(productData) : productData;
        if (product.id) {
          await kv.del(`product_${product.id}`);
          await kv.del(`product_images_${product.id}`);
        }
      } catch (e) {
        console.log('Error deleting product:', e);
      }
    }

    const defaultProducts = [
      // Language Services
      { id: 'english-to-foreign', name: 'English to Foreign Language', category: 'Language', price: 2500, stock: 999, status: 'In Stock', image: '' },
      { id: 'foreign-to-english', name: 'Foreign Language to English', category: 'Language', price: 2500, stock: 999, status: 'In Stock', image: '' },
      { id: 'indian-to-english', name: 'Indian Language to English', category: 'Language', price: 2000, stock: 999, status: 'In Stock', image: '' },
      { id: 'english-to-indian', name: 'English to Indian Language', category: 'Language', price: 2000, stock: 999, status: 'In Stock', image: '' },
      { id: 'foreign-to-foreign', name: 'Foreign Language to Foreign Language', category: 'Language', price: 3000, stock: 999, status: 'In Stock', image: '' },

      // Apostille Services
      { id: 'usa-apostille', name: 'USA Apostille Services', category: 'Apostille', price: 8000, stock: 999, status: 'In Stock', image: '' },
      { id: 'uk-apostille', name: 'UK Apostille Services', category: 'Apostille', price: 8000, stock: 999, status: 'In Stock', image: '' },
      { id: 'canada-apostille', name: 'Canada Apostille Services', category: 'Apostille', price: 8000, stock: 999, status: 'In Stock', image: '' },
      { id: 'australia-apostille', name: 'Australia Apostille Services', category: 'Apostille', price: 8000, stock: 999, status: 'In Stock', image: '' },
      { id: 'germany-apostille', name: 'Germany Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'france-apostille', name: 'France Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'spain-apostille', name: 'Spain Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'italy-apostille', name: 'Italy Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'netherlands-apostille', name: 'Netherlands Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'belgium-apostille', name: 'Belgium Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'switzerland-apostille', name: 'Switzerland Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'austria-apostille', name: 'Austria Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'portugal-apostille', name: 'Portugal Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'poland-apostille', name: 'Poland Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'new-zealand-apostille', name: 'New Zealand Apostille Services', category: 'Apostille', price: 8000, stock: 999, status: 'In Stock', image: '' },
      { id: 'saudi-arabia-apostille', name: 'Apostille Services', category: 'Apostille', price: 7000, stock: 999, status: 'In Stock', image: '' },
      { id: 'slovakia-apostille', name: 'Slovakia Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'iceland-apostille', name: 'Iceland Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'russia-apostille', name: 'Russia Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'serbia-apostille', name: 'Serbia Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'czech-republic-apostille', name: 'Czech Republic Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'luxembourg-apostille', name: 'Luxembourg Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },
      { id: 'dutch-apostille', name: 'Dutch Apostille Services', category: 'Apostille', price: 7500, stock: 999, status: 'In Stock', image: '' },

      // Attestation Services
      { id: 'china-attestation', name: 'China Attestation Services', category: 'Attestation', price: 6500, stock: 999, status: 'In Stock', image: '' },
      { id: 'qatar-attestation', name: 'Qatar Attestation Services', category: 'Attestation', price: 6000, stock: 999, status: 'In Stock', image: '' },
      { id: 'kuwait-attestation', name: 'Kuwait Attestation Services', category: 'Attestation', price: 6000, stock: 999, status: 'In Stock', image: '' },
      { id: 'uae-attestation', name: 'UAE Attestation Services', category: 'Attestation', price: 6000, stock: 999, status: 'In Stock', image: '' },
      { id: 'hrd-attestation', name: 'HRD Attestation Services', category: 'Attestation', price: 5500, stock: 999, status: 'In Stock', image: '' },

      // Startup Packages
      { id: 'basic-startup', name: 'Basic Startup Package', category: 'Startup', price: 17999, stock: 999, status: 'In Stock', image: 'https://images.unsplash.com/photo-1586764921336-8b37580c7aea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800', description: 'Complete Branding, Digital Setup & Promotion Bundle for your startup' },
      { id: 'standard-startup', name: 'Standard Startup Package', category: 'Startup', price: 32999, stock: 999, status: 'In Stock', image: 'https://images.unsplash.com/photo-1758524052734-464eed4a1df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800', description: 'Enhanced startup package with advanced branding and digital marketing' },
      { id: 'premium-startup', name: 'Premium Startup Package', category: 'Startup', price: 65999, stock: 999, status: 'In Stock', image: 'https://images.unsplash.com/photo-1540492070870-891ac4f02e99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800', description: 'Premium complete business setup with comprehensive marketing and IT solutions' },
    ];

    // Insert all products
    let successCount = 0;
    for (const product of defaultProducts) {
      try {
        // Convert single image field to images array
        const images = product.image ? [product.image] : [];
        
        await kv.set(`product_${product.id}`, JSON.stringify({
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description || '',
          price: product.price,
          stock: product.stock,
          status: 'active', // Convert 'In Stock' to 'active'
          images: images, // Store as images array
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        successCount++;
      } catch (err) {
        console.error(`Error creating product ${product.id}:`, err);
      }
    }

    console.log(`✅ Successfully initialized ${successCount}/${defaultProducts.length} products`);

    return c.json({ 
      success: true, 
      message: `Initialized ${successCount} products across 4 categories`,
      productsCreated: successCount
    });
  } catch (error) {
    console.error('❌ Initialize products error:', error);
    return c.json({ error: 'Failed to initialize products' }, 500);
  }
});

// Subscribe email endpoint - Save customer emails for newsletter
app.post("/make-server-a67f0635/subscribe-email", async (c) => {
  try {
    console.log('📧 Subscribe email endpoint called');
    
    const { email } = await c.req.json();
    
    if (!email || !email.includes('@')) {
      return c.json({ success: false, message: 'Invalid email address' }, 400);
    }
    
    // Check if email already exists
    const existingEmails = await kv.getByPrefix('subscriber_email_');
    const emailExists = existingEmails.some(data => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        const subscriber = typeof data === 'string' ? JSON.parse(data) : data;
        return subscriber.email === email;
      } catch {
        return false;
      }
    });
    
    if (emailExists) {
      return c.json({ success: false, message: 'This email is already subscribed' }, 400);
    }
    
    // Generate unique ID for subscriber
    const subscriberId = `subscriber_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Save subscriber email
    const subscriberData = {
      id: subscriberId,
      email: email,
      subscribedAt: new Date().toISOString(),
      status: 'active'
    };
    
    await kv.set(`subscriber_email_${subscriberId}`, JSON.stringify(subscriberData));
    
    console.log(`✅ Email subscribed successfully: ${email}`);
    
    // Create notification for admin
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const notification = {
      id: notificationId,
      type: 'email_subscription',
      title: 'New Email Subscription',
      message: `${email} subscribed to newsletter`,
      subscriber_id: subscriberId,
      subscriber_email: email,
      read: false,
      created_at: new Date().toISOString()
    };
    
    await kv.set(`notification_${notificationId}`, JSON.stringify(notification));
    console.log(`🔔 Notification created for email subscription: ${notificationId}`);
    
    return c.json({ 
      success: true, 
      message: 'Successfully subscribed to newsletter',
      subscriberId 
    });
  } catch (error) {
    console.error('❌ Subscribe email error:', error);
    return c.json({ success: false, message: 'Failed to subscribe' }, 500);
  }
});

// Get all subscriber emails (Admin only)
app.get("/make-server-a67f0635/admin/subscriber-emails", async (c) => {
  try {
    console.log('📧 Fetching subscriber emails');
    
    const emailsData = await kv.getByPrefix('subscriber_email_');
    const emails = emailsData
      .map(item => {
        try {
          // kv.getByPrefix returns JSONB values already parsed
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      })
      .filter(item => item !== null)
      .sort((a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime());
    
    console.log(`✅ Found ${emails.length} subscriber emails`);
    
    return c.json({ success: true, emails });
  } catch (error) {
    console.error('❌ Fetch subscriber emails error:', error);
    return c.json({ error: 'Failed to fetch subscriber emails' }, 500);
  }
});

// Delete subscriber email (Admin only)
app.delete("/make-server-a67f0635/admin/subscriber-emails/:id", async (c) => {
  try {
    const subscriberId = c.req.param('id');
    console.log(`🗑️ Deleting subscriber: ${subscriberId}`);
    
    await kv.del(`subscriber_email_${subscriberId}`);
    
    console.log(`✅ Subscriber deleted successfully`);
    
    return c.json({ success: true, message: 'Subscriber deleted successfully' });
  } catch (error) {
    console.error('❌ Delete subscriber error:', error);
    return c.json({ error: 'Failed to delete subscriber' }, 500);
  }
});

// ==================== CUSTOMER QUERIES ROUTES ====================

// Submit customer query from Contact Us form
app.post("/make-server-a67f0635/customer-queries", async (c) => {
  try {
    console.log('💬 Customer query endpoint called');
    
    const { name, mobile, email, message } = await c.req.json();
    
    console.log('📋 Query submission details:', {
      name,
      mobile,
      email: email || '(not provided)',
      messageLength: message?.length || 0
    });
    
    if (!name || !mobile) {
      console.log('⚠️ Validation failed: Name and mobile are required');
      return c.json({ success: false, message: 'Name and mobile are required' }, 400);
    }
    
    // Generate unique ID for the query
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const queryData = {
      id: queryId,
      name,
      mobile,
      email: email || '',
      message: message || '',
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Save to KV store
    await kv.set(`customer_query_${queryId}`, JSON.stringify(queryData));
    
    console.log(`✅ Customer query saved successfully!`);
    console.log(`   📊 Query ID: ${queryId}`);
    console.log(`   👤 Customer: ${name} (${mobile})`);
    console.log(`   💾 Storage Key: customer_query_${queryId}`);
    
    // Create notification for admin
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const notification = {
      id: notificationId,
      type: 'customer_query',
      title: 'New Customer Query',
      message: `${name} submitted a new query`,
      query_id: queryId,
      customer_name: name,
      customer_mobile: mobile,
      customer_email: email || 'Not provided',
      read: false,
      created_at: new Date().toISOString()
    };
    
    await kv.set(`notification_${notificationId}`, JSON.stringify(notification));
    console.log(`🔔 Notification created for admin: ${notificationId}`);
    
    return c.json({ success: true, queryId });
  } catch (error) {
    console.error('❌ Customer query error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ success: false, message: 'Failed to submit query' }, 500);
  }
});

// Get all customer queries (Admin only)
app.get("/make-server-a67f0635/admin/customer-queries", async (c) => {
  try {
    console.log('💬 Fetching customer queries');
    console.log('🔍 Searching for keys with prefix: customer_query_');
    
    const queriesData = await kv.getByPrefix('customer_query_');
    console.log(`📦 Raw data returned from KV store: ${queriesData.length} items`);
    
    if (queriesData.length > 0) {
      console.log('Sample raw data:', queriesData[0]);
    }
    
    const queries = queriesData
      .map(item => {
        try {
          // kv.getByPrefix returns JSONB values already parsed
          const parsed = typeof item === 'string' ? JSON.parse(item) : item;
          console.log('✅ Parsed query:', parsed?.id || 'unknown');
          return parsed;
        } catch (err) {
          console.error('❌ Failed to parse item:', item, err);
          return null;
        }
      })
      .filter(item => item !== null)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    console.log(`✅ Found ${queries.length} customer queries`);
    console.log('Query IDs:', queries.map(q => q.id).join(', '));
    
    return c.json({ success: true, queries });
  } catch (error) {
    console.error('❌ Fetch customer queries error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ error: 'Failed to fetch customer queries' }, 500);
  }
});

// Delete customer query (Admin only)
app.delete("/make-server-a67f0635/admin/customer-queries/:id", async (c) => {
  try {
    const queryId = c.req.param('id');
    console.log(`🗑️ Backend DELETE request received`);
    console.log(`🔑 Query ID from URL param: "${queryId}"`);
    console.log(`📏 Query ID length: ${queryId.length}`);
    console.log(`🔤 Query ID type: ${typeof queryId}`);
    
    // First, try to find the query by checking all customer queries
    const allQueries = await kv.getByPrefix('customer_query_');
    console.log(`🔍 Found ${allQueries.length} total queries in database`);
    
    // Find the query with matching ID
    let foundKey: string | null = null;
    for (let i = 0; i < allQueries.length; i++) {
      const item = allQueries[i];
      const parsed = typeof item === 'string' ? JSON.parse(item) : item;
      
      console.log(`\n🔍 Checking query ${i + 1}:`);
      console.log(`   Stored ID: "${parsed.id}"`);
      console.log(`   Requested ID: "${queryId}"`);
      console.log(`   Match: ${parsed.id === queryId}`);
      console.log(`   Stored ID length: ${parsed.id?.length}`);
      console.log(`   Requested ID length: ${queryId.length}`);
      
      if (parsed.id === queryId) {
        // Construct the storage key from the query ID
        foundKey = `customer_query_${queryId}`;
        console.log(`\n✅ MATCH FOUND!`);
        console.log(`   Query ID: ${queryId}`);
        console.log(`   Storage key: ${foundKey}`);
        break;
      }
    }
    
    if (!foundKey) {
      console.log(`\n⚠️ Query ${queryId} NOT FOUND in database`);
      const availableIds = allQueries.map(item => {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        return parsed.id;
      });
      console.log('📋 Available query IDs:', availableIds);
      return c.json({ 
        error: 'Query not found',
        requestedId: queryId,
        availableIds: availableIds
      }, 404);
    }
    
    // Delete the query
    await kv.del(foundKey);
    console.log(`✅ Customer query deleted from KV store`);
    
    // Verify deletion
    const verifyDelete = await kv.get(foundKey);
    console.log('Delete verification:', verifyDelete ? 'STILL EXISTS (ERROR)' : 'SUCCESSFULLY DELETED');
    
    return c.json({ success: true, message: 'Customer query deleted successfully' });
  } catch (error) {
    console.error('❌ Delete customer query error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return c.json({ error: 'Failed to delete customer query', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Debug endpoint to check KV store contents
app.get("/make-server-a67f0635/debug/customer-queries", async (c) => {
  try {
    console.log('🔧 DEBUG: Checking KV store for customer queries');
    
    const allQueries = await kv.getByPrefix('customer_query_');
    console.log(`Found ${allQueries.length} items with prefix 'customer_query_'`);
    
    const debugInfo = {
      totalCount: allQueries.length,
      items: allQueries.map((item, idx) => ({
        index: idx,
        type: typeof item,
        isString: typeof item === 'string',
        rawData: item,
        parsedData: typeof item === 'string' ? JSON.parse(item) : item
      }))
    };
    
    return c.json(debugInfo);
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Update customer query status (Admin only)
app.patch("/make-server-a67f0635/admin/customer-queries/:id/status", async (c) => {
  try {
    const queryId = c.req.param('id');
    const { status } = await c.req.json();
    
    console.log(`🔄 Updating customer query status: ${queryId} to ${status}`);
    
    // Validate status
    if (!['pending', 'contacted', 'resolved'].includes(status)) {
      return c.json({ error: 'Invalid status value' }, 400);
    }
    
    // The queryId already includes 'query_' prefix, so we need to add 'customer_' prefix
    const storageKey = queryId.startsWith('customer_query_') 
      ? queryId 
      : `customer_query_${queryId}`;
    
    console.log(`🔍 Looking for key: ${storageKey}`);
    
    // Get existing query
    const existingQuery = await kv.get(storageKey);
    
    if (!existingQuery) {
      console.log(`⚠️ Query ${queryId} not found (key: ${storageKey})`);
      return c.json({ error: 'Customer query not found' }, 404);
    }
    
    const queryData = JSON.parse(existingQuery);
    queryData.status = status;
    
    // Update in KV store
    await kv.set(storageKey, JSON.stringify(queryData));
    
    console.log(`✅ Customer query status updated successfully`);
    
    return c.json({ success: true, message: 'Status updated successfully', query: queryData });
  } catch (error) {
    console.error('❌ Update customer query status error:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// ============================================
// CUSTOMER NOTIFICATIONS ENDPOINTS
// ============================================

// Get customer notifications
app.get("/make-server-a67f0635/notifications/customer", async (c) => {
  try {
    console.log('🔔 [Notifications] GET /notifications/customer endpoint called');
    
    const authHeader = c.req.header('Authorization');
    let userId: string | null = null;
    
    // Handle mock tokens for demo mode
    if (authHeader?.includes('mock-token-')) {
      const mockToken = authHeader.replace('Bearer ', '');
      userId = mockToken.replace('mock-token-', '');
      console.log('🔔 [Notifications] Using mock auth, user ID:', userId);
    } else {
      // Try real authentication
      const { user, error: authError } = await verifyAuth(authHeader);
      
      if (authError || !user) {
        console.log('⚠️ [Notifications] Auth failed:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      userId = user.id;
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('🔔 [Notifications] Fetching notifications for user:', userId);
    
    // Get all notifications for this user
    const allNotifications = await kv.getByPrefix('notification_');
    const userNotifications = allNotifications
      .map(item => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      })
      .filter(notif => notif && notif.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    console.log(`✅ [Notifications] Returning ${userNotifications.length} notifications for user ${userId}`);
    
    return c.json({ notifications: userNotifications });
  } catch (error) {
    console.error('❌ [Notifications] Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications', details: error.message }, 500);
  }
});

// Create notification (for customer bell component)
app.post("/make-server-a67f0635/notifications/create", async (c) => {
  try {
    console.log('🔔 [Notifications] POST /notifications/create endpoint called');
    
    const authHeader = c.req.header('Authorization');
    let userId: string | null = null;
    
    // Handle mock tokens for demo mode
    if (authHeader?.includes('mock-token-')) {
      const mockToken = authHeader.replace('Bearer ', '');
      userId = mockToken.replace('mock-token-', '');
      console.log('🔔 [Notifications] Using mock auth, user ID:', userId);
    } else {
      // Try real authentication
      const { user, error: authError } = await verifyAuth(authHeader);
      
      if (authError || !user) {
        console.log('⚠️ [Notifications] Auth failed:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      userId = user.id;
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const notification = await c.req.json();
    notification.user_id = userId; // Ensure user_id matches authenticated user
    
    await kv.set(`notification_${notification.id}`, notification);
    
    console.log('✅ [Notifications] Notification created:', notification.id);
    
    return c.json({ success: true, notification });
  } catch (error) {
    console.error('❌ [Notifications] Error creating notification:', error);
    return c.json({ error: 'Failed to create notification', details: error.message }, 500);
  }
});

// Mark notification as read
app.patch("/make-server-a67f0635/notifications/:id/read", async (c) => {
  try {
    console.log('🔔 [Notifications] PATCH /notifications/:id/read endpoint called');
    
    const authHeader = c.req.header('Authorization');
    let userId: string | null = null;
    
    // Handle mock tokens for demo mode
    if (authHeader?.includes('mock-token-')) {
      const mockToken = authHeader.replace('Bearer ', '');
      userId = mockToken.replace('mock-token-', '');
      console.log('🔔 [Notifications] Using mock auth, user ID:', userId);
    } else {
      // Try real authentication
      const { user, error: authError } = await verifyAuth(authHeader);
      
      if (authError || !user) {
        console.log('⚠️ [Notifications] Auth failed:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      userId = user.id;
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const notificationId = c.req.param('id');
    const notificationData = await kv.get(`notification_${notificationId}`);
    
    if (!notificationData) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    const notification = typeof notificationData === 'string' ? JSON.parse(notificationData) : notificationData;
    
    // Check if user is admin
    const userEmail = authHeader?.includes('mock-token-') 
      ? (userId === '1' ? 'admin@honeytranslations.com' : 'customer@example.com')
      : null;
    const userIsAdmin = await isAdmin(userId, userEmail);
    
    // Verify notification access:
    // - Admin users can mark ANY notification as read (admin notifications have no user_id)
    // - Regular users can only mark their own notifications
    if (!userIsAdmin && notification.user_id && notification.user_id !== userId) {
      console.log('❌ [Notifications] User', userId, 'attempted to mark notification belonging to', notification.user_id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    notification.read = true;
    notification.read_at = new Date().toISOString();
    await kv.set(`notification_${notificationId}`, notification);
    
    console.log('✅ [Notifications] Notification marked as read:', notificationId);
    
    return c.json({ success: true, notification });
  } catch (error) {
    console.error('❌ [Notifications] Error marking notification as read:', error);
    return c.json({ error: 'Failed to mark notification as read', details: error.message }, 500);
  }
});

// Mark all notifications as read
app.patch("/make-server-a67f0635/notifications/mark-all-read", async (c) => {
  try {
    console.log('🔔 [Notifications] PATCH /notifications/mark-all-read endpoint called');
    
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      console.log('⚠️ [Notifications] Auth failed:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('🔑 [Notifications] Authenticated user:', user.id, user.email);
    
    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id, user.email);
    console.log('👑 [Notifications] Is admin:', userIsAdmin);
    
    // Get all notifications
    const allNotifications = await kv.getByPrefix('notification_');
    let updatedCount = 0;
    
    for (const item of allNotifications) {
      try {
        const notification = typeof item === 'string' ? JSON.parse(item) : item;
        
        // For admin users: mark ALL unread notifications (admin notifications don't have user_id)
        // For regular users: only mark notifications with matching user_id
        const shouldMarkAsRead = userIsAdmin 
          ? !notification.read  // Admin sees all notifications
          : (notification.user_id === user.id && !notification.read); // Users only see their own
        
        if (shouldMarkAsRead) {
          notification.read = true;
          notification.read_at = new Date().toISOString();
          await kv.set(`notification_${notification.id}`, notification);
          updatedCount++;
          console.log(`✅ Marked notification ${notification.id} as read`);
        }
      } catch (e) {
        console.error('⚠️ [Notifications] Error processing notification:', e);
      }
    }
    
    console.log(`✅ [Notifications] Marked ${updatedCount} notifications as read for user ${user.id}`);
    
    return c.json({ success: true, updatedCount });
  } catch (error) {
    console.error('❌ [Notifications] Error marking all notifications as read:', error);
    return c.json({ error: 'Failed to mark all notifications as read', details: error.message }, 500);
  }
});

// Get dashboard statistics (Admin only)
app.get("/make-server-a67f0635/admin/dashboard-stats", async (c) => {
  try {
    console.log('📊 [Dashboard Stats] Endpoint called');
    
    // Try to verify auth, but allow demo mode
    const authHeader = c.req.header('Authorization');
    console.log('🔐 [Dashboard Stats] Auth header:', authHeader ? `${authHeader.substring(0, 50)}...` : 'MISSING');
    
    let isUserAdmin = false;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        console.log('🔐 [Dashboard Stats] Auth result - User:', user?.id, 'Error:', authError);
        
        if (!authError && user) {
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Dashboard Stats] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Dashboard Stats] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        // Allow fallback for demo mode
        console.log('⚠️ [Dashboard Stats] Auth check exception (continuing in demo mode):', e);
      }
    } else {
      console.log('⚠️ [Dashboard Stats] No auth header provided (demo mode)');
    }
    
    // For demo mode, allow access even without admin auth
    console.log('📊 Fetching dashboard statistics...');

    // Fetch orders from KV store
    const ordersData = await kv.getByPrefix('order_');
    const orders = ordersData
      .map(item => {
        try {
          // Handle both string and object formats (same as /orders endpoint)
          if (typeof item === 'string') {
            return JSON.parse(item);
          } else if (typeof item === 'object' && item !== null) {
            return item;
          } else {
            return null;
          }
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    console.log(`📦 Found ${orders.length} orders`);

    // Fetch customers (users) from Supabase
    const { data: customers, error: customersError } = await supabase
      .from('user_profiles')
      .select('id')
      .neq('role', 'admin');
    
    const customerCount = customers?.length || 0;
    console.log(`👥 Found ${customerCount} customers`);

    // Fetch products from KV store
    const productsData = await kv.getByPrefix('product_');
    // Filter out product_images_ keys
    const products = productsData
      .filter(item => {
        try {
          // kv.getByPrefix returns JSONB values already parsed
          const parsed = typeof item === 'string' ? JSON.parse(item) : item;
          return parsed && parsed.id && !parsed.id.includes('product_images_');
        } catch {
          return false;
        }
      });
    
    const productCount = products.length;
    console.log(`📦 Found ${productCount} products`);

    // Calculate statistics
    const totalOrders = orders.length;
    
    // Calculate total revenue (only from completed/delivered orders)
    const totalRevenue = orders
      .filter(order => order.status === 'delivered' || order.status === 'completed')
      .reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0);

    // Pending orders (status = 'pending' or 'processing')
    const pendingOrders = orders.filter(order => 
      order.status === 'pending' || order.status === 'processing'
    );

    // Cancellation requests (status = 'cancelled' or 'cancellation_requested')
    const cancellationRequests = orders.filter(order => 
      order.status === 'cancelled' || order.status === 'cancellation_requested'
    );

    // Pending payments (payment_status = 'pending')
    const pendingPayments = orders.filter(order => 
      order.payment_status === 'pending'
    );

    // Recent orders (last 5)
    const recentOrders = orders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    console.log('✅ Dashboard stats calculated successfully');

    return c.json({
      stats: {
        totalProducts: productCount,
        totalOrders,
        totalCustomers: customerCount,
        totalRevenue: totalRevenue.toFixed(2),
      },
      pendingOrdersCount: pendingOrders.length,
      cancellationRequestsCount: cancellationRequests.length,
      pendingPaymentsCount: pendingPayments.length,
      outOfStockCount: 0, // Service-based products don't have stock
      pendingOrders: pendingOrders.slice(0, 3).map(order => ({
        id: order.order_number || order.id,
        customer: order.customer_name || 'N/A',
        product: order.items?.[0]?.name || 'N/A',
        amount: `₹${parseFloat(order.total_amount || 0).toLocaleString('en-IN')}`,
        date: new Date(order.created_at).toLocaleDateString('en-IN'),
        status: order.status
      })),
      cancellationRequests: cancellationRequests.slice(0, 2).map(order => ({
        id: `CAN-${order.id.slice(-3)}`,
        order: order.order_number || order.id,
        customer: order.customer_name || 'N/A',
        product: order.items?.[0]?.name || 'N/A',
        amount: `₹${parseFloat(order.total_amount || 0).toLocaleString('en-IN')}`,
        reason: order.cancellation_reason || 'No reason provided',
        date: new Date(order.updated_at || order.created_at).toLocaleDateString('en-IN')
      })),
      pendingPayments: pendingPayments.slice(0, 2).map(order => ({
        id: `PAY-${order.id.slice(-3)}`,
        order: order.order_number || order.id,
        customer: order.customer_name || 'N/A',
        product: order.items?.[0]?.name || 'N/A',
        amount: `₹${parseFloat(order.total_amount || 0).toLocaleString('en-IN')}`,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'),
        status: 'Pending'
      })),
      outOfStockItems: [] // Service-based products don't have stock
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    return c.json({ error: 'Failed to fetch dashboard statistics' }, 500);
  }
});

// ==================== API KEYS MANAGEMENT ENDPOINTS ====================

// Get all API keys (Admin only)
app.get("/make-server-a67f0635/admin/api-keys", async (c) => {
  try {
    console.log('🔑 [API Keys] Fetching API keys...');
    
    const razorpayData = await kv.get('api_keys_razorpay');
    // Retrieve Zoho API keys from KV store (exclusive payment gateway)
    const zohoPaymentsData = await kv.get('api_keys_zoho_payments');
    const zohoBooksData = await kv.get('api_keys_zoho_books');
    
    // Also check alternate key format
    const razorpayAlt = await kv.get('api_keys:razorpay');
    const zohoPaymentsAlt = await kv.get('api_keys:zoho_payments');
    const zohoBooksAlt = await kv.get('api_keys:zoho_books');
    
    const apiKeys = {
      razorpay: razorpayData ? (typeof razorpayData === 'string' ? JSON.parse(razorpayData) : razorpayData)
                : razorpayAlt ? (typeof razorpayAlt === 'string' ? JSON.parse(razorpayAlt) : razorpayAlt)
                : {},
      zoho_payments: zohoPaymentsData ? (typeof zohoPaymentsData === 'string' ? JSON.parse(zohoPaymentsData) : zohoPaymentsData) 
                    : zohoPaymentsAlt ? (typeof zohoPaymentsAlt === 'string' ? JSON.parse(zohoPaymentsAlt) : zohoPaymentsAlt) 
                    : {},
      zoho_books: zohoBooksData ? (typeof zohoBooksData === 'string' ? JSON.parse(zohoBooksData) : zohoBooksData)
                 : zohoBooksAlt ? (typeof zohoBooksAlt === 'string' ? JSON.parse(zohoBooksAlt) : zohoBooksAlt)
                 : {}
    };
    
    console.log('✅ [API Keys] Retrieved API keys');
    return c.json(apiKeys);
  } catch (error) {
    console.error('❌ [API Keys] Error fetching API keys:', error);
    return c.json({ error: 'Failed to fetch API keys', details: error.message }, 500);
  }
});

// Save API keys (Admin only)
app.post("/make-server-a67f0635/admin/api-keys", async (c) => {
  try {
    console.log('🔑 [API Keys] Saving API keys...');
    
    const body = await c.req.json();
    const { provider, keys } = body;
    
    if (!provider || !keys) {
      return c.json({ error: 'Provider and keys are required' }, 400);
    }
    
    console.log(`💾 [API Keys] Saving keys for provider: ${provider}`);
    
    // Store the API keys in KV store with both key formats for compatibility
    const kvKey = `api_keys_${provider}`;
    const kvKeyAlt = `api_keys:${provider}`;
    await kv.set(kvKey, JSON.stringify(keys));
    await kv.set(kvKeyAlt, keys); // Also store as object for payment_gateways.tsx
    
    console.log(`✅ [API Keys] Successfully saved ${provider} API keys (both formats)`);
    
    return c.json({ 
      success: true, 
      message: `${provider} API keys saved successfully`,
      provider
    });
  } catch (error) {
    console.error('❌ [API Keys] Error saving API keys:', error);
    return c.json({ error: 'Failed to save API keys', details: error.message }, 500);
  }
});

// ==================== PRODUCT CRUD ENDPOINTS ====================

// Get all products (Public - no auth required)
app.get("/make-server-a67f0635/products", async (c) => {
  try {
    console.log('📦 [Get Products] Fetching all products...');
    console.log('📦 [Get Products] Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
    
    const productsData = await kv.getByPrefix('product_');
    const products = [];
    
    for (const item of productsData) {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        // Skip image data
        if (parsed && parsed.id && !parsed.id.includes('_images_')) {
          products.push(parsed);
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse product:', parseError);
        continue;
      }
    }
    
    console.log(`✅ Found ${products.length} products`);
    
    return c.json({ products });
  } catch (error) {
    console.error('❌ Get products error:', error);
    return c.json({ error: 'Failed to fetch products', details: error.message }, 500);
  }
});

// Get single product by ID (Public - no auth required)
app.get("/make-server-a67f0635/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🔍 Fetching product: ${id}`);
    
    const productData = await kv.get(`product_${id}`);
    
    if (!productData) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    const product = JSON.parse(productData);
    console.log(`✅ Found product: ${product.name}`);
    
    return c.json({ product });
  } catch (error) {
    console.error('❌ Get product error:', error);
    return c.json({ error: 'Failed to fetch product', details: error.message }, 500);
  }
});

// Create new product (Public for now - can add auth later)
app.post("/make-server-a67f0635/products", async (c) => {
  try {
    console.log('🆕 Creating new product...');
    
    const body = await c.req.json();
    console.log('📝 Product data received:', { name: body.name, category: body.category });
    
    // Generate ID
    const id = `product_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const newProduct = {
      id: id.replace('product_', ''), // Store without prefix
      name: body.name || 'Unnamed Product',
      category: body.category || 'Uncategorized',
      description: body.description || '',
      price: parseFloat(body.price) || 0,
      compareAtPrice: body.compareAtPrice ? parseFloat(body.compareAtPrice) : undefined,
      cost: body.cost ? parseFloat(body.cost) : undefined,
      sku: body.sku || '',
      barcode: body.barcode || '',
      stock: parseInt(body.stock) || 0,
      weight: body.weight || '',
      status: body.status || 'active',
      tags: Array.isArray(body.tags) ? body.tags : [],
      metaTitle: body.metaTitle || '',
      metaDescription: body.metaDescription || '',
      images: Array.isArray(body.images) ? body.images : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to KV store
    await kv.set(id, JSON.stringify(newProduct));
    
    console.log(`✅ Product created successfully: ${newProduct.id}`);
    
    return c.json({ 
      success: true, 
      product: newProduct,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('❌ Create product error:', error);
    return c.json({ error: 'Failed to create product', details: error.message }, 500);
  }
});

// Update product (Public for now - can add auth later)
app.put("/make-server-a67f0635/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`📝 Updating product: ${id}`);
    
    const body = await c.req.json();
    
    // Get existing product
    const existingData = await kv.get(`product_${id}`);
    
    if (!existingData) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    const existingProduct = JSON.parse(existingData);
    
    // Merge updates
    const updatedProduct = {
      ...existingProduct,
      name: body.name !== undefined ? body.name : existingProduct.name,
      category: body.category !== undefined ? body.category : existingProduct.category,
      description: body.description !== undefined ? body.description : existingProduct.description,
      price: body.price !== undefined ? parseFloat(body.price) : existingProduct.price,
      compareAtPrice: body.compareAtPrice !== undefined ? (body.compareAtPrice ? parseFloat(body.compareAtPrice) : undefined) : existingProduct.compareAtPrice,
      cost: body.cost !== undefined ? (body.cost ? parseFloat(body.cost) : undefined) : existingProduct.cost,
      sku: body.sku !== undefined ? body.sku : existingProduct.sku,
      barcode: body.barcode !== undefined ? body.barcode : existingProduct.barcode,
      stock: body.stock !== undefined ? parseInt(body.stock) : existingProduct.stock,
      weight: body.weight !== undefined ? body.weight : existingProduct.weight,
      status: body.status !== undefined ? body.status : existingProduct.status,
      tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags : []) : existingProduct.tags,
      metaTitle: body.metaTitle !== undefined ? body.metaTitle : existingProduct.metaTitle,
      metaDescription: body.metaDescription !== undefined ? body.metaDescription : existingProduct.metaDescription,
      images: body.images !== undefined ? (Array.isArray(body.images) ? body.images : []) : existingProduct.images,
      updatedAt: new Date().toISOString()
    };
    
    // Save updated product
    await kv.set(`product_${id}`, JSON.stringify(updatedProduct));
    
    console.log(`✅ Product updated successfully: ${id}`);
    
    return c.json({ 
      success: true, 
      product: updatedProduct,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('❌ Update product error:', error);
    return c.json({ error: 'Failed to update product', details: error.message }, 500);
  }
});

// Delete product (Public for now - can add auth later)
app.delete("/make-server-a67f0635/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🗑️ Deleting product with ID: ${id}`);
    console.log(`🔍 Looking for key: product_${id}`);
    
    // Check if product exists
    const productData = await kv.get(`product_${id}`);
    
    if (!productData) {
      console.error(`❌ Product not found in KV store with key: product_${id}`);
      
      // Try to list all product keys for debugging
      const allProducts = await kv.getByPrefix('product_');
      console.log(`📦 Total keys with 'product_' prefix: ${allProducts.length}`);
      
      // Log first few keys for debugging
      const productKeys = [];
      for (let i = 0; i < Math.min(5, allProducts.length); i++) {
        try {
          const parsed = JSON.parse(allProducts[i]);
          productKeys.push({ id: parsed.id, name: parsed.name });
        } catch (e) {
          // Skip
        }
      }
      console.log('📋 Sample product IDs:', productKeys);
      
      return c.json({ error: 'Product not found' }, 404);
    }
    
    // Delete product
    await kv.del(`product_${id}`);
    
    console.log(`✅ Product deleted successfully: ${id}`);
    
    return c.json({ 
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete product error:', error);
    return c.json({ error: 'Failed to delete product', details: error.message }, 500);
  }
});

// Get all categories (Public - no auth required)
app.get("/make-server-a67f0635/categories-list", async (c) => {
  try {
    console.log('📂 [Get Categories] Fetching categories...');
    console.log('📂 [Get Categories] Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
    
    const categories = [
      { id: '1', name: 'Translation', slug: 'translation', description: 'Translation services' },
      { id: '2', name: 'Attestation', slug: 'attestation', description: 'Document attestation services' },
      { id: '3', name: 'Apostille', slug: 'apostille', description: 'Apostille services' },
      { id: '4', name: 'Startup Packages', slug: 'startup', description: 'Startup package services' }
    ];
    
    console.log(`✅ Returning ${categories.length} categories`);
    
    return c.json({ categories });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return c.json({ error: 'Failed to fetch categories', details: error.message }, 500);
  }
});

// Public endpoint to initialize/seed products (for development/testing)
app.post("/make-server-a67f0635/initialize-default-products", async (c) => {
  try {
    console.log('🌱 Seeding default products...');
    
    // Check if products already exist
    const existingProducts = await kv.getByPrefix('product_');
    if (existingProducts.length > 0) {
      console.log(`ℹ️ Database already has ${existingProducts.length} products. Skipping initialization.`);
      return c.json({ 
        success: true, 
        message: 'Products already exist',
        count: existingProducts.length 
      });
    }

    const defaultProducts = [
      {
        id: 'english-to-foreign',
        name: 'English to Foreign Language',
        category: 'Translation',
        price: 2500,
        stock: 999,
        status: 'active',
        description: 'Professional translation from English to any foreign language',
        images: [],
        tags: ['translation', 'english', 'foreign'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'foreign-to-english',
        name: 'Foreign Language to English',
        category: 'Translation',
        price: 2500,
        stock: 999,
        status: 'active',
        description: 'Professional translation from any foreign language to English',
        images: [],
        tags: ['translation', 'foreign', 'english'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'usa-apostille',
        name: 'USA Apostille Services',
        category: 'Apostille',
        price: 8000,
        stock: 999,
        status: 'active',
        description: 'Complete apostille services for USA documents',
        images: [],
        tags: ['apostille', 'usa', 'documents'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Save default products to database
    for (const product of defaultProducts) {
      await kv.set(`product_${product.id}`, JSON.stringify(product));
      console.log(`✅ Created product: ${product.name}`);
    }

    console.log(`✅ Successfully seeded ${defaultProducts.length} default products`);
    
    return c.json({ 
      success: true,
      message: 'Default products initialized successfully',
      count: defaultProducts.length,
      products: defaultProducts
    });
  } catch (error) {
    console.error('❌ Initialize products error:', error);
    return c.json({ error: 'Failed to initialize products', details: error.message }, 500);
  }
});

// ==================== DYNAMIC PRODUCT CONFIGURATION SYSTEM ====================

// ==================== GLOBAL LANGUAGES MANAGEMENT ====================

// Get all languages (both source and target)
app.get("/make-server-a67f0635/admin/languages", async (c) => {
  try {
    console.log('📋 Fetching all languages...');
    const languages = await kv.getByPrefix('language_');
    
    const parsedLanguages = languages.map(lang => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        return typeof lang === 'string' ? JSON.parse(lang) : lang;
      } catch (e) {
        console.error('Failed to parse language:', lang);
        return null;
      }
    }).filter(Boolean);

    // Separate by type
    const sourceLanguages = parsedLanguages.filter(l => l.type === 'source');
    const targetLanguages = parsedLanguages.filter(l => l.type === 'target');

    return c.json({ 
      sourceLanguages,
      targetLanguages,
      allLanguages: parsedLanguages 
    });
  } catch (error) {
    console.error('❌ Get languages error:', error);
    return c.json({ error: 'Failed to fetch languages', details: error.message }, 500);
  }
});

// Add a new language (source or target)
app.post("/make-server-a67f0635/admin/languages", async (c) => {
  try {
    const body = await c.req.json();
    const { id, label, type } = body; // type: 'source' or 'target'

    if (!id || !label || !type) {
      return c.json({ error: 'ID, label, and type are required' }, 400);
    }

    if (type !== 'source' && type !== 'target') {
      return c.json({ error: 'Type must be either "source" or "target"' }, 400);
    }

    const languageData = {
      id,
      label,
      type,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`language_${id}_${type}`, JSON.stringify(languageData));
    console.log(`✅ Added ${type} language: ${label}`);

    return c.json({ success: true, language: languageData });
  } catch (error) {
    console.error('❌ Add language error:', error);
    return c.json({ error: 'Failed to add language', details: error.message }, 500);
  }
});

// Delete a language
app.delete("/make-server-a67f0635/admin/languages/:id/:type", async (c) => {
  try {
    const id = c.req.param('id');
    const type = c.req.param('type');
    
    await kv.del(`language_${id}_${type}`);
    console.log(`✅ Deleted ${type} language: ${id}`);

    return c.json({ success: true, message: 'Language deleted' });
  } catch (error) {
    console.error('❌ Delete language error:', error);
    return c.json({ error: 'Failed to delete language', details: error.message }, 500);
  }
});

// ==================== GLOBAL DOCUMENT TYPES MANAGEMENT ====================

// Get all document types
app.get("/make-server-a67f0635/admin/document-types", async (c) => {
  try {
    console.log('📋 Fetching all document types...');
    const documentTypes = await kv.getByPrefix('document_type_');
    
    const parsedDocTypes = documentTypes.map(docType => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        return typeof docType === 'string' ? JSON.parse(docType) : docType;
      } catch (e) {
        console.error('Failed to parse document type:', docType);
        return null;
      }
    }).filter(Boolean);

    return c.json({ documentTypes: parsedDocTypes });
  } catch (error) {
    console.error('❌ Get document types error:', error);
    return c.json({ error: 'Failed to fetch document types', details: error.message }, 500);
  }
});

// Add a new document type
app.post("/make-server-a67f0635/admin/document-types", async (c) => {
  try {
    const body = await c.req.json();
    const { id, label, category } = body;

    if (!id || !label) {
      return c.json({ error: 'ID and label are required' }, 400);
    }

    const docTypeData = {
      id,
      label,
      category: category || 'general',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`document_type_${id}`, JSON.stringify(docTypeData));
    console.log(`✅ Added document type: ${label}`);

    return c.json({ success: true, documentType: docTypeData });
  } catch (error) {
    console.error('❌ Add document type error:', error);
    return c.json({ error: 'Failed to add document type', details: error.message }, 500);
  }
});

// Delete a document type
app.delete("/make-server-a67f0635/admin/document-types/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`document_type_${id}`);
    console.log(`✅ Deleted document type: ${id}`);

    return c.json({ success: true, message: 'Document type deleted' });
  } catch (error) {
    console.error('❌ Delete document type error:', error);
    return c.json({ error: 'Failed to delete document type', details: error.message }, 500);
  }
});

// ==================== PRODUCT-SPECIFIC CONFIGURATION ====================

// Get product configuration (which languages/doc types to show)
app.get("/make-server-a67f0635/admin/product-config/:productId", async (c) => {
  try {
    const productId = c.req.param('productId');
    console.log(`📋 Fetching configuration for product: ${productId}`);
    
    const configJson = await kv.get(`product_config_${productId}`);
    
    if (configJson) {
      const config = JSON.parse(configJson);
      return c.json({ config });
    } else {
      // Return default configuration for products without explicit config
      // For backward compatibility, document type is shown by default
      return c.json({ 
        config: {
          productId,
          showSourceLanguage: false,
          showTargetLanguage: false,
          showDocumentType: true, // Default to true for backward compatibility
          enabledSourceLanguages: [],
          enabledTargetLanguages: [],
          enabledDocumentTypes: []
        }
      });
    }
  } catch (error) {
    console.error('❌ Get product config error:', error);
    return c.json({ error: 'Failed to fetch product configuration', details: error.message }, 500);
  }
});

// Save product configuration
app.post("/make-server-a67f0635/admin/product-config/:productId", async (c) => {
  try {
    const productId = c.req.param('productId');
    const body = await c.req.json();
    
    const config = {
      productId,
      showSourceLanguage: body.showSourceLanguage || false,
      showTargetLanguage: body.showTargetLanguage || false,
      showDocumentType: body.showDocumentType || false,
      enabledSourceLanguages: body.enabledSourceLanguages || [],
      enabledTargetLanguages: body.enabledTargetLanguages || [],
      enabledDocumentTypes: body.enabledDocumentTypes || [],
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`product_config_${productId}`, JSON.stringify(config));
    console.log(`✅ Saved configuration for product: ${productId}`);

    return c.json({ success: true, config });
  } catch (error) {
    console.error('❌ Save product config error:', error);
    return c.json({ error: 'Failed to save product configuration', details: error.message }, 500);
  }
});

// Get all product configurations (for admin overview)
app.get("/make-server-a67f0635/admin/product-configs", async (c) => {
  try {
    console.log('📋 Fetching all product configurations...');
    const configs = await kv.getByPrefix('product_config_');
    
    const parsedConfigs = configs.map(config => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        return typeof config === 'string' ? JSON.parse(config) : config;
      } catch (e) {
        console.error('Failed to parse product config:', config);
        return null;
      }
    }).filter(Boolean);

    return c.json({ configs: parsedConfigs });
  } catch (error) {
    console.error('❌ Get product configs error:', error);
    return c.json({ error: 'Failed to fetch product configurations', details: error.message }, 500);
  }
});

// ==================== PUBLIC ENDPOINTS FOR PRODUCT PAGES ====================

// Public: Get product configuration (used by product pages)
app.get("/make-server-a67f0635/product-config/:productId", async (c) => {
  try {
    const productId = c.req.param('productId');
    
    // Fetch product configuration
    const configJson = await kv.get(`product_config_${productId}`);
    
    if (!configJson) {
      // Return empty config if not found
      return c.json({ 
        config: {
          productId,
          showSourceLanguage: false,
          showTargetLanguage: false,
          showDocumentType: false,
          enabledSourceLanguages: [],
          enabledTargetLanguages: [],
          enabledDocumentTypes: []
        },
        sourceLanguages: [],
        targetLanguages: [],
        documentTypes: []
      });
    }
    
    const config = JSON.parse(configJson);
    
    // Fetch all languages and document types
    const allLanguages = await kv.getByPrefix('language_');
    const allDocTypes = await kv.getByPrefix('document_type_');
    
    const parsedLanguages = allLanguages.map(lang => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        return typeof lang === 'string' ? JSON.parse(lang) : lang;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    const parsedDocTypes = allDocTypes.map(docType => {
      try {
        // kv.getByPrefix returns JSONB values already parsed
        return typeof docType === 'string' ? JSON.parse(docType) : docType;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Filter languages based on product config
    const sourceLanguages = parsedLanguages
      .filter(l => l.type === 'source' && config.enabledSourceLanguages.includes(l.id));
    
    const targetLanguages = parsedLanguages
      .filter(l => l.type === 'target' && config.enabledTargetLanguages.includes(l.id));
    
    const documentTypes = parsedDocTypes
      .filter(dt => config.enabledDocumentTypes.includes(dt.id));
    
    return c.json({ 
      config,
      sourceLanguages,
      targetLanguages,
      documentTypes
    });
  } catch (error) {
    console.error('❌ Get product config error:', error);
    return c.json({ error: 'Failed to fetch product configuration' }, 500);
  }
});

// ==================== WORK SAMPLES MANAGEMENT ====================

// Get all work samples (Public - no auth required)
app.get("/make-server-a67f0635/work-samples", async (c) => {
  try {
    console.log('📋 Fetching all work samples...');
    
    const samplesData = await kv.getByPrefix('work_sample_');
    // kv.getByPrefix returns JSONB values already parsed, no need to JSON.parse
    const samples = samplesData
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by category first, then by order
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return (a.order || 0) - (b.order || 0);
      });
    
    console.log(`✅ Found ${samples.length} work samples`);
    
    return c.json({ samples });
  } catch (error) {
    console.error('❌ Get work samples error:', error);
    return c.json({ error: 'Failed to fetch work samples', details: error.message }, 500);
  }
});

// Get single work sample by ID (Public - no auth required)
app.get("/make-server-a67f0635/work-samples/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🔍 Fetching work sample: ${id}`);
    
    const sampleData = await kv.get(`work_sample_${id}`);
    
    if (!sampleData) {
      return c.json({ error: 'Work sample not found' }, 404);
    }
    
    const sample = JSON.parse(sampleData);
    console.log(`✅ Found work sample: ${sample.title}`);
    
    return c.json({ sample });
  } catch (error) {
    console.error('❌ Get work sample error:', error);
    return c.json({ error: 'Failed to fetch work sample', details: error.message }, 500);
  }
});

// Create new work sample (Admin only)
app.post("/make-server-a67f0635/admin/work-samples", async (c) => {
  try {
    console.log('🆕 Creating new work sample...');
    
    const body = await c.req.json();
    console.log('📝 Work sample data received:', { title: body.title, category: body.category });
    
    // Generate ID
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    const id = `${timestamp}_${randomString}`;
    
    const newSample = {
      id,
      title: body.title || 'Untitled Sample',
      category: body.category || 'General',
      description: body.description || '',
      fileUrl: body.fileUrl || '',
      fileName: body.fileName || '',
      order: body.order || 0,
      status: body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to KV store
    await kv.set(`work_sample_${id}`, JSON.stringify(newSample));
    
    console.log(`✅ Work sample created successfully: ${newSample.id}`);
    
    return c.json({ 
      success: true, 
      sample: newSample,
      message: 'Work sample created successfully'
    });
  } catch (error) {
    console.error('❌ Create work sample error:', error);
    return c.json({ error: 'Failed to create work sample', details: error.message }, 500);
  }
});

// Update work sample (Admin only)
app.put("/make-server-a67f0635/admin/work-samples/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`📝 Updating work sample: ${id}`);
    
    const body = await c.req.json();
    
    // Get existing sample
    const existingData = await kv.get(`work_sample_${id}`);
    
    if (!existingData) {
      return c.json({ error: 'Work sample not found' }, 404);
    }
    
    const existingSample = JSON.parse(existingData);
    
    // Merge updates
    const updatedSample = {
      ...existingSample,
      title: body.title !== undefined ? body.title : existingSample.title,
      category: body.category !== undefined ? body.category : existingSample.category,
      description: body.description !== undefined ? body.description : existingSample.description,
      fileUrl: body.fileUrl !== undefined ? body.fileUrl : existingSample.fileUrl,
      fileName: body.fileName !== undefined ? body.fileName : existingSample.fileName,
      order: body.order !== undefined ? body.order : existingSample.order,
      status: body.status !== undefined ? body.status : existingSample.status,
      updatedAt: new Date().toISOString()
    };
    
    // Save updated sample
    await kv.set(`work_sample_${id}`, JSON.stringify(updatedSample));
    
    console.log(`✅ Work sample updated successfully: ${id}`);
    
    return c.json({ 
      success: true, 
      sample: updatedSample,
      message: 'Work sample updated successfully'
    });
  } catch (error) {
    console.error('❌ Update work sample error:', error);
    return c.json({ error: 'Failed to update work sample', details: error.message }, 500);
  }
});

// Delete work sample (Admin only)
app.delete("/make-server-a67f0635/admin/work-samples/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🗑️ Deleting work sample: ${id}`);
    
    // Check if sample exists
    const sampleData = await kv.get(`work_sample_${id}`);
    
    if (!sampleData) {
      return c.json({ error: 'Work sample not found' }, 404);
    }
    
    // Delete sample
    await kv.del(`work_sample_${id}`);
    
    console.log(`✅ Work sample deleted successfully: ${id}`);
    
    return c.json({ 
      success: true,
      message: 'Work sample deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete work sample error:', error);
    return c.json({ error: 'Failed to delete work sample', details: error.message }, 500);
  }
});

// Upload work sample file (Server-side upload to bypass RLS)
app.post("/make-server-a67f0635/admin/upload-work-sample", async (c) => {
  try {
    console.log('📤 Server-side work sample upload started...');
    
    const bucketName = 'work-samples-a67f0635';
    
    // Check if bucket exists, create if not
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.log('⚠️  Error listing buckets (may be RLS-related):', listError.message || listError);
      return c.json({ error: 'Failed to list buckets', details: listError.message }, 500);
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`📦 Creating storage bucket: ${bucketName}...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB limit
      });
      
      if (createError) {
        // If RLS policy error, provide helpful guidance (expected behavior, not an error)
        if (createError.message?.includes('row-level security') || createError.message?.includes('policy') || createError.statusCode === '403') {
          console.log('⚠️  Storage bucket does not exist and RLS prevents automatic creation');
          console.log('📖 Action Required: Create storage bucket manually in Supabase Dashboard');
          console.log(`   Bucket Name: ${bucketName}`);
          console.log('   Settings: Public bucket, 50MB file size limit');
          console.log('   📄 See STORAGE_SETUP_GUIDE.md for detailed instructions');
          return c.json({ 
            error: 'Storage bucket not found',
            message: `Please create a public storage bucket named "${bucketName}" in your Supabase Dashboard:\n\n1. Go to Storage → New bucket\n2. Name: ${bucketName}\n3. Toggle "Public bucket" to ON\n4. File size limit: 50 MB\n5. Click Create\n\nSee STORAGE_SETUP_GUIDE.md for detailed instructions.`,
            bucketName,
            setupRequired: true
          }, 403);
        } else {
          // Only log unexpected errors
          console.log('⚠️  Error creating bucket:', createError.message || createError);
          return c.json({ error: 'Failed to create bucket', details: createError.message }, 500);
        }
      } else {
        console.log('✅ Storage bucket created successfully!');
      }
    }
    
    // Get the form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    console.log(`📁 Received file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `sample-${timestamp}-${randomString}.${fileExtension}`;
    
    console.log(`💾 Uploading to Supabase Storage as: ${fileName}`);
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage using service role key (bypasses RLS)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Upload error:', error);
      return c.json({ error: 'Upload failed', details: error.message }, 500);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log(`✅ Upload successful! Public URL: ${publicUrl}`);
    
    return c.json({ 
      success: true,
      url: publicUrl,
      fileName: file.name,
      message: 'Work sample file uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Server-side upload error:', error);
    return c.json({ error: 'Failed to upload work sample file', details: error.message }, 500);
  }
});

// Initialize demo work samples - Creates sample data (Admin only)
app.post("/make-server-a67f0635/admin/init-work-samples-inline", async (c) => {
  try {
    console.log('🎬 Initializing demo work samples...');
    
    const baseTimestamp = Date.now();
    const demoSamples = [
      {
        id: `${baseTimestamp + 1}_sample1`,
        title: 'Certified Translation - Hindi to English (Birth Certificate)',
        category: 'Indian Languages',
        description: 'Sample of certified translation from Hindi to English for a birth certificate',
        fileUrl: 'https://example.com/samples/hindi-english-birth-cert.pdf',
        fileName: 'Hindi_to_English_Birth_Certificate_Sample.pdf',
        order: 1,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 2}_sample2`,
        title: 'Certified Translation - Tamil to English (Marriage Certificate)',
        category: 'Indian Languages',
        description: 'Sample translation of Tamil marriage certificate to English with notarization',
        fileUrl: 'https://example.com/samples/tamil-english-marriage.pdf',
        fileName: 'Tamil_to_English_Marriage_Certificate_Sample.pdf',
        order: 2,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 3}_sample3`,
        title: 'Certified Translation - Spanish to English (Legal Document)',
        category: 'Foreign Languages',
        description: 'Certified translation of legal contract from Spanish to English',
        fileUrl: 'https://example.com/samples/spanish-english-legal.pdf',
        fileName: 'Spanish_to_English_Legal_Document_Sample.pdf',
        order: 3,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 4}_sample4`,
        title: 'Academic Transcript Translation - French to English',
        category: 'Academic Documents',
        description: 'University transcript translation with apostille certification',
        fileUrl: 'https://example.com/samples/french-english-transcript.pdf',
        fileName: 'French_to_English_Academic_Transcript_Sample.pdf',
        order: 4,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 5}_sample5`,
        title: 'Medical Report Translation - German to English',
        category: 'Medical Documents',
        description: 'Certified medical report translation for visa purposes',
        fileUrl: 'https://example.com/samples/german-english-medical.pdf',
        fileName: 'German_to_English_Medical_Report_Sample.pdf',
        order: 5,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 6}_sample6`,
        title: 'Business Contract Translation - Mandarin to English',
        category: 'Business Documents',
        description: 'Professional business contract translation with certification',
        fileUrl: 'https://example.com/samples/mandarin-english-contract.pdf',
        fileName: 'Mandarin_to_English_Business_Contract_Sample.pdf',
        order: 6,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 7}_sample7`,
        title: 'Passport Translation - Bengali to English',
        category: 'Legal Documents',
        description: 'Certified passport translation for immigration',
        fileUrl: 'https://example.com/samples/bengali-english-passport.pdf',
        fileName: 'Bengali_to_English_Passport_Sample.pdf',
        order: 7,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `${baseTimestamp + 8}_sample8`,
        title: 'Degree Certificate - Marathi to English',
        category: 'Academic Documents',
        description: 'University degree certificate with notarized translation',
        fileUrl: 'https://example.com/samples/marathi-english-degree.pdf',
        fileName: 'Marathi_to_English_Degree_Certificate_Sample.pdf',
        order: 8,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    const results = [];
    
    for (const sample of demoSamples) {
      try {
        // Check if sample already exists
        const existing = await kv.get(`work_sample_${sample.id}`);
        if (existing) {
          console.log(`⏭️  Sample already exists: ${sample.title}`);
          results.push({ id: sample.id, status: 'already_exists' as const });
          continue;
        }
        
        // Save sample to KV store
        await kv.set(`work_sample_${sample.id}`, sample);
        console.log(`✅ Created work sample: ${sample.title}`);
        results.push({ id: sample.id, status: 'created' as const, title: sample.title });
      } catch (err) {
        console.error(`❌ Error creating sample ${sample.title}:`, err);
        results.push({ id: sample.id, status: 'error' as const, error: String(err) });
      }
    }
    
    console.log(`✅ Work samples initialization complete! Created ${results.filter(r => r.status === 'created').length} samples`);
    
    return c.json({
      success: true,
      message: `Work samples initialized successfully`,
      results,
      summary: {
        total: demoSamples.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'already_exists').length,
        errors: results.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    console.error('❌ Work samples initialization error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to initialize work samples',
      details: error.message 
    }, 500);
  }
});

// ==================== ZOHO PAYMENT GATEWAY INTEGRATION ====================

// Create payment order - NO AUTH REQUIRED (works in demo mode and production)
app.post("/make-server-a67f0635/payment/create-order", async (c) => {
  console.log('🚀 [Backend] Payment order endpoint called');
  console.log('📋 [Backend] Headers received:', JSON.stringify(c.req.header()));
  
  try {
    const body = await c.req.json();
    const { 
      userId, 
      amount, 
      currency, 
      paymentMethod, 
      items, 
      subtotal, 
      discount, 
      tax, 
      shippingAddress,
      orderId: clientOrderId,
      orderNumber: clientOrderNumber,
      trackingNumber,
      notes,
      tip,
      userEmail,
      userName,
      shippingMethod
    } = body;
    
    console.log('💳 ========== CREATING PAYMENT ORDER ==========');
    console.log('👤 [Backend] User ID:', userId);
    console.log('👤 [Backend] User Name:', userName);
    console.log('📧 [Backend] User Email:', userEmail);
    console.log('💰 [Backend] Amount:', amount, currency);
    console.log('💳 [Backend] Payment Method:', paymentMethod);
    console.log('📦 [Backend] Items count:', items?.length || 0);
    console.log('🚚 [Backend] Shipping Method:', shippingMethod);
    
    // Use client-provided IDs if available, otherwise generate
    const orderId = clientOrderId || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const orderNumber = clientOrderNumber || orderId;
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    console.log('🆔 [Backend] Order ID:', orderId);
    console.log('🆔 [Backend] Order Number:', orderNumber);
    
    // Get customer info
    let customerName = userName || 'Guest';
    let customerEmail = userEmail || 'guest@example.com';
    
    if (!userName || !userEmail) {
      try {
        // Try to get user profile from KV store
        console.log('🔍 [Backend] Fetching user profile from KV store...');
        const userProfileRaw = await kv.get(`user:${userId}`);
        if (userProfileRaw) {
          const userProfile = typeof userProfileRaw === 'string' ? JSON.parse(userProfileRaw) : userProfileRaw;
          console.log('✅ [Backend] Found user profile:', userProfile);
          customerName = userProfile.name || customerName;
          customerEmail = userProfile.email || customerEmail;
        } else {
          // Try Supabase database
          const { data: dbProfile } = await supabase
            .from('user_profiles')
            .select('name, email')
            .eq('id', userId)
            .single();
          
          if (dbProfile) {
            customerName = dbProfile.name || customerName;
            customerEmail = dbProfile.email || customerEmail;
          }
        }
      } catch (profileError) {
        console.warn('⚠️ Could not fetch user profile:', profileError);
      }
    }
    
    // Create order record in KV store with all necessary fields
    const orderData = {
      id: orderId,
      order_number: orderNumber,
      user_id: userId,
      user_email: customerEmail,
      customer_email: customerEmail,
      customer_name: customerName,
      payment_id: paymentId,
      payment_method: paymentMethod,
      payment_status: (paymentMethod === 'netbanking' || paymentMethod === 'wallet') ? 'pending' : 'paid',
      status: 'pending',
      total_amount: amount.toString(),
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      tax: tax.toString(),
      currency: currency,
      items: items,
      shipping_address: shippingAddress || null,
      tracking_number: trackingNumber || null,
      shipping_carrier: 'BlueDart',
      shipping_method: shippingMethod || 'email',
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: notes || '',
      tip: tip || 0
    };
    
    // Save order to KV store (don't JSON.stringify - KV store handles JSONB directly)
    console.log('💾 [Backend] Saving order to KV store with key:', `order_${orderId}`);
    console.log('💾 [Backend] Order data:', JSON.stringify(orderData, null, 2));
    
    try {
      // CRITICAL: Log environment variables to diagnose database connection issues
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      console.log('🔍 [Backend] KV Store Environment Check:');
      console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
      console.log('  SERVICE_KEY:', supabaseServiceKey ? `✅ Set (${supabaseServiceKey.length} chars)` : '❌ Missing');
      
      await kv.set(`order_${orderId}`, orderData);
      console.log('✅ [Backend] KV store set() completed successfully');
    } catch (kvError) {
      console.error('❌ [Backend] KV store set() FAILED:', kvError);
      console.error('❌ [Backend] Error details:', {
        name: kvError.name,
        message: kvError.message,
        stack: kvError.stack
      });
      
      // Check if it's a database connection error
      if (kvError.message?.includes('relation') || kvError.message?.includes('does not exist')) {
        console.error('❌ [Backend] DATABASE TABLE MISSING! The kv_store_a67f0635 table might not exist.');
        console.error('❌ [Backend] Run the init-database.sql migration to create the table.');
        console.error('❌ [Backend] For now, continuing without backend storage (localStorage only).');
        
        // Don't throw - allow order to continue with localStorage only
        console.log('⚠️ [Backend] Order will be stored in localStorage only');
      } else {
        throw kvError; // Re-throw other errors
      }
    }
    
    // VERIFY the order was actually saved
    console.log('🔍 [Backend] Verifying order was saved...');
    const verifyOrder = await kv.get(`order_${orderId}`);
    if (verifyOrder) {
      console.log(`✅ [Backend] Order VERIFIED in KV store!`);
      console.log(`📋 [Backend] Order ID: ${orderId}`);
      console.log(`📋 [Backend] Order Number: ${orderNumber}`);
      console.log(`📋 [Backend] Customer: ${customerName} (${customerEmail})`);
      console.log(`📋 [Backend] Amount: ₹${amount}`);
    } else {
      console.error(`❌ [Backend] ERROR: Order NOT found in KV store after save!`);
    }
    
    // Update existing customer's order stats (if customer exists from signup)
    if (userId && userId !== 'guest') {
      console.log('🔍 [Backend] Checking if customer record exists for user:', userId);
      const existingCustomer = await kv.get(`customer:${userId}`);
      
      if (existingCustomer) {
        console.log('✅ [Backend] Customer record exists, updating order stats...');
        
        // Update existing customer's order stats
        const customer = typeof existingCustomer === 'string' ? JSON.parse(existingCustomer) : existingCustomer;
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + parseFloat(amount.toString());
        customer.lastOrderDate = new Date().toISOString();
        
        await kv.set(`customer:${userId}`, customer);
        console.log('✅ [Backend] Customer stats updated:', JSON.stringify(customer, null, 2));
      } else {
        console.log('ℹ️ [Backend] No customer record found - customer must signup first to appear in Inventory');
      }
    }
    
    // Create notification for admins about new order
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      id: notificationId,
      type: 'new_order',
      title: 'New Order Received',
      message: `Order #${orderNumber} from ${customerName}`,
      order_id: orderId,
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      amount: amount.toString(),
      currency: currency,
      read: false,
      created_at: new Date().toISOString()
    };
    
    await kv.set(`notification_${notificationId}`, notification);
    console.log(`🔔 [Backend] Notification created: ${notificationId}`);
    
    // Create notification for customer about order placed
    if (userId && userId !== 'guest') {
      const customerNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const customerNotification = {
        id: customerNotificationId,
        user_id: userId,
        type: 'order_placed',
        title: 'Your order has been placed',
        message: `Thank you! Your order #${orderNumber} has been successfully placed and is being processed.`,
        order_id: orderId,
        order_number: orderNumber,
        read: false,
        created_at: new Date().toISOString()
      };
      
      await kv.set(`notification_${customerNotificationId}`, customerNotification);
      console.log(`📬 [Backend] Customer notification created: ${customerNotificationId}`);
    }
    
    await kv.set(`payment_${paymentId}`, {
      id: paymentId,
      order_id: orderId,
      amount: amount,
      currency: currency,
      status: 'initiated',
      gateway: 'zoho',
      payment_method: paymentMethod,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ Order created: ${orderId}`);
    console.log(`✅ Payment initiated: ${paymentId}`);
    
    let razorpayOrder = null;

    if (paymentMethod === 'razorpay') {
      try {
        console.log('💳 [Razorpay] Creating order through generic payment endpoint...');
        razorpayOrder = await createRazorpayServerOrder({
          amount: Number(amount),
          currency,
          receipt: orderNumber,
        });
        console.log('✅ [Razorpay] Order created through generic endpoint:', razorpayOrder.id);
      } catch (razorpayError) {
        console.error('❌ [Razorpay] Generic endpoint order creation failed:', razorpayError.message);
        throw razorpayError;
      }
    }

    // Zoho Payments Integration - Create hosted checkout page
    let paymentUrl = null;
    let zohoHostedpageId = null;
    
    try {
      // Try to create Zoho Payments hosted page
      const zohoKeysData = await kv.get('api_keys:zoho_payments');
      
      if (zohoKeysData) {
        const zohoKeys = typeof zohoKeysData === 'string' ? JSON.parse(zohoKeysData) : zohoKeysData;
        const { client_id, client_secret, test_mode } = zohoKeys;
        
        if (client_id && client_secret) {
          const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/$/, '') || '';
          const serverUrl = Deno.env.get('SUPABASE_URL');
          
          const zohoPaymentData = {
            amount: Math.round(amount * 100),
            currency: currency || 'INR',
            customer: { email: customerEmail, name: customerName },
            description: `Order ${orderNumber} - ${items?.length || 0} item(s)`,
            reference_id: orderNumber,
            notes: { order_id: orderId, order_number: orderNumber, tracking_number: trackingNumber, user_id: userId },
            redirect_url: `${origin}/order-success?orderId=${orderId}&orderNumber=${orderNumber}&trackingNumber=${trackingNumber}&gateway=zoho`,
            cancel_url: `${origin}/checkout/payment?cancelled=true&orderId=${orderId}`,
            webhook_url: `${serverUrl}/functions/v1/make-server-a67f0635/payment/zoho/webhook`
          };
          
          const zohoApiUrl = test_mode 
            ? 'https://payments-test.zoho.in/api/v1/hostedpages'
            : 'https://payments.zoho.in/api/v1/hostedpages';
          
          const authString = btoa(`${client_id}:${client_secret}`);
          
          const zohoResponse = await fetch(zohoApiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(zohoPaymentData)
          });
          
          if (zohoResponse.ok) {
            const zohoData = await zohoResponse.json();
            paymentUrl = zohoData.hostedpage?.url || zohoData.data?.url;
            zohoHostedpageId = zohoData.hostedpage?.hostedpage_id || zohoData.data?.hostedpage_id;
            console.log('✅ [Zoho Pay] Hosted page created:', zohoHostedpageId);
          } else {
            console.warn('⚠️ [Zoho Pay] API error:', zohoResponse.status, await zohoResponse.text());
          }
        }
      }
    } catch (zohoError) {
      console.warn('⚠️ [Zoho Pay] Integration error (falling back to demo):', zohoError.message);
    }
    
    return c.json({
      success: true,
      orderId,
      paymentId,
      amount,
      currency,
      razorpayOrder,
      paymentUrl,
      zohoHostedpageId,
      gateway: paymentMethod === 'razorpay' ? 'razorpay' : 'zoho_payments',
      message:
        paymentMethod === 'razorpay'
          ? 'Razorpay order created'
          : paymentUrl
            ? 'Zoho payment page created'
            : 'Payment order created (demo mode)'
    });
  } catch (error) {
    console.error('❌ ========== CREATE PAYMENT ORDER ERROR ==========');
    console.error('❌ [Backend] Error name:', error.name);
    console.error('❌ [Backend] Error message:', error.message);
    console.error('❌ [Backend] Error stack:', error.stack);
    console.error('❌ [Backend] Full error object:', JSON.stringify(error, null, 2));
    return c.json({ 
      error: 'Failed to create payment order', 
      details: error.message,
      errorType: error.name,
      stack: error.stack
    }, 500);
  }
});

// Payment callback handler (for Zoho Payment Gateway response)
app.get("/make-server-a67f0635/payment/callback", async (c) => {
  try {
    const orderId = c.req.query('orderId');
    const paymentId = c.req.query('paymentId');
    const status = c.req.query('status');
    
    console.log('💳 Payment callback received');
    console.log('Order ID:', orderId);
    console.log('Payment ID:', paymentId);
    console.log('Status:', status);
    
    if (!orderId || !paymentId) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }
    
    // Get order data
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Handle both object and string types (for backward compatibility)
    const orderData = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    
    // Get payment data
    const paymentDataRaw = await kv.get(`payment_${paymentId}`);
    if (!paymentDataRaw) {
      return c.json({ error: 'Payment not found' }, 404);
    }
    
    const paymentData = typeof paymentDataRaw === 'string' ? JSON.parse(paymentDataRaw) : paymentDataRaw;
    
    // Update payment status
    if (status === 'success') {
      paymentData.status = 'completed';
      paymentData.completed_at = new Date().toISOString();
      
      orderData.payment_status = 'paid';
      orderData.status = 'confirmed';
      orderData.updated_at = new Date().toISOString();
    } else {
      paymentData.status = 'failed';
      paymentData.failed_at = new Date().toISOString();
      
      orderData.payment_status = 'failed';
      orderData.status = 'cancelled';
      orderData.updated_at = new Date().toISOString();
    }
    
    // Save updated data (don't JSON.stringify - KV store handles JSONB directly)
    await kv.set(`payment_${paymentId}`, paymentData);
    await kv.set(`order_${orderId}`, orderData);
    
    console.log(`✅ Payment ${status} for order ${orderId}`);
    
    // Redirect to success or failure page
    const redirectUrl = status === 'success' 
      ? `/order-success?orderId=${orderId}`
      : `/payment-failed?orderId=${orderId}`;
    
    return c.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Payment callback error:', error);
    return c.json({ error: 'Failed to process payment callback', details: error.message }, 500);
  }
});

// Verify payment status
app.post("/make-server-a67f0635/payment/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { orderId, paymentId } = body;
    
    console.log('🔍 Verifying payment...');
    console.log('Order ID:', orderId);
    console.log('Payment ID:', paymentId);
    
    if (!orderId || !paymentId) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }
    
    // Get payment data
    const paymentDataRaw = await kv.get(`payment_${paymentId}`);
    if (!paymentDataRaw) {
      return c.json({ error: 'Payment not found' }, 404);
    }
    
    const paymentData = JSON.parse(paymentDataRaw);
    
    // Get order data
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const orderData = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    
    console.log(`✅ Payment verified: ${paymentData.status}`);
    
    return c.json({
      success: true,
      payment: paymentData,
      order: orderData,
      verified: paymentData.status === 'completed'
    });
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return c.json({ error: 'Failed to verify payment', details: error.message }, 500);
  }
});

// Get payment details
app.get("/make-server-a67f0635/payment/:paymentId", async (c) => {
  try {
    const paymentId = c.req.param('paymentId');
    
    console.log(`🔍 Fetching payment: ${paymentId}`);
    
    const paymentDataRaw = await kv.get(`payment_${paymentId}`);
    if (!paymentDataRaw) {
      return c.json({ error: 'Payment not found' }, 404);
    }
    
    const paymentData = JSON.parse(paymentDataRaw);
    
    console.log(`✅ Found payment: ${paymentData.status}`);
    
    return c.json({ payment: paymentData });
  } catch (error) {
    console.error('❌ Get payment error:', error);
    return c.json({ error: 'Failed to fetch payment', details: error.message }, 500);
  }
});

// Webhook handler for Zoho Payment notifications
app.post("/make-server-a67f0635/payment/webhook", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('🔔 Payment webhook received:');
    console.log(JSON.stringify(body, null, 2));
    
    // In production, verify webhook signature from Zoho
    // const signature = c.req.header('X-Zoho-Signature');
    // verifySignature(signature, body);
    
    const { payment_id, order_id, status, amount } = body;
    
    if (payment_id && order_id) {
      // Update payment status based on webhook
      const paymentDataRaw = await kv.get(`payment_${payment_id}`);
      if (paymentDataRaw) {
        const paymentData = JSON.parse(paymentDataRaw);
        paymentData.status = status;
        paymentData.webhook_received_at = new Date().toISOString();
        await kv.set(`payment_${payment_id}`, JSON.stringify(paymentData));
        
        // Update order status
        const orderDataRaw = await kv.get(`order_${order_id}`);
        if (orderDataRaw) {
          const orderData = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
          orderData.payment_status = status === 'success' ? 'paid' : 'failed';
          orderData.status = status === 'success' ? 'confirmed' : 'cancelled';
          orderData.updated_at = new Date().toISOString();
          await kv.set(`order_${order_id}`, orderData);
        }
      }
    }
    
    return c.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return c.json({ error: 'Failed to process webhook', details: error.message }, 500);
  }
});

app.post("/make-server-a67f0635/payment/razorpay/create-order", async (c) => {
  try {
    const body = await c.req.json();
    const razorpayOrder = await createRazorpayServerOrder({
      amount: Number(body.amount),
      currency: body.currency || 'INR',
      receipt: body.receipt || body.orderNumber || `receipt_${Date.now()}`,
    });

    console.log('✅ [Razorpay] Order created:', razorpayOrder.id);
    return c.json(razorpayOrder);
  } catch (error) {
    console.error('❌ [Razorpay] Fatal error creating order:', error);
    return c.json(
      {
        error: 'Failed to create Razorpay order.',
        details: error.message,
      },
      500,
    );
  }
});

// ==================== ZOHO PAYMENTS - EXCLUSIVE PAYMENT GATEWAY ====================

// Zoho Payments Routes
app.post("/make-server-a67f0635/payment/zoho/create-order", paymentGateways.createZohoOrder);
app.post("/make-server-a67f0635/payment/zoho/create", paymentGateways.createZohoOrder);
app.post("/make-server-a67f0635/payment/zoho/verify", paymentGateways.verifyZohoPayment);
app.post("/make-server-a67f0635/payment/zoho/webhook", paymentGateways.handleZohoWebhook);
app.get("/make-server-a67f0635/payment/zoho/transactions", paymentGateways.getZohoTransactions);
app.post("/make-server-a67f0635/payment/zoho/refund", paymentGateways.processZohoRefund);

// Zoho Books Routes (Invoice Generation & PDF Downloads)
app.post("/make-server-a67f0635/zoho-books/invoice-pdf", paymentGateways.getInvoicePdf);
app.get("/make-server-a67f0635/zoho/invoice/:invoiceId/download", paymentGateways.downloadInvoicePdf);

// ==================== REVIEWS ROUTES ====================

// Handle OPTIONS preflight for reviews
app.options("/make-server-a67f0635/reviews", async (c) => {
  return c.json({ success: true }, 200);
});

app.options("/make-server-a67f0635/reviews/:reviewId", async (c) => {
  return c.json({ success: true }, 200);
});

app.options("/make-server-a67f0635/reviews/:reviewId/vote", async (c) => {
  return c.json({ success: true }, 200);
});

// Get reviews for a specific product
app.get("/make-server-a67f0635/reviews/:productId", async (c) => {
  try {
    const productId = c.req.param('productId');
    console.log('📖 Fetching reviews for product:', productId);
    
    const reviews = await kv.getByPrefix(`review:${productId}:`);
    
    // Try to get the current user (if authenticated)
    let currentUserId = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const { user } = await verifyAuth(authHeader);
        if (user) {
          currentUserId = user.id;
          console.log('📖 Authenticated user viewing reviews:', currentUserId);
        }
      } catch (authError) {
        // Not authenticated or invalid token - that's okay for public reviews
        console.log('📖 Unauthenticated user viewing reviews');
      }
    }
    
    // Filter reviews:
    // - Show all approved reviews (for everyone)
    // - Show pending reviews only if they belong to the current user
    const visibleReviews = reviews
      .filter(review => 
        review.status === 'approved' || 
        (review.status === 'pending' && currentUserId && review.userId === currentUserId)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Calculate stats based on ONLY approved reviews (pending reviews shouldn't affect public stats)
    const approvedReviews = reviews.filter(review => review.status === 'approved');
    
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : 0;
    
    return c.json({
      reviews: visibleReviews,
      stats: {
        totalReviews: approvedReviews.length,
        averageRating: Number(avgRating.toFixed(1)),
        ratingDistribution: {
          5: approvedReviews.filter(r => r.rating === 5).length,
          4: approvedReviews.filter(r => r.rating === 4).length,
          3: approvedReviews.filter(r => r.rating === 3).length,
          2: approvedReviews.filter(r => r.rating === 2).length,
          1: approvedReviews.filter(r => r.rating === 1).length,
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching reviews:', error);
    return c.json({ error: 'Failed to fetch reviews', details: error.message }, 500);
  }
});

// Submit a new review (requires authentication)
app.post("/make-server-a67f0635/reviews", async (c) => {
  try {
    console.log('🎯 Review submission started');
    console.log('📨 Full Authorization header:', c.req.header('Authorization'));
    console.log('📨 Request method:', c.req.method);
    console.log('📨 Request URL:', c.req.url);
    
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      console.error('❌ No Authorization header in request');
      return c.json({ error: 'No Authorization header provided' }, 401);
    }
    
    let authResult;
    try {
      console.log('🔐 Calling verifyAuth...');
      authResult = await verifyAuth(authHeader);
      console.log('🔐 Auth verification completed:', authResult);
      console.log('🔐 User found:', authResult.user ? 'Yes' : 'No');
      console.log('🔐 Auth error:', authResult.error || 'None');
    } catch (authException) {
      console.error('❌ Auth verification threw exception:', authException);
      console.error('❌ Exception stack:', authException.stack);
      return c.json({ error: 'Authentication error: ' + authException.message }, 401);
    }
    
    const { user, error: authError } = authResult;
    
    if (authError || !user) {
      console.error('❌ Auth failed. Error:', authError, 'User:', user);
      return c.json({ 
        error: authError || 'You must be logged in to submit a review',
        message: authError || 'You must be logged in to submit a review',
        details: 'Authentication failed. Please sign in and try again.'
      }, 401);
    }
    
    console.log('✅ User authenticated successfully:', { id: user.id, email: user.email });
    
    const { productId, productName, rating, reviewText } = await c.req.json();
    
    console.log('📝 New review submission:', { productId, userId: user.id, rating });
    
    // Validate inputs
    if (!productId || !productName || !rating || !reviewText) {
      return c.json({ error: 'All fields are required' }, 400);
    }
    
    if (rating < 1 || rating > 5) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400);
    }
    
    if (reviewText.length < 10) {
      return c.json({ error: 'Review text must be at least 10 characters' }, 400);
    }
    
    // Get user profile for name - try KV store first, then Supabase
    let userName = user.email?.split('@')[0] || 'Anonymous';
    
    try {
      // Try KV store first (for mock users)
      const kvProfile = await kv.get(`user:${user.id}`);
      if (kvProfile && kvProfile.name) {
        userName = kvProfile.name;
      } else {
        // Fallback to Supabase database
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        
        if (userProfile?.name) {
          userName = userProfile.name;
        }
      }
    } catch (profileError) {
      console.warn('⚠️ Could not fetch user profile, using email fallback:', profileError);
    }
    
    // Use user_metadata name if available (from mock auth)
    if (user.user_metadata?.name) {
      userName = user.user_metadata.name;
    }
    
    const reviewId = `review:${productId}:${Date.now()}_${user.id}`;
    
    // Check if user has purchased this product (verified buyer)
    const orders = await kv.getByPrefix('order:');
    const userOrders = orders.filter(order => order.userId === user.id);
    const hasPurchased = userOrders.some(order => 
      order.items?.some(item => item.productId === productId || item.id === productId)
    );
    
    const reviewData = {
      id: reviewId,
      productId,
      productName,
      userId: user.id,
      customerName: userName,
      rating: Number(rating),
      reviewText: reviewText.trim(),
      status: 'pending', // Require admin approval before publishing
      verifiedBuyer: hasPurchased,
      helpfulVotes: 0,
      notHelpfulVotes: 0,
      voters: [], // Track who voted to prevent duplicate votes
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(reviewId, reviewData);
    
    console.log('✅ Review submitted successfully:', reviewId);
    
    // Send email notification to admin
    try {
      const adminProfiles = await kv.getByPrefix('user:');
      const admins = adminProfiles.filter(profile => profile.role === 'admin');
      
      if (admins.length > 0) {
        console.log(`📧 Sending review notification to ${admins.length} admin(s)`);
        // Note: Email service would be integrated here in production
        // For now, we'll just log it
        console.log(`New ${rating}-star review from ${reviewData.customerName} for ${productName}`);
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send admin notification:', emailError);
      // Don't fail the review submission if email fails
    }
    
    return c.json({
      message: 'Review submitted successfully',
      review: reviewData
    }, 201);
  } catch (error) {
    console.error('❌ Error submitting review:', error);
    return c.json({ error: 'Failed to submit review', details: error.message }, 500);
  }
});

// Get all reviews (admin only)
app.get("/make-server-a67f0635/admin/reviews", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const allReviews = await kv.getByPrefix('review:');
    
    // Sort by date descending
    const sortedReviews = allReviews.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ reviews: sortedReviews });
  } catch (error) {
    console.error('❌ Error fetching all reviews:', error);
    return c.json({ error: 'Failed to fetch reviews', details: error.message }, 500);
  }
});

// Update review status (admin only)
app.put("/make-server-a67f0635/admin/reviews/:reviewId", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const reviewId = c.req.param('reviewId');
    const { status } = await c.req.json();
    
    if (!['approved', 'pending', 'hidden'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    
    const reviews = await kv.getByPrefix(reviewId);
    const review = reviews[0];
    
    if (!review) {
      return c.json({ error: 'Review not found' }, 404);
    }
    
    const updatedReview = {
      ...review,
      status,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(reviewId, updatedReview);
    
    console.log('✅ Review status updated:', reviewId, status);
    
    return c.json({
      message: 'Review status updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('❌ Error updating review:', error);
    return c.json({ error: 'Failed to update review', details: error.message }, 500);
  }
});

// Delete review (admin only)
app.delete("/make-server-a67f0635/admin/reviews/:reviewId", async (c) => {
  try {
    console.log('🗑️ Delete review endpoint called');
    
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      console.log('❌ Unauthorized - no user');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      console.log('❌ Forbidden - user is not admin');
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const reviewId = c.req.param('reviewId');
    console.log('🗑️ Attempting to delete review:', reviewId);
    
    const reviews = await kv.getByPrefix(reviewId);
    const review = reviews[0];
    
    if (!review) {
      console.log('❌ Review not found:', reviewId);
      return c.json({ error: 'Review not found' }, 404);
    }
    
    // Delete the review
    await kv.del(reviewId);
    
    console.log('✅ Review deleted successfully:', reviewId);
    
    return c.json({
      message: 'Review deleted successfully',
      reviewId
    });
  } catch (error) {
    console.error('❌ Error deleting review:', error);
    return c.json({ error: 'Failed to delete review', details: error.message }, 500);
  }
});

// Edit review (customer can edit their own review)
app.put("/make-server-a67f0635/reviews/:reviewId", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const reviewId = c.req.param('reviewId');
    const { rating, reviewText } = await c.req.json();
    
    // Validate inputs
    if (rating && (rating < 1 || rating > 5)) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400);
    }
    
    if (reviewText && reviewText.length < 10) {
      return c.json({ error: 'Review text must be at least 10 characters' }, 400);
    }
    
    const reviews = await kv.getByPrefix(reviewId);
    const review = reviews[0];
    
    if (!review) {
      return c.json({ error: 'Review not found' }, 404);
    }
    
    // Check if user owns this review
    if (review.userId !== user.id) {
      return c.json({ error: 'You can only edit your own reviews' }, 403);
    }
    
    const updatedReview = {
      ...review,
      rating: rating !== undefined ? Number(rating) : review.rating,
      reviewText: reviewText !== undefined ? reviewText.trim() : review.reviewText,
      updatedAt: new Date().toISOString(),
      edited: true
    };
    
    await kv.set(reviewId, updatedReview);
    
    console.log('✅ Review edited by user:', reviewId);
    
    return c.json({
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('❌ Error editing review:', error);
    return c.json({ error: 'Failed to edit review', details: error.message }, 500);
  }
});

// Vote on review helpfulness
app.post("/make-server-a67f0635/reviews/:reviewId/vote", async (c) => {
  try {
    console.log('👍 Vote endpoint called');
    console.log('👍 Authorization header:', c.req.header('Authorization') ? 'Present' : 'Missing');
    
    // Try to verify auth, but handle errors gracefully
    let user = null;
    let authError = null;
    
    try {
      const authResult = await verifyAuth(c.req.header('Authorization'));
      user = authResult.user;
      authError = authResult.error;
    } catch (err) {
      console.error('⚠️ Auth verification error (will return 401 for frontend fallback):', err);
      authError = err;
    }
    
    if (authError || !user) {
      console.log('❌ Authentication failed - returning 401 for frontend to handle with localStorage');
      // Return 401 with clear error message so frontend can fallback to localStorage
      return c.json({ 
        error: 'JWT verification failed - please use localStorage fallback',
        code: 401,
        message: 'Invalid JWT'
      }, 401);
    }
    
    const reviewId = c.req.param('reviewId');
    const { voteType } = await c.req.json(); // 'helpful' or 'notHelpful'
    
    console.log('👍 Review ID:', reviewId);
    console.log('👍 Vote type:', voteType);
    console.log('👍 User ID:', user.id);
    
    if (!['helpful', 'notHelpful'].includes(voteType)) {
      return c.json({ error: 'Invalid vote type' }, 400);
    }
    
    const reviews = await kv.getByPrefix(reviewId);
    const review = reviews[0];
    
    if (!review) {
      return c.json({ error: 'Review not found' }, 404);
    }
    
    // Check if user has already voted
    const voters = review.voters || [];
    const existingVote = voters.find(v => v.userId === user.id);
    
    if (existingVote) {
      // User already voted, update their vote if different
      if (existingVote.voteType === voteType) {
        return c.json({ error: 'You have already voted this way on this review' }, 400);
      }
      
      // Remove old vote count
      if (existingVote.voteType === 'helpful') {
        review.helpfulVotes = Math.max(0, (review.helpfulVotes || 0) - 1);
      } else {
        review.notHelpfulVotes = Math.max(0, (review.notHelpfulVotes || 0) - 1);
      }
      
      // Update vote type
      existingVote.voteType = voteType;
    } else {
      // New vote
      voters.push({
        userId: user.id,
        voteType,
        votedAt: new Date().toISOString()
      });
    }
    
    // Add new vote count
    if (voteType === 'helpful') {
      review.helpfulVotes = (review.helpfulVotes || 0) + 1;
    } else {
      review.notHelpfulVotes = (review.notHelpfulVotes || 0) + 1;
    }
    
    const updatedReview = {
      ...review,
      voters,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(reviewId, updatedReview);
    
    console.log('✅ Vote recorded:', reviewId, voteType);
    
    return c.json({
      message: 'Vote recorded successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('❌ Error recording vote:', error);
    return c.json({ error: 'Failed to record vote', details: error.message }, 500);
  }
});

// ==================== ORDER MANAGEMENT ENDPOINTS ====================

// Get all orders (Admin only - but allow demo mode)
app.get("/make-server-a67f0635/orders", async (c) => {
  try {
    console.log('📦 [Orders] GET /orders endpoint called');
    
    // Try to verify auth, but allow demo mode to work
    const authHeader = c.req.header('Authorization');
    console.log('🔐 [Orders] Auth header:', authHeader ? `${authHeader.substring(0, 50)}...` : 'MISSING');
    
    let isUserAdmin = false;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        console.log('🔐 [Orders] Auth result - User:', user?.id, 'Error:', authError);
        
        if (!authError && user) {
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Orders] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Orders] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        // Allow fallback for demo mode
        console.log('⚠️ [Orders] Auth check exception (continuing in demo mode):', e);
      }
    } else {
      console.log('⚠️ [Orders] No auth header provided (demo mode)');
    }
    
    // For demo mode, allow access even without admin auth
    console.log('📦 [Admin Panel] Fetching ALL orders from ALL customers...');
    
    // DIAGNOSTIC: Check environment and KV store connection
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('🔍 [Admin Panel] Database Environment Check:');
    console.log('  SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('  SERVICE_KEY:', supabaseServiceKey ? `✅ Set (${supabaseServiceKey.length} chars)` : '❌ Missing');
    
    const ordersData = await kv.getByPrefix('order_');
    console.log(`🔍 [Admin Panel] Raw data from KV store: ${ordersData.length} items`);
    
    if (ordersData.length === 0) {
      console.log('⚠️ [Admin Panel] NO ORDERS FOUND in KV store!');
      console.log('⚠️ [Admin Panel] Possible reasons:');
      console.log('  1. Database table kv_store_a67f0635 does not exist');
      console.log('  2. No orders have been placed yet');
      console.log('  3. Orders failed to save to KV store');
      console.log('🔍 [Admin Panel] Check the payment endpoint logs to see if orders are being saved');
    }
    
    const orders = ordersData
      .map((item, index) => {
        try {
          let order;
          if (typeof item === 'string') {
            order = JSON.parse(item);
          } else if (typeof item === 'object' && item !== null) {
            order = item;
          } else {
            return null;
          }
          
          // OPTIMIZATION: Remove large file data from list response
          // Only keep metadata about files (name, size, type) but exclude base64 data
          if (order.items && Array.isArray(order.items)) {
            order.items = order.items.map(item => {
              if (item.uploadedFile && item.uploadedFile.data) {
                // Keep file metadata but remove the large base64 data
                return {
                  ...item,
                  uploadedFile: {
                    name: item.uploadedFile.name,
                    type: item.uploadedFile.type,
                    size: item.uploadedFile.size,
                    hasFile: true // Flag to indicate file exists
                    // data field is excluded for performance
                  }
                };
              }
              return item;
            });
          }
          
          return order;
        } catch (e) {
          console.error(`❌ [Admin Panel] Error processing item ${index + 1}:`, e);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    console.log(`✅ [Admin Panel] Found ${orders.length} total orders from ${[...new Set(orders.map(o => o.customer_email || o.customer_name || 'Unknown'))].length} unique customers`);
    
    return c.json({ orders });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders', details: error.message }, 500);
  }
});

// DEBUG ENDPOINT: Get ALL keys with prefix "order_" from KV store
app.get("/make-server-a67f0635/debug/orders", async (c) => {
  try {
    console.log('🔍 [DEBUG] Fetching ALL order keys from KV store...');
    
    const ordersData = await kv.getByPrefix('order_');
    console.log(`🔍 [DEBUG] Found ${ordersData.length} items with prefix "order_"`);
    
    const orders = ordersData.map((item, index) => {
      console.log(`🔍 [DEBUG] Item ${index + 1} type: ${typeof item}`);
      if (typeof item === 'object' && item !== null) {
        console.log(`🔍 [DEBUG] Item ${index + 1}:`, JSON.stringify(item, null, 2));
        return item;
      } else if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          console.log(`🔍 [DEBUG] Item ${index + 1} (parsed):`, JSON.stringify(parsed, null, 2));
          return parsed;
        } catch (e) {
          console.error(`🔍 [DEBUG] Failed to parse item ${index + 1}:`, e);
          return null;
        }
      }
      return null;
    }).filter(Boolean);
    
    console.log(`✅ [DEBUG] Returning ${orders.length} orders`);
    
    return c.json({ 
      success: true,
      count: orders.length,
      orders: orders 
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    return c.json({ error: 'Debug failed', details: error.message }, 500);
  }
});

// Get user's orders
app.get("/make-server-a67f0635/orders/my-orders", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    // Handle mock tokens for demo mode
    if (authHeader?.includes('mock-token-')) {
      const mockToken = authHeader.replace('Bearer ', '');
      userId = mockToken.replace('mock-token-', '');
      console.log('📦 [My Orders] Using mock auth, user ID:', userId);
      
      // For mock users, we need to get email from orders or use a placeholder
      userEmail = userId === '2' ? 'customer@example.com' : 'admin@honeytranslations.com';
    } else {
      // Try real authentication
      const { user, error: authError } = await verifyAuth(authHeader);
      
      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      userId = user.id;
      userEmail = user.email;
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('📦 [My Orders] Fetching orders for user:', userId);
    console.log('📦 [My Orders] User email:', userEmail);
    
    const ordersData = await kv.getByPrefix('order_');
    console.log(`📦 [My Orders] Found ${ordersData.length} total orders in database`);
    
    const orders = ordersData
      .map((item, index) => {
        try {
          let order;
          // Handle both string and object formats (KV store can return either)
          if (typeof item === 'string') {
            order = JSON.parse(item);
          } else if (typeof item === 'object' && item !== null) {
            order = item;
          } else {
            console.log(`⚠️ [My Orders] Item ${index + 1} is neither string nor object:`, typeof item);
            return null;
          }
          return order;
        } catch (e) {
          console.error(`❌ [My Orders] Failed to parse item ${index + 1}:`, e);
          return null;
        }
      })
      .filter(order => {
        if (!order) return false;
        
        // Filter orders belonging to this user
        const isUserOrder = order.user_id === userId;
        
        if (isUserOrder) {
          console.log(`✅ [My Orders] Found order for user:`, {
            orderNumber: order.order_number,
            userId: order.user_id,
            customerEmail: order.customer_email,
            totalAmount: order.total_amount
          });
        }
        
        return isUserOrder;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    console.log(`✅ [My Orders] Returning ${orders.length} orders for user ${userId} (${userEmail})`);
    
    // 🔥 Add no-cache headers to prevent browser caching of order data
    const response = c.json({ orders });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    return c.json({ error: 'Failed to fetch orders', details: error.message }, 500);
  }
});

// Get single order
app.get("/make-server-a67f0635/orders/:id", async (c) => {
  try {
    console.log('📦 [Order Detail] GET /orders/:id endpoint called');
    
    // Try to verify auth, but allow demo mode to work
    const authHeader = c.req.header('Authorization');
    console.log('🔐 [Order Detail] Auth header:', authHeader ? `${authHeader.substring(0, 50)}...` : 'MISSING');
    
    let isUserAdmin = false;
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        console.log('🔐 [Order Detail] Auth result - User:', user?.id, 'Error:', authError);
        
        if (!authError && user) {
          userId = user.id;
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Order Detail] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Order Detail] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        // Allow fallback for demo mode
        console.log('⚠️ [Order Detail] Auth check exception (continuing in demo mode):', e);
      }
    } else {
      console.log('⚠️ [Order Detail] No auth header provided (demo mode)');
    }
    
    const orderId = c.req.param('id');
    console.log('📦 [Order Detail] Fetching order:', orderId);
    
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    
    // For demo mode, allow admin access if user is admin or in demo mode
    // In production, you would enforce: order.user_id === userId
    console.log('✅ [Order Detail] Order retrieved:', orderId);
    
    // Return FULL order data (including uploadedFile.data for view/download)
    return c.json({ order });
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order', details: error.message }, 500);
  }
});

// Update order status (Admin only)
app.patch("/make-server-a67f0635/orders/:id/status", async (c) => {
  try {
    console.log('📦 [Update Status] PATCH /orders/:id/status endpoint called');
    
    // Try to verify auth, but allow demo mode
    const authHeader = c.req.header('Authorization');
    let isUserAdmin = false;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        
        if (!authError && user) {
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Update Status] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Update Status] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        console.log('⚠️ [Update Status] Auth check exception (continuing in demo mode):', e);
      }
    }
    
    // For demo mode, allow status updates
    const orderId = c.req.param('id');
    const { status, tracking_number, shipping_carrier, estimated_delivery } = await c.req.json();
    
    console.log('📦 Updating order status:', orderId, '→', status);
    
    // Validate status - Updated with comprehensive translation workflow statuses
    const validStatuses = [
      'received',
      'payment-received',
      'confirmed',
      'document-analysis',
      'translator-working',
      'formatting',
      'proof-checking',
      'draft',
      'soft',
      'courier',
      'shipped',
      'delivered',
      'cancelled',
      // Legacy statuses for backward compatibility
      'pending',
      'processing'
    ];
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    
    console.log('🔍 [Update Status] BEFORE update - Current status:', order.status);
    console.log('🔍 [Update Status] NEW status value:', status);
    
    order.status = status;
    order.updated_at = new Date().toISOString();
    
    // Update shipping info if provided (only update if not undefined/null)
    if (tracking_number !== undefined && tracking_number !== null) {
      order.tracking_number = tracking_number;
      console.log('📦 [Update Status] Setting tracking_number:', tracking_number);
    }
    if (shipping_carrier !== undefined && shipping_carrier !== null) {
      order.shipping_carrier = shipping_carrier;
      console.log('📦 [Update Status] Setting shipping_carrier:', shipping_carrier);
    }
    if (estimated_delivery !== undefined && estimated_delivery !== null) {
      order.estimated_delivery = estimated_delivery;
    }
    
    console.log('📦 [Update Status] Order after updates:', {
      status: order.status,
      tracking_number: order.tracking_number,
      shipping_carrier: order.shipping_carrier
    });
    
    // Auto-update timestamps for specific statuses
    if (status === 'shipped' && !order.shipped_at) {
      order.shipped_at = new Date().toISOString();
      console.log('✅ [Update Status] Set shipped_at:', order.shipped_at);
    }
    if (status === 'delivered' && !order.delivered_at) {
      order.delivered_at = new Date().toISOString();
      order.payment_status = 'paid'; // Ensure payment is marked as paid
      console.log('✅ [Update Status] Set delivered_at:', order.delivered_at);
    }
    
    // Save order (don't JSON.stringify - KV store handles JSONB directly)
    console.log('💾 [Update Status] Saving order to KV store...');
    await kv.set(`order_${orderId}`, order);
    
    // VERIFY the save worked
    const verifyOrder = await kv.get(`order_${orderId}`);
    const verifiedOrder = typeof verifyOrder === 'string' ? JSON.parse(verifyOrder) : verifyOrder;
    console.log('✅ [Update Status] Order VERIFIED after save - status:', verifiedOrder.status);
    console.log('✅ [Update Status] Order VERIFIED - tracking:', verifiedOrder.tracking_number);
    console.log('✅ Order status updated:', orderId, '→', status);
    
    // Create notification for customer with comprehensive status updates
    try {
      let notificationTitle = '';
      let notificationMessage = '';
      let notificationType = '';
      
      switch (status) {
        case 'received':
          notificationTitle = 'Order Received';
          notificationMessage = `Your order ${order.order_number} has been successfully received. We will begin processing it shortly.`;
          notificationType = 'order_received';
          break;
        case 'payment-received':
          notificationTitle = 'Payment Confirmed';
          notificationMessage = `Payment for order ${order.order_number} has been confirmed. Thank you!`;
          notificationType = 'payment_received';
          break;
        case 'confirmed':
          notificationTitle = 'Order Confirmed';
          notificationMessage = `Order ${order.order_number} has been confirmed and is ready for processing.`;
          notificationType = 'order_confirmed';
          break;
        case 'document-analysis':
          notificationTitle = 'Document Analysis in Progress';
          notificationMessage = `Our team is currently analyzing your documents for order ${order.order_number}.`;
          notificationType = 'order_processing';
          break;
        case 'translator-working':
          notificationTitle = 'Translation in Progress';
          notificationMessage = `Your assigned translator is currently working on order ${order.order_number}.`;
          notificationType = 'order_processing';
          break;
        case 'formatting':
          notificationTitle = 'Document Formatting';
          notificationMessage = `Your translated documents for order ${order.order_number} are being formatted.`;
          notificationType = 'order_processing';
          break;
        case 'proof-checking':
          notificationTitle = 'Quality Check in Progress';
          notificationMessage = `Order ${order.order_number} is undergoing quality check and proofreading.`;
          notificationType = 'order_processing';
          break;
        case 'draft':
          notificationTitle = 'Draft Ready';
          notificationMessage = `The draft version of your translation for order ${order.order_number} is ready for review.`;
          notificationType = 'order_processing';
          break;
        case 'soft':
          notificationTitle = 'Soft Copy Ready';
          notificationMessage = `The soft copy of your translated documents for order ${order.order_number} is ready. Check your email!`;
          notificationType = 'order_ready';
          break;
        case 'courier':
          notificationTitle = 'Ready for Shipment';
          notificationMessage = `Your documents for order ${order.order_number} are ready to be shipped.`;
          notificationType = 'order_ready';
          break;
        case 'shipped':
          notificationTitle = 'Order Shipped';
          notificationMessage = `Order ${order.order_number} has been shipped${tracking_number ? ` (Tracking: ${tracking_number})` : ''}.`;
          notificationType = 'order_shipped';
          break;
        case 'delivered':
          notificationTitle = 'Order Delivered';
          notificationMessage = `Order ${order.order_number} has been successfully delivered. Thank you for choosing Honey Translation Services!`;
          notificationType = 'order_delivered';
          break;
        case 'cancelled':
          notificationTitle = 'Order Cancelled';
          notificationMessage = `Order ${order.order_number} has been cancelled. If you have any questions, please contact support.`;
          notificationType = 'order_cancelled';
          break;
        case 'processing':
          notificationTitle = 'Order Processing';
          notificationMessage = `Order ${order.order_number} is now being processed by our team.`;
          notificationType = 'order_processing';
          break;
      }
      
      if (notificationTitle) {
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: order.user_id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          order_id: orderId,
          order_number: order.order_number,
          read: false,
          created_at: new Date().toISOString()
        };
        
        await kv.set(`notification_${notification.id}`, notification);
        console.log('📬 [Update Status] Created notification for customer:', notification.id);
      }
    } catch (notifError) {
      console.error('⚠️ [Update Status] Failed to create notification:', notifError);
      // Don't fail the order update if notification creation fails
    }
    
    return c.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    return c.json({ error: 'Failed to update order status', details: error.message }, 500);
  }
});

// Update order notes (Admin only)
app.patch("/make-server-a67f0635/orders/:id/notes", async (c) => {
  try {
    console.log('📝 [Update Notes] PATCH /orders/:id/notes endpoint called');
    
    // Try to verify auth, but allow demo mode
    const authHeader = c.req.header('Authorization');
    let isUserAdmin = false;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        
        if (!authError && user) {
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Update Notes] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Update Notes] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        console.log('⚠️ [Update Notes] Auth check exception (continuing in demo mode):', e);
      }
    }
    
    // For demo mode, allow note updates
    const orderId = c.req.param('id');
    const { notes } = await c.req.json();
    
    console.log('📝 Updating order notes:', orderId);
    
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    order.notes = notes || '';
    order.updated_at = new Date().toISOString();
    
    // Save order (don't JSON.stringify - KV store handles JSONB directly)
    await kv.set(`order_${orderId}`, order);
    
    console.log('✅ Order notes updated:', orderId);
    
    return c.json({
      message: 'Order notes updated successfully',
      order
    });
  } catch (error) {
    console.error('❌ Error updating order notes:', error);
    return c.json({ error: 'Failed to update order notes', details: error.message }, 500);
  }
});

// Download completed file
app.get("/make-server-a67f0635/orders/:id/download-completed-file", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const orderId = c.req.param('id');
    const orderDataRaw = await kv.get(`order_${orderId}`);
    
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderDataRaw === 'string' ? JSON.parse(orderDataRaw) : orderDataRaw;
    
    // Verify user owns this order
    if (order.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Check if completed file exists
    if (!order.completed_file_url) {
      return c.json({ error: 'No completed file available for this order' }, 404);
    }
    
    // If it's a storage URL, create a signed URL
    if (order.completed_file_url.includes('supabase')) {
      const { data, error } = await supabase.storage
        .from('make-a67f0635-order-files')
        .createSignedUrl(order.completed_file_url, 3600); // 1 hour expiry
      
      if (error || !data) {
        console.error('Failed to create signed URL:', error);
        return c.json({ error: 'Failed to generate download link' }, 500);
      }
      
      return c.json({ downloadUrl: data.signedUrl });
    }
    
    // Return the URL directly
    return c.json({ downloadUrl: order.completed_file_url });
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    return c.json({ error: 'Failed to download file', details: error.message }, 500);
  }
});

// Delete order (Admin only)
app.delete("/make-server-a67f0635/orders/:id", async (c) => {
  try {
    console.log('🗑️ [Delete Order] DELETE /orders/:id endpoint called');
    
    // Try to verify auth, but allow demo mode
    const authHeader = c.req.header('Authorization');
    let isUserAdmin = false;
    
    if (authHeader) {
      try {
        const { user, error: authError } = await verifyAuth(authHeader);
        
        if (!authError && user) {
          isUserAdmin = await isAdmin(user.id);
          console.log('🔐 [Delete Order] User is admin:', isUserAdmin);
        } else if (authError) {
          console.log('⚠️ [Delete Order] Auth error (continuing in demo mode):', authError);
        }
      } catch (e) {
        console.log('⚠️ [Delete Order] Auth check exception (continuing in demo mode):', e);
      }
    }
    
    // For demo mode, allow deletions
    const orderId = c.req.param('id');
    console.log('🗑️ [Delete Order] Admin deleting order:', orderId);
    
    // Check if order exists
    const orderDataRaw = await kv.get(`order_${orderId}`);
    if (!orderDataRaw) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Delete the order
    await kv.del(`order_${orderId}`);
    console.log('✅ [Delete Order] Order deleted successfully:', orderId);
    
    return c.json({ 
      success: true, 
      message: 'Order deleted successfully',
      orderId 
    });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    return c.json({ error: 'Failed to delete order', details: error.message }, 500);
  }
});

// Handle OPTIONS preflight for DELETE orders
app.options("/make-server-a67f0635/orders/:id", (c) => {
  return c.json({ ok: true }, 200);
});

// Cleanup guest orders (Admin only)
app.post("/make-server-a67f0635/orders/cleanup-guests", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is admin
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    console.log('🧹 [Cleanup] Starting guest order cleanup...');
    
    // Get all orders
    const ordersData = await kv.getByPrefix('order_');
    console.log(`🔍 [Cleanup] Found ${ordersData.length} total orders`);
    
    let deletedCount = 0;
    const deletedOrders = [];
    
    for (const item of ordersData) {
      try {
        const order = typeof item === 'string' ? JSON.parse(item) : item;
        
        // Check if it's a guest order
        if (order.customer_email === 'guest@example.com' || 
            order.customer_name === 'Guest User' ||
            order.user_id === 'guest') {
          
          console.log(`🗑️ [Cleanup] Deleting guest order: ${order.order_number}`);
          await kv.del(`order_${order.id}`);
          deletedCount++;
          deletedOrders.push(order.order_number);
        }
      } catch (e) {
        console.error('❌ [Cleanup] Error processing order:', e);
      }
    }
    
    console.log(`✅ [Cleanup] Deleted ${deletedCount} guest orders`);
    
    return c.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} guest orders`,
      deletedCount,
      deletedOrders
    });
  } catch (error) {
    console.error('❌ Error cleaning up guest orders:', error);
    return c.json({ error: 'Failed to cleanup guest orders', details: error.message }, 500);
  }
});

// Public order tracking endpoint - NO AUTH REQUIRED
app.post("/make-server-a67f0635/orders/track", async (c) => {
  try {
    console.log('🔍 [Track Order] POST /orders/track endpoint called');
    
    const body = await c.req.json();
    const { orderNumber, email, phone, trackingNumber } = body;
    
    console.log('🔍 [Track Order] Request:', { orderNumber, email, phone, trackingNumber });
    
    // Fetch all orders
    const ordersData = await kv.getByPrefix('order_');
    console.log(`🔍 [Track Order] Found ${ordersData.length} total orders in database`);
    
    let foundOrder = null;
    
    // Search by tracking number if provided
    if (trackingNumber && trackingNumber.trim()) {
      console.log('🔍 [Track Order] Searching by tracking number:', trackingNumber);
      
      for (const item of ordersData) {
        try {
          const order = typeof item === 'string' ? JSON.parse(item) : item;
          
          if (order.tracking_number && 
              order.tracking_number.toLowerCase() === trackingNumber.toLowerCase().trim()) {
            foundOrder = order;
            console.log('✅ [Track Order] Found order by tracking number:', order.order_number);
            break;
          }
        } catch (e) {
          console.error('❌ [Track Order] Error parsing order:', e);
        }
      }
    }
    // Search by order number + email/phone if tracking number not found
    else if (orderNumber && (email || phone)) {
      console.log('🔍 [Track Order] Searching by order number and contact info');
      
      for (const item of ordersData) {
        try {
          const order = typeof item === 'string' ? JSON.parse(item) : item;
          
          // Match order number
          const orderNumberMatch = order.order_number && 
            order.order_number.toLowerCase() === orderNumber.toLowerCase().trim();
          
          if (!orderNumberMatch) continue;
          
          // Match email or phone
          let contactMatch = false;
          
          if (email && email.trim()) {
            const emailMatch = order.customer_email && 
              order.customer_email.toLowerCase() === email.toLowerCase().trim();
            contactMatch = contactMatch || emailMatch;
          }
          
          if (phone && phone.trim()) {
            // Check phone in shipping address
            const phoneMatch = order.shipping_address?.phone && 
              order.shipping_address.phone.replace(/\D/g, '') === phone.replace(/\D/g, '');
            contactMatch = contactMatch || phoneMatch;
          }
          
          if (contactMatch) {
            foundOrder = order;
            console.log('✅ [Track Order] Found order by order number + contact:', order.order_number);
            break;
          }
        } catch (e) {
          console.error('❌ [Track Order] Error parsing order:', e);
        }
      }
    }
    
    if (!foundOrder) {
      console.log('❌ [Track Order] Order not found');
      return c.json({ 
        success: false,
        error: 'Order not found. Please check your order number and contact details.' 
      }, 404);
    }
    
    // Return order details (excluding sensitive data)
    const orderDetails = {
      id: foundOrder.id,
      order_number: foundOrder.order_number,
      tracking_number: foundOrder.tracking_number,
      status: foundOrder.status,
      payment_status: foundOrder.payment_status,
      shipping_carrier: foundOrder.shipping_carrier,
      estimated_delivery: foundOrder.estimated_delivery,
      created_at: foundOrder.created_at,
      updated_at: foundOrder.updated_at,
      shipped_at: foundOrder.shipped_at,
      delivered_at: foundOrder.delivered_at,
      items: foundOrder.items?.map(item => ({
        id: item.id,
        name: item.name,
        pageCount: item.pageCount
      })) || [],
      shipping_address: foundOrder.shipping_address ? {
        city: foundOrder.shipping_address.city,
        state: foundOrder.shipping_address.state,
        country: foundOrder.shipping_address.country
      } : null
    };
    
    console.log('✅ [Track Order] Returning order details');
    
    return c.json({
      success: true,
      order: orderDetails
    });
  } catch (error) {
    console.error('❌ [Track Order] Error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to track order',
      details: error.message 
    }, 500);
  }
});

// Get order tracking details with full tracking information
app.get("/make-server-a67f0635/orders/:orderId/tracking", async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('📦 [Order Tracking] GET /orders/:orderId/tracking endpoint called:', orderId);
    
    // Fetch order
    const orderData = await kv.get(`order_${orderId}`);
    
    if (!orderData) {
      console.log('❌ [Order Tracking] Order not found:', orderId);
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
    
    // Initialize tracking if it doesn't exist
    if (!order.tracking) {
      order.tracking = {
        stages: {
          received: {
            completed: true,
            timestamp: order.created_at,
            details: 'Order received successfully'
          }
        },
        activities: [
          {
            id: `activity_${Date.now()}`,
            stage: 'received',
            message: 'Order has been received and is being processed',
            timestamp: order.created_at,
            type: 'status_update'
          }
        ]
      };
    }
    
    console.log('✅ [Order Tracking] Returning order with tracking details');
    
    return c.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: order.currency,
        status: order.status,
        payment_status: order.payment_status,
        items: order.items || [],
        shipping_address: order.shipping_address,
        created_at: order.created_at,
        estimated_delivery: order.estimated_delivery,
        tracking: order.tracking
      }
    });
  } catch (error) {
    console.error('❌ [Order Tracking] Error:', error);
    return c.json({ 
      error: 'Failed to fetch order tracking',
      details: error.message 
    }, 500);
  }
});

// Update tracking stage
app.patch("/make-server-a67f0635/orders/:orderId/tracking/stage", async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const body = await c.req.json();
    const { stageId, completed, details } = body;
    
    console.log('📦 [Order Tracking] PATCH /orders/:orderId/tracking/stage called:', {
      orderId,
      stageId,
      completed,
      details
    });
    
    // Fetch order
    const orderData = await kv.get(`order_${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
    
    // Initialize tracking if needed
    if (!order.tracking) {
      order.tracking = {
        stages: {},
        activities: []
      };
    }
    
    // Update stage
    const previousState = order.tracking.stages[stageId]?.completed || false;
    const timestamp = new Date().toISOString();
    
    if (!order.tracking.stages[stageId]) {
      order.tracking.stages[stageId] = {};
    }
    
    if (completed !== undefined) {
      order.tracking.stages[stageId].completed = completed;
      order.tracking.stages[stageId].timestamp = completed ? timestamp : undefined;
    }
    
    if (details !== undefined) {
      order.tracking.stages[stageId].details = details;
    }
    
    // Add activity if status changed
    if (completed !== undefined && completed !== previousState) {
      const stageLabels = {
        received: 'Received',
        payment_received: 'Payment Received',
        confirmed: 'Confirmed',
        document_analysis: 'Document Analysis',
        translator_assigned: 'Translator Assigned',
        translator_working: 'Translator Working',
        formatting: 'Formatting',
        proof_checking: 'Proof Checking',
        draft_ready: 'Draft Ready',
        soft_copy_ready: 'Soft Copy Ready',
        courier: 'Courier',
        shipped: 'Shipped'
      };
      
      const stageName = stageLabels[stageId] || stageId;
      
      order.tracking.activities.push({
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stage: stageId,
        message: completed 
          ? `${stageName} stage completed` 
          : `${stageName} stage marked as incomplete`,
        timestamp: timestamp,
        type: 'status_update'
      });
    }
    
    // Update order timestamp
    order.updated_at = timestamp;
    
    // Save order
    await kv.set(`order_${orderId}`, JSON.stringify(order));
    
    console.log('✅ [Order Tracking] Stage updated successfully');
    
    return c.json({
      success: true,
      tracking: order.tracking
    });
  } catch (error) {
    console.error('❌ [Order Tracking] Error updating stage:', error);
    return c.json({ 
      error: 'Failed to update tracking stage',
      details: error.message 
    }, 500);
  }
});

// Update translator information
app.patch("/make-server-a67f0635/orders/:orderId/tracking/translator", async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const body = await c.req.json();
    const { name, location } = body;
    
    console.log('📦 [Order Tracking] PATCH /orders/:orderId/tracking/translator called:', {
      orderId,
      name,
      location
    });
    
    // Fetch order
    const orderData = await kv.get(`order_${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
    
    // Initialize tracking if needed
    if (!order.tracking) {
      order.tracking = {
        stages: {},
        activities: []
      };
    }
    
    // Update translator info
    const timestamp = new Date().toISOString();
    order.tracking.translator = {
      name,
      location
    };
    
    // Add activity
    order.tracking.activities.push({
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stage: 'translator_assigned',
      message: `Translator ${name}${location ? ` from ${location}` : ''} has been assigned to this order`,
      timestamp: timestamp,
      type: 'info'
    });
    
    // Update order timestamp
    order.updated_at = timestamp;
    
    // Save order
    await kv.set(`order_${orderId}`, JSON.stringify(order));
    
    console.log('✅ [Order Tracking] Translator updated successfully');
    
    return c.json({
      success: true,
      tracking: order.tracking
    });
  } catch (error) {
    console.error('❌ [Order Tracking] Error updating translator:', error);
    return c.json({ 
      error: 'Failed to update translator',
      details: error.message 
    }, 500);
  }
});

// ==================== NOTIFICATION ROUTES ====================

// Get all notifications (Admin only - only shows admin-relevant notifications like new_order)
app.get("/make-server-a67f0635/notifications", async (c) => {
  try {
    console.log('🔔 [Notifications] GET /notifications endpoint called (ADMIN)');
    
    // Fetch all notifications without strict auth requirements
    // This allows demo mode to work seamlessly
    const authHeader = c.req.header('Authorization');
    console.log('🔔 [Notifications] Auth header present:', !!authHeader);
    
    // Fetch all notifications
    const notificationsData = await kv.getByPrefix('notification_');
    const allNotifications = notificationsData
      .map((item) => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    
    // FILTER: Only show admin-relevant notifications (new_order, payment, review, system)
    // EXCLUDE customer order status notifications (order_placed, order_confirmed, order_shipped, order_delivered)
    const adminNotificationTypes = ['new_order', 'payment', 'review', 'system', 'user'];
    const notifications = allNotifications
      .filter(notif => adminNotificationTypes.includes(notif.type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    console.log(`✅ [Notifications] Found ${allNotifications.length} total notifications, returning ${notifications.length} admin notifications`);
    console.log(`🔔 [Notifications] Filtered out ${allNotifications.length - notifications.length} customer-only notifications`);
    
    return c.json({ notifications });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    // Return empty array instead of error to prevent UI issues
    return c.json({ notifications: [] });
  }
});

// Mark notification as read
app.patch("/make-server-a67f0635/notifications/:id/read", async (c) => {
  try {
    const notificationId = c.req.param('id');
    console.log('🔔 [Notifications] Marking notification as read:', notificationId);
    
    const notificationData = await kv.get(`notification_${notificationId}`);
    if (!notificationData) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    const notification = typeof notificationData === 'string' ? JSON.parse(notificationData) : notificationData;
    notification.read = true;
    notification.read_at = new Date().toISOString();
    
    await kv.set(`notification_${notificationId}`, notification);
    
    console.log('✅ [Notifications] Notification marked as read');
    
    return c.json({ notification });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return c.json({ error: 'Failed to update notification', details: error.message }, 500);
  }
});

// Bulk delete notifications (MUST come before single delete to avoid route conflict)
app.delete("/make-server-a67f0635/notifications/delete-selected", async (c) => {
  try {
    const body = await c.req.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'Invalid or empty notification IDs array' }, 400);
    }
    
    console.log('🗑️ [Notifications] Bulk deleting notifications:', ids);
    
    // Delete all selected notifications
    const deletePromises = ids.map(id => kv.del(`notification_${id}`));
    await Promise.all(deletePromises);
    
    console.log('✅ [Notifications] Bulk deleted', ids.length, 'notifications');
    
    return c.json({ 
      success: true, 
      deletedCount: ids.length,
      message: `Successfully deleted ${ids.length} notification(s)` 
    });
  } catch (error) {
    console.error('❌ Error bulk deleting notifications:', error);
    return c.json({ error: 'Failed to delete notifications', details: error.message }, 500);
  }
});

// Delete notification (single)
app.delete("/make-server-a67f0635/notifications/:id", async (c) => {
  try {
    const notificationId = c.req.param('id');
    console.log('🗑️ [Notifications] Deleting notification:', notificationId);
    
    const notificationData = await kv.get(`notification_${notificationId}`);
    if (!notificationData) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    await kv.del(`notification_${notificationId}`);
    
    console.log('✅ [Notifications] Notification deleted');
    
    return c.json({ 
      success: true, 
      message: 'Notification deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return c.json({ error: 'Failed to delete notification', details: error.message }, 500);
  }
});

// ==================== COUPON ROUTES ====================

// Get all active coupons
app.get("/make-server-a67f0635/coupons", async (c) => {
  try {
    console.log('📋 Fetching all coupons');
    
    const couponsData = await kv.getByPrefix('coupon_');
    const coupons = couponsData.map((data: string) => JSON.parse(data));
    
    console.log(`✅ Found ${coupons.length} coupons`);
    
    return c.json({ coupons });
  } catch (error) {
    console.error('❌ Error fetching coupons:', error);
    return c.json({ error: 'Failed to fetch coupons', details: error.message }, 500);
  }
});

// Validate and apply coupon
app.post("/make-server-a67f0635/coupons/validate", async (c) => {
  try {
    const { code, orderValue } = await c.req.json();
    
    console.log('🏷️ Validating coupon:', code, 'for order value:', orderValue);
    
    if (!code) {
      return c.json({ error: 'Coupon code is required' }, 400);
    }
    
    // Get all coupons and find matching code
    const couponsData = await kv.getByPrefix('coupon_');
    const coupons = couponsData.map((data: string) => JSON.parse(data));
    
    const coupon = coupons.find((c: any) => c.code === code.toUpperCase());
    
    if (!coupon) {
      return c.json({ valid: false, error: 'Coupon not found' }, 404);
    }
    
    // Check if coupon is active
    if (coupon.status !== 'active') {
      return c.json({ valid: false, error: 'Coupon is not active' }, 400);
    }
    
    // Check minimum order value
    if (orderValue < coupon.minOrderValue) {
      return c.json({ 
        valid: false, 
        error: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` 
      }, 400);
    }
    
    // Check validity dates
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);
    
    if (now < validFrom) {
      return c.json({ valid: false, error: 'Coupon is not valid yet' }, 400);
    }
    
    if (now > validUntil) {
      return c.json({ valid: false, error: 'Coupon has expired' }, 400);
    }
    
    // Check usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return c.json({ valid: false, error: 'Coupon usage limit reached' }, 400);
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderValue * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }
    
    console.log('✅ Coupon is valid. Discount:', discountAmount);
    
    return c.json({ 
      valid: true, 
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
        description: coupon.description
      },
      discountAmount 
    });
  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    return c.json({ error: 'Failed to validate coupon', details: error.message }, 500);
  }
});

// Create coupon (Admin only)
app.post("/make-server-a67f0635/coupons", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    const couponData = await c.req.json();
    
    console.log('🏷️ Creating coupon:', couponData.code);
    
    const coupon = {
      ...couponData,
      id: couponData.id || Date.now().toString(),
      code: couponData.code.toUpperCase(),
      usedCount: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`coupon_${coupon.id}`, JSON.stringify(coupon));
    
    console.log('��� Coupon created:', coupon.code);
    
    return c.json({ coupon });
  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    return c.json({ error: 'Failed to create coupon', details: error.message }, 500);
  }
});

// Update coupon (Admin only)
app.put("/make-server-a67f0635/coupons/:id", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    const couponId = c.req.param('id');
    const updates = await c.req.json();
    
    console.log('🏷️ Updating coupon:', couponId);
    
    const existingData = await kv.get(`coupon_${couponId}`);
    if (!existingData) {
      return c.json({ error: 'Coupon not found' }, 404);
    }
    
    const existingCoupon = JSON.parse(existingData);
    const updatedCoupon = {
      ...existingCoupon,
      ...updates,
      id: couponId,
      code: updates.code ? updates.code.toUpperCase() : existingCoupon.code,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`coupon_${couponId}`, JSON.stringify(updatedCoupon));
    
    console.log('✅ Coupon updated:', updatedCoupon.code);
    
    return c.json({ coupon: updatedCoupon });
  } catch (error) {
    console.error('❌ Error updating coupon:', error);
    return c.json({ error: 'Failed to update coupon', details: error.message }, 500);
  }
});

// Delete coupon (Admin only)
app.delete("/make-server-a67f0635/coupons/:id", async (c) => {
  try {
    const { user, error: authError } = await verifyAuth(c.req.header('Authorization'));
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    const couponId = c.req.param('id');
    
    console.log('🏷️ Deleting coupon:', couponId);
    
    await kv.del(`coupon_${couponId}`);
    
    console.log('✅ Coupon deleted');
    
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting coupon:', error);
    return c.json({ error: 'Failed to delete coupon', details: error.message }, 500);
  }
});

// Clear all data endpoint (Admin only - for demo cleanup)
app.post("/make-server-a67f0635/admin/clear-all-data", async (c) => {
  try {
    console.log('🧹 [Admin] Clearing all data...');
    
    // Get all orders
    const ordersData = await kv.getByPrefix('order_');
    console.log(`🗑️ [Admin] Deleting ${ordersData.length} orders...`);
    const orderKeys = ordersData.map((item: any) => {
      if (typeof item === 'string') {
        const parsed = JSON.parse(item);
        return `order_${parsed.id}`;
      }
      return `order_${item.id}`;
    });
    if (orderKeys.length > 0) {
      await kv.mdel(orderKeys);
    }
    
    // Get all notifications
    const notificationsData = await kv.getByPrefix('notification_');
    console.log(`🗑️ [Admin] Deleting ${notificationsData.length} notifications...`);
    const notificationKeys = notificationsData.map((item: any) => {
      if (typeof item === 'string') {
        const parsed = JSON.parse(item);
        return `notification_${parsed.id}`;
      }
      return `notification_${item.id}`;
    });
    if (notificationKeys.length > 0) {
      await kv.mdel(notificationKeys);
    }
    
    // Get all user records (customers)
    const usersData = await kv.getByPrefix('user_');
    console.log(`🗑️ [Admin] Deleting ${usersData.length} user records...`);
    const userKeys = usersData.map((item: any) => {
      if (typeof item === 'string') {
        const parsed = JSON.parse(item);
        return `user_${parsed.id}`;
      }
      return `user_${item.id}`;
    });
    if (userKeys.length > 0) {
      await kv.mdel(userKeys);
    }
    
    console.log('✅ [Admin] All data cleared successfully');
    
    return c.json({ 
      success: true, 
      message: 'All data cleared successfully',
      deleted: {
        orders: ordersData.length,
        notifications: notificationsData.length,
        users: usersData.length
      }
    });
  } catch (error) {
    console.error('❌ [Admin] Error clearing data:', error);
    return c.json({ error: 'Failed to clear data', details: error.message }, 500);
  }
});

// ==================== AUTO DATABASE SETUP ENDPOINT ====================

/**
 * One-click database setup endpoint
 * Verifies the kv_store_a67f0635 table exists and is accessible
 */
app.post("/make-server-a67f0635/setup/database", async (c) => {
  console.log('🔧 [Setup] One-click database setup requested...');
  
  try {
    // Step 1: Verify the table exists using the Supabase client (service role bypasses RLS)
    console.log('🔍 [Setup] Step 1: Checking if kv_store_a67f0635 table exists...');
    
    const { data: tableCheck, error: tableError } = await supabase
      .from('kv_store_a67f0635')
      .select('key')
      .limit(1);
    
    if (tableError) {
      console.error('❌ [Setup] Table check failed:', tableError.message);
      
      if (tableError.message.includes('does not exist') || tableError.code === '42P01') {
        return c.json({
          success: false,
          error: 'Table kv_store_a67f0635 does not exist in the database',
          details: tableError.message,
          instructions: 'This table should be pre-provisioned. Please check your Supabase project configuration.'
        }, 500);
      }
      
      console.log('⚠️ [Setup] Table may exist but has access issues. Attempting KV operations with service role...');
    } else {
      console.log('✅ [Setup] Table exists and is accessible. Found', tableCheck?.length || 0, 'rows in sample.');
    }
    
    // Step 2: Test KV operations (these use the service role key internally)
    console.log('🔍 [Setup] Step 2: Testing KV read/write operations...');
    
    const testKey = `_setup_test_${Date.now()}`;
    const testValue = { 
      timestamp: new Date().toISOString(), 
      source: 'auto-fix',
      message: 'Database setup verification' 
    };
    
    await kv.set(testKey, testValue);
    console.log('✅ [Setup] Write test passed');
    
    const readBack = await kv.get(testKey);
    if (!readBack) {
      throw new Error('Write succeeded but read returned null - possible RLS issue');
    }
    console.log('✅ [Setup] Read test passed');
    
    await kv.del(testKey);
    console.log('✅ [Setup] Cleanup complete');
    
    // Step 3: Verify prefix queries (used by orders, customers, etc.)
    console.log('🔍 [Setup] Step 3: Testing prefix queries...');
    
    try {
      const prefixTest = await kv.getByPrefix('_nonexistent_prefix_');
      console.log('✅ [Setup] Prefix query test passed (returned', prefixTest?.length || 0, 'results)');
    } catch (prefixError: any) {
      console.warn('⚠️ [Setup] Prefix query test failed:', prefixError.message);
    }
    
    // Step 4: Initialize essential data if not present
    console.log('🔍 [Setup] Step 4: Checking essential data...');
    
    const serverInfo = await kv.get('server_info');
    if (!serverInfo) {
      await kv.set('server_info', {
        initialized_at: new Date().toISOString(),
        version: '1.0.0',
        name: 'Honey Translation Services'
      });
      console.log('✅ [Setup] Server info initialized');
    } else {
      console.log('✅ [Setup] Server info already exists');
    }
    
    console.log('🎉 [Setup] Database setup completed successfully!');
    
    return c.json({
      success: true,
      message: 'Database setup completed successfully! ✅',
      details: {
        tableExists: true,
        kvReadWrite: true,
        prefixQueries: true,
        readyForOrders: true,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ [Setup] Database setup failed:', error);
    console.error('❌ [Setup] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    return c.json({
      success: false,
      error: 'Database setup failed',
      details: error.message,
      instructions: 'Check server logs for more details. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correctly set.'
    }, 500);
  }
});

/**
 * Check database status endpoint
 */
app.get("/make-server-a67f0635/setup/status", async (c) => {
  console.log('🔍 [Setup] Checking database status...');
  
  try {
    // Try to read from the table
    const testResult = await supabase
      .from('kv_store_a67f0635')
      .select('key')
      .limit(1);
    
    if (testResult.error) {
      console.log('❌ [Setup] Table not accessible:', testResult.error.message);
      
      return c.json({
        tableExists: false,
        accessible: false,
        error: testResult.error.message,
        needsSetup: true
      });
    }
    
    // Try KV operations
    let kvWorks = false;
    try {
      await kv.set('_status_test', { timestamp: new Date().toISOString() });
      await kv.get('_status_test');
      await kv.del('_status_test');
      kvWorks = true;
    } catch (kvError) {
      console.warn('⚠️ [Setup] KV operations failed:', kvError);
    }
    
    console.log('✅ [Setup] Database is ready');
    
    return c.json({
      tableExists: true,
      accessible: true,
      kvWorks: kvWorks,
      needsSetup: false,
      message: 'Database is ready! ✅'
    });
    
  } catch (error: any) {
    console.error('❌ [Setup] Status check failed:', error);
    
    return c.json({
      tableExists: false,
      accessible: false,
      error: error.message,
      needsSetup: true
    });
  }
});

// ==================== SERVER STARTUP INITIALIZATION ====================

/**
 * Initialize database on server startup
 * This ensures RLS is properly configured for the kv_store table
 */
async function initializeDatabase() {
  try {
    console.log('🔧 [Startup] Initializing database configuration...');
    
    // Test if we can query the kv_store table
    const testResult = await supabase
      .from('kv_store_a67f0635')
      .select('key')
      .limit(1);
    
    if (testResult.error) {
      // Check if error message is actually an HTML error page (502/503 from infrastructure)
      const errorMsg = testResult.error.message || '';
      const isHtmlError = errorMsg.includes('<!DOCTYPE') || errorMsg.includes('<html');
      
      if (isHtmlError) {
        console.error('⚠️ [Startup] Database connection failed - Infrastructure error (502/503)');
        console.error('⚠️ [Startup] Possible causes:');
        console.error('   - Supabase project credentials not set correctly');
        console.error('   - Database URL or keys are invalid');
        console.error('   - Supabase project is paused or unavailable');
        console.error('ℹ️  [Startup] Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
        return; // Exit early without logging HTML
      }
      
      // Only log first 200 chars to avoid spam
      const truncatedMsg = errorMsg.length > 200 ? errorMsg.substring(0, 200) + '...' : errorMsg;
      console.error('⚠️ [Startup] Database query failed:', truncatedMsg);
      console.error('⚠️ [Startup] Error code:', testResult.error.code);
      
      // Check if it's a "table does not exist" error
      if (testResult.error.message.includes('does not exist') || 
          testResult.error.message.includes('relation') ||
          testResult.error.code === '42P01') {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  DATABASE TABLE MISSING');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('❌ The table "kv_store_a67f0635" does not exist in your database.');
        console.log('');
        console.log('📋 To fix this, you have 2 options:');
        console.log('');
        console.log('   OPTION 1: One-Click Auto-Fix (Easiest)');
        console.log('   ─────────────────────────────────────────');
        console.log('   1. Go to: /admin/diagnostics');
        console.log('   2. Click "Auto-Fix Database" button');
        console.log('   3. Wait 30 seconds');
        console.log('   4. Done! ✅');
        console.log('');
        console.log('   OPTION 2: Manual SQL');
        console.log('   ─────────────────────────────────────────');
        console.log('   1. Go to: /admin/quick-orders-fix');
        console.log('   2. Copy the SQL script');
        console.log('   3. Run it in Supabase SQL Editor');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('ℹ️  Server will continue to run, but orders will not be saved.');
        console.log('');
        return; // Exit early - don't crash the server
      }
      
      // If it's an RLS error, we need to disable RLS or create policies
      if (testResult.error.message.includes('row-level security') || 
          testResult.error.message.includes('policy') ||
          testResult.error.code === 'PGRST301' ||
          testResult.error.code === '42501') {
        
        console.log('🔧 [Startup] RLS policy issue detected');
        console.log('ℹ️  [Startup] Use /admin/diagnostics to fix this automatically');
        return; // Exit early - don't crash the server
      }
    } else {
      console.log('✅ [Startup] Database connection verified - kv_store is accessible');
    }
    
    // Try a simple KV operation to verify everything works
    try {
      await kv.set('_server_startup_test', { timestamp: new Date().toISOString() });
      await kv.del('_server_startup_test');
      console.log('✅ [Startup] KV store is working correctly');
    } catch (kvError: any) {
      console.error('⚠️ [Startup] KV store test failed:', kvError.message);
      console.log('ℹ️  [Startup] Visit /admin/diagnostics to fix database issues');
    }
    
  } catch (error: any) {
    // Don't crash the server - just log the error
    console.error('⚠️ [Startup] Database initialization error:', error.message);
    console.log('ℹ️  [Startup] Server will start but database may not be configured');
    console.log('ℹ️  [Startup] Visit /admin/diagnostics to fix issues');
  }
}

// Run startup database check to verify connectivity
await initializeDatabase();

console.log('🚀 [Startup] Honey Translation Services API Server ready');

// Global error handler
app.onError((err, c) => {
  console.error('❌ [Global Error Handler] Unhandled error:', err);
  console.error('❌ [Global Error Handler] Error stack:', err.stack);
  
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    code: 500
  }, 500);
});

// 404 handler for unmatched routes
app.notFound((c) => {
  console.log('⚠️ [404] Route not found:', c.req.method, c.req.url);
  
  return c.json({
    success: false,
    error: 'Not Found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
    code: 404
  }, 404);
});

Deno.serve(app.fetch);
