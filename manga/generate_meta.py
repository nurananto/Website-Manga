#!/usr/bin/env python3
"""
Manga Chapter Meta.json Generator
- Taruh di dalam folder manga/, double klik untuk jalankan.
- Buat meta.json langsung di dalam folder chapter (25/, 26/, dll)
- Hapus file webp setelah konfirmasi upload R2
"""

import os
import json
import re
import traceback
from pathlib import Path
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))
CHAPTER_NUMBER_RE = re.compile(r'^(?:chapter|ch|chap|episode|ep|part)?\s*[-_. ]*\s*(\d+(?:\.\d+)?)\s*$', re.IGNORECASE)
STRICT_NUMBER_RE = re.compile(r'^\d+(?:\.\d+)?$')
ONESHOT_RE = re.compile(r'^(?:one[-_. ]*shot|oneshot)$', re.IGNORECASE)

def now_wib():
    return datetime.now(WIB).strftime("%Y-%m-%dT%H:%M:%S+07:00")


def extract_chapter_number(name):
    text = name.strip()
    if ONESHOT_RE.match(text):
        return "oneshot"

    if STRICT_NUMBER_RE.match(text):
        return float(text)

    match = CHAPTER_NUMBER_RE.match(text)
    if not match:
        return None

    try:
        return float(match.group(1))
    except ValueError:
        return None


def is_chapter_number(name):
    return extract_chapter_number(name) is not None


def count_webp(folder):
    return len(get_webp_files(folder))


def get_webp_files(folder):
    return sorted(
        [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() == ".webp"],
        key=lambda p: str(p).lower(),
    )


def pending_chapters(title_dir):
    """Chapter yang punya .webp TAPI belum punya meta.json (= belum diproses)."""
    return sorted(
        [d for d in title_dir.iterdir()
         if d.is_dir() and is_chapter_number(d.name)
         and count_webp(d) > 0 and not (d / "meta.json").exists()],
        key=lambda x: chapter_sort_key(x.name)
    )


def to_chapter_number(name):
    val = extract_chapter_number(name)
    if val is None:
        raise ValueError(f"Nama chapter tidak mengandung nomor: {name}")
    if val == "oneshot":
        return val
    return int(val) if val == int(val) else val


def chapter_sort_key(name):
    val = extract_chapter_number(name)
    if val == "oneshot":
        return (0, -1)
    if val is None:
        return (0, -2)
    return (1, val)


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


def proses_chapter(ch_dir, lock_hours, next_update=None):
    pages = count_webp(ch_dir)
    if pages == 0:
        return False, "tidak ada .webp"

    chapter_number = extract_chapter_number(ch_dir.name)
    if chapter_number is None:
        return False, "nama folder chapter tidak mengandung nomor/oneshot"

    # Pertahankan release_date lama kalau sudah ada.
    # Chapter BARU tidak diberi release_date — akan diisi otomatis oleh
    # build-catalog.js dari waktu commit pertama meta.json ini (WIB).
    meta_path = ch_dir / "meta.json"
    existing_release = None
    existing_unlock = None
    if meta_path.exists():
        try:
            existing = json.loads(meta_path.read_text(encoding="utf-8"))
            existing_release = existing.get("release_date")
            existing_unlock = existing.get("unlock_date")
        except Exception:
            pass

    meta = {
        "chapter_number": to_chapter_number(ch_dir.name),
        **({"title": "Oneshot"} if chapter_number == "oneshot" else {}),
        "lock_hours": lock_hours,
        "pages": pages,
    }
    if existing_release:
        meta["release_date"] = existing_release
    if existing_unlock and lock_hours > 0:
        meta["unlock_date"] = existing_unlock
    # next_update hanya untuk chapter terakhir/terbaru (jadwal rilis berikutnya)
    if next_update:
        meta["next_update"] = next_update

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return True, pages


def display_chapter_label(ch_dir):
    number = extract_chapter_number(ch_dir.name)
    if number == "oneshot":
        return "Oneshot"
    if number is None:
        return ch_dir.name
    return f"Chapter {int(number) if number == int(number) else number}"


def infer_manga_status(title_dir):
    has_oneshot_folder = any(
        d.is_dir() and ONESHOT_RE.match(d.name.strip())
        for d in title_dir.iterdir()
    )
    return "Oneshot" if has_oneshot_folder else "ONGOING"


def ask_next_update():
    """Tanya jadwal rilis chapter berikutnya. Return ISO WIB string atau None."""
    print()
    print("Jadwal rilis chapter BERIKUTNYA (untuk chapter terbaru):")
    print("  1. Tidak ada (default — tampil 'segera rilis')")
    print("  2. Ada tanggalnya")
    pilih = ask("Pilihan (1/2, Enter=1)", allow_empty=True)
    if pilih != "2":
        return None

    while True:
        tgl = ask("  Tanggal (1-31)")
        bln = ask("  Bulan (1-12)")
        thn = ask("  Tahun (mis. 2026)")
        try:
            d = int(tgl); m = int(bln); y = int(thn)
            # validasi tanggal
            datetime(y, m, d)
            return f"{y:04d}-{m:02d}-{d:02d}T00:00:00+07:00"
        except ValueError:
            print("  ⚠  Tanggal tidak valid, coba lagi.")


def ask_notif_image():
    """Tanya gambar notifikasi chapter baru (Discord & Facebook). Return 'page1'/'cover'."""
    print()
    print("Gambar notifikasi chapter baru (Discord & Facebook):")
    print("  1. Halaman 1 chapter (default)")
    print("  2. Cover manga")
    pilih = ask("Pilihan (1/2, Enter=1)", allow_empty=True)
    return "cover" if pilih == "2" else "page1"


def hapus_webp(ch_dir):
    files = get_webp_files(ch_dir)
    for f in files:
        f.unlink()
    return len(files)


def _write_manga_meta(title_dir, notif_image="page1"):
    """Tulis meta.json kosongan untuk satu judul. Return path."""
    folder_id = title_dir.name
    status = infer_manga_status(title_dir)
    meta = {
        "id": folder_id,
        "title": "",
        "alt_title": "",
        "status": status,
        "type": "MANGA",
        "author": "",
        "artist": "",
        "genres": [],
        "description": "",
        "covers": [
            f"manga/{folder_id}/covers/cover.webp",
            f"manga/{folder_id}/covers/cover@tablet.webp",
            f"manga/{folder_id}/covers/cover@mobile.webp",
        ],
        "mangadex_url": "",
        "raw_url": "",
        # Gambar notifikasi chapter baru (Discord & Facebook): "page1" (default,
        # halaman 1 chapter) atau "cover" (cover manga). Kosongkan/hapus = page1.
        "notif_image": notif_image,
        "tamat_at_chapter": None,
        "hiatus_at_chapter": None,
        "chapter_views": {},
        "total_views": 0,
        "mangadex_cover": "",
    }
    meta_path = title_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return meta_path


def buat_manga_meta(manga_dir):
    while True:
        cls()
        header("Buat manga meta.json kosongan")

        titles = sorted([
            d for d in manga_dir.iterdir()
            if d.is_dir()
            and not d.name.startswith('.')
            and d.name not in ('__pycache__',)
            and not (d / "meta.json").exists()   # HANYA judul yang belum punya meta.json
        ])

        if not titles:
            print("✅ Semua judul sudah punya meta.json — tidak ada yang perlu dibuat.")
            input("\nTekan Enter untuk kembali...")
            return

        print(f"Judul tanpa meta.json ({len(titles)}):\n")
        for i, t in enumerate(titles, 1):
            print(f"  {i:>2}. {t.name}")
        print()
        print("  [nomor] pilih   ·   [A] buat SEMUA   ·   [B] kembali   ·   [X] keluar")
        print()

        pilih = ask("Pilih", allow_empty=True)

        if pilih.upper() == "B" or pilih == "":
            return

        if pilih.upper() == "A":
            notif_image = ask_notif_image()  # satu pilihan dipakai utk semua judul
            print()
            for t in titles:
                _write_manga_meta(t, notif_image)
                print(f"  ✅  {t.name}")
            print()
            input(f"{len(titles)} meta.json kosongan dibuat. Tekan Enter...")
            continue

        try:
            title_dir = titles[int(pilih) - 1]
        except (ValueError, IndexError):
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        meta_path = title_dir / "meta.json"
        if meta_path.exists():
            print(f"\n  ⚠  meta.json sudah ada di {title_dir.name}")
            timpa = input("  Timpa? (Y=ya / N=batal): ").strip().upper()
            if timpa != "Y":
                input("  Dibatalkan. Tekan Enter...")
                continue

        notif_image = ask_notif_image()
        _write_manga_meta(title_dir, notif_image)

        print(f"\n  ✅  meta.json dibuat: {meta_path}")
        print(f'      id: "{title_dir.name}"')
        print()
        input("Tekan Enter untuk lanjut...")


def main():
    manga_dir = Path(__file__).parent

    while True:
        cls()
        header()

        print("Menu utama:")
        print("  1. Buat/update chapter meta.json")
        print("  2. Buat manga meta.json kosongan")
        print("  X. Keluar")
        print()

        pilih_menu = ask("Pilih menu")

        if pilih_menu == "1":
            proses_chapter_menu(manga_dir)
        elif pilih_menu == "2":
            buat_manga_meta(manga_dir)
        else:
            input("  Pilihan tidak valid. Tekan Enter...")
            continue


def proses_semua_judul(titles):
    """Batch: proses SEMUA chapter baru di SEMUA judul sekaligus (lock di chapter
    terbaru tiap judul, tanpa jadwal). Cocok untuk seed massal/banyak judul."""
    cls()
    header("Proses SEMUA judul (batch)")

    total = sum(len(pending_chapters(t)) for t in titles)
    print(f"{len(titles)} judul, total {total} chapter baru:\n")
    for t in titles:
        print(f"  • {t.name}  ({len(pending_chapters(t))} chapter)")
    print()

    lock_input = ask("Lock hours utk chapter TERBARU tiap judul (Enter=0/gratis)", allow_empty=True)
    try:
        lock_hours = int(lock_input) if lock_input else 0
    except ValueError:
        lock_hours = 0

    print()
    print("⚠️  PERINGATAN: pastikan SEMUA webp sudah di-upload ke R2 via Mountain Duck!")
    print("    Script akan buat meta.json lalu MENGHAPUS semua .webp.")
    print()
    konfirmasi = input("Sudah upload R2? Lanjut proses SEMUA judul? (Y=ya / N=batal): ").strip().upper()
    if konfirmasi != "Y":
        print("\nDibatalkan.")
        input("Tekan Enter...")
        return

    print()
    grand_ok = 0
    grand_skip = 0
    for t in titles:
        chs = pending_chapters(t)
        if not chs:
            continue
        newest = max(chs, key=lambda d: chapter_sort_key(d.name))
        ok = 0
        for ch in chs:
            is_newest = ch == newest
            berhasil, info = proses_chapter(ch, lock_hours if is_newest else 0, None)
            if berhasil:
                ok += 1
                grand_ok += 1
                if (ch / "meta.json").exists():
                    hapus_webp(ch)
            else:
                grand_skip += 1
                print(f"  ⚠   {t.name}/{ch.name}  →  {info}")
        print(f"  ✅  {t.name}  →  {ok} chapter (webp dihapus)")

    print()
    print(f"Selesai! {grand_ok} chapter diproses di {len(titles)} judul, {grand_skip} dilewati.")
    input("\nTekan Enter untuk kembali...")


def proses_chapter_menu(manga_dir):
    while True:
        cls()
        header()

        # ── Pilih judul ────────────────────────────────────
        titles = sorted([
            d for d in manga_dir.iterdir()
            if d.is_dir()
            and not d.name.startswith('.')
            and d.name not in ('__pycache__',)
            and not d.suffix == '.py'
            and pending_chapters(d)   # HANYA judul yang punya chapter belum diproses
        ])

        if not titles:
            print("✅ Tidak ada chapter baru di judul mana pun (semua sudah punya meta.json).")
            input("\nTekan Enter untuk kembali...")
            return

        print(f"Judul dengan chapter baru ({len(titles)}):\n")
        for i, t in enumerate(titles, 1):
            print(f"  {i:>2}. {t.name}  ({len(pending_chapters(t))} chapter baru)")
        print()
        print("  [nomor] pilih   ·   [A] SEMUA judul   ·   [B] kembali   ·   [X] keluar")
        print()

        pilih = ask("Pilih", allow_empty=True)
        if pilih.upper() == "B" or pilih == "":
            return
        if pilih.upper() == "A":
            proses_semua_judul(titles)
            continue
        try:
            title_dir = titles[int(pilih) - 1]
        except (ValueError, IndexError):
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        # ── Cari chapter yang ada webp ─────────────────────
        while True:
            cls()
            header(f"Judul: {title_dir.name}")

            chapter_dirs = pending_chapters(title_dir)

            if not chapter_dirs:
                print("✅ Tidak ada chapter baru (semua sudah punya meta.json).")
                input("Tekan Enter untuk kembali pilih judul...")
                break

            print(f"Chapter baru di {title_dir.name} ({len(chapter_dirs)}):\n")
            for i, ch in enumerate(chapter_dirs, 1):
                print(f"  {i:>2}. {ch.name}  ({count_webp(ch)} hal)")

            print()
            print("  [nomor/koma] pilih   ·   [0 / Enter] semua   ·   [B] kembali   ·   [X] keluar")
            print()

            pilih_ch = ask("Pilih", allow_empty=True)

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

            # ── Jadwal rilis berikutnya (chapter terbaru saja) ─
            next_update = ask_next_update()
            # chapter terbaru = nomor terbesar di antara yang dipilih
            newest_ch = max(selected, key=lambda d: chapter_sort_key(d.name))

            # ── PERINGATAN R2 ──────────────────────────────
            cls()
            header(f"Judul: {title_dir.name}")
            print("⚠️  PERINGATAN PENTING!")
            print("-" * 55)
            print("Pastikan SEMUA file webp dari chapter berikut")
            print("sudah di-upload ke R2 via Mountain Duck!")
            print()
            for ch in selected:
                pages = count_webp(ch)
                print(f"  • {ch.name}  ({pages} halaman)")
            print()
            print("Setelah upload R2 selesai, script akan:")
            print("  1. Membuat meta.json di dalam tiap folder chapter")
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
                # Bulk: buat semua meta.json dulu, baru hapus semua webp
                print("Membuat meta.json...")
                for ch in selected:
                    is_newest = ch == newest_ch
                    berhasil, info = proses_chapter(
                        ch,
                        lock_hours if is_newest else 0,
                        next_update if is_newest else None,
                    )
                    if berhasil:
                        print(f"  ✅  Chapter {ch.name}  →  meta.json ({info} hal)")
                        ok += 1
                    else:
                        print(f"  ⚠   Chapter {ch.name}  →  {info}")
                        skip += 1

                print()
                print("Menghapus file .webp...")
                for ch in selected:
                    if (ch / "meta.json").exists():
                        jumlah = hapus_webp(ch)
                        if jumlah > 0:
                            print(f"  🗑   Chapter {ch.name}  →  {jumlah} file dihapus")

            else:
                # Satuan: satu per satu tanya konfirmasi hapus
                for ch in selected:
                    is_newest = ch == newest_ch
                    berhasil, info = proses_chapter(
                        ch,
                        lock_hours if is_newest else 0,
                        next_update if is_newest else None,
                    )
                    if berhasil:
                        print(f"  ✅  Chapter {ch.name}  →  meta.json ({info} hal)")
                        ok += 1
                        hapus = input(f"      Hapus .webp chapter {ch.name}? (Y/N): ").strip().upper()
                        if hapus == "Y":
                            jumlah = hapus_webp(ch)
                            print(f"      🗑   {jumlah} file dihapus")
                    else:
                        print(f"  ⚠   Chapter {ch.name}  →  {info}")
                        skip += 1

            print()
            print(f"Selesai! {ok} chapter diproses, {skip} dilewati.")
            print()
            lagi = input("Proses judul/chapter lain? (Y=ya / Enter=kembali menu): ").strip().upper()
            if lagi != "Y":
                return


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        input("\nTerjadi error. Tekan Enter untuk keluar...")
