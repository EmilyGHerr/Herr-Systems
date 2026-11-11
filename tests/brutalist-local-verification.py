#!/usr/bin/env python3
"""Local-preview parity contract, including deliberate CMS/form isolation."""
import importlib.util,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('parity',root/'tests/brutalist-parity.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
source=Path('/home/syzygy/herr-systems-brutalist-hugo-source')
base=p.inventory(Path('/tmp/herr-brutalist-baseline'));target=p.inventory(root/'public')
# CMS is intentionally absent, not a public-content omission.
base.pop('/sudo/',None)
failures=p.compare(base,target,source,root)
# The source YAML is retained byte-for-byte; the shared resolver is hard-disabled.
# Only the helper's alternate (YAML-disabled) assumption may be waived.
resolver=(root/'layouts/partials/inquiry-config.html').read_text()
assert '(dict "sitekey" "" "enabled" false)' in resolver
assert (source/'data/forms.yml').read_bytes()==(root/'data/forms.yml').read_bytes()
failures=[f for f in failures if not(f['kind']=='forms' and f['route']=='data/forms.yml')]
assert p.hashes(source)==p.hashes(root),'Production content/data must be byte-identical'
for name in ['.git','.github','functions','workers','server','static/sudo','public/sudo']:
 assert not(root/name).exists(),name
for name in ['contact','pricing']:
 html=(root/f'public/{name}/index.html').read_text()
 assert 'method="dialog"' in html and 'data-endpoint-enabled="false"' in html
 assert 'action="/api/inquiries"' not in html
for route,record in target.items():
 assert not record['errors'],(route,record['errors'])
report={'passed':not failures,'public_pages':sum(not v['redirect'] for v in target.values()),'aliases':sum(v['redirect'] for v in target.values()),'identical_content_data_files':len(p.hashes(root)),'checks':'production titles/descriptions/author/canonical/OG/Twitter/JSONLD and substantive text; byte-identical content/data; local isolation','intentional_differences':['CMS /sudo/ absent','preview robots noindex/nofollow','form resolver disabled and native submissions disconnected','alias navigation local-relative; canonical unchanged'],'failures':failures}
(root/'tests/test-results/brutalist-local-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));assert not failures
