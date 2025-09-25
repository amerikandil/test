const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
require('dotenv').config();

const config = require('./config');

const app = express();
const PORT = config.server.port;
const ADMIN_PASSWORD = config.admin.password;
const TOKEN_TTL_MS = config.admin.tokenTtlHours * 60 * 60 * 1000;

if (config.server.trustProxy) {
  app.set('trust proxy', config.server.trustProxy);
}

const databasePath = path.isAbsolute(config.database.filename)
  ? config.database.filename
  : path.join(__dirname, config.database.filename);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

db.pragma('foreign_keys = ON');
const schemaPath = path.isAbsolute(config.database.schema)
  ? config.database.schema
  : path.join(__dirname, config.database.schema);

if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
} else {
  throw new Error(`Veritabanı şema dosyası bulunamadı: ${schemaPath}`);
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const adminTokens = new Map();

function createAdminToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now());
  return token;
}

function isAdminTokenValid(token) {
  const createdAt = adminTokens.get(token);
  if (!createdAt) return false;
  if (Date.now() - createdAt > TOKEN_TTL_MS) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !isAdminTokenValid(token)) {
    return res.status(401).json({ error: 'Yetkisiz erişim' });
  }
  return next();
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    interestedLanguage: row.interested_language,
    ipAddress: row.ip_address,
    referralCode: row.referral_code,
    referrerId: row.referrer_id,
    bonusSpinsAvailable: row.bonus_spins_available,
    bonusSpinsUsed: row.bonus_spins_used,
    createdAt: row.created_at
  };
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Geçersiz şifre' });
  }
  const token = createAdminToken();
  return res.json({ token, expiresInHours: TOKEN_TTL_MS / (1000 * 60 * 60) });
});

app.get('/api/prizes', (req, res) => {
  const prizes = db.prepare('SELECT id, title, description, image_url AS imageUrl, probability FROM prizes ORDER BY id ASC').all();
  res.json({ prizes });
});

app.post('/api/prizes', requireAdmin, (req, res) => {
  const { title, description, imageUrl, probability } = req.body || {};
  if (!title || typeof probability !== 'number') {
    return res.status(400).json({ error: 'Hediye başlığı ve olasılık zorunludur' });
  }
  const stmt = db.prepare('INSERT INTO prizes (title, description, image_url, probability) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, description || null, imageUrl || null, probability);
  const prize = db.prepare('SELECT id, title, description, image_url AS imageUrl, probability FROM prizes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ prize });
});

app.put('/api/prizes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl, probability } = req.body || {};
  const existing = db.prepare('SELECT id FROM prizes WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Hediye bulunamadı' });
  }
  if (!title || typeof probability !== 'number') {
    return res.status(400).json({ error: 'Hediye başlığı ve olasılık zorunludur' });
  }
  db.prepare('UPDATE prizes SET title = ?, description = ?, image_url = ?, probability = ? WHERE id = ?')
    .run(title, description || null, imageUrl || null, probability, id);
  const prize = db.prepare('SELECT id, title, description, image_url AS imageUrl, probability FROM prizes WHERE id = ?').get(id);
  res.json({ prize });
});

app.delete('/api/prizes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM prizes WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Hediye bulunamadı' });
  }
  res.status(204).send();
});

app.post('/api/register', (req, res) => {
  const { fullName, email, phone, interestedLanguage, referralCode } = req.body || {};
  if (!fullName || !interestedLanguage) {
    return res.status(400).json({ error: 'Ad soyad ve ilgi duyulan dil zorunludur' });
  }
  const normalizedEmail = email?.trim().toLowerCase() || null;
  const ipAddress = getClientIp(req);

  let user = null;
  if (normalizedEmail) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  }

  const referrer = referralCode ? db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode.trim()) : null;

  if (!user) {
    const newReferralCode = generateReferralCode();
    const insert = db.prepare(`
      INSERT INTO users (full_name, email, phone, interested_language, ip_address, referral_code, referrer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insert.run(fullName.trim(), normalizedEmail, phone?.trim() || null, interestedLanguage.trim(), ipAddress, newReferralCode, referrer?.id || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    if (referrer) {
      db.prepare('UPDATE users SET bonus_spins_available = bonus_spins_available + 1 WHERE id = ?').run(referrer.id);
    }
  } else {
    db.prepare('UPDATE users SET full_name = ?, phone = ?, interested_language = ?, ip_address = ? WHERE id = ?')
      .run(fullName.trim(), phone?.trim() || null, interestedLanguage.trim(), ipAddress, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  const spinCount = db.prepare('SELECT COUNT(*) as count FROM spins WHERE user_id = ?').get(user.id).count;
  const bonusInfo = db.prepare('SELECT bonus_spins_available AS available, bonus_spins_used AS used FROM users WHERE id = ?').get(user.id);
  const referralLink = `${req.protocol}://${req.get('host')}/?ref=${user.referral_code}`;

  res.json({
    user: mapUser(user),
    stats: {
      spins: spinCount,
      bonusSpinsAvailable: bonusInfo.available,
      bonusSpinsUsed: bonusInfo.used
    },
    referralLink
  });
});

function weightedRandomPrize() {
  const prizes = db.prepare('SELECT id, title, description, image_url AS imageUrl, probability FROM prizes').all();
  if (prizes.length === 0) {
    return null;
  }
  const totalWeight = prizes.reduce((sum, prize) => sum + (Number(prize.probability) || 0), 0);
  const rnd = Math.random() * totalWeight;
  let cumulative = 0;
  for (const prize of prizes) {
    cumulative += Number(prize.probability) || 0;
    if (rnd <= cumulative) {
      return prize;
    }
  }
  return prizes[prizes.length - 1];
}

app.post('/api/spin', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'Kullanıcı bilgisi eksik' });
  }
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!userRow) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  const ipAddress = getClientIp(req);
  const userSpins = db.prepare('SELECT * FROM spins WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  const totalSpinsOnIp = db.prepare('SELECT COUNT(*) as count FROM spins WHERE ip_address = ?').get(ipAddress).count;
  const bonusInfo = db.prepare('SELECT bonus_spins_available AS available, bonus_spins_used AS used FROM users WHERE id = ?').get(userId);

  const hasStandardSpin = userSpins.length > 0;
  const bonusRemaining = (bonusInfo.available || 0) - (bonusInfo.used || 0);

  if (!hasStandardSpin) {
    if (totalSpinsOnIp > 0) {
      return res.status(429).json({ error: 'Bu cihazla daha önce çark çevrildi.' });
    }
  } else {
    if (bonusRemaining <= 0) {
      return res.status(429).json({ error: 'Ek spin hakkınız bulunmuyor.' });
    }
  }

  const prize = weightedRandomPrize();
  if (!prize) {
    return res.status(500).json({ error: 'Hediye havuzu boş. Lütfen yöneticiye başvurun.' });
  }

  const spinNumber = userSpins.length + 1;
  const insertSpin = db.prepare(`
    INSERT INTO spins (user_id, prize_id, prize_title, prize_description, prize_image_url, spin_number, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSpin.run(userId, prize.id, prize.title, prize.description, prize.imageUrl, spinNumber, ipAddress);

  if (hasStandardSpin) {
    db.prepare('UPDATE users SET bonus_spins_used = bonus_spins_used + 1 WHERE id = ?').run(userId);
  }

  const referralLink = `${req.protocol}://${req.get('host')}/?ref=${userRow.referral_code}`;
  const updatedBonus = db.prepare('SELECT bonus_spins_available AS available, bonus_spins_used AS used FROM users WHERE id = ?').get(userId);

  res.json({
    prize,
    spinNumber,
    bonus: {
      available: updatedBonus.available,
      used: updatedBonus.used
    },
    referralLink
  });
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }
  const stats = db.prepare('SELECT COUNT(*) AS spinCount FROM spins WHERE user_id = ?').get(id);
  const bonusInfo = db.prepare('SELECT bonus_spins_available AS available, bonus_spins_used AS used FROM users WHERE id = ?').get(id);
  const lastSpin = db.prepare('SELECT prize_title, prize_description, prize_image_url, created_at FROM spins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
  const referralLink = `${req.protocol}://${req.get('host')}/?ref=${user.referral_code}`;
  res.json({
    user: mapUser(user),
    stats: {
      spinCount: stats.spinCount,
      bonusAvailable: bonusInfo.available,
      bonusUsed: bonusInfo.used,
      lastSpin
    },
    referralLink
  });
});

app.get('/api/participants', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.phone, u.interested_language, u.ip_address, u.referral_code,
           u.created_at, u.bonus_spins_available, u.bonus_spins_used,
           COUNT(s.id) AS spin_count
    FROM users u
    LEFT JOIN spins s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ participants: rows });
});

app.get('/api/spins', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.user_id, u.full_name, s.prize_title, s.prize_description, s.spin_number, s.ip_address, s.created_at
    FROM spins s
    LEFT JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `).all();
  res.json({ spins: rows });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda hazır`);
});
