import React,{useState,useEffect,useRef} from 'react';
import {initialLoad,acceptLoadMessage} from './game-load-state.mjs';

export function GameFrame({game}) {
  const [attempt,setAttempt]=useState(0),[state,setState]=useState(initialLoad),[revealed,setRevealed]=useState(false),[slow,setSlow]=useState(false),[offline,setOffline]=useState(!navigator.onLine);
  const frame=useRef(null),loader=useRef(null),lastChange=useRef(Date.now()),completion=useRef(null),current=useRef(state);
  const token=game.id+':'+attempt;
  current.current=state;
  function retry(){clearTimeout(completion.current);setState(initialLoad());setRevealed(false);setSlow(false);lastChange.current=Date.now();setAttempt(n=>n+1);}
  function requestState(){frame.current?.contentWindow?.postMessage({type:'utxoplay:load-request',attempt:token},location.origin);}
  useEffect(()=>{
    const receive=e=>{
      if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
      const next=acceptLoadMessage(current.current,e.data,game.id,token);
      if(!next)return;
      if(next.progress!==current.current.progress||next.error!==current.current.error){lastChange.current=Date.now();setSlow(false);}
      current.current=next;setState(next);
      if(next.ready&&!completion.current)completion.current=setTimeout(()=>setRevealed(true),600);
    };
    const network=()=>setOffline(!navigator.onLine);
    const interval=setInterval(()=>setSlow(!current.current.ready&&Date.now()-lastChange.current>12000),1000);
    addEventListener('message',receive);addEventListener('online',network);addEventListener('offline',network);requestState();
    return()=>{removeEventListener('message',receive);removeEventListener('online',network);removeEventListener('offline',network);clearInterval(interval);clearTimeout(completion.current);completion.current=null;};
  },[game.id,token]);
  useEffect(()=>{if(loader.current){loader.current.state={...state,title:game.title,cover:game.cover,slow,offline,leaving:state.ready};loader.current.onRetry=retry;}},[state,slow,offline,game,attempt]);
  return <div className={'game-stage '+(revealed?'is-ready':'is-loading')} aria-busy={!revealed}>
    <iframe ref={frame} key={token} className={'game-frame '+game.id} src={'/games/'+game.id+'/?launch='+encodeURIComponent(token)} title={game.title} allow="fullscreen; autoplay" allowFullScreen inert={!revealed} aria-hidden={!revealed} onLoad={requestState}/>
    {!revealed&&<utxo-loader ref={loader}/>}
  </div>;
}
