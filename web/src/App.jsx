import { useState } from "react";
import useAsk from "./hooks/useAsk.js";

import Tabs from "./components/Tabs";
import ModelSelector from "./components/ModelSelector";

import Live from "./pages/Live";
import Answer from "./pages/Answer";
import Logs from "./pages/Logs";

import "./App.css";

export default function App() {
  const [active, setActive] = useState("Live");

  const askHook = useAsk();

  const renderPage = () => {
    if (active === "Live") return <Live useAsk={askHook} />;
    if (active === "Answer") return <Answer useAsk={askHook} />;
    if (active === "Logs") return <Logs useAsk={askHook} />;
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-black via-[#0a0f1f] to-black text-white overflow-hidden p-6">

      {/* Model Selector */}
      <ModelSelector />

      {/* Tabs */}
      <Tabs active={active} setActive={setActive} />

      {/* Page Container */}
      <div className="w-full h-[85%] mt-4">
        {renderPage()}
      </div>
    </div>
  );
}
