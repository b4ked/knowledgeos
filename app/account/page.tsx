import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AccountClient from "./AccountClient"

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <AccountClient
      email={session.user.email}
      name={session.user.name ?? null}
      plan={(session.user as { plan?: string }).plan ?? "free"}
    />
  )
}
