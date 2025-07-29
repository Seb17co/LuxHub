import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
    const topic = req.headers.get('x-shopify-topic')
    
    // Verify Shopify webhook signature
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')
    if (!webhookSecret || !hmacHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    const hash = createHmac('sha256', webhookSecret)
    hash.update(body)
    const calculatedHmac = hash.digest('base64')

    if (calculatedHmac !== hmacHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const orderData = JSON.parse(body)

    // Handle different webhook topics
    if (topic === 'orders/create' || topic === 'orders/updated') {
      const { data, error } = await supabaseClient
        .from('shopify_orders')
        .upsert({
          id: orderData.id,
          created_at: orderData.created_at,
          total_amount: parseFloat(orderData.total_price || '0'),
          status: orderData.fulfillment_status || 'pending',
          customer_email: orderData.customer?.email || null,
          json: orderData
        }, {
          onConflict: 'id'
        })

      if (error) throw error

      // Create notification for new orders
      if (topic === 'orders/create') {
        await supabaseClient
          .from('notifications')
          .insert({
            title: 'New Shopify Order',
            body: `Order #${orderData.order_number} for ${orderData.total_price} ${orderData.currency}`,
            type: 'info'
          })
      }

      return new Response(
        JSON.stringify({ success: true, order_id: orderData.id }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle other webhook topics as needed
    return new Response(
      JSON.stringify({ success: true, message: `Received ${topic} webhook` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})