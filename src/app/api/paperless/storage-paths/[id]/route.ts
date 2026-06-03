import type { NextRequest } from "next/server";
import {
  proxyDetailGet,
  proxyDetailMutation,
} from "@/lib/paperless-route-handlers";

const endpoint = "/api/storage_paths/";
const label = "le chemin de stockage Gedify";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return proxyDetailGet(request, endpoint, context, { label });
}

export async function PATCH(request: NextRequest, context: Context) {
  return proxyDetailMutation(request, endpoint, context, "PATCH", { label });
}

export async function PUT(request: NextRequest, context: Context) {
  return proxyDetailMutation(request, endpoint, context, "PUT", { label });
}

export async function DELETE(request: NextRequest, context: Context) {
  return proxyDetailMutation(request, endpoint, context, "DELETE", { label });
}
