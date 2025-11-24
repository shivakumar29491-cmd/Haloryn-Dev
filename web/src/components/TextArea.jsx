import { useState } from "react";
import { FiSend } from "react-icons/fi";

export default function TextArea({ useAsk }) {
  const [text, setText] = useState("");

  const sendMessage = async () => {
    const prompt = text.trim();
    if (!prompt) return;
    await useAsk.ask(prompt);
    setText("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-full px-4 py-3 bg-black/40 border border-white/10
      rounded-2xl backdrop-blur-xl flex items-center gap-3">

      <textarea
        rows="2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Ask HaloAI anything…"
        className="flex-1 bg-transparent outline-none resize-none text-white placeholder-white/40"
      />

      <button
        onClick={sendMessage}
        className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
      >
        <FiSend size={20} className="text-white" />
      </button>

    </div>
  );
}
