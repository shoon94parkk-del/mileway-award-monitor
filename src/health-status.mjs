import {dailySourceIsStale,expectedDailySourceUpdatedAt} from './source-timestamp.mjs';

export function sourceFreshness(observedSourceAt,now=new Date()){
 const expected=expectedDailySourceUpdatedAt(now);
 const observed=String(observedSourceAt||'').trim()||null;
 if(!observed)return {source_status:'unknown',expected_source_at:expected,observed_source_at:null};
 return {
  source_status:dailySourceIsStale(observed,now)?'delayed':'current',
  expected_source_at:expected,
  observed_source_at:observed
 };
}

export function collectorStatus({fullScan=false,collect='skipped',build='skipped',publish='skipped'}={}){
 if(['failure','cancelled'].includes(collect)||['failure','cancelled'].includes(build)||['failure','cancelled'].includes(publish))return 'failed';
 if(fullScan&&collect==='success'&&build==='success')return 'succeeded';
 if(collect==='success')return 'partial';
 return 'scheduled';
}
