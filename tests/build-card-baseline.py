"""Developer-only full-field oracle from the sibling system's original parser."""
import json, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
system=root.parent/'fvtt-crows-system'
sys.path.insert(0,str(system/'tools'))
import extract_cards as extractor
import build_packs
import fitz
cases=[]
for source,path in extractor.SOURCES.items():
    records=extractor.extract({source:path})
    # Correct the legacy field name without changing the extracted value.
    # The number after the expertise is the required village institution tier.
    for record in records:
        crafting = record.get('crafting')
        if crafting and 'uses' in crafting:
            crafting['institution_tier'] = crafting.pop('uses')
    with fitz.open(path) as doc:
        for page in range(len(doc)):
            page_records=[r for r in records if r['page']==page+1]
            cases.append(dict(file=str(path),source=source,page=page+1,expected=page_records))
out=root/'out'
out.mkdir(exist_ok=True)
(out/'cards-baseline.json').write_text(json.dumps(cases,ensure_ascii=False),encoding='utf-8')
(out/'items-baseline.json').write_text(json.dumps([
    dict(card=card, expected=build_packs.to_item(card, {}, relic=card['source']=='poi'))
    for case in cases for card in case['expected']
],ensure_ascii=False),encoding='utf-8')
print(f'{len(cases)} pages, {sum(len(c["expected"]) for c in cases)} complete cards')
