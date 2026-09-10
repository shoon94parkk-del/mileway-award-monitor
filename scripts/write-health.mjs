import fs from 'node:fs';
import path from 'node:path';
const file=path.resolve(process.argv[2]||'public-data/health.json');
const read=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {version:1,status:'unknown'};}};
const now=new Date().toISOString(),prev=read();
const source=process.env.SOURCE_OUTCOME||'skipped',collect=process.env.COLLECT_OUTCOME||'skipped',notify=process.env.NOTIFY_OUTCOME||'skipped';
const fullScan=process.env.FULL_SCAN==='true';
const alerts={rules_configured:!!process.env.ALERT_RULES_JSON,telegram_configured:!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),email_configured:!!(process.env.RESEND_API_KEY&&process.env.ALERT_EMAIL_TO&&process.env.ALERT_EMAIL_FROM)};
let status='healthy',error_step=null;
if(source==='failure'){status='degraded';error_step='source_check';}
else if(collect==='failure'){status='degraded';error_step='collection';}
else if(notify==='failure'){status='degraded';error_step='notification';}
const next={...prev,version:1,status,alerts};
if(process.env.CURRENT_SOURCE)next.source_updated_at=process.env.CURRENT_SOURCE;
if(fullScan&&collect==='success'){next.last_successful_scan_at=now;next.source_updated_at=process.env.CURRENT_SOURCE||next.source_updated_at||null;}
if(notify==='success'&&alerts.rules_configured&&(alerts.telegram_configured||alerts.email_configured))next.last_notification_check_at=now;
if(error_step){next.last_error_at=now;next.last_error_step=error_step;}
if(status==='healthy'&&prev.status==='degraded')next.recovered_at=now;
fs.mkdirSync(path.dirname(file),{recursive:true});
const before=JSON.stringify(prev),after=JSON.stringify(next);if(before!==after)fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
console.log(`health=${status}${error_step?` step=${error_step}`:''}`);
