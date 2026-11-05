import { getDb } from "@/lib/db";
import { loadHabits } from "@/lib/habits";
import HabitsApp from "@/components/HabitsApp";

export const dynamic = "force-dynamic";

export default function Page() {
  const data = loadHabits(getDb());
  return (
    <HabitsApp
      initial={data.habits}
      initialToday={data.today}
      initialDays={data.days}
    />
  );
}
