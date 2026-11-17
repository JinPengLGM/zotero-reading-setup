const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of [...walk(path.join(root,'src')),...walk(path.join(root,'scripts')),...walk(path.join(root,'tests'))].filter(x=>/\.(?:js|cjs)$/.test(x))){
  const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status)process.exit(r.status);
}
const preset=JSON.parse(fs.readFileSync(path.join(root,'src/reading-thoughts/preset-config.json'),'utf8'));
for(const [key,value] of Object.entries(preset.preferences)){
  if(/secret|token|password|permission|conversation.*map|providerGroups|endPoint|AppServerPath|syncNote/i.test(key))throw Error('Private/machine-specific preference: '+key);
  if(!['boolean','string','number'].includes(typeof value))throw Error('Unexpected preference type: '+key);
}
console.log('PASS: JavaScript syntax and shareable preference boundary');
