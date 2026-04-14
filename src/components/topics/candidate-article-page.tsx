import { SourceAccountScreen } from "./source-account-screen";

type CandidateArticlePageProps = Parameters<typeof SourceAccountScreen>[0];

export function CandidateArticlePage(props: CandidateArticlePageProps) {
  return <SourceAccountScreen {...props} view="articles" />;
}
