#!/usr/bin/env python3
"""Inline the webfonts into docs/spec.html.

The artifact host blocks requests to external hosts, so the display and UI
faces have to travel with the page as base64 @font-face rules. This fetches
the latin subsets once and substitutes them for the /*FONTS*/ marker in
docs/spec.src.html.
"""

import base64
import pathlib
import re
import urllib.request

HERE = pathlib.Path(__file__).parent
CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Gochi+Hand&family=Nunito:wght@400;700;800&display=swap"
)
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def get(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA})
    ).read()


def face(family, weight, url):
    b64 = base64.b64encode(get(url)).decode()
    return (
        f"@font-face{{font-family:'{family}';font-style:normal;"
        f"font-weight:{weight};font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64}) format('woff2')}}"
    )


def main():
    css = get(CSS_URL).decode()
    urls = {}
    for label, block in re.findall(r"/\* (\S+) \*/\s*@font-face \{(.*?)\}", css, re.S):
        if label != "latin":
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        urls.setdefault(family, re.search(r"url\((https[^)]+)\)", block).group(1))

    # Nunito ships as a variable font, so one file covers every weight we use.
    faces = "\n".join(
        [
            face("Gochi Hand", "400", urls["Gochi Hand"]),
            face("Nunito", "100 900", urls["Nunito"]),
        ]
    )

    src = (HERE / "spec.src.html").read_text()
    if "/*FONTS*/" not in src:
        raise SystemExit("spec.src.html is missing the /*FONTS*/ marker")
    (HERE / "spec.html").write_text(src.replace("/*FONTS*/", faces))
    print(f"wrote docs/spec.html ({len(faces)} bytes of font data)")


if __name__ == "__main__":
    main()
