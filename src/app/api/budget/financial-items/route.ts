import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  createFinancialItem,
  listFinancialItems,
  type ListFinancialItemsOptions,
} from "@/lib/budget/financial-item-store";
import type {
  FinancialItem,
  FinancialItemInput,
} from "@/lib/budget/financial-item-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const options: ListFinancialItemsOptions = {};
    const status = url.searchParams.get("status");
    if (status) options.status = status as FinancialItem["status"];
    const validationStatus = url.searchParams.get("validationStatus");
    if (validationStatus)
      options.validationStatus = validationStatus as FinancialItem["validationStatus"];
    const kind = url.searchParams.get("kind");
    if (kind) options.kind = kind as FinancialItem["kind"];
    const direction = url.searchParams.get("direction");
    if (direction) options.direction = direction as FinancialItem["direction"];
    const budgetMonth = url.searchParams.get("budgetMonth");
    if (budgetMonth) options.budgetMonth = budgetMonth;
    const budgetYear = url.searchParams.get("budgetYear");
    if (budgetYear) options.budgetYear = budgetYear;
    const correspondentId = url.searchParams.get("correspondentId");
    if (correspondentId) options.correspondentId = Number.parseInt(correspondentId, 10);
    const projectId = url.searchParams.get("projectId");
    if (projectId) options.projectId = projectId;
    const documentId = url.searchParams.get("documentId");
    if (documentId) options.documentId = Number.parseInt(documentId, 10);
    const analysisId = url.searchParams.get("analysisId");
    if (analysisId) options.analysisId = analysisId;
    const limit = url.searchParams.get("limit");
    if (limit) options.limit = Number.parseInt(limit, 10);

    const items = await listFinancialItems(options);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les items financiers", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinancialItemInput;
    const item = await createFinancialItem(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer l'item financier", error);
  }
}
