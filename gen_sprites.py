#!/usr/bin/env python3
"""
Nyang-Suite 고양이 픽셀 아트 스프라이트 생성기
32×32 픽셀 → img/ 폴더에 cat_{expression}.png 저장
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")
os.makedirs(OUT, exist_ok=True)

# ── 컬러 팔레트 ──────────────────────────
T   = (  0,   0,   0,   0)   # transparent
OL  = ( 42,  28,  14, 255)   # outline dark brown
FU  = (215, 182, 140, 255)   # fur warm beige
FUL = (232, 208, 170, 255)   # fur lighter (face center)
EAR = (232, 148, 168, 255)   # ear inner pink
EW  = (245, 238, 220, 255)   # eye white
IR  = ( 70, 148, 208, 255)   # iris blue
PU  = ( 28,  16,   8, 255)   # pupil dark
NS  = (220, 118, 132, 255)   # nose pink
SK  = (240, 178, 158, 255)   # cheek blush
HT  = (215,  62,  90, 255)   # heart red
MO  = (162, 108,  78, 255)   # mouth line
WH  = (208, 180, 148, 255)   # whisker


def new_img():
    return Image.new("RGBA", (32, 32), T)


def draw_base(d: ImageDraw.ImageDraw):
    """귀 + 머리 + 수염 + 볼터치 — 모든 표정 공통"""
    # 귀 (삼각형)
    d.polygon([(5, 13), (8, 4),  (14, 13)], fill=FU)
    d.polygon([(6, 12), (8, 6),  (13, 12)], fill=EAR)
    d.polygon([(18, 13), (23, 4), (27, 13)], fill=FU)
    d.polygon([(19, 12), (23, 6), (26, 12)], fill=EAR)

    # 머리 (타원)
    d.ellipse([3, 10, 28, 30], fill=FU)
    # 얼굴 중심 (밝은 부분)
    d.ellipse([7, 13, 24, 28], fill=FUL)

    # 코
    d.ellipse([14, 21, 17, 23], fill=NS)

    # 수염
    d.line([ 2, 19, 13, 21], fill=WH, width=1)
    d.line([ 2, 22, 13, 22], fill=WH, width=1)
    d.line([18, 21, 29, 19], fill=WH, width=1)
    d.line([18, 22, 29, 22], fill=WH, width=1)

    # 볼터치
    d.ellipse([ 4, 22,  9, 26], fill=SK)
    d.ellipse([22, 22, 27, 26], fill=SK)


def eyes_normal(d):
    """일반 눈 — ( ˘ ᆺ ˘ )"""
    for ex in (7, 18):
        d.ellipse([ex, 14, ex+7, 21], fill=EW, outline=OL, width=1)
        d.ellipse([ex+1, 15, ex+6, 20], fill=IR)
        d.ellipse([ex+2, 16, ex+5, 19], fill=PU)
        d.point((ex+2, 16), fill=(210, 230, 255, 180))  # 하이라이트


def eyes_happy(d):
    """행복한 눈 (∩ 모양) — 느리게 쓰다듬을 때"""
    # PIL arc: 0°=3시, 시계방향. 180→360 = 위쪽 호 (∩)
    d.arc([ 7, 13, 14, 21], start=200, end=340, fill=OL, width=2)
    d.arc([18, 13, 25, 21], start=200, end=340, fill=OL, width=2)


def eyes_wide(d):
    """왕방울 눈 — 빠르게 문지를 때 ⚡"""
    for ex in (6, 17):
        d.ellipse([ex, 12, ex+9, 21], fill=EW, outline=OL, width=1)
        d.ellipse([ex+1, 13, ex+8, 20], fill=IR)
        d.ellipse([ex+3, 15, ex+6, 19], fill=PU)


def eyes_wink(d):
    """윙크 눈 — 탭 ✨"""
    # 왼쪽: 정상
    d.ellipse([ 7, 14, 14, 21], fill=EW, outline=OL, width=1)
    d.ellipse([ 8, 15, 13, 20], fill=IR)
    d.ellipse([ 9, 16, 12, 19], fill=PU)
    # 오른쪽: 윙크 (∩)
    d.arc([18, 14, 25, 21], start=200, end=340, fill=OL, width=2)


def eyes_heart(d):
    """하트 눈 — 꾹 누르기 💖"""
    def heart(cx, cy):
        d.ellipse([cx-3, cy-2, cx,   cy+2], fill=HT)
        d.ellipse([cx,   cy-2, cx+3, cy+2], fill=HT)
        d.polygon([(cx-3, cy+2), (cx+3, cy+2), (cx, cy+5)], fill=HT)
    heart(10, 16)
    heart(21, 16)


def eyes_blink(d):
    """눈 깜빡임 — dash"""
    d.line([ 7, 17, 14, 17], fill=OL, width=2)
    d.line([18, 17, 25, 17], fill=OL, width=2)


def mouth_normal(d):
    d.arc([12, 22, 19, 28], start=10, end=170, fill=MO, width=1)


def mouth_happy(d):
    d.arc([11, 21, 20, 28], start=0, end=180, fill=MO, width=2)


def mouth_open(d):
    """놀란 입 (살짝 벌림)"""
    d.arc([12, 21, 19, 28], start=10, end=170, fill=MO, width=1)
    d.ellipse([14, 23, 17, 26], fill=OL)


# ── 표정 목록 ─────────────────────────────
SPRITES = {
    "idle":      (eyes_normal, mouth_normal),
    "slow":      (eyes_happy,  mouth_happy),
    "fast":      (eyes_wide,   mouth_open),
    "tap":       (eyes_wink,   mouth_normal),
    "longpress": (eyes_heart,  mouth_happy),
    "blink":     (eyes_blink,  mouth_normal),
}

for name, (eye_fn, mouth_fn) in SPRITES.items():
    img = new_img()
    d   = ImageDraw.Draw(img)
    draw_base(d)
    eye_fn(d)
    mouth_fn(d)
    path = os.path.join(OUT, f"cat_{name}.png")
    img.save(path)
    print(f"✓  {path}")

print("\n모든 스프라이트 생성 완료!")
