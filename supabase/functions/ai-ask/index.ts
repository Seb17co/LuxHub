import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FunctionCall {
  name: string
  arguments: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    // Define available functions for OpenAI
    const functions = [
      {
        name: "getSales",
        description: "Get sales data for a specific period",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["day", "week", "month"],
              description: "Time period for sales data"
            }
          },
          required: ["period"]
        }
      },
      {
        name: "getInventory", 
        description: "Get inventory information for specific products or all products",
        parameters: {
          type: "object",
          properties: {
            product_sku: {
              type: "string",
              description: "Optional SKU to filter specific product"
            },
            low_stock_only: {
              type: "boolean",
              description: "Whether to return only low stock items"
            }
          }
        }
      }
    ]

    // Function implementations
    const getSales = async (period: string) => {
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

      const { data: shopifyOrders } = await supabaseClient
        .from('shopify_orders')
        .select('total_amount, created_at, customer_email')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      const { data: spyOrders } = await supabaseClient
        .from('spy_orders')
        .select('total_amount, created_at, order_number')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      return {
        period,
        shopify_orders: shopifyOrders || [],
        spy_orders: spyOrders || [],
        total_shopify: shopifyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0,
        total_spy: spyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
      }
    }

    const getInventory = async (product_sku?: string, low_stock_only?: boolean) => {
      let query = supabaseClient
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

      if (product_sku) {
        query = query.eq('products.sku', product_sku)
      }

      const { data } = await query

      // Group by product and get latest snapshot
      const latestByProduct = new Map()
      
      data?.forEach(snapshot => {
        const productId = snapshot.products.id
        if (!latestByProduct.has(productId)) {
          const item = {
            product_id: snapshot.products.id,
            sku: snapshot.products.sku,
            name: snapshot.products.name,
            stock_level: snapshot.stock_level,
            min_stock: snapshot.products.min_stock,
            last_updated: snapshot.taken_at,
            is_low_stock: snapshot.stock_level < snapshot.products.min_stock
          }
          
          if (!low_stock_only || item.is_low_stock) {
            latestByProduct.set(productId, item)
          }
        }
      })

      return Array.from(latestByProduct.values())
    }

    // Make initial OpenAI call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for LuxKids, a children's retail company. You can help with sales data and inventory management. Always provide clear, actionable insights."
        },
        {
          role: "user", 
          content: query
        }
      ],
      functions,
      function_call: "auto"
    })

    const message = completion.choices[0]?.message

    // Handle function calls
    if (message?.function_call) {
      const functionCall = message.function_call as FunctionCall
      let functionResult

      try {
        const args = JSON.parse(functionCall.arguments)
        
        if (functionCall.name === 'getSales') {
          functionResult = await getSales(args.period)
        } else if (functionCall.name === 'getInventory') {
          functionResult = await getInventory(args.product_sku, args.low_stock_only)
        }

        // Make second OpenAI call with function result
        const secondCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant for LuxKids, a children's retail company. Provide clear, actionable insights based on the data."
            },
            {
              role: "user",
              content: query
            },
            {
              role: "assistant",
              content: null,
              function_call: functionCall
            },
            {
              role: "function",
              name: functionCall.name,
              content: JSON.stringify(functionResult)
            }
          ]
        })

        return new Response(
          JSON.stringify({
            answer: secondCompletion.choices[0]?.message?.content,
            citations: [
              {
                source: functionCall.name,
                data: functionResult
              }
            ]
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      } catch (error) {
        return new Response(
          JSON.stringify({ error: `Function execution error: ${error.message}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Return direct response if no function call
    return new Response(
      JSON.stringify({
        answer: message?.content,
        citations: []
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