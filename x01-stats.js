(()=>{
  if(window.DartArenaX01Stats)return;

  const dartsFor=visit=>Number(visit?.is_checkout?visit?.darts_used:3)||3;
  const legKey=visit=>`${Number(visit?.set_no||1)}:${Number(visit?.leg_no||1)}`;

  function statsFor(all,pid){
    const visits=(all||[]).filter(v=>v.player_id===pid);
    const totalScore=visits.reduce((sum,v)=>sum+Number(v.score||0),0);
    const totalDarts=visits.reduce((sum,v)=>sum+dartsFor(v),0);
    const checkouts=visits.filter(v=>v.is_checkout);

    let fastestLeg=null;
    let highestCheckout=0;
    for(const checkout of checkouts){
      highestCheckout=Math.max(highestCheckout,Number(checkout.score||0));
      const key=legKey(checkout);
      const legVisits=visits.filter(v=>legKey(v)===key);
      const used=legVisits.reduce((sum,v)=>sum+dartsFor(v),0);
      if(used>0&&(fastestLeg===null||used<fastestLeg))fastestLeg=used;
    }

    let first9Score=0;
    let first9Darts=0;
    const perLeg=new Map();
    for(const visit of visits){
      const key=legKey(visit);
      const count=perLeg.get(key)||0;
      if(count>=3)continue;
      perLeg.set(key,count+1);
      first9Score+=Number(visit.score||0);
      first9Darts+=dartsFor(visit);
    }

    return{
      avg:totalDarts?totalScore/totalDarts*3:0,
      first9:first9Darts?first9Score/first9Darts*3:0,
      first9Darts,
      fast:fastestLeg,
      high:highestCheckout,
      c100:visits.filter(v=>Number(v.score)>=100&&Number(v.score)<=139).length,
      c140:visits.filter(v=>Number(v.score)>=140&&Number(v.score)<=169).length,
      c170:visits.filter(v=>Number(v.score)>=170&&Number(v.score)<=179).length,
      c180:visits.filter(v=>Number(v.score)===180).length
    };
  }

  window.DartArenaX01Stats={statsFor,dartsFor};
})();
