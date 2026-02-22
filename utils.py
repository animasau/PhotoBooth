from PIL import Image
import qrcode

def make_strip(photo_paths, output_path="strip.png"):
    images = [Image.open(p) for p in photo_paths]
    widths, heights = zip(*(i.size for i in images))

    total_height = sum(heights)
    max_width = max(widths)

    strip = Image.new("RGB", (max_width, total_height), "white")

    y_offset = 0
    for img in images:
        strip.paste(img, (0, y_offset))
        y_offset += img.size[1]

    strip.save(output_path)
    return output_path

def generate_qr(url, output_path="strip_qr.png"):
    qr = qrcode.make(url)
    qr.save(output_path)
    return output_path