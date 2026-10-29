#!/usr/bin/env python3
"""Henter programoversikten og skriver data/guide.json.

NRK hentes fra NRKs åpne program-API. TV 2, TVNorge og TV3 hentes fra
tvguide.vg.no, med data/manual/<id>.json som overstyring (se README.md). Med --demo fylles kanaler uten data
med eksempelprogram, bare for forhåndsvisning.
"""
import json, re, sys, time, urllib.request
import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OSLO = ZoneInfo("Europe/Oslo")
CHANNELS = [  # id, navn, farge
    ("nrk1", "NRK1", "#5aa0e8"),
    ("tv2", "TV 2", "#ff6b61"),
    ("tvnorge", "TVNorge", "#b78cf0"),
    ("tv3", "TV3", "#4fd1c5"),
    ("tv2zebra", "TV 2 Zebra", "#ffb347"),
    ("fem", "FEM", "#f78fb3"),
]
NRK_IDS = {"nrk1": "nrk1"}
VG_SLUGS = {"tv2": "tv2-direkte", "tvnorge": "tvnorge", "tv3": "tv3", "tv2zebra": "tv2-zebra", "fem": "fem"}  # kanaler hentet fra tvguide.vg.no
UA = "tvguide-privat/1.0 (personlig bruk, henter to ganger i døgnet)"


def days():
    today = dt.datetime.now(OSLO).date()
    return [today + dt.timedelta(days=n) for n in (-1, 0, 1)]


def ms(value):
    return int(re.search(r"(-?\d+)", value).group(1)) // 1000


def seconds(duration):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?", duration or "")
    h, mi, s = (float(x) if x else 0 for x in m.groups()) if m else (0, 0, 0)
    return int(h * 3600 + mi * 60 + s)


def fetch_nrk(nrk_id):
    seen = {}
    for day in days():
        url = f"https://psapi.nrk.no/epg/{nrk_id}?date={day.isoformat()}"
        req = urllib.request.Request(url, headers={"User-Agent": "tvguide-privat/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        for block in data:
            for e in block.get("entries", []):
                if not e.get("plannedStart"):
                    continue
                start = ms(e["plannedStart"])
                title = (e.get("seriesTitle") or e.get("title") or "").strip()
                genre = (e.get("category") or {}).get("displayValue", "")
                seen[start] = [start, start + seconds(e.get("duration")), title, genre]
    return finish(list(seen.values()))


def fetch_vg(slug):
    """Leser programlisten som ligger i HTML-siden til tvguide.vg.no (Next.js-data)."""
    seen = {}
    for day in days():
        url = f"https://tvguide.vg.no/kanal/{slug}/{day.isoformat()}"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            html = r.read().decode("utf-8")
        m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        if not m:
            raise RuntimeError("fant ikke programdata i siden")
        page = json.loads(m.group(1))["props"]["pageProps"]
        for e in page["initialTvSchedule"]["listings"]:
            title = (e.get("title") or {}).get("title", "").strip()
            title = title or ((e.get("episode") or {}).get("name") or "").strip() or "Program uten navn"
            genres = (e.get("title") or {}).get("genres") or []
            start = int(dt.datetime.fromisoformat(e["startsAt"]).timestamp())
            end = int(dt.datetime.fromisoformat(e["endsAt"]).timestamp())
            seen[start] = [start, end, title, genres[0]["slug"].replace("-", " ").capitalize() if genres else ""]
        time.sleep(1.5)  # vær snill mot VG
    return finish(list(seen.values()))


def finish(programs):
    """Sorter og lukk hull: et program slutter senest når neste starter."""
    programs.sort(key=lambda p: p[0])
    for a, b in zip(programs, programs[1:]):
        if a[1] > b[0] or b[0] - a[1] < 600:
            a[1] = b[0]
    return programs


def load_manual(cid):
    path = ROOT / "data" / "manual" / f"{cid}.json"
    if not path.exists():
        return []
    out = []
    for start, end, title, genre in json.loads(path.read_text()):
        out.append([int(dt.datetime.fromisoformat(start).timestamp()),
                    int(dt.datetime.fromisoformat(end).timestamp()), title, genre])
    return finish(out)


def demo(cid):
    template = json.loads((ROOT / "tools" / "demo_template.json").read_text()).get(cid)
    if not template:
        return []
    out = []
    for day in days():
        for i, (hhmm, title, genre) in enumerate(template):
            h, m = map(int, hhmm.split(":"))
            start = dt.datetime(day.year, day.month, day.day, h % 24, m, tzinfo=OSLO)
            start += dt.timedelta(days=h // 24)
            out.append([int(start.timestamp()), 0, title, genre])
    out.sort(key=lambda p: p[0])
    for a, b in zip(out, out[1:]):
        a[1] = b[0]
    out[-1][1] = out[-1][0] + 3600
    return out


def main():
    use_demo = "--demo" in sys.argv
    channels = []
    for cid, name, color in CHANNELS:
        is_demo = False
        try:
            if cid in NRK_IDS:
                programs = fetch_nrk(NRK_IDS[cid])
            else:
                programs = load_manual(cid)  # egen fil har forrang
                if not programs and cid in VG_SLUGS:
                    programs = fetch_vg(VG_SLUGS[cid])
        except Exception as exc:  # nettfeil skal ikke stoppe de andre kanalene
            print(f"Feil for {name}: {exc}", file=sys.stderr)
            programs = []
        if not programs and use_demo:
            programs, is_demo = demo(cid), True
        print(f"{name}: {len(programs)} programmer{' (demo)' if is_demo else ''}")
        channels.append({"id": cid, "name": name, "color": color, "demo": is_demo, "programs": programs})
    out = ROOT / "data" / "guide.json"
    out.write_text(json.dumps({"updated": int(time.time()), "channels": channels}, ensure_ascii=False, separators=(",", ":")))
    print("Skrev", out)


if __name__ == "__main__":
    main()
