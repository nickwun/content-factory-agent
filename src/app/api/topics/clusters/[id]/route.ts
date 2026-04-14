import { NextRequest, NextResponse } from "next/server.js";

import { rejectTopicCluster } from "../../../../../lib/topics/topic-cluster-server.ts";

type UpdateTopicClusterBody = {
  status?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as UpdateTopicClusterBody;

  if (body.status !== "rejected") {
    return NextResponse.json({ error: "unsupported status" }, { status: 400 });
  }

  const topicCluster = rejectTopicCluster(id);

  if (!topicCluster) {
    return NextResponse.json(
      {
        error: {
          code: "topic_cluster_not_found",
          message: "当前主题簇不存在。",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ topicCluster });
}
