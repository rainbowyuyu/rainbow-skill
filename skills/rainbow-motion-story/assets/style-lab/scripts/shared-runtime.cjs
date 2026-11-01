const fs=require('fs'),path=require('path');
module.exports=function sharedRuntime(explicit){
  if(explicit){const p=path.resolve(explicit);if(!fs.existsSync(p))throw Error('Shared package not found: '+p);return p}
  const candidates=[];
  try {const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../local-config.json'),'utf8'));if(config.sharedRuntime)candidates.push(config.sharedRuntime);} catch {}
  for(const seed of [process.cwd(),__dirname]){let p=seed;while(true){for(const rel of ['video_project/shanghai_tower/source/v26/package.json','source/package.json'])candidates.push(path.join(p,rel));const up=path.dirname(p);if(up===p)break;p=up}}
  const found=candidates.find(p=>{try{return fs.existsSync(p)&&!!require('module').createRequire(p).resolve('@remotion/renderer')}catch{return false}});
  if(!found)throw Error('Use --dependencies=<existing shared package.json>; no packages will be installed.');
  return found;
};
