export const reviewDiagnosisOptions = [
  'MBD(대사성 골질환)', '난산/에그바인딩', '탈피부전', '구내염', '호흡기 감염', '폐렴',
  '장폐색/임팩션', '탈항', '내부기생충', '외부기생충', '피부염', '진균성 질환', '농양',
  '골절', '탈수', '저칼슘혈증', '난포 정체', '생식기 탈출', '기타',
] as const

export type HospitalConditionId =
  | 'anorexia' | 'shedding' | 'defecation' | 'egg_laying'
  | 'mbd' | 'dystocia_egg_binding' | 'dysecdysis' | 'stomatitis' | 'respiratory_infection'
  | 'pneumonia' | 'impaction' | 'prolapse' | 'internal_parasites' | 'external_parasites'
  | 'dermatitis' | 'fungal_disease' | 'abscess' | 'fracture' | 'dehydration'
  | 'hypocalcemia' | 'follicular_stasis' | 'reproductive_prolapse'

export type HospitalCondition = {
  id: HospitalConditionId
  label: string
  group: '증상·상태' | '리뷰 진단명'
  keywords: readonly string[]
  firstAid: string
  urgent: string
}

export const hospitalConditions: readonly HospitalCondition[] = [
  { id: 'anorexia', label: '거식·먹이 거부', group: '증상·상태', keywords: ['거식', '먹이 거부', '먹이를 안', '식욕 부진', '식욕부진', '안 먹어요', '급여 거부'], firstAid: '최근 체중과 먹이 섭취량을 기록하고 종에 맞는 온도·습도·은신처를 확인하세요. 탈수가 의심되는 개체를 임의로 강제 급여하지 마세요.', urgent: '체중 감소, 무기력, 탈수, 호흡 이상이 동반되거나 거식이 이어지면 특수동물 진료를 받으세요.' },
  { id: 'shedding', label: '탈피 이상', group: '증상·상태', keywords: ['탈피', '탈피부전', '탈피 부전', '잔존 탈피', '허물'], firstAid: '종별 적정 습도와 따뜻한 습식 은신처를 확인하세요. 눈·발가락·꼬리의 남은 허물을 억지로 떼지 마세요.', urgent: '눈을 덮거나 발가락·꼬리를 조이는 허물, 상처·부종·반복 탈피부전은 진료가 필요합니다.' },
  { id: 'defecation', label: '배변 이상', group: '증상·상태', keywords: ['배변', '설사', '변비', '혈변', '이물질', '분변', '묽은 변', '딱딱한 변'], firstAid: '배변 사진과 날짜, 먹이, 온도·습도, 바닥재 정보를 기록하고 깨끗한 물을 제공하세요. 임의의 관장이나 약 투여는 피하세요.', urgent: '혈변, 탈항, 반복 구토, 심한 복부 팽만·무기력 또는 장기간 무배변은 빠르게 진료받으세요.' },
  { id: 'egg_laying', label: '산란 이상', group: '증상·상태', keywords: ['산란', '난산', '에그바인딩', '알막힘', '무정란', '난포 정체'], firstAid: '종에 맞는 온도와 산란 바닥재, 조용한 은신 공간, 수분을 제공하세요. 복부를 누르거나 임의로 산란 유도제를 사용하지 마세요.', urgent: '지속적인 힘주기, 무기력, 복부 팽만, 식욕 저하 또는 탈출 조직이 보이면 신속히 진료받으세요.' },
  { id: 'mbd', label: 'MBD(대사성 골질환)', group: '리뷰 진단명', keywords: ['MBD', '대사성 골질환', '대사성골질환'], firstAid: '낙상을 막고 움직임을 최소화한 뒤 현재 UVB 조명, 온도, 식단과 보충제 정보를 준비하세요. 칼슘을 임의로 고용량 투여하지 마세요.', urgent: '턱·팔다리 변형, 떨림, 보행 이상, 골절 의심은 즉시 진료가 필요합니다.' },
  { id: 'dystocia_egg_binding', label: '난산/에그바인딩', group: '리뷰 진단명', keywords: ['난산', '에그바인딩', '알막힘'], firstAid: '조용하고 따뜻한 환경과 적절한 산란장을 제공하되 복부 압박이나 임의 약물 투여는 하지 마세요.', urgent: '힘주기, 무기력, 복부 팽만, 탈출 또는 산란 지연이 의심되면 영상검사가 가능한 병원에 문의하세요.' },
  { id: 'dysecdysis', label: '탈피부전', group: '리뷰 진단명', keywords: ['탈피부전', '잔존 탈피', '잔존탈피'], firstAid: '종별 습도와 습식 은신처를 점검하고 남은 허물을 억지로 잡아당기지 마세요.', urgent: '눈·발가락·꼬리의 혈류를 막는 잔존 허물이나 반복 발생은 진료가 필요합니다.' },
  { id: 'stomatitis', label: '구내염', group: '리뷰 진단명', keywords: ['구내염', '입병'], firstAid: '입을 억지로 벌리거나 소독제를 바르지 말고 먹이 섭취와 분비물 사진을 기록하세요.', urgent: '입안 출혈·고름·부종, 먹이 거부 또는 호흡 곤란이 있으면 빠르게 진료받으세요.' },
  { id: 'respiratory_infection', label: '호흡기 감염', group: '리뷰 진단명', keywords: ['호흡기 감염', '호흡기감염', '호흡기 질환'], firstAid: '종별 적정 온도를 안정적으로 유지하고 분비물·호흡 소리를 기록하세요. 사람용 감기약은 사용하지 마세요.', urgent: '입 벌림 호흡, 청색증, 심한 무기력은 응급 진료 대상입니다.' },
  { id: 'pneumonia', label: '폐렴', group: '리뷰 진단명', keywords: ['폐렴'], firstAid: '취급을 줄이고 적정 온도를 유지하며 즉시 병원에 연락하세요. 임의 항생제 투여는 피하세요.', urgent: '호흡 곤란이나 반응 저하는 즉시 응급 진료가 필요합니다.' },
  { id: 'impaction', label: '장폐색/임팩션', group: '리뷰 진단명', keywords: ['장폐색', '임팩션'], firstAid: '급여를 중단할지 임의 판단하지 말고 최근 먹이·바닥재·배변 정보를 준비하세요. 복부 마사지나 오일 투여는 피하세요.', urgent: '복부 팽만, 구토·역류, 무배변과 무기력이 함께 나타나면 신속히 진료받으세요.' },
  { id: 'prolapse', label: '탈항', group: '리뷰 진단명', keywords: ['탈항', '총배설강 탈출'], firstAid: '노출 조직이 마르지 않도록 깨끗한 생리식염수로 촉촉하게 유지하고 마찰을 막으세요. 직접 밀어 넣지 마세요.', urgent: '탈항은 조직 손상 위험이 있어 당일 진료가 필요합니다.' },
  { id: 'internal_parasites', label: '내부기생충', group: '리뷰 진단명', keywords: ['내부기생충', '내부 기생충', '분변검사'], firstAid: '신선한 분변 샘플과 체중·섭취 기록을 준비하고 다른 개체와 도구를 분리하세요.', urgent: '체중 감소, 지속 설사, 혈변·무기력이 있으면 분변검사와 진료가 필요합니다.' },
  { id: 'external_parasites', label: '외부기생충', group: '리뷰 진단명', keywords: ['외부기생충', '외부 기생충', '진드기'], firstAid: '개체와 사육 도구를 분리하고 기생충 사진을 남기세요. 개·고양이용 살충제를 사용하지 마세요.', urgent: '심한 감염, 빈혈 의심, 상처·무기력이 있으면 진료받으세요.' },
  { id: 'dermatitis', label: '피부염', group: '리뷰 진단명', keywords: ['피부염', '피부 질환'], firstAid: '환부를 건조하고 청결하게 유지하며 온도·습도와 바닥재를 점검하세요. 연고를 임의로 바르지 마세요.', urgent: '빠르게 번지는 병변, 수포·괴사·출혈은 진료가 필요합니다.' },
  { id: 'fungal_disease', label: '진균성 질환', group: '리뷰 진단명', keywords: ['진균성 질환', '곰팡이 감염'], firstAid: '격리하고 사육장을 청결·건조하게 관리하세요. 사람용 항진균제를 임의 사용하지 마세요.', urgent: '병변 확산, 식욕 저하·무기력이 동반되면 검사를 받아야 합니다.' },
  { id: 'abscess', label: '농양', group: '리뷰 진단명', keywords: ['농양'], firstAid: '부위를 누르거나 터뜨리지 말고 크기와 변화를 사진으로 기록하세요.', urgent: '빠르게 커지거나 눈·입·관절 주변에 생긴 농양은 진료가 필요합니다.' },
  { id: 'fracture', label: '골절', group: '리뷰 진단명', keywords: ['골절'], firstAid: '작고 안전한 이동장에 넣어 움직임과 낙상을 막고 임의로 부목을 대지 마세요.', urgent: '골절 의심, 출혈 또는 움직이지 못하는 상태는 즉시 진료받으세요.' },
  { id: 'dehydration', label: '탈수', group: '리뷰 진단명', keywords: ['탈수'], firstAid: '종별 적정 온도에서 얕은 물과 습식 은신처를 제공하되 물을 강제로 먹이지 마세요.', urgent: '눈 함몰, 피부 탄력 저하, 무기력·거식이 동반되면 수액 처치가 필요할 수 있습니다.' },
  { id: 'hypocalcemia', label: '저칼슘혈증', group: '리뷰 진단명', keywords: ['저칼슘혈증', '저칼슘', '칼슘 부족'], firstAid: '낙상을 막고 UVB·온도·식단·보충제 사용 기록을 준비하세요. 임의 고용량 칼슘 투여는 피하세요.', urgent: '떨림, 경련, 보행 이상, 산란 문제는 즉시 진료가 필요합니다.' },
  { id: 'follicular_stasis', label: '난포 정체', group: '리뷰 진단명', keywords: ['난포 정체', '난포정체'], firstAid: '조용한 환경을 유지하고 산란·교미·식욕·복부 변화 기록을 준비하세요.', urgent: '복부 팽만, 지속 거식·무기력은 영상검사가 가능한 병원 진료가 필요합니다.' },
  { id: 'reproductive_prolapse', label: '생식기 탈출', group: '리뷰 진단명', keywords: ['생식기 탈출', '생식기탈출'], firstAid: '노출 조직을 깨끗하고 촉촉하게 보호하며 직접 밀어 넣거나 소독제를 바르지 마세요.', urgent: '조직 괴사 위험이 있어 즉시 진료받아야 합니다.' },
]

export const hospitalConditionById = new Map(hospitalConditions.map((condition) => [condition.id, condition]))

export function findHospitalCondition(value: string) {
  const normalized = value.toLocaleLowerCase('ko-KR')
  return hospitalConditions.find((condition) => condition.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase('ko-KR')))) ?? null
}
