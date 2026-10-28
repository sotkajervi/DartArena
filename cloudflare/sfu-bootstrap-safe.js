// Isolated bootstrap: registers the SQLite Durable Object class but NEVER grants video access.
import { DurableObject } from 'cloudflare:workers';
export class SfuRoom extends DurableObject {
  async fetch() {
    return new Response(JSON.stringify({ok:false,error:'SFU disabled during bootstrap'}),{
      status:503,headers:{'content-type':'application/json','cache-control':'no-store'}
    });
  }
}
export default {
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if(request.method==='GET' && path==='/health') {
      return new Response(JSON.stringify({ok:true,mode:'bootstrap',mediaEnabled:false}),{
        status:200,headers:{'content-type':'application/json','cache-control':'no-store'}
      });
    }
    return new Response(JSON.stringify({ok:false,error:'SFU disabled during bootstrap'}),{
      status:503,headers:{'content-type':'application/json','cache-control':'no-store'}
    });
  }
};
