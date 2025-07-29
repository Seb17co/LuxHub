import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpyProduct {
  id: string
  sku: string
  name: string
  stock_level: number
  brand?: string
  category?: string
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

    // Fetch inventory/variants from SPY API
    const inventoryResponse = await fetch(
      `${apiUrl}/variants/stock?detailed=true&limit=500`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!inventoryResponse.ok) {
      throw new Error(`SPY API error: ${inventoryResponse.status} ${inventoryResponse.statusText}`)
    }

    const inventoryData = await inventoryResponse.json()
    const products: SpyProduct[] = inventoryData.variants || inventoryData.data || []

    let syncedProducts = 0
    let syncedSnapshots = 0
    let errorCount = 0
    const errors: string[] = []

    // Sync products and inventory snapshots
    for (const product of products) {
      try {
        // First, upsert the product
        const { data: productResult, error: productError } = await serviceClient
          .from('products')
          .upsert({
            sku: product.sku,
            name: product.name,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'sku'
          })
          .select('id')
          .single()

        if (productError) {
          errorCount++
          errors.push(`Product ${product.sku}: ${productError.message}`)
          continue
        }

        syncedProducts++

        // Then create inventory snapshot
        const { error: snapshotError } = await serviceClient
          .from('inventory_snapshots')
          .insert({
            product_id: productResult.id,
            stock_level: product.stock_level,
            taken_at: new Date().toISOString()
          })

        if (snapshotError) {
          errorCount++
          errors.push(`Inventory ${product.sku}: ${snapshotError.message}`)
        } else {
          syncedSnapshots++
        }

      } catch (err) {
        errorCount++
        errors.push(`Product ${product.sku}: ${err.message}`)
      }
    }

    // Create notification about sync result
    await serviceClient
      .from('notifications')
      .insert({
        title: 'SPY Inventory Sync Complete',
        body: `Updated ${syncedProducts} products, ${syncedSnapshots} inventory snapshots${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
        type: errorCount > 0 ? 'warning' : 'success'
      })

    return new Response(
      JSON.stringify({
        success: true,
        synced_products: syncedProducts,
        synced_snapshots: syncedSnapshots,
        error_count: errorCount,
        errors: errors.slice(0, 10), // Limit error details
        updated_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('SPY inventory sync error:', error)
    
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