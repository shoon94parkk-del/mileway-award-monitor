import {PUBLIC_API} from './public-calendar.mjs';

const observedPages=new WeakMap();
const target=new URL(PUBLIC_API);

// Observe HTTP status metadata only. Award availability is still read solely
// from the rendered UI. Once access is denied, this page must not retry.
export function watchPublicAccess(page){
 if(observedPages.has(page))return observedPages.get(page);
 let blocked=null;
 page.on('response',response=>{
  const status=response.status();
  if(blocked||![403,429].includes(status))return;
  const url=new URL(response.url());
  if(url.origin!==target.origin||url.pathname!==target.pathname)return;
  blocked=Object.assign(Error('ACCESS_LIMIT HTTP '+status+': Korean Air public award query refused; stop collection'),
   {code:'ACCESS_LIMIT',httpStatus:status});
 });
 const access={throwIfBlocked(){if(blocked)throw blocked;}};
 observedPages.set(page,access);
 return access;
}
