ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz;
CREATE TABLE IF NOT EXISTS store_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_name text NOT NULL,
 rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL,
 product_id text REFERENCES products(id) ON DELETE SET NULL,
 published boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_reviews_created_idx ON store_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_created_idx ON store_orders(created_at DESC);