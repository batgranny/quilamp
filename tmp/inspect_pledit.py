from PIL import Image, ImageDraw

img = Image.open("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT.BMP")
draw = ImageDraw.Draw(img)

# Draw grid lines
for x in range(0, img.width, 22):
    draw.line([(x, 0), (x, img.height)], fill=(255, 0, 0))
for y in range(0, img.height, 18):
    draw.line([(0, y), (img.width, y)], fill=(255, 0, 0))
    
img.save("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/pledit_grid.png")
