// Prevent mixed frontend environments from silently starting an SFU match.
// This is a UX safety check, not an authorization boundary.
(function(root){
  'use strict';
  const PREVIEW_HOST='dartarena-sfu-preview.sotkajervi.workers.dev';
  const PREVIEW_TAG='isolated-sfu-preview-v1';
  const STANDARD_TAG='standard-site';
  const isPreview=hostname=>hostname===PREVIEW_HOST;
  const tag=hostname=>isPreview(hostname)?PREVIEW_TAG:STANDARD_TAG;
  // Only the preview is opt-in and must refuse clients from the old site
  // (which do not send any tag). Standard site behavior stays unchanged.
  const compatible=(hostname,peerTag)=>!isPreview(hostname)||peerTag===PREVIEW_TAG;
  const api=Object.freeze({isPreview,tag,compatible});
  root.DartArenaTournamentSiteSafety=api;
  if(typeof module==='object'&&module?.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
