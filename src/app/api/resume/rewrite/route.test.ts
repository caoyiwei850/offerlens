// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createResumeRewriteHandler } from "./route";
import type { ResumeAccessStore } from "@/lib/resume-workbench/access";
import {
  resumeDraft,
  resumePlanFixture,
} from "@/test/resume-fixtures";
import type { EvidenceAnswer } from "@/lib/resume-workbench/types";

const deviceId = "a".repeat(64);
const fingerprint = "b".repeat(64);

function accessStore(accepted = true): ResumeAccessStore {
  return {
    evaluatePlan: vi.fn(async () => [0, 0] as [number, number]),
    saveToken: vi.fn(async () => undefined),
    consumeToken: vi.fn(async () => accepted),
  };
}

function request(
  answers: EvidenceAnswer[],
  overrides: Record<string, unknown> = {},
) {
  return new Request("http://localhost/api/resume/rewrite", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `offerlens_device_id=${deviceId}`,
    },
    body: JSON.stringify({
      draft: resumePlanFixture.draft,
      facts: resumePlanFixture.facts,
      questions: resumePlanFixture.questions,
      issues: resumePlanFixture.issues,
      answers,
      factsConfirmed: true,
      template: "PROFESSIONAL",
      rewriteToken: resumePlanFixture.rewriteToken,
      deviceId,
      fingerprint,
      ...overrides,
    }),
  });
}

describe("POST /api/resume/rewrite", () => {
  it("requires answers before consuming the token", async () => {
    const store = accessStore();
    const callModel = vi.fn();
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel,
    });

    const response = await handler(request([]));
    expect(response.status).toBe(400);
    expect(store.consumeToken).not.toHaveBeenCalled();
    expect(callModel).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: {
        code: "MISSING_ANSWERS",
        message: "还有必填信息没有补充",
      },
    });
  });

  it("consumes the token and returns a fact-backed rewrite once", async () => {
    const rewrittenDraft = {
      ...resumeDraft,
      experiences: [
        {
          ...resumeDraft.experiences[0],
          bullets: [
            {
              ...resumeDraft.experiences[0].bullets[0],
              text: "主导交易系统限流改造，提升高峰期稳定性。",
              factRefs: ["source-002", "answer-question-1"],
              status: "AI_REWRITE",
            },
          ],
        },
      ],
    };
    const store = accessStore();
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: rewrittenDraft,
        changeSummary: ["强化动作与结果表达。"],
        unresolvedIssues: [],
      }),
    );
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel,
    });

    const response = await handler(
      request([
        {
          questionId: "question-1",
          status: "HAS_EVIDENCE",
          detail:
            "交易系统限流改造，我负责梳理核心链路并完善降级策略，高峰期稳定性提升。",
        },
      ]),
    );
    expect(response.status).toBe(200);
    expect(store.consumeToken).toHaveBeenCalledOnce();
    expect(callModel).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "answer-question-1", source: "ANSWER" }),
      ]),
    );
    expect(body.unresolvedIssues).toEqual([]);
  });

  it("does not turn recall hints or no-evidence choices into facts", async () => {
    const store = accessStore();
    const callModel = vi.fn(async () =>
      JSON.stringify({
        draft: resumeDraft,
        changeSummary: ["保留已有事实。"],
        unresolvedIssues: [],
      }),
    );
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel,
    });

    const response = await handler(
      request([
        {
          questionId: "question-1",
          status: "NO_EVIDENCE",
        },
      ]),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.facts.some((fact: { id: string }) =>
        fact.id.startsWith("answer-"),
      ),
    ).toBe(false);
  });

  it("returns a precise error before token consumption for invalid input", async () => {
    const store = accessStore();
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel: vi.fn(),
    });

    const response = await handler(
      request(
        [
          {
            questionId: "question-1",
            status: "HAS_EVIDENCE",
            detail: "字".repeat(1001),
          },
        ],
        { factsConfirmed: true },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "ANSWER_TOO_LONG",
        message: "单项补充内容不能超过允许长度",
      },
    });
    expect(store.consumeToken).not.toHaveBeenCalled();
  });

  it("requires the final truth confirmation before token consumption", async () => {
    const store = accessStore();
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel: vi.fn(),
    });
    const response = await handler(
      request(
        [{ questionId: "question-1", status: "NO_EVIDENCE" }],
        { factsConfirmed: false },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "FACTS_NOT_CONFIRMED",
        message: "请确认补充内容来自真实经历",
      },
    });
    expect(store.consumeToken).not.toHaveBeenCalled();
  });

  it("does not treat no-evidence as resolving a timeline contradiction", async () => {
    const store = accessStore();
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel: vi.fn(),
    });
    const directQuestion = {
      ...resumePlanFixture.questions[0],
      answerMode: "DIRECT_CONFIRMATION" as const,
      issueIds: ["issue-timeline"],
    };
    const response = await handler(
      request(
        [{ questionId: directQuestion.id, status: "NO_EVIDENCE" }],
        {
          questions: [directQuestion],
          issues: [
            {
              id: "issue-timeline",
              code: "TIMELINE_CONFLICT",
              severity: "BLOCKING",
              message: "教育与经历时间冲突。",
              relatedPaths: ["education", "experiences"],
              questionId: directQuestion.id,
              resolved: false,
            },
          ],
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "MISSING_ANSWERS",
        message: "还有必填信息没有补充",
      },
    });
    expect(store.consumeToken).not.toHaveBeenCalled();
  });

  it("classifies a legacy or incomplete payload as a stale workbench", async () => {
    const store = accessStore();
    const handler = createResumeRewriteHandler({
      accessStore: store,
      callModel: vi.fn(),
    });
    const response = await handler(
      new Request("http://localhost/api/resume/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "STALE_WORKBENCH",
        message: "当前改写会话已失效，请重新生成核对清单",
      },
    });
    expect(store.consumeToken).not.toHaveBeenCalled();
  });
});
