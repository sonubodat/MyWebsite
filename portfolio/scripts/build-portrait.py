import numpy as np
from collections import deque
from PIL import Image, ImageFilter

SRC='/Users/sonubodat/Desktop/MyWebsite/sonu.png'   # original, read-only
src=Image.open(SRC).convert('RGB')
cut=Image.open('cut_u2netp.png').convert('RGBA')
a=np.array(cut)[:,:,3]

# --- drop detached blobs (e.g. bench cat remnant) via component labelling at 1/4 scale
sm=np.array(Image.fromarray(a).resize((a.shape[1]//4,a.shape[0]//4),Image.BILINEAR))>110
H,W=sm.shape; lab=np.zeros((H,W),int); sizes={}; n=0
for y in range(H):
    for x in range(W):
        if sm[y,x] and not lab[y,x]:
            n+=1; q=deque([(y,x)]); lab[y,x]=n; c=0
            while q:
                cy,cx=q.popleft(); c+=1
                for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                    ny,nx=cy+dy,cx+dx
                    if 0<=ny<H and 0<=nx<W and sm[ny,nx] and not lab[ny,nx]:
                        lab[ny,nx]=n; q.append((ny,nx))
            sizes[n]=c
big=max(sizes.values())
keep=[k for k,v in sizes.items() if v>=0.08*big]
print('components',sizes,'keep',keep)
keepmask=np.isin(lab,keep)
keepfull=np.array(Image.fromarray((keepmask*255).astype(np.uint8)).resize((a.shape[1],a.shape[0]),Image.BILINEAR).filter(ImageFilter.MaxFilter(9)))>0
a=np.where(keepfull,a,0).astype(np.uint8)
# bench-cat remnant left of head: remove light/tan pixels only (hair is dark, keep it)
lum=np.array(src.convert('L')).astype(int)
a[:660,:282]=0
a[:660,282:345]=np.where(lum[:660,282:345]>95,0,a[:660,282:345])

# --- crop: head -> cat/lap, soft fade at bottom + slight edge feather
X0,X1,Y0,Y1=30,941,300,1560
alpha=Image.fromarray(a).crop((X0,Y0,X1,Y1)).filter(ImageFilter.GaussianBlur(1.2))
al=np.array(alpha).astype(float)
h=al.shape[0]; fade=np.clip((h-np.arange(h))/220.0,0,1)[:,None]   # bottom 220px fade
al=(al*fade).astype(np.uint8)
rgb=src.crop((X0,Y0,X1,Y1))
cw,ch=rgb.size
out=rgb.convert('RGBA'); out.putalpha(Image.fromarray(al))
out.save('portrait_cutout_full.png'); print('crop',cw,ch)

# --- web derivative: cutout (kept for later WebGL sampling), 900w
W_OUT=900; Ho=round(ch*W_OUT/cw)
out.resize((W_OUT,Ho),Image.LANCZOS).save('portrait-cutout.webp',quality=86,method=6)

# --- static raster: tonal map -> Bayer 8x8 ordered dither in site palette (forest/green/cream/lime)
B=np.array([[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
            [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]])/64.0

def raster(w_out, cell, cream_off, lime_thr, lime_th):
    ho=round(ch*w_out/cw)
    g=np.array(rgb.convert('L').resize((w_out,ho),Image.LANCZOS)).astype(float)/255
    gb=np.array(Image.fromarray((g*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(38*w_out/900))).astype(float)/255
    g=np.clip(g+0.55*(g-gb)+0.10,0,1)           # local contrast so face/hair/shirt read
    g=np.clip((g-0.03)/0.72,0,1)**0.62
    alp=np.array(Image.fromarray(al).resize((w_out,ho),Image.LANCZOS)).astype(float)/255
    gs=np.array(Image.fromarray((g*255).astype(np.uint8)).resize((w_out//cell,ho//cell),Image.BOX)).astype(float)/255
    as_=np.array(Image.fromarray((alp*255).astype(np.uint8)).resize((w_out//cell,ho//cell),Image.BOX)).astype(float)/255
    th=np.tile(B,(gs.shape[0]//8+1,gs.shape[1]//8+1))[:gs.shape[0],:gs.shape[1]]
    pal=[(0,0,0,0),(79,122,92,255),(243,245,239,255),(185,216,91,255)]  # clear, muted green, cream, acid lime
    lvl=np.zeros(gs.shape,int)
    lvl[(gs>th*0.55+0.06)]=1
    lvl[(gs>th*0.55+cream_off)]=2
    if lime_thr: lvl[(gs>lime_thr)&(th>lime_th)]=3
    img=np.zeros(gs.shape+(4,),np.uint8)
    for i,p in enumerate(pal): img[lvl==i]=p
    img[...,3]=np.where(as_>0.35,img[...,3],0)
    return Image.fromarray(img,'RGBA').resize((gs.shape[1]*cell,gs.shape[0]*cell),Image.NEAREST)

# desktop (approved): 900w, 3px cells, sparse lime highlights
d=raster(900,3,0.44,0.985,0.78); d.save('portrait-raster.png',optimize=True); d.save('portrait-raster.webp',quality=90,method=6)
# mobile: finer 2px cells (more detail at small size), more cream, lime nearly removed so it cannot pool into blobs
m=raster(720,2,0.36,0.997,0.93); m.save('portrait-raster-m.png',optimize=True)
print('raster',d.size,m.size)
for nm,im in (('prev_raster.png',d),('prev_raster_m.png',m)):
    bg=Image.new('RGBA',im.size,(7,19,15,255)); bg.alpha_composite(im); bg.convert('RGB').resize((450,round(450*im.size[1]/im.size[0]))).save(nm)
# silhouette extents (desktop raster) for composition tuning: leftmost opaque x per 10% band of height
A=np.array(d)[:,:,3]>0
print('left edge by band (fraction of width):',[round(float(np.argmax(A[int(i*A.shape[0]/10):int((i+1)*A.shape[0]/10)].any(axis=0))/A.shape[1]),2) for i in range(10)])
