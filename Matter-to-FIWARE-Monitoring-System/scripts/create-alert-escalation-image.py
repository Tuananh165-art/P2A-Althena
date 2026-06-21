from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html, textwrap, json

root = Path.cwd()
assets = root / 'monitor-dashboard' / 'assets'
assets.mkdir(parents=True, exist_ok=True)

rows = [
    ('Normal', 'Safe data', 'Low risk', 'Continue monitoring'),
    ('Warning', 'Temperature, humidity, or power increases', 'Explain warning', 'Notify and inspect'),
    ('Critical', 'High temperature + high power + high humidity', 'Critical alert + response procedure', 'Request approval'),
    ('Action/Fallback', 'Approved or timeout reached', 'Simulated mitigation or escalation', 'Record ACK/ERROR'),
]
headers = ['Status level', 'Condition / Data', 'Processing / Explanation', 'Next step']

W, H = 1920, 1080
margin = 90
content_w = W - margin * 2
title_y = 92
subtitle_y = 148
table_x = margin
table_y = 220
header_h = 86
row_h = 158
col_ws = [330, 540, 510, 440]
scale = content_w / sum(col_ws)
col_ws = [int(w * scale) for w in col_ws]
col_ws[-1] = content_w - sum(col_ws[:-1])
colors = [
    ('#19a974', '#dffcf0', '#0d6b49'),
    ('#f5a623', '#fff3d8', '#8a5a00'),
    ('#ef4444', '#ffe1e1', '#9f1d1d'),
    ('#7c3aed', '#eee7ff', '#4c1d95'),
]

def wrap_svg_text(text, width_chars):
    if text == 'Action/Fallback':
        return ['Action/', 'Fallback']
    return textwrap.wrap(text, width=width_chars, break_long_words=False, replace_whitespace=False) or ['']

svg = []
svg.append(f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">Alert escalation process table</title>
<desc id="desc">Process table displayed before starting the demo: Normal → Safe data → Low risk → Continue monitoring; Warning → Temperature, humidity, or power increases → Explain warning → Notify and inspect; Critical → High temperature + high power + high humidity → Critical alert + response procedure → Request approval; Action/Fallback → Approved or timeout reached → Simulated mitigation or escalation → Record ACK/ERROR.</desc>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#101827"/>
    <stop offset="0.52" stop-color="#142133"/>
    <stop offset="1" stop-color="#0c1220"/>
  </linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.34"/>
  </filter>
</defs>
<rect width="1920" height="1080" fill="url(#bg)"/>
<circle cx="1660" cy="125" r="310" fill="#22405f" opacity="0.28"/>
<circle cx="170" cy="980" r="300" fill="#0e6f66" opacity="0.16"/>
<text x="{W/2}" y="{title_y}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="800" fill="#f8fafc">ALERT ESCALATION PROCESS TABLE</text>
<text x="{W/2}" y="{subtitle_y}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="#9fd8ff">Displayed before starting the demo</text>
<rect x="{table_x}" y="{table_y}" width="{content_w}" height="{header_h + row_h*len(rows)}" rx="28" fill="#f8fafc" filter="url(#shadow)"/>
<rect x="{table_x}" y="{table_y}" width="{content_w}" height="{header_h}" rx="28" fill="#1f2a44"/>
<rect x="{table_x}" y="{table_y+header_h-30}" width="{content_w}" height="30" fill="#1f2a44"/>
''')

x = table_x
for i, (hdr, cw) in enumerate(zip(headers, col_ws)):
    svg.append(f'<text x="{x + cw/2}" y="{table_y + 55}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="800" fill="#ffffff">{html.escape(hdr)}</text>')
    if i > 0:
        svg.append(f'<line x1="{x}" y1="{table_y}" x2="{x}" y2="{table_y + header_h + row_h*len(rows)}" stroke="#d7dee9" stroke-width="2"/>')
    x += cw

for r, row in enumerate(rows):
    y = table_y + header_h + r*row_h
    badge, light, dark = colors[r]
    svg.append(f'<rect x="{table_x}" y="{y}" width="{content_w}" height="{row_h}" fill="{light}" opacity="0.72"/>')
    if r > 0:
        svg.append(f'<line x1="{table_x}" y1="{y}" x2="{table_x + content_w}" y2="{y}" stroke="#d7dee9" stroke-width="2"/>')
    x = table_x
    for c, (txt, cw) in enumerate(zip(row, col_ws)):
        if c == 0:
            pill_x = x + 36
            pill_y = y + 45
            pill_w = cw - 72
            svg.append(f'<rect x="{pill_x}" y="{pill_y}" width="{pill_w}" height="68" rx="34" fill="{badge}"/>')
            lines = wrap_svg_text(txt, 18)
            if len(lines) == 1:
                svg.append(f'<text x="{x + cw/2}" y="{pill_y + 44}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="850" fill="#ffffff">{html.escape(lines[0])}</text>')
            else:
                for li, line in enumerate(lines[:2]):
                    svg.append(f'<text x="{x + cw/2}" y="{pill_y + 30 + li*28}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="850" fill="#ffffff">{html.escape(line)}</text>')
        else:
            arrow_x = x + 22
            mid_y = y + row_h/2
            svg.append(f'<path d="M {arrow_x} {mid_y-16} L {arrow_x+28} {mid_y} L {arrow_x} {mid_y+16}" fill="none" stroke="{dark}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>')
            lines = wrap_svg_text(txt, 31 if c == 1 else 30)
            text_x = x + 68
            start_y = mid_y - (len(lines)-1)*17 + 9
            for li, line in enumerate(lines[:3]):
                svg.append(f'<text x="{text_x}" y="{start_y + li*36}" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="740" fill="#102033">{html.escape(line)}</text>')
        x += cw

footer_y = table_y + header_h + row_h*len(rows) + 78
svg.append(f'<text x="{W/2}" y="{footer_y}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="650" fill="#cbd5e1">Normal → Warning → Critical → Approval/Timeout → ACK/ERROR</text>')
svg.append('</svg>')
svg_text = '\n'.join(svg)
svg_path = assets / 'alert-escalation-process.svg'
svg_path.write_text(svg_text, encoding='utf-8')

def font_path(name):
    candidates = [
        Path('/c/Windows/Fonts') / name,
        Path('C:/Windows/Fonts') / name,
        Path('/usr/share/fonts/truetype/dejavu') / name,
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None

seg_bold = font_path('segoeuib.ttf') or font_path('arialbd.ttf') or font_path('DejaVuSans-Bold.ttf')
seg = font_path('segoeui.ttf') or font_path('arial.ttf') or font_path('DejaVuSans.ttf')

def F(size, bold=False):
    return ImageFont.truetype(seg_bold if bold else seg, size=size)

img = Image.new('RGB', (W, H), '#101827')
d = ImageDraw.Draw(img)
for yy in range(H):
    ratio = yy / H
    r = int(16*(1-ratio) + 12*ratio)
    g = int(24*(1-ratio) + 18*ratio)
    b = int(39*(1-ratio) + 32*ratio)
    d.line([(0, yy), (W, yy)], fill=(r, g, b))
d.ellipse((1350, -185, 1970, 435), fill=(24, 50, 80))
d.ellipse((-120, 750, 480, 1350), fill=(12, 75, 70))
d.text((W/2, 78), 'ALERT ESCALATION PROCESS TABLE', fill='#f8fafc', font=F(54, True), anchor='mm')
d.text((W/2, 142), 'Displayed before starting the demo', fill='#9fd8ff', font=F(28, True), anchor='mm')
bbox = (table_x, table_y, table_x + content_w, table_y + header_h + row_h*len(rows))
d.rounded_rectangle((bbox[0], bbox[1]+18, bbox[2], bbox[3]+18), radius=28, fill='#080b12')
d.rounded_rectangle((bbox[0], bbox[1]+10, bbox[2], bbox[3]+10), radius=28, fill='#0b111c')
d.rounded_rectangle(bbox, radius=28, fill='#f8fafc')
d.rounded_rectangle((table_x, table_y, table_x+content_w, table_y+header_h), radius=28, fill='#1f2a44')
d.rectangle((table_x, table_y+header_h-30, table_x+content_w, table_y+header_h), fill='#1f2a44')
x = table_x
for i, (hdr, cw) in enumerate(zip(headers, col_ws)):
    d.text((x + cw/2, table_y + 52), hdr, fill='white', font=F(25, True), anchor='mm')
    if i > 0:
        d.line((x, table_y, x, table_y + header_h + row_h*len(rows)), fill='#d7dee9', width=2)
    x += cw

def wrap_pil(text, font, max_w):
    if text == 'Action/Fallback':
        return ['Action/', 'Fallback']
    words = text.split(' ')
    lines=[]; cur=''
    for w in words:
        test = (cur + ' ' + w).strip()
        if d.textlength(test, font=font) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

for r, row in enumerate(rows):
    y = table_y + header_h + r*row_h
    badge, light, dark = colors[r]
    d.rectangle((table_x, y, table_x+content_w, y+row_h), fill=light)
    if r > 0:
        d.line((table_x, y, table_x+content_w, y), fill='#d7dee9', width=2)
    x = table_x
    for c, (txt, cw) in enumerate(zip(row, col_ws)):
        if c == 0:
            pill_x = x + 36; pill_y = y + 45; pill_w = cw - 72
            d.rounded_rectangle((pill_x, pill_y, pill_x+pill_w, pill_y+68), radius=34, fill=badge)
            lines = wrap_pil(txt, F(24, True), pill_w-22)
            if len(lines) == 1:
                d.text((x+cw/2, pill_y+34), lines[0], fill='white', font=F(26, True), anchor='mm')
            else:
                d.text((x+cw/2, pill_y+24), lines[0], fill='white', font=F(23, True), anchor='mm')
                d.text((x+cw/2, pill_y+52), ' '.join(lines[1:]), fill='white', font=F(23, True), anchor='mm')
        else:
            mid_y = y + row_h/2
            ax = x+22
            d.line((ax, mid_y-16, ax+28, mid_y, ax, mid_y+16), fill=dark, width=7, joint='curve')
            font = F(28, True)
            lines = wrap_pil(txt, font, cw-90)
            start_y = mid_y - (len(lines)-1)*18
            for li, line in enumerate(lines[:3]):
                d.text((x+68, start_y + li*36), line, fill='#102033', font=font, anchor='lm')
        x += cw

footer_y = table_y + header_h + row_h*len(rows) + 76
d.text((W/2, footer_y), 'Normal → Warning → Critical → Approval/Timeout → ACK/ERROR', fill='#cbd5e1', font=F(25, True), anchor='mm')
png_path = assets / 'alert-escalation-process.png'
img.save(png_path, quality=95)
print(json.dumps({'svg': str(svg_path.resolve()), 'png': str(png_path.resolve()), 'svg_size': svg_path.stat().st_size, 'png_size': png_path.stat().st_size}, ensure_ascii=False, indent=2))
