export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  
  // Debug — on va voir ce qui se passe
  if (!apiKey) {
    return res.status(200).json({ 
      answer: '> ERREUR: CLAUDE_API_KEY non trouvée dans les variables Vercel. Valeur reçue: ' + JSON.stringify(process.env.CLAUDE_API_KEY) 
    });
  }

  const { question } = req.body;
  
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
        max_tokens: 300,
        messages: [{ role: 'user', content: question }]
      })
    });
    const data = await response.json();
    return res.status(200).json({ answer: data.content?.[0]?.text || '> OK mais pas de réponse' });
  } catch (e) {
    return res.status(200).json({ answer: '> ERREUR fetch: ' + e.message });
  }
}

  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
