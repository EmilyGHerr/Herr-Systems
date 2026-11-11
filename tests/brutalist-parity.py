#!/usr/bin/env python3
"""Read-only Hugo parity verifier (stdlib). Does not build either tree.
Run: brutalist-parity.py BASELINE TARGET --report /tmp/herr-brutalist-parity.json
Inventory: brutalist-parity.py BASELINE --baseline-only
Robots/styles/component chrome excluded. Static text is not CSS/browser evidence.
"""
import argparse
from collections import defaultdict
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import unicodedata

SNAPSHOT = Path('/tmp/herr-brutalist-source-snapshot')
TARGET = Path('/home/syzygy/herr-systems-brutalist-hugo')
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
BLOCKS = set('p h1 h2 h3 h4 h5 h6 li dt dd blockquote figcaption label summary'.split())

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.walk()
    def text(self, visible=False):
        if visible and ignored(self):
            return ''
        return ' '.join(c.text(visible) if isinstance(c, Node) else c for c in self.children)

class DOM(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
        self.feed(html)
        self.close()
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.current)
        self.current.children.append(n)
        if tag not in VOID:
            self.current = n
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)
    def handle_endtag(self, tag):
        n = self.current
        while n.parent is not None:
            if n.tag == tag:
                self.current = n.parent
                return
            n = n.parent
    def handle_data(self, data):
        self.current.children.append(data)

def ignored(n):
    a = n.attrs
    classes = set((a.get('class') or '').split())
    return (n.tag in {'script', 'style', 'template', 'svg', 'nav'} or 'hidden' in a
            or a.get('aria-hidden') == 'true' or a.get('role') == 'navigation'
            or any('terminal' in c for c in classes)
            or bool(classes.intersection({'kicker', 'eyebrow', 'section-number', 'sr-only', 'visually-hidden'})))

def norm(s):
    return ' '.join(re.findall(r"[^\W_]+(?:['’][^\W_]+)*", unicodedata.normalize('NFKC', s).casefold()))

def page(path):
    nodes = list(DOM(path.read_text(encoding='utf-8')).root.walk())
    meta, schema, errors = defaultdict(list), [], []
    redirect = False
    for n in nodes:
        a = n.attrs
        if n.tag == 'title':
            meta['title'].append(' '.join(n.text().split()))
        if n.tag == 'meta':
            key = (a.get('property') or a.get('name') or '').lower()
            if key in {'description', 'author'} or key.startswith(('og:', 'twitter:')):
                meta[key].append(a.get('content', ''))
            if (a.get('http-equiv') or '').lower() == 'refresh':
                redirect = True
        if n.tag == 'link' and 'canonical' in (a.get('rel') or '').lower().split():
            meta['canonical'].append(a.get('href', ''))
        if n.tag == 'script' and (a.get('type') or '').lower() == 'application/ld+json':
            try:
                schema.append(json.dumps(json.loads(n.text()), sort_keys=True, ensure_ascii=False))
            except ValueError as exc:
                errors.append(str(exc))
    mains = [n for n in nodes if n.tag == 'main' or n.attrs.get('role') == 'main']
    main = mains[0] if mains else None
    blocks = []
    if main:
        for n in main.walk():
            parent, skip = n, False
            while parent:
                if ignored(parent):
                    skip = True
                    break
                parent = parent.parent
            text = norm(n.text(True))
            if not skip and n.tag in BLOCKS and text and (len(text.split()) >= 4 or n.tag.startswith('h')):
                blocks.append(text)
    return dict(metadata={k: sorted(v) for k, v in meta.items()}, jsonld=sorted(schema),
                errors=errors, redirect=redirect, has_main=bool(main),
                text=norm(main.text(True)) if main else '', blocks=sorted(set(blocks)))

def inventory(root):
    if not root.is_dir():
        raise ValueError('Missing build directory: ' + str(root))
    result = {}
    for f in sorted(root.rglob('*.html')):
        rel = f.relative_to(root).as_posix()
        route = '/' + (rel[:-10] if rel.endswith('index.html') else rel)
        result[route] = page(f)
    if '/' not in result or not result['/']['has_main']:
        raise ValueError('Missing real homepage/main in ' + str(root))
    return result

def hashes(root):
    return {f.relative_to(root).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
            for section in ('content', 'data') for f in sorted((root / section).rglob('*')) if f.is_file()}

def compare(base, target, source_root, target_root):
    failures = []
    def fail(kind, route, detail):
        failures.append(dict(kind=kind, route=route, detail=detail))
    for route in sorted(set(base) - set(target)):
        fail('missing-route', route, 'Missing production page or alias.')
    for route in sorted(set(target) - set(base)):
        fail('extra-route', route, 'Unexpected route; possible template leftovers.')
    for route in sorted(set(base).intersection(target)):
        b, t = base[route], target[route]
        for error in b['errors'] + t['errors']:
            fail('invalid-schema', route, error)
        if b['redirect'] != t['redirect']:
            fail('redirect', route, 'Real page/redirect classification changed.')
        for key in sorted(set(b['metadata']) | set(t['metadata'])):
            if b['metadata'].get(key) != t['metadata'].get(key):
                fail('metadata', route, dict(field=key, baseline=b['metadata'].get(key), target=t['metadata'].get(key)))
        if b['jsonld'] != t['jsonld']:
            fail('jsonld', route, dict(baseline=b['jsonld'], target=t['jsonld']))
        if b['has_main'] and not t['has_main']:
            fail('main', route, 'Missing main landmark.')
        missing = [s for s in b['blocks'] if s not in t['text']]
        if missing:
            fail('visible-copy', route, dict(missing_blocks=missing))
        for phrase in ('alex morgan', 'jordan ellis', 'sam rivera', 'lorem ipsum', 'jane doe', 'john doe', 'fictional staff', 'sample staff'):
            if phrase in t['text'] and phrase not in b['text']:
                fail('fictional-content', route, phrase)
    before, after = hashes(source_root), hashes(target_root)
    for name in sorted(set(before) | set(after)):
        if name != 'data/forms.yml' and before.get(name) != after.get(name):
            fail('source-bytes', name, dict(baseline=before.get(name), target=after.get(name)))
    original, forms = source_root / 'data/forms.yml', target_root / 'data/forms.yml'
    if not original.is_file() or not forms.is_file():
        fail('forms', 'data/forms.yml', 'Missing forms config.')
    else:
        expected, count = re.subn(rb'(?m)^(enabled:[ \t]*)true([ \t]*(?:#.*)?)$', rb'\1false\2', original.read_bytes())
        if count != 1 or forms.read_bytes() != expected:
            fail('forms', 'data/forms.yml', 'Only enabled: true -> false byte change allowed.')
    return failures

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('baseline', type=Path)
    p.add_argument('target', type=Path, nargs='?')
    p.add_argument('--source-root', type=Path, default=SNAPSHOT)
    p.add_argument('--target-root', type=Path, default=TARGET)
    p.add_argument('--baseline-only', action='store_true')
    p.add_argument('--report', type=Path)
    a = p.parse_args()
    if not a.baseline_only and a.target is None:
        p.error('Target required unless --baseline-only')
    try:
        base = inventory(a.baseline)
        failures = [dict(kind='baseline-schema', route=r, detail=e) for r, b in base.items() for e in b['errors']]
        manifest = a.source_root / 'manifest.json'
        if manifest.is_file():
            expected = json.loads(manifest.read_text())['files']
            required = {k: v for k, v in expected.items() if k.startswith(('content/', 'data/'))}
            if hashes(a.source_root) != required:
                failures.append(dict(kind='snapshot-integrity', detail='Snapshot content/data changed.'))
        if not a.baseline_only:
            failures += compare(base, inventory(a.target), a.source_root, a.target_root)
        report = dict(passed=not failures, mode='baseline-inventory' if a.baseline_only else 'parity',
                      real_pages=sum(not b['redirect'] for b in base.values()),
                      redirects=sum(b['redirect'] for b in base.values()), source_files=len(hashes(a.source_root)),
                      failures=failures, inventory=base if a.baseline_only else None,
                      limitations=['Static DOM evidence, not computed CSS visibility.',
                                   'Terminal/chrome ignored; substantive production blocks required.',
                                   'JSON object order ignored; array order preserved.'])
    except (OSError, ValueError) as exc:
        report = dict(passed=False, failures=[dict(kind='input', detail=str(exc))])
    if a.report:
        if not str(a.report.resolve()).startswith('/tmp/herr-brutalist-'):
            p.error('Report must be under /tmp/herr-brutalist-*')
        a.report.parent.mkdir(parents=True, exist_ok=True)
        a.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'inventory', 'limitations'}}, indent=2))
    return 0 if report['passed'] else 1

if __name__ == '__main__':
    sys.exit(main())
