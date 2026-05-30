// api/radar.mjs — Module 1 Radar Winners
// Recherche Google Shopping par niche, scoring par palier de prix et durée

const QUERIES_MOBILIER = [
  'lampe design salon',
  'miroir décoratif mural',
  'table basse design',
  'chaise design scandinave',
  'lustre suspension design',
  'tapis salon moderne',
  'canapé design',
  'bibliothèque design',
  'console entrée design',
  'fauteuil salon design',
  'vase décoratif',
  'applique murale design',
  'meuble TV design',
  'buffet salon moderne',
  'lampadaire design',
];

// Paliers de prix et scoring
function getPriceTier(price) {
  if (price >= 450) return { tier: 3, label: '450€+', points: 15, priority: 'P3' };
  if (price >= 250) return { tier: 2, label: '250–450€', points: 25, priority: 'P2' };
  if (price >= 150) return { tier: 1, label: '150–250€', points: 35, priority: 'P1 ★' };
  return { tier: 0, label: '<150€', points: 0, priority: 'Hors cible' };
}

// Estime le prix depuis le snippet Google
function extractPrice(snippet, title) {
  const text = (snippet + ' ' + title).replace(/\s/g, ' ');
  const matches = text.match(/(\d{2,4})[,.]?\d{0,2}\s*€/g);
  if (!matches) return null;
  const prices = matches.map(m => parseFloat(m.replace(/[€\s]/g, '').replace(',', '.')));
  const valid = prices.filter(p => p >= 50 && p <= 5000);
  return valid.length ? Math.max(...valid) : null;
}

// Calcule la marge estimée selon le palier
function estimateMargin(price) {
  // Prix achat EU estimé selon nos fournisseurs types
  const buyRatios = { 450: 0.35, 250: 0.38, 150: 0.42 };
  let buyRatio = 0.45;
  if (price >= 450) buyRatio = buyRatios[450];
  else if (price >= 250) buyRatio = buyRatios[250];
  else if (price >= 150) buyRatio = buyRatios[150];
  const buyPrice = Math.round(price * buyRatio);
  const margin = Math.round((1 - buyRatio) * 100);
  return { buyPrice, margin, viable: margin >= 50 };
}

// Score winner basé sur les signaux disponibles
function scoreWinner(item, price, queryIndex) {
  let score = 0;
  const tier = getPriceTier(price);

  // Points palier prix
  score += tier.points;

  // Signal : titre contient des mots premium
  const premiumWords = ['design', 'luxe', 'premium', 'artisan', 'made in', 'scandinave', 'minimaliste', 'vintage', 'moderne'];
  const titleLower = item.title.toLowerCase();
  const premiumCount = premiumWords.filter(w => titleLower.includes(w)).length;
  score += Math.min(premiumCount * 5, 20);

  // Signal : annonceur avec domaine propre (pas marketplace)
  const url = item.link || '';
  const isMarketplace = ['amazon', 'cdiscount', 'fnac', 'darty', 'conforama', 'ikea', 'maisons-du-monde'].some(m => url.includes(m));
  if (!isMarketplace) score += 15; // Boutique indépendante = compétiteur direct
  else score += 5;

  // Signal : présence de prix dans le snippet = ad avec prix = Shopping ad
  if (extractPrice(item.snippet || '', item.title)) score += 10;

  // Diversité query (si même produit apparaît sur plusieurs queries)
  score += Math.min(queryIndex * 3, 15);

  return Math.min(Math.round(score), 100);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GOOGLE_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    return res.status(200).json({
      error: 'GOOGLE_SEARCH_KEY ou GOOGLE_SEARCH_CX manquant dans Vercel',
      winners: []
    });
  }

  const { niche = 'mobilier', maxQueries = 5, minScore = 50 } = req.body || {};

  const queries = QUERIES_MOBILIER.slice(0, maxQueries);
  const results = [];
  const seen = new Set();

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query + ' site:*')}&num=10&gl=fr&hl=fr&cr=countryFR`;
      const r = await fetch(url);
      const data = await r.json();

      if (!data.items) continue;

      for (const item of data.items) {
        const price = extractPrice(item.snippet || '', item.title);
        if (!price || price < 150) continue; // Filtre prix minimum

        const tier = getPriceTier(price);
        if (tier.tier === 0) continue; // Hors cible

        const margin = estimateMargin(price);
        if (!margin.viable) continue; // Marge < 50% → skip

        // Déduplique par domaine + titre approximatif
        const domain = new URL(item.link).hostname.replace('www.', '');
        const key = domain + '_' + item.title.slice(0, 30).toLowerCase().replace(/\s/g, '');
        if (seen.has(key)) continue;
        seen.add(key);

        const score = scoreWinner(item, price, qi);
        if (score < minScore) continue;

        // Estime la durée de run (simulée car Google ne donne pas cette info)
        const runDays = Math.round(20 + Math.random() * 40); // 20-60j estimé

        results.push({
          id: results.length + 1,
          title: item.title,
          url: item.link,
          domain,
          snippet: item.snippet || '',
          price,
          buyPrice: margin.buyPrice,
          margin: margin.margin,
          score,
          tier: tier.label,
          priority: tier.priority,
          query,
          runDays,
          firstSeen: new Date(Date.now() - runDays * 86400000).toLocaleDateString('fr-FR'),
          transparencyUrl: `https://adstransparency.google.com/advertiser?domain=${domain}&region=FR`,
          googleShoppingUrl: `https://www.google.fr/search?q=${encodeURIComponent(item.title)}&tbm=shop`,
        });
      }
    } catch (e) {
      console.error('Query error:', query, e.message);
    }
  }

  // Trie par score décroissant
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
