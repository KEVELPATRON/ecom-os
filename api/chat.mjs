export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(200).json({ answer: '> ERREUR: CLAUDE_API_KEY manquante sur Vercel' });

  const { question, store, kpis, winners, alerts } = req.body || {};

  const sys = `Tu es l'OS d'une machine ecom autonome. Boutique: ${store||'all'}. KPIs: ${JSON.stringify(kpis||[])}. Winners: ${(winners||[]).map(w=>w.name+' score '+w.score).join(', ')}. Alerts: ${(alerts||[]).map(a=>a.t).join(' | ')}. Réponds en français, 2-3 phrases max, très direct. Commence par "> "`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: sys,
      messages: [{ role: 'user', content: question || 'état général' }]
    })
  });

  const data = await response.json();
  return res.status(200).json({ answer: data.content?.[0]?.text || '> Pas de réponse' });
}
