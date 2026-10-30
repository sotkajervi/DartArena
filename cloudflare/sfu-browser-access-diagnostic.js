// Owner-side manual diagnostic. Paste in the browser console while logged into a test room.
// Does not transmit tokens to chat or log them. Does not start media.
window.dartArenaCheckRoomAccess=async function(kind,roomId){
 const pathname=location.pathname.split('/').pop().toLowerCase();
 if(!kind)kind=pathname==='room.html'?'challenge':'match';
 if(!roomId)roomId=new URLSearchParams(location.search).get('id');
 const client=window.db??(typeof db!=='undefined'?db:null);
 if(!client?.auth?.getSession)throw new Error('Supabase client unavailable on this page');
 if(!['match','challenge'].includes(kind)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId))
  throw new Error('Specify valid kind and UUID');
 const {data,error}=await client.auth.getSession();
 if(error||!data?.session?.access_token)throw new Error('You must sign in first');
 const response=await fetch('https://dartarena-realtime-security-test.sotkajervi.workers.dev/api/sfu/access-check',{
  method:'POST',
  headers:{
   Authorization:'Bearer '+data.session.access_token,
   'X-DartArena-Room-Kind':kind,
   'X-DartArena-Room-Id':roomId
  }
 });
 const result=await response.json().catch(()=>({}));
 const summary={httpStatus:response.status,authorized:result.authorized===true,mediaEnabled:result.mediaEnabled===true,error:result.error??null};
 console.log('DartArena room authorization:',summary);
 return summary;
};
