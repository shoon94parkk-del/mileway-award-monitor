import fs from 'node:fs';
import {collectionCycle} from '../src/collection-cycle.mjs';
import {sourceFreshness} from '../src/health-status.mjs';

const read=(file,fallback={})=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const isoMs=value=>{const ms=Date.parse(value||'');return Number.isFinite(ms)?ms:NaN;};
const latestIso=(...values)=>{let best=null,bestMs=-Infinity;for(const value of values){const ms=isoMs(value);if(ms>bestMs){best=value;bestMs=ms;}}return best;};
const snapshot=read('public-data/snapshot.json');
const health=read('public-data/health.json');
const report=snapshot?.bootstrap?.report||{};
const now=new Date();
const freshness=sourceFreshness(report.source_updated_at||health.source_updated_at,now);
const cycle=collectionCycle(now,{prewarmMinutes:0});
const regions={};
for(const [name,value] of Object.entries(report.region_status||{})){
  regions[name]={
    status:value?.status||'unknown',
    source_updated_at:value?.source_updated_at||null,
    finished_at:value?.finished_at||null,
    routes:Number(value?.routes)||0
  };
}
const successfulReportAt=report.attempt_complete?report.finished_at||null:null;
const reportSupersedesHealth=!!successfulReportAt&&isoMs(successfulReportAt)>isoMs(health.last_error_at);
const healthFailureCurrent=health.status==='degraded'&&!reportSupersedesHealth;
const collectorFailureSteps=new Set(['dependency_install','source_check','tests','collection','publication','build']);
const collectorFailure=healthFailureCurrent&&collectorFailureSteps.has(health.last_error_step);
const notificationFailure=healthFailureCurrent&&health.last_error_step==='notification';
const collectorStatus=collectorFailure?'failed':report.attempt_complete?'succeeded':'partial';
const status={
  version:2,
  schema_version:2,
  generated_at:now.toISOString(),
  cycle_id:cycle.cycle_id,
  collector_status:collectorStatus,
  source_status:freshness.source_status,
  expected_source_at:freshness.expected_source_at,
  observed_source_at:freshness.observed_source_at,
  source_observed_at:latestIso(report.finished_at,health.source_observed_at,health.last_successful_scan_at),
  last_successful_collection_at:latestIso(successfulReportAt,health.last_successful_collection_at,health.last_successful_scan_at),
  last_fresh_publication_at:freshness.source_status==='current'?latestIso(report.finished_at,health.last_fresh_publication_at):(health.last_fresh_publication_at||null),
  publication_id:report.publication_id||null,
  notification_status:notificationFailure?'failed':health.last_notification_check_at?'checked':'unknown',
  last_notification_check_at:health.last_notification_check_at||null,
  heartbeat_at:now.toISOString(),
  error_code:healthFailureCurrent?(health.last_error_step||'unknown'):null,
  regions
};
fs.mkdirSync('public-data',{recursive:true});
fs.writeFileSync('public-data/status.json',JSON.stringify(status,null,2)+'\n');
console.log(`status cycle=${status.cycle_id} collector=${status.collector_status} source=${status.source_status} observed=${status.observed_source_at||'unknown'}`);
