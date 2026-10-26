const test=require('node:test');
const assert=require('node:assert/strict');
const {show,placement,sync}=require('../tournament-group-results-layout.js');

const tournament=(status,type='groups_cup')=>({status,tournament_type:type});
function fakeDOM(){
  const parent={children:[]};
  const make=id=>{
    const classes=new Set(['hidden']);
    const el={
      id,parentNode:parent,
      classList:{
        toggle(name,active){if(active)classes.add(name);else classes.delete(name)},
        contains(name){return classes.has(name)}
      },
      get nextElementSibling(){
        const n=parent.children.indexOf(el);
        return parent.children[n+1]||null;
      },
      insertAdjacentElement(where,item){
        if(where!=='afterend')throw Error('Unsupported placement');
        parent.insertBefore(item,this.nextElementSibling);
      }
    };
    return el;
  };
  parent.insertBefore=(node,before)=>{
    const current=parent.children.indexOf(node);
    if(current>=0)parent.children.splice(current,1);
    const index=before?parent.children.indexOf(before):-1;
    if(index<0)parent.children.push(node);else parent.children.splice(index,0,node);
  };
  const els=Object.fromEntries(['groupLobby','cupSetup','cupLobby','tournamentStats'].map(id=>[id,make(id)]));
  parent.children=[els.groupLobby,els.cupSetup,els.cupLobby,els.tournamentStats];
  return {document:{getElementById:id=>els[id]},els,parent,order:()=>parent.children.map(x=>x.id)};
}

test('group standings remain available after cup is drawn and after tournament finishes',()=>{
  for(const stage of ['groups','cup_setup','cup','finished'])assert.equal(show(tournament(stage)),true);
  for(const stage of ['registration','groups_setup','cancelled'])assert.equal(show(tournament(stage)),false);
  for(const stage of ['groups','cup_setup','cup','finished'])assert.equal(show(tournament(stage,'cup')),false);
});

test('original group standings appear directly under cup in cup phase',()=>{
  const d=fakeDOM();
  sync(tournament('cup'),d.document);
  assert.deepEqual(d.order(),['cupSetup','cupLobby','groupLobby','tournamentStats']);
  assert.equal(d.els.groupLobby.classList.contains('hidden'),false);
  assert.equal(d.els.groupLobby.classList.contains('cup-group-results'),true);
  sync(tournament('cup'),d.document);
  assert.deepEqual(d.order(),['cupSetup','cupLobby','groupLobby','tournamentStats']);
});

test('group standings appear directly under cup setup before cup is drawn',()=>{
  const d=fakeDOM();
  sync(tournament('cup_setup'),d.document);
  assert.deepEqual(d.order(),['cupSetup','groupLobby','cupLobby','tournamentStats']);
  assert.equal(d.els.groupLobby.classList.contains('hidden'),false);
});

test('group standings return to normal placement when group play is active',()=>{
  const d=fakeDOM();
  sync(tournament('cup'),d.document);
  sync(tournament('groups'),d.document);
  assert.deepEqual(d.order(),['groupLobby','cupSetup','cupLobby','tournamentStats']);
  assert.equal(d.els.groupLobby.classList.contains('cup-group-results'),false);
});

test('pure cup does not show phantom group standings',()=>{
  const d=fakeDOM();
  sync(tournament('cup','cup'),d.document);
  assert.equal(d.els.groupLobby.classList.contains('hidden'),true);
  assert.equal(placement(tournament('cup','cup')),null);
});
