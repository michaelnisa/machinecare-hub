-- Bug: invite links always showed "This invite link is no longer valid",
-- even for a freshly-created, unexpired invite.
--
-- AcceptInvite.tsx queries org_invites by token to preview it *before* the
-- invitee has an account, i.e. as the `anon` role. But org_invites only has
-- two SELECT policies, both TO authenticated: "invites manage by managers"
-- (org managers) and "invites read by recipient" (a signed-in user whose
-- JWT email matches). A brand-new invitee visiting the link while signed
-- out satisfies neither, so the query returns zero rows and the page
-- reports the invite as invalid regardless of its actual status.
--
-- Fix: expose just the preview fields through a SECURITY DEFINER function
-- keyed by the (unguessable, 24-byte random) token, so anon can resolve a
-- single invite without a broader SELECT grant on the table.

CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS TABLE (
  organisation_name text,
  email text,
  role text,
  expired boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.name, i.email, i.role::text, (i.expires_at < now() OR i.status <> 'pending')
  FROM public.org_invites i
  JOIN public.organisations o ON o.id = i.organisation_id
  WHERE i.token = _token
$$;

REVOKE EXECUTE ON FUNCTION public.get_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;
