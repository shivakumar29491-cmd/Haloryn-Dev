import Panel from "../components/Panel";
import Logbox from "../components/Logbox";

export default function Logs({ useAsk }) {
  return (
    <Panel>
      <Logbox logs={useAsk.logs} />
    </Panel>
  );
}
