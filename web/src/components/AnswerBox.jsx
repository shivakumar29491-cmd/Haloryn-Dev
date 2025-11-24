export default function AnswerBox({ answer }) {
  return (
    <div
      className="w-full h-full max-h-[70vh] overflow-y-auto bg-black/30 rounded-2xl 
      p-4 border border-white/10 backdrop-blur-xl text-white whitespace-pre-wrap 
      leading-relaxed"
    >
      {answer ? answer : "Ask a question to begin."}
    </div>
  );
}
