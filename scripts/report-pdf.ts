// docs/report.md -> docs/report.pdf (A4). 실행: bun scripts/report-pdf.ts
// 필요: Google Chrome, uv(쪽 번호 읽기용 pymupdf를 임시로 받음), 인터넷(Pretendard CDN)
// 목차·그림 목록 쪽 번호: 한 번 인쇄한 PDF에서 쪽을 읽어 채운 뒤 다시 인쇄(Chrome은 target-counter 미지원)
import { tmpdir } from "node:os";

const docs = new URL("../docs/", import.meta.url).pathname;
const md = await Bun.file(docs + "report.md").text();
const title = md.match(/^# (.+)$/m)?.[1];
if (!title) throw new Error("docs/report.md에 '# 제목' 줄이 없음");

const plain = (s: string) => s.replace(/<[^>]+>/g, "").trim();
let n = 0;
let body = Bun.markdown.html(md).replace(/<h2>/g, () => `<h2 id="h${++n}">`);
const heads = [...body.slice(body.indexOf('<nav class="toc">')).matchAll(/<h2 id="(h\d+)">(.*?)<\/h2>/g)].map(m => ({ id: m[1], text: plain(m[2]) }));
const figs = [...body.matchAll(/<figcaption>\s*(그림 (\d+)\.[^<]*)/g)].map(m => ({ num: m[2], text: plain(m[1]) }));

const toc = (pages?: { heads: number[]; figs: number[] }) =>
  `<h2 class="toc-title">목차</h2><ol class="toc">${heads.map((h, i) => `<li><a href="#${h.id}">${h.text}</a><span class="dots"></span><span>${pages?.heads[i] ?? "–"}</span></li>`).join("")}</ol>` +
  (figs.length ? `<h2 class="toc-title">그림 목록</h2><ol class="toc">${figs.map((f, i) => `<li><span>${f.text}</span><span class="dots"></span><span>${pages?.figs[i] ?? "–"}</span></li>`).join("")}</ol>` : "");

const tmp = `${tmpdir()}/boogie-report-${process.pid}`;
const page = (pages?: { heads: number[]; figs: number[] }) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<base href="file://${docs}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="report.css"><style>@page { @bottom-left { content: "${title}" } }</style>
</head><body>${body.replace('<nav class="toc"></nav>', `<nav class="toc">${toc(pages)}</nav>`)}</body></html>`;

async function print(html: string, out: string) {
  await Bun.write(`${tmp}.html`, html);
  await using view = new Bun.WebView({ backend: "chrome", width: 794, height: 1123 });
  await view.navigate(`file://${tmp}.html`);
  await view.evaluate("document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode())))");
  const { data } = await view.cdp("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, generateDocumentOutline: true, generateTaggedPDF: true });
  await Bun.write(out, Buffer.from(data, "base64"));
}

await print(page(), `${tmp}.pdf`);
const read = Bun.spawnSync(["uv", "run", "-q", "--no-project", "--with", "pymupdf", "python", "-I", "-c",
  "import sys, json, pymupdf; d = pymupdf.open(sys.argv[1]); print(json.dumps({'toc': d.get_toc(), 'pages': [p.get_text() for p in d]}, ensure_ascii=False))",
  `${tmp}.pdf`]);
if (read.exitCode !== 0) throw new Error(read.stderr.toString());
const { toc: outline, pages: texts } = JSON.parse(read.stdout.toString()) as { toc: [number, string, number][]; pages: string[] };
const tocPage = texts.findIndex(t => t.includes("목차"));
const pages = {
  heads: heads.map(h => outline.find(o => o[1].trim() === h.text)?.[2] ?? NaN),
  figs: figs.map(f => texts.findIndex((t, i) => i > tocPage && t.includes(`그림 ${f.num}.`)) + 1),
};
const missing = [...heads.filter((_, i) => !pages.heads[i]).map(h => h.text), ...figs.filter((_, i) => !pages.figs[i]).map(f => f.text)];
if (missing.length) throw new Error(`쪽을 찾지 못함: ${missing.join(", ")}`);

await print(page(pages), docs + "report.pdf");
console.log(`docs/report.pdf: ${texts.length}쪽, 장 ${heads.length}개, 그림 ${figs.length}개`);
