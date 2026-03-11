from PIL import Image

img = Image.open("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT.BMP")

# Test crop 1
crop1 = img.crop((43, 42, 43+22, 42+42))
crop1.save("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/crop1.png")

# Actually, let's find the real menu. It's usually near the bottom filler.
# The whole image is 275 x 116 (or whatever). 
# Let's save the whole thing as PNG so I can see it in artifacts if I need to.
img.save("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT_full.png")

