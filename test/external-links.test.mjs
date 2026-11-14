import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLinkMetadata,parsePublicRss,parsePublicListing,selectExternalLinks,CATEGORIES} from '../scripts/refresh-external-links.mjs';

const category='https://milengo.kr/마일리지-잔여좌석/';
const title='대한항공 보너스 좌석(Europe) : 2026-11-14 기준';
const href=category+'대한항공-보너스-좌석-europe-2026-11-14-기준-30075';
test('RSS and listing discover only published title, date and link, not seat inventory',()=>{
 const rss='<rss><channel><item><title><![CDATA['+title+']]></title><link>'+href+'</link><description>PRIVATE SEAT DETAILS NOT TO IMPORT</description></item></channel></rss>';
 const entries=parsePublicRss(rss);
 assert.equal(entries.length,1);
 assert.equal(entries[0].region,'Europe');
 assert.equal(entries[0].date,'2026-11-14');
 assert.equal(entries[0].url,new URL(href).toString());
 assert.ok(!JSON.stringify(entries).includes('PRIVATE'));
 const html='<div><a href="'+href+'"><span>'+title+'</span> M zoommytrip 2시간전</a></div>';
 assert.equal(parsePublicListing(html)[0].region,'Europe');
});
test('non-provider links, unrelated article titles and invalid data dates are rejected',()=>{
 assert.equal(extractLinkMetadata(title,'https://attacker.example/'),null);
 assert.equal(extractLinkMetadata('대한항공 특가 항공권(Europe) : 2026-11-14 기준',href),null);
 assert.equal(extractLinkMetadata('대한항공 보너스 좌석(Europe) : 2026-12-99 기준',href),null);
});
test('stale posts never replace newer links, and five regions have stable priority',()=>{
 const old={...extractLinkMetadata(title,href),date:'2026-11-14'};
 const stale=extractLinkMetadata('대한항공 보너스 좌석(Europe) : 2026-11-13 기준',href);
 const selected=selectExternalLinks([stale],[old]);
 assert.equal(selected.length,1);
 assert.equal(selected[0].date,'2026-11-14');
 assert.deepEqual(CATEGORIES,['Europe','North America','Oceania','Asia','Japan']);
});
