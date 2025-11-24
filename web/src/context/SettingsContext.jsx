// @ts-nocheck

import { createContext, useContext, useState } from "react";

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [model, setModel] = useState("groq"); // default

  return (
    <SettingsContext.Provider value={{ model, setModel }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
