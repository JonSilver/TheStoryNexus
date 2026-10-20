import { attemptPromise } from "@jfdi/attempt";
import { Check } from "lucide-react";
import {
    useTranspositionOpMutation,
    useTranspositionQuery
} from "@/features/transpositions/hooks/useTranspositionQuery";
import { EmptyState, ScreenHeader } from "../components/ScreenParts";
import { useCurrentStory } from "../hooks/useCurrentStory";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";
import { BibleStep } from "./BibleStep";
import { DraftLayer } from "./DraftLayer";
import { STAGES, type Stage, type Transposition, type TranspositionOp } from "./state";
import { useDraftLayer } from "./useDraftLayer";

const STEP_LABELS: Record<Exclude<Stage, "done">, string> = {
    brief: "Brief",
    synopsis: "Synopsis",
    bible: "Bible",
    chapters: "Chapters"
};

const Steps = ({ stage }: { stage: Stage }) => (
    <ol className="flex gap-3 border-b px-4 py-2 text-xs" aria-label="Steps">
        {(Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>).map(step => {
            const done = STAGES.indexOf(step) < STAGES.indexOf(stage);
            return (
                <li
                    key={step}
                    aria-current={step === stage ? "step" : undefined}
                    className={`flex items-center gap-1 ${step === stage ? "font-semibold" : "text-muted-foreground"}`}
                >
                    {done && <Check className="h-3 w-3" aria-label="done" />}
                    {STEP_LABELS[step]}
                </li>
            );
        })}
    </ol>
);

/** Records a draft or decision; resolves whether the server took it (failures are reported by the mutation). */
const useRecord = (storyId: string) => {
    const apply = useTranspositionOpMutation(storyId);
    const record = async (op: TranspositionOp) => !(await attemptPromise(() => apply.mutateAsync(op)))[0];
    return { record, apply };
};

const BriefStep = ({ transposition }: { transposition: Transposition }) => {
    const { record, apply } = useRecord(transposition.storyId);
    const layer = useDraftLayer({
        storyId: transposition.storyId,
        action: { id: "transpose_brief", label: "the brief" },
        saved: transposition.state.briefAttempts,
        record: text => record({ op: "addBriefAttempt", text })
    });
    return (
        <DraftLayer
            layer={layer}
            explainer={`The brief maps the story onto ${transposition.target}: what each place, institution and custom becomes, and the social pressures that will do the work the originals did. Edit it until it's right — every later step follows it.`}
            draftLabel="Draft the brief"
            acceptLabel="Accept the brief"
            accepting={apply.isPending}
            onAccept={brief => apply.mutate({ op: "acceptBrief", brief })}
        />
    );
};

const SynopsisStep = ({ transposition }: { transposition: Transposition }) => {
    const { record, apply } = useRecord(transposition.storyId);
    const layer = useDraftLayer({
        storyId: transposition.storyId,
        action: { id: "transpose_synopsis", label: "the synopsis" },
        saved: transposition.state.synopsis.attempts,
        record: text => record({ op: "addSynopsisAttempt", text })
    });
    const keepIt = (
        <button
            type="button"
            disabled={apply.isPending}
            onClick={() => apply.mutate({ op: "acceptSynopsis", synopsis: null })}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
            {transposition.state.synopsis.original ? "Keep the synopsis as it is" : "Go on to the bible"}
        </button>
    );
    if (!transposition.state.synopsis.original)
        return (
            <section className="space-y-3 px-4 py-4 text-sm">
                <p className="text-muted-foreground">
                    This story has no synopsis, so there's nothing to transpose here.
                </p>
                {keepIt}
            </section>
        );
    return (
        <DraftLayer
            layer={layer}
            explainer="The synopsis, rewritten against the brief. Accepting it replaces this copy's synopsis."
            draftLabel="Transpose the synopsis"
            acceptLabel="Accept the synopsis"
            accepting={apply.isPending}
            onAccept={synopsis => apply.mutate({ op: "acceptSynopsis", synopsis })}
            extra={keepIt}
        />
    );
};

const ChaptersStep = () => (
    <section className="px-4 py-4 text-sm text-muted-foreground">
        The brief, synopsis and bible are settled. The chapters come next.
    </section>
);

const STEPS: Record<Stage, (props: { transposition: Transposition }) => React.ReactNode> = {
    brief: BriefStep,
    synopsis: SynopsisStep,
    bible: BibleStep,
    chapters: ChaptersStep,
    done: ChaptersStep
};

/**
 * A transposition (#77), layer by layer, top down: the brief, then the
 * synopsis, then the bible, then the chapters. Each layer is settled before
 * the next is drafted; every draft is kept, and the writer can leave and
 * come back to where they were.
 */
export const TransposeScreen = () => {
    const { goBack } = useNav();
    const storyId = useCurrentStoryId();
    const story = useCurrentStory();
    const { data: transposition, isLoading, isError, refetch } = useTranspositionQuery(storyId);

    const body = (() => {
        if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
        if (isError)
            return (
                <EmptyState
                    message="Couldn't load the transposition."
                    actionLabel="Try again"
                    onAction={() => void refetch()}
                />
            );
        if (!transposition)
            return (
                <EmptyState
                    message="This story isn't being transposed. Start from Transpose story… on the story you want to move — it works on a copy."
                    actionLabel="Back to the story"
                    onAction={() => goBack("story")}
                />
            );
        const Step = STEPS[transposition.stage];
        return (
            <>
                <p className="px-4 pt-3 text-sm">
                    Moving this copy to <span className="font-medium">{transposition.target}</span>. The original is
                    untouched.
                </p>
                <Steps stage={transposition.stage} />
                <Step key={transposition.stage} transposition={transposition} />
            </>
        );
    })();

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Transpose" story={story?.title} onBack={() => goBack("story")} />
            <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        </div>
    );
};
