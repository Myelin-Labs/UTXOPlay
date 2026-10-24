import React, {useState} from "react";
import {ArrowLeft, Code2, Building2, ArrowUpRight, Search, X} from "lucide-react";
import {creatorCollection, creatorRoleLinks, filterCreatorGames} from "./ui-model.mjs";
import {GameCard, CreditWallet, StoreLink, Skeletons, Notice} from "./ui.jsx";

export function CreatorCollection({loading, error, onRetry, games, role, gameId, onPlay, onDetails, launching}) {
  const [query,setQuery]=useState(""), [genre,setGenre]=useState("All games"), [sort,setSort]=useState("store"), [freeOnly,setFreeOnly]=useState(false);
  const resetFilters=()=>{setQuery("");setGenre("All games");setSort("store");setFreeOnly(false);};
  if (loading) return <><p role="status">Loading creator collection…</p><Skeletons/></>;
  if (error) return <Notice onRetry={onRetry}>{error}</Notice>;
  const collection = creatorCollection(games, role, gameId);
  if (!collection) return <div className="empty"><h1>Collection unavailable</h1><p>This credit has not been provided, or its game is no longer listed.</p><StoreLink className="outline" href="/">Explore the store</StoreLink></div>;
  const {person, anchor, games: titles} = collection, publisher = role === "publisher", Icon = publisher ? Building2 : Code2;
  const roleLinks=creatorRoleLinks(games,role,gameId), filtered=filterCreatorGames(titles,{query,genre,sort,freeOnly});
  const genres=[...new Set(titles.map(game=>game.genre))].sort();
  return <>
    <StoreLink className="back" href="/"><ArrowLeft size={16}/> All games</StoreLink>
    <section className="creator-heading" aria-label={publisher ? "Publisher collection" : "Developer collection"}>
      <div className="creator-monogram" aria-hidden="true">{person.name.split(/\s+/).slice(0,2).map(word => word[0]).join("")}</div>
      <div className="creator-heading-copy"><div className="eyebrow"><Icon size={15}/>{publisher ? "PUBLISHER" : "DEVELOPER"} COLLECTION</div>
        <h1>{person.name}</h1><p>{titles.length} {titles.length === 1 ? "game" : "games"} {publisher ? "published" : "developed"} · Ready to discover</p>
        <CreditWallet key={person.address || gameId} person={person} role={publisher ? "Publisher" : "Developer"}/>
        {person.sourceUrl && <a className="credit-source" href={person.sourceUrl} target="_blank" rel="noopener noreferrer">Original project <ArrowUpRight size={14}/></a>}
      </div>
    </section>
    <p className="creator-context">{publisher ? "Publishing credits are grouped by the publisher wallet. Each game lists its original developer separately." : anchor.vendor ? "Developer attribution supplied by this publisher. This collection only groups matching developer wallets within that publisher’s listings." : "Original development credits. Ports and Myelin integration are credited separately in each game’s details."}</p>
    <nav className="creator-roles" aria-label="Creator roles">{roleLinks.map(link=><StoreLink key={link.role} href={link.href} aria-current={link.role===role?"page":undefined}>{link.role==="developer"?"Developed":"Published"}<span>{link.count}</span></StoreLink>)}</nav>
    <div className="creator-tools" role="search" aria-label="Search this collection">
      <label className="creator-search"><Search size={17}/><span className="sr-only">Search this collection</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find your next game" type="search"/>{query&&<button type="button" className="icon-btn" aria-label="Clear collection search" onClick={()=>setQuery("")}><X size={15}/></button>}</label>
      <label>Genre<select value={genre} onChange={event=>setGenre(event.target.value)}><option value="All games">All genres</option>{genres.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={event=>setSort(event.target.value)}><option value="store">Store order</option><option value="az">Title: A–Z</option><option value="za">Title: Z–A</option></select></label>
      <label className="creator-free"><input type="checkbox" checked={freeOnly} onChange={event=>setFreeOnly(event.target.checked)}/>Free to play</label>
    </div>
    <div className="creator-results"><p role="status">Showing {filtered.length} of {titles.length} games</p>{(query||genre!=="All games"||freeOnly||sort!=="store")&&<button className="text-link" onClick={resetFilters}>Reset filters</button>}</div>
    {!filtered.length&&<div className="empty creator-empty"><Search size={26}/><h2>No games match these filters.</h2><p>Try another title or explore the full collection.</p><button className="outline" onClick={resetFilters}>Show all games</button></div>}
    <div className="game-grid creator-grid">{filtered.map(game => <GameCard key={game.id} g={game} onPlay={onPlay} onDetails={onDetails} launching={launching}/>)}</div>
  </>;
}
