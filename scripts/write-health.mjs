import fs from 'node:fs';
import path from 'node:path';
import {readTelegramTarget} from './telegram-target.mjs';
const file=path.resolve(process.argv[2]||'public-data/health.json');
const read=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {version:1,status:'unknown'};}};
const readSnapshotSource=()=>{try{const s=JSON.parse(fs.readFileSync('public-data/snapshot.json','utf8'));return s?.bootstrap?.report?.source_updated_at||null;}catch{return null;}};
const now=new Date().toISOString(),prev=read();
const install=process.env.INSTALL_OUTCOME||'skipped',source=process.env.SOURCE_OUTCOME||'skipped',tests=process.env.TESTS_OUTCOME||'skipped',collect=process.env.COLLECT_OUTCOME||'skipped',build=process.env.BUILD_OUTCOME||'skipped',notify=process.env.NOTIFY_OUTCOME||'skipped';
const fullScan=process.env.FULL_SCAN==='true';
const publish=process.env.PUBLISH_OUTCOME||'skipped';
const telegramToken=process.env.TELEGRAM_BOT_TOKEN||'';
const explicitChat=process.env.TELEGRAM_CHAT_ID||'';
const savedTelegram=telegramToken&&!explicitChat?readTelegramTarget(telegramToken):null;
const telegramTargetReady=!!(explicitChat||savedTelegram?.chatId);
const telegramRecord=savedTelegram?.record||null;
// Per-device alert rules live only in the private alert API. Public health must not invent or preserve a stale rule count.
const alerts={
 rules_scope:'private_api',
 rules_configured:null,
 telegram_rule_count:null,
 telegram_bot_configured:!!telegramToken,
 telegram_target_registered:telegramTargetReady,
 telegram_configured:!!(telegramToken&&telegramTargetReady),
 telegram_bot_username:telegramRecord?.bot_username||prev?.alerts?.telegram_bot_username||null,
 email_configured:!!(process.env.RESEND_API_KEY&&process.env.ALERT_EMAIL_TO&&process.env.ALERT_EMAIL_FROM)
};
const outcomes=[[install,'dependency_install'],[source,'source_check'],[tests,'tests'],[collect,'collection'],[publish,'publication'],[build,'build'],[notify,'notification']];
const hasOperationalOutcome=outcomes.some(([outcome])=>outcome!=='skipped');
let status=hasOperationalOutcome?'healthy':(prev.status||'unknown'),error_step=null;
if(hasOperationalOutcome)for(const [outcome,step] of outcomes){if(outcome==='failure'||outcome==='cancelled'){status='degraded';error_step=step;break;}}
const next={...prev,version:1,status,alerts};
const currentSource=process.env.CURRENT_SOURCE||readSnapshotSource();if(currentSource)next.source_updated_at=currentSource;
if(fullScan&&collect==='success'&&build==='success')next.last_successful_scan_at=now;
if(notify==='success')next.last_notification_check_at=now;
if(error_step){next.last_error_at=now;next.last_error_step=error_step;}
if(hasOperationalOutcome&&status==='healthy'&&prev.status==='degraded')next.recovered_at=now;
fs.mkdirSync(path.dirname(file),{recursive:true});
const before=JSON.stringify(prev),after=JSON.stringify(next);if(before!==after)fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
console.log(`health=${status}${error_step?` step=${error_step}`:''} private_alert_rules=managed-by-api`);
