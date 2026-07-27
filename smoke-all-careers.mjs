import { createHash } from "node:crypto";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const realIp = process.env.X_REAL_IP ?? "198.51.100.60";

const stages = [
  "材料初筛",
  "硬性条件核验",
  "岗位能力匹配",
  "经历证据评估",
  "面试决策",
];
const dimensions = [
  "keywordMatch",
  "basicQualification",
  "competencyFit",
  "experienceEvidence",
  "interviewReadiness",
];

const samples = [
  {
    name: "程序员",
    expected: "TECH_DIGITAL",
    resume:
      "李明，本科，4年Java开发经验。负责订单系统接口开发、Redis缓存优化和线上故障排查。",
    jd: "Java开发工程师，要求Spring Boot、MySQL、Redis及线上系统排障经验。",
  },
  {
    name: "销售",
    expected: "BUSINESS_COMMERCIAL",
    resume:
      "王芳，3年企业客户销售经验，负责客户拜访、需求沟通、方案报价和合同跟进，完成年度销售目标。",
    jd: "大客户销售，负责客户开发、商务谈判、回款和客户关系维护。",
  },
  {
    name: "会计",
    expected: "CORPORATE_PROFESSIONAL",
    resume:
      "陈静，初级会计职称，3年总账经验，负责凭证审核、月末结账、纳税申报和财务报表。",
    jd: "总账会计，要求初级会计职称，熟悉结账、税务申报和财务报表。",
  },
  {
    name: "教师",
    expected: "EDUCATION_RESEARCH",
    resume:
      "赵老师，汉语言文学本科，持高中语文教师资格证，有两年高中语文教学和班级管理经历。",
    jd: "高中语文教师，要求教师资格证、教学设计、课堂教学和学生沟通能力。",
  },
  {
    name: "护士",
    expected: "HEALTHCARE_CARE",
    resume:
      "周敏，护理学本科，持护士执业证，三年内科病房经历，负责基础护理、医嘱执行和应急配合。",
    jd: "病房护士，要求护士执业资格、临床护理经验、院感意识和应急处理能力。",
    forbiddenInferences: ["静脉输液", "发药"],
  },
  {
    name: "数控操作",
    expected: "ENGINEERING_INDUSTRIAL",
    resume:
      "刘强，5年数控车床操作经验，能识图、对刀、编程和首件检验，熟悉设备点检与安全规范。",
    jd: "数控车床操作工，要求识图、编程、质量检验、设备维护和安全生产经验。",
  },
  {
    name: "司机",
    expected: "CONSTRUCTION_LOGISTICS",
    resume:
      "孙师傅，持A2驾驶证和货运从业资格证，6年长途货运经验，无重大事故，熟悉车辆日常检查。",
    jd: "长途货运司机，要求A2驾照、货运资格、车辆检查和安全驾驶经验。",
  },
  {
    name: "厨师",
    expected: "SERVICE_RETAIL",
    resume:
      "吴师傅，6年中餐厨房经验，负责热菜出品、备料、成本控制和后厨卫生，能配合高峰期出餐。",
    jd: "中餐厨师，要求热菜经验、出品稳定、成本意识、食品安全和团队配合。",
  },
];
const selectedSamples = process.env.SMOKE_SAMPLE
  ? samples.filter((sample) => sample.name === process.env.SMOKE_SAMPLE)
  : samples;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let correctionCase;
for (const [index, sample] of selectedSamples.entries()) {
  const deviceId = digest(`offerlens-v2-smoke-device-${index}`);
  const fingerprint = digest(`offerlens-v2-smoke-fingerprint-${index}`);
  const form = new FormData();
  form.set("resumeText", sample.resume);
  form.set("jd", sample.jd);
  form.set("deviceId", deviceId);
  form.set("fingerprint", fingerprint);

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      cookie: `offerlens_device_id=${deviceId}`,
      "x-real-ip": realIp,
    },
    body: form,
  });
  const payload = await response.json();
  assert(
    response.ok,
    `${sample.name}: HTTP ${response.status} ${JSON.stringify(payload)}`,
  );
  assert(
    payload.evaluation_context?.occupation_family === sample.expected,
    `${sample.name}: expected ${sample.expected}, got ${payload.evaluation_context?.occupation_family}`,
  );
  assert(
    JSON.stringify(payload.flow?.map((step) => step.stage)) ===
      JSON.stringify(stages),
    `${sample.name}: invalid flow`,
  );
  assert(
    dimensions.every(
      (key) => payload.evidence_assessment?.dimensions?.[key],
    ),
    `${sample.name}: incomplete evidence dimensions`,
  );
  assert(payload.correction?.token, `${sample.name}: correction token missing`);
  assert(
    (sample.forbiddenInferences ?? []).every(
      (phrase) => !JSON.stringify(payload).includes(phrase),
    ),
    `${sample.name}: inferred facts not present in resume`,
  );
  if (sample.name === "程序员" && selectedSamples.length === samples.length) {
    correctionCase = { sample, deviceId, fingerprint, payload };
  }
  console.log(
    JSON.stringify({
      sample: sample.name,
      occupation: payload.evaluation_context.occupation_family,
      role: payload.evaluation_context.occupation_name,
      result: payload.final_result,
      bottleneck: payload.bottleneck_stage,
    }),
  );
}

if (selectedSamples.length !== samples.length) process.exit(0);
assert(correctionCase, "correction case missing");
const correctionForm = new FormData();
correctionForm.set("resumeText", correctionCase.sample.resume);
correctionForm.set("jd", correctionCase.sample.jd);
correctionForm.set("deviceId", correctionCase.deviceId);
correctionForm.set("fingerprint", correctionCase.fingerprint);
correctionForm.set("occupationFamily", "BUSINESS_COMMERCIAL");
correctionForm.set("correctionToken", correctionCase.payload.correction.token);

const correctionHeaders = {
  cookie: `offerlens_device_id=${correctionCase.deviceId}`,
  "x-real-ip": realIp,
};
const correctedResponse = await fetch(`${baseUrl}/api/analyze`, {
  method: "POST",
  headers: correctionHeaders,
  body: correctionForm,
});
const corrected = await correctedResponse.json();
assert(
  correctedResponse.ok,
  `correction: HTTP ${correctedResponse.status} ${JSON.stringify(corrected)}`,
);
assert(
  corrected.evaluation_context?.occupation_family === "BUSINESS_COMMERCIAL" &&
    corrected.evaluation_context?.occupation_source === "USER_OVERRIDE",
  "correction: override was not enforced",
);
assert(corrected.correction === null, "correction: unexpected second token");

const replayResponse = await fetch(`${baseUrl}/api/analyze`, {
  method: "POST",
  headers: correctionHeaders,
  body: correctionForm,
});
assert(
  replayResponse.status === 409,
  `correction replay: expected 409, got ${replayResponse.status}`,
);
console.log(
  JSON.stringify({
    correction: "passed",
    source: corrected.evaluation_context.occupation_source,
    replayStatus: replayResponse.status,
  }),
);
