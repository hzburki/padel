import { Screen } from "./screen";

const PAGES = {
  privacy: {
    title: "Privacy policy",
    lead: "It's a short one. This is a vibe-coded app made for fun.",
    points: [
      "Your games live on this phone and nowhere else, until you broadcast one. There's no account and no tracking.",
      "Broadcasting a game stores a copy of it, its names and scores, in an online database, so friends with the link can follow it. By tapping Broadcast you agree to that.",
      "Nobody sees your scores unless you share the picture or broadcast the game yourself.",
      "If you clear your browser data, the games on this phone go with it. That's the whole policy.",
    ],
  },
  terms: {
    title: "Terms & conditions",
    lead: "There aren't any. This is an offline, vibe-coded app made for fun.",
    points: [
      "Use it to run padel games with friends. That's it.",
      "It comes with no promises. If the schedule pairs you with your worst partner twice, that's padel.",
      "Arguments about who won are settled on court, not here.",
      "The developer isn't responsible for wrong or mismatched scores, or for anyone's wins or losses caused by errors or bugs in the app.",
    ],
  },
} as const;

// A tongue-in-cheek page in place of the usual legal text.
export function LegalScreen({ page }: { page: keyof typeof PAGES }) {
  const { title, lead, points } = PAGES[page];
  return (
    <Screen title={title}>
      <p className="mt-3 text-2xl type-display">{lead}</p>
      <ul className="mt-5 space-y-3 text-muted-foreground">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Screen>
  );
}
