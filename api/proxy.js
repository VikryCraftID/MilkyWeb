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
    const contentType = response.headers.get("content-type") || '';
    const disposition = response.headers.get("content-disposition");

    // Teruskan header penting dari backend (Content-Type + Content-Disposition utk download).
    if (disposition) res.setHeader("Content-Disposition", disposition);
    if (contentType) res.setHeader("Content-Type", contentType);

    if (contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        return res.status(response.status).send(data);
    }
    // Binary (audio/video/octet-stream): teruskan sebagai Buffer agar tidak corrupt + bisa download.
    if (/^(audio|video)\/|octet-stream/.test(contentType)) {
        const buf = Buffer.from(await response.arrayBuffer());
        return res.status(response.status).send(buf);
    }

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Backend API connection failed', details: error.message });
  }
}
