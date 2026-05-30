export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(200).json({ answer: '> ERREUR: CLAUDE_API_KEY manquante sur Vercel' });

  const { question, store, kpis, winners, alerts } = req.body || {};

  const sys = `OS ecom. Boutique: ${store||'all'}. CA: ${(kpis||[])[0]?.v||'N/A'}. Top winner: ${(winners||[])[0]?.name||'N/A'} score ${(winners||[])[0]?.score||'N/A'}. Alerte principale: ${(alerts||[])[0]?.t||'aucune'}. Réponds en français, 2 phrases max, direct. Commence par "> "`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: sys,
      messages: [{ role: 'user', content: question || 'état général' }]
    })
  });

  const data = await response.json();
  return res.status(200).json({ answer: data.content?.[0]?.text || '> Pas de réponse' });
}
