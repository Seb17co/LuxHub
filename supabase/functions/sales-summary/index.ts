// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
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

    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'day'
    
    if (!['day', 'week', 'month'].includes(period)) {
      return new Response(
        JSON.stringify({ error: 'Invalid period. Must be day, week, or month' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        const dayOfWeek = now.getDay()
        startDate = new Date(now.setDate(now.getDate() - dayOfWeek))
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0))
    }

    // Query Shopify orders
    const { data: shopifyOrders, error: shopifyError } = await supabaseClient
      .from('shopify_orders')
      .select('total_amount, created_at')
      .gte('created_at', startDate.toISOString())

    if (shopifyError) throw shopifyError

    // Query SpySystem orders
    const { data: spyOrders, error: spyError } = await supabaseClient
      .from('spy_orders')
      .select('total_amount, created_at')
      .gte('created_at', startDate.toISOString())

    if (spyError) throw spyError

    // Calculate totals
    const shopifyTotal = shopifyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
    const spyTotal = spyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
    
    const summary = {
      period,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      shopify: {
        total: shopifyTotal,
        orderCount: shopifyOrders?.length || 0
      },
      spy: {
        total: spyTotal,
        orderCount: spyOrders?.length || 0
      },
      combined: {
        total: shopifyTotal + spyTotal,
        orderCount: (shopifyOrders?.length || 0) + (spyOrders?.length || 0)
      }
    }

    return new Response(
      JSON.stringify(summary),
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

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/sales-summary' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
