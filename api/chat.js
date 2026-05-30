export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // La clé vit ici côté serveur — jamais exposée au browser
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'CLAUDE_API_KEY not configured in Vercel environment variables' });

  const { question, store, kpis, winners, alerts } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const systemPrompt = `Tu es l'OS d'une machine ecom autonome — assistant opérationnel direct.
Boutique active : ${store === 'all' ? 'toutes boutiques' : store === 'glance' ? 'glancedesign.fr' : 'ponchovibe.com'}.
KPIs actuels : ${JSON.stringify(kpis)}.
Winners actifs : ${winners?.map(w => w.name + ' score ' + w.score + ' run ' + w.run + 'j').join(', ')}.
Alertes : ${alerts?.map(a => a.t).join(' | ')}.
Réponds en français, 2-3 phrases max, très direct et opérationnel. Commence par "> ".`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Claude API error' });
    }

    const data = await response.json();
    return res.status(200).json({ answer: data.content?.[0]?.text || 'No response' });

  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
