// Link komunitas Discord — config global terpusat di sini.
//
// Discord TIDAK bisa di-link pakai nama channel (#plaything dst). Deep-link butuh
// ID numerik:  https://discord.com/channels/<GUILD_ID>/<CHANNEL_ID>
// Cara dapat ID: Discord → Settings → Advanced → Developer Mode ON,
// lalu klik kanan server → "Copy Server ID" (= GUILD_ID),
// dan klik kanan channel → "Copy Channel ID".
//
// CHANNEL_ID per manga TIDAK di sini — ada di meta.json tiap manga
// (field "discord_channel_id"), ikut mengalir ke katalog. Lihat discordCommentUrl().
//
// TODO(discord):
//   1. Isi DISCORD_INVITE_URL (invite umum) → tombol "Gabung Komunitas".
//   2. Isi DISCORD_GUILD_ID (sekali, satu server).
//   3. Isi "discord_channel_id" di meta.json tiap manga → tombol "Komentar di Discord".

export const DISCORD_INVITE_URL = 'https://discord.gg/qwTSEYdB4';

// Isi sekali (server ID). Setelah ini + discord_channel_id di meta.json terisi,
// tombol komentar reader otomatis deep-link ke channel manga ybs.
export const DISCORD_GUILD_ID = '';

// Bangun URL channel komentar dari channelId milik manga (dari meta.json).
// Fallback ke invite umum kalau channel/guild belum diisi.
export function discordCommentUrl(channelId) {
  if (DISCORD_GUILD_ID && channelId) {
    return `https://discord.com/channels/${DISCORD_GUILD_ID}/${channelId}`;
  }
  return DISCORD_INVITE_URL;
}
