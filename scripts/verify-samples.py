from pathlib import Path
import pymupdf as fitz
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
sheet=Image.new('RGB',(880,5*320),'#ddd9d0')
for col,key in enumerate(['life','child','couple','new-year']):
    doc=fitz.open(root/'public/samples'/key/'preview.pdf')
    assert len(doc)==5
    for row,page in enumerate(doc):
        assert not page.get_text().strip(),f'Unexpected text layer: {key}/{row+1}'
        pix=page.get_pixmap(matrix=fitz.Matrix(.34,.34),alpha=False)
        img=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
        img.thumbnail((210,298))
        sheet.paste(img,(col*220+5,row*320+20))
        ImageDraw.Draw(sheet).text((col*220+7,row*320+3),f'{key} {row+1}/5',fill='black')
(root/'.private').mkdir(exist_ok=True)
sheet.save(root/'.private/sample-contact.png')
assert not (root/'public/customer-reports').exists()
assert (root/'.private/original-public-samples').is_dir()
print('4 sample PDFs / 20 pages: raster-only, legacy public assets archived locally.')
