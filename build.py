#!/usr/bin/env python3
"""Archway restaurant — sestaví statický web ze šablon (src/) a dat (_data/*.json) do site/.

Obsah (polední menu, jídelní lístek, otevírací doba, akce, poukazy, galerie, kariéra, kontakty)
je v _data/*.json — připraveno pro společnou administraci webhunter-admin (/admin/).
Obrázek v datech: klíč z assets/img (např. "bar") nebo cesta nahraná v administraci ("img/uploads/…").
"""
import datetime as dt
import hashlib, json, os, pathlib, re, shutil
from jinja2 import Environment, FileSystemLoader

ROOT = pathlib.Path(__file__).parent
SRC, CONTENT, OUT = ROOT / 'src', ROOT / '_data', ROOT / 'site'
BASE_URL = 'https://webhunter-navrhy.github.io/archway/'

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / 'assets', OUT / 'assets')
for f in ('style.css', 'main.js', 'favicon.svg'):
    shutil.copy(SRC / f, OUT / 'assets' / f)
if (ROOT / 'img').exists():  # fotky nahrané v administraci
    shutil.copytree(ROOT / 'img', OUT / 'img', ignore=shutil.ignore_patterns('.gitkeep'))
if (ROOT / 'admin').exists():
    shutil.copytree(ROOT / 'admin', OUT / 'admin')


def svg_parts(name):
    s = (ROOT / 'brand' / f'{name}.svg').read_text()
    return {'vb': re.search(r'viewBox="([^"]+)"', s).group(1), 'body': s[s.index('<g'):s.rindex('</svg>')]}


h = lambda p: hashlib.md5((OUT / p).read_bytes()).hexdigest()[:8]
data = {k: json.loads((CONTENT / f'{k}.json').read_text()) for k in
        ('site', 'tydenni_menu', 'menu', 'akce', 'kariera', 'galerie')}
sizes = json.loads((ROOT / 'assets/img/sizes.json').read_text())

DNY = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']
DNY_KR = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
d = lambda s: dt.date.fromisoformat(s)


def price_min(cat):
    nums = [int(n) for it in cat['items'] for n in re.findall(r'\d+', str(it['price']))]
    return min(nums) if nums else 0


def tel(s):
    return re.sub(r'[^\d+]', '', s)


def ld_json(site):
    days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return json.dumps({
        '@context': 'https://schema.org', '@type': 'Restaurant', 'name': site['name'],
        'url': BASE_URL, 'telephone': site['phone'], 'email': site['email'],
        'image': BASE_URL + 'assets/img/arkady.jpg', 'hasMenu': BASE_URL + 'menu/',
        'acceptsReservations': 'True',
        'address': {'@type': 'PostalAddress', 'streetAddress': site['street'], 'postalCode': site['zip'],
                    'addressLocality': site['city'], 'addressCountry': 'CZ'},
        'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification',
                                       'dayOfWeek': [days[x] for x in r['days']],
                                       'opens': r['from'], 'closes': '23:59' if r['to'] == '24:00' else r['to']}
                                      for r in site['hours']],
        'sameAs': [site['facebook'], site['instagram']],
    }, ensure_ascii=False)


common = dict(
    data,
    sizes=sizes,
    v={'css': h('assets/style.css'), 'js': h('assets/main.js'), 'fav': h('assets/favicon.svg')},
    logo={k: svg_parts(f'logo-{k}') for k in ('full', 'mark', 'word')},
    nav=[('poledni', 'tydenni-menu/', 'Polední menu'), ('menu', 'menu/', 'Jídelní lístek'),
         ('akce', 'oslavy-a-akce/', 'Oslavy a catering'), ('galerie', 'fotogalerie/', 'Galerie'),
         ('kariera', 'hledame-zamestnance/', 'Práce u nás'), ('kontakt', 'kontakt/', 'Kontakt')],
    ld=ld_json(data['site']),
    tel=tel,
    price_min=price_min,
    base_url=BASE_URL,
)
env = Environment(loader=FileSystemLoader([str(SRC), str(SRC / 'pages')]), autoescape=False,
                  trim_blocks=True, lstrip_blocks=True)
env.filters['wd'] = lambda s: DNY[d(s).weekday()]
env.filters['wdk'] = lambda s: DNY_KR[d(s).weekday()]
env.filters['dm'] = lambda s: f'{d(s).day}. {d(s).month}.'
env.filters['dmy'] = lambda s: f'{d(s).day}. {d(s).month}. {d(s).year}'
env.filters['kc'] = lambda p: f'{p}&nbsp;Kč'.replace(' / ', '&thinsp;/&thinsp;')
env.filters['tel'] = tel
env.filters['paras'] = lambda t: ''.join(f'<p>{x.strip()}</p>' for x in str(t or '').split('\n') if x.strip())

# česká typografie: jednopísmenné předložky a spojky nenechávat na konci řádku (jen v textu, ne v tagách/skriptech)
_NB = re.compile(r'(?<![\w&;])([vszkouiaVSZKOUIA]) (?=\S)')


def nbsp(html):
    parts = re.split(r'(<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<[^>]+>)', html, flags=re.S)
    return ''.join(x if i % 2 else _NB.sub(r'\1&nbsp;', x) for i, x in enumerate(parts))


for page in sorted((SRC / 'pages').glob('*.html')):
    meta = json.loads(re.match(r'\{#\s*(\{.*?\})\s*#\}', page.read_text(), re.S).group(1))
    depth = meta['out'].count('/')
    html = env.get_template(page.name).render(
        common, root=meta.get('root', '../' * depth), page_id=meta['id'], page_title=meta['title'], page_desc=meta['desc'],
        canonical=BASE_URL + meta['out'].replace('index.html', ''))
    out = OUT / meta['out']
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(nbsp(html))
    print('✓', meta['out'])

imgs = sorted(f'assets/img/{k}' for k in sizes)
if (OUT / 'img').exists():
    imgs += sorted(str(f.relative_to(OUT)) for f in (OUT / 'img').rglob('*') if f.is_file())
(OUT / 'images.json').write_text(json.dumps(imgs, ensure_ascii=False))
(OUT / 'version.json').write_text(json.dumps({'sha': os.environ.get('GITHUB_SHA', 'local')}))
if (OUT / 'admin/index.html').exists():
    ai = OUT / 'admin/index.html'
    ai.write_text(ai.read_text().replace('__V_ACSS__', h('admin/admin.css')).replace('__V_AJS__', h('admin/admin.js')))
(OUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(OUT / '.nojekyll').touch()
