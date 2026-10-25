/* DartArena bilingual interface: Norwegian (default) and English.
   Translates visible labels only; does not alter scoring, match records or usernames.
   For new UI, use DartArenaI18n.t('Norwegian source string') or data-i18n. */
(()=>{
  'use strict';
  if(window.DartArenaI18n)return;
  const KEY='dartarena-language';
  const translations=Object.freeze({
  "Laster…": "Loading…",
  "Laster DartArena…": "Loading DartArena…",
  "Prøv igjen": "Try again",
  "Logg inn": "Log in",
  "Logg ut": "Log out",
  "Registrer": "Register",
  "Registrer kast": "Record throw",
  "E-post": "Email",
  "Fullt navn": "Full name",
  "Passord": "Password",
  "Glemt passord?": "Forgot password?",
  "Velkommen til DartArena": "Welcome to DartArena",
  "Logg inn for å finne spillere, gå available og utfordre til kamp.": "Log in to find players, set yourself available and challenge others.",
  "Lobby": "Lobby",
  "☰ Meny": "☰ Menu",
  "Hva er nytt": "What's new",
  "Hjelp": "Help",
  "Cam-test": "Camera test",
  "Lukk": "Close",
  "Avbryt": "Cancel",
  "Bekreft": "Confirm",
  "Bekreft tidspunkt": "Confirm time",
  "Oppdater": "Refresh",
  "Til hovedlobby": "Back to main lobby",
  "Hovedlobby": "Main lobby",
  "Tilbake til lobby": "Back to lobby",
  "Tilbake til online-lobby": "Back to online lobby",
  "Tilbake til DartArena": "Back to DartArena",
  "Tilbake til ScoringArena": "Back to ScoringArena",
  "← Til ScoringArena": "← Back to ScoringArena",
  "Til kamphistorikk": "To match history",
  "SPILLSTATUS": "PLAYER STATUS",
  "Unavailable": "Unavailable",
  "Available": "Available",
  "AKTIVT VENTEROM": "ACTIVE WAITING ROOM",
  "Du har et åpent venterom": "You have an open waiting room",
  "Du kan gå tilbake til den samme utfordringen uten å starte en ny.": "You can return to the same challenge without starting a new one.",
  "Tilbake til venterom": "Back to waiting room",
  "AKTIV KAMP": "ACTIVE MATCH",
  "Du er i kamp": "You're in a match",
  "Kampen er fortsatt aktiv. Bruk knappen for å gå tilbake til kamprommet.": "Your match is still active. Use the button to return to the match room.",
  "Gå tilbake til kamp": "Return to match",
  "SPILLERE": "PLAYERS",
  "Spillere": "Players",
  "Spillere og statistikk": "Players and statistics",
  "Pålogget": "Online",
  "Utfordringer": "Challenges",
  "Ingen ventende utfordringer.": "No pending challenges.",
  "Available kan utfordres. Unavailable kan sende utfordringer, men kan ikke motta. Spillere i kamp kan ikke utfordres.": "Available players can be challenged. Unavailable players can send but not receive challenges. Players already in a match cannot be challenged.",
  "SNARVEIER": "SHORTCUTS",
  "Kamphistorikk": "Match history",
  "Form stats": "Form stats",
  "Spill nå": "Play now",
  "Spill": "Play",
  "Spill alene": "Play solo",
  "TRENINGSSPILL": "PRACTICE GAMES",
  "Oppvarming og trening uten motstander.": "Warm up and practice without an opponent.",
  "Checkout-trening. Treff +5, bom −1. Velg 10–60 minutter.": "Checkout practice. Hit +5, miss −1. Choose 10–60 minutes.",
  "Spill 61": "Play 61",
  "12 runder med farger, Eksakt-score og DartCounter-varianten.": "12 rounds with colors, exact scoring and the DartCounter variant.",
  "57 piler i tre faser. Bygg tier, sett personlig rekord og jag Top 10.": "57 darts in three stages. Climb tiers, set a personal best and aim for the Top 10.",
  "Double-trening. Legges inn som neste treningsspill.": "Doubles practice. Coming in a future update.",
  "Kommer": "Coming soon",
  "Start på nytt": "Restart",
  "Ferdig": "Done",
  "KAMERA": "CAMERA",
  "MIKROFON": "MICROPHONE",
  "MIKROFONNIVÅ": "MICROPHONE LEVEL",
  "Laster kameraer…": "Loading cameras…",
  "Laster mikrofoner…": "Loading microphones…",
  "Snakk for å teste mikrofonen": "Speak to test your microphone",
  "Ingen lyd spilles av": "No audio is played",
  "LYD OG BILDE": "AUDIO AND VIDEO",
  "Ikke startet": "Not started",
  "TURNERINGER": "TOURNAMENTS",
  "Turnering": "Tournament",
  "TURNERING": "TOURNAMENT",
  "Turneringslobby": "Tournament lobby",
  "Opprett turnering": "Create tournament",
  "Tidligere turneringer": "Previous tournaments",
  "Arkiverte turneringer": "Archived tournaments",
  "Se alle turneringer": "View all tournaments",
  "Laster turneringer…": "Loading tournaments…",
  "Laster tidligere turneringer…": "Loading previous tournaments…",
  "Åpne en ferdig turnering for å se puljer, kampresultater og cup, eller gå rett til sluttstatistikken.": "Open a completed tournament to view groups, match results and the bracket, or go directly to final statistics.",
  "ARKIV": "ARCHIVE",
  "TURNERINGSARKIV": "TOURNAMENT ARCHIVE",
  "Ferdige turneringer beholder puljer, resultater og kamphistorikk. Arkivering er ikke sletting.": "Completed tournaments keep their groups, results and match history. Archiving does not delete them.",
  "Laster turneringsarkivet…": "Loading tournament archive…",
  "NY TURNERING": "NEW TOURNAMENT",
  "Turneringsnavn": "Tournament name",
  "Type": "Type",
  "Puljespill + cup": "Groups + knockout",
  "Ren cup": "Knockout only",
  "Starttidspunkt": "Start time",
  "VELG START": "CHOOSE START",
  "Velg dato og klokkeslett": "Choose date and time",
  "STARTDATO": "START DATE",
  "STARTTID": "START TIME",
  "Velg dato og tid": "Choose date and time",
  "Egendefinert": "Custom",
  "MAN": "MON",
  "TIR": "TUE",
  "ONS": "WED",
  "TOR": "THU",
  "FRE": "FRI",
  "LØR": "SAT",
  "SØN": "SUN",
  "PULJENE ER KLARE": "GROUPS ARE READY",
  "Turneringen starter!": "Tournament starting!",
  "Turneringsleder har bekreftet puljene. Se hvem du skal møte.": "The tournament organizer has confirmed the groups. See who you're playing.",
  "Du sendes til turneringen om": "Opening tournament in",
  "sekunder.": "seconds.",
  "Gå til turneringen": "Go to tournament",
  "Bli i lobbyen": "Stay in lobby",
  "Påmeldte": "Registered players",
  "DELTAKERE": "PARTICIPANTS",
  "STATUS": "STATUS",
  "Påmelding": "Registration",
  "Meld på": "Join",
  "Avmeld": "Withdraw",
  "Steng påmelding": "Close registration",
  "Avbryt turnering": "Cancel tournament",
  "BYTT TURNERINGSLEDER": "CHANGE TOURNAMENT ORGANIZER",
  "Velg en påmeldt deltaker som ny leder.": "Choose a registered participant as the new organizer.",
  "Ny turneringsleder": "New organizer",
  "Velg påmeldt deltaker": "Select registered player",
  "Overfør lederrollen": "Transfer organizer role",
  "PULJESPILL": "GROUP STAGE",
  "Puljespill": "Group stage",
  "Sett opp puljene": "Set up groups",
  "Ikke trukket": "Not drawn",
  "Velg oppsett. Trekningen stokker spillerlisten tre ganger og fordeler spillerne én og én mellom puljene.": "Choose the format. The draw shuffles the players three times and distributes them across groups.",
  "Velg AI Rival til puljespill": "Add AI Rival to group stage",
  "Henter spillere…": "Fetching players…",
  "AI Rival i turneringspuljer:": "AI Rival in groups:",
  "Spiller AI skal etterligne": "Player to simulate",
  "Velg spiller…": "Choose player…",
  "Lagre AI Rival": "Save AI Rival",
  "Fjern AI Rival": "Remove AI Rival",
  "Antall puljer": "Number of groups",
  "Videre til cup": "Advance to knockout",
  "Kampformat i puljene": "Group match format",
  "Trekk puljer": "Draw groups",
  "Trekk på nytt": "Redraw groups",
  "Start puljespill": "Start group stage",
  "FORHÅNDSVISNING": "PREVIEW",
  "Puljene vises her etter trekning.": "Groups appear here after the draw.",
  "Trykk på en kamp for kamprom, tilskuervisning eller statistikk. Rangering: kampseire → leg-differanse → vunne legs → innbyrdes.": "Select a match to open the match room, spectator view or statistics. Ranking: match wins → leg difference → legs won → head-to-head.",
  "SLUTTSPILL": "KNOCKOUT STAGE",
  "Opprett cup": "Create bracket",
  "Opprett cupoppsett": "Create knockout bracket",
  "Cup": "Knockout",
  "Trykk på en kamp for å åpne den. Ferdige kamper åpner kampstatistikken. På mobil kan bracketen sveipes sidelengs.": "Select a match to open it. Completed matches open match statistics. On mobile, swipe horizontally to view the bracket.",
  "LIVE MATCH": "LIVE MATCH",
  "Kamprom": "Match room",
  "Åpne lobby i ny fane": "Open lobby in new tab",
  "Avbryt kamp": "Cancel match",
  "Lukk kampfane": "Close match tab",
  "Ditt kamera": "Your camera",
  "Deg": "You",
  "Mikrofon på": "Microphone on",
  "Venter på motstanderens kamera…": "Waiting for opponent's camera…",
  "Motstander": "Opponent",
  "Slå på lyd": "Enable sound",
  "Spiller 1": "Player 1",
  "Spiller 2": "Player 2",
  "Venter…": "Waiting…",
  "KAMPSTATUS": "MATCH STATUS",
  "Pågår": "In progress",
  "Start kamera": "Start camera",
  "KAMP FERDIG": "MATCH FINISHED",
  "FERDIG KAMP": "COMPLETED MATCH",
  "vant!": "won!",
  "er ferdig": "has finished",
  "VINNER": "WINNER",
  "RASK ESTE LEG": "FASTEST LEG",
  "3-DART AVG": "3-DART AVG",
  "FIRST 9 AVG": "FIRST 9 AVG",
  "HØYESTE UT": "HIGHEST CHECKOUT",
  "RASKESTE LEG": "FASTEST LEG",
  "Høyeste checkout": "Highest checkout",
  "Høyeste utgang": "Highest checkout",
  "Høyeste kampsnitt": "Highest match average",
  "Flest 180": "Most 180s",
  "Alle leg": "All legs",
  "Leg-oversikt": "Leg overview",
  "LEG-OVERSIKT": "LEG OVERVIEW",
  "Kampstatistikk": "Match statistics",
  "Full kampstatistikk": "Full match statistics",
  "Skjermbilde": "Screenshot",
  "Laster kampstatistikk…": "Loading match statistics…",
  "Kameraestimater, ikke poengfasit. Krever aktivt kalibrert kamera.": "Camera estimates, not definitive scoring. Requires an active calibrated camera.",
  "Ingen registrerte treff – kontroller ZoomCam-kalibrering.": "No recorded hits – check ZoomCam calibration.",
  "Ingen heatmap-data mottatt fra motstander.": "No heatmap data received from opponent.",
  "Kameraestimater, ikke poengfasit. Heatmap-data er foreløpig tilgjengelig bare fra den aktive kampøkten.": "Camera estimates, not definitive scoring. Heatmap data is currently available only from the active match session.",
  "Ingen heatmap-data tilgjengelig fra denne økten.": "No heatmap data available from this session.",
  "Resultater": "Results",
  "TURNERING FERDIG": "TOURNAMENT FINISHED",
  "Til turneringen": "Back to tournament",
  "TURNERINGSVINNER": "TOURNAMENT WINNER",
  "Laster sluttresultat…": "Loading final results…",
  "SPILLERSTATISTIKK": "PLAYER STATISTICS",
  "Hele turneringen": "Full tournament",
  "TOPP 3": "TOP 3",
  "Raskeste leg": "Fastest leg",
  "DartArena • turneringsresultater": "DartArena • tournament results",
  "Nyeste først": "Newest first",
  "Laster kamper…": "Loading matches…",
  "Vis alle kamper": "Show all matches",
  "ALLE ONLINEKAMPER": "ALL ONLINE MATCHES",
  "Ferdige kamper mellom DartArena-spillere – X01, Cricket, begge Half-It-variantene, 61 og JDC Challenge.": "Completed matches between DartArena players – X01, Cricket, both Half-It variants, 61 and JDC Challenge.",
  "Vis oppvarmingskamper": "Show warm-up matches",
  "Vis bare mine kamper": "Show only my matches",
  "LOKAL SCORING": "LOCAL SCORING",
  "Spill mot venner på samme enhet, eller utfordre en bot. Her ligger de lokale spillene – adskilt fra DartArenas online-lobby.": "Play with friends on the same device or challenge a bot. These local games are separate from DartArena's online lobby.",
  "TEST EFFEKTER": "TEST EFFECTS",
  "SCORINGARENA • LOKALE SPILL": "SCORINGARENA • LOCAL GAMES",
  "1v1 på samme skjerm": "1v1 on the same screen",
  "Velg spilltype, før score lokalt og bruk de eksisterende statistikkvisningene. X01 støtter også bot som motstander.": "Choose a game, enter scores locally and use existing statistics views. X01 also supports bot opponents.",
  "AI Rival (beta) – spill mot en digital spillerprofil": "AI Rival (beta) – play against a digital player profile",
  "501 mot en simulering av din egen eller en annen spillerprofil, basert på registrerte kasterunder. Ingen påvirkning på ranking.": "501 against a simulation of your own or another player's profile, based on recorded visits. Does not affect rankings.",
  "Test AI Rival": "Test AI Rival",
  "X01 – 1v1 mot spiller eller bot": "X01 – 1v1 against a player or bot",
  "170 / 301 / 501 / 1001 · velg motstander i kampoppsettet. Dobbel-ut, legs, sets og full statistikk.": "170 / 301 / 501 / 1001 · select an opponent in match setup. Double out, legs, sets and full statistics.",
  "Spill 1v1": "Play 1v1",
  "Mot spiller": "Against player",
  "Mot bot": "Against bot",
  "LOKALE KAMPER • X01": "LOCAL MATCHES • X01",
  "Ferdige lokale Head-to-Head-kamper. Samme resultat- og statistikkvisning som online, men lagret kun på denne enheten.": "Completed local head-to-head matches. The same results and stats views as online, but saved only on this device.",
  "Lokale kamper lagres i nettleseren. De påvirker ikke online ranking eller turneringsresultater.": "Local matches are saved in your browser. They do not affect online rankings or tournament results.",
  "Treff/bom, mål og klokke.": "Hits/misses, targets and timer.",
  "33 mål: Shanghai og doubles.": "33 targets: Shanghai and doubles.",
  "12 runder etter standardreglene.": "12 rounds under standard rules.",
  "12 runder med farger og eksakt score.": "12 rounds with colors and exact scoring.",
  "AI RIVAL · TESTVERSJON": "AI RIVAL · TEST VERSION",
  "SCORINGARENA / TRENING": "SCORINGARENA / PRACTICE",
  "KAMPINNSTILLINGER": "MATCH SETTINGS",
  "Velg din AI-motstander": "Choose your AI opponent",
  "DartArena-spiller": "DartArena player",
  "Laster profiler…": "Loading profiles…",
  "Spillmodus": "Game mode",
  "Best av": "Best of",
  "Start AI-kamp →": "Start AI match →",
  "Owner: Prøv AI-spiss og poengforslag i AI Rival": "Owner: Test AI tip and score suggestions in AI Rival",
  "AI-modell lastes inn i kamprommet. Rett poengforslag før du registrerer rundescore. Bildene lagres lokalt.": "The AI model loads in the match room. Correct score suggestions before recording a visit. Images are stored locally.",
  "Se og korriger lagrede treningsbilder →": "View and correct saved training images →",
  "Owner: Test ny AI-spissmodell med kamera →": "Owner: Test new AI tip model with camera →",
  "Spill som AI Rival støtter:": "Games supported by AI Rival:",
  "Laster spillerstatistikk…": "Loading player statistics…",
  "SPILLER": "PLAYER",
  "AI-MOTSTANDER": "AI OPPONENT",
  "SCORING": "SCORING",
  "Score": "Score",
  "Piler ved utsjekk": "Darts on checkout",
  "Angre": "Undo",
  "Registrer summen for opptil tre piler. Bust registreres som 0. Utsjekk krever gyldig dobbel-ut.": "Record the total for up to three darts. A bust is recorded as 0. Checkout requires a valid double out.",
  "KAMPHISTORIKK": "MATCH HISTORY",
  "Kamplogg": "Match log",
  "DartArena • Kamp": "DartArena • Match",
  "DartArena • Turnering": "DartArena • Tournament",
  "DartArena • Resultater": "DartArena • Results",
  "DartArena • Kampstatistikk": "DartArena • Match statistics",
  "DartArena • Kamphistorikk": "DartArena • Match history",
  "Arkiverte turneringer · DartArena": "Archived tournaments · DartArena"
});
  let lang='no';
  try{lang=localStorage.getItem(KEY)==='en'?'en':'no'}catch{}
  const originals=new WeakMap();
  const originalAttrs=new WeakMap();
  const ignored='script,style,svg,canvas,code,pre,textarea,[contenteditable],[data-no-i18n],.brand,.brand-logo,.chat-message,.chat-bubble,.chat-msg,.da-chat-message';
  const dynamic=[
    [/^(\d+) registrerte? treff$/i,(m)=>m[1]+' recorded hits'],
    [/^(\d+) spissforslag \(beta\)$/i,(m)=>m[1]+' tip suggestions (beta)'],
    [/^Leg (\d+)$/,m=>'Leg '+m[1]],
    [/^(\d+) ser på$/,m=>m[1]+' watching'],
    [/^(\d+) påmeldte$/,m=>m[1]+' registered'],
    [/^([^\n]+) vant!$/,m=>m[1]+' won!']
  ];
  const reverse=Object.freeze(Object.fromEntries(
    Object.entries(translations).map(([no,en])=>[en,no])
  ));
  function translatePhrase(value,to=lang){
    if(to==='no')return value;
    if(Object.prototype.hasOwnProperty.call(translations,value))return translations[value];
    for(const [pattern,formatter] of dynamic){
      const m=value.match(pattern);if(m)return formatter(m);
    }
    return value;
  }
  function preserveSpace(value,transform){
    const m=String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m?m[1]+transform(m[2])+m[3]:value;
  }
  function skip(el){
    return !el||!!el.closest?.(ignored);
  }
  function applyText(node){
    if(!node||!node.parentElement||skip(node.parentElement))return;
    const value=node.nodeValue;
    if(!value||!value.trim())return;
    const prior=originals.get(node);
    const source=prior&&prior.rendered===value?prior.source:value;
    const next=preserveSpace(source,x=>translatePhrase(x));
    originals.set(node,{source,rendered:next});
    if(next!==value)node.nodeValue=next;
  }
  const ATTRS=['placeholder','title','aria-label'];
  function applyAttrs(el){
    if(!el||el.nodeType!==1||skip(el))return;
    let saved=originalAttrs.get(el);
    if(!saved){saved={};originalAttrs.set(el,saved)}
    for(const name of ATTRS){
      if(!el.hasAttribute(name))continue;
      const current=el.getAttribute(name);
      const prev=saved[name];
      const source=prev&&prev.rendered===current?prev.source:current;
      const translated=preserveSpace(source,x=>translatePhrase(x));
      saved[name]={source,rendered:translated};
      if(translated!==current)el.setAttribute(name,translated);
    }
  }
  function traverse(root){
    if(!root)return;
    if(root.nodeType===3){applyText(root);return}
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
    if(root.nodeType===1&&skip(root))return;
    if(root.nodeType===1)applyAttrs(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const n=walker.currentNode;
      if(n.nodeType===3)applyText(n);
      else if(n.nodeType===1)applyAttrs(n);
    }
  }
  let selector=null;
  function updateButtons(){
    if(!selector)return;
    selector.querySelectorAll('button[data-language]').forEach(button=>{
      const selected=button.dataset.language===lang;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function setLanguage(next){
    lang=next==='en'?'en':'no';
    try{localStorage.setItem(KEY,lang)}catch{}
    document.documentElement.lang=lang==='en'?'en':'nb';
    const title=document.title;
    document.title=translatePhrase(reverse[title]||title);
    traverse(document.body);
    updateButtons();
    document.dispatchEvent(new CustomEvent('dartarena:languagechange',{detail:{lang}}));
  }
  function mountSelector(){
    if(selector)return;
    const header=document.querySelector('body > header');
    if(!header)return;
    selector=document.createElement('div');
    selector.className='da-language-switch';
    selector.setAttribute('role','group');
    selector.setAttribute('aria-label','Language / Språk');
    selector.setAttribute('data-no-i18n','');
    for(const [code,flag,name] of [['no','🇳🇴','Norsk'],['en','🇬🇧','English']]){
      const button=document.createElement('button');
      button.type='button';button.className='da-language-button';
      button.dataset.language=code;
      button.textContent=flag;
      button.setAttribute('lang',code==='no'?'nb':'en');
      button.setAttribute('title',name);
      button.setAttribute('aria-label',name);
      button.addEventListener('click',()=>setLanguage(code));
      selector.appendChild(button);
    }
    header.appendChild(selector);
    updateButtons();
  }
  const sheet=document.createElement('style');
  sheet.setAttribute('data-dartarena-i18n','');
  sheet.textContent=[
    'header .da-language-switch{display:inline-flex;align-items:center;gap:3px;margin-left:10px;padding:3px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.20);flex-shrink:0;order:20}',
    'header .da-language-switch .da-language-button{appearance:none;display:grid;place-items:center;min-width:31px;min-height:29px;height:29px;padding:2px 4px;border:1px solid transparent!important;border-radius:6px;background:transparent!important;box-shadow:none!important;font-size:18px;line-height:1;cursor:pointer;opacity:.65;transition:opacity .15s,border-color .15s,background .15s}',
    'header .da-language-switch .da-language-button.active{opacity:1;border-color:#00eaf4!important;background:rgba(0,234,244,.12)!important}',
    'header .da-language-switch .da-language-button:hover{opacity:1}',
    'header .da-language-switch .da-language-button:focus-visible{outline:2px solid #00eaf4;outline-offset:2px}',
    '@media(max-width:650px){header .da-language-switch{gap:1px;margin-left:4px;padding:2px}header .da-language-switch .da-language-button{min-width:25px;min-height:26px;height:26px;padding:1px 2px;font-size:16px}}'
  ].join('\n');
  document.head.appendChild(sheet);
  const pending=new Set();
  let scheduled=false;
  function flush(){
    scheduled=false;
    for(const root of pending)traverse(root);
    pending.clear();
  }
  function schedule(root){
    if(!root)return;
    pending.add(root);
    if(!scheduled){scheduled=true;requestAnimationFrame(flush)}
  }
  function boot(){
    mountSelector();
    document.documentElement.lang=lang==='en'?'en':'nb';
    document.title=translatePhrase(document.title);
    traverse(document.body);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')schedule(record.target);
        else if(record.type==='attributes')schedule(record.target);
        else for(const node of record.addedNodes)if(node.nodeType===1||node.nodeType===3)schedule(node);
      }
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    window.DartArenaI18n.observer=observer;
  }
  window.DartArenaI18n={
    t:(key)=>translatePhrase(String(key)),
    getLanguage:()=>lang,
    setLanguage,
    translate:traverse,
    dictionary:translations
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();