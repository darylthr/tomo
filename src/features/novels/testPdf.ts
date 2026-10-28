/** A small valid PDF with `pages` pages of text, for tests. */
export function makePdf(pages: number, title = 'Test PDF'): Uint8Array {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${5 + i * 2} 0 R`).join(' ');
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = `<< /Title (${title}) /Author (Tomo) >>`;
  for (let i = 0; i < pages; i++) {
    const content = `BT /F1 48 Tf 60 360 Td (Page ${i + 1}) Tj ET`;
    objects[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /Font << /F1 3 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objects[6 + i * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  }
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++) out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}
