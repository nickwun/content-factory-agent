import { ContentAgentHome } from "@/components/home/content-agent-home";
import { listPromptPresetGroups } from "@/lib/settings/prompt-settings-server";

type HomePageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const rawView = resolvedSearchParams.view;
  const initialRequestedHomeScreenMode =
    typeof rawView === "string" ? rawView : rawView?.[0];

  return (
    <ContentAgentHome
      initialPromptPresetGroups={listPromptPresetGroups()}
      initialRequestedHomeScreenMode={initialRequestedHomeScreenMode}
    />
  );
}
