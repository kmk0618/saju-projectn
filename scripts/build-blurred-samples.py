"""Create public raster-only previews. Source PDFs are never copied into public/."""
from pathlib import Path
import argparse, json, shutil, io
import pymupdf as fitz
from PIL import Image, ImageFilter, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
SPECS=[
    ('life','종합 인생 리포트','종합 인생 리포트-허승진.pdf',[1,8,32,55,83],'sample-life.html'),
    ('child','자녀 사주 리포트','자녀사주_최시준_최종샘플_수정본.pdf',[1,9,30,56,87],'sample-child.html'),
    ('couple','커플·부부 궁합 리포트','부부궁합_50SECTION_심층최종본_원본양식_최종_3.pdf',[1,5,26,52,84],'sample-compatibility.html'),
    ('new-year','2027 신년 운세 리포트','완성형_2027신년운세리포트.pdf',[1,4,10,18,24],'sample-new-year.html'),
]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,default=Path.home()/'Downloads/Documents')
    args=parser.parse_args()
    for _,_,name,_,_ in SPECS:
        if not (args.source_dir/name).is_file():raise FileNotFoundError(name)
    # Preserve the previous intentionally public sample locally, outside deployment.
    old=(ROOT/'public/customer-reports').resolve();archive=(ROOT/'.private/original-public-samples').resolve()
    assert old.is_relative_to(ROOT) and archive.is_relative_to(ROOT)
    if old.exists():
        if archive.exists():raise RuntimeError('Archive already exists; review before replacing.')
        archive.parent.mkdir(exist_ok=True)
        shutil.move(str(old),str(archive))
    font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',29)
    small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',19)
    manifest=[]
    for key,title,name,pages,htmlname in SPECS:
        source=fitz.open(args.source_dir/name)
        chosen=[min(p,len(source)) for p in pages]
        dest=ROOT/'public/samples'/key;dest.mkdir(parents=True,exist_ok=True)
        preview_pdf=fitz.open()
        for index,pno in enumerate(chosen,1):
            page=source[pno-1];pix=page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False)
            original=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
            # Blur all pixels before encoding; there is no CSS toggle or retained text layer.
            blurred=original.filter(ImageFilter.GaussianBlur(10))
            draw=ImageDraw.Draw(blurred)
            x,y=32,32
            draw.rounded_rectangle((x,y,blurred.width-x,y+125),radius=14,fill='#fff8e7',outline='#d6b763',width=2)
            draw.text((x+22,y+15),title,font=font,fill='#3b3020')
            draw.text((x+22,y+68),f'공개 샘플 {index:02d} / 05 · 본문과 개인정보 블러 처리',font=small,fill='#74603c')
            image_path=dest/f'page-{index:02d}.jpg';blurred.save(image_path,quality=88,optimize=True)
            if key=='life':
                (ROOT/'public/report-preview').mkdir(exist_ok=True)
                blurred.save(ROOT/'public/report-preview'/f'page-{index:02d}.png',optimize=True)
            out=preview_pdf.new_page(width=page.rect.width,height=page.rect.height)
            out.insert_image(out.rect,filename=str(image_path))
        preview_pdf.set_metadata({'title':title+' - 공개 블러 샘플','author':'나의사주'})
        preview_pdf.save(dest/'preview.pdf',garbage=4,deflate=True)
        reopened=fitz.open(dest/'preview.pdf')
        assert len(reopened)==5 and not any(p.get_text().strip() for p in reopened)
        imgs=''.join(f'<figure><img src="/samples/{key}/page-{i:02d}.jpg" alt="{title} 블러 샘플 {i}" loading="lazy"><figcaption>샘플 {i} / 5</figcaption></figure>' for i in range(1,6))
        nav=''.join(f'<a href="/{h}"'+(' aria-current="page"' if k==key else '')+f'>{t}</a>' for k,t,_,_,h in SPECS)
        html=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} 샘플 | 나의사주</title>
<meta name="description" content="{title}의 구성과 분위기를 확인하는 블러 샘플 5장입니다.">
<style>*{{box-sizing:border-box}}body{{margin:0;background:#fbf8ef;color:#30291f;font-family:'Malgun Gothic',sans-serif;word-break:keep-all}}header{{background:#fff;border-bottom:1px solid #e7dcc1;padding:18px}}header div,main{{max-width:900px;margin:auto}}a{{color:inherit}}header div{{display:flex;justify-content:space-between}}main{{padding:32px 18px 70px}}h1{{font-size:30px}}p{{line-height:1.8;color:#6b604b}}nav{{display:flex;gap:8px;flex-wrap:wrap}}nav a,.download{{display:inline-block;padding:11px 15px;background:#fff;border:1px solid #dfd1af;border-radius:12px;text-decoration:none}}nav a[aria-current]{{background:#30291f;color:#fff}}.download{{background:#f3d168;font-weight:bold;margin-top:15px}}figure{{margin:26px 0}}img{{display:block;width:100%;height:auto;border-radius:12px;border:1px solid #e4dccb}}figcaption{{text-align:center;color:#7d725d;padding:10px}}@media(max-width:560px){{h1{{font-size:25px}}}}</style></head><body><header><div><b>나의사주</b><a href="/saju.html#reports">상품으로 돌아가기</a></div></header>
<main><nav aria-label="상품별 샘플">{nav}</nav><h1>{title}<br>미리보기 5장</h1><p>리포트 샘플에서 발췌한 미리보기입니다. 본문과 개인정보는 이미지 자체에 블러 처리되어 있습니다. 샘플은 구성과 디자인을 확인하는 예시이며, 구매 후에는 본인 정보로 생성된 리포트가 제공됩니다.</p><a class="download" href="/samples/{key}/preview.pdf" download>블러 샘플 PDF 받기</a>{imgs}<a href="/saju.html#reports">리포트 상품 선택하기 →</a></main></body></html>'''
        (ROOT/'public'/htmlname).write_text(html,encoding='utf-8')
        manifest.append({'category':key,'source_pages':len(source),'selected_pages':chosen,'public_pdf':f'/samples/{key}/preview.pdf','raster_only':True})
    (ROOT/'docs/sample-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))

if __name__=='__main__':main()
