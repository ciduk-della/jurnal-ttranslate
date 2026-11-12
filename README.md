# Free Corat-Coret PPT ✏️📄

Aplikasi web modern, ringan, dan gratis untuk membuka file presentasi PowerPoint (.pptx, .ppt) maupun dokumen PDF, mencoret langsung di atas slide menggunakan aneka alat anotasi interaktif, menyimpan proyek, dan mengekspor hasilnya menjadi file PDF berkualitas tinggi.

Dirancang khusus untuk **mahasiswa, dosen, guru, dan pelajar** agar dapat mencoret slide perkuliahan atau materi belajar secara langsung tanpa repot dan tanpa lisensi Microsoft Office/PowerPoint berbayar.

---

## 🚀 Fitur Utama

### 1. Pembacaan Presentasi & Dokumen
- **Dukungan Format Lengkap:** Unggah file `.pptx`, `.ppt` (format biner 97-2003), dan `.pdf`.
- **Konversi Otomatis:** Mengonversi presentasi PowerPoint menjadi PDF menggunakan mesin LibreOffice headless di sisi server.
- **Tampilan Presisi:** Merender slide secara tajam dan responsif di browser menggunakan **PDF.js**.
- **Panel Thumbnail:** Sidebar kiri menampilkan pratinjau seluruh slide dengan indikator status coretan dan klik-untuk-lompat.

### 2. Lapisan Coretan Interaktif (Interactive HTML5 Canvas)
- **10 Alat Lengkap:**
  1. 🖋️ **Pena (Pen):** Menggambar bebas dengan goresan halus (*smooth curves*).
  2. 🖍️ **Highlighter:** Penanda transparan yang tidak menutupi teks slide.
  3. 🧼 **Penghapus (Eraser):** Menghapus objek coretan saat disentuh (*stroke eraser*).
  4. 🔤 **Teks (Text Tool):** Menambahkan catatan teks langsung di atas slide.
  5. 📏 **Garis Lurus (Line):** Menggarisbawahi poin penting.
  6. ➡️ **Panah (Arrow):** Menunjuk diagram atau rumus tertentu.
  7. 🔲 **Kotak (Rectangle):** Membingkai tabel atau kalimat kunci.
  8. ↩️ **Undo (Ctrl+Z):** Membatalkan coretan per slide.
  9. ↪️ **Redo (Ctrl+Y):** Mengembalikan tindakan sebelumnya.
  10. 🗑️ **Bersihkan (Clear Slide):** Menghapus seluruh coretan pada slide aktif (dilengkapi riwayat undo).
- **Pengaturan Warna:** Palet warna siap pakai + pemilih warna kustom (*color picker*).
- **Ketebalan Fleksibel:** Penggeser slider ketebalan 1px s.d. 30px.
- **Resolusi & Zoom Konsisten:** Menggunakan koordinat ternormalisasi (*normalized coordinates* $0.0 - 1.0$), sehingga saat pengguna memperbesar (Zoom In), memperkecil (Zoom Out), atau mengubah ukuran jendela browser, semua coretan **tetap berada di posisi yang tepat**.
- **Dukungan Perangkat:** Kompatibel dengan Mouse, Layar Sentuh (*Touchscreen*), dan Stylus Pen.

### 3. Sistem Navigasi & Presentasi
- Tombol *Previous* dan *Next Slide*.
- Input nomor slide langsung untuk lompat cepat.
- Navigasi keyboard (tombol panah ⬅️ / ➡️, spasi, atau PageUp / PageDown).
- Sidebar dapat diciutkan (*collapsible*) untuk area coret yang lebih luas.

### 4. Sistem Penyimpanan & Proyek
- **Isolasi Anotasi:** Coretan setiap slide disimpan terpisah dalam memori dan format JSON.
- **Autosave Lokal:** Otomatis menyimpan progres ke browser *LocalStorage* dan server agar coretan tidak hilang saat halaman disegarkan (*refresh*).
- **Simpan & Buka Proyek:** Menyimpan metadata proyek dan data coretan (*vector strokes*) ke file `.ccppt.json` yang dapat dibuka kembali kapan saja.

### 5. Ekspor PDF Beranotasi
- **Export PDF:** Menggabungkan slide asli dengan lapisan anotasi secara presisi menggunakan **PyMuPDF**, menghasilkan dokumen PDF beresolusi tinggi yang siap dibagikan atau dicetak.
- **Unduh Cadangan Proyek:** Mengunduh file proyek JSON untuk diarsipkan di komputer pengguna.

### 6. 📚 Modul Baru: AI Journal & PDF Translator (DeepL-Quality)
- **Ekstraksi Struktur Jurnal:** Otomatis mengenali bagian-bagian jurnal ilmiah (*Title, Abstract, Introduction, Methodology, Results and Discussion, Conclusion, References*).
- **Deteksi Bahasa Otomatis:** Mendukung Auto-Detect, English, Indonesian, German, Japanese, Chinese, dan berbagai bahasa internasional lain.
- **Perlindungan Persamaan & Sitasi:** Persamaan matematika ($M = f'c \times b \times d^2$, Eq. (1)) dan sitasi ilmiah (contoh: *Smith et al., 2020*, *[1]*) diproteksi agar tidak rusak saat proses translasi.
- **Kamus Istilah Baku Teknik Sipil:** Dilengkapi kamus bawaan 80+ istilah teknik sipil (Struktur, Geoteknik, Hidro, Transportasi, Manajemen Konstruksi) dengan fitur tambah/hapus istilah kustom.
- **3 Mode Tampilan Interaktif:**
  - **MODE 1:** *Original vs Translation* (Teks asli dan terjemahan berdampingan per bagian).
  - **MODE 2:** *Translation Only* (Teks terjemahan lengkap format akademik).
  - **MODE 3:** *Original PDF + Translation Sync* (Pratinjau PDF asli di kiri dan teks terjemahan di kanan).
- **Format Ekspor Lengkap:**
  - 📄 **PDF Terjemahan** (Format siap baca)
  - 📑 **Bilingual PDF** (Teks asli bahasa Inggris di kiri & terjemahan bahasa Indonesia di kanan)
  - 📝 **Microsoft Word (DOCX)** (Lengkap dengan format Heading & Paragraf)
  - 📋 **Plain TXT**
- **Pilihan Engine Fleksibel:** Menggunakan Google Free Engine (tanpa API key) secara default dengan fallback MyMemory, serta mendukung DeepL API key milik pengguna.

---

## 🛠️ Arsitektur Teknologi

- **Backend:** Python 3.10+ & Flask
- **Manipulasi PDF & Ekspor:** PyMuPDF (`pymupdf`)
- **Struktur Presentasi:** `python-pptx`
- **Konversi PPT/PPTX:** LibreOffice CLI (`soffice --headless --convert-to pdf`)
- **Frontend:** Semantic HTML5, CSS3 Modern (Dark Theme), Vanilla JavaScript (Modular ES6)
- **Engine Penampil PDF:** PDF.js (disertakan lokal secara offline di `static/vendor/`)
- **Area Coretan:** HTML5 Canvas Overlay dengan *Pointer Events API*

---

## 📁 Struktur Direktori

```text
free-corat-coret-ppt/
├── app.py                      # File utama inisialisasi & server Flask
├── config.py                   # Konfigurasi aplikasi, path folder, deteksi LibreOffice
├── requirements.txt            # Daftar pustaka Python
├── README.md                   # Dokumentasi instalasi dan panduan
├── routes/
│   ├── __init__.py             # Definisi Blueprint Flask
│   ├── upload.py               # Endpoint unggah PPT/PPTX/PDF & serving file
│   ├── project.py              # Endpoint simpan/buka/impor proyek JSON
│   └── export.py               # Endpoint ekspor PDF beranotasi
├── services/
│   ├── __init__.py
│   ├── ppt_converter.py        # Layanan konversi LibreOffice CLI
│   ├── pdf_renderer.py         # Layanan PyMuPDF untuk metadata & thumbnail
│   ├── annotation_service.py   # Layanan manajemen manifest anotasi & JSON
│   └── export_service.py       # Layanan pembakaran (*burn-in*) anotasi ke PDF
├── templates/
│   └── index.html              # Antarmuka web utama
├── static/
│   ├── css/
│   │   └── style.css           # Desain UI modern dan responsif
│   ├── js/
│   │   ├── app.js              # Orkestrator alur aplikasi
│   │   ├── canvas.js           # Mesin HTML5 Canvas & kalkulasi koordinat
│   │   ├── pdf_viewer.js       # Integrasi PDF.js & navigasi slide
│   │   ├── toolbar.js          # Kontrol toolbar, palet, & pintasan keyboard
│   │   └── storage.js          # Manajemen penyimpanan lokal & sinkronisasi API
│   └── vendor/
│       ├── pdf.min.js          # Library PDF.js offline
│       └── pdf.worker.min.js   # Worker PDF.js offline
├── tests/
│   ├── __init__.py
│   └── test_app.py             # Rangkaian pengujian otomatis (Unit Tests)
├── uploads/                    # Direktori penyimpanan file unggahan
├── projects/                   # Direktori penyimpanan file proyek JSON
└── exports/                    # Direktori output file PDF hasil ekspor
```

---

## 💻 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat
- **Python:** Versi 3.10 atau yang lebih baru.
- **LibreOffice (Opsional tetapi disarankan):** Dibutuhkan jika Anda ingin mengonversi file PowerPoint (`.pptx` / `.ppt`) langsung di server. *(Jika hanya menggunakan file `.pdf`, LibreOffice tidak diperlukan!)*.

### 2. Memasang Dependensi Python
Buka terminal / PowerShell di direktori proyek:
```bash
pip install -r requirements.txt
```

### 3. Memasang LibreOffice (Untuk Dukungan File PPT/PPTX)
- **Windows (PowerShell):**
  ```powershell
  winget install TheDocumentFoundation.LibreOffice
  ```
  *Atau unduh installer resmi dari:* [libreoffice.org/download](https://www.libreoffice.org/download/download/)
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt-get update && sudo apt-get install libreoffice
  ```
- **macOS:**
  ```bash
  brew install --cask libreoffice
  ```

> **Tips Jika LibreOffice Belum Terpasang:**
> Anda tetap dapat menggunakan seluruh fitur aplikasi dengan membuka materi di PowerPoint atau Google Slides, lalu memilih **File > Save As / Export to PDF**. Unggah file PDF tersebut dan aplikasi akan bekerja seketika 100%!

### 4. Menjalankan Aplikasi
Jalankan perintah berikut:
```bash
python app.py
```
Buka browser dan akses alamat:
```
http://127.0.0.1:5000
```

---

## ⌨️ Daftar Pintasan Keyboard (Shortcuts)

| Tombol | Fungsi |
|---|---|
| <kbd>P</kbd> | Alat Pena Bebas (*Pen*) |
| <kbd>H</kbd> | Alat *Highlighter* Transparan |
| <kbd>E</kbd> | Alat Penghapus (*Eraser*) |
| <kbd>T</kbd> | Alat Teks (*Text Tool*) |
| <kbd>L</kbd> | Alat Garis Lurus (*Line*) |
| <kbd>A</kbd> | Alat Panah (*Arrow*) |
| <kbd>R</kbd> | Alat Kotak Persegi (*Rectangle*) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo coretan terakhir |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Redo coretan |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Simpan Proyek |
| <kbd>⬅️</kbd> / <kbd>PageUp</kbd> | Slide Sebelumnya |
| <kbd>➡️</kbd> / <kbd>PageDown</kbd> / <kbd>Spasi</kbd> | Slide Berikutnya |
| <kbd>+</kbd> / <kbd>=</kbd> | Perbesar Tampilan (*Zoom In*) |
| <kbd>-</kbd> | Perkecil Tampilan (*Zoom Out*) |
| <kbd>B</kbd> | Buka / Tutup Sidebar Thumbnail |
| <kbd>?</kbd> | Tampilkan Jendela Bantuan & Pintasan |

---

## 🧪 Menjalankan Pengujian Otomatis

Proyek ini telah dilengkapi dengan unit test menyeluruh untuk memastikan seluruh modul bekerja:
```bash
python -m unittest tests/test_app.py -v
```

Pengujian memverifikasi:
1. Akses endpoint sistem dan *health check*.
2. Unggah file PDF dan ekstraksi metadata halaman.
3. Penayangan PDF dan perenderan thumbnail slide.
4. Validasi format file dan pencegahan unggahan file ilegal.
5. Penanganan file PPTX dengan dan tanpa LibreOffice.
6. Isolasi dan penyimpanan coretan antar-slide secara independen.
7. Penggabungan (*burn-in*) anotasi dan ekspor file PDF.
8. Ekspor dan impor cadangan proyek JSON.
9. Simulasi konversi pipeline LibreOffice (*mocking*).

---

## ⚠️ Batasan Fitur

1. **Format Hasil Ekspor:** Hasil ekspor "Export PDF" adalah dokumen PDF yang menyatukan slide asli dan goresan anotasi sebagai lapisan visual tetap (*flattened visual overlay*). File ini bukan presentasi PowerPoint (.pptx) dengan bentuk Office vektor yang dapat diedit di menu *Shape Format* Microsoft PowerPoint.
2. **File PPT Format Lawas (97-2003):** Sebagian file `.ppt` biner lawas yang memiliki proteksi sandi atau makro VBA kompleks mungkin memerlukan penyimpanan ulang ke format `.pptx` modern atau ekspor ke PDF sebelum diunggah.

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi terbuka untuk tujuan pendidikan, penelitian, dan penggunaan publik tanpa biaya lisensi perangkat lunak.

