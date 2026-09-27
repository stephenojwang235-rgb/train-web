from pathlib import Path
import qrcode
from qrcode.constants import ERROR_CORRECT_H

PUBLIC_URL = "https://gold-hounds-sing.loca.lt"
OUTPUT = Path(__file__).with_name("nicc-campus-live-qr.png")

qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,
    box_size=12,
    border=4,
)
qr.add_data(PUBLIC_URL)
qr.make(fit=True)
image = qr.make_image(fill_color="#0f172a", back_color="white")
image.save(OUTPUT)
print(f"Created {OUTPUT} for {PUBLIC_URL}")
