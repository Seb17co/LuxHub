import { useState, useEffect } from 'react'
import { supabase, type User } from '../lib/supabase'
import { 
  CurrencyDollarIcon, 
  ShoppingCartIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon 
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface DashboardProps {
  user: User | null
}

interface SalesSummary {
  period: string
  shopify: { total: number; orderCount: number }
  spy: { total: number; orderCount: number }
  combined: { total: number; orderCount: number }
}

interface InventoryItem {
  sku: string
  name: string
  stock_level: number
  min_stock: number
  is_low_stock: boolean
}

export default function Dashboard({ user }: DashboardProps) {
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    fetchDashboardData()
  }, [selectedPeriod])

  const fetchDashboardData = async () => {
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

      // Fetch low stock items if user has warehouse or admin role
      if (user?.role === 'warehouse' || user?.role === 'admin') {
        const { data: inventoryData } = await supabase.functions.invoke('inventory-top20', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (inventoryData?.items) {
          setLowStockItems(inventoryData.items.filter((item: InventoryItem) => item.is_low_stock))
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    {
      name: 'Total Sales Today',
      value: salesSummary ? `${(salesSummary.combined.total).toLocaleString()} DKK` : '---',
      change: '+4.75%',
      changeType: 'positive',
      icon: CurrencyDollarIcon,
    },
    {
      name: 'Orders Today',
      value: salesSummary ? salesSummary.combined.orderCount.toString() : '---',
      change: '+2.1%',
      changeType: 'positive',
      icon: ShoppingCartIcon,
    },
    {
      name: 'Low Stock Items',
      value: lowStockItems.length.toString(),
      change: lowStockItems.length > 0 ? 'Action needed' : 'All good',
      changeType: lowStockItems.length > 0 ? 'negative' : 'positive',
      icon: ExclamationTriangleIcon,
    },
    {
      name: 'Shopify vs Spy',
      value: salesSummary ? `${((salesSummary.shopify.total / salesSummary.combined.total) * 100).toFixed(0)}% / ${((salesSummary.spy.total / salesSummary.combined.total) * 100).toFixed(0)}%` : '---',
      change: 'Split',
      changeType: 'neutral',
      icon: ChartBarIcon,
    },
  ]

  // Mock chart data - in production this would come from the API
  const salesChartData = [
    { name: 'Mon', shopify: 4000, spy: 2400 },
    { name: 'Tue', shopify: 3000, spy: 1398 },
    { name: 'Wed', shopify: 2000, spy: 9800 },
    { name: 'Thu', shopify: 2780, spy: 3908 },
    { name: 'Fri', shopify: 1890, spy: 4800 },
    { name: 'Sat', shopify: 2390, spy: 3800 },
    { name: 'Sun', shopify: 3490, spy: 4300 },
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.email}! Here's what's happening with LuxKids today.
        </p>
      </div>

      {/* Period selector */}
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((item) => (
          <div key={item.name} className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <item.icon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">{item.name}</dt>
                  <dd className="text-lg font-medium text-gray-900">{item.value}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-2">
              <div
                className={`text-sm ${
                  item.changeType === 'positive'
                    ? 'text-green-600'
                    : item.changeType === 'negative'
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                {item.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="shopify" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="spy" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center space-x-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Shopify</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">SpySystem</span>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {(user?.role === 'warehouse' || user?.role === 'admin') && (
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Low Stock Alerts</h3>
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">All Good!</h3>
                <p className="mt-1 text-sm text-gray-500">No items are currently below minimum stock levels.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">
                        {item.stock_level}/{item.min_stock}
                      </p>
                      <p className="text-xs text-gray-500">Stock/Min</p>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{lowStockItems.length - 5} more items need attention
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions for Sales/Admin users */}
        {(user?.role === 'sales' || user?.role === 'admin') && (
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="shopify" fill="#3b82f6" />
                  <Bar dataKey="spy" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}