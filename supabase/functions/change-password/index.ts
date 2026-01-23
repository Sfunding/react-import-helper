import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ITERATIONS = 100000;

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

// PBKDF2-based password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive key
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hash = toHex(new Uint8Array(derivedBits));
  const saltHex = toHex(salt);
  
  // Store in format: algorithm$iterations$salt$hash
  return `pbkdf2$${ITERATIONS}$${saltHex}$${hash}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentPassword, newPassword } = await req.json();
    
    // Validate current password is provided
    if (!currentPassword || typeof currentPassword !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Current password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate new password
    if (!newPassword || typeof newPassword !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'New password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, verify the current password
    const { data: configData, error: fetchError } = await supabase
      .from('app_config')
      .select('password_hash')
      .eq('id', 'main')
      .maybeSingle();

    if (fetchError || !configData) {
      console.error('Database error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify current password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify current password matches
    const isCurrentPasswordValid = await verifyPassword(currentPassword, configData.password_hash);
    
    if (!isCurrentPasswordValid) {
      console.log('Password change failed: incorrect current password');
      return new Response(
        JSON.stringify({ success: false, error: 'Current password is incorrect' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update with the hashed password
    const { error: updateError } = await supabase
      .from('app_config')
      .update({ password_hash: hashedPassword })
      .eq('id', 'main');

    if (updateError) {
      console.error('Database error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password changed successfully');

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
