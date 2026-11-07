import { getQueueData } from "./data";
import QueueView from "./QueueView";

export default async function QueuePage() {
  const { items, departments } = await getQueueData();

  return <QueueView initialItems={items} departments={departments} />;
}
