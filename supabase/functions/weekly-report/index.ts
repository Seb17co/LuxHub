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

    // Calculate week dates
    const now = new Date()
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Get week number and year
    const weekNumber = getWeekNumber(weekStart)
    const year = weekStart.getFullYear()

    // Fetch sales data
    const { data: shopifyOrders } = await supabaseClient
      .from('shopify_orders')
      .select('total_amount, created_at, status')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())

    const { data: spyOrders } = await supabaseClient
      .from('spy_orders')
      .select('total_amount, created_at, order_number')
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())

    // Fetch inventory data
    const { data: lowStockItems } = await supabaseClient
      .from('inventory_snapshots')
      .select(`
        stock_level,
        taken_at,
        products (
          sku,
          name,
          min_stock
        )
      `)
      .order('taken_at', { ascending: false })

    // Process data
    const shopifyTotal = shopifyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
    const spyTotal = spyOrders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0
    
    // Get low stock items
    const latestByProduct = new Map()
    const lowStock = []
    
    lowStockItems?.forEach(snapshot => {
      const sku = snapshot.products.sku
      if (!latestByProduct.has(sku)) {
        latestByProduct.set(sku, true)
        if (snapshot.stock_level < snapshot.products.min_stock) {
          lowStock.push({
            sku: snapshot.products.sku,
            name: snapshot.products.name,
            stock: snapshot.stock_level,
            min_stock: snapshot.products.min_stock
          })
        }
      }
    })

    // Generate Markdown report
    const markdown = generateMarkdownReport({
      weekStart,
      weekEnd,
      weekNumber,
      year,
      shopifyOrders: shopifyOrders || [],
      spyOrders: spyOrders || [],
      shopifyTotal,
      spyTotal,
      lowStock
    })

    // Convert to HTML (simplified - in production you'd use a proper markdown parser)
    const html = markdownToHtml(markdown)

    // In a real implementation, you'd use a service like Puppeteer or similar to convert HTML to PDF
    // For now, we'll store the markdown and HTML
    const filename = `${year}-W${weekNumber.toString().padStart(2, '0')}.md`
    const htmlFilename = `${year}-W${weekNumber.toString().padStart(2, '0')}.html`

    // Store in Supabase Storage
    const { error: uploadError } = await supabaseClient.storage
      .from('reports')
      .upload(filename, markdown, {
        contentType: 'text/markdown',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { error: htmlUploadError } = await supabaseClient.storage
      .from('reports')
      .upload(htmlFilename, html, {
        contentType: 'text/html',
        upsert: true
      })

    if (htmlUploadError) throw htmlUploadError

    // Create notification
    await supabaseClient
      .from('notifications')
      .insert({
        title: 'Weekly Report Generated',
        body: `Week ${weekNumber} report for ${year} has been generated and is available in storage.`,
        type: 'success'
      })

    return new Response(
      JSON.stringify({
        success: true,
        report_week: `${year}-W${weekNumber}`,
        filename,
        htmlFilename,
        generated_at: new Date().toISOString(),
        summary: {
          total_sales: shopifyTotal + spyTotal,
          shopify_orders: shopifyOrders?.length || 0,
          spy_orders: spyOrders?.length || 0,
          low_stock_items: lowStock.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Weekly report error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function generateMarkdownReport(data: any): string {
  return `# LuxKids Weekly Report
## Week ${data.weekNumber}, ${data.year}
**Period:** ${data.weekStart.toDateString()} - ${data.weekEnd.toDateString()}

## Sales Summary
- **Total Sales:** ${(data.shopifyTotal + data.spyTotal).toFixed(2)} DKK
- **Shopify Orders:** ${data.shopifyOrders.length} orders (${data.shopifyTotal.toFixed(2)} DKK)
- **SpySystem Orders:** ${data.spyOrders.length} orders (${data.spyTotal.toFixed(2)} DKK)

## Inventory Alerts
${data.lowStock.length === 0 ? 'No low stock items this week.' : `
**${data.lowStock.length} items below minimum stock:**
${data.lowStock.map((item: any) => `- ${item.name} (${item.sku}): ${item.stock}/${item.min_stock}`).join('\n')}
`}

## Recent Orders
${data.shopifyOrders.slice(0, 10).map((order: any, i: number) => 
  `${i + 1}. ${order.total_amount} DKK - ${new Date(order.created_at).toLocaleDateString()}`
).join('\n')}

---
*Generated on ${new Date().toLocaleString()} by LuxKids AI Hub*`
}

function markdownToHtml(markdown: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>LuxKids Weekly Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; border-bottom: 2px solid #007acc; }
        h2 { color: #555; margin-top: 30px; }
        ul { padding-left: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    ${markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^\*\*(.*?)\*\*/gm, '<strong>$1</strong>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>')
    }
</body>
</html>`
}