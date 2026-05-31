export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'CLAUDE_API_KEY manquant', keywords: [] });
  const { niche = 'mobilier déco', priceMin = 150, priceMax = 250 } = req.body || {};
  const prompt = `Tu es un expert Google Shopping Ads France spécialisé drop-shipping. Génère 15 requêtes Google Shopping pour la niche "${niche}" entre ${priceMin}€ et ${priceMax}€. Requêtes réelles que des acheteurs français tapent. Réponds UNIQUEMENT avec ce JSON sans markdown : {"keywords": ["requête 1", "requête 2"]}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    const text = data.content?.[0]?.text || '{"keywords":[]}';
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    return res.status(200).json({ keywords: parsed.keywords || [] });
  } catch(e) {
    return res.status(200).json({ error: e.message, keywords: [] });
  }
}
}
