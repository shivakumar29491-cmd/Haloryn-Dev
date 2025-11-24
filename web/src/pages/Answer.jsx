import { useState } from "react";
import Panel from "../components/Panel";
import AnswerBox from "../components/AnswerBox";

export default function Answer({ useAsk }) {
  const [showHistory, setShowHistory] = useState(true);

  return (
    <Panel>

      {/* Collapsible History Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">History</h2>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 transition text-sm"
        >
          {showHistory ? "Hide" : "Show"}
        </button>
      </div>

      {/* Collapsible History Content */}
      {showHistory && (
        <div className="max-h-48 overflow-y-auto bg-black/20 p-3 rounded-xl mb-4 border border-white/10">
          {useAsk.history.length === 0 ? (
            <p className="text-white/50">No history yet.</p>
          ) : (
            useAsk.history.map((item, index) => (
              <div key={index} className="mb-3 pb-3 border-b border-white/10">
                <p className="font-medium text-white">Q: {item.q}</p>
                <p className="text-white/80 mt-1">A: {item.a}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Answer Section */}
      <div className="flex-1 min-h-0">
        <AnswerBox answer={useAsk.answer} />
      </div>

    </Panel>
  );
}
