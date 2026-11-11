export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  try {
    const cleanUrl = url.startsWith("webcal://") ? "https://" + url.slice(9) : url;
    const upstreamRes = await fetch(cleanUrl, {
      headers: {
        Accept: "text/calendar, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Atrium/1.0)",
      },
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Upstream calendar responded with ${upstreamRes.status}`);
    }

    const text = await upstreamRes.text();
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch calendar feed" });
  }
}
