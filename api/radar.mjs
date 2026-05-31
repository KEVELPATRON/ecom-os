// api/radar.mjs — Module 1 Radar v3
// SerpApi Google Shopping — détection compétiteurs actifs par requête FR

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return res.status(200).json({ error: 'SERPAPI_KEY manquant dans Vercel', competitors: [] });

  const { query } = req.body || {};
  if (!query) return res.status(200).json({ error: 'Requête manquante', competitors: [] });

  try {
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=fr&hl=fr&location=France&api_key=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.error) return res.status(200).json({ error: data.error, competitors: [] });

    const items = data.shopping_results || [];
    const sellers = {};

    for (const item of items) {
      const source = item.source || item.merchant?.name || 'Inconnu';
      const link = item.link || item.product_link || '';
      let domain = source;
      try { if (link.startsWith('http')) domain = new URL(link).hostname.replace('www.', ''); } catch(e){}

      if (!sellers[domain]) {
        sellers[domain] = { domain, source, products: [], minPrice: Infinity, maxPrice: 0, count: 0 };
      }

      const price = parseFloat((item.price || '0').replace(/[^0-9,.]/g,'').replace(',','.')) || 0;
      if (price > 0) {
        sellers[domain].minPrice = Math.min(sellers[domain].minPrice, price);
        sellers[domain].maxPrice = Math.max(sellers[domain].maxPrice, price);
      }
      sellers[domain].count++;
      sellers[domain].products.push({
        title: item.title || '',
        price: item.price || '?',
        priceNum: price,
        link,
        thumbnail: item.thumbnail || '',
        rating: item.rating || null,
        reviews: item.reviews || null,
      });
    }

    const results = Object.values(sellers).map(s => {
      let score = 0;
      const prods = s.products.filter(p => p.priceNum > 0);
      const avgPrice = prods.length ? prods.reduce((a,p) => a+p.priceNum, 0) / prods.length : 0;

      score += Math.min(s.count * 15, 40);
      if (avgPrice >= 150 && avgPrice <= 250) score += 35;
      else if (avgPrice > 250 && avgPrice <= 450) score += 25;
      else if (avgPrice > 450) score += 15;
      else if (avgPrice > 0) score += 5;

      const marketplaces = ['amazon','cdiscount','fnac','darty','conforama','ikea','maisons-du-monde','leroymerlin'];
      const isMarketplace = marketplaces.some(m => s.domain.includes(m));
      if (!isMarketplace) score += 25;
      if (s.products.some(p => p.reviews > 10)) score += 15;

      const tier = avgPrice >= 450 ? 'P3 · 450€+' : avgPrice >= 250 ? 'P2 · 250–450€' : avgPrice >= 150 ? 'P1 · 150–250€ ★' : avgPrice > 0 ? 'Hors cible' : '?';
      const margin = avgPrice >= 450 ? 65 : avgPrice >= 250 ? 62 : avgPrice >= 150 ? 58 : 50;

      return {
        domain: s.domain,
        source: s.source,
        score: Math.min(Math.round(score), 100),
        productCount: s.count,
        minPrice: s.minPrice === Infinity ? '?' : s.minPrice,
        maxPrice: s.maxPrice || 0,
        avgPrice: Math.round(avgPrice) || 0,
        estimatedMargin: margin,
        tier,
        isMarketplace,
        products: s.products.slice(0, 3),
        transparencyUrl: `https://adstransparency.google.com/advertiser?domain=${s.domain}&region=FR`,
        shoppingUrl: `https://www.google.fr/search?q=${encodeURIComponent(query + ' ' + s.source)}&tbm=shop`,
      };
    });

    results.sort((a, b) => a.isMarketplace !== b.isMarketplace ? (a.isMarketplace ? 1 : -1) : b.score - a.score);

    return res.status(200).json({
      query,
      total: results.length,
      competitors: results,
      raw_products: items.length,
      generated_at: new Date().toISOString(),
    });

  } catch(e) {
    return res.status(200).json({ error: 'Erreur: ' + e.message, competitors: [] });
  }
}
