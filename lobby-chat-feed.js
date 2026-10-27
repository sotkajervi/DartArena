/* Read-only presentation helpers for DartArena's message feed.
 * Roles always come from get_public_user_roles(), never message payloads. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DartArenaChatFeed=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const GROUP_MS=3*60*1000;
  function roleOf(id,roles){
    const value=roles?.get?.(id);
    return value==='owner'?'owner':value==='admin'?'admin':'user';
  }
  function sortRows(rows){
    return [...rows].sort((a,b)=>{
      const time=Date.parse(a.created_at)-Date.parse(b.created_at);
      return time || String(a.id||'').localeCompare(String(b.id||''));
    });
  }
  function dayKey(time){
    const d=new Date(time);
    if(Number.isNaN(d.getTime()))return '';
    // Browser-local day labels, not forced UTC dates.
    return [d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');
  }
  function decorate(rows,roles){
    let last=null;
    return sortRows(rows).map(row=>{
      const currentDay=dayKey(row.created_at);
      const dateChanged=!last||dayKey(last.created_at)!==currentDay;
      const ms=Date.parse(row.created_at)-Date.parse(last?.created_at);
      const grouped=!!last&&!dateChanged&&
        row.sender_id===last.sender_id&&ms>=0&&ms<=GROUP_MS;
      last=row;
      return {row,role:roleOf(row.sender_id,roles),grouped,dateChanged};
    });
  }
  return Object.freeze({roleOf,sortRows,dayKey,decorate});
});
