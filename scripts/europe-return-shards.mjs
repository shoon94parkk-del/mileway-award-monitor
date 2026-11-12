// Independent browser workers for the published Europe→ICN return scope.
// Keep route codes explicit and verify coverage against live published origins
// before allowing a merged report to overwrite the website.
export const RETURN_SHARDS=[
 {id:0,codes:['LHR','FCO','LIS']},
 {id:1,codes:['MAD','MXP','BCN']},
 {id:2,codes:['BUD','VIE','AMS']},
 {id:3,codes:['IST','ZRH','CDG']},
 {id:4,codes:['PRG','FRA']}
];
export function assertReturnShards(){
 if(RETURN_SHARDS.length!==5||RETURN_SHARDS.some(s=>!s.codes.length))throw Error('Expected five nonempty return browser workers');
 const flat=RETURN_SHARDS.flatMap(s=>s.codes);
 if(new Set(flat).size!==flat.length||flat.some(x=>!/^[A-Z]{3}$/.test(x)))throw Error('Invalid or duplicate return origin assignment');
 return flat;
}
