// src/app/(portal)/queue/page.tsx
import { getQueueData } from "./data";
import QueueView from "./QueueView";

// export const dynamic = "force-dynamic";

interface QueuePageProps {
  searchParams: Promise<{ periodId?: string }>;
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const params = await searchParams;
  const { items, departments, activePeriodId } = await getQueueData(
    params.periodId,
  );

  return (
    <QueueView
      initialItems={items as any}
      departments={departments}
      activePeriodId={activePeriodId}
    />
  );
}
