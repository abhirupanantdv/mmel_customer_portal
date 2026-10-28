from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CARD = ROOT / "public" / "assets" / "membership-card.png"
LOGO = Path("/tmp/mmel-logo-reference.png")
OUTPUT = ROOT / "public" / "assets" / "membership-card-exact-logo.png"


def paste_scaled(base: Image.Image, insert: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, width, height = box
    scaled = insert.resize((width, height), Image.Resampling.LANCZOS)
    if scaled.mode == "RGBA":
        base.paste(scaled, (x, y), scaled)
    else:
        base.paste(scaled, (x, y))


card = Image.open(CARD).convert("RGB")
authoritative = Image.open(LOGO).convert("RGB")

# Exact crop from the authoritative logo file. The existing card's correctly
# spelled "Foreign Currency Specialist" line remains untouched below it.
logo_plate = authoritative.crop((10, 9, 397, 109))
plate_red = authoritative.getpixel((18, 18))
draw = ImageDraw.Draw(card)

# Front card.
draw.rounded_rectangle((328, 40, 765, 136), radius=8, fill=plate_red)
paste_scaled(card, logo_plate, (365, 41, 364, 94))

# Back card.
draw.rounded_rectangle((318, 558, 629, 626), radius=6, fill=plate_red)
paste_scaled(card, logo_plate, (346, 559, 255, 66))

card.save(OUTPUT, format="PNG", optimize=True)
print(OUTPUT)
