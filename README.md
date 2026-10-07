# BRIDGE

Aplikasi desktop untuk **berbagi file dan chat secara offline** lewat jaringan lokal (Wi-Fi / LAN). Tanpa cloud, tanpa Google Drive, tanpa USB, dan **tanpa batas ukuran file**.

```
Laptop A ──(Wi-Fi / LAN)──▶ Bridge ──▶ Laptop B
```

Cocok untuk sekolah, kantor, lab, toko komputer, kampus, atau siapa pun yang bekerja tanpa internet.

## Fitur

- Nearby Devices: perangkat terdekat ditemukan otomatis (UDP broadcast)
- Send File dan Receive File (di-stream langsung ke disk, file besar aman)
- Send Folder (struktur folder dipertahankan)
- **Chat** antar perangkat di jaringan yang sama, lengkap dengan notifikasi desktop
- Text Sharing dan Clipboard Sharing
- Device Pairing dengan PIN 6 digit
- Transfer History
- UI 2D Pixel Art Retro (biru dan dongker)
- Aplikasi desktop untuk Windows, Linux, dan macOS

## Cara kerja

1. Tiap perangkat menyiarkan "saya Bridge" lewat UDP (port `7778`) tiap 2 detik.
2. Perangkat terdekat muncul di daftar. Pilih salah satu.
3. Masukkan PIN yang tampil di perangkat tujuan (cukup sekali).
4. Chat, teks, dan file dikirim langsung antar perangkat lewat HTTP (port `7777`), tanpa server perantara.

File yang diterima disimpan di `~/Bridge` (Windows: `C:\Users\<nama>\Bridge`).

## Instal (pengguna)

Unduh installer dari halaman **Releases** di GitHub:

| Sistem | File |
|---|---|
| Windows | `Bridge Setup x.y.z.exe` (installer) atau versi portable |
| Linux | `.AppImage`, `.deb`, atau `.pacman` |
| macOS | `.dmg` |

- **Arch / CachyOS**: `sudo pacman -U Bridge-*.pacman`, atau jalankan AppImage: `chmod +x Bridge-*.AppImage && ./Bridge-*.AppImage`
- **Debian / Ubuntu**: `sudo apt install ./bridge_*.deb`
- **Windows**: jika muncul peringatan SmartScreen, pilih *More info* lalu *Run anyway* (installer belum ditandatangani).
- **macOS**: klik kanan aplikasi lalu *Open* saat pertama kali (belum ditandatangani).

## Menjalankan dari source (developer)

Butuh Node.js 18+.

```bash
# CachyOS / Arch
sudo pacman -S nodejs npm git
# Ubuntu / Debian: sudo apt install nodejs npm git
# Windows: winget install OpenJS.NodeJS.LTS

git clone https://github.com/Albatany/Bridge
cd bridge
npm install
npm start          # jalankan sebagai aplikasi desktop
```

Mode tanpa Electron (server saja, buka `http://localhost:7777` di browser): `npm run server`.

## Build installer

```bash
npm run dist       # hasil ada di folder dist/ (untuk OS yang sedang dipakai)
```

Build otomatis untuk Windows, Linux, dan macOS lewat GitHub Actions: cukup beri tag.

```bash
git tag v1.1.0 && git push origin v1.1.0
```

Installer akan muncul sebagai draft di halaman Releases.

## Firewall

Izinkan **TCP 7777** dan **UDP 7778** di jaringan lokal.

- ufw: `sudo ufw allow 7777/tcp && sudo ufw allow 7778/udp`
- firewalld: `sudo firewall-cmd --add-port=7777/tcp --add-port=7778/udp --permanent && sudo firewall-cmd --reload`
- Windows: pilih **Allow** pada jaringan Private saat muncul prompt firewall.

Jika perangkat tidak saling muncul, pastikan satu jaringan dan router tidak mengaktifkan *client isolation*.

## Catatan keamanan

Transfer memakai HTTP biasa yang dilindungi PIN, jadi gunakan hanya di jaringan yang Anda percaya. Enkripsi TLS ada di roadmap.

## Struktur proyek

```
bridge/
├── main.js            # cangkang desktop (Electron)
├── server.js          # discovery UDP + server HTTP (file, teks, chat)
├── public/index.html  # UI pixel art
├── build/icon.png     # ikon aplikasi
└── .github/workflows/release.yml
```

## Roadmap

- Pairing lewat QR code
- Enkripsi end-to-end (TLS)
- Chat grup untuk semua perangkat
- Aplikasi HP
