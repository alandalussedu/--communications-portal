#!/usr/bin/env python3
"""
«خطط الفروع» (المسؤولية المجتمعية): turns each branch's CSR section into a
`csrPlans` document. Used from a Claude session, since the Google Sheets
connector does the reading:

  1. Read the links sheet «جمع الروابط للمسؤولية المجتمعية» (row 4 = one link per
     branch, in the order of row 3) and write map.json OUTSIDE the repo:
     {"zahra": ["<fileId>", <gid>], "hamdaniya": null, ...}
  2. For each linked branch, fetch «<sheet>!Q1:AD90» with spreadsheets.get
     (includeGridData, fields sheets.properties + sheets.data.rowData.values)
     and save the response as <raw-dir>/raw_<slug>.json.
  3. python3 tools/csr_plans.py --map map.json --raw-dir DIR --register-id ID --out DIR
     writes docs.json and write.sql (upserts into public.docs, collection csrPlans).

Cells are found by their labels (المسار التعليمي / اسم المشروع / خطة العمل ...),
not fixed rows, so template variants parse. Dates come from the stored date value.
No file IDs live in this repository.
"""
import argparse,os
"""Reads a branch's CSR section («PROJECTS 2027», columns Q:AD) from a saved
spreadsheets.get response and returns the portal document. Cells are found by
their labels, not fixed rows, so template variants still parse."""
import json,re,sys,datetime
COL={c:i for i,c in enumerate(['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD'])}
def load(path):
    s=json.load(open(path))['content']['sheets'][0]
    g=s['data'][0]; sc=g.get('startColumn',0); sr=g.get('startRow',0)
    grid=[]
    for r in g.get('rowData',[]):
        row={}
        for j,v in enumerate(r.get('values',[])):
            t=(v.get('formattedValue') or '').replace('\r','').strip()
            link=v.get('hyperlink')
            for run in v.get('textFormatRuns',[]) or []:
                u=(run.get('format') or {}).get('link',{}).get('uri')
                if u and not link: link=u
            for ch in v.get('chipRuns',[]) or []:
                u=(ch.get('chip') or {}).get('richLinkProperties',{}).get('uri')
                if u and not link: link=u
            ev=(v.get('effectiveValue') or {}).get('numberValue')
            fmt=((v.get('effectiveFormat') or {}).get('numberFormat') or {}).get('type')
            if t or link: row[sc+j]=(t,link,ev if fmt in ('DATE','DATE_TIME') else None)
        grid.append(row)
    return s['properties'],sr,grid
def T(row,c): return row.get(COL[c],('',None,None))[0]
def L(row,c): return row.get(COL[c],('',None,None))[1]
def D(row,c): return row.get(COL[c],('',None,None))[2]
def num(s):
    s=(s or '').replace(',','').replace('٬','').strip()
    m=re.search(r'-?\d+(?:\.\d+)?',s)
    return float(m.group()) if m else None
def pdate(s):
    s=(s or '').strip()
    m=re.fullmatch(r'(\d{4})-(\d{1,2})-(\d{1,2})',s)
    if m: y,mo,d=map(int,m.groups())
    else:
        m=re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})',s)
        if not m: return None
        d,mo,y=map(int,m.groups())
    try: return datetime.date(y,mo,d).isoformat()
    except ValueError: return None
HEAD=[('المسار التعليمي','edu'),('المسار التربوي','val'),('المشروع الفصل الأول','edu'),('المشروع الفصل الثاني','val'),('المشروع','other')]
def heading(t):
    t=re.sub(r'\s+',' ',t).strip()
    for k,tr in HEAD:
        if t.startswith(k): return tr
    return None
def parse(path):
    props,sr,grid=load(path)
    out={'sheetId':props['sheetId'],'sheetTitle':props['title'],'summary':None,'kpi':[],'projects':[]}
    # summary + kpi
    for i,row in enumerate(grid):
        if T(row,'V')=='عدد المشاريع':
            out['summary']={'projects':num(T(row,'W')),'approved':num(T(row,'Y')),'notApproved':num(T(row,'AA')),'measure':T(row,'AC') or None}
        if T(row,'R')=='نتيجة العام السابق' and i+1<len(grid):
            nxt=grid[i+1]
            for c in ['R','S','T','U','V','W','X','Y','Z','AA','AB','AC']:
                h=T(row,c); v=T(nxt,c)
                if h or v: out['kpi'].append({'col':c,'label':h,'value':v or None})
    # project blocks
    starts=[(i,heading(T(row,'Q'))) for i,row in enumerate(grid) if T(row,'Q') and heading(T(row,'Q'))]
    for k,(i,tr) in enumerate(starts):
        end=starts[k+1][0] if k+1<len(starts) else len(grid)
        p={'track':tr,'heading':re.sub(r'\s+',' ',T(grid[i],'Q')),'row':sr+i+1,'name':'','nameLink':None,'goal':'','description':'','audience':'','target':'','follow':None,'indicators':[],'approval':None,'approvalNote':'','steps':[]}
        mode=None
        for r in range(i+1,end):
            row=grid[r]; q=T(row,'Q')
            if q=='اسم المشروع': p['name']=T(row,'S'); p['nameLink']=L(row,'S'); p['audience']=T(row,'AA'); continue
            if q=='هدف المشروع': p['goal']=T(row,'S'); p['target']=T(row,'AA'); continue
            if T(row,'Y').startswith('رابط ملف المتابعة'):
                if T(row,'AA') or L(row,'AA'): p['follow']={'text':T(row,'AA'),'url':L(row,'AA') or (T(row,'AA') if T(row,'AA').startswith('http') else None)}
                continue
            if q=='وصف مختصر': p['description']=T(row,'S'); mode='ind'
            if mode=='ind' and q!='خطة العمل':
                v=T(row,'AA')
                if v and v not in p['indicators']: p['indicators'].append(v)
                continue
            if q=='خطة العمل': p['approval']=T(row,'X') or None; p['approvalNote']=T(row,'AA'); mode=None; continue
            if q.startswith('الاجراءات'): mode='steps'; continue
            if mode=='steps':
                st={'action':q,'owner':T(row,'U'),'date':T(row,'W'),'budget':T(row,'Y'),'item':T(row,'Z'),'tech':T(row,'AA'),'reply':T(row,'AC')}
                if any(st.values()):
                    serial=D(row,'W'); st['dateIso']=(datetime.date(1899,12,30)+datetime.timedelta(days=int(serial))).isoformat() if serial else pdate(st['date']); st['budgetNum']=num(st['budget']); st['row']=sr+r+1
                    p['steps'].append(st)
        p['budget']=sum(s['budgetNum'] or 0 for s in p['steps'])
        empty=not (p['name'] or p['goal'] or p['steps'])
        if tr=='other' and empty: continue
        p['empty']=empty
        out['projects'].append(p)
    return out

YEAR_START='2026-08-01'
def build(mapping,raw_dir,register_id):
    now=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    docs={}
    for slug,reg in mapping.items():
        base={'branch':slug,'register':f'https://docs.google.com/spreadsheets/d/{register_id}/edit','readAt':now}
        if not reg:
            docs[slug]={**base,'status':'no-link','note':'لا يوجد رابط في سجل روابط المسؤولية المجتمعية.'}; continue
        fid,gid=reg; d=parse(os.path.join(raw_dir,f'raw_{slug}.json'))
        issues=[]
        if gid!=d['sheetId']:
            issues.append('الرابط في السجل لا يشير إلى ورقة المشاريع (يفتح «تجربة العملاء B1»)؛ قُرئت ورقة «PROJECTS 2027» من الملف نفسه. يُرجى تصحيح الرابط.')
        approvedCount=sum(1 for p in d['projects'] if p['approval']=='معتمد')
        s=d['summary'] or {}
        if s.get('approved') is not None and int(s['approved'])!=approvedCount:
            issues.append(f"عدّاد الورقة يذكر {int(s['approved'])} معتمد، والمشاريع المعتمدة في خانة «حالة الاعتماد» {approvedCount}.")
        for p in d['projects']:
            if p['heading'].startswith('المشروع الفصل'): p['trackNote']='حُدّد المسار بترتيب المشروع في الورقة (الأول تعليمي، الثاني تربوي قيمي).'
            for st in p['steps']:
                st['dateFlag']='before-year' if st['dateIso'] and st['dateIso']<YEAR_START else None
        docs[slug]={**base,'status':'ok','fileId':fid,'sheetId':d['sheetId'],'sheetTitle':d['sheetTitle'],
            'sourceUrl':f"https://docs.google.com/spreadsheets/d/{fid}/edit#gid={d['sheetId']}&range=Q1:AD90",
            'summary':d['summary'],'kpi':d['kpi'],'projects':d['projects'],'issues':issues}
    return docs

def main():
    a=argparse.ArgumentParser(); a.add_argument('--map',required=True); a.add_argument('--raw-dir',required=True); a.add_argument('--register-id',required=True); a.add_argument('--out',required=True)
    o=a.parse_args()
    docs=build(json.load(open(o.map)),o.raw_dir,o.register_id)
    json.dump(docs,open(os.path.join(o.out,'docs.json'),'w'),ensure_ascii=False,indent=1)
    sql=[]
    for slug,doc in docs.items():
        j=json.dumps(doc,ensure_ascii=False); assert '$j$' not in j
        sql.append(f"insert into public.docs (collection,id,data) values ('csrPlans','{slug}',$j${j}$j$::jsonb) on conflict (collection,id) do update set data=excluded.data;")
    open(os.path.join(o.out,'write.sql'),'w').write('\n'.join(sql))
    for s,d in docs.items(): print(s,d['status'],len(d.get('projects') or []),d.get('issues') or '')
if __name__=='__main__': main()
