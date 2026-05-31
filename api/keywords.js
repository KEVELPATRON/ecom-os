module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(200).json({ keywords: [] });

  const niche = (req.body && req.body.niche) || 'mobilier deco';

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
        messages: [{
          role: 'user',
          content: 'Liste 15 requêtes Google Shopping France pour ' + niche + ' entre 150 et 250 euros. JSON uniquement: {"keywords":["req1","req2"]}'
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return res.status(200).json({ keywords: parsed.keywords || [] });

  } catch (e) {
    return res.status(200).json({ error: e.message, keywords: [] });
  }
}
