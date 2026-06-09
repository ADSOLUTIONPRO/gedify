import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getInboxGmailAccounts } from "@/lib/messaging/active-gmail-account";
import { fetchAccountThreads } from "@/lib/messaging/load-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    // Filtre « Boîte mail » : "all"/absent → agrège ; id précis → ce compte.
    const { aggregate, accounts } = await getInboxGmailAccounts(url.searchParams.get("accountId"));
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Gmail connecté." },
        { status: 412 },
      );
    }

    const query = url.searchParams.get("q") ?? "in:inbox";
    const maxResults = Math.min(
      Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30,
      100,
    );
    const pageToken = url.searchParams.get("pageToken") ?? undefined;

    // Mono-compte (compte précis sélectionné) → pagination par curseur conservée.
    if (!aggregate && accounts.length === 1) {
      const account = accounts[0];
      const { threads, nextPageToken } = await fetchAccountThreads(account, query, maxResults, pageToken);
      return NextResponse.json({ accountId: account.accountId, accountEmail: account.email, threads, nextPageToken });
    }

    // « Toutes les boîtes » → agrège tous les comptes (échec d'un compte ignoré),
    // fusion + tri par date, borne globale. Pas de pagination fusionnée.
    const perAccount = await Promise.all(
      accounts.map((account) => fetchAccountThreads(account, query, maxResults).catch(() => ({ threads: [], nextPageToken: null }))),
    );
    const threads = perAccount
      .flatMap((p) => p.threads)
      .sort((a, b) => {
        const da = a.lastMessageAt ?? "";
        const db = b.lastMessageAt ?? "";
        return da < db ? 1 : da > db ? -1 : 0;
      })
      .slice(0, maxResults);

    return NextResponse.json({
      accountId: "all",
      accountEmail: `Toutes les boîtes (${accounts.length})`,
      threads,
      nextPageToken: null,
    });
  } catch (error) {
    return jsonError("Lecture des threads Gmail impossible", error);
  }
}
