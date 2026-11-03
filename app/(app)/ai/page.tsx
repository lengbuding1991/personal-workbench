import Link from "next/link";
import { aiReady } from "@/lib/ai";
import AiApp from "@/components/AiApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const ready = aiReady();
  return <AiApp aiReady={ready} settingsHref="/settings" reviewHref="/review" />;
}
