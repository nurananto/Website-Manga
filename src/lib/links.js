// Link komunitas Discord — terpusat di sini.
//
// TODO(discord): isi link di bawah setelah server Discord siap.
//   1. DISCORD_INVITE_URL  → invite umum komunitas. Dipakai running text Discord
//      di homepage & halaman detail. Selama kosong, banner tampil tapi tidak bisa diklik.
//   2. discordCommentUrl(mangaId) → channel komentar Discord per judul manga.
//      Dipakai tombol "Komentar" di reader. Selama kosong, fallback ke invite umum
//      (atau tombol disabled kalau invite juga kosong).
//      Nanti: map mangaId → channel URL, atau pola URL kanal per judul, mis.
//        const CHANNELS = { 'Waka-chan': 'https://discord.com/channels/<guild>/<channel>', ... };
//        return CHANNELS[mangaId] || DISCORD_INVITE_URL;

export const DISCORD_INVITE_URL = '';

// Channel komentar Discord untuk sebuah manga. Sementara fallback ke invite umum.
export function discordCommentUrl(mangaId) { // eslint-disable-line no-unused-vars
  // TODO(discord-comments): kembalikan channel spesifik per manga di sini.
  return DISCORD_INVITE_URL;
}
