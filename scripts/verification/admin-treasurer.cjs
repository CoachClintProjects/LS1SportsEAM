const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in deps)return deps[n];throw Error(n);},Date,Set,Map,JSON,BigInt,Number,String,Boolean,Promise,encodeURIComponent});return m.exports;}
const policy=load('lib/treasurerPolicy.ts'),amounts=load('lib/client/ledgerAmounts.ts');
assert.equal(policy.cashPacket({denominations:{20:'10',10:'10',5:'20'},handoff_to:'Authorized custodian',handoff_confirmed:true}).amount,'400.00');
for(const denominations of [{20:'-1',10:'0',5:'0'},{20:'1.5',10:'0',5:'0'},{20:'Infinity',10:'0',5:'0'}])assert.throws(()=>policy.cashPacket({denominations,handoff_to:'Custodian',handoff_confirmed:true}));
assert.throws(()=>policy.cashPacket({denominations:{20:1,10:0,5:0},handoff_to:'Custodian',handoff_confirmed:false}));
for(const action of ['update-compliance-record','create-competition','void-invoice','lease_terms'])assert(!policy.treasurerCommands.includes(action));
assert.equal(amounts.decimal(amounts.cents('0.10')+amounts.cents('0.20')),'0.30');
class PersonRecordError extends Error{constructor(status,message){super(message);this.status=status;}}
let lines=[{debit:'0.30',credit:'0.00',currency:'CAD'},{debit:'0.00',credit:'0.30',currency:'CAD'}];
const calls=[];const rest=async(path)=>{calls.push(path);return path.startsWith('rpc/')?{ledger:{id:'ledger-a',currency:'CAD'},accounts:[]}:[{id:'journal-a',gl_lines:lines}];};
const {verifiedLedgerReport}=load('lib/server/verifiedLedgerReport.ts',{'./adminRecordAccess':{recordRest:rest},'./adminPersonRecord':{PersonRecordError},'@/lib/client/ledgerAmounts':amounts});
(async()=>{
 const args={p_tenant:'tenant-a',p_org:'org-a',p_ledger:'ledger-a',p_from:'2026-01-01',p_to:'2026-10-14'};
 await verifiedLedgerReport(args);assert(calls[1].includes('ledger_id=eq.ledger-a&status=eq.posted'));
 lines[1].credit='0.29';await assert.rejects(verifiedLedgerReport(args),e=>e.status===409);
 lines[1].credit='0.30';lines[1].currency='USD';await assert.rejects(verifiedLedgerReport(args),e=>e.status===409);
 lines=[];await assert.rejects(verifiedLedgerReport(args),e=>e.status===409);
 console.log('PASS: denomination validation, custody confirmation, restricted commands, decimal-safe sums, posted-only reporting, unbalanced and mixed-currency journal rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
