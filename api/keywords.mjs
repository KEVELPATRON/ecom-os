export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: 'CLAUDE_API_KEY manquant', keywords: [] });
  }

  const body = req.body || {};
  const niche = body.niche || 'mobilier deco';
  const priceMin = body.priceMin || 150;
  const priceMax = body.priceMax || 250;

  const prompt = 'Génère 15 requêtes Google Shopping France pour la niche ' + niche + ' entre ' + priceMin + ' et ' + priceMax + ' euros. Réponds uniquement avec ce JSON sans markdown ni explication : {"keywords": ["requête 1", "requête 2"]}';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ keywords: parsed.keywords || [] });

  } catch (e) {
    return res.status(200).json({ error: e.message, keywords: [] });
  }
}
