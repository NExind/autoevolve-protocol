import { createShowcaseRun } from "@autoevolve/core";
import { AutoEvolveDashboard } from "../components/AutoEvolveDashboard";

export default function HomePage() {
  return <AutoEvolveDashboard initialRun={createShowcaseRun()} />;
}
