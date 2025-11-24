import Panel from "../components/Panel";
import TextArea from "../components/TextArea";
import AnswerBox from "../components/AnswerBox";
import HistoryPanel from "../components/HistoryPanel";
import { useSettings } from "../context/SettingsContext";

export default function Live({ useAsk }) {
  const { history, answer } = useAsk;

  return (
    <div className="w-full h-full flex gap-4">

      {/* Left Sidebar (History) */}
      <div className="w-1/4 h-full">
        <HistoryPanel history={useAsk.history} />
      </div>

      {/* Main Panel */}
      <div className="flex-1 h-full flex flex-col gap-4">

        <Panel>
          <AnswerBox answer={answer} />
        </Panel>

        <TextArea useAsk={useAsk} />
      </div>
    </div>
  );
}
