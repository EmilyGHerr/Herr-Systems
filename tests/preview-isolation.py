from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
assert not(root/'static/sudo').exists()
assert not(root/'public/sudo').exists()
assert not(root/'functions').exists()
assert not(root/'workers').exists()
for route in ['contact','pricing']:
 s=(root/f'public/{route}/index.html').read_text()
 assert re.search(r'method=["\']?dialog',s),route
 assert re.search(r'data-endpoint-enabled=["\']?false',s),route
 assert 'action=/api/inquiries' not in s and 'action="/api/inquiries"' not in s
home=(root/'public/index.html').read_text()
assert 'noindex' in home and 'nofollow' in home
assert 'hero-terminal' in home and 'masthead-band' in home
assert 'Disallow: /' in (root/'public/robots.txt').read_text()
print('Static dev preview isolation passed; CMS and delivery disconnected.')
