export default function HistoryPanel({ history }) {
  return (
    <div className="w-full h-full overflow-y-auto px-3 py-4 space-y-3
      bg-black/30 border border-white/10 rounded-2xl backdrop-blur-xl text-white">

      <h2 className="text-lg font-semibold mb-2">History</h2>

      {history.length === 0 && (
        <p className="text-white/40">No conversations yet.</p>
      )}

      {history.map((item, idx) => (
        <div key={idx} className="bg-white/5 rounded-xl p-3">
          <p className="text-white/70 text-sm">Q: {item.q}</p>
          <p className="text-white mt-1 text-sm">A: {item.a}</p>
        </div>
      ))}
    </div>
  );
}
