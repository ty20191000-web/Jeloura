CREATE TABLE IF NOT EXISTS shipping_rates (
  governorate text PRIMARY KEY,
  price numeric(10,2) NOT NULL DEFAULT 50 CHECK (price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO shipping_rates(governorate,price) VALUES
('القاهرة',50),
('الجيزة',50),
('الإسكندرية',50),
('القليوبية',50),
('الدقهلية',50),
('الشرقية',50),
('الغربية',50),
('المنوفية',50),
('البحيرة',50),
('كفر الشيخ',50),
('دمياط',50),
('بورسعيد',50),
('الإسماعيلية',50),
('السويس',50),
('شمال سيناء',50),
('جنوب سيناء',50),
('بني سويف',50),
('الفيوم',50),
('المنيا',50),
('أسيوط',50),
('سوهاج',50),
('قنا',50),
('الأقصر',50),
('أسوان',50),
('البحر الأحمر',50),
('الوادي الجديد',50),
('مطروح',50)
ON CONFLICT (governorate) DO NOTHING;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS governorate text NOT NULL DEFAULT '';
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS total numeric(12,2) NOT NULL DEFAULT 0;
UPDATE store_orders SET total=subtotal+shipping_fee WHERE total=0;