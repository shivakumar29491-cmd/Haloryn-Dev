import { FiMic } from "react-icons/fi";

export default function VoiceButton() {
  return (
    <button
      className="p-3 bg-white/10 border border-white/20 rounded-xl text-white
       hover:bg-white/20 transition-all"
    >
      <FiMic size={18} />
    </button>
  );
}
