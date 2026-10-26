/* Cricket board symbols by visit (display only; never changes scoring).
 * A visit adds one stroke for one mark, X for two marks and a circle
 * when it closes a target. Previous visits remain visible alongside the circle.
 */
(function(root){
  'use strict';
  const one='╱', two='×', closed='◯';
  const normalizeTarget=t=>String(t||'').toUpperCase()==='BULL'?'B':String(t||'').toUpperCase();
  function basic(value){
    const n=Math.max(0,Math.min(3,Number(value)||0));
    return n===0?'–':n===1?one:n===2?two:closed;
  }
  function display(visits,player,target,current){
    const expected=Math.max(0,Math.min(3,Number(current)||0));
    if(!expected)return '–';
    let total=0;
    const parts=[];
    for(const visit of Array.isArray(visits)?visits:[]){
      if(String(visit?.player??visit?.player_id)!==String(player))continue;
      let earned=0;
      for(const dart of Array.isArray(visit?.darts)?visit.darts:[]){
        if(normalizeTarget(dart?.target)!==normalizeTarget(target))continue;
        const marks=Math.max(0,Math.min(3,Number(dart?.mult)||0));
        const contribution=Math.min(marks,3-total-earned);
        earned+=Math.max(0,contribution);
      }
      if(!earned)continue;
      total+=earned;
      parts.push(total>=3?closed:earned===2?two:one);
      if(total>=3)break;
    }
    // Never display an incomplete/stale visit history as an authoritative mark.
    // Both online and local games retain their existing numeric state as the truth.
    return total===expected&&parts.length?parts.join(' '):basic(expected);
  }
  const api=Object.freeze({display,basic});
  root.DartArenaCricketMarkHistory=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
