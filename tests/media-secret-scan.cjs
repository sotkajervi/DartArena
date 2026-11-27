const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const paths=execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean);
const findings=[];
const patterns=[
 ['Supabase secret',/\bsb_secret_[A-Za-z0-9_-]{15,}/g],
 ['GitHub token',/\b(?:ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{25,}/g],
 ['Private key',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
 ['Provider secret literal',/\b(?:REALTIME_SFU_BEARER_TOKEN|CLOUDFLARE_API_TOKEN|ROBOFLOW_API_KEY|TURNSTILE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"][A-Za-z0-9_.\/+=-]{24,}['"]/g]
];
let count=0;
for(const path of paths){
 if(!/\.(?:js|mjs|cjs|ts|tsx|html|json|jsonc|ya?ml|sql|md|txt|toml|sh|py)$/i.test(path)&&!/(?:^|\/)\.env(?:\.|$)/.test(path))continue;
 if(path==='tests/media-secret-scan.cjs')continue;
 const s=fs.readFileSync(path,'utf8');count++;
 for(const [kind,re] of patterns){re.lastIndex=0;for(const m of s.matchAll(re))findings.push({path,line:s.slice(0,m.index).split('\n').length,kind});}
 for(const m of s.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)){
  try{const claims=JSON.parse(Buffer.from(m[0].split('.')[1],'base64url').toString('utf8'));if(claims.role==='service_role')findings.push({path,line:s.slice(0,m.index).split('\n').length,kind:'Legacy service-role JWT'});}catch{}
 }
}
console.log('Scanned '+count+' tracked text files (working tree only); secret values never printed.');
for(const f of findings)console.error(f.path+':'+f.line+' '+f.kind);
if(findings.length)process.exitCode=1;
