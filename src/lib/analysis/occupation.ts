import { z } from "zod";

export const OCCUPATION_FAMILIES = [
  "TECH_DIGITAL",
  "BUSINESS_COMMERCIAL",
  "CORPORATE_PROFESSIONAL",
  "CREATIVE_MEDIA",
  "EDUCATION_RESEARCH",
  "HEALTHCARE_CARE",
  "ENGINEERING_INDUSTRIAL",
  "CONSTRUCTION_LOGISTICS",
  "SERVICE_RETAIL",
  "PUBLIC_NONPROFIT",
  "OTHER",
] as const;

export const occupationFamilySchema = z.enum(OCCUPATION_FAMILIES);
export type OccupationFamily = z.infer<typeof occupationFamilySchema>;

export const OCCUPATION_FAMILY_LABELS: Record<OccupationFamily, string> = {
  TECH_DIGITAL: "技术与数字化",
  BUSINESS_COMMERCIAL: "市场销售与商业运营",
  CORPORATE_PROFESSIONAL: "财务法务人力与行政",
  CREATIVE_MEDIA: "设计创意与传媒",
  EDUCATION_RESEARCH: "教育培训与科研",
  HEALTHCARE_CARE: "医疗健康与照护",
  ENGINEERING_INDUSTRIAL: "工程制造与技术工种",
  CONSTRUCTION_LOGISTICS: "建筑施工与物流交通",
  SERVICE_RETAIL: "餐饮酒店零售与生活服务",
  PUBLIC_NONPROFIT: "公共服务与社会组织",
  OTHER: "其他职业",
};

export const OCCUPATION_OPTIONS = OCCUPATION_FAMILIES.map((value) => ({
  value,
  label: OCCUPATION_FAMILY_LABELS[value],
}));
