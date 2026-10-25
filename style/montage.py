import json,sys,os
from PIL import Image,ImageDraw,ImageFont
base=os.path.expanduser('~/mnt/works--uipatterns/mo/')
svcs=json.load(open('services-mo.json'))
names=sys.argv[2].split('|'); out=sys.argv[1]; per=int(sys.argv[3]) if len(sys.argv)>3 else 4
TW,TH=250,540; rows=[]
mp={}
for si,n in enumerate(names):
    items=[x for x in svcs[n] if x['c']=='메인'][:per]
    if len(items)<per: items+= [x for x in svcs[n] if x['c']!='메인'][:per-len(items)]
    rows.append((n,items))
W=TW*per+(per+1)*8; H=len(rows)*(TH+36)+8
M=Image.new('RGB',(W,H),(40,40,40)); d=ImageDraw.Draw(M)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
except: f=None
for r,(n,items) in enumerate(rows):
    y=8+r*(TH+36); d.text((10,y),f'#{r+1}',fill=(255,220,0),font=f); mp[r+1]=n
    for c,it in enumerate(items):
        try:
            im=Image.open(base+it['p']).convert('RGB'); im.thumbnail((TW,TH*3))
            if im.height>TH: im=im.crop((0,0,im.width,TH))
            M.paste(im,(8+c*(TW+8),y+30))
        except Exception as e: print('err',it['p'],e)
M.save(out,quality=85); json.dump(mp,open(out+'.json','w'),ensure_ascii=False); print(out,M.size)
