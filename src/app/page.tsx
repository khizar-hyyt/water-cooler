import App from "@/components/App";
import { AppStateProvider } from "@/lib/AppStateContext";

export default function Home() {
  return (
    <AppStateProvider>
      <App />
    </AppStateProvider>
  );
}
