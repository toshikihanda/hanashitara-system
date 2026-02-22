-- 1. スタッフテーブル
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 業務報告テーブル
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  staff_name TEXT NOT NULL, -- UI表示用（非正規化）
  customer_phone TEXT NOT NULL,
  customer_nickname TEXT,
  total_sales INTEGER NOT NULL,
  staff_share INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. サービス明細テーブル（1通話で複数サービスを利用した場合）
CREATE TABLE report_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- listen, fortune, sexual
  minutes INTEGER NOT NULL,
  price INTEGER NOT NULL
);

-- 4. 顧客テーブル（前払い/デポジット管理・ブラックリスト照会用）
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  nickname TEXT,
  deposit_balance INTEGER DEFAULT 0, -- 前払い残高
  is_blacklisted BOOLEAN DEFAULT FALSE, -- ブラックリスト機能
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
