// Deterministic crops of the supplied artwork. Requires ImageMagick 7.
import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const brand=path.join(root,'assets/brand'),out=path.join(root,'public/brand');
const source=path.join(brand,'source/utxoplay-light-dark.png');
const run=(...args)=>execFileSync('magick',args);
mkdirSync(out,{recursive:true});
for(const [theme,geometry,mask] of [
 ['light','544x544+174+147','roundrectangle 4,4 538,528 140,140'],
 ['dark','556x556+1056+140','roundrectangle 4,5 552,544 140,140'],
]){
 const dir=path.join(brand,theme);mkdirSync(dir,{recursive:true});
 const master=path.join(dir,'utxoplay-logo-'+theme+'-512.png');
 run(source,'-crop',geometry,'+repage','-alpha','off','(','-size',geometry.split('+')[0],'xc:black','-fill','white','-draw',mask,')','-alpha','off','-compose','CopyOpacity','-composite','-resize','512x512','-strip',master);
 for(const size of [16,32,48,64,96,128,180,192,256])run(master,'-resize',size+'x'+size,'-strip',path.join(dir,`utxoplay-logo-${theme}-${size}.png`));
 for(const size of [96,192,512])run(master,'-resize',size+'x'+size,'-quality','92','-define','webp:alpha-quality=100',path.join(dir,`utxoplay-logo-${theme}-${size}.webp`));
 const background=theme==='dark'?'#101410':'#ffffff';
 run(master,'-define','icon:auto-resize=48,32,16',path.join(dir,`utxoplay-favicon-${theme}.ico`));
 run(master,'-background',background,'-alpha','remove','-alpha','off','-resize','180x180',path.join(dir,`utxoplay-apple-touch-${theme}-180.png`));
 run('-size','512x512','xc:'+background,'(',master,'-resize','384x384',')','-gravity','center','-composite',path.join(dir,`utxoplay-maskable-${theme}-512.png`));
 // Only dark assets are shipped. Light assets are prepared in the source kit.
 if(theme==='dark'){
  for(const file of ['96.webp','192.webp','512.webp','96.png','192.png','512.png'])copyFileSync(path.join(dir,'utxoplay-logo-dark-'+file),path.join(out,'utxoplay-logo-dark-'+file));
  for(const size of [16,32])copyFileSync(path.join(dir,`utxoplay-logo-dark-${size}.png`),path.join(root,`public/favicon-${size}.png`));
  copyFileSync(path.join(dir,'utxoplay-favicon-dark.ico'),path.join(root,'public/favicon.ico'));
  copyFileSync(path.join(dir,'utxoplay-apple-touch-dark-180.png'),path.join(root,'public/apple-touch-icon.png'));
  copyFileSync(path.join(dir,'utxoplay-maskable-dark-512.png'),path.join(out,'utxoplay-maskable-dark-512.png'));
 }
}
const dark=readFileSync(path.join(out,'utxoplay-logo-dark-96.png')).toString('base64');
// Compatibility for existing wallet/provider bookmarks of the old icon URL.
writeFileSync(path.join(root,'public/favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"><image width="512" height="512" xlink:href="data:image/png;base64,${dark}"/></svg>`);
writeFileSync(path.join(root,'public/site.webmanifest'),JSON.stringify({id:'/',name:'UTXOPlay',short_name:'UTXOPlay',description:'Good games. Yours to play.',start_url:'/',scope:'/',display:'standalone',background_color:'#151715',theme_color:'#151715',icons:[{src:'/brand/utxoplay-logo-dark-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/brand/utxoplay-logo-dark-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/brand/utxoplay-maskable-dark-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,2)+'\n');
run('-size','1200x630','xc:#151715','(',path.join(out,'utxoplay-logo-dark-512.png'),'-resize','240x240',')','-geometry','+120+195','-composite','-font','DejaVu-Sans-Bold','-fill','#f4f7f2','-pointsize','82','-annotate','+406+320','UTXOPlay','-font','DejaVu-Sans','-fill','#aab8ab','-pointsize','30','-annotate','+410+380','Good games. Yours to play.','-strip',path.join(out,'utxoplay-social-dark.png'));
console.log('Prepared both logo kits; published dark assets only.');
