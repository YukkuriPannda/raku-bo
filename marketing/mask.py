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
import os

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


# ------------------------------------------------------------
# レシート写真（カメラ画面のファインダーに使う）
#
# 元写真はリポジトリ外（.gitignore 済み）。無ければこの工程は飛ばす。
#
# 横だけレシート幅に切ると縦横比が約0.45になり、端末画面にそのまま収まる。
# 「上部だけ切り出す」方法は使えない — 縦が足りず、object-fit: cover で
# 必ず文字が左右に切れる。だから全長を使い、隠す部分はモザイクで潰す。
#
# 座標は画像の高さ・幅に対する比率。元写真を撮り直したら取り直すこと。
# ------------------------------------------------------------
RECEIPT_SRC = r'D:\OtherProjects\raku-bo\IMG_20260802_095725406.jpg'

# (説明, x1, y1, x2, y2) — すべて切り出し後の画像に対する比率
RECEIPT_MASKS = [
    # 店舗が特定できる範囲: 支店名・登録番号・住所・電話・店コード。
    # チェーン名（LAWSON）のロゴは残している。全国に多数あり場所を示さないため。
    ('店舗の特定情報', 0.06, 0.238, 0.96, 0.344),
    # 決済まわり: 会員Noの下4桁・有効期限・お取扱日・支払方法・承認番号・
    # 処理通番・AID
    ('決済情報', 0.03, 0.695, 0.99, 0.885),
]

if os.path.exists(RECEIPT_SRC):
    im = Image.open(RECEIPT_SRC).convert('RGB')
    w, h = im.size
    im = im.crop((int(w * 0.19), 0, int(w * 0.79), h))
    W, H = im.size
    for _label, fx1, fy1, fx2, fy2 in RECEIPT_MASKS:
        mosaic(im, (int(W * fx1), int(H * fy1), int(W * fx2), int(H * fy2)), block=26)
    im.thumbnail((1100, 2450), Image.LANCZOS)
    im.save('real/receipt.jpg', quality=90, optimize=True)
    print(f'✓ real/receipt.jpg  ({len(RECEIPT_MASKS)} 箇所)')
else:
    print(f'- レシートの元写真が無いので飛ばした: {RECEIPT_SRC}')
