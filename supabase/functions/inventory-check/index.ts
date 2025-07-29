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

    // Get latest inventory snapshots with low stock
    const { data: lowStockItems, error } = await supabaseClient
      .from('inventory_snapshots')
      .select(`
        stock_level,
        taken_at,
        products (
          id,
          sku,
          name,
          min_stock
        )
      `)
      .order('taken_at', { ascending: false })

    if (error) throw error

    // Group by product and find items below minimum stock
    const latestByProduct = new Map()
    const lowStockProducts = []
    
    lowStockItems?.forEach(snapshot => {
      const productId = snapshot.products.id
      if (!latestByProduct.has(productId)) {
        latestByProduct.set(productId, true)
        
        if (snapshot.stock_level < snapshot.products.min_stock) {
          lowStockProducts.push({
            product_id: snapshot.products.id,
            sku: snapshot.products.sku,
            name: snapshot.products.name,
            stock_level: snapshot.stock_level,
            min_stock: snapshot.products.min_stock,
            deficit: snapshot.products.min_stock - snapshot.stock_level
          })
        }
      }
    })

    // Create notifications for low stock items
    if (lowStockProducts.length > 0) {
      const notifications = lowStockProducts.map(product => ({
        title: 'Low Stock Alert',
        body: `${product.name} (${product.sku}) is below minimum stock. Current: ${product.stock_level}, Min: ${product.min_stock}`,
        type: 'warning'
      }))

      const { error: notificationError } = await supabaseClient
        .from('notifications')
        .insert(notifications)

      if (notificationError) {
        console.error('Error creating notifications:', notificationError)
      }

      // Send to Supabase Realtime channel
      await supabaseClient.channel('notifications').send({
        type: 'broadcast',
        event: 'low_stock_alert',
        payload: {
          count: lowStockProducts.length,
          items: lowStockProducts,
          timestamp: new Date().toISOString()
        }
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        low_stock_count: lowStockProducts.length,
        items: lowStockProducts,
        checked_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Inventory check error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})