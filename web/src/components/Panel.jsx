export default function Panel({ children }) {
  return (
    <div className="bg-black/30 backdrop-blur-xl p-4 rounded-2xl border border-white/10 w-full h-full">
      {children}
    </div>
  );
}
