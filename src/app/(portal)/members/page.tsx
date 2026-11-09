import { connection } from "next/server";
import { getMembersForView } from "./data";
import MembersView from "./MembersView";

export default async function MembersPage() {
  // تایید اتصال برای رندر دینامیک
  await connection();

  // گرفتن داده‌های آماده شده از لایه data
  const members = await getMembersForView();

  return <MembersView initialMembers={members} />;
}
