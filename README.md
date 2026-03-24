# 🕷️ SpiderChat — Real-Time Chat App

Chat real-time berbasis lokal. Tidak perlu internet, tidak perlu nomor telepon.

---

## ⚡ Cara Menjalankan (3 Langkah)

### 1. Install Node.js
Unduh dan install dari: https://nodejs.org
Pilih versi LTS (disarankan v18 atau v20).

### 2. Install Dependencies
Buka terminal / command prompt, masuk ke folder SpiderChat:

```bash
cd spiderchat
npm install
```

### 3. Jalankan Server
```bash
node server.js
```

Buka browser dan akses: **http://localhost:3000**

---

## 👥 Akun Demo (langsung bisa login)

| Username | Password |
|----------|----------|
| admin    | admin123 |
| budi     | 123456   |
| sari     | 123456   |
| raka     | 123456   |
| lina     | 123456   |

---

## 🌐 Multi-Device di Jaringan Lokal

Untuk chat antar perangkat berbeda di WiFi yang sama:

1. Cari IP lokal komputermu:
   - Windows: buka CMD → ketik `ipconfig`
   - Mac/Linux: buka Terminal → ketik `ifconfig`
   
2. Akses dari perangkat lain: `http://[IP-KAMU]:3000`
   Contoh: `http://192.168.1.10:3000`

---

## ✨ Fitur Real-Time

- ✅ Pesan terkirim & diterima secara instan (WebSocket)
- ✅ Indikator mengetik... (typing indicator)
- ✅ Status online / offline real-time
- ✅ Read receipt ✓✓ biru (dibaca)
- ✅ Emoji reaksi pada pesan
- ✅ Balas pesan (reply)
- ✅ Hapus pesan (sync ke semua user)
- ✅ Chat grup real-time
- ✅ Tambah & kelola kontak
- ✅ Panggilan suara & video (signaling)
- ✅ Kirim pesan suara & file
- ✅ Notifikasi bunyi
- ✅ Data tersimpan di db.json (persisten)

---

## 📁 Struktur File

```
spiderchat/
├── server.js       ← Backend Node.js + Socket.io
├── package.json    ← Dependensi
├── db.json         ← Database (auto-dibuat saat pertama jalan)
└── public/
    └── index.html  ← Frontend (otomatis dilayani server)
```

---

## 🔧 Tips

- Data tersimpan di `db.json`. Hapus file ini untuk reset semua data.
- Gunakan `npm run dev` (butuh nodemon) untuk auto-restart saat edit server.
- Port default: 3000. Ganti di `server.js` baris terakhir jika perlu.

---

Dibuat dengan ❤️ menggunakan Node.js + Socket.io + Vanilla JS
