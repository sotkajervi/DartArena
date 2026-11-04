/* Development-only single-document match layout host.
 * Reuses actual camera <video> elements. Scoring engine boot is separate.
 */
(()=>{
 'use strict';
 if(window.DartArenaCricketSceneHost)return;
 let stage=null,videoAnchor=null,active=false,lobbyButton=null,lobbyAnchor=null,waitingMain=null,matchHeader=null,oldHeaderMarkup=null,oldDocumentTitle=null;
 const MATCH_STYLES=[
  'match-controls.css?v=20260928-ui2',
  'cricket-desktop.css?v=20260928-ui2',
  'button-theme.css?v=20261009-brandcyan1',
  'opponent-focus.css?v=20261026-owncam-pip1',
  'match-mobile-scroll.css?v=20261002-mobile1',
  'match-own-turn.css?v=20261027-i18naudit1',
  'score-meta.css?v=20261004-legdarts1',
  'fx-live.css?v=20261023-sweep2',
  'online-heatmap-result.css?v=20261023-heatmap4',
  'shared-results.css?v=20261104-cricket-clean-result-labels1',
  'stable-video-labels.css?v=20260930-label1'
 ];
 function loadMatchStyles(){
  for(const href of MATCH_STYLES){
   if([...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.getAttribute('href')===href))continue;
   const link=document.createElement('link');
   link.rel='stylesheet';link.href=href;
   document.head.appendChild(link);
  }
 }
 async function prepare(){
  if(stage)return stage;
  const main=document.getElementById('matchView');
  waitingMain=main;
  const video=document.getElementById('videoGrid');
  if(!main||!video)throw Error('Tournament room layout unavailable');
  // Match controls and media CSS rely on these exact card IDs.
  const cards=video.querySelectorAll('.video-card');
  if(cards.length!==2)throw Error('Expected two existing camera cards');
  cards[0].id='localVideoCard';
  cards[0].classList.add('local-card');
  cards[1].id='remoteVideoCard';
  cards[1].classList.add('remote-card');
  if(!document.getElementById('micBtn')){
    const mic=document.createElement('button');
    mic.id='micBtn';mic.type='button';mic.className='outline';
    mic.textContent='Mikrofon på';
    cards[0].appendChild(mic);
  }
  videoAnchor=document.createComment('Original tournament video position');
  video.before(videoAnchor);
  stage=document.createElement('section');
  stage.id='daMatchStage';
  stage.hidden=true;
  // The original cricket.html is the single source of truth for match layout.
  // Do not duplicate the scoreboard / controls in this module.
  const response=await fetch(new URL('cricket.html',location.href),{cache:'no-store'});
  if(!response.ok)throw Error('Originalt kamprom kunne ikke lastes ('+response.status+')');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const original=doc.querySelector('#matchView');
  matchHeader=doc.querySelector('body > header')?.innerHTML||null;
  if(matchHeader){
    const template=doc.createElement('template');
    template.innerHTML=matchHeader;
    const meta=template.content.querySelector('.header-meta');
    if(meta){
      const status=meta.querySelector('#headerStatus');
      if(status)status.innerHTML='<i></i> LIVE KAMP';
      meta.classList.add('da-live-match-header-center');
      matchHeader=template.innerHTML;
    }
  }
  if(!original)throw Error('Originalt kampoppsett mangler i cricket.html');
  for(const source of doc.querySelectorAll('head style')){const node=document.createElement('style');node.textContent=source.textContent;node.dataset.cricketSeamless='1';document.head.appendChild(node);}
  const originalGrid=original.querySelector('#videoGrid');
  if(!originalGrid)throw Error('Originalt kampoppsett mangler videorutenettet');
  const slot=doc.createElement('div');
  slot.id='daMatchVideoSlot';
  originalGrid.replaceWith(slot);
  // stage itself owns its ID; only adopt the original match-room children.
  stage.append(...Array.from(original.childNodes).map(node=>document.importNode(node,true)));
  // The real lobby button already has handlers from the tournament page.
  // Avoid duplicate IDs: reuse that button instead of cloning its cricket.html twin.
  lobbyButton=document.getElementById('openLobbyTabBtn');
  const matchLobby=stage.querySelector('#openLobbyTabBtn');
  if(lobbyButton&&matchLobby){
    lobbyAnchor=document.createComment('Tournament lobby button anchor');
    lobbyButton.before(lobbyAnchor);
    matchLobby.replaceWith(lobbyButton);
    lobbyButton.classList.remove('hidden');
  }
  main.appendChild(stage);
  // Preload the original match CSS before exposing the live match scene.
  loadMatchStyles();
  if(!document.getElementById('da-live-match-header-style')){
    const style=document.createElement('style');
    style.id='da-live-match-header-style';
    style.textContent=`@media(min-width:701px){
      body.match-page>header{position:sticky}
      body.match-page>header .da-live-match-header-center{
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        display:flex;flex-direction:row;align-items:center;justify-content:center;gap:12px;
        width:max-content;max-width:55%;white-space:nowrap
      }
      body.match-page>header .da-live-match-header-center #headerStatus{order:0;white-space:nowrap}
      body.match-page>header .da-live-match-header-center #viewerCount{order:1;white-space:nowrap}
      body.match-page>header .da-live-match-header-center #headerStatus,
      body.match-page>header .da-live-match-header-center #viewerCount{
        display:inline-flex;align-items:center;justify-content:center;
        align-self:center;line-height:1;vertical-align:middle;margin:0;
        height:28px;box-sizing:border-box
      }
      body.match-page>header .da-live-match-header-center #headerStatus i,
      body.match-page>header .da-live-match-header-center #viewerCount .viewer-dot{align-self:center}
    }
    @media(max-width:700px){
      body.match-page>header .da-live-match-header-center{
        flex-direction:row;gap:7px;justify-content:center;align-items:center
      }
      body.match-page>header .da-live-match-header-center #headerStatus{order:0}
      body.match-page>header .da-live-match-header-center #viewerCount{order:1}
    }`;
    document.head.appendChild(style);
  }
  if(!document.getElementById('da-cricket-seamless-layout')){
    const style=document.createElement('style');
    style.id='da-cricket-seamless-layout';
    style.textContent=`
    /* Cricket differs from X01: its marks and keyboard help need the left panel. */
    @media(min-width:801px){
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) #matchView{
        grid-template-columns:clamp(335px,27vw,390px) minmax(0,1fr);
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .match-grid{
        overflow-x:hidden!important;
        overflow-y:auto;
        min-width:0;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .score-card{min-width:0!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-play-grid{
        display:grid!important;
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-areas:"summary" "board" "entry"!important;
        width:100%;
        min-width:0!important;
        gap:6px!important;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-entry-card{
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-areas:"title" "turn" "darts" "actions" "help"!important;
        gap:5px!important;
        padding:7px 8px!important;
        min-width:0;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-entry-actions{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:4px!important;
        width:100%;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-entry-actions button{
        padding:6px 3px!important;
        white-space:normal!important;
        overflow-wrap:anywhere;
        font-size:11px;
        min-width:0;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-help{
        display:block!important;
        white-space:normal!important;
        overflow-wrap:break-word;
        font-size:10px!important;
        line-height:1.35!important;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-help kbd{
        min-width:17px;padding:1px 3px;margin:0 1px;
      }
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-row{min-height:28px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-summary{gap:5px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-player{padding:5px 7px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-history{margin-top:5px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-history-head{padding:5px 7px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .cricket-history-list{max-height:65px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .match-info{margin-top:5px!important;padding:6px!important;}
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .shell,
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) #matchView,
      body.da-cricket-seamless.match-tv-layout:not(.cricket-tv-layout) .score-card{max-width:100%;}
    }
    `;
    document.head.appendChild(style);
  }
  return stage;
 }
 async function enter(){
  if(active)return;
  await prepare();
  // Preserve the live video elements, but use cricket.html's exact hierarchy:
  // main.shell > section#matchView > #videoGrid + .match-grid.
  const video=document.getElementById('videoGrid');
  const waiting=waitingMain;
  waiting.id='daTournamentWaitingView';
  stage.id='matchView';
  stage.querySelector('#daMatchVideoSlot').replaceWith(video);
  video.classList.remove('waiting-video-grid');
  // The global .match-head/.camera-controls display rules can override the
  // browser's [hidden] rule. Explicit display:none prevents waiting-room UI
  // from leaking above the original match screen.
  for(const node of [...waiting.children])if(node!==stage){node.hidden=true;node.style.setProperty('display','none','important');}
  const header=document.querySelector('body > header');
  if(header&&matchHeader){
    oldHeaderMarkup=header.innerHTML;
    header.innerHTML=matchHeader;
  }
  stage.hidden=false;
  // Match TV geometry must be in place on the very first visible frame.
  // The opponent-focus module will subsequently apply turn-specific classes.
  document.body.classList.add('match-page','match-tv-layout','standard-tv-layout','da-cricket-seamless');
  document.body.classList.remove('da-prematch-active');
  if(oldDocumentTitle===null)oldDocumentTitle=document.title;
  document.title='DartArena • Cricket livekamp';
  active=true;
 }
 function restore(){
  if(!stage||!active)return;
  const video=document.getElementById('videoGrid');
  videoAnchor.after(video);
  if(lobbyButton&&lobbyAnchor)lobbyAnchor.after(lobbyButton);
  video.classList.add('waiting-video-grid');
  for(const node of [...waitingMain.children])if(node!==stage){node.hidden=false;node.style.removeProperty('display');}
  stage.id='daMatchStage';
  waitingMain.id='matchView';
  stage.hidden=true;
  if(oldHeaderMarkup!==null){
    const header=document.querySelector('body > header');
    if(header)header.innerHTML=oldHeaderMarkup;
  }
  document.body.classList.remove('match-page','match-tv-layout','standard-tv-layout','opponent-focus','da-cricket-seamless');
  if(oldDocumentTitle!==null){document.title=oldDocumentTitle;oldDocumentTitle=null;}
  active=false;
 }
 window.DartArenaCricketSceneHost={prepare,enter,restore,isActive:()=>active};
})();