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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get latest inventory snapshots with product details
    const { data, error } = await supabaseClient
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

    // Group by product and get latest snapshot for each
    const latestByProduct = new Map()
    
    data?.forEach(snapshot => {
      const productId = snapshot.products.id
      if (!latestByProduct.has(productId)) {
        latestByProduct.set(productId, {
          product_id: snapshot.products.id,
          sku: snapshot.products.sku,
          name: snapshot.products.name,
          stock_level: snapshot.stock_level,
          min_stock: snapshot.products.min_stock,
          last_updated: snapshot.taken_at,
          is_low_stock: snapshot.stock_level < snapshot.products.min_stock
        })
      }
    })

    // Convert to array and sort by stock level (ascending - lowest first)
    const inventory = Array.from(latestByProduct.values())
      .sort((a, b) => a.stock_level - b.stock_level)
      .slice(0, 20) // Top 20 lowest stock items

    return new Response(
      JSON.stringify({
        items: inventory,
        total_items: inventory.length,
        low_stock_count: inventory.filter(item => item.is_low_stock).length,
        generated_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})