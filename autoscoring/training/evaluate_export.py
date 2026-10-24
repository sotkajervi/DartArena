#!/usr/bin/env python3
"""Evaluate cumulative Owner AI Rival capture ZIPs without exposing camera photos.

Run: python autoscoring/training/evaluate_export.py newest.zip --previous prior.zip
Only new Owner-approved points are used in per-batch error metrics.
No third-party packages or database connections.
"""
import argparse
from collections import Counter
import json
import math
from statistics import mean, median
import zipfile

def load(path):
    with zipfile.ZipFile(path) as archive:
        rows=json.loads(archive.read('labels.json'))['captures']
    if len({r['id'] for r in rows})!=len(rows):
        raise ValueError('Duplicate image IDs in '+str(path))
    return rows

def raw(row):
    return row.get('rawProposal') or row.get('proposal')

def verified(row):
    p=raw(row)
    q=row.get('corrected')
    return bool(row.get('status')=='approved' and p and q and
        all(isinstance(n,(int,float)) and math.isfinite(n)
            for n in (p['x'],p['y'],q['x'],q['y'])))

def dist(p,q):
    return math.hypot(p['x']-q['x'],p['y']-q['y'])

def stats(numbers):
    numbers=sorted(numbers)
    if not numbers:return {'n':0}
    return {'n':len(numbers),'meanPx':round(mean(numbers),2),
        'medianPx':round(median(numbers),2),
        'p90Px':round(numbers[math.ceil(.9*len(numbers))-1],2),
        'within20px':sum(x<=20 for x in numbers)}

def median_delta(training):
    training=[r for r in training if verified(r)]
    if len(training)<5:return None
    return {'dx':median(r['corrected']['x']-raw(r)['x'] for r in training),
            'dy':median(r['corrected']['y']-raw(r)['y'] for r in training)}

def local_delta(training,point,radius):
    pairs=[]
    for row in training:
        if not verified(row):continue
        r=raw(row)
        d2=(r['x']-point['x'])**2+(r['y']-point['y'])**2
        w=math.exp(-d2/(2*radius*radius))
        if w>1e-30:
            pairs.append((w,row['corrected']['x']-r['x'],row['corrected']['y']-r['y']))
    weight=sum(w for w,_,_ in pairs)
    return {'dx':sum(w*dx for w,dx,_ in pairs)/weight,
            'dy':sum(w*dy for w,_,dy in pairs)/weight} if weight else None

def corrected_error(rows,estimate):
    errors=[]
    for row in rows:
        p=raw(row)
        d=estimate(p)
        if d:
            errors.append(dist({'x':p['x']+d['dx'],'y':p['y']+d['dy']},row['corrected']))
    return stats(errors)

def evaluate(current,previous=None):
    latest=load(current)
    earlier=load(previous) if previous else []
    before={r['id']:r for r in earlier}
    new=[r for r in latest if r['id'] not in before]
    accepted=[r for r in new if verified(r)]
    result={
        'totalImages':len(latest),'newImages':len(new),
        'newApproved':len(accepted),
        'newRejected':sum(r.get('status')=='rejected' for r in new),
        'totalApproved':sum(verified(r) for r in latest),
        'changedEarlierStatuses':sum(r.get('status')!=before[r['id']].get('status')
            for r in latest if r['id'] in before),
        'newMatchCount':len({r.get('matchId') for r in new}),
        'rawError':stats(dist(raw(r),r['corrected']) for r in accepted),
        'displayedError':stats(dist(r['proposal'],r['corrected'])
            for r in accepted if r.get('proposal')),
        'note':'Errors compared with Owner-approved labels, not independently verified ground truth.'
    }
    if earlier and accepted:
        base=median_delta(earlier)
        if base:
            result['previousMedianOnNew']=corrected_error(accepted,lambda point:base)
        for radius in (100,300):
            result['experimentalLocal'+str(radius)+'OnNew']=corrected_error(
                accepted,lambda point:local_delta(earlier,point,radius))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('current',help='Latest cumulative training ZIP')
    parser.add_argument('--previous',help='Earlier cumulative training ZIP')
    options=parser.parse_args()
    print(json.dumps(evaluate(options.current,options.previous),indent=2,ensure_ascii=False))
