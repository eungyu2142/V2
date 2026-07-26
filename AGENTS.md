# Project Working Guide

이 프로젝트의 기능 구현 기준은 `docs/APP_REQUIREMENTS.md`를 우선한다.

## Product Direction

- 앱은 특수동물 케어 PWA다.
- 네이버 지도 UX를 많이 참고하되, 앱 자체 UI는 민트 Primary와 뉴트럴 배경 기반의 깔끔한 스타일을 유지한다.
- 지도, 리뷰, 나눔, 질문, 내 펫, 캘린더, 프로필은 서로 기록/좋아요/임시저장 데이터가 연결되어야 한다.
- "지도/리뷰"는 병원 검색, 위치 기반 지도, 병원 정보, 리뷰 작성/조회가 핵심이다.

## Implementation Priorities

- 사용자의 최신 요구사항이 기존 구현과 충돌하면 최신 요구사항을 우선한다.
- 지도 화면은 전체 화면 지도를 기본으로 하고, 검색창과 분류 태그는 지도 위 오버레이로 둔다.
- 병원 리뷰는 외부 사이트로 이동하지 않고 앱 내부에서 열려야 한다.
- 리뷰 작성은 최종적으로 마이 펫, 캘린더 기록, 병원 데이터와 연결되어야 한다.
- 좋아요, 임시저장, 내가 쓴 글/리뷰 수정 삭제는 프로필의 나의 활동과 연결되어야 한다.

## Current Source Of Truth

상세 요구사항은 `docs/APP_REQUIREMENTS.md`를 확인한다.

## Visual System Rule

- 새 컴포넌트와 기존 컴포넌트 수정에는 `src/index.css`의 `--color-*` 토큰을 사용하며 색상값을 직접 하드코딩하지 않는다.
- 기본 액션과 선택·활성 상태는 `--color-primary-600`, hover는 `--color-primary-700`을 사용한다.
- 상태·별점·알림 포인트에만 Accent 토큰을 제한적으로 사용하고 메인 액션에는 Accent를 사용하지 않는다.
- 폼 오류와 삭제·탈퇴 등 위험 행동에만 Error 토큰을 사용한다.
- 배경 tint는 비활성 hover와 보조 태그 등 필요한 곳에만 최소한으로 사용한다.
- 사이드바와 하단 내비게이션을 포함한 모든 앱 컴포넌트에서 블루 계열을 사용하지 않는다. 내비게이션 구조 배경은 `--color-primary-900`, 활성 항목은 `--color-primary-600`을 사용한다.
- Primary 600 또는 Accent 600 위에 흰색을 사용할 때는 WCAG AA 대비를 확인하며, 충족하지 않으면 `--color-text-primary`를 사용한다.
- 내비게이션, 버튼, 태그, 카드, 입력창, 모달, 바텀시트, 아이콘의 radius, 높이, hover, active 상태는 공통 디자인 토큰과 맞춘다.

## Korean Work Log Rule

- 사용자의 프롬프트로 코드를 변경할 때마다 `docs/project-records`에 한국어 작업 메모를 남긴다.
- 메모에는 요청 요약, 분석·판단 이유, 수정 파일, 핵심 변경 내용, 검증 결과, 남은 작업을 포함한다.
- UI 변경은 `docs/project-records/UI.md`, UX 변경은 `docs/project-records/UX.md`에 날짜별로 누적하고 별도 날짜 파일을 만들지 않는다.
