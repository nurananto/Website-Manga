#!/usr/bin/env python3
"""
Manga Chapter Meta.json Generator
- Taruh di dalam folder manga/, double klik untuk jalankan.
- Buat meta.json langsung di dalam folder chapter (25/, 26/, dll)
- Hapus file webp setelah konfirmasi upload R2
"""

import os
import sys
import json
import re
import traceback
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Paksa stdout/stderr UTF-8 dengan fallback "replace" (bukan crash) kalau
# encoding-nya gak dukung — jaga-jaga buat emoji (✅⚠❌📚 dkk) di layar. Biasa
# gak masalah pas double klik (Command Prompt asli otomatis Unicode-aman),
# tapi kalau script ini kebuka lewat terminal lain/IDE/redirect yang codepage-nya
# gak dukung, TANPA ini bisa crash UnicodeEncodeError di tengah jalan. Coba-saja
# — .reconfigure() gak ada di Python sangat lama, gagal diam-diam kalau begitu.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

WIB = timezone(timedelta(hours=7))
CHAPTER_NUMBER_RE = re.compile(r'^(?:chapter|ch|chap|episode|ep|part)?\s*[-_. ]*\s*(\d+(?:\.\d+)?)\s*$', re.IGNORECASE)
STRICT_NUMBER_RE = re.compile(r'^\d+(?:\.\d+)?$')
ONESHOT_RE = re.compile(r'^(?:one[-_. ]*shot|oneshot)$', re.IGNORECASE)
# Folder "Prolog"/"Prolog 1"/"Prolog-1" & "Epilog"/dst — chapter_number-nya
# jadi string slug ("prolog", "prolog-1", ...) BUKAN angka, biar aman dipakai
# di URL/R2 key (lihat chapterSortValue di src/utils.js & scripts/build-catalog.js
# utk urutan: Prolog selalu di depan chapter bernomor, Epilog selalu di
# belakang, terlepas urutan folder di disk).
PROLOG_RE = re.compile(r'^prolog[-_. ]*(\d+(?:\.\d+)?)?$', re.IGNORECASE)
EPILOG_RE = re.compile(r'^epilog[-_. ]*(\d+(?:\.\d+)?)?$', re.IGNORECASE)


# ── Warna terminal (ANSI) ────────────────────────────────────────────────
# Best-effort doang — banyak pemakai script ini pemula yang buka lewat
# Command Prompt bawaan Windows, dan CMD lama gak render kode warna ANSI
# secara default. Trik di bawah nyalain "Virtual Terminal Processing" pakai
# ctypes (BUKAN pip install apa pun — tetap stdlib-only, "double klik
# langsung jalan" seperti sebelumnya). Kalau gagal (OS lama / bukan
# terminal asli), otomatis balik ke teks polos, jadi tetap kebaca normal,
# cuma gak berwarna.
def _enable_ansi():
    if os.name != 'nt':
        return True
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_uint32()
        if not kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            return False
        ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
        return bool(kernel32.SetConsoleMode(handle, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING))
    except Exception:
        return False


USE_COLOR = _enable_ansi() and not os.environ.get('NO_COLOR')


def _c(code, text):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text


def bold(t):    return _c('1', t)
def dim(t):     return _c('2', t)
def cyan(t):    return _c('36', t)
def green(t):   return _c('32', t)
def yellow(t):  return _c('33', t)
def red(t):     return _c('31', t)
def magenta(t): return _c('35', t)


def ok(msg):
    print(f"  {green('✅')}  {msg}")


def warn(msg):
    print(f"  {yellow('⚠')}   {msg}")


def err(msg):
    print(f"  {red('❌')}  {msg}")


def status_color(status):
    """Warna label status manga (ONGOING/HIATUS/TAMAT/ONESHOT) di daftar judul."""
    return {
        'ONGOING': green,
        'HIATUS': yellow,
        'TAMAT': red,
        'ONESHOT': magenta,
    }.get(status, dim)


def _fmt_sub_number(raw):
    """'1' / '1.0' / '2.5' -> '1' / '1' / '2.5' (buang .0 kalau bulat)."""
    f = float(raw)
    return str(int(f)) if f == int(f) else str(f)


def _prolog_epilog_slug(match, base):
    sub = match.group(1)
    return base if not sub else f"{base}-{_fmt_sub_number(sub)}"


def display_label_for_special(chapter_number):
    """chapter_number string ('oneshot'/'prolog'/'prolog-1'/'epilog-2') -> label
    tampilan ('Oneshot'/'Prolog'/'Prolog 1'/'Epilog 2'). None kalau bukan salah
    satu dari itu (chapter bernomor biasa)."""
    if chapter_number == "oneshot":
        return "Oneshot"
    if isinstance(chapter_number, str) and "-" in chapter_number:
        base, sub = chapter_number.split("-", 1)
        if base in ("prolog", "epilog"):
            return f"{base.capitalize()} {sub}"
    if chapter_number in ("prolog", "epilog"):
        return chapter_number.capitalize()
    return None

def now_wib():
    return datetime.now(WIB).strftime("%Y-%m-%dT%H:%M:%S+07:00")


def extract_chapter_number(name):
    text = name.strip()
    if ONESHOT_RE.match(text):
        return "oneshot"

    m = PROLOG_RE.match(text)
    if m:
        return _prolog_epilog_slug(m, "prolog")
    m = EPILOG_RE.match(text)
    if m:
        return _prolog_epilog_slug(m, "epilog")

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


def webp_dimensions(path):
    """Baca width/height dari HEADER file WEBP tanpa dependency eksternal
    (Pillow, dll) — script ini sengaja stdlib-only ("double klik langsung
    jalan", tanpa pip install apa pun), jadi parsing manual sesuai spek
    WebP publik (RIFF container: VP8X = extended, VP8 = lossy, VP8L =
    lossless), bukan pakai library gambar.
    Return (width, height) atau None kalau gagal (format gak dikenal/corrupt
    /truncated) — dipakai reader buat reserve ruang PERSIS per halaman
    (cegah CLS), BUKAN sesuatu yang kritis kalau gagal: reader fallback ke
    tebakan 2:3 spt sebelumnya buat halaman yang None.
    """
    try:
        with open(path, "rb") as f:
            header = f.read(30)
        if len(header) < 30 or header[0:4] != b"RIFF" or header[8:12] != b"WEBP":
            return None
        fourcc = header[12:16]
        if fourcc == b"VP8X":
            w = 1 + (header[24] | (header[25] << 8) | (header[26] << 16))
            h = 1 + (header[27] | (header[28] << 8) | (header[29] << 16))
            return (w, h) if w and h else None
        if fourcc == b"VP8 ":
            # 3 byte frame tag lalu 3 byte sync code wajib 0x9d 0x01 0x2a
            if header[23:26] != b"\x9d\x01\x2a":
                return None
            w = (header[26] | (header[27] << 8)) & 0x3FFF
            h = (header[28] | (header[29] << 8)) & 0x3FFF
            return (w, h) if w and h else None
        if fourcc == b"VP8L":
            if header[20] != 0x2F:
                return None
            b0, b1, b2, b3 = header[21], header[22], header[23], header[24]
            w = 1 + (((b1 & 0x3F) << 8) | b0)
            h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
            return (w, h) if w and h else None
        return None
    except Exception:
        return None


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
    if isinstance(val, str):
        return val
    return int(val) if val == int(val) else val


def chapter_sort_key(name):
    """Urutan tampilan LOKAL di menu ini — Prolog paling depan, lanjut chapter
    bernomor, Epilog paling belakang. (Beda dari urutan katalog LIVE di
    situs, yang dihitung chapterSortValue() di scripts/build-catalog.js /
    src/utils.js — dua-duanya sengaja disamakan skemanya.)"""
    val = extract_chapter_number(name)
    if val is None:
        return (0, -2)
    if val == "oneshot":
        return (0, -1)
    if isinstance(val, str) and "-" in val:
        base, sub = val.split("-", 1)
        if base == "prolog":
            return (-1, float(sub))
        if base == "epilog":
            return (2, float(sub))
    if val == "prolog":
        return (-1, 0)
    if val == "epilog":
        return (2, 0)
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
    line = "=" * 55
    print(cyan(line))
    print(cyan(bold("   📚 Manga Chapter Meta.json Generator")))
    if subtitle:
        print(bold(f"   ▸ {subtitle}"))
    print(cyan(line))
    print(dim("  Ketik X kapan saja untuk keluar"))
    print()


def proses_chapter(ch_dir, lock_hours, notif_image=None, unlock_date=None):
    webp_files = get_webp_files(ch_dir)
    pages = len(webp_files)
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

    # unlock_date baru (dari ask_lock_config, mode "sampai tanggal") menang
    # atas yang lama; kalau tidak ada input baru, pertahankan yang sudah ada
    # (selama lock_hours masih >0 — kalau dibuka jadi gratis, unlock_date lama
    # dibuang, bukan dipertahankan diam-diam).
    final_unlock = unlock_date or (existing_unlock if lock_hours > 0 else None)

    # Kalau ujungnya pakai unlock_date (baru ATAU dipertahankan), "lock_hours"
    # SENGAJA tidak ditulis sama sekali — dia cuma placeholder yang tidak
    # dipakai sama sekali (unlock_date selalu menang duluan di build-catalog.js),
    # dan kalau tetap ditulis (mis. "lock_hours": 0) orang yang buka meta.json
    # belakangan bisa salah baca "0 = gratis/tidak dikunci". Satu sumber
    # kebenaran per chapter, bukan dua field yang bisa kelihatan kontradiktif.
    special_title = display_label_for_special(chapter_number)
    # Rasio lebar:tinggi ASLI tiap halaman (bukan dipaksa seragam!) — dipakai
    # reader buat reserve ruang PERSIS per halaman sebelum gambarnya kemuat,
    # ganti tebakan generik 2:3 lama yang suka meleset (halaman spread lebar,
    # webtoon panjang, dll) dan bikin CLS (layout kegeser pas gambar asli
    # kemuat). null di elemen tertentu (gagal baca 1 file) tidak masalah —
    # reader fallback ke tebakan 2:3 cuma buat halaman itu.
    def ratio_of(p):
        dim = webp_dimensions(p)
        return round(dim[0] / dim[1], 4) if dim else None
    page_ratios = [ratio_of(p) for p in webp_files]
    meta = {
        "chapter_number": to_chapter_number(ch_dir.name),
        **({"title": special_title} if special_title else {}),
        **({} if final_unlock else {"lock_hours": lock_hours}),
        "pages": pages,
        **({"page_ratios": page_ratios} if any(page_ratios) else {}),
    }
    if existing_release:
        meta["release_date"] = existing_release
    if final_unlock:
        meta["unlock_date"] = final_unlock
    # Gambar notifikasi chapter INI (Discord & FB) — disimpan per-chapter, BUKAN
    # di meta.json manga, supaya tiap chapter bisa beda-beda tanpa manga meta.json
    # ikut berubah tiap kali proses chapter baru.
    if notif_image:
        meta["notif_image"] = notif_image

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return True, pages


def display_chapter_label(ch_dir):
    number = extract_chapter_number(ch_dir.name)
    if number is None:
        return ch_dir.name
    special = display_label_for_special(number)
    if special:
        return special
    return f"Chapter {int(number) if number == int(number) else number}"


def infer_manga_status(title_dir):
    has_oneshot_folder = any(
        d.is_dir() and ONESHOT_RE.match(d.name.strip())
        for d in title_dir.iterdir()
    )
    return "Oneshot" if has_oneshot_folder else "ONGOING"


def ask_lock_config():
    """Tanya cara kunci chapter — cuma 3 mode yang benar-benar dipakai (mode
    "sekian jam" dihapus, sudah nggak dipakai lagi). Return dict siap disebar
    ke proses_chapter(): {"lock_hours": int} atau
    {"lock_hours": 0, "unlock_date": iso_str}.

    unlock_date ini dibaca build-catalog.js sebagai OVERRIDE — kalau field itu
    ada di meta.json, lock_hours diabaikan sepenuhnya (lihat komentar
    "Override eksplisit" di scripts/build-catalog.js), jadi nilai lock_hours
    yang ditulis di sini cuma placeholder (0), bukan dipakai buat hitung apa-apa
    — dan proses_chapter() sendiri bakal skip nulis field itu sama sekali kalau
    unlock_date ada, biar nggak ambigu di meta.json.

    PENGINGAT: kebijakan saat ini, tanggal buka yang diinput di sini = tanggal
    buka SEBENARNYA + 1 minggu (lihat public/manga/NOTES.md). Jangan input
    tanggal buka aslinya mentah-mentah — tambah 7 hari dulu sebelum diketik.
    """
    print()
    print("Kunci chapter ini:")
    print("  1. Gratis, tidak dikunci (default)")
    print("  2. PERMANEN — dibuka manual nanti lewat meta.json")
    print("  3. Sampai TANGGAL tertentu (otomatis buka jam 00:00 WIB)")
    pilih = ask("Pilihan (1/2/3, Enter=1)", allow_empty=True)

    if pilih == "2":
        return {"lock_hours": -1}

    if pilih == "3":
        print("  ⏰  Ingat: tanggal buka = tanggal buka SEBENARNYA + 1 minggu.")
        while True:
            tgl = ask("  Tanggal buka (1-31)")
            bln = ask("  Bulan (1-12)")
            thn = ask("  Tahun (mis. 2026)")
            try:
                d = int(tgl); m = int(bln); y = int(thn)
                datetime(y, m, d)  # validasi tanggal
                iso = f"{y:04d}-{m:02d}-{d:02d}T00:00:00+07:00"
                print(f"  ✅  Akan terbuka otomatis: {d:02d}-{m:02d}-{y} 00:00 WIB")
                return {"lock_hours": 0, "unlock_date": iso}
            except ValueError:
                print("  ⚠  Tanggal tidak valid, coba lagi.")

    return {"lock_hours": 0}


def ask_notif_image():
    """Tanya gambar notifikasi chapter baru (Discord & Facebook).
    Return 'page1' / 'cover' / nomor halaman custom (str angka, mis. '5')."""
    print()
    print("Gambar notifikasi chapter baru (Discord & Facebook):")
    print("  1. Halaman 1 chapter (default)")
    print("  2. Cover manga")
    print("  3. Halaman tertentu (Imagexx.webp, kamu pilih nomornya)")
    pilih = ask("Pilihan (1/2/3, Enter=1)", allow_empty=True)
    if pilih == "2":
        return "cover"
    if pilih == "3":
        while True:
            nomor = ask("  Nomor halaman (mis. 5 utk Image05.webp)")
            if nomor.isdigit() and int(nomor) > 0:
                return nomor
            print("  ⚠  Nomor tidak valid, coba lagi.")
    return "page1"


def hapus_webp(ch_dir):
    files = get_webp_files(ch_dir)
    for f in files:
        f.unlink()
    return len(files)


def _write_manga_meta(title_dir, cover_locked=False):
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
        # 4 ukuran (desktop/tablet/mobile/thumb kartu grid kecil) — samain
        # persis skema SIZE_SIGNATURE di scripts/sync-covers.js. Buat manga
        # NORMAL (mangadex_url/raw_url terisi, bukan cover_locked) array ini
        # bakal ditimpa otomatis pas sync-covers.js jalan pertama kali, jadi
        # cuma placeholder. Tapi buat manga cover_locked (skip sync-covers.js
        # total), array ini yang DIPAKAI BENERAN — makanya harus 4 ukuran
        # lengkap dari awal, bukan cuma 3.
        "covers": [
            f"manga/{folder_id}/covers/cover.webp",
            f"manga/{folder_id}/covers/cover@tablet.webp",
            f"manga/{folder_id}/covers/cover@mobile.webp",
            f"manga/{folder_id}/covers/cover@thumb.webp",
        ],
        "mangadex_url": "",
        "raw_url": "",
        # cover_source_url (opsional, TIDAK ditambahkan di sini secara default —
        # cuma diisi manual kalau perlu): link GAMBAR LANGSUNG (bukan halaman
        # HTML) untuk cover sementara sebelum MangaDex ada — dipakai
        # scripts/sync-covers.js kalau raw_url tidak punya og:image yang valid
        # (mis. Amazon) atau og:image-nya bukan portrait. Field terpisah dari
        # raw_url biar raw_url tetap bisa diisi link raw baca beneran.
        # Gambar notifikasi chapter baru (Discord & Facebook): "cover" (default,
        # cover manga) atau "page1" (halaman 1 chapter).
        "notif_image": "cover",
        "tamat_at_chapter": None,
        "hiatus_at_chapter": None,
        "chapter_views": {},
        "total_views": 0,
        "mangadex_cover": "",
    }
    if cover_locked:
        # Cover MANUAL dikunci — scripts/sync-covers.js skip judul ini total
        # (gak akan pernah ganti cover-nya walau mangadex_url diisi belakangan).
        # Dipilih pas mau pertahankan cover_source_url manual selamanya karena
        # lebih disukai drpd cover MangaDex. Lihat guard-nya di sync-covers.js.
        meta["cover_locked"] = True
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
            ok("Semua judul sudah punya meta.json — tidak ada yang perlu dibuat.")
            input("\nTekan Enter untuk kembali...")
            return

        print(bold(f"Judul tanpa meta.json ({len(titles)}):") + "\n")
        for i, t in enumerate(titles, 1):
            print(f"  {cyan(f'{i:>2}')}. {t.name}")
        print()
        print(f"  {green('[nomor]')}  pilih")
        print(f"  {green('[A]')}      buat SEMUA")
        print(f"  {dim('[B]')}      kembali")
        print(f"  {red('[X]')}      keluar")
        print()

        pilih = ask("Pilih", allow_empty=True)

        if pilih.upper() == "B" or pilih == "":
            return

        if pilih.upper() == "A":
            print()
            for t in titles:
                _write_manga_meta(t)
                ok(t.name)
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
            print()
            warn(f"meta.json sudah ada di {title_dir.name}")
            timpa = input("  Timpa? (Y=ya / N=batal): ").strip().upper()
            if timpa != "Y":
                input("  Dibatalkan. Tekan Enter...")
                continue

        print()
        print(bold("  Kunci cover manual?"))
        print("  Kalau YA, cover yang kamu pasang sendiri nanti TIDAK AKAN PERNAH")
        print("  diganti otomatis dari MangaDex — walau mangadex_url belakangan diisi.")
        print("  Pilih ini cuma kalau kamu emang lebih suka cover manual drpd MangaDex.")
        kunci = input("  Kunci cover? (Y=ya / N=tidak, default N): ").strip().upper()

        _write_manga_meta(title_dir, cover_locked=(kunci == "Y"))

        print()
        ok(f"meta.json dibuat: {meta_path}")
        print(f'      id: "{title_dir.name}"')
        print()
        input("Tekan Enter untuk lanjut...")


def ask_status_chapter(label, current):
    """Tanya nomor CHAPTER (atau label Prolog/Epilog) utk status Hiatus/Tamat.
    Enter = pertahankan yang lama."""
    default_txt = f" (Enter=pertahankan '{current}')" if current is not None else " (Enter=kosongkan)"
    while True:
        val = ask(f"  Chapter mulai {label} (angka, atau Prolog/Epilog){default_txt}", allow_empty=True)
        if val == "":
            return current
        special = extract_chapter_number(val)
        if isinstance(special, str) and special != "oneshot":
            return special
        try:
            num = float(val)
            return int(num) if num == int(num) else num
        except ValueError:
            print("  ⚠  Nomor chapter tidak valid, coba lagi.")


def update_manga_status(manga_dir):
    """Update status manga (ONGOING/HIATUS/TAMAT/ONESHOT) pada meta.json yang
    sudah ada, sekaligus nomor chapter mulai hiatus/tamat kalau perlu."""
    while True:
        cls()
        header("Update status manga")

        titles = sorted([
            d for d in manga_dir.iterdir()
            if d.is_dir()
            and not d.name.startswith('.')
            and d.name not in ('__pycache__',)
            and (d / "meta.json").exists()   # HANYA judul yang SUDAH punya meta.json
        ])

        if not titles:
            warn("Belum ada judul dengan meta.json. Buat dulu lewat menu 2.")
            input("\nTekan Enter untuk kembali...")
            return

        print(bold(f"Judul dengan meta.json ({len(titles)}):") + "\n")
        for i, t in enumerate(titles, 1):
            try:
                meta = json.loads((t / "meta.json").read_text(encoding="utf-8"))
                status = meta.get("status", "?")
            except Exception:
                status = "?"
            colorize = status_color(status)
            print(f"  {cyan(f'{i:>2}')}. {t.name}  [{colorize(status)}]")
        print()
        print(f"  {green('[nomor]')}  pilih")
        print(f"  {dim('[B]')}      kembali")
        print(f"  {red('[X]')}      keluar")
        print()

        pilih = ask("Pilih", allow_empty=True)
        if pilih.upper() == "B" or pilih == "":
            return

        try:
            title_dir = titles[int(pilih) - 1]
        except (ValueError, IndexError):
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        meta_path = title_dir / "meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))

        cls()
        header(f"Judul: {title_dir.name}")
        current_status = meta.get('status', '?')
        print(f"Status sekarang : {status_color(current_status)(current_status)}")
        print(f"tamat_at_chapter: {meta.get('tamat_at_chapter')}")
        print(f"hiatus_at_chapter: {meta.get('hiatus_at_chapter')}")
        print()
        print(bold("Status baru:"))
        print(f"  {green('1')}. Ongoing")
        print(f"  {yellow('2')}. Hiatus")
        print(f"  {red('3')}. Tamat")
        print(f"  {magenta('4')}. Oneshot")
        print(f"  {dim('B')}. Batal")
        print()
        pilih_status = ask("Pilihan (1-4/B)")

        if pilih_status.upper() == "B":
            continue

        status_map = {"1": "ONGOING", "2": "HIATUS", "3": "TAMAT", "4": "ONESHOT"}
        if pilih_status not in status_map:
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        new_status = status_map[pilih_status]
        meta["status"] = new_status

        if new_status == "HIATUS":
            meta["hiatus_at_chapter"] = ask_status_chapter("HIATUS", meta.get("hiatus_at_chapter"))
        elif new_status == "TAMAT":
            meta["tamat_at_chapter"] = ask_status_chapter("TAMAT", meta.get("tamat_at_chapter"))
        elif new_status == "ONGOING":
            # ongoing lagi = hapus penanda hiatus/tamat lama
            meta["hiatus_at_chapter"] = None
            meta["tamat_at_chapter"] = None
        # ONESHOT: tidak butuh nomor chapter (cuma satu chapter), field
        # hiatus/tamat_at_chapter dibiarkan apa adanya.

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
            f.write("\n")

        print()
        ok(f"Status {title_dir.name} → {status_color(new_status)(new_status)}")
        input("\nTekan Enter untuk lanjut...")


# ── Menu 4: Edit info manga (meta.json yang sudah ada) ────────────────────
# Field-field profil/sumber yang gak ditangani menu 3 (status/tamat/hiatus) —
# mangadex_url, raw_url, cover_source_url, cover_locked, dan profil dasar.
EDITABLE_META_FIELDS = [
    ("title", "Judul (romaji)", "text"),
    ("alt_title", "Judul asli (kanji/hangul/dll)", "text"),
    ("author", "Author", "text"),
    ("artist", "Artist", "text"),
    ("genres", "Genre (pisah pakai koma)", "genres"),
    ("description", "Deskripsi/sinopsis", "text"),
    ("mangadex_url", "Link MangaDex", "text"),
    ("raw_url", "Link raw (comic-walker/manga-up/dll)", "text"),
    ("cover_source_url", "Link cover manual (gambar langsung)", "text"),
    ("cover_locked", "Kunci cover manual (jangan diganti MangaDex)", "bool"),
    ("notif_image", "Gambar notifikasi chapter baru (page1/cover/nomor)", "text"),
]


def _fmt_field_value(value, kind):
    if kind == "bool":
        return green("YA") if value else dim("TIDAK")
    if isinstance(value, list):
        return ", ".join(str(x) for x in value) if value else dim("(kosong)")
    s = "" if value is None else str(value)
    if s == "":
        return dim("(kosong)")
    return s[:66] + dim("…") if len(s) > 66 else s


def edit_manga_meta(manga_dir):
    """Edit field profil/sumber di meta.json manga yang SUDAH ADA — mangadex_url,
    raw_url, cover_source_url, cover_locked, genre, deskripsi, dll. Status
    (ongoing/hiatus/tamat) tetap lewat menu 3, biar gak ada 2 jalan buat 1 field
    yang bisa kelupaan salah satu."""
    while True:
        cls()
        header("Edit info manga (meta.json yang sudah ada)")

        titles = sorted([
            d for d in manga_dir.iterdir()
            if d.is_dir()
            and not d.name.startswith('.')
            and d.name not in ('__pycache__',)
            and (d / "meta.json").exists()   # HANYA judul yang SUDAH punya meta.json
        ])

        if not titles:
            warn("Belum ada judul dengan meta.json. Buat dulu lewat menu 2.")
            input("\nTekan Enter untuk kembali...")
            return

        print(bold(f"Judul dengan meta.json ({len(titles)}):") + "\n")
        for i, t in enumerate(titles, 1):
            try:
                meta = json.loads((t / "meta.json").read_text(encoding="utf-8"))
                status = meta.get("status", "?")
            except Exception:
                status = "?"
            colorize = status_color(status)
            print(f"  {cyan(f'{i:>2}')}. {t.name}  [{colorize(status)}]")
        print()
        print(f"  {green('[nomor]')}  pilih judul untuk diedit")
        print(f"  {dim('[B]')}      kembali")
        print(f"  {red('[X]')}      keluar")
        print()

        pilih = ask("Pilih", allow_empty=True)
        if pilih.upper() == "B" or pilih == "":
            return

        try:
            title_dir = titles[int(pilih) - 1]
        except (ValueError, IndexError):
            input("  Pilihan tidak valid. Tekan Enter...")
            continue

        meta_path = title_dir / "meta.json"

        # ── Submenu: edit field satu-satu, tersimpan langsung tiap field ──
        while True:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            cls()
            header(f"Edit: {title_dir.name}")

            print(bold("Field yang bisa diedit:") + "\n")
            for i, (key, label, kind) in enumerate(EDITABLE_META_FIELDS, 1):
                current = meta.get(key)
                if kind == "bool" and current is None:
                    current = False
                print(f"  {cyan(f'{i:>2}')}. {label:<46} : {_fmt_field_value(current, kind)}")
            print()
            print(f"  {green('[nomor]')}  edit field itu")
            print(f"  {dim('[B]')}      kembali ke daftar judul")
            print(f"  {red('[X]')}      keluar")
            print()

            pilih_field = ask("Pilih", allow_empty=True)
            if pilih_field.upper() == "B" or pilih_field == "":
                break

            try:
                key, label, kind = EDITABLE_META_FIELDS[int(pilih_field) - 1]
            except (ValueError, IndexError):
                input("  Pilihan tidak valid. Tekan Enter...")
                continue

            current = meta.get(key)
            if kind == "bool" and current is None:
                current = False

            print()
            print(f"  Nilai sekarang: {_fmt_field_value(current, kind)}")

            if key == "cover_locked":
                print(dim("  ℹ  YA = cover manual TIDAK PERNAH diganti otomatis dari"))
                print(dim("     MangaDex (dipakai scripts/sync-covers.js), walau"))
                print(dim("     mangadex_url terisi. TIDAK = perilaku normal."))

            if kind == "bool":
                jawab = input(f"  {label} — Y=ya / N=tidak (Enter=batal): ").strip().upper()
                if jawab not in ("Y", "N"):
                    input("  Dibatalkan. Tekan Enter...")
                    continue
                meta[key] = (jawab == "Y")
            elif kind == "genres":
                val = input(f"  {label} (Enter=batal): ").strip()
                if not val:
                    input("  Dibatalkan. Tekan Enter...")
                    continue
                meta[key] = [g.strip() for g in val.split(",") if g.strip()]
            else:
                val = input(f"  {label} baru (Enter=batal): ").strip()
                if val == "":
                    input("  Dibatalkan. Tekan Enter...")
                    continue
                meta[key] = val

            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2, ensure_ascii=False)
                f.write("\n")

            print()
            ok(f"{label} tersimpan.")
            input("Tekan Enter untuk lanjut...")


def main():
    manga_dir = Path(__file__).parent

    while True:
        cls()
        header()

        print(bold("Menu utama:"))
        print(f"  {green('1')}. Buat/update chapter meta.json")
        print(f"     {dim('→ chapter baru: upload halaman, kunci/jadwal, gambar notifikasi')}")
        print(f"  {green('2')}. Buat manga meta.json kosongan (judul baru)")
        print(f"     {dim('→ judul pertama kali ditambah ke situs')}")
        print(f"  {green('3')}. Update status manga (ongoing/hiatus/tamat/oneshot)")
        print(f"     {dim('→ ganti status + nomor chapter mulai hiatus/tamat')}")
        print(f"  {green('4')}. Edit info manga (mangadex_url, cover, genre, dll)")
        print(f"     {dim('→ judul yang SUDAH ADA: link MangaDex/raw, cover manual, dll')}")
        print(f"  {red('X')}. Keluar")
        print()

        pilih_menu = ask("Pilih menu")

        if pilih_menu == "1":
            proses_chapter_menu(manga_dir)
        elif pilih_menu == "2":
            buat_manga_meta(manga_dir)
        elif pilih_menu == "3":
            update_manga_status(manga_dir)
        elif pilih_menu == "4":
            edit_manga_meta(manga_dir)
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

    print("(Berlaku untuk chapter TERBARU tiap judul)")
    lock_cfg = ask_lock_config()
    lock_hours = lock_cfg["lock_hours"]
    unlock_date = lock_cfg.get("unlock_date")

    notif_image = ask_notif_image()

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
            berhasil, info = proses_chapter(
                ch, lock_hours if is_newest else 0, notif_image,
                unlock_date if is_newest else None,
            )
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
        print("  [nomor]  pilih")
        print("  [A]      SEMUA judul")
        print("  [B]      kembali")
        print("  [X]      keluar")
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
            print("  [nomor/koma]  pilih (bisa lebih dari satu, pisah koma)")
            print("  [0 / Enter]   semua")
            print("  [B]           kembali")
            print("  [X]           keluar")
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

            # ── Lock hours / tanggal buka ────────────────────
            lock_cfg = ask_lock_config()
            lock_hours = lock_cfg["lock_hours"]
            unlock_date = lock_cfg.get("unlock_date")

            # chapter terbaru = nomor terbesar di antara yang dipilih (masih
            # dipakai buat lock_hours/unlock_date — next_update sudah tidak ada
            # di sini, sekarang diisi otomatis lewat update_schedule/next_update
            # dari raw source, lihat scripts/build-catalog.js)
            newest_ch = max(selected, key=lambda d: chapter_sort_key(d.name))

            # ── Gambar notifikasi chapter baru (Discord & Facebook) ─
            notif_image = ask_notif_image()

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
                        notif_image,
                        unlock_date if is_newest else None,
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
                        notif_image,
                        unlock_date if is_newest else None,
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
