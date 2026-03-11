from PIL import Image

try:
    img = Image.open("/Users/chrisconnolly/.gemini/antigravity/brain/816c3550-c4a9-411e-9fbb-7e9934b32ae8/PLEDIT.BMP")
    print(f"PLEDIT.BMP Size: {img.size}")
except Exception as e:
    print(f"Error: {e}")
