# 서비스별 색 통계 + 판정용 몽타주 생성
# usage: python3 build-style.py mo|web
import json,os,sys,colorsys
from PIL import Image,ImageDraw,ImageFont
P=sys.argv[1]; A=int(sys.argv[2]); B=int(sys.argv[3]); base=os.path.expanduser(f'~/mnt/works--uipatterns/{P}/')
svcs=json.load(open(f'services-{P}.json'))
PRI=['메인','온보딩','상세정보(PDP)','상품목록','조회하기','마이페이지','큐레이션','추천','게이미피케이션','통계ㆍ리포트','채팅','검색','예약ㆍ결제']
def sample(items,n):
    by={}
    for x in items: by.setdefault(x['c'],[]).append(x)
    out=[]
    mains=by.pop('메인',[])
    out+=mains[:2]
    cats=sorted(by,key=lambda c:(PRI.index(c) if c in PRI else 99,-len(by[c])))
    i=0
    while len(out)<n and any(by.values()):
        c=cats[i%len(cats)]; 
        if by[c]: out.append(by[c].pop(len(by[c])//2))
        i+=1
        if i>200: break
    if len(out)<n: out+=mains[2:2+n-len(out)]
    return out[:n]
def stats(ims):
    px=[]
    for im in ims:
        t=im.copy(); t.thumbnail((60,120)); px+=list(t.get_flattened_data() if hasattr(t,'get_flattened_data') else t.getdata())
    lum=sum(0.2126*r+0.7152*g+0.0722*b for r,g,b in px)/len(px)/255
    hs=[colorsys.rgb_to_hsv(r/255,g/255,b/255) for r,g,b in px]
    sat=sum(s*v for h,s,v in hs)/len(hs)
    dark=sum(1 for h,s,v in hs if v<0.25)/len(hs)
    # accent: 채도 높은 픽셀 중 가장 많은 색상 버킷
    buckets={}
    for (r,g,b),(h,s,v) in zip(px,hs):
        if s>0.45 and v>0.35:
            k=int(h*24)%24; buckets.setdefault(k,[]).append((r,g,b))
    acc=[]
    for k,v in sorted(buckets.items(),key=lambda kv:-len(kv[1]))[:3]:
        if len(v)/len(px)<0.004: continue
        r=sum(c[0] for c in v)//len(v); g=sum(c[1] for c in v)//len(v); b=sum(c[2] for c in v)//len(v)
        acc.append({'hex':'#%02X%02X%02X'%(r,g,b),'share':round(len(v)/len(px),3)})
    return {'lum':round(lum,3),'sat':round(sat,3),'dark':round(dark,3),'accents':acc}
mo=P=='mo'
TW,TH,PER=(250,520,4) if mo else (340,213,3)
ROWS=4
names=sorted(svcs)
out={}; os.makedirs(f'_montage/{P}',exist_ok=True); mp={}
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
except: f=None
batch=[]; bi=A//ROWS
def flush():
    global batch,bi
    if not batch: return
    W=TW*PER+(PER+1)*8; H=len(batch)*(TH+36)+8
    M=Image.new('RGB',(W,H),(40,40,40)); d=ImageDraw.Draw(M)
    for r,(gid,ims) in enumerate(batch):
        y=8+r*(TH+36); d.text((10,y),f'#{gid}',fill=(255,220,0),font=f)
        for c,im in enumerate(ims[:PER]):
            t=im.copy(); t.thumbnail((TW,TH*4))
            if t.height>TH: t=t.crop((0,0,t.width,TH))
            M.paste(t,(8+c*(TW+8),y+30))
    M.save(f'_montage/{P}/m{bi:03d}.jpg',quality=82); bi+=1; batch=[]
for gi,n in enumerate(names):
    if gi<A or gi>=B: continue
    smp=sample(svcs[n],8); ims=[]
    for x in smp:
        try: ims.append(Image.open(base+x['p']).convert('RGB'))
        except Exception as e: pass
    if not ims: continue
    st=stats(ims); st['count']=len(svcs[n]); st['id']=gi+1
    st['cats']=sorted({x['c'] for x in svcs[n]})
    st['montage']=f'm{bi:03d}'; st['shots']=[x['p'] for x in smp[:PER]]
    out[n]=st; mp[gi+1]=n
    batch.append((gi+1,ims)); 
    if len(batch)==ROWS: flush()
    if gi%50==0: print(gi,n,flush=True)
flush()
os.makedirs('stats',exist_ok=True); json.dump(out,open(f'stats/{P}-{A:04d}.json','w'),ensure_ascii=False)
print('done',len(out),bi)
