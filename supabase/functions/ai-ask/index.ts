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
        description: "Get sales data for a specific period from both Shopify and SPY systems",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["day", "week", "month"],
              description: "Time period for sales data"
            },
            system: {
              type: "string",
              enum: ["shopify", "spy", "both"],
              description: "Which system to get data from (default: both)"
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
      },
      {
        name: "getOrderStatus",
        description: "Get status and details of specific orders from SPY system",
        parameters: {
          type: "object",
          properties: {
            order_number: {
              type: "string",
              description: "SPY order number to look up"
            },
            customer_email: {
              type: "string",
              description: "Customer email to find their orders"
            }
          }
        }
      },
      {
        name: "getProductSearch",
        description: "Search for products by name, SKU, or other criteria",
        parameters: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "Search term for product name or SKU"
            },
            include_stock: {
              type: "boolean",
              description: "Whether to include current stock levels"
            }
          },
          required: ["search_term"]
        }
      }
    ]

    // Function implementations
    const getSales = async (period: string, system: string = 'both') => {
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

      const result: any = { period, system }

      if (system === 'shopify' || system === 'both') {
        const { data: shopifyOrders } = await supabaseClient
          .from('shopify_orders')
          .select('total_amount, created_at, customer_email, status')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })

        result.shopify_orders = shopifyOrders || []
        result.total_shopify = shopifyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
        result.shopify_count = shopifyOrders?.length || 0
      }

      if (system === 'spy' || system === 'both') {
        const { data: spyOrders } = await supabaseClient
          .from('spy_orders')
          .select('total_amount, created_at, order_number, json')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })

        result.spy_orders = spyOrders || []
        result.total_spy = spyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
        result.spy_count = spyOrders?.length || 0
      }

      if (system === 'both') {
        result.total_combined = (result.total_shopify || 0) + (result.total_spy || 0)
        result.orders_combined = (result.shopify_count || 0) + (result.spy_count || 0)
      }

      return result
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

    const getOrderStatus = async (order_number?: string, customer_email?: string) => {
      let query = supabaseClient.from('spy_orders').select('*')

      if (order_number) {
        query = query.eq('order_number', order_number)
      } else if (customer_email) {
        // Search in JSON field for customer email
        query = query.or(`json->>customer_email.eq.${customer_email}`)
      } else {
        return { error: 'Either order_number or customer_email is required' }
      }

      const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(10)

      if (error) {
        return { error: error.message }
      }

      return {
        orders: orders?.map(order => ({
          order_number: order.order_number,
          created_at: order.created_at,
          total_amount: order.total_amount,
          status: order.json?.status || 'unknown',
          customer_email: order.json?.customer_email,
          items_count: order.json?.items?.length || 0
        })) || []
      }
    }

    const getProductSearch = async (search_term: string, include_stock?: boolean) => {
      const { data: products, error } = await supabaseClient
        .from('products')
        .select(`
          id,
          sku,
          name,
          min_stock,
          created_at,
          updated_at
        `)
        .or(`sku.ilike.%${search_term}%,name.ilike.%${search_term}%`)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) {
        return { error: error.message }
      }

      const result = products || []

      if (include_stock && result.length > 0) {
        // Get latest stock levels for these products
        const productIds = result.map(p => p.id)
        const { data: snapshots } = await supabaseClient
          .from('inventory_snapshots')
          .select('product_id, stock_level, taken_at')
          .in('product_id', productIds)
          .order('taken_at', { ascending: false })

        // Group by product_id and get latest
        const latestStock = new Map()
        snapshots?.forEach(snapshot => {
          if (!latestStock.has(snapshot.product_id)) {
            latestStock.set(snapshot.product_id, {
              stock_level: snapshot.stock_level,
              last_updated: snapshot.taken_at
            })
          }
        })

        // Add stock info to products
        result.forEach(product => {
          const stock = latestStock.get(product.id)
          product.current_stock = stock?.stock_level || 0
          product.stock_last_updated = stock?.last_updated
          product.is_low_stock = (stock?.stock_level || 0) < (product.min_stock || 0)
        })
      }

      return { products: result, search_term }
    }

    // Make initial OpenAI call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant for LuxKids, a children's retail company. You have access to data from both Shopify and SPY systems. You can help with:
          - Sales analysis from both platforms
          - Inventory management and stock levels
          - Order tracking and customer service
          - Product search and information
          
          Always provide clear, actionable insights and mention which system the data comes from when relevant. If asked about recent performance, focus on practical business metrics like revenue, order counts, and stock alerts.`
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
          functionResult = await getSales(args.period, args.system)
        } else if (functionCall.name === 'getInventory') {
          functionResult = await getInventory(args.product_sku, args.low_stock_only)
        } else if (functionCall.name === 'getOrderStatus') {
          functionResult = await getOrderStatus(args.order_number, args.customer_email)
        } else if (functionCall.name === 'getProductSearch') {
          functionResult = await getProductSearch(args.search_term, args.include_stock)
        }

        // Make second OpenAI call with function result
        const secondCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant for LuxKids, a children's retail company. Provide clear, actionable insights based on the data. Include specific numbers and recommendations when possible."
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