import { SourceAccountScreen } from "./source-account-screen";

type TopicOverviewScreenProps = Parameters<typeof SourceAccountScreen>[0];

export function TopicOverviewScreen(props: TopicOverviewScreenProps) {
  return <SourceAccountScreen {...props} view="overview" />;
}
