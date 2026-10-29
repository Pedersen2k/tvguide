#!/usr/bin/env python3
"""Lager én HTML-fil med alt innebygd, til forhåndsvisning. Bruk: build_preview.py ut.html"""
import sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
css, js, guide = (R/"style.css").read_text(), (R/"app.js").read_text(), (R/"data"/"guide.json").read_text()
html = (R/"index.html").read_text()
html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
html = html.replace('<script src="app.js"></script>', f"<script>window.GUIDE={guide};</script><script>{js}</script>")
html = html.replace('<link rel="manifest" href="manifest.json">\n', "").replace('<link rel="icon" href="icon.svg" type="image/svg+xml">\n', "")
Path(sys.argv[1]).write_text(html)
