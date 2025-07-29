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
    const { action, ...params } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Check if user is admin
    const { data: user } = await supabaseClient.auth.getUser()
    if (!user?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { data: userProfile } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'get_status':
        // Get current SPY integration status
        const { data: secrets } = await serviceClient
          .from('secrets')
          .select('key, expires_at, updated_at')
          .in('key', ['SPY_TOKEN', 'SPY_USERNAME', 'SPY_PASSWORD', 'SPY_API_URL'])

        const secretMap = new Map(secrets?.map(s => [s.key, { expires_at: s.expires_at, updated_at: s.updated_at }]))
        
        // Get recent sync notifications
        const { data: notifications } = await serviceClient
          .from('notifications')
          .select('title, body, type, created_at')
          .like('title', '%SPY%')
          .order('created_at', { ascending: false })
          .limit(10)

        // Get data counts
        const { count: ordersCount } = await serviceClient
          .from('spy_orders')
          .select('*', { count: 'exact', head: true })

        const { count: productsCount } = await serviceClient
          .from('products')
          .select('*', { count: 'exact', head: true })

        return new Response(
          JSON.stringify({
            success: true,
            status: {
              token_exists: secretMap.has('SPY_TOKEN'),
              token_expires_at: secretMap.get('SPY_TOKEN')?.expires_at,
              token_updated_at: secretMap.get('SPY_TOKEN')?.updated_at,
              credentials_configured: secretMap.has('SPY_USERNAME') && secretMap.has('SPY_PASSWORD') && secretMap.has('SPY_API_URL'),
              orders_count: ordersCount || 0,
              products_count: productsCount || 0,
              recent_notifications: notifications || []
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'refresh_token':
        // Trigger token refresh
        const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/spy-login-refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          }
        })

        const refreshResult = await refreshResponse.json()
        return new Response(JSON.stringify(refreshResult), { 
          status: refreshResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })

      case 'sync_orders':
        // Trigger orders sync
        const orderSyncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/spy-sync-orders`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ days: params.days || 7 })
        })

        const orderSyncResult = await orderSyncResponse.json()
        return new Response(JSON.stringify(orderSyncResult), { 
          status: orderSyncResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })

      case 'sync_inventory':
        // Trigger inventory sync
        const inventorySyncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/spy-sync-inventory`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'Content-Type': 'application/json'
          }
        })

        const inventorySyncResult = await inventorySyncResponse.json()
        return new Response(JSON.stringify(inventorySyncResult), { 
          status: inventorySyncResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })

      case 'update_credentials':
        // Update SPY API credentials
        const { username, password, api_url } = params
        
        if (!username || !password || !api_url) {
          return new Response(
            JSON.stringify({ error: 'username, password, and api_url are required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const credentialUpdates = [
          { key: 'SPY_USERNAME', value: username },
          { key: 'SPY_PASSWORD', value: password },
          { key: 'SPY_API_URL', value: api_url }
        ]

        for (const cred of credentialUpdates) {
          await serviceClient
            .from('secrets')
            .upsert({
              key: cred.key,
              value: cred.value,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'key'
            })
        }

        // Create notification
        await serviceClient
          .from('notifications')
          .insert({
            title: 'SPY Credentials Updated',
            body: 'SPY API credentials have been updated successfully',
            type: 'success'
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Credentials updated successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'test_connection':
        // Test SPY API connection
        const { data: testSecrets } = await serviceClient
          .from('secrets')
          .select('key, value')
          .in('key', ['SPY_TOKEN', 'SPY_API_URL'])

        const testSecretMap = new Map(testSecrets?.map(s => [s.key, s.value]))
        const testToken = testSecretMap.get('SPY_TOKEN')
        const testApiUrl = testSecretMap.get('SPY_API_URL')

        if (!testToken || !testApiUrl) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'SPY credentials not found. Please refresh login first.' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const testResponse = await fetch(`${testApiUrl}/products?limit=1`, {
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json',
          }
        })

        return new Response(
          JSON.stringify({
            success: testResponse.ok,
            status_code: testResponse.status,
            message: testResponse.ok ? 'Connection successful' : `Connection failed: ${testResponse.status} ${testResponse.statusText}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported actions: get_status, refresh_token, sync_orders, sync_inventory, update_credentials, test_connection' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('SPY admin management error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})