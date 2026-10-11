import { AccountsView } from "./AccountsView";

export default async function AccountsPage(props: PageProps<"/accounts">) {
  const q = await props.searchParams;
  return <AccountsView flash={typeof q.msg === "string" ? { platform: String(q.platform ?? ""), msg: q.msg } : undefined} />;
}
