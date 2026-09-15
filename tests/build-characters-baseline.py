"""Developer oracle; writes only ignored out/ and never modifies the system."""
import os,json,sys,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'out'/'characters-oracle'
out.mkdir(parents=True,exist_ok=True)
os.environ['CROWS_BUILD_OUT']=str(out)
sys.path.insert(0,str(root.parent/'fvtt-crows-system'/'tools'))
cards=[card for case in json.loads((root/'out'/'cards-baseline.json').read_text(encoding='utf8')) for card in case['expected']]
(out/'cards_raw.json').write_text(json.dumps(cards),encoding='utf8')
import extract_backgrounds as backgrounds
import extract_traits as traits
backgrounds.main()
traits.main()
raw=json.loads((out/'backgrounds_raw.json').read_text(encoding='utf8'))
for b in raw['backgrounds']:
    kit=collections.Counter({e['name']:e['quantity'] for e in raw['_common']['equipment']})
    for e in b['equipment']: kit[e['name']]+=e['quantity']
    b['startingKit']=[dict(name=name,quantity=qty) for name,qty in kit.items()]
    b['startingGold']=raw['_common']['startingGold']
result=dict(file=str(backgrounds.BOOK),backgrounds=raw['backgrounds'],common=raw['_common'],connections=json.loads((out/'connections.json').read_text(encoding='utf8')),traits=json.loads((out/'traits.new.json').read_text(encoding='utf8')))
(root/'out'/'characters-baseline.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf8')
