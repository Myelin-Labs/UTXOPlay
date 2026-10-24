import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeParts} from './geometry.mjs';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {backingRatio} from '../web/viewport.mjs';

const C={ivory:0xf0dfbd,white:0xf9f1de,teal:0x328a86,coral:0xe77c59,dark:0x293b43,rubber:0x28333a,gold:0xe9bd68,leaf:0x668d65};
const material=(color,roughness=.65,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export async function makeScene(canvas,map,onAsset=()=>{}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xa7d5db);scene.fog=new THREE.Fog(0xb4d9d9,1100,3500);
 const camera=new THREE.PerspectiveCamera(76,1,.5,5000);camera.rotation.order='YXZ';scene.add(camera);
 const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environmentMap=pmrem.fromScene(environment,.04);
 scene.environment=environmentMap.texture;scene.environmentIntensity=.28;environment.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xd7f1fa,0xc39164,1.35));
 const sun=new THREE.DirectionalLight(0xffefce,3.1);sun.position.set(-350,650,250);sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-780,right:780,top:780,bottom:-780,near:10,far:1700});sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=1.3;sun.shadow.bias=-.0002;scene.add(sun);
 const mats={};for(const [name,color]of Object.entries(C))mats[name]=material(color);
 mats.grout=material(0xc0b598);mats.dark.metalness=.35;mats.teal.metalness=.25;mats.coral.metalness=.2;
 mats.glass=material(0x102f38,.16,.65);mats.eye=new THREE.MeshStandardMaterial({color:0xadfff1,emissive:0x53e6db,emissiveIntensity:1.8});
 const textures=new THREE.TextureLoader();let loaded=0;const [texture,skyTexture]=await Promise.all(['art/limestone.webp','art/coastal-sky.webp'].map(url=>textures.loadAsync(url).then(t=>{onAsset(++loaded,2);return t;}).catch(()=>{throw Object.assign(new Error('Harbor artwork could not load. Please try again.'),{stage:'assets'});})));
 skyTexture.colorSpace=THREE.SRGBColorSpace;const skyGeometry=new THREE.SphereGeometry(4200,48,24);for(let i=0;i<skyGeometry.attributes.uv.count;i++)skyGeometry.attributes.uv.setY(i,Math.max(0,skyGeometry.attributes.uv.getY(i)*1.6-.6));
 const sky=new THREE.Mesh(skyGeometry,new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,fog:false,toneMapped:false,depthWrite:false}));sky.renderOrder=-1;scene.add(sky);
 texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 mats.stone=new THREE.MeshStandardMaterial({color:0xf2e5cf,map:texture,bumpMap:texture,bumpScale:.45,roughness:.92});
 const groundTexture=texture.clone();groundTexture.repeat.set(18,18);groundTexture.needsUpdate=true;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1040,1040),new THREE.MeshStandardMaterial({map:groundTexture,color:0xd7cbb1,roughness:.96,bumpMap:groundTexture,bumpScale:.35}));ground.rotation.x=-Math.PI/2;ground.position.y=map.floor;ground.receiveShadow=true;scene.add(ground);
 // Merge static scenery by material. Decorative geometry never changes native collision.
 const batch=new Map(),staticRoot=new THREE.Group();scene.add(staticRoot);
 function shape(parent,geometry,mat,pos=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.scale.set(...scale);
  if(parent===staticRoot){mesh.updateMatrix();geometry.applyMatrix4(mesh.matrix);if(!batch.has(mat))batch.set(mat,[]);batch.get(mat).push(geometry);return mesh;}
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 const box=(parent,w,h,d,x,y,z,mat,round=0)=>shape(parent,round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
 const cylinder=(parent,r1,r2,h,x,y,z,mat,segments=12,rotation=[0,0,0])=>shape(parent,new THREE.CylinderGeometry(r1,r2,h,segments),mat,[x,y,z],rotation);
 const sphere=(parent,r,x,y,z,mat,scale=[1,1,1])=>shape(parent,new THREE.SphereGeometry(r,16,10),mat,[x,y,z],[0,0,0],scale);
 function plant(x,y,z,size=1){
  cylinder(staticRoot,12*size,8*size,19*size,x,y+9.5*size,z,mats.coral);
  cylinder(staticRoot,12.8*size,12.8*size,3*size,x,y+18*size,z,mats.ivory);
  for(let j=0;j<7;j++){const a=j*Math.PI*2/7;shape(staticRoot,new THREE.ConeGeometry(5*size,27*size,5),mats.leaf,[x+Math.sin(a)*8*size,y+28*size,z+Math.cos(a)*8*size],[Math.cos(a)*.55,a,-Math.sin(a)*.55]);}
 }
 function windowAt(x,y,z,width=35){
  box(staticRoot,width+9,53,3,x,y,z,mats.white,1);
  box(staticRoot,width,44,5,x,y,z+2,mats.teal,1);
  for(let n=-2;n<=2;n++)box(staticRoot,width-4,1.5,1,x,y+n*7,z+5,mats.dark);
  box(staticRoot,width+16,4,13,x,y-27,z+4,mats.white,1);
 }
 // Tile joints and lane markings follow the unchanged 1,024-unit native arena.
 for(let x=-512;x<=512;x+=64)box(staticRoot,.32,.06,1024,x,-35.93,0,mats.grout);
 for(let z=-512;z<=512;z+=64)box(staticRoot,1024,.06,.32,0,-35.92,z,mats.grout);
 for(const z of [-260,260]){
  const ring=new THREE.Mesh(new THREE.RingGeometry(34,36,64),material(z>0?C.teal:C.coral));ring.rotation.x=-Math.PI/2;ring.position.set(0,-35.8,z);scene.add(ring);
  for(let n=0;n<3;n++)box(staticRoot,12,.1,2,-18+n*18,-35.7,z+45,z>0?mats.teal:mats.coral);
 }
 for(const [index,o]of map.obstacles.entries()){
  const a=o.min,b=o.max,w=b[0]-a[0],h=b[1]-a[1],d=b[2]-a[2],x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,accent=x<0?mats.teal:mats.coral;
  box(staticRoot,w,h,d,x,(a[1]+b[1])/2,z,mats.stone,1);
  box(staticRoot,w,5,d,x,b[1]-2.5,z,mats.white,1);
  box(staticRoot,w,.9,d+.15,x,a[1]+13,z,accent);
  for(const side of [-1,1]){
   box(staticRoot,w*.62,h*.48,1,x,a[1]+h*.48,z+side*(d/2+.1),accent,1);
   box(staticRoot,w*.52,2,1.4,x,a[1]+h*.62,z+side*(d/2+.2),mats.ivory);
   box(staticRoot,3,7,1.5,x+w*.18,a[1]+h*.42,z+side*(d/2+.3),mats.gold,.4);
  }
  if(o.kind==='Monolith'){
   // Flush vents and corner trims stay inside the original obstacle silhouette.
   for(let k=0;k<5;k++)box(staticRoot,w*.55,2,1,x,b[1]-18-k*6,z+d/2+.2,mats.dark);
  }
 }
 for(const z of [-512,512]){
  box(staticRoot,1040,132,16,0,30,z,mats.stone,1);
  box(staticRoot,1040,6,20,0,93,z,mats.white,1);
  for(let x=-448;x<=448;x+=128){box(staticRoot,14,133,20,x,30,z,mats.ivory,1);}
 }
 for(const x of [-512,512]){box(staticRoot,16,132,1024,x,30,0,mats.stone,1);box(staticRoot,20,6,1032,x,93,0,mats.white,1);}
 // Architecture, vegetation and sea are beyond the play boundary, preserving sightlines.
 for(let k=0;k<9;k++){
  const x=-620+k*155,h=150+(k%3)*46,z=-650-(k%2)*65;
  box(staticRoot,143,h,160,x,-36+h/2,z,k%3===0?mats.ivory:mats.stone,3);
  box(staticRoot,155,7,174,x,-36+h,z,mats.coral,1);
  windowAt(x-32,h*.5,z+83);windowAt(x+32,h*.5,z+83);
  box(staticRoot,3,64,3,x+30,h+1,z,mats.dark);
  box(staticRoot,46,2,2,x+30,h+22,z,mats.dark);
  if(k%2===0)plant(x-28,h-32,z+32,1.8);
 }
 for(let k=0;k<6;k++){
  const z=-430+k*175,h=145+(k%3)*45;
  box(staticRoot,145,h,150,-650,h/2-36,z,mats.stone,3);box(staticRoot,158,7,164,-650,h-36,z,mats.coral,2);
  box(staticRoot,4,55,45,-575,38,z,mats.teal,1);
 }
 // Waterfront edge, moored utility shapes, horizon islands and cloud masses.
 box(staticRoot,7000,8,7000,0,-65,0,material(0x72b9c2,.32,.15));
 for(const x of [-490,490])for(const z of [-380,-160,100,360])plant(x,-36,z,.9);
 for(const x of [-560,560])for(const z of [-420,-120,180,430]){
  plant(x,98,z,1.4);
  cylinder(staticRoot,5,7,160,x,44,z,mats.dark,10);sphere(staticRoot,10,x,129,z,mats.gold);
 }
 for(const [mat,geometries]of batch){const merged=mergeParts(geometries);const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;staticRoot.add(mesh);geometries.forEach(g=>g.dispose());}
 staticRoot.updateMatrixWorld(true);staticRoot.traverse(n=>{n.matrixAutoUpdate=false;});
 function consolidate(group){
  const grouped=new Map();
  for(const mesh of [...group.children])if(mesh.isMesh){mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(!grouped.has(mesh.material))grouped.set(mesh.material,[]);grouped.get(mesh.material).push(g);group.remove(mesh);mesh.geometry.dispose();}
  for(const [mat,geometries]of grouped){const mesh=new THREE.Mesh(mergeParts(geometries),mat);mesh.castShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 }
 function robot(){
  const rig=new THREE.Group(),torso=new THREE.Group(),head=new THREE.Group(),limbs=[];rig.add(torso,head);
  box(torso,23,27,19,0,0,0,mats.coral,3);box(torso,17,16,2,0,1,-10,mats.ivory,2);
  cylinder(torso,7,7,4,0,-16,0,mats.rubber);box(torso,19,8,14,0,-20,0,mats.dark,2);
  box(torso,10,16,7,0,2,12,mats.teal,2);box(torso,9,2,1,0,3,-12,mats.dark);
  head.position.y=23;sphere(head,14,0,0,0,mats.white,[1,.92,.87]);
  box(head,23,12,5,0,0,-10,mats.glass,3);
  for(const x of [-5,5])sphere(head,1.5,x,0,-13,mats.eye,[.65,1.5,.4]);
  for(const x of [-14,14])cylinder(head,5,5,3,x,0,0,mats.teal,12,[0,0,Math.PI/2]);
  box(head,3,3,13,0,12,1,mats.coral,1);
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(side*7,-21,0);rig.add(leg);limbs.push(leg);
   cylinder(leg,3.8,3.8,8,0,-3,0,mats.rubber);box(leg,10,9,11,0,-8,-1,mats.ivory,2);box(leg,11,5,16,0,-12,-3,mats.dark,2);
   const arm=new THREE.Group();arm.position.set(side*13,7,0);torso.add(arm);limbs.push(arm);
   sphere(arm,4.5,0,0,0,mats.coral);box(arm,5,11,6,0,-7,-1,mats.ivory,1);sphere(arm,3.5,0,-14,-3,mats.rubber);arm.rotation.x=-.5;
   consolidate(leg);consolidate(arm);
  }
  box(torso,7,8,28,11,-4,-17,mats.teal,2);cylinder(torso,2.3,2.3,6,11,-3,-33,mats.dark,12,[Math.PI/2,0,0]);
  consolidate(torso);consolidate(head);return {rig,head,limbs};
 }
 const bot=robot();scene.add(bot.rig);bot.rig.visible=false;
 const gun=new THREE.Group();camera.add(gun);gun.position.set(8,-7,-19);gun.scale.setScalar(.55);
 box(gun,6,7,21,0,0,0,mats.teal,1.4);box(gun,5.7,2,16,0,3,1,mats.ivory,.6);
 box(gun,4.5,5,7,0,-1,12,mats.ivory,1);box(gun,3,8,4,0,-6,5,mats.rubber,.7);
 box(gun,4,8,7,0,-5,-2,mats.coral,.7);cylinder(gun,1.9,2.2,15,0,1,-16,mats.dark,16,[Math.PI/2,0,0]);
 cylinder(gun,2.8,2.8,3,0,1,-22,mats.ivory,12,[Math.PI/2,0,0]);
 box(gun,3,2,2,0,5,-5,mats.dark,.4);box(gun,.8,.8,.5,0,5,-6.2,mats.eye,.1);
 for(let k=0;k<5;k++)box(gun,.3,2,1,3.05,0,-5+k*2,mats.dark,.1);
 box(gun,.3,2.4,5,-3.1,0,2,mats.gold,.1);
 // First-person gloved hands and forearm armor, attached to the weapon rig.
 sphere(gun,3,1,-6,6,mats.rubber,[.9,1,1.2]);box(gun,5,5,13,2,-8,14,mats.ivory,1.4);
 sphere(gun,3,-3,-4,-8,mats.rubber);box(gun,5,5,13,-5,-6,-1,mats.teal,1.3);consolidate(gun);
 const flash=new THREE.Mesh(new THREE.ConeGeometry(3.2,9,6),new THREE.MeshBasicMaterial({color:0xffde87,transparent:true,opacity:.9,depthWrite:false}));flash.rotation.x=-Math.PI/2;flash.position.set(0,1,-28);flash.visible=false;gun.add(flash);
 const trails=[];const trailMaterial=new THREE.MeshBasicMaterial({color:0xffd999,transparent:true,opacity:.65,depthWrite:false});
 for(let n=0;n<12;n++){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,1,5),trailMaterial);mesh.visible=false;scene.add(mesh);trails.push({mesh,until:0});}
 let reloadPose=0,trailIndex=0,requestedRatio=Math.min(devicePixelRatio||1,1.7),quality='auto';
 const direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),start=new THREE.Vector3();
 function shoot(now,origin,rotation){const trail=trails[trailIndex++%trails.length];direction.set(-Math.sin(rotation.yaw)*Math.cos(rotation.pitch),Math.sin(rotation.pitch),-Math.cos(rotation.yaw)*Math.cos(rotation.pitch));start.copy(origin).addScaledVector(direction,24);trail.mesh.position.copy(start).addScaledVector(direction,28);trail.mesh.quaternion.setFromUnitVectors(up,direction);trail.mesh.scale.y=56;trail.mesh.visible=true;trail.until=now+65;}
 function resize(fov=76){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(backingRatio(w,h,requestedRatio));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=fov;camera.updateProjectionMatrix();}
 function setQuality(value){quality=value;renderer.shadowMap.enabled=value!=='low';scene.environmentIntensity=value==='low'?.18:.28;resize(camera.fov);}
 function resolution(ratio){requestedRatio=Math.min(ratio,1.7);resize(camera.fov);}
 function animate(now,dt,{moving=0,recoil=0,reloading=false,reduced=false,enemySpeed=0}={}){
  reloadPose+=(Number(reloading)-reloadPose)*(1-Math.exp(-dt*12));const bob=reduced?0:Math.sin(now*.011)*.12*moving;const fit=Math.min(1,camera.aspect/1.3);gun.position.set(8*fit,-7+bob,-19+recoil*1.7);gun.scale.setScalar(.55*(.8+.2*fit));gun.rotation.set(recoil*.055+reloadPose*.45,-reloadPose*.28,-reloadPose*.3);
  const stride=reduced?0:Math.sin(now*.012)*Math.min(.55,enemySpeed/350);bot.limbs[0].rotation.x=stride;bot.limbs[2].rotation.x=-stride;
  bot.head.rotation.z=reduced?0:Math.sin(now*.0014)*.025;
  for(const t of trails)if(t.until<now)t.mesh.visible=false;
 }
 function dispose(){renderer.dispose();environmentMap.dispose();scene.traverse(o=>{o.geometry?.dispose();});for(const m of Object.values(mats))m.dispose();texture.dispose();skyTexture.dispose();groundTexture.dispose();}
 return {renderer,scene,camera,enemy:bot.rig,gun,flash,resize,resolution,setQuality,shoot,animate,dispose};
}
