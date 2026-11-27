/* Isolated, explicit-confirmation bridge; no socket or UI integration. */
(function(root){
'use strict';
const common=typeof module!=='undefined'&&module.exports;
const Visit=common?require('./seer-visit.js'):(typeof SeerVisit!=='undefined'?SeerVisit:root.SeerVisit);
const P=common?require('./seer-x01-preview.js'):root.DartArenaSeer501Preview;
// sourceEpoch must be a verified source-side visit/session boundary, NOT a token
// assigned to incoming events at receipt. Actual SEER support is unverified.
class TurnGuard {
  #active=null;
  #seen=new Set();
  #epochs=new Set();
  #mode='manual';
  get mode(){return this.#mode;}
  manual(){this.#active=null;this.#mode='manual';}
  begin(state,{sourceEpoch,boardClearConfirmed}={}){
    this.manual();
    if(!state||state.format!==501||state.status!=='playing'||state.doubleIn||
       ![0,1].includes(state.turn)||!Number.isInteger(state.scores?.[state.turn])||
       state.scores[state.turn]<2||boardClearConfirmed!==true||
       typeof sourceEpoch!=='string'||!sourceEpoch||this.#epochs.has(sourceEpoch))return false;
    this.#epochs.add(sourceEpoch);
    this.#active={state,sourceEpoch,visit:new Visit(),revision:0};
    this.#mode='seer';
    return true;
  }
  #current(state){
    if(!this.#active||this.#mode!=='seer')return false;
    // All existing engine updates return a new state object. Host must invalidate
    // on any manual action, undo, reconnect, navigation or replacement.
    if(state!==this.#active.state){this.manual();return false;}
    return true;
  }
  receive(state,event){
    if(!this.#current(state))return false;
    const a=this.#active;
    if(event?.sourceEpoch!==a.sourceEpoch||typeof event?.throwId!=='string'||
       !event.throwId||this.#seen.has(event.throwId)||!Array.isArray(event.observations)||
       event.observations.some(d=>!d||typeof d!=='object'))return false;
    if(!a.visit.receive(event))return false;
    this.#seen.add(event.throwId);
    a.revision++;
    return true;
  }
  correct(state,number,hit){
    if(!this.#current(state)||!this.#active.visit.correct(number,hit))return false;
    this.#active.revision++;
    return true;
  }
  proposal(state){
    if(!this.#current(state))return {status:'blocked',reason:'inactive-turn'};
    const a=this.#active,p=P.preview(state,a.visit);
    return {...p,sourceEpoch:a.sourceEpoch,revision:a.revision};
  }
  confirm(state,proposal,engine){
    if(!this.#current(state))return null;
    const a=this.#active;
    if(proposal?.sourceEpoch!==a.sourceEpoch||proposal?.revision!==a.revision)return null;
    const p=P.preview(state,a.visit);
    if(p.status!=='ready'||proposal.status!=='ready'||!engine||typeof engine.submit!=='function')return null;
    // Consume before invoking engine. On failure require a fresh explicit arm.
    this.manual();
    return engine.submit(state,p.score,p.options);
  }
}
if(common)module.exports=TurnGuard;
else root.DartArenaSeerTurnGuard=TurnGuard;
})(typeof window!=='undefined'?window:globalThis);
