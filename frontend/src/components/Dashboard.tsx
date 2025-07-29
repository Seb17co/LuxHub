import { useState, useEffect } from 'react'
import { supabase, type User } from '../lib/supabase'
import { 
  CurrencyDollarIcon, 
  ShoppingCartIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  EyeIcon
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

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const stats = [
    {
      name: 'Total Sales Today',
      value: salesSummary ? `${(salesSummary.combined.total).toLocaleString()} DKK` : '---',
      change: '+4.75%',
      changeType: 'positive' as const,
      icon: CurrencyDollarIcon,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Orders Today',
      value: salesSummary ? salesSummary.combined.orderCount.toString() : '---',
      change: '+2.1%',
      changeType: 'positive' as const,
      icon: ShoppingCartIcon,
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      name: 'Low Stock Items',
      value: lowStockItems.length.toString(),
      change: lowStockItems.length > 0 ? 'Action needed' : 'All good',
      changeType: lowStockItems.length > 0 ? 'negative' as const : 'positive' as const,
      icon: ExclamationTriangleIcon,
      gradient: 'from-orange-500 to-red-500'
    },
    {
      name: 'Performance',
      value: salesSummary ? `${((salesSummary.shopify.total / salesSummary.combined.total) * 100).toFixed(0)}%` : '---',
      change: 'Shopify lead',
      changeType: 'neutral' as const,
      icon: ChartBarIcon,
      gradient: 'from-purple-500 to-indigo-500'
    },
  ]

  // Enhanced chart data with more realistic patterns
  const salesChartData = [
    { name: 'Mon', shopify: 4200, spy: 2100, total: 6300 },
    { name: 'Tue', shopify: 3800, spy: 1800, total: 5600 },
    { name: 'Wed', shopify: 5200, spy: 2800, total: 8000 },
    { name: 'Thu', shopify: 4600, spy: 2400, total: 7000 },
    { name: 'Fri', shopify: 6200, spy: 3200, total: 9400 },
    { name: 'Sat', shopify: 7800, spy: 4100, total: 11900 },
    { name: 'Sun', shopify: 5400, spy: 2900, total: 8300 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-16 w-16"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="page-header">
        <h1 className="page-title">
          {getGreeting()}, {user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="page-subtitle">
          Here's what's happening with LuxKids today. Your dashboard is updated in real-time.
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Viewing:</span>
        </div>
        <div className="flex bg-white rounded-xl p-1 shadow-soft border border-gray-200">
          {[
            { key: 'day', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key as 'day' | 'week' | 'month')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                selectedPeriod === period.key
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-medium'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((item, index) => (
          <div key={item.name} className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                item.changeType === 'positive' 
                  ? 'bg-green-100 text-green-800'
                  : item.changeType === 'negative'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {item.changeType === 'positive' && <TrendingUpIcon className="w-3 h-3" />}
                {item.changeType === 'negative' && <TrendingDownIcon className="w-3 h-3" />}
                {item.change}
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="stat-label">{item.name}</h3>
              <p className="stat-value">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="xl:col-span-2 card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Sales Performance</h3>
              <p className="text-sm text-gray-600 mt-1">Track your sales across both platforms</p>
            </div>
            <button className="btn-ghost text-blue-600 hover:text-blue-700">
              View Details
              <ArrowRightIcon className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="shopify" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spy" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center items-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-600">Shopify</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-600">SpySystem</span>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Inventory Status</h3>
              <p className="text-sm text-gray-600 mt-1">Items requiring attention</p>
            </div>
            {lowStockItems.length > 0 && (
              <span className="badge badge-error">
                {lowStockItems.length} alerts
              </span>
            )}
          </div>
          
          {(user?.role === 'warehouse' || user?.role === 'admin') ? (
            lowStockItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExclamationTriangleIcon className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">All Stock Levels Good!</h4>
                <p className="text-sm text-gray-600">No items are currently below minimum stock levels.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 6).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-red-600">{item.stock_level}</span>
                        <span className="text-sm text-gray-400">/</span>
                        <span className="text-sm text-gray-600">{item.min_stock}</span>
                      </div>
                      <p className="text-xs text-gray-500">Current / Min</p>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 6 && (
                  <div className="text-center pt-3">
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      View {lowStockItems.length - 6} more items →
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h4>
              <p className="text-sm text-gray-600">Inventory data is only available to warehouse and admin users.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sales Breakdown Chart */}
      {(user?.role === 'sales' || user?.role === 'admin') && (
        <div className="card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Platform Comparison</h3>
              <p className="text-sm text-gray-600 mt-1">Daily sales breakdown by platform</p>
            </div>
            <button className="btn-secondary">
              Export Data
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="shopify" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spy" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}