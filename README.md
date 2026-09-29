# Archway restaurant — návrh webu

Restaurace na Velkém náměstí 144/14a, Hradec Králové. Statický web generovaný z dat (návrh WebHunter, `noindex`).

## Jak web funguje
- **Obsah** je v `_data/*.json`:
  - `site.json` — kontakty, adresa, sítě, otevírací doba (`hours`) a výjimky (`exceptions`, např. svátky)
  - `tydenni_menu.json` — polední nabídka: rozsah týdne, dny s datem (ISO), polévka, jídla a ceny; `closed` = poznámka místo menu
  - `menu.json` — jídelní lístek po kategoriích, česky i anglicky (`name_en`, `desc_en`), volitelně `img` a `tag`
  - `akce.json` — oslavy / firemní akce / catering + dárkové poukazy (hodnoty)
  - `galerie.json` — fotky galerie (klíč z `assets/img` nebo `img/uploads/…` z administrace)
  - `kariera.json` — volné pozice
- **Šablony** v `src/` (Jinja), styly `src/style.css`, skripty `src/main.js` (bez knihoven, nativní scroll).
- `python3 build.py` → hotový web do `site/` (s `?v=` hashi proti cache, `version.json`, `images.json`).
- Každý push do `main` web sestaví a nasadí GitHub Actions (`.github/workflows/deploy.yml`).
- Na webu se automaticky zvýrazní dnešní den poledního menu a zobrazí „Právě otevřeno / Zavřeno“ podle `site.json` (čas Europe/Prague).

## Administrace
Data jsou připravená pro společný backend `~/webhunter-admin` (zápis jen do `_data/*.json` a `img/uploads/`).
Napojení: přidat `admin/` (vzor astudio), `tools/add-site.sh archway webhunter-navrhy/archway "Archway restaurant"`.

## Podklady
- Logo: vektorizováno (potrace) z profilové fotky na Facebooku restaurace → `brand/logo-{full,mark,word}.svg`.
- Fotky: všechny z jejich webu archwayrestaurant.cz (úvod + fotogalerie), převedené do WebP 800/1600 px.
- Texty, ceny, otevírací doba a polední menu (28. 9. – 2. 10. 2026) z jejich webu, jen upravená velká písmena a zjevné překlepy.
- Formuláře rezervace a poptávky jsou v návrhu jen ukázka (nic neodesílají).
