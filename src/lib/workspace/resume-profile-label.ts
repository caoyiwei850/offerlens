const GENERIC_TITLES = new Set(["基础简历", "导入的基础简历"]);

const CITY_NAMES = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "南京",
  "苏州",
  "成都",
  "重庆",
  "天津",
  "武汉",
  "潜江",
  "宜昌",
  "襄阳",
  "荆州",
  "黄石",
  "十堰",
  "孝感",
  "黄冈",
  "咸宁",
  "鄂州",
  "荆门",
  "随州",
  "天门",
  "仙桃",
  "长沙",
  "郑州",
  "西安",
  "合肥",
  "南昌",
  "福州",
  "厦门",
  "青岛",
  "济南",
  "宁波",
  "温州",
  "佛山",
  "东莞",
  "珠海",
  "无锡",
  "常州",
  "南通",
  "大连",
  "沈阳",
  "长春",
  "哈尔滨",
];

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function meaningfulLines(resumeText: string): string[] {
  return resumeText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 40);
}

export function isGenericResumeTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim());
}

export function detectResumeName(resumeText: string): string | null {
  const lines = meaningfulLines(resumeText);
  const labelled = lines
    .map((line) => line.match(/(?:姓名|Name)[:：\s]+([\u4e00-\u9fa5A-Za-z·]{2,20})/i)?.[1])
    .find(Boolean);
  if (labelled) return labelled;

  return (
    lines.find((line) => {
      if (/电话|手机|邮箱|微信|求职|意向|岗位|简历|现居|地址|教育|工作/.test(line)) {
        return false;
      }
      return /^[\u4e00-\u9fa5·]{2,6}$/.test(line) || /^[A-Za-z][A-Za-z\s]{1,24}$/.test(line);
    }) ?? null
  );
}

export function detectResumeLocation(resumeText: string): string | null {
  const lines = meaningfulLines(resumeText);
  const labelled = lines
    .map(
      (line) =>
        line.match(
          /(?:现居地|现居|所在地|所在城市|居住地|工作地点|期望城市|求职地点|城市)[:：\s]*([\u4e00-\u9fa5]{2,8})/,
        )?.[1],
    )
    .find(Boolean);
  if (labelled) {
    const city = CITY_NAMES.find((name) => labelled.includes(name));
    return city ?? labelled.slice(0, 8);
  }

  return CITY_NAMES.find((city) => resumeText.includes(city)) ?? null;
}

export function detectResumeTarget(resumeText: string): string | null {
  const lines = meaningfulLines(resumeText);
  const labelled = lines.find((item) =>
    /(?:求职意向|应聘岗位|目标岗位|意向岗位)[:：]/.test(item),
  );
  if (labelled) {
    return (
      labelled
        .replace(/.*(?:求职意向|应聘岗位|目标岗位|意向岗位)[:：]\s*/, "")
        .split(/[|｜,，]/)[0]
        ?.trim()
        .slice(0, 18) || null
    );
  }

  const headingIndex = lines.findIndex((item) =>
    /^(?:求职意向|应聘岗位|目标岗位|意向岗位)$/.test(item),
  );
  const nextLine = headingIndex >= 0 ? lines[headingIndex + 1] : "";
  return nextLine?.split(/[|｜,，]/)[0]?.trim().slice(0, 18) || null;
}

export function buildResumeProfileTitle({
  storedTitle,
  resumeText,
  occupationName,
  createdAt,
}: {
  storedTitle?: string | null;
  resumeText: string;
  occupationName?: string | null;
  createdAt?: string | null;
}): string {
  const title = storedTitle?.trim();
  if (title && !isGenericResumeTitle(title)) return title;

  const parts = [
    detectResumeName(resumeText),
    occupationName?.trim() || detectResumeTarget(resumeText),
    detectResumeLocation(resumeText),
  ].filter((part): part is string => Boolean(part));

  if (parts.length) return parts.slice(0, 3).join(" · ");

  if (createdAt) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      return `基础简历 · ${date.toLocaleDateString("zh-CN")}`;
    }
  }

  return "基础简历";
}

export function canonicalizeResumeForSimilarity(resumeText: string): string {
  let normalized = resumeText.toLowerCase();
  for (const city of CITY_NAMES) {
    normalized = normalized.replaceAll(city.toLowerCase(), "");
  }
  return normalized.replace(/[\s,，.。:：;；()（）【】\[\]<>《》-]/g, "");
}

export function areResumeProfilesNearDuplicate(first: string, second: string): boolean {
  const a = canonicalizeResumeForSimilarity(first);
  const b = canonicalizeResumeForSimilarity(second);
  if (!a || !b || a === b) return a === b;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength < 40) return false;
  const lengthDelta = Math.abs(a.length - b.length);
  return lengthDelta <= Math.max(12, Math.floor(maxLength * 0.03)) && (a.includes(b) || b.includes(a));
}
