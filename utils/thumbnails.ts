// utils/thumbnails.ts
// Curated Unsplash public CDN image URLs per genre.
// All images are unsplash.com photos hosted on images.unsplash.com (no API key needed).
// We request &w=640&q=80&fm=jpg for bandwidth, and &auto=format for webp where supported.

type Genre =
  | 'kpop' | 'hiphop' | 'fitness' | 'challenge' | 'promotion'
  | 'travel' | 'daily' | 'news' | 'english' | 'kids';

// Each genre has multiple curated photos. Stable hash pick by template id → always same thumbnail per template, but diverse across catalog.
const POOL: Record<Genre, string[]> = {
  kpop: [
    '1501386761578-eac5c94b800a', // concert crowd lights
    '1470225620780-dba8ba36b745', // stage lights
    '1516450360452-9312f5e86fc7', // microphone
    '1493676304819-0d7a8d026dcf', // neon stage
  ],
  hiphop: [
    '1551847812-f8b09bec23b2', // urban street
    '1516450360452-9312f5e86fc7', // mic gold
    '1514525253161-7a46d19cd819', // boombox
    '1484876065684-b683cf17d276', // graffiti
  ],
  fitness: [
    '1534438327276-14e5300c3a48', // gym weights
    '1517838277536-f5f99be501cd', // runner
    '1540496905036-5937c10647cc', // stretching
    '1571019613454-1cb2f99b2d8b', // gym barbell
  ],
  travel: [
    '1488085061387-422e29b40080', // mountain road
    '1519682337058-a94d519337bc', // forest trail
    '1501785888041-af3ef285b470', // beach
    '1507525428034-b723cf961d3e', // coastline
  ],
  daily: [
    '1511988617509-a57c8a288659', // morning coffee
    '1484154218962-a197022b5858', // laptop desk
    '1517842645767-c639042777db', // journal
    '1494790108377-be9c29b29330', // portrait casual
  ],
  news: [
    '1495020689067-958852a7765e', // newsroom
    '1568992687947-868a62a9f521', // anchor desk
    '1586339949916-3e9457bef6d3', // microphone studio
    '1526378800651-c32d170fe6f8', // press
  ],
  english: [
    '1503676260728-1c00da094a0b', // books open
    '1481627834876-b7833e8f5570', // library
    '1456513080510-7bf3a84b82f8', // reading
    '1532153975070-2e9ab71f1b14', // chalkboard
  ],
  kids: [
    '1519457431-44ccd64a579b', // storybook
    '1587654780291-39c9404d746b', // children reading
    '1503454537195-1dcabb73ffb9', // toys
    '1596464716127-f2a82984de30', // kids book rainbow
  ],
  challenge: [
    '1517649763962-0c623066013b', // athlete running
    '1552674605-db6ffd4facb5', // crossfit
    '1552058544-f2b08422138a', // runner sunset
    '1483721310020-03333e577078', // challenge action
  ],
  promotion: [
    '1557804506-669a67965ba0', // product minimal
    '1542291026-7eec264c27ff', // sneakers
    '1523275335684-37898b6baf30', // watch
    '1572635196237-14b3f281503f', // product shot
  ],
};

// Simple deterministic hash → same template always gets same thumb
function hashPick(id: string, poolSize: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % poolSize;
}

export function getThumbnailUrl(
  genre: string,
  templateId: string,
  width = 640,
): string {
  const g = (genre in POOL ? genre : 'daily') as Genre;
  const pool = POOL[g];
  const photoId = pool[hashPick(templateId, pool.length)];
  // Unsplash direct-image URL (no API key) — images.unsplash.com serves these
  // auto=format gives webp on supported browsers, q=75 balance quality/size
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=75`;
}

export function getThumbnailBlurHash(): string {
  // Solid neutral placeholder until image loads
  return '#F4F4F5';
}
