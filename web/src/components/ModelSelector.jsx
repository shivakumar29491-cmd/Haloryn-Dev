import { useSettings } from "../context/SettingsContext";

export default function ModelSelector() {
  const { model, setModel } = useSettings();

  return (
    <div className="w-full flex gap-3 mb-4">
      {["groq", "brave", "openai", "local"].map((m) => (
        <button
          key={m}
          onClick={() => setModel(m)}
          className={`px-4 py-2 rounded-xl text-sm uppercase border transition-all
            ${
              model === m
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-black/20 text-white/60 border-white/10"
            }
          `}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
