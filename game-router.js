(()=>{
  const RAW={
    cricket:{variant:'cricket',label:'Cricket',page:'cricket.html'},
    chicago:{variant:'chicago',label:'Chicago Style',page:'match.html'},
    half_it:{variant:'half_it',label:'Half-It (DartCounter)',page:'half-it.html',halfItMode:'dartcounter'},
    half_it_standard:{variant:'half_it',label:'Half-It (Standard)',page:'half-it.html',halfItMode:'standard'},
    sixty_one:{variant:'sixty_one',label:'61',page:'61-match.html'},
    jdc:{variant:'jdc',label:'JDC Challenge',page:'jdc-match.html'}
  };
  const VARIANT_PAGES={x01:'match.html',cricket:'cricket.html',chicago:'match.html',half_it:'half-it.html',sixty_one:'61-match.html',jdc:'jdc-match.html'};
  const normalizeRaw=value=>String(value??'').trim();
  const isX01=value=>/^\d+$/.test(normalizeRaw(value));
  const variantFor=value=>RAW[normalizeRaw(value)]?.variant||(isX01(value)?'x01':'x01');
  const pageForVariant=variant=>VARIANT_PAGES[variant]||VARIANT_PAGES.x01;
  const labelForRaw=value=>RAW[normalizeRaw(value)]?.label||normalizeRaw(value)||'X01';
  const halfItModeFor=value=>RAW[normalizeRaw(value)]?.halfItMode||null;
  const isSpecial=value=>variantFor(value)!=='x01';
  const labelForMatch=match=>{
    if(!match)return'Kamp';
    if(String(match.game_config?.chicago??'false').toLowerCase()==='true')return'Chicago Style';
    if(match.game_variant==='half_it')return match.game_config?.half_it_mode==='standard'?'Half-It (Standard)':'Half-It (DartCounter)';
    if(match.game_variant==='cricket')return'Cricket';
    if(match.game_variant==='sixty_one')return'61';
    if(match.game_variant==='jdc')return'JDC Challenge';
    return String(match.game||'X01');
  };
  window.DartArenaGames=Object.freeze({RAW,VARIANT_PAGES,variantFor,pageForVariant,labelForRaw,halfItModeFor,isSpecial,labelForMatch});
})();