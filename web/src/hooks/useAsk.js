// @ts-nocheck

import { useState } from "react";
import { useSettings } from "../context/SettingsContext";

const API_BASE = ""; // auto-resolves to same Vercel project

export default function useAsk() {
  const { model } = useSettings();

  const [answer, setAnswer] = useState("");
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  function addLog(question, status = "sent") {
    setLogs((l) => [
      ...l,
      {
        time: new Date().toLocaleTimeString(),
        question,
        status
      }
    ]);
  }

  async function callAPI(route, body) {
    try {
      const res = await fetch(`${API_BASE}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      return data || { ok: false };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function ask(prompt) {
    if (!prompt.trim()) return;

    setLoading(true);
    setAnswer("");
    addLog(prompt, "sent");

    // -----------------------------
    // 🔵 PHASE-10: ALWAYS USE GROQWEB
    // -----------------------------
    let data = await callAPI("/api/groqweb", { prompt });

    // ---------------------------------------
    // 🔵 PHASE-10: fallback → search router
    // ---------------------------------------
    if (!data.answer || data.answer.trim().length < 2) {
      const fallback = await callAPI("/api/search/router", {
        query: prompt,
        maxResults: 5
      });

      if (fallback?.results?.length) {
        data.answer = fallback.results
          .map((r) => r.snippet || r.title)
          .filter(Boolean)
          .slice(0, 5)
          .join("\n\n");
      } else {
        data.answer = "No useful result found.";
      }
    }

    const finalAns = data.answer || "No answer available.";

    setAnswer(finalAns);
    addLog(prompt, "received");

    setHistory((h) => [{ q: prompt, a: finalAns }, ...h]);
    setLoading(false);
  }

  return {
    ask,
    answer,
    loading,
    logs,
    history,
    setAnswer
  };
}
