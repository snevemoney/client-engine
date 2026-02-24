import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReviewsList } from "@/components/dashboard/reviews/ReviewsList";
import { IntakeWeeklyStats } from "@/components/dashboard/reviews/IntakeWeeklyStats";
import { FollowupWeeklyStats } from "@/components/dashboard/reviews/FollowupWeeklyStats";
import { ProposalWeeklyStats } from "@/components/dashboard/reviews/ProposalWeeklyStats";
import { DeliveryWeeklyStats } from "@/components/dashboard/reviews/DeliveryWeeklyStats";
import { DeliveryProofWeeklyStats } from "@/components/dashboard/reviews/DeliveryProofWeeklyStats";
import { PipelineHygieneWeeklyStats } from "@/components/dashboard/reviews/PipelineHygieneWeeklyStats";
import { ProofGapWeeklyStats } from "@/components/dashboard/reviews/ProofGapWeeklyStats";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly reviews</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Track end-of-week reviews. Complete reviews to capture what worked, what failed, and next commitments.
        </p>
      </div>
      <IntakeWeeklyStats />
      <FollowupWeeklyStats />
      <ProposalWeeklyStats />
      <DeliveryWeeklyStats />
      <PipelineHygieneWeeklyStats />
      <DeliveryProofWeeklyStats />
      <ProofGapWeeklyStats />
      <ReviewsList />
    </div>
  );
}
