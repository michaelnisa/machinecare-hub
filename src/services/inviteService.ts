import { supabase } from "@/integrations/supabase/client";

export interface InvitePreviewData {
  organisation_name: string;
  email: string;
  role: string;
  department?: string;
  expired: boolean;
}

export interface AcceptInviteResult {
  success: boolean;
  organisation_id: string;
  organisation_name: string;
  role: string;
  department?: string;
}

export async function getInvitePreview(token: string): Promise<{ data: InvitePreviewData | null; error: any }> {
  try {
    const { data, error } = await (supabase as any)
      .rpc("get_invite_preview", { _token: token })
      .maybeSingle();

    if (error || !data) {
      return { data: null, error: error || new Error("Invite not found") };
    }

    return {
      data: {
        organisation_name: data.organisation_name ?? "an organisation",
        email: data.email,
        role: data.role,
        expired: Boolean(data.expired),
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function acceptOrgInvite(token: string): Promise<AcceptInviteResult> {
  // Strategy 1: Call Postgres SECURITY DEFINER RPC
  try {
    const { data: rpcData, error: rpcError } = await (supabase as any)
      .rpc("accept_org_invite", { _token: token });

    if (!rpcError && rpcData?.success) {
      return rpcData as AcceptInviteResult;
    }
    if (rpcError && !rpcError.message?.includes("function") && !rpcError.message?.includes("not found")) {
      // Known logic exception from RPC (e.g. email mismatch or expired)
      throw new Error(rpcError.message);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes("function") && !err.message.includes("not found")) {
      throw err;
    }
  }

  // Strategy 2: Call Edge Function accept-invite
  const { data: fnData, error: fnError } = await supabase.functions.invoke("accept-invite", {
    body: { token },
  });

  if (fnError) {
    throw new Error(fnError.message || "Failed to accept invite via server function");
  }

  if (fnData?.error) {
    throw new Error(fnData.error);
  }

  if (fnData?.success) {
    return fnData as AcceptInviteResult;
  }

  throw new Error("Unable to accept invite. Please try again or ask your manager for a new link.");
}
