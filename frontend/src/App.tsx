import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, type User } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import SalesView from './components/SalesView'
import InventoryView from './components/InventoryView'
import AIChat from './components/AIChat'
import SpyAdmin from './components/SpyAdmin'
import Layout from './components/Layout'
import './index.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      // First check if user exists in our users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error)
        return
      }

      if (data) {
        setUser(data)
      } else {
        // User doesn't exist in our users table yet, create a basic profile
        // This happens when a user logs in for the first time
        const session = await supabase.auth.getSession()
        if (session.data.session?.user?.email) {
          console.log('Creating new user profile for:', session.data.session.user.email)
          // For now, we'll just set a basic user object without inserting to DB
          // In production, you'd want to create the user record
          setUser({
            id: userId,
            email: session.data.session.user.email,
            role: 'sales', // default role
            created_at: new Date().toISOString()
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      // Don't prevent login if user profile fetch fails
      const session = await supabase.auth.getSession()
      if (session.data.session?.user?.email) {
        setUser({
          id: userId,
          email: session.data.session.user.email,
          role: 'sales', // default role
          created_at: new Date().toISOString()
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route 
            path="/sales" 
            element={
              user?.role === 'sales' || user?.role === 'admin' ? (
                <SalesView user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/inventory" 
            element={
              user?.role === 'warehouse' || user?.role === 'admin' ? (
                <InventoryView user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route path="/ai" element={<AIChat user={user} />} />
          <Route 
            path="/admin/spy" 
            element={
              user?.role === 'admin' ? (
                <SpyAdmin user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
