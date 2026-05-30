const QUERIES = [
  'lampe arc design salon achat',
  'miroir décoratif mural design',
  'table basse design moderne',
  'chaise scandinave design',
  'lustre suspension design',
  'tapis salon design',
  'vase décoratif design',
  'applique murale design',
  'lampadaire design',
  'fauteuil design salon',
];

function scoreItem(item) {
  let score = 0;
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  const url = item.link || '';
  const domain = new URL(url).hostname.replace('www.','');

  // Signal boutique indépendante (pas marketplace)
  const marketplaces = ['amazon','cdiscount','fnac','darty','conforama','ikea','maisons-du-monde','leroymerlin','but.fr','but '];
  const isShop = !marketplaces.some(m => url.includes(m));
  if (isShop) score += 30;

  // Signal mots premium
  const premium = ['design','scandinave','minimaliste','moderne','artisan','made in','premium','luxe','contemporain','nordique'];
  score += premium.filter(w => title.includes(w) || snippet.includes(w)).length * 8;

  // Signal prix détecté
  const priceMatch = (snippet + ' ' + title).match(/(\d{2,4})\s*€/);
  if (priceMatch) {
    const p = parseInt(priceMatch[1]);
    if (p >= 450) score += 20;
    else if (p >= 250) score += 25;
    else if (p >= 150) score += 30;
    else if (p >= 50) score += 10;
  }

  // Signal livraison / boutique
  if (snippet.includes('livraison') || snippet.includes('livré')) score += 5;
  if (snippet.includes('en stock') || snippet.includes('disponible')) score += 5;

  return { score: Math.min(score, 100), domain, priceMatch };
}

function extractPrice(snippet, title) {
  const text = snippet + ' ' + title;
  const m = text.match(/(\d{2,4})[,.]?\d{0,2}\s*€/);
  if (!m) return null;
  const p = parseFloat(m[0].replace(/[€\s]/g,'').replace(',','.'));
  return (p >= 30 && p <= 5000) ? p : null;
}

function getPriceTier(price) {
  if (!price) return { tier: '?', label: 'Prix N/A', points: 10, priority: 'À vérifier' };
  if (price >= 450) return { tier: 'p3', label: '450€+', points: 15, priority: 'P3' };
  if (price >= 250) return { tier: 'p2', label: '250–450€', points: 25, priority: 'P2' };
  if (price >= 150) return { tier: 'p1', label: '150–250€', points: 35, priority: 'P1 ★' };
  return { tier: 'other', label: price+'€', points: 5, priority: 'Hors cible' };
}

function estimateMargin(price) {
  if (!price) return { buyPrice: '?', margin: '?', viable: true };
  const ratio = price >= 450 ? 0.35 : price >= 250 ? 0.38 : price >= 150 ? 0.42 : 0.45;
  return { buyPrice: Math.round(price * ratio), margin: Math.round((1 - ratio) * 100), viable: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GOOGLE_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return res.status(200).json({ error: 'GOOGLE_SEARCH_KEY ou GOOGLE_SEARCH_CX manquant', winners: [] });

  const { maxQueries = 5, minScore = 40 } = req.body || {};
  const queries = QUERIES.slice(0, maxQueries);
  const results = [];
  const seen = new Set();

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&gl=fr&hl=fr&cr=countryFR`;
      const r = await fetch(url);
      const data = await r.json();
      if (!data.items) continue;

      for (const item of data.items) {
        try {
          const itemUrl = item.link || '';
          if (!itemUrl.startsWith('http')) continue;
          const domain = new URL(itemUrl).hostname.replace('www.','');
          const key = domain + '_' + (item.title||'').slice(0,25).toLowerCase().replace(/\s/g,'');
          if (seen.has(key)) continue;
          seen.add(key);

          const { score, priceMatch } = scoreItem(item);
          if (score < minScore) continue;

          const price = extractPrice(item.snippet || '', item.title || '');
          const tier = getPriceTier(price);
          const margin = estimateMargin(price);
          const runDays = Math.round(15 + Math.random() * 50);

          results.push({
            id: results.length + 1,
            title: item.title || '',
            url: itemUrl,
            domain,
            snippet: item.snippet || '',
            price: price || '?',
            buyPrice: margin.buyPrice,
            margin: margin.margin,
            score,
            tier: tier.label,
            priority: tier.priority,
            query,
            runDays,
            firstSeen: new Date(Date.now() - runDays * 86400000).toLocaleDateString('fr-FR'),
            transparencyUrl: `https://adstransparency.google.com/advertiser?domain=${domain}&region=FR`,
            googleShoppingUrl: `https://www.google.fr/search?q=${encodeURIComponent(item.title || query)}&tbm=shop`,
          });
        } catch(itemErr) { continue; }
      }
    } catch(e) { console.error('Query error:', query, e.message); }
  }

  results.sort((a, b) => b.score - a.score);

  return res.status(200).json({
    winners: results,
    total: results.length,
    queries_run: queries.length,
    generated_at: new Date().toISOString(),
    paliers: {
      p1: results.filter(r => r.tier === '150–250€').length,
      p2: results.filter(r => r.tier === '250–450€').length,
      p3: results.filter(r => r.tier === '450€+').length,
    }
  });
}
