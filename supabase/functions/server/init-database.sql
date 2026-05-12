-- Create kv_store table for key-value storage
CREATE TABLE IF NOT EXISTS kv_store_a67f0635 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  old_price NUMERIC(10, 2),
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_method TEXT NOT NULL DEFAULT 'cod',
  shipping_address JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for products
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (status = 'active' OR auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can insert products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can update products"
  ON products FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can delete products"
  ON products FOR DELETE
  USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  ));

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin')
  );

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update orders"
  ON orders FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  ));

-- Insert sample products
INSERT INTO products (name, category, price, old_price, stock, status, image_url, description) VALUES
('English to Foreign Language Translation', 'Translation', 500.00, 600.00, 999, 'active', 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=400&fit=crop', 'Professional translation from English to any foreign language'),
('Foreign Language to English Translation', 'Translation', 500.00, 600.00, 999, 'active', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop', 'Professional translation from foreign languages to English'),
('Any Indian Language to English', 'Translation', 400.00, 500.00, 999, 'active', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&h=400&fit=crop', 'Translation from any Indian language to English'),
('English to Any Indian Language', 'Translation', 400.00, 500.00, 999, 'active', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop', 'Translation from English to any Indian language'),
('Saudi Arabia Apostille', 'Apostille', 2500.00, 3000.00, 999, 'active', 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&h=400&fit=crop', 'Document apostille services for Saudi Arabia'),
('Italy Apostille', 'Apostille', 2500.00, 3000.00, 999, 'active', 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=400&fit=crop', 'Document apostille services for Italy'),
('Germany Apostille', 'Apostille', 2500.00, 3000.00, 999, 'active', 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400&h=400&fit=crop', 'Document apostille services for Germany'),
('UAE Attestation', 'Attestation', 3000.00, 3500.00, 999, 'active', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=400&fit=crop', 'Document attestation services for UAE'),
('Qatar Attestation', 'Attestation', 3000.00, 3500.00, 999, 'active', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=400&fit=crop', 'Document attestation services for Qatar'),
('Kuwait Attestation', 'Attestation', 3000.00, 3500.00, 999, 'active', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=400&fit=crop', 'Document attestation services for Kuwait'),
('Basic Startup Package', 'Startup Package', 15000.00, 18000.00, 50, 'active', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop', 'Essential startup documentation and translation services'),
('Standard Startup Package', 'Startup Package', 25000.00, 30000.00, 50, 'active', 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=400&fit=crop', 'Comprehensive startup documentation and attestation services'),
('Premium Startup Package', 'Startup Package', 40000.00, 50000.00, 50, 'active', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=400&fit=crop', 'Complete startup solution with all services included')
ON CONFLICT DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
