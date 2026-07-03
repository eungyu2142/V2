# 프로젝트 기록 연결 흐름

아래 파일은 사용자가 요청한 “파란색 박스처럼 화살표가 나오는 파일” 역할을 한다. 실제 앱 기능 코드는 아니며, 어떤 기록 파일이 어떤 영역을 담당하는지 한눈에 보기 위한 문서다.

```mermaid
flowchart TD
    A["프로젝트 작업 기록<br/>docs/project-records"]
    A --> UI["UI"]
    A --> UX["UX"]
    A --> ACCOUNT["account/login<br/>로그인 · 회원가입 · 로그아웃 · 계정 생성"]
    A --> MYPET["mypet<br/>마이펫"]
    A --> MEMO["memo<br/>기록"]
    A --> MAPS["maps<br/>지도"]
    A --> QNA["QNA<br/>질문"]
    A --> SHARE["share<br/>나눔"]
    A --> PROFILE["profile<br/>프로필"]
    A --> ALL["all<br/>전체 화면 · PWA · 웹/모바일"]

    UI --> ALL
    UX --> ALL
    ACCOUNT --> PROFILE
    MYPET --> MEMO
    MYPET --> MAPS
    MEMO --> PROFILE
    MAPS --> MEMO
    MAPS --> PROFILE
    QNA --> MEMO
    QNA --> PROFILE
    SHARE --> PROFILE
```

## 기록 대상 파일

- UI: `UI.md`
- UX: `UX.md`
- account/login: `account-login.md`
- mypet: `mypet.md`
- memo: `memo.md`
- maps: `maps.md`
- QNA: `QNA.md`
- share: `share.md`
- profile: `profile.md`
- all: `all.md`

## 2026-07-03 기록

### 문제 인식

사용자는 기능별 기록 파일이 흩어져 있더라도 전체적으로 어떤 파일이 어떤 기능과 연결되는지 화살표 형태로 확인할 수 있는 문서를 원했다.

### 해결 과정

Mermaid flowchart를 사용해 프로젝트 기록 폴더에서 각 기능 기록 파일로 이어지는 구조와 기능 간 연결 관계를 문서화했다.

### 완료 기록

전체 기록 파일 연결 흐름 문서를 생성했다.

