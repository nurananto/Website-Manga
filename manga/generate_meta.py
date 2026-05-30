#!/usr/bin/env python3
"""
Manga Chapter Meta.json Generator
- Taruh di dalam folder manga/, double klik untuk jalankan.
- Buat meta.json langsung di dalam folder chapter (25/, 26/, dll)
- release_date otomatis diisi waktu sekarang (WIB) agar unlock time tidak berubah
- Hapus file webp setelah konfirmasi upload R2
"""

import os
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta


WIB = timezone(timedelta(hours=7))


def now_wib():
    return datetime.now(WIB).strftime("%Y-%m-%dT%H:%M:%S+07:00")


def is_chapter_number(name):
    try:
        float(name)
        return True
    except ValueError:
        return False


def count_webp(folder):
    return len(list(folder.glob("*.webp")))


def get_webp_files(folder):
    return list(folder.glob("*.webp"))


def to_chapter_number(name):
    val = float(name)
    return int(val) if val == int(val) else val


def cls():
    os.system('cls' if os.name == 'nt' else 'clear')


def ask(prompt, allow_empty=False):
    while True:
        val = input(f"{prompt}: ").strip()
        if val.upper() == "X":
            print("\nKeluar...")
            exit(0)
        if val or allow_empty:
            return val
        print("  Input tidak boleh kosong. (X=keluar)")


def header(subtitle=""):
    print("=" * 55)
    print("   Manga Chapter Meta.json Generator")
    if subtitle:
        print(f"   {subtitle}")
    print("=" * 55)
    print("  Ketik X kapan saja untuk keluar")
    print()


def proses_chapter(ch_dir, lock_hours, release_date):
    pages = count_webp(ch_dir)
    if pages == 0:
        return False, "tidak ada .webp"

    # Cek apakah meta.json sudah ada (jangan timpa release_date yang lama)
    meta_path = ch_dir / "meta.json"
    existing_release = None
    if meta_path.exists():
        try:
            existing = json.loads(meta_path.read_text(encoding="utf-8"))
            existing_release = existing.get("release_date")
        except Exception:
            pass

    meta = {
        "chapter_number": to_chapter_number(ch_dir.name),
        "lock_hours": lock_hours,
        "pages": pages,
        # Pakai release_date lama kalau sudah ada (jaga unlock time)
        "release_date": existing_release if existing_release else release_date,
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")

    src = "dipertahankan" if existing_release else "baru"
    return True, (pages, meta["release_date"], src)


def hapus_webp(ch_dir):
    files = get_webp_files(ch_dir)
    for f in files:
        f.unlink()
    return len(files)


def main():
    manga_dir = Path(__file__).parent

    while True:
        cls()
        header()

        # ── Pilih judul ────────────────────────────────────
        titles = sorted([
            d for d in manga_dir.iterdir()
            if d.is_dir()
            and not d.name.startswith('.')
            and d.name not in ('__pycache__',)
            and not d.name.endswith('.py')
        ])

        if not titles:
            print("Tidak ada folder judul ditemukan.")
            input("\nTekan Enter untuk keluar...")
            return

        print("Judul yang tersedia:")
        for i, t in enumerate(titles, 1):
            print(f"  {i}. {t.name}")
        print()

        pilih = ask("Pilih nomor judul")
        try:
            title_dir = titles[int(pilih) - 1]
        except (ValueError, IndexError):
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        # ── Cari chapter yang ada webp ─────────────────────
        while True:
            cls()
            header(f"Judul: {title_dir.name}")

            chapter_dirs = sorted(
                [d for d in title_dir.iterdir()
                 if d.is_dir()
                 and is_chapter_number(d.name)
                 and count_webp(d) > 0],
                key=lambda x: float(x.name)
            )

            if not chapter_dirs:
                print("Tidak ada chapter dengan file .webp ditemukan.")
                print("Pastikan folder chapter berisi file .webp!\n")
                input("Tekan Enter untuk kembali pilih judul...")
                break

            print("Chapter tersedia (ada .webp):")
            for i, ch in enumerate(chapter_dirs, 1):
                pages = count_webp(ch)
                has_meta = (ch / "meta.json").exists()
                status = " ⚠ meta.json sudah ada" if has_meta else ""
                print(f"  {i}. Chapter {ch.name}  ({pages} hal){status}")

            print()
            print("  0  = Bulk semua chapter sekaligus")
            print("  1,2,3 = Pilih chapter tertentu")
            print("  B  = Kembali pilih judul")
            print()

            pilih_ch = ask("Pilihan", allow_empty=True)

            if pilih_ch.upper() == "B":
                break

            if pilih_ch == "0" or pilih_ch == "":
                selected = chapter_dirs
                mode = "bulk"
            else:
                selected = []
                for x in pilih_ch.split(","):
                    x = x.strip()
                    try:
                        selected.append(chapter_dirs[int(x) - 1])
                    except (ValueError, IndexError):
                        print(f"  ⚠  '{x}' tidak valid, dilewati")
                mode = "satuan"

            if not selected:
                input("  Tidak ada chapter dipilih. Tekan Enter...")
                continue

            # ── Lock hours ─────────────────────────────────
            print()
            lock_input = ask("Lock hours (Enter=0/gratis, 336=14hari)", allow_empty=True)
            try:
                lock_hours = int(lock_input) if lock_input else 0
            except ValueError:
                lock_hours = 0

            # release_date = waktu sekarang WIB (tetap untuk semua chapter di sesi ini)
            release_date = now_wib()

            # ── PERINGATAN R2 ──────────────────────────────
            cls()
            header(f"Judul: {title_dir.name}")
            print("⚠️  PERINGATAN PENTING!")
            print("-" * 55)
            print("Pastikan SEMUA file webp dari chapter berikut")
            print("sudah di-upload ke R2 via Mountain Duck!\n")
            for ch in selected:
                pages = count_webp(ch)
                has_meta = (ch / "meta.json").exists()
                note = " (release_date akan dipertahankan)" if has_meta else f" release_date: {release_date}"
                print(f"  • Chapter {ch.name}  ({pages} hal){note}")
            print()
            print("Script akan:")
            print("  1. Membuat/update meta.json di tiap folder chapter")
            print("  2. MENGHAPUS semua file .webp dari folder tersebut")
            print()

            konfirmasi = input("Sudah upload ke R2? Lanjutkan? (Y=ya / N=batal): ").strip().upper()
            if konfirmasi != "Y":
                print("\nDibatalkan.")
                input("Tekan Enter...")
                continue

            # ── Proses ─────────────────────────────────────
            print()
            ok = 0
            skip = 0

            if mode == "bulk":
                print("Membuat meta.json...")
                for ch in selected:
                    berhasil, info = proses_chapter(ch, lock_hours, release_date)
                    if berhasil:
                        pages, rd, src = info
                        print(f"  ✅  Ch.{ch.name}  {pages}hal  release_date({src}): {rd}")
                        ok += 1
                    else:
                        print(f"  ⚠   Ch.{ch.name}  →  {info}")
                        skip += 1

                print()
                print("Menghapus file .webp...")
                for ch in selected:
                    if (ch / "meta.json").exists():
                        jumlah = hapus_webp(ch)
                        if jumlah > 0:
                            print(f"  🗑   Ch.{ch.name}  →  {jumlah} file dihapus")

            else:
                for ch in selected:
                    berhasil, info = proses_chapter(ch, lock_hours, release_date)
                    if berhasil:
                        pages, rd, src = info
                        print(f"  ✅  Ch.{ch.name}  {pages}hal  release_date({src}): {rd}")
                        ok += 1
                        hapus = input(f"      Hapus .webp Ch.{ch.name}? (Y/N): ").strip().upper()
                        if hapus == "Y":
                            jumlah = hapus_webp(ch)
                            print(f"      🗑   {jumlah} file dihapus")
                    else:
                        print(f"  ⚠   Ch.{ch.name}  →  {info}")
                        skip += 1

            print()
            print(f"Selesai! {ok} chapter diproses, {skip} dilewati.")
            print()
            lagi = input("Proses judul/chapter lain? (Y=ya / Enter=keluar): ").strip().upper()
            if lagi != "Y":
                print("\nSampai jumpa!")
                input("Tekan Enter untuk keluar...")
                return


if __name__ == "__main__":
    main()
