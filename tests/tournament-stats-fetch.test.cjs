const test=require('node:test');
const assert=require('node:assert/strict');
const {fetchAllVisits,PAGE_SIZE}=require('../tournament-stats-fetch.js');

function fakeDb(tables,{failAt=null}={}){
  const calls=[];
  return{
    calls,
    from(table){
      if(!(table in tables))throw Error('Wrong table: '+table);
      const query={
        select(cols){this.cols=cols;return this},
        in(col,ids){assert.equal(col,'match_id');this.ids=ids;return this},
        order(col,opts){assert.equal(col,'id');assert.equal(opts.ascending,true);return this},
        async range(from,to){
          calls.push({table,from,to});
          if(failAt===from)return {data:null,error:new Error('Simulated read failure')};
          const rows=tables[table].filter(r=>this.ids.includes(r.match_id)).sort((a,b)=>a.id-b.id);
          return {data:rows.slice(from,to+1),error:null};
        }
      };
      return query;
    }
  };
}
const makeRows=(n,match='match1')=>Array.from({length:n},(_,i)=>({id:i+1,match_id:match,score:i===1270||i===1297?180:60}));

test('fetches 1356 rows instead of truncating at 1000',async()=>{
  const db=fakeDb({match_throws:makeRows(1356),cricket_visits:[]});
  const result=await fetchAllVisits(db,'match_throws',['match1']);
  assert.equal(result.length,1356);
  assert.equal(result.filter(t=>t.score===180).length,2);
  assert.deepEqual(db.calls.map(x=>x.from),[0,500,1000]);
  assert.equal(result[1355].id,1356);
});

test('handles exact page boundary without duplicates',async()=>{
  const db=fakeDb({match_throws:makeRows(1000),cricket_visits:[]});
  const result=await fetchAllVisits(db,'match_throws',['match1']);
  assert.equal(result.length,1000);
  assert.equal(new Set(result.map(t=>t.id)).size,1000);
  assert.deepEqual(db.calls.map(x=>x.from),[0,500,1000]);
});

test('paginates Cricket visits too and respects match filter',async()=>{
  const db=fakeDb({match_throws:[],cricket_visits:[...makeRows(1030),...makeRows(30,'other')].map((r,i)=>({...r,id:i+1}))});
  const result=await fetchAllVisits(db,'cricket_visits',['match1'],'match_id,player_id,darts');
  assert.equal(result.length,1030);
  assert.equal(result.at(-1).match_id,'match1');
  assert.equal(result.at(-1).id,1030);
});

test('empty match list does not query database',async()=>{
  const db=fakeDb({match_throws:[],cricket_visits:[]});
  assert.deepEqual(await fetchAllVisits(db,'match_throws',[]),[]);
  assert.equal(db.calls.length,0);
});

test('read error rejects instead of presenting partial statistics',async()=>{
  const db=fakeDb({match_throws:makeRows(1356),cricket_visits:[]},{failAt:PAGE_SIZE});
  await assert.rejects(fetchAllVisits(db,'match_throws',['match1']),/Simulated read failure/);
});

test('unknown source cannot be read accidentally',async()=>{
  const db=fakeDb({match_throws:[],cricket_visits:[]});
  await assert.rejects(fetchAllVisits(db,'profiles',['match1']),/Unsupported/);
});
