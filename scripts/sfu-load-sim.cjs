#!/usr/bin/env node
'use strict';
// Offline SFU lifecycle/load *simulation*. No real Cloudflare sessions or video packets.
// Useful as a repeatable baseline before authenticated browser testing.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

function simulate({rooms=6, playersPerRoom=2, rounds=100, seed=20261102, failurePercent=3}={}) {
  for(const [name,value] of Object.entries({rooms,playersPerRoom,rounds,seed,failurePercent}))
    if(!Number.isInteger(value)||value<0) throw new Error('Invalid '+name);
  if(!rooms||!playersPerRoom||!rounds||failurePercent>100||rooms>100||playersPerRoom>20||rounds>100000)
    throw new Error('Parameters outside safe simulation range');
  let state=seed>>>0;
  const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
  const sessions=new Map();
  const metrics={scenario:'offline-simulation',rooms,playersPerRoom,clients:rooms*playersPerRoom,rounds,
    attempts:0,connects:0,failures:0,recoveries:0,terminated:0,orphanSessions:0,
    perRoom:[],elapsedMs:0};
  const begin=performance.now();
  for(let room=0;room<rooms;room++){
    const stats={room:room+1,clients:playersPerRoom,attempts:0,failures:0,recoveries:0};
    for(let player=0;player<playersPerRoom;player++){
      const id=room+':'+player;
      sessions.set(id,{connected:false});
      for(let round=0;round<rounds;round++){
        metrics.attempts++;stats.attempts++;
        const session=sessions.get(id);
        if(random()*100<failurePercent){
          metrics.failures++;stats.failures++;
          session.connected=false;
          // Retry once to model recovery, not actual browser/network behavior.
          if(random()*100>=failurePercent){
            session.connected=true;metrics.recoveries++;stats.recoveries++;
          }
        }else{session.connected=true;metrics.connects++;}
      }
    }
    metrics.perRoom.push(stats);
  }
  for(const [id,session] of sessions){
    session.connected=false;
    sessions.delete(id);
    metrics.terminated++;
  }
  metrics.orphanSessions=sessions.size;
  metrics.elapsedMs=Math.round((performance.now()-begin)*100)/100;
  assert.equal(metrics.terminated,metrics.clients);
  assert.equal(metrics.orphanSessions,0);
  return metrics;
}

if(require.main===module){
  const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
    const match=/^--(rooms|players|rounds|seed|failure)=(\d+)$/.exec(arg);
    if(!match)throw new Error('Unknown argument: '+arg);
    return [match[1],Number(match[2])];
  }));
  const result=simulate({rooms:args.rooms??6,playersPerRoom:args.players??2,
    rounds:args.rounds??100,seed:args.seed??20261102,failurePercent:args.failure??3});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.stderr.write('OFFLINE SIMULATION ONLY — not a live Cloudflare SFU load test.\n');
}
module.exports={simulate};
