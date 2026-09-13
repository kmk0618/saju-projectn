import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const mustExist = [
  'lib/child/child-meaning-map.ts',
  'lib/child/child-narrative.ts',
  'lib/child/child-section-planner.ts',
  'lib/child/child-section-generator.ts',
  'lib/child/child-quality.ts',
];
const failures = [];
for (const f of mustExist) if (!fs.existsSync(path.join(root, f))) failures.push(`MISSING_FILE:${f}`);

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const route = read('app/api/report/generate/route.ts');
const pdf = read('app/api/report/pdf/route.ts');
const cats = read('lib/report-categories.ts');
const qualitySource = read('lib/child/child-quality.ts');
const renderer = read('lib/report-pdf.ts');

const checks = [
  ['ROUTE_MEANING_LAYER', route.includes('buildChildMeaningContext')],
  ['ROUTE_NARRATIVE_LAYER', route.includes('generateChildNarrative')],
  ['ROUTE_PLANNER_LAYER', route.includes('planChildSection')],
  ['ROUTE_GENERATOR_LAYER', route.includes('generateChildSection')],
  ['ROUTE_DEPTH_GATE', route.includes('validateChildSectionDepth')],
  ['PDF_FINAL_AUDIT', pdf.includes('auditChildReportDepth')],
  ['STRICT_VERSION', cats.includes('child-report-aqua-50-v4-midlayer')],
  ['S20_RAW_TABLE_BLOCK', qualitySource.includes('S20_RAW_AUDIT_TABLE') && qualitySource.includes('EMPTY_EDITORIAL_LANGUAGE')],
  ['NO_REPORT_ENGINE_ON_COVER', !renderer.includes('REPORT ENGINE ${esc(REPORT_VERSION)}')],
];
for (const [name, ok] of checks) if (!ok) failures.push(name);

const childStart = cats.indexOf('export const CHILD_REPORT_OUTLINE');
const childEnd = cats.indexOf('const COUPLE_CHAPTERS', childStart);
const childChunk = cats.slice(childStart, childEnd);
const nums = [...childChunk.matchAll(/^\s*\[(\d+),\d+,/gm)].map((m) => Number(m[1]));
if (nums.length !== 50 || nums.some((n, i) => n !== i + 1)) failures.push(`CHILD_SECTION_COUNT:${nums.length}`);

// Run the real TypeScript child-quality validator against regression examples.
function loadQualityValidator() {
  const js = ts.transpileModule(qualitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require: () => { throw new Error('unexpected runtime import'); }, console };
  vm.runInNewContext(`(function(require,module,exports){${js}\n})(require,module,exports);`, sandbox);
  return sandbox.module.exports;
}

const q = loadQualityValidator();
const s20 = { section_no: 20, depth: 'deep', layout_type: 'table' };
const rawAuditCandidate = {
  subtitle: '관계 구조', opening_sentence: '관계를 확인합니다.',
  content_html: '<table><tr><th>관계 종류</th><th>사주 구조</th><th>참고 방법</th></tr><tr><td>육합</td><td>申巳합</td><td>구조 확인</td></tr></table>',
  key_basis: ['relations'], life_scenes: ['학교에서 반응', '집에서 반응'],
  parent_actions: ['관찰하기', '확인하기'], scripts: ['천천히 말해보자'], reframe: '긴장 → 집중',
  parent_misreads: [], checklist: [], table_rows: [],
};
const rawResult = q.validateChildSectionDepth({ spec: s20, candidate: rawAuditCandidate });
if (rawResult.ok || !rawResult.issues.includes('S20_RAW_AUDIT_TABLE')) failures.push('REGRESSION_RAW_AUDIT_TABLE_NOT_BLOCKED');

const metaCandidate = {
  ...rawAuditCandidate,
  content_html: '<p>자녀판 번역 규칙에 따라 상관은 표현욕구로 읽습니다.</p><table><tr><th>관계</th><th>아이에게 보이는 반응</th><th>생활 장면</th><th>부모 대응</th></tr></table>',
  life_scenes: ['자녀판 번역 규칙에 따라 학교에서 반응합니다.', '집에서 반응합니다.'],
  parent_actions: ['부모는 상황을 확인합니다.', '부모는 기다립니다.'],
  scripts: ['천천히 말해보자.'], reframe: '예민함 → 세밀하게 느끼는 힘',
};
const metaResult = q.validateChildSectionDepth({ spec: s20, candidate: metaCandidate });
if (metaResult.ok || !metaResult.issues.includes('META_TRANSLATION')) failures.push('REGRESSION_META_LANGUAGE_NOT_BLOCKED');

const goodCandidate = {
  subtitle: '좋아하는 일에도 틀이 필요할 때가 있습니다',
  opening_sentence: '흥미가 붙으면 빠르게 움직이지만 평가가 앞서면 긴장이 커질 수 있습니다.',
  content_html: '<p>학교에서 관심 있는 활동을 시작할 때는 빠르게 몰입합니다.</p><p>집에서는 일정이 빽빽한 날 사소한 일에 짜증이 날 수 있습니다.</p><p>부모는 시작과 종료 기준을 먼저 알려주세요.</p><p>최근 수면과 이동량을 먼저 확인해 주세요.</p><blockquote>먼저 생각나는 대로 말해봐. 그다음 순서를 같이 정리하자.</blockquote><p>예민함 → 변화를 세밀하게 감지하는 힘</p><p>좋아하는 일에 규칙이 들어오면 실력이 자랄 수 있지만, 평가가 너무 빨리 앞서면 긴장이 커질 수 있습니다. 처음에는 즐거움을 지키고 연습량을 천천히 늘려 주세요. 아이가 피곤한 날에는 잘못된 태도라고 단정하기보다 최근 일정 전체를 함께 살펴보는 편이 좋습니다. 이 과정이 반복되면 아이는 자신의 속도를 알아차리고 필요한 도움을 요청하는 법도 배울 수 있습니다.</p><table><tr><th>관계</th><th>아이에게 보이는 반응</th><th>생활 장면</th><th>부모 대응</th></tr><tr><td>합</td><td>흥미와 기준이 함께 작동</td><td>좋아하는 활동</td><td>연습량을 천천히 늘림</td></tr></table>',
  key_basis: ['relations'],
  life_scenes: ['학교에서 관심 있는 활동을 시작할 때는 빠르게 몰입합니다.', '집에서는 일정이 빽빽한 날 사소한 일에 짜증이 날 수 있습니다.'],
  parent_actions: ['부모는 시작과 종료 기준을 먼저 알려주세요.', '최근 수면과 이동량을 먼저 확인해 주세요.'],
  scripts: ['먼저 생각나는 대로 말해봐. 그다음 순서를 같이 정리하자.'],
  reframe: '예민함 → 변화를 세밀하게 감지하는 힘', parent_misreads: [], checklist: [], table_rows: [],
};
const goodResult = q.validateChildSectionDepth({ spec: s20, candidate: goodCandidate });
if (!goodResult.ok) failures.push(`REGRESSION_GOOD_SECTION_REJECTED:${goodResult.issues.join('+')}`);

if (failures.length) {
  console.error('CHILD MIDLAYER VERIFY FAILED');
  for (const f of failures) console.error('-', f);
  process.exit(1);
}
console.log('CHILD MIDLAYER VERIFY OK');
console.log('- 50 sections: OK');
console.log('- meaning -> narrative -> planner -> generator -> quality: OK');
console.log('- section 20 raw audit table regression test: BLOCKED');
console.log('- internal/meta language regression test: BLOCKED');
console.log('- valid interpreted section regression test: PASSED');
console.log('- PDF final audit: OK');
console.log('- customer cover internal engine label removed: OK');
