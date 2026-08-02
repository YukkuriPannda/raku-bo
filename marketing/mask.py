# -*- coding: utf-8 -*-
"""
スクリーンショットの中の、公開したくない固有名にモザイクをかける。

    python mask.py     → real/<名前>.masked.png を作る

lp.mjs はマスク済みのほうを読む。無加工のスクショ（real/shifts.png など）は
.gitignore で除外してある。

**このファイルに実際の固有名を書かないこと。** このリポジトリは public なので、
隠す対象をソースに書いたら隠した意味がなくなる（一度やらかした）。
そのため TARGETS は「座標」と「文字数」だけを持ち、中身は書かない。

座標は uiautomator dump の bounds を実測したもの（目分量ではない）。
撮り直して並び順が変わったら取り直すこと:

    export MSYS_NO_PATHCONV=1        # Git Bash では必須
    adb shell uiautomator dump /sdcard/s.xml && adb pull /sdcard/s.xml
    # <node text="..." bounds="[x1,y1][x2,y2]"> を読む

bounds は行全体（x=107..973 など）を指すが、テキストは左寄せなので
そのまま潰すと長い帯になって不自然。文字数から実長を見積もる。
"""
from PIL import Image

CHAR_W = 46  # 実測: フォント高 59px の行で 1文字あたり約46px

# (文字数, x1, y1, x2, y2)
TARGETS = {
    'shifts': [
        (6, 107, 854, 973, 913),
        (6, 107, 1158, 973, 1217),
        (9, 107, 1461, 973, 1520),
        (9, 107, 1765, 973, 1824),
        (9, 107, 2069, 973, 2117),
    ],
    'planned': [
        (2, 189, 1191, 888, 1250),
        (3, 189, 1834, 888, 1893),
    ],
}


def mosaic(im, box, block=14):
    x1, y1, x2, y2 = box
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(im.width, x2), min(im.height, y2)
    if x2 <= x1 or y2 <= y1:
        return
    reg = im.crop((x1, y1, x2, y2))
    small = reg.resize((max(1, reg.width // block), max(1, reg.height // block)), Image.BILINEAR)
    im.paste(small.resize(reg.size, Image.NEAREST), (x1, y1))


for name, items in TARGETS.items():
    im = Image.open(f'real/{name}.png').convert('RGB')
    for chars, x1, y1, x2, y2 in items:
        # 文字の実長ぶんだけ。少し余白を足して端が残らないようにする
        w = min(x2 - x1, chars * CHAR_W + 18)
        mosaic(im, (x1 - 6, y1 - 6, x1 + w, y2 + 6))
    out = f'real/{name}.masked.png'
    im.save(out)
    print(f'✓ {out}  ({len(items)} 箇所)')
