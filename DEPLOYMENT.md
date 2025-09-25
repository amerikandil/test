# Dağıtım Rehberi

Bu proje Express ve SQLite ile hazırlanmış "Amerikan Dil Kursu" kampanya uygulamasını barındırır. Kendi sunucunuza kurarken aşağıdaki adımları izleyebilirsiniz.

## 1. Gereksinimler

- Node.js 18 veya üzeri
- npm

## 2. Bağımlılıkların kurulması

```bash
npm install
```

## 3. Ortam değişkenlerinin ayarlanması

`.env.example` dosyasını referans alarak `.env` dosyası oluşturun:

```bash
cp .env.example .env
```

Ardından ihtiyaçlarınıza göre aşağıdaki değişkenleri güncelleyin:

| Değişken | Açıklama |
| --- | --- |
| `PORT` | Uygulamanın dinleyeceği port. |
| `TRUST_PROXY` | Uygulama ters proxy arkasında çalışacaksa `true`, `false` veya Express'in kabul ettiği değerlerden biri. |
| `ADMIN_PASSWORD` | Yönetici paneli girişi için parola. |
| `ADMIN_TOKEN_TTL_HOURS` | Yönetici oturumlarının geçerli olacağı saat cinsinden süre. |
| `DATABASE_FILE` | SQLite veritabanı dosyasının yolu. (Göreceli yollar proje köküne göre yorumlanır.) |
| `DATABASE_SCHEMA` | Tablo ve başlangıç verilerini oluşturan SQL dosyasının yolu. |

## 4. Veritabanının hazırlanması

Uygulama başlarken `config/schema.sql` dosyasını çalıştırarak tabloyu otomatik oluşturur. Eğer manuel olarak kurmak isterseniz aşağıdaki komutla aynı SQL dosyasını çalıştırabilirsiniz:

```bash
sqlite3 database.sqlite < config/schema.sql
```

`DATABASE_FILE` değişkenini farklı bir konuma ayarladıysanız, komutta aynı yolu kullanmayı unutmayın.

## 5. Uygulamayı çalıştırma

Geliştirme için:

```bash
npm run dev
```

Üretim için tipik bir çalışma komutu:

```bash
npm start
```

Sunucuyu ters proxy arkasında (NGINX vb.) çalıştırıyorsanız, istemci IP adreslerinin doğru alınabilmesi için uygun `TRUST_PROXY` değerini ayarlayın ve proxy üzerinden `X-Forwarded-For` başlıklarını ilettiğinizden emin olun.

## 6. Admin paneline erişim

`/admin.html` adresine giderek yönetici paneline ulaşabilirsiniz. Giriş için `.env` dosyanızda belirlediğiniz `ADMIN_PASSWORD` değerini kullanın.

## 7. Yedekleme

Tüm kullanıcı ve çark verileri tek bir SQLite dosyasında tutulur (`DATABASE_FILE`). Bu dosyayı düzenli olarak yedekleyerek kampanya verilerinizi koruyabilirsiniz.

