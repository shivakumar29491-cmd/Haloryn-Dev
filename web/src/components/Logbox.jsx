export default function Logbox({ logs }) {
  return (
    <div className="w-full h-full overflow-y-auto px-4 py-3 bg-black/30
      backdrop-blur-xl rounded-2xl border border-white/10 text-white">

      <h2 className="text-lg font-semibold mb-3">Logs</h2>

      {logs.length === 0 && (
        <p className="text-white/40">No logs yet.</p>
      )}

      <div className="space-y-3">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className="bg-white/5 p-3 rounded-xl flex justify-between items-center"
          >
            <div>
              <p className="text-white/70 text-xs">{log.time}</p>
              <p className="text-white text-sm mt-1">{log.question}</p>
            </div>

            <span
              className={`text-xs px-2 py-1 rounded-xl ${
                log.status === "sent"
                  ? "bg-blue-600/40"
                  : "bg-green-600/40"
              }`}
            >
              {log.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
