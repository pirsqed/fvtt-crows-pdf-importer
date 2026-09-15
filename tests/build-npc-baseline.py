"""Read-only oracle: original Ref book parser, without artwork writes."""
import json, sys, re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root.parent/'fvtt-crows-system'/'tools'))
import extract_monsters as extractor
import fitz
blocks=[]
corrections=[]
with fitz.open(extractor.BOOK) as doc:
    for page in doc:
        if 'Power:' not in page.get_text():
            continue
        for box in extractor.boxes_on(page):
            block=extractor.parse_block(page,box)
            if block and block['stats'].get('Power') is not None:
                # Visually verified label variant omitted by the old parser:
                # "Expertises (2 uses all): ..." on two Power 10 warriors.
                for row in extractor.rows_in(page,box):
                    match=re.match(r'^Expertises\s*(\([^)]*\)):\s*(.*)$',row['text'])
                    if match:
                        block['stats']['Expertises']=f'{match[1]} {match[2]}'
                        corrections.append(dict(page=page.number+1,name=block['name'],field='Expertises',reason='Uses qualifier in label'))
                blocks.append(block)
    result=dict(file=str(extractor.BOOK),pages=len(doc),blocks=blocks,corrections=corrections,
                actors=[extractor.to_actor(block,{}) for block in blocks])
(root/'out').mkdir(exist_ok=True)
(root/'out'/'npcs-baseline.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print(f'{len(blocks)} creature stat blocks')
