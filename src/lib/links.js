// Link komunitas Discord — terpusat di sini.
//
// Discord TIDAK bisa di-link pakai nama channel (#plaything dst). Deep-link butuh
// ID numerik:  https://discord.com/channels/<GUILD_ID>/<CHANNEL_ID>
// Cara dapat ID: Discord → Settings → Advanced → Developer Mode ON,
// lalu klik kanan server → "Copy Server ID" (= GUILD_ID),
// dan klik kanan channel → "Copy Channel ID" (= CHANNEL_ID).
//
// TODO(discord):
//   1. Isi DISCORD_INVITE_URL (invite umum) → dipakai tombol "Gabung Komunitas".
//   2. Isi DISCORD_GUILD_ID + tiap channel di DISCORD_CHANNELS → tombol "Komentar
//      di Discord" di reader mengarah ke channel manga ybs. Yang belum diisi
//      otomatis fallback ke invite umum.

export const DISCORD_INVITE_URL = '';

export const DISCORD_GUILD_ID = '';

// Map: mangaId (sesuai "id" di katalog) → Channel ID Discord untuk komentar manga itu.
// Isi string ID numerik-nya. Biarkan kosong/komentar untuk yang belum ada channel.
export const DISCORD_CHANNELS = {
  // 'Midari':          '',
  // '10-nenburi':      '',
  // 'ClassdeIchiban':  '',
  // 'IkemenJoshi':     '',
  // 'KiminoNegai':     '',
  // 'Negatte':         '',
  // 'Osananajimi':     '',
  // 'Suufungo':        '',
  // 'TensaiBishoujo':  '',
  // 'UchinoSeiso-kei': '',
  // 'ZunouBattle':     '',
  // 'Chikasugiru':     '',
  // 'MoshimoYuurei':   '',
  // 'Madogiwa':        '',
  // 'Waka-chan':       '',
  // 'TeisouGyakuten':  '',
  // 'Amari-chan':      '',
  // 'Yuumei':          '',
  // 'Yarikonda':       '',
  // 'Sankakukei':      '',
};

// Channel komentar Discord untuk sebuah manga.
// Pakai channel spesifik kalau ada; kalau belum, fallback ke invite umum.
export function discordCommentUrl(mangaId) {
  const channelId = DISCORD_CHANNELS[mangaId];
  if (DISCORD_GUILD_ID && channelId) {
    return `https://discord.com/channels/${DISCORD_GUILD_ID}/${channelId}`;
  }
  return DISCORD_INVITE_URL;
}
