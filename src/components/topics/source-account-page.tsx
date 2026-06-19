import { SourceAccountScreen } from "./source-account-screen";

type SourceAccountPageProps = Parameters<typeof SourceAccountScreen>[0];

export function SourceAccountPage(props: SourceAccountPageProps) {
  return <SourceAccountScreen {...props} view="sources" />;
}
