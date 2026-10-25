// The Preview entry route must work even when the marketing backend is down.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let calls=0,unavailable=true;const env={VERCEL_ENV:'preview'},m={exports:{}};
const redirect=Object.assign(new Error('redirect'),{location:'/login'});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,process:{env},require:n=>{
 if(n==='next/navigation')return {redirect:path=>{assert.equal(path,'/login');throw redirect;}};
 if(n==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(n.endsWith('marketingSite'))return {getMarketingSite:async()=>{calls++;if(unavailable)throw Error('Marketing backend unavailable');return {site:{meta_title:'Published title',meta_description:'Published description'}};}};
 if(n.endsWith('CorporateWebsite'))return {CorporateWebsite:'CorporateWebsite'};
 throw Error(n);
}});
(async()=>{
 assert.equal((await m.exports.generateMetadata()).title,'LS1Sports Preview');
 await assert.rejects(m.exports.default(),e=>e===redirect);assert.equal(calls,0);
 env.VERCEL_ENV='production';unavailable=false;
 assert.equal((await m.exports.generateMetadata()).title,'Published title');
 assert.equal((await m.exports.default()).type,'CorporateWebsite');assert.equal(calls,2);
 console.log('PASS: Preview metadata and redirect require no marketing fetch; production retains the published website.');
})().catch(e=>{console.error(e);process.exitCode=1;});
