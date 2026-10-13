// Pure calculation/security vectors. No live personnel or financial records are created.
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(path){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,BigInt});return m.exports;}
const {csvCell,csvFile}=load('lib/overwatch/csv.ts');
for(const v of ['=1+1','+SUM(A1)','-1+2','@SUM(A1)','\t=1','  =1','\r=1','\n=1'])assert.ok(csvCell(v).startsWith('"\''));
assert.equal(csvCell('Coach "A", team\n'),'"Coach ""A"", team"');assert.equal(csvCell(null),'""');assert.ok(csvFile(['name'],[['=1']]).startsWith('\uFEFF"name"\r\n"\'=1"'));
const {cents,money,reports}=load('lib/overwatch/reports.ts');assert.equal(money(cents('0.10')+cents('0.20')),'0.30');assert.equal(money(cents('-900719925474099.99')),'-900719925474099.99');assert.throws(()=>cents('NaN'));assert.throws(()=>cents('1.001'));
const a=(type,closing,debit='0',credit='0')=>({id:type,account_type:type,closing,debit,credit});
const r=reports([a('asset','150','50'),a('equity','-100'),a('revenue','-80','0','80'),a('expense','30','30')]);
assert.equal(r.netIncome,'50.00');assert.equal(r.balanceDifference,'0.00');assert.equal(r.trialDifference,'0.00');assert.equal(r.trialDebit,'180.00');assert.equal(reports([a('asset','1')]).trialDifference,'1.00');assert.throws(()=>reports([a('unknown','0')]));
console.log('PASS: CSV formula neutralization, quoting, timestamp-safe data, exact cents, statements and unbalanced trial detection. No live writes.');
