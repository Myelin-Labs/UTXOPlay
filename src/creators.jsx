import React from "react";
import {ArrowLeft, Code2, Building2, ArrowUpRight} from "lucide-react";
import {creatorCollection} from "./ui-model.mjs";
import {GameCard, CreditWallet, StoreLink, Skeletons, Notice} from "./ui.jsx";

export function CreatorCollection({loading, error, onRetry, games, role, gameId, onPlay, onDetails, launching}) {
  if (loading) return <><p role="status">Loading creator collection…</p><Skeletons/></>;
  if (error) return <Notice onRetry={onRetry}>{error}</Notice>;
  const collection = creatorCollection(games, role, gameId);
  if (!collection) return <div className="empty"><h1>Collection unavailable</h1><p>This credit has not been provided, or its game is no longer listed.</p><StoreLink className="outline" href="/">Explore the store</StoreLink></div>;
  const {person, anchor, games: titles} = collection, publisher = role === "publisher", Icon = publisher ? Building2 : Code2;
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
    <div className="game-grid creator-grid">{titles.map(game => <GameCard key={game.id} g={game} onPlay={onPlay} onDetails={onDetails} launching={launching}/>)}</div>
  </>;
}
