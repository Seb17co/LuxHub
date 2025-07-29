import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id: string
  role: 'sales' | 'warehouse' | 'admin'
  email: string
  created_at: string
}

export interface Product {
  id: number
  sku: string
  name: string
  min_stock: number
  embedding?: number[]
  created_at: string
  updated_at: string
}

export interface InventorySnapshot {
  id: number
  product_id: number
  stock_level: number
  taken_at: string
  products: Product
}

export interface ShopifyOrder {
  id: number
  created_at: string
  total_amount: number
  status: string
  customer_email?: string
  json: any
}

export interface SpyOrder {
  id: number
  order_number: string
  created_at: string
  total_amount: number
  json: any
}

export interface Notification {
  id: number
  title: string
  body?: string
  type: 'info' | 'warning' | 'error' | 'success'
  created_at: string
  read_by: string[]
}