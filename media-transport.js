// One server-side mode for new waiting/match rooms. Never trust localStorage or URL flags.
(function(root){
  'use strict';
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  let mode='legacy',promise=null,resolved=false,errorMessage='';
  async function getMode(){
    if(promise)return promise;
    promise=(async()=>{
      // Fail CLOSED to existing/legacy transport if unauthenticated or database unavailable.
      try{
        if(!root.supabase)throw new Error('Supabase library missing');
        const client=root.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
        const {data:{session},error:authError}=await client.auth.getSession();
        if(authError||!session)throw new Error('Not signed in');
        const {data,error}=await client.from('media_transport_config')
          .select('mode').eq('id',1).single();
        if(error)throw error;
        mode=data?.mode==='sfu'?'sfu':'legacy';
      }catch(error){
        errorMessage=error?.message||String(error);
        console.warn('[MEDIA MODE] Unable to read global mode; using legacy video:',errorMessage);
        mode='legacy';
      }
      resolved=true;
      return mode;
    })();
    return promise;
  }
  const api={getMode,isSfuActive:()=>resolved&&mode==='sfu',
    current:()=>mode,lastError:()=>errorMessage};
  root.DartArenaMediaMode=api;
  if(typeof module==='object'&&module?.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
