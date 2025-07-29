-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table with roles
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text CHECK (role IN ('sales','warehouse','admin')),
  email text,
  created_at timestamptz DEFAULT now()
);

-- Products table with embeddings for AI
CREATE TABLE products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  min_stock int DEFAULT 0,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory snapshots for tracking stock levels
CREATE TABLE inventory_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint REFERENCES products(id),
  stock_level int NOT NULL,
  taken_at timestamptz DEFAULT now()
);

-- Shopify orders
CREATE TABLE shopify_orders (
  id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL,
  total_amount numeric,
  status text,
  customer_email text,
  json jsonb
);

-- SpySystem orders/data
CREATE TABLE spy_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number text UNIQUE,
  created_at timestamptz,
  total_amount numeric,
  json jsonb
);

-- Notifications system
CREATE TABLE notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  body text,
  type text DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  created_at timestamptz DEFAULT now(),
  read_by uuid[] DEFAULT '{}'
);

-- Secrets table for API tokens
CREATE TABLE secrets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_inventory_snapshots_product_id ON inventory_snapshots(product_id);
CREATE INDEX idx_inventory_snapshots_taken_at ON inventory_snapshots(taken_at);
CREATE INDEX idx_shopify_orders_created_at ON shopify_orders(created_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE spy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see users from same email domain
CREATE POLICY "Users can view same domain users" ON users
  FOR SELECT USING (
    CASE 
      WHEN auth.jwt() ->> 'email' IS NULL THEN false
      ELSE split_part(email, '@', 2) = split_part(auth.jwt() ->> 'email', '@', 2)
    END
  );

-- Products are readable by authenticated users
CREATE POLICY "Products are readable by authenticated users" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

-- Inventory access based on role
CREATE POLICY "Inventory access by role" ON inventory_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role IN ('warehouse', 'admin'))
    )
  );

-- Sales data access based on role
CREATE POLICY "Sales access by role" ON shopify_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role IN ('sales', 'admin'))
    )
  );

CREATE POLICY "Spy orders access by role" ON spy_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role IN ('sales', 'admin'))
    )
  );

-- Notifications are readable by all authenticated users
CREATE POLICY "Notifications readable by authenticated users" ON notifications
  FOR SELECT USING (auth.role() = 'authenticated');

-- Secrets only accessible by system/admin
CREATE POLICY "Secrets admin only" ON secrets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );