import json, os, requests
from pathlib import Path
LEAGUE_ID='820399'; SEASON=2026
URL=f'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{SEASON}/segments/0/leagues/{LEAGUE_ID}'
SLOT={0:'QB',2:'RB',4:'WR',6:'TE',16:'D/ST',17:'K',20:'Bench',21:'IR',23:'FLEX'}
HEAD={'User-Agent':'Any-Given-Sunday-GitHub-Action/2.0','Accept':'application/json'}
COOK={}
if os.getenv('ESPN_S2'): COOK['espn_s2']=os.environ['ESPN_S2']
if os.getenv('ESPN_SWID'): COOK['SWID']=os.environ['ESPN_SWID']
def req(params):
 r=requests.get(URL,params=params,headers=HEAD,cookies=COOK,timeout=30); r.raise_for_status(); return r.json()
def name(t): return (t.get('name') or f"{t.get('location','')} {t.get('nickname','')}").strip()
def stat(p,w,source=0):
 vals=[float(x.get('appliedTotal') or 0) for x in p.get('stats',[]) if int(x.get('scoringPeriodId',-1))==w and int(x.get('statSourceId',-1))==source]
 return round(vals[-1],2) if vals else 0.0
status=req([('view','mStatus')]); current=int(status.get('scoringPeriodId') or 1)
# Build every completed week directly from ESPN. Historical files are regenerated each run, so corrections flow through automatically.
for w in range(1,current):
 d=req([('view','mTeam'),('view','mRoster'),('view','mMatchup'),('view','mMatchupScore'),('scoringPeriodId',w)])
 teams={int(t['id']):t for t in d.get('teams',[])}
 # record ENTERING week w, calculated only from prior completed matchups
 records={tid:{'wins':0,'losses':0,'ties':0} for tid in teams}
 for g in d.get('schedule',[]):
  mp=int(g.get('matchupPeriodId') or 0)
  if mp<=0 or mp>=w: continue
  h=g.get('home') or {}; a=g.get('away') or {}
  if 'teamId' not in h or 'teamId' not in a: continue
  hi,ai=int(h['teamId']),int(a['teamId']); hs=float(h.get('totalPoints') or 0); ass=float(a.get('totalPoints') or 0)
  if hs>ass: records[hi]['wins']+=1; records[ai]['losses']+=1
  elif ass>hs: records[ai]['wins']+=1; records[hi]['losses']+=1
  else: records[hi]['ties']+=1; records[ai]['ties']+=1
 outteams=[]
 for tid,t in teams.items():
  roster=[]
  for e in (t.get('roster') or {}).get('entries',[]):
   p=((e.get('playerPoolEntry') or {}).get('player') or {})
   if not p: continue
   slot=SLOT.get(int(e.get('lineupSlotId',20)),'Bench')
   roster.append({'id':str(p.get('id','')),'name':p.get('fullName') or p.get('name') or 'Unknown Player','slot':slot,'actual':stat(p,w,0),'projection':stat(p,w,1)})
  outteams.append({'id':tid,'name':name(t),'record':records[tid],'roster':roster})
 games=[]
 for g in d.get('schedule',[]):
  if int(g.get('matchupPeriodId') or 0)!=w: continue
  h=g.get('home') or {}; a=g.get('away') or {}
  if 'teamId' not in h or 'teamId' not in a: continue
  hi,ai=int(h['teamId']),int(a['teamId']); hs=round(float(h.get('totalPoints') or 0),2); ass=round(float(a.get('totalPoints') or 0),2)
  games.append({'home':{'teamId':hi,'teamName':name(teams[hi]),'score':hs,'projection':hs},'away':{'teamId':ai,'teamName':name(teams[ai]),'score':ass,'projection':ass}})
 snap={'week':w,'final':True,'matchups':games,'teams':outteams}
 Path('data').mkdir(exist_ok=True); Path(f'data/week-{w}.json').write_text(json.dumps(snap,indent=2)+"\n")
 # backward compatibility while the app migrates
 if w==1: Path('data/week1-live.json').write_text(json.dumps(snap,indent=2)+"\n")
print(f'Built ESPN snapshots for completed weeks 1-{max(0,current-1)}')