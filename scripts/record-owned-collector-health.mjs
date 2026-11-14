// Update public health only after a fully validated, published Korean Air
// outbound snapshot. Preserve existing private-alert configuration metadata.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function healthyOwnedSnapshot(previous,snapshot,now=new Date()){
 const report=snapshot?.bootstrap?.report;
 if(report?.attempt_complete!==true||!report.source_updated_at||!report.finished_at)
  throw Error('Cannot mark local collector healthy without a completed official publication');
 const timestamp=now.toISOString();
 return {
  ...previous,status:'healthy',source_updated_at:report.source_updated_at,
  last_successful_scan_at:timestamp,
  last_successful_collection_at:timestamp,
  recovered_at:timestamp,
  last_error_code:null,last_error_step:null,
  collection_origin:'USER_OWNED_WINDOWS_CHROME',
  // Keep alerts and past denial event timestamp intact for audit purposes.
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const health=JSON.parse(fs.readFileSync('public-data/health.json','utf8'));
 const snapshot=JSON.parse(fs.readFileSync('public-data/snapshot.json','utf8'));
 const result=healthyOwnedSnapshot(health,snapshot);
 fs.writeFileSync('public-data/health.json',JSON.stringify(result,null,2)+'\n');
 console.log('Verified official Korean Air local collection recorded:',result.source_updated_at);
}
