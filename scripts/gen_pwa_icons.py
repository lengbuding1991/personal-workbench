#!/usr/bin/env python3
"""
生成 PWA 需要的 PNG 图标（纯 Pillow，无第三方数值库依赖）。

设计来源：components/Sidebar.tsx 里 .logo 的品牌标记 —— 蓝绿渐变底 +
三个白色圆角方块（viewBox 0 0 20 20 里的三个 rect）。这样主屏图标和
应用里每次都看到的侧栏 logo 是同一个东西，浏览器标签页也不会打架。

用法（需要 Pillow）：
    python3 scripts/gen_pwa_icons.py
输出（写到 public/）：
    icon-192.png / icon-512.png                 "any" 图标，方块满幅
    icon-maskable-192.png / icon-maskable-512.png "maskable"，留更大安全边距
    apple-touch-icon.png (180)                  iOS 主屏，方块满幅不透明

为什么全是「方块满幅、不透明」：
  · iOS 会自动给主屏图标切圆角，透明角会被渲成黑块 —— 所以 apple-touch 必须不透明。
  · Android 的 maskable 会自己裁形状，"any" 会被放进白色圆角底板 —— 方块底最稳。
  · 故统一不做圆角、不做透明，跨平台最省心。
"""
import os
from PIL import Image, ImageChops, ImageOps, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "public"))
os.makedirs(PUBLIC, exist_ok=True)

# 侧栏 .logo 的渐变：linear-gradient(145deg, #5AD7C9, #35A8D8)
C0 = (0x5A, 0xD7, 0xC9)   # 左上 青绿
C1 = (0x35, 0xA8, 0xD8)   # 右下 蓝

# Sidebar logo 里的三个 rect（20×20 坐标系），转成 (x1,y1,x2,y2,圆角,不透明度)
BLOCKS = [
    (1, 1, 11, 7, 3, 0.95),
    (1, 9, 7, 19, 3, 0.80),
    (9, 9, 19, 19, 5, 0.55),
]

SS = 4  # 超采样倍数，最后 LANCZOS 缩小，边缘更干净


def diagonal_gradient(n):
    """从左上 C0 到右下 C1 的线性渐变（对角方向 ∝ x+y）。纯 PIL，快。"""
    v = Image.linear_gradient("L").resize((n, n), Image.BICUBIC)   # ∝ y
    h = v.transpose(Image.Transpose.TRANSPOSE)                      # ∝ x
    g = ImageChops.add(v, h, scale=2.0)                             # (x+y)/2 → 0..255
    return ImageOps.colorize(g, C0, C1).convert("RGBA")              # 0→C0, 255→C1


def draw_glyph(img, n, glyph_ratio):
    """在 n×n 画布中央画三个白色圆角方块，占 glyph_ratio 比例。"""
    glyph = n * glyph_ratio
    scale = glyph / 20.0
    ox = (n - glyph) / 2.0
    oy = (n - glyph) / 2.0

    def p(val):
        return ox + val * scale

    layer = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x1, y1, x2, y2, r, a in BLOCKS:
        d.rounded_rectangle(
            [p(x1), p(y1), p(x2), p(y2)],
            radius=r * scale,
            fill=(255, 255, 255, int(round(255 * a))),
        )
    return Image.alpha_composite(img, layer)


def make(size, out, glyph_ratio):
    n = size * SS
    img = diagonal_gradient(n)
    img = draw_glyph(img, n, glyph_ratio)
    img = img.convert("RGB").resize((size, size), Image.LANCZOS)
    path = os.path.join(PUBLIC, out)
    img.save(path, "PNG", optimize=True)
    print("wrote", path, f"({size}x{size})")


# "any" / apple-touch：logo 占 58%，视觉饱满
for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    make(size, name, 0.58)

# "maskable"：Android 会裁成圆形，重要内容必须落在中央 80% 安全圈内。
# 方块缩到 44%，其半对角 ~0.31N 远小于 0.4N 半径，稳稳在安全区。
for size, name in [(192, "icon-maskable-192.png"), (512, "icon-maskable-512.png")]:
    make(size, name, 0.44)

print("done.")
