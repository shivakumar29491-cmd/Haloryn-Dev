export default async function handler(req, res) {
  const api = process.env.HOME_API_URL; // your home PC electron backend

  try {
    const fwd = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await req.json())
    });

    res.status(200).json(await fwd.json());

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
