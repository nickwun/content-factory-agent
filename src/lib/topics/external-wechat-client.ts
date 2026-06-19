type ExternalWechatClientSearchPayload = {
  mode: 1;
  keyword: string;
  search_type: 1;
  publish_time_type: 0 | 1 | 2 | 3;
  sort_type: 2;
  currentPage: 1;
  offset: 0;
  cookies_buffer: "";
  key: string;
  verifycode: string;
};

type ExternalWechatClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export function createExternalWechatClient(
  options: ExternalWechatClientOptions = {},
) {
  const baseUrl = options.baseUrl ?? "https://www.dajiala.com";
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async searchArticles(payload: ExternalWechatClientSearchPayload) {
      const response = await fetchImpl(`${baseUrl}/fbmain/monitor/v3/web_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        const message =
          resolveUpstreamErrorMessage(data) ??
          `External wechat search request failed with status ${response.status}`;
        throw new Error(message);
      }

      return data;
    },

    async fetchArticleDetail(payload: {
      url: string;
      key: string;
      verifycode: string;
      mode: 2;
    }) {
      const searchParams = new URLSearchParams({
        url: payload.url,
        key: payload.key,
        mode: String(payload.mode),
        verifycode: payload.verifycode,
      });
      const response = await fetchImpl(
        `${baseUrl}/fbmain/monitor/v3/article_detail?${searchParams.toString()}`,
      );

      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        const message =
          resolveUpstreamErrorMessage(data) ??
          `External wechat article detail request failed with status ${response.status}`;
        throw new Error(message);
      }

      return data;
    },
  };
}

function resolveUpstreamErrorMessage(payload: Record<string, unknown>) {
  if (typeof payload.msg === "string" && payload.msg.trim()) {
    return payload.msg.trim();
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message.trim();
  }

  return null;
}
