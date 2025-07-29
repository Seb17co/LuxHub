import React, { useState, useEffect } from 'react'
import { supabase, type User } from '../lib/supabase'
import { 
  CogIcon, 
  CloudArrowUpIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

interface SpyAdminProps {
  user: User | null
}

interface SpyStatus {
  token_exists: boolean
  token_expires_at: string | null
  token_updated_at: string | null
  credentials_configured: boolean
  orders_count: number
  products_count: number
  recent_notifications: Array<{
    title: string
    body: string
    type: string
    created_at: string
  }>
}

export default function SpyAdmin({ user }: SpyAdminProps) {
  const [status, setStatus] = useState<SpyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<{ orders: boolean; inventory: boolean }>({ orders: false, inventory: false })
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    api_url: ''
  })
  const [credentialsLoading, setCredentialsLoading] = useState(false)

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only administrators can access SPY system settings.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'get_status' })
      })

      if (error) throw error
      if (data.success) {
        setStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching SPY status:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'refresh_token' })
      })

      if (error) throw error
      
      if (data.success) {
        await fetchStatus() // Refresh status
        alert('Token refreshed successfully!')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      alert('Failed to refresh token')
    }
  }

  const syncOrders = async (days: number = 7) => {
    setSyncing(prev => ({ ...prev, orders: true }))
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_orders', days })
      })

      if (error) throw error
      
      if (data.success) {
        await fetchStatus() // Refresh status
        alert(`Successfully synced ${data.synced_count} orders`)
      } else {
        alert(`Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing orders:', error)
      alert('Failed to sync orders')
    } finally {
      setSyncing(prev => ({ ...prev, orders: false }))
    }
  }

  const syncInventory = async () => {
    setSyncing(prev => ({ ...prev, inventory: true }))
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_inventory' })
      })

      if (error) throw error
      
      if (data.success) {
        await fetchStatus() // Refresh status
        alert(`Successfully synced ${data.synced_products} products and ${data.synced_snapshots} inventory snapshots`)
      } else {
        alert(`Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing inventory:', error)
      alert('Failed to sync inventory')
    } finally {
      setSyncing(prev => ({ ...prev, inventory: false }))
    }
  }

  const updateCredentials = async () => {
    if (!credentials.username || !credentials.password || !credentials.api_url) {
      alert('Please fill in all credential fields')
      return
    }

    setCredentialsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'update_credentials',
          username: credentials.username,
          password: credentials.password,
          api_url: credentials.api_url
        })
      })

      if (error) throw error
      
      if (data.success) {
        await fetchStatus() // Refresh status
        setCredentials({ username: '', password: '', api_url: '' })
        setShowCredentials(false)
        alert('Credentials updated successfully!')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating credentials:', error)
      alert('Failed to update credentials')
    } finally {
      setCredentialsLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('spy-admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'test_connection' })
      })

      if (error) throw error
      
      if (data.success) {
        alert('Connection test successful!')
      } else {
        alert(`Connection test failed: ${data.message}`)
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      alert('Failed to test connection')
    }
  }

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />
      default:
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-16 w-16"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <CogIcon className="w-8 h-8" />
          SPY System Administration
        </h1>
        <p className="page-subtitle">
          Manage SPY API integration, sync data, and monitor system status.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">API Token</p>
              <p className={`text-lg font-bold ${status?.token_exists ? 'text-green-600' : 'text-red-600'}`}>
                {status?.token_exists ? 'Active' : 'Missing'}
              </p>
            </div>
            {status?.token_exists ? (
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            ) : (
              <XCircleIcon className="w-8 h-8 text-red-500" />
            )}
          </div>
          {status?.token_expires_at && (
            <p className="text-xs text-gray-500 mt-2">
              Expires: {new Date(status.token_expires_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Credentials</p>
              <p className={`text-lg font-bold ${status?.credentials_configured ? 'text-green-600' : 'text-yellow-600'}`}>
                {status?.credentials_configured ? 'Configured' : 'Incomplete'}
              </p>
            </div>
            {status?.credentials_configured ? (
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
            )}
          </div>
        </div>

        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SPY Orders</p>
              <p className="text-lg font-bold text-blue-600">
                {status?.orders_count.toLocaleString() || 0}
              </p>
            </div>
            <CloudArrowUpIcon className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="card-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Products</p>
              <p className="text-lg font-bold text-purple-600">
                {status?.products_count.toLocaleString() || 0}
              </p>
            </div>
            <CloudArrowUpIcon className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-elevated">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={refreshToken}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh Token
          </button>

          <button
            onClick={() => syncOrders(7)}
            disabled={syncing.orders}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing.orders ? (
              <div className="loading-spinner w-4 h-4"></div>
            ) : (
              <CloudArrowUpIcon className="w-4 h-4" />
            )}
            Sync Orders (7d)
          </button>

          <button
            onClick={syncInventory}
            disabled={syncing.inventory}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing.inventory ? (
              <div className="loading-spinner w-4 h-4"></div>
            ) : (
              <CloudArrowUpIcon className="w-4 h-4" />
            )}
            Sync Inventory
          </button>

          <button
            onClick={testConnection}
            className="btn-ghost border border-gray-300 flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Test Connection
          </button>
        </div>
      </div>

      {/* Credentials Management */}
      <div className="card-elevated">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">API Credentials</h3>
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            className="btn-ghost flex items-center gap-2"
          >
            {showCredentials ? (
              <>
                <EyeSlashIcon className="w-4 h-4" />
                Hide
              </>
            ) : (
              <>
                <EyeIcon className="w-4 h-4" />
                Show
              </>
            )}
          </button>
        </div>

        {showCredentials && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="SPY username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="SPY password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API URL
              </label>
              <input
                type="url"
                value={credentials.api_url}
                onChange={(e) => setCredentials(prev => ({ ...prev, api_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://api.spysystem.com"
              />
            </div>

            <button
              onClick={updateCredentials}
              disabled={credentialsLoading}
              className="btn-primary disabled:opacity-50"
            >
              {credentialsLoading ? 'Updating...' : 'Update Credentials'}
            </button>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card-elevated">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Recent SPY Activity</h3>
        {status?.recent_notifications && status.recent_notifications.length > 0 ? (
          <div className="space-y-3">
            {status.recent_notifications.map((notification, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
              >
                {getStatusIcon(notification.type)}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{notification.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CloudArrowUpIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Recent Activity</h4>
            <p className="text-gray-600">SPY integration activities will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}