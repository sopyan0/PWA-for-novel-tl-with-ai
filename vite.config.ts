import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// PLUGIN KHUSUS: Memaksa copy file dari root ke dist saat build selesai
const copyRootFiles = () => {
  return {
    name: 'copy-root-files',
    closeBundle: async () => {
      const filesToCopy = [
        'manifest.json', 
        'sw.js', 
        'icon-192.png', 
        'icon-512.png', 
        'icon.svg'
      ];
      
      console.log('⚡ NovTL: Menyalin aset PWA dari root ke dist...');
      
      filesToCopy.forEach(file => {
        const src = path.resolve(__dirname, file);
        const dest = path.resolve(__dirname, 'dist', file);
        
        // Cek apakah file ada di source (root)
        if (fs.existsSync(src)) {
          // Pastikan folder dist ada (kadang belum terbuat jika build kosong)
          if (!fs.existsSync(path.resolve(__dirname, 'dist'))) {
             fs.mkdirSync(path.resolve(__dirname, 'dist'));
          }
          fs.copyFileSync(src, dest);
          console.log(`✅ Berhasil copy: ${file}`);
        } else {
          console.warn(`⚠️ File tidak ditemukan di root: ${file}`);
        }
      });
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    copyRootFiles() // Aktifkan plugin kita
  ],
  define: {
    'process.env': {}
  },
  build: {
    assetsInlineLimit: 0, // Jangan ubah gambar jadi base64 kecil, biarkan jadi file
    chunkSizeWarningLimit: 1600, // Naikkan limit warning (fix build warning)
  }
})