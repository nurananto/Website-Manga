// Test kirim notifikasi Discord dummy
// Jalankan via GitHub Actions: workflow "Test Discord Notif"
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const siteUrl    = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');

if (!webhookUrl) {
  console.error('❌ DISCORD_WEBHOOK_URL belum diset');
  process.exit(1);
}

const embed = {
  title:       'Yuumei wa Yoake ni Tokeru',
  url:         `${siteUrl}/Yuumei`,
  color:       0x5865F2,
  description: `**Ch. 99** baru saja rilis!\n\n[📖 Baca Sekarang](${siteUrl}/Yuumei)`,
  image:       { url: 'https://picsum.photos/seed/manga/300/450' },

  footer:      { text: 'Nurananto Scanslation • Update Terbaru' },
  timestamp:   new Date().toISOString(),
};

const res = await fetch(webhookUrl, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ username: 'Nurananto Scanslation', embeds: [embed] }),
});

if (res.ok) {
  console.log('✅ Test notifikasi berhasil dikirim ke Discord!');
} else {
  console.error(`❌ Gagal: ${res.status} ${await res.text()}`);
  process.exit(1);
}
