PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  interested_language TEXT,
  ip_address TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referrer_id INTEGER,
  bonus_spins_available INTEGER DEFAULT 0,
  bonus_spins_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(referrer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  probability REAL NOT NULL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prize_id INTEGER,
  prize_title TEXT,
  prize_description TEXT,
  prize_image_url TEXT,
  spin_number INTEGER NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

INSERT INTO prizes (title, description, image_url, probability)
SELECT title, description, image_url, probability
FROM (
  SELECT
    '3 Ay Ücretsiz Konuşma Kulübü' AS title,
    'Amerikan Dil Kursu konuşma kulübünde 12 hafta ücretsiz katılım hakkı.' AS description,
    'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=400&q=60' AS image_url,
    3 AS probability
  UNION ALL
  SELECT
    '%50 İndirim Kuponu',
    'Bir sonraki kayıt için geçerli yüzde elli indirim kuponu.',
    'https://images.unsplash.com/photo-1500522144261-ea64433bbe27?auto=format&fit=crop&w=400&q=60',
    2
  UNION ALL
  SELECT
    'Seviye Tespit & Eğitim Koçluğu',
    'Öğrenciye özel 1 saat seviye tespit ve koçluk görüşmesi.',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=60',
    4
  UNION ALL
  SELECT
    'Sürpriz Hediye Kutusu',
    'Kurs materyalleriyle dolu sürpriz hediye kutusu.',
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=400&q=60',
    1
)
WHERE NOT EXISTS (SELECT 1 FROM prizes);
