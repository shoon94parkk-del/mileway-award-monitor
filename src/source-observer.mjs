import {parseSourceUpdatedAt,sourceTimestampKey} from './source-timestamp.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function frameTexts(frame){
  const texts=[];
  const matched=await frame.getByText(/대한민국\s*시간/i).allTextContents().catch(()=>[]);
  texts.push(...matched);
  const body=await frame.locator('body').innerText().catch(()=>null);
  if(body)texts.push(body);
  const shadow=await frame.evaluate(()=>{
    const found=[];
    const visit=root=>{
      for(const element of root.querySelectorAll('*')){
        if(!element.shadowRoot)continue;
        const text=element.shadowRoot.textContent||'';
        if(/대한민국\s*시간/.test(text))found.push(text);
        visit(element.shadowRoot);
      }
    };
    visit(document);
    return found;
  }).catch(()=>[]);
  texts.push(...shadow);
  return texts;
}

export async function readLatestSourceUpdatedAt(page,{sampleMs=12000,intervalMs=750}={}){
  const deadline=Date.now()+Math.max(0,sampleMs);
  const observed=new Map();
  let best=null,bestKey=-Infinity,samples=0;
  do{
    samples++;
    for(const frame of page.frames()){
      for(const text of await frameTexts(frame)){
        const candidate=parseSourceUpdatedAt(text);
        const key=sourceTimestampKey(candidate);
        if(key===null)continue;
        observed.set(candidate,key);
        if(key>bestKey){best=candidate;bestKey=key;}
      }
    }
    if(Date.now()<deadline)await sleep(intervalMs);
  }while(Date.now()<deadline);
  if(observed.size){
    const ordered=[...observed.entries()].sort((a,b)=>a[1]-b[1]).map(([value])=>value);
    console.log(`PUBLIC SOURCE CANDIDATES: ${ordered.join(' | ')}`);
    console.log(`PUBLIC SOURCE MARKER: ${best} (${samples} samples)`);
  }
  return best;
}
