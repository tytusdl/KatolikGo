# ✝️ KatolikGo

**KatolikGo** ialah sebuah aplikasi mudah alih (mobile app) dan platform permainan web (gaming platform) interaktif berunsurkan pendidikan dan komuniti yang direka khas untuk umat Kristian Katolik. Projek ini dibangunkan untuk membantu pengguna—terutamanya golongan belia—mendalami Alkitab, mengenali para Kudus (Saints), serta memahami tradisi Gereja dengan cara yang menyeronokkan dan kompetitif.

Platform ini menggunakan **GitHub** untuk pengurusan kod dan berintegrasi sepenuhnya dengan **Firebase** sebagai penyelesaian backend.

---

## 🚀 Ciri-Ciri Utama & Mod Permainan

### 1. Mod Permainan
*   **Mod 1: Teka Gambar ("Siapa Saya?"):** Menguji pengecaman pengguna terhadap tokoh Alkitab, Para Kudus (Saints), Paus, objek liturgi (seperti Monstrans, Tabernakel), atau gereja bersejarah. Media disimpan dalam Firebase Storage.
*   **Mod 2: Kuiz Alkitab & Katolik:** Kuiz aneka pilihan (multiple choice) merangkumi Perjanjian Lama & Baru, Katekisus Gereja Katolik (CCC), Sakramen, dan Liturgi, lengkap dengan info ringkas (ensiklopedia mini) selepas menjawab.
*   **Mod 3: Kuiz Kilat ("Siapa Cepat Dia Dapat"):** Kategori *Time Attack* di mana pengguna bersaing dengan masa. Skor dikira berdasarkan ketepatan jawapan serta kepantasan tindak balas (milisaat).

### 2. Sistem Tahap (Leveling System)
*   Setiap mod mempunyai **Level 1 hingga Level 100** dengan kesukaran dinamik (Mudah ➡️ Sederhana ➡️ Keras).
*   **Mekanik Buka Level:**
    *   *Cara Percuma:* Lulus level semasa dengan markah minimum 80%.
    *   *Cara Ekspres:* Menggunakan **Token** untuk melompati level sebelumnya.

### 3. Monetisasi & Pengurusan Token
*   **Pembelian Token (In-App Purchase):** Pakej token boleh dibeli menggunakan Google Play Billing, Apple IAP, atau Stripe (Web).
*   **Ganjaran Iklan (Rewarded Ads):** Dapatkan token percuma dengan menonton video iklan pendek melalui Google AdMob.
*   **Pas Tanpa Iklan (Remove Ads):** Pembayaran sekali seumur hidup untuk membuang semua iklan banner/interstitial.

### 4. Ciri Komuniti & Sosial
*   **Sistem Pilihan Paroki:** Pengguna boleh memilih paroki/gereja tempatan mereka semasa mendaftar untuk menyumbang mata kepada **Leaderboard Antara Paroki**.
*   **Papan Pendahulu (Leaderboard):** Penjejakan masa nyata (real-time) bagi ranking Global, Mingguan, Bulanan, dan kategori Kuiz Kilat.
*   **Hadiah Harian (Daily Rewards):** Sistem *streak* 7 hari untuk ganjaran token/XP harian (disahkan selamat melalui pelayan backend).
*   **Kongsi Pencapaian:** Penjanaan kad pencapaian digital secara dinamik untuk dikongsi ke status WhatsApp atau media sosial apabila mencapai *milestone* tertentu.
*   **Ayat Alkitab Harian:** Notifikasi push (Firebase Cloud Messaging) yang menghantar ayat Alkitab atau mutiara kata para Kudus setiap hari.

---

## 🛠️ Seni Bina Teknologi (Tech Stack)

*   **Frontend:** Cross-Platform Framework (React Native / Expo / Web)
*   **Backend-as-a-Service (BaaS):** Firebase
    *   *Firebase Auth:* Pengurusan log masuk (Email, Google, Apple ID).
    *   *Cloud Firestore:* Pangkalan data NoSQL yang dioptimumkan untuk kos read/write.
    *   *Firebase Storage:* Penyimpanan fail imej dan media kuiz.
    *   *Firebase Cloud Functions:* Logik backend yang selamat untuk transaksi token, ganjaran harian, dan agregasi data leaderboard.
    *   *Firebase Cloud Messaging (FCM):* Pengurusan notifikasi push.
*   **Pemasaran & Analitik:** Google AdMob & Firebase Analytics.

---

## 📁 Struktur Pangkalan Data Firestore (Cadangan)

*   `users/{userId}`: Profil pengguna, baki token, tahap akses, status premium, dan rujukan paroki.
*   `parishes/{parishId}`: Data paroki dan jumlah pengumpulan XP kumpulan.
*   `quizzes/{quizId}`: Bank soalan, kategori, tahap kesukaran, dan fail rujukan media.
*   `leaderboards/{leaderboardId}`: Rekod agregat skor bagi mengurangkan kos bacaan pangkalan data.
*   `transactions/{transactionId}`: Log sejarah pembelian dan penggunaan token untuk audit keselamatan.

---

## 🔒 Keselamatan & Anti-Cheat

1.  Semua operasi kritikal (penolakan token, tuntutan hadiah harian) diproses di sebelah pelayan menggunakan **Firebase Cloud Functions** dengan rujukan `serverTimestamp()` bagi mengelakkan manipulasi masa peranti.
2.  **Firebase Security Rules** dikonfigurasi secara ketat untuk menyekat akses tulis (write access) terus ke profil sensitif atau pengubahan skor tanpa pengesahan backend.

---

⭐ *KatolikGo - Belajar, Bermain, dan Bertumbuh dalam Iman Bersama Komuniti.*
