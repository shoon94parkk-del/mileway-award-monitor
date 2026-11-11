import fs from 'node:fs';
import {checkReturnReport,mergeReturnReports} from '../src/europe-returns.mjs';

const input=process.argv[2]||'data/returns-europe.json';
const destination=process.argv[3]||'public-data/returns.json';
const incoming=JSON.parse(fs.readFileSync(input,'utf8'));
checkReturnReport(incoming);
const previous=fs.existsSync(destination)?JSON.parse(fs.readFileSync(destination,'utf8')):null;
const merged=mergeReturnReports(previous,incoming);
fs.mkdirSync('public-data',{recursive:true});
const tmp=destination+'.tmp';
fs.writeFileSync(tmp,JSON.stringify(merged,null,2)+'\n');
fs.renameSync(tmp,destination);
console.log('Published return award data:',merged.rows.filter(r=>r.verified).length,'verified,',
  merged.preserved_unknown_rows,'previous results preserved as unverified,',
  merged.unqueryable.length,'unqueryable route/months');
