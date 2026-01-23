import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const MAX_ATTEMPTS = 5; // Max failed attempts before lockout
const LOCKOUT_WINDOW_MINUTES = 15; // Time window to track attempts
const LOCKOUT_DURATION_MINUTES = 15; // How long to lock out after max attempts

// Helper functions for hex encoding/decoding
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Get client IP from request headers
function getClientIP(req: Request): string {
  // Check common headers for real client IP (behind proxies/load balancers)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // Fallback to a hash of user-agent + other identifiers
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `ua-${toHex(new TextEncoder().encode(userAgent)).substring(0, 32)}`;
}

// PBKDF2-based password verification using Web Crypto API
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Parse stored hash format: algorithm$iterations$salt$hash
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      console.error('Invalid hash format');
      return false;
    }
    
    const iterations = parseInt(parts[1], 10);
    const salt = fromHex(parts[2]);
    const expectedHash = parts[3];
    
    // Derive key from password
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const derivedHash = toHex(new Uint8Array(derivedBits));
    return derivedHash === expectedHash;
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

// Check if IP is rate limited
async function checkRateLimit(
  supabase: any,
  ipAddress: string
): Promise<{ allowed: boolean; remainingAttempts?: number; lockoutEndsAt?: string }> {
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
  
  // Count failed attempts in the window
  const { data: attempts, error } = await supabase
    .from('login_attempts')
    .select('attempted_at, success')
    .eq('ip_address', ipAddress)
    .gte('attempted_at', windowStart)
    .order('attempted_at', { ascending: false });
  
  if (error) {
    console.error('Error checking rate limit:', error);
    // Allow on error to prevent lockouts due to DB issues
    return { allowed: true };
  }
  
  // Count consecutive failed attempts (reset on success)
  let failedCount = 0;
  for (const attempt of (attempts || []) as Array<{ attempted_at: string; success: boolean }>) {
    if (attempt.success) break;
    failedCount++;
  }
  
  if (failedCount >= MAX_ATTEMPTS) {
    // Check when the lockout ends
    const attemptsArr = (attempts || []) as Array<{ attempted_at: string; success: boolean }>;
    const lastAttempt = attemptsArr[0]?.attempted_at;
    if (lastAttempt) {
      const lockoutEnds = new Date(new Date(lastAttempt).getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      if (lockoutEnds > new Date()) {
        return { 
          allowed: false, 
          lockoutEndsAt: lockoutEnds.toISOString(),
          remainingAttempts: 0
        };
      }
    }
  }
  
  return { 
    allowed: true, 
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedCount)
  };
}

// Record a login attempt
async function recordAttempt(
  supabase: any,
  ipAddress: string,
  success: boolean
): Promise<void> {
  const { error } = await supabase
    .from('login_attempts')
    .insert({
      ip_address: ipAddress,
      success: success
    });
  
  if (error) {
    console.error('Error recording login attempt:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    
    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);
    console.log('Login attempt from IP:', clientIP);

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(supabase, clientIP);
    if (!rateLimitCheck.allowed) {
      console.log('Rate limit exceeded for IP:', clientIP);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many failed attempts. Please try again later.',
          lockoutEndsAt: rateLimitCheck.lockoutEndsAt
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('app_config')
      .select('password_hash')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, data.password_hash);

    // Record the attempt
    await recordAttempt(supabase, clientIP, isValid);

    console.log('Password verification attempt:', isValid ? 'success' : 'failed', 'IP:', clientIP);

    if (!isValid) {
      const newRateLimitCheck = await checkRateLimit(supabase, clientIP);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Incorrect password',
          remainingAttempts: newRateLimitCheck.remainingAttempts
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
