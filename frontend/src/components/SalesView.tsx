import { useState, useEffect } from 'react'
import { supabase, type User, type ShopifyOrder, type SpyOrder } from '../lib/supabase'
import { 
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface SalesViewProps {
  user: User | null
}

interface SalesSummary {
  period: string
  shopify: { total: number; orderCount: number }
  spy: { total: number; orderCount: number }
  combined: { total: number; orderCount: number }
}

export default function SalesView({ user: _user }: SalesViewProps) {
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([])
  const [spyOrders, setSpyOrders] = useState<SpyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    fetchSalesData()
  }, [selectedPeriod])

  const fetchSalesData = async () => {
    setLoading(true)
    try {
      // Fetch sales summary
      const { data: salesData } = await supabase.functions.invoke('sales-summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (salesData) {
        setSalesSummary(salesData)
      }

      // Fetch recent orders
      const startDate = new Date()
      if (selectedPeriod === 'week') {
        startDate.setDate(startDate.getDate() - 7)
      } else if (selectedPeriod === 'month') {
        startDate.setMonth(startDate.getMonth() - 1)
      } else {
        startDate.setHours(0, 0, 0, 0)
      }

      // Fetch Shopify orders
      const { data: shopifyData } = await supabase
        .from('shopify_orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (shopifyData) {
        setShopifyOrders(shopifyData)
      }

      // Fetch SpySystem orders
      const { data: spyData } = await supabase
        .from('spy_orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (spyData) {
        setSpyOrders(spyData)
      }

    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const pieData = salesSummary ? [
    { name: 'Shopify', value: salesSummary.shopify.total, color: '#3b82f6' },
    { name: 'SpySystem', value: salesSummary.spy.total, color: '#10b981' },
  ] : []

  // Mock trend data
  const trendData = [
    { name: 'Week 1', shopify: 45000, spy: 32000 },
    { name: 'Week 2', shopify: 52000, spy: 28000 },
    { name: 'Week 3', shopify: 48000, spy: 35000 },
    { name: 'Week 4', shopify: 61000, spy: 42000 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Track and analyze sales performance across all channels.
        </p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="sm:hidden">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month')}
            className="block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <nav className="flex space-x-8">
            {[
              { key: 'day', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
            ].map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key as 'day' | 'week' | 'month')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedPeriod === period.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {period.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {salesSummary ? `${salesSummary.combined.total.toLocaleString()} DKK` : '---'}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingCartIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {salesSummary ? salesSummary.combined.orderCount : '---'}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowTrendingUpIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Avg Order Value</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {salesSummary && salesSummary.combined.orderCount > 0 
                    ? `${Math.round(salesSummary.combined.total / salesSummary.combined.orderCount).toLocaleString()} DKK`
                    : '---'
                  }
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Period</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {selectedPeriod === 'day' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Revenue Breakdown */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue by Platform</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} DKK`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center space-x-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Shopify: {salesSummary?.shopify.total.toLocaleString()} DKK</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">SpySystem: {salesSummary?.spy.total.toLocaleString()} DKK</span>
            </div>
          </div>
        </div>

        {/* Sales Trend */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} DKK`} />
                <Line type="monotone" dataKey="shopify" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="spy" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...shopifyOrders.slice(0, 10), ...spyOrders.slice(0, 10)]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 10)
                .map((order, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {'order_number' in order ? order.order_number : order.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      'order_number' in order ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {'order_number' in order ? 'SpySystem' : 'Shopify'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.total_amount?.toLocaleString()} DKK
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {'customer_email' in order ? order.customer_email || 'N/A' : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {'status' in order ? order.status : 'Completed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}