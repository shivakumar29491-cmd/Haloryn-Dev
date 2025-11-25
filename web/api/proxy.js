export default async function handler(req, res) {
  try {
    const body = await req.json();

    const result = await fetch("http://localhost:3000/api/groqweb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const json = await result.json();
    return res.status(200).json(json);

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
