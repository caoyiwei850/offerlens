import type { EvidenceAssessment } from "@/lib/analysis/evidence";

export const evaluationContext = {
  candidate_type: "EXPERIENCED" as const,
  job_track: "EXPERIENCED" as const,
  occupation_family: "BUSINESS_COMMERCIAL" as const,
  occupation_name: "市场运营专员",
  occupation_source: "AUTO" as const,
  basis: "简历包含连续全职经历，岗位描述明确要求三年以上相关经验。",
};

export const evidenceAssessment: EvidenceAssessment = {
  summary: "专业方向基本相关，但策略规划和项目结果证据需要加强。",
  dimensions: {
    keywordMatch: {
      level: "SUFFICIENT",
      reason: "简历在项目上下文中使用了市场调研、用户增长等岗位描述核心关键词。",
      suggestion: "补充品牌策略和渠道管理相关能力证据。",
    },
    basicQualification: {
      level: "SUFFICIENT",
      reason: "基础条件匹配。",
      suggestion: "明确工作年限和职责范围。",
    },
    competencyFit: {
      level: "WEAK",
      reason: "核心专业能力相关，但策略规划深度证据偏弱。",
      suggestion: "补充策略方法和专业取舍。",
    },
    experienceEvidence: {
      level: "WEAK",
      reason: "项目证据缺少可验证结果。",
      suggestion: "补充规模、职责和业务结果。",
    },
    interviewReadiness: {
      level: "WEAK",
      reason: "面试表达素材有限。",
      suggestion: "准备结构化项目复盘案例。",
    },
  },
};
