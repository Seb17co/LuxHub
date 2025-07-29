import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpyOrder {
  id: string
  order_number: string
  created_at: string
  total_amount: number
  customer_email?: string
  status: string
  items?: any[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // Get SPY API credentials using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: secrets } = await serviceClient
      .from('secrets')
      .select('key, value, expires_at')
      .in('key', ['SPY_TOKEN', 'SPY_API_URL'])

    const secretMap = new Map(secrets?.map(s => [s.key, s.value]))
    const token = secretMap.get('SPY_TOKEN')
    const apiUrl = secretMap.get('SPY_API_URL')

    if (!token || !apiUrl) {
      return new Response(
        JSON.stringify({ error: 'SPY API credentials not found. Please refresh login first.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if token is still valid
    const tokenSecret = secrets?.find(s => s.key === 'SPY_TOKEN')
    if (tokenSecret?.expires_at && new Date(tokenSecret.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'SPY token expired. Please refresh login first.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { days = 7 } = await req.json().catch(() => ({}))

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch orders from SPY API
    const ordersResponse = await fetch(
      `${apiUrl}/orders?from=${startDate.toISOString().split('T')[0]}&to=${endDate.toISOString().split('T')[0]}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!ordersResponse.ok) {
      throw new Error(`SPY API error: ${ordersResponse.status} ${ordersResponse.statusText}`)
    }

    const ordersData = await ordersResponse.json()
    const orders: SpyOrder[] = ordersData.orders || ordersData.data || []

    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Sync each order to database
    for (const order of orders) {
      try {
        const { error } = await serviceClient
          .from('spy_orders')
          .upsert({
            order_number: order.order_number,
            created_at: order.created_at,
            total_amount: order.total_amount,
            json: order
          }, {
            onConflict: 'order_number'
          })

        if (error) {
          errorCount++
          errors.push(`Order ${order.order_number}: ${error.message}`)
        } else {
          syncedCount++
        }
      } catch (err) {
        errorCount++
        errors.push(`Order ${order.order_number}: ${err.message}`)
      }
    }

    // Create notification about sync result
    await serviceClient
      .from('notifications')
      .insert({
        title: 'SPY Orders Sync Complete',
        body: `Synced ${syncedCount} orders${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
        type: errorCount > 0 ? 'warning' : 'success'
      })

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        error_count: errorCount,
        errors: errors.slice(0, 10), // Limit error details
        date_range: {
          from: startDate.toISOString(),
          to: endDate.toISOString()
        },
        updated_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('SPY orders sync error:', error)
    
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