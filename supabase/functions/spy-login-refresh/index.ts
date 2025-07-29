import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get SpySystem credentials from secrets table
    const { data: credentials, error: credError } = await supabaseClient
      .from('secrets')
      .select('key, value')
      .in('key', ['SPY_USERNAME', 'SPY_PASSWORD', 'SPY_API_URL'])

    if (credError) throw credError

    const credMap = new Map(credentials?.map(c => [c.key, c.value]))
    const username = credMap.get('SPY_USERNAME')
    const password = credMap.get('SPY_PASSWORD')
    const apiUrl = credMap.get('SPY_API_URL')

    if (!username || !password || !apiUrl) {
      throw new Error('Missing SpySystem credentials')
    }

    // Authenticate with SpySystem
    const loginResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password
      })
    })

    if (!loginResponse.ok) {
      throw new Error(`SpySystem login failed: ${loginResponse.status}`)
    }

    const loginData = await loginResponse.json()
    const token = loginData.token || loginData.access_token

    if (!token) {
      throw new Error('No token received from SpySystem')
    }

    // Calculate expiration (typically tokens expire in 1 hour)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Store/update the token in secrets table
    const { error: updateError } = await supabaseClient
      .from('secrets')
      .upsert({
        key: 'SPY_TOKEN',
        value: token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (updateError) throw updateError

    // Test the token by making a simple API call
    const testResponse = await fetch(`${apiUrl}/products?limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })

    const isValid = testResponse.ok

    return new Response(
      JSON.stringify({
        success: true,
        token_refreshed: true,
        expires_at: expiresAt.toISOString(),
        token_valid: isValid,
        updated_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('SpySystem login refresh error:', error)
    
    // Create error notification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('notifications')
      .insert({
        title: 'SpySystem Login Failed',
        body: `Failed to refresh SpySystem token: ${error.message}`,
        type: 'error'
      })

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        updated_at: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})