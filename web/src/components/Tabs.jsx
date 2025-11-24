export default function Tabs({ active, setActive }) {
  const tabs = ["Live", "Answer", "Logs"];

  return (
    <div className="flex gap-3 mb-4">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => setActive(t)}
          className={`px-4 py-2 rounded-xl transition-all border 
            ${
              active === t
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-black/20 text-white/60 border-white/10"
            }
          `}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
