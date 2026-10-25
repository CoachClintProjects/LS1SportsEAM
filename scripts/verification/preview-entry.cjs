// All environments retain the corporate homepage; outages render a recovery state.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let calls=0,unavailable=false,published=true;const env={VERCEL_ENV:'preview'},m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,process:{env},console:{error:()=>{}},require:n=>{
 if(n==='react')return {cache:fn=>fn};
 if(n==='next/link')return {default:'Link'};
 if(n==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(n.endsWith('marketingSite'))return {getMarketingSite:async()=>{calls++;if(unavailable)throw Error('Marketing backend unavailable');return published?{site:{meta_title:'Published title',meta_description:'Published description'}}:null;}};
 if(n.endsWith('CorporateWebsite'))return {CorporateWebsite:'CorporateWebsite'};
 throw Error(n);
}});
(async()=>{
 for(const environment of ['preview','production']){env.VERCEL_ENV=environment;assert.equal((await m.exports.generateMetadata()).title,'Published title');assert.equal((await m.exports.default()).type,'CorporateWebsite');}
 unavailable=true;assert.equal((await m.exports.generateMetadata()).title,'LS1Sports');const failure=JSON.stringify(await m.exports.default());assert.match(failure,/temporarily unavailable/);assert.match(failure,/\/login/);
 unavailable=false;published=false;assert.match(JSON.stringify(await m.exports.default()),/not currently published/);
 const errors={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/client/signInError.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:errors,exports:errors.exports});
 const message=errors.exports.signInErrorMessage;
 assert.match(message({code:'invalid_credentials'}),/email or password was not accepted/);
 for(const error of [null,{status:503},{status:0,name:'AuthRetryableFetchError'},{status:401,code:'invalid_api_key'}])assert.match(message(error),/does not mean your password is incorrect/);
 assert.match(message({status:429}),/Too many/);
 console.log('PASS: corporate homepage restored on Preview and Production; outages show recovery links; service errors are not mislabeled as incorrect passwords.');
})().catch(e=>{console.error(e);process.exitCode=1;});
