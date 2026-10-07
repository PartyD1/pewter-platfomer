import json,sys
for line in open(sys.argv[1]):
    r=json.loads(line)
    print('==', r['cond'], r['id'], 'rep', r['rep'], 'err:', r.get('harnessError','')[:300])
    print('  modelLog:', [(m['status'], m['ms']) for m in r.get('modelLog',[])])
    for t in r['turns']:
        print('  prompt:', t['prompt']); print('  reply:', t['reply'][:400].replace('\n',' / ')); print('  ms', t['ms'], 'done', t['done'], 'modelCalls', t['modelCalls'])
        for tc in t['tools']: print('    tool', tc['name'], json.dumps(tc['args'])[:170], '->', tc['result'][:170].replace('\n',' | '))
    g=r['grids'][-1] if r['grids'] else r.get('initial'); print('  active box', g and g['active'])
    if '--grid' in sys.argv:
        for y in range(3,20): print('   ', ''.join(('c' if g['C'][y][x]==2 else 'f' if g['C'][y][x]==3 else ('.' if g['G'][y][x]<=1 else ('s' if g['G'][y][x]==9 else ('U' if g['G'][y][x]==8 else '#')))) for x in range(0,30)))
