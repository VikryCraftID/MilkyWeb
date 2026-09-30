export default async function handler(req, res) {
  // Langsung teruskan URL beserta /api/...
  const backendUrl = 'http://node.termai.cc:3510' + req.url;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(backendUrl, fetchOptions);
    
    // Check if response is ok and is JSON before parsing
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Backend API connection failed', details: error.message });
  }
}
