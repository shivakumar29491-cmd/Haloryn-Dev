/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from "@testing-library/react";

jest.mock("../web/src/context/SettingsContext", () => ({
  useSettings: () => ({
    model: "groq",
    setModel: jest.fn()
  })
}));

import AnswerBox from "../web/src/components/AnswerBox";
import Logbox from "../web/src/components/Logbox";
import ModelSelector from "../web/src/components/ModelSelector";
import HistoryPanel from "../web/src/components/HistoryPanel";
import TextArea from "../web/src/components/TextArea";

describe("renderer/web components", () => {
  test("AnswerBox shows fallback when empty", () => {
    render(<AnswerBox answer="" />);
    expect(screen.getByText(/ask a question/i)).toBeInTheDocument();
  });

  test("Logbox renders logs with status", () => {
    const logs = [
      { time: "10:00", question: "Hi?", status: "sent" },
      { time: "10:01", question: "Answer", status: "received" }
    ];
    render(<Logbox logs={logs} />);
    expect(screen.getByText("Hi?")).toBeInTheDocument();
    expect(screen.getByText("received")).toBeInTheDocument();
  });

  test("ModelSelector triggers setModel for selected option", () => {
    const setModel = jest.fn();
    jest.resetModules();
    jest.doMock("../web/src/context/SettingsContext", () => ({
      useSettings: () => ({ model: "groq", setModel })
    }));

    const DynamicSelector = require("../web/src/components/ModelSelector").default;
    render(<DynamicSelector />);
    const braveBtn = screen.getByRole("button", { name: "brave" });
    fireEvent.click(braveBtn);
    expect(setModel).toHaveBeenCalledWith("brave");
  });

  test("HistoryPanel shows empty message", () => {
    render(<HistoryPanel history={[]} />);
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });

  test("TextArea calls ask and clears input", async () => {
    const ask = jest.fn().mockResolvedValue();
    const useAsk = { ask };
    render(<TextArea useAsk={useAsk} />);
    const textarea = screen.getByPlaceholderText(/ask haloryn/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(ask).toHaveBeenCalledWith("Hello");
    expect(textarea.value).toBe("");
  });
});
