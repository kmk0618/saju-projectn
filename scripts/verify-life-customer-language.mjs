import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const failures = [];

for (const f of [
  'lib/life/life-quality.ts',
  'lib/report-prompts.ts',
  'lib/report-spec.ts',
  'app/api/report/generate/route.ts',
  'app/api/report/pdf/route.ts',
  'lib/report-pdf.ts',
]) {
  if (!fs.existsSync(path.join(root, f))) failures.push(`MISSING:${f}`);
}

const qualitySource = read('lib/life/life-quality.ts');
const prompts = read('lib/report-prompts.ts');
const spec = read('lib/report-spec.ts');
const route = read('app/api/report/generate/route.ts');
const pdf = read('app/api/report/pdf/route.ts');
const renderer = read('lib/report-pdf.ts');

const checks = [
  ['VERSION_V2', spec.includes('life-report-aqua-50-v2-direct-narration')],
  ['PROMPT_DIRECT_NARRATION', prompts.includes('제시되어 있습니다') && prompts.includes('직접 서술')],
  ['ROUTE_LIFE_SECTION_GATE', route.includes('validateCustomerFacingLifeSection')],
  ['ROUTE_LIFE_NARRATIVE_GATE', route.includes('auditCustomerFacingLifeReport([], narrative)')],
  ['LIFE_REWRITE_4', route.includes('config.key === "life"') && route.includes('? 4 : 1')],
  ['PDF_LIFE_FINAL_AUDIT', pdf.includes('PDF_LIFE_CONTENT_AUDIT_FAILED')],
  ['PDF_RENDERED_HTML_AUDIT', pdf.includes('PDF_LIFE_RENDER_AUDIT_FAILED')],
  ['NO_ENGINE_IMPORT_RENDERER', !renderer.includes('REPORT_VERSION')],
  ['NO_ENGINE_LABEL_RENDERER', !/REPORT\s*ENGINE/i.test(renderer)],
];
for (const [name, ok] of checks) if (!ok) failures.push(name);

function loadQuality() {
  const js = ts.transpileModule(qualitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require: () => { throw new Error('unexpected import'); }, console };
  vm.runInNewContext(`(function(require,module,exports){${js}\n})(require,module,exports);`, sandbox);
  return sandbox.module.exports;
}

const q = loadQuality();
const badPresented = q.validateCustomerFacingLifeSection({ content_html: '<p>명식에서 일간은 경(庚)으로 제시되어 있습니다.</p>' });
if (badPresented.ok || !badPresented.issues.includes('EVIDENCE_PRESENTED')) failures.push('REGRESSION_PRESENTED_NOT_BLOCKED');

const badSource = q.validateCustomerFacingLifeSection({ content_html: '<p>관계 자료에는 묘술합이 제시되어 있습니다.</p>' });
if (badSource.ok) failures.push('REGRESSION_SOURCE_READING_NOT_BLOCKED');

const badMeta = q.validateCustomerFacingLifeSection({ content_html: '<p>작성 지침에 따라 다음 형식으로 풀이합니다.</p>' });
if (badMeta.ok || !badMeta.issues.includes('META_WRITING')) failures.push('REGRESSION_META_NOT_BLOCKED');

const badPerson = q.validateCustomerFacingLifeSection({ content_html: '<p>이 사람은 변화에 강합니다.</p>' });
if (badPerson.ok || !badPerson.issues.includes('THIRD_PERSON_THIS_PERSON')) failures.push('REGRESSION_THIRD_PERSON_NOT_BLOCKED');

const badPercent = q.validateCustomerFacingLifeSection({ content_html: '<p>화 기운은 33.18%입니다.</p>' });
if (badPercent.ok || !badPercent.issues.includes('RAW_DECIMAL_PERCENT')) failures.push('REGRESSION_DECIMAL_PERCENT_NOT_BLOCKED');

const good = q.validateCustomerFacingLifeSection({
  opening_sentence: '지금은 조건을 비교해 움직일 때입니다.',
  content_html: '<p>일간은 경금(庚金)입니다. 현재는 32세부터 41세까지 이어지는 무술(戊戌) 대운에 있습니다. 연지와 시지에는 묘술합이 형성되어 있습니다.</p><p>이직에서는 단순한 탈출보다 역할과 보상이 분명한 자리를 고르는 편이 유리합니다.</p>',
  table_rows: [{ label: '화', value: '33%' }],
});
if (!good.ok) failures.push(`REGRESSION_GOOD_REJECTED:${good.issues.join('+')}`);

const htmlBad = q.auditLifeRenderedHtml('<html><body><div>REPORT ENGINE life-report-aqua-50-v2-direct-narration</div></body></html>');
if (htmlBad.ok || !htmlBad.issues.includes('ENGINE_VERSION_VISIBLE')) failures.push('REGRESSION_ENGINE_LABEL_NOT_BLOCKED');

if (failures.length) {
  console.error('LIFE CUSTOMER LANGUAGE VERIFY FAILED');
  for (const f of failures) console.error('-', f);
  process.exit(1);
}
console.log('LIFE CUSTOMER LANGUAGE VERIFY OK');
console.log('- evidence narration (제시되어 있습니다): BLOCKED');
console.log('- source-reading language (자료/산출값/입력값): BLOCKED');
console.log('- writing/meta instructions: BLOCKED');
console.log('- third-person "이 사람": BLOCKED');
console.log('- raw decimal percentages: BLOCKED');
console.log('- engine/version in rendered customer HTML: BLOCKED');
console.log('- direct customer narration examples: PASSED');
