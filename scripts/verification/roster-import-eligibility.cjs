// Pure parser and eligibility regressions; no business records or database writes.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Map,Set});return m.exports;}
const {parseRosterCsv,csvDate}=load('lib/rosterCsv.ts');
assert.equal(parseRosterCsv('\ufeffGiven,Surname,Notes\r\n"First, given",Last,"Line one\nLine ""two"""').rows[0][2],'Line one\nLine "two"');
assert.throws(()=>parseRosterCsv('Name,Name\na,b'),/unique/);
assert.throws(()=>parseRosterCsv('Name,DOB\na'),/different number/);
assert.throws(()=>parseRosterCsv('Name,DOB\n"a,b'),/unclosed/);
assert.equal(csvDate('28/07/2015','dmy'),'2015-07-28');assert.equal(csvDate('07/28/2015','mdy'),'2015-07-28');
const {competitionEligibility:e}=load('lib/athleteEligibility.ts');const c={id:'c',sport_id:'s',starts_at:'2026-11-15'};const rule={id:'r',name:'Required rule',sport_id:'s',status:'active'};const decision={rule_id:'r',competition_id:'c',status:'eligible',evaluated_at:'2026-10-31'};const now=Date.parse('2026-10-31T12:00:00Z');
assert.equal(e(c,[],[],now).status,'Not assessed / review required');
assert.equal(e(c,[rule],[decision],now).status,'Eligible');
assert.equal(e(c,[rule,{...rule,id:'r2'}],[decision],now).status,'Not assessed / review required');
assert.equal(e(c,[rule],[{...decision,expires_at:'2026-10-30'}],now).status,'Not assessed / review required');
assert.equal(e(c,[rule],[{...decision,expires_at:'2026-11-05'}],now).status,'Not assessed / review required');
assert.equal(e(c,[rule],[{...decision,status:'blocked'}],now).status,'Not eligible');
assert.equal(e(c,[rule],[decision,{...decision,rule_id:null,status:'blocked'}],now).status,'Not eligible');
assert.equal(e(c,[],[decision],now).status,'Not assessed / review required');
console.log('PASS: CSV quotes/newlines/headers/row widths/date formats and missing, partial, expired and blocked eligibility.');
