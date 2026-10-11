/* Shared automatic local Head-to-Head coin toss. Works for X01 and special games. */
(function(root){
  'use strict';
  function winner(){
    try{
      if(root.crypto?.getRandomValues){
        const value=new Uint32Array(1);
        root.crypto.getRandomValues(value);
        return value[0]&1;
      }
    }catch{}
    return Math.random()<.5?0:1;
  }
  async function animate(players,starter){
    if(!Array.isArray(players)||players.length!==2||![0,1].includes(starter))
      throw Error('Ugyldige spillere i myntkastet.');
    if(!root.DartArenaCoinFlip?.play)
      return {starter,animationFailed:true};
    try{
      await root.DartArenaCoinFlip.play({
        player1Id:'player-1',player2Id:'player-2',
        player1Name:players[0],player2Name:players[1],
        winnerId:starter===0?'player-1':'player-2'
      });
      return {starter,animationFailed:false};
    }catch(error){
      console.warn('Animasjonen for lokalt myntkast feilet:',error);
      return {starter,animationFailed:true};
    }
  }
  root.DartArenaLocalCoin={winner,animate};
})(window);
