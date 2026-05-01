import { AcceptInviteClient } from "./accept-invite-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
}

export default function AcceptInvitePage({ params }: PageProps) {
  return <AcceptInviteClient token={params.token} />;
}
