/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import AnswerPage from "../web/src/pages/Answer";
import LivePage from "../web/src/pages/Live";
import LogsPage from "../web/src/pages/Logs";

describe("web pages", () => {
  test("Answer page shows history and answer box", () => {
    const useAsk = { history: [{ q: "Q1", a: "A1" }], answer: "Hello" };
    render(<AnswerPage useAsk={useAsk} />);
    expect(screen.getByText(/Q1/)).toBeInTheDocument();
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  test("Live page renders history and textarea controls", () => {
    const useAsk = {
      history: [{ q: "Q", a: "A" }],
      answer: "Ans",
      ask: jest.fn()
    };
    render(<LivePage useAsk={useAsk} />);
    expect(screen.getByText(/History/i)).toBeInTheDocument();
    expect(screen.getByText(/Ans/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask haloryn/i)).toBeInTheDocument();
  });

  test("Logs page renders log entries", () => {
    const useAsk = { logs: [{ time: "now", question: "Hi", status: "sent" }] };
    render(<LogsPage useAsk={useAsk} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });
});
