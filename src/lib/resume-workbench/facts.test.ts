import { describe, expect, it } from "vitest";

import {
  appendEvidenceAnswerFacts,
  buildSourceFacts,
  validateBulletFactReferences,
} from "./facts";

describe("resume fact ledger", () => {
  it("turns meaningful source lines into stable facts", () => {
    const facts = buildSourceFacts(
      "张三\n\n负责交易系统限流改造\n峰值处理能力提升 40%",
    );

    expect(facts).toEqual([
      { id: "source-001", text: "张三", source: "RESUME" },
      {
        id: "source-002",
        text: "负责交易系统限流改造",
        source: "RESUME",
      },
      {
        id: "source-003",
        text: "峰值处理能力提升 40%",
        source: "RESUME",
      },
    ]);
  });

  it("rejects generated bullets without valid fact references", () => {
    const facts = buildSourceFacts("负责交易系统限流改造");

    expect(() =>
      validateBulletFactReferences(
        [
          {
            id: "bullet-1",
            text: "主导交易系统限流改造。",
            factRefs: [],
            status: "AI_REWRITE",
          },
        ],
        facts,
      ),
    ).toThrow("FACT_REF_MISSING:bullet-1");

    expect(() =>
      validateBulletFactReferences(
        [
          {
            id: "bullet-1",
            text: "主导交易系统限流改造。",
            factRefs: ["invented-fact"],
            status: "AI_REWRITE",
          },
        ],
        facts,
      ),
    ).toThrow("FACT_REF_UNKNOWN:bullet-1");
  });

  it("only turns user-confirmed experience into facts", () => {
    const facts = buildSourceFacts("张三");

    expect(
      appendEvidenceAnswerFacts(facts, [
        {
          questionId: "question-1",
          status: "HAS_EVIDENCE",
          detail: "在学生会迎新活动中担任项目负责人，协调 8 名志愿者完成现场分工，活动按时完成。",
        },
        {
          questionId: "question-2",
          status: "NO_EVIDENCE",
        },
        {
          questionId: "question-3",
          status: "UNSURE",
        },
      ]),
    ).toEqual([
      ...facts,
      {
        id: "answer-question-1",
        text: "在学生会迎新活动中担任项目负责人，协调 8 名志愿者完成现场分工，活动按时完成。",
        source: "ANSWER",
      },
    ]);
  });
});
