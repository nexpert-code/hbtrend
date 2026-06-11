# MDS 모바일 기록 웹

MDS 혈액검사와 치료 기록을 날짜별로 관리하는 모바일 우선 웹앱입니다.

## 주요 기능
- 입력 페이지와 결과 페이지 분리
- Hb(혈색소) 추세 그래프
- 그래프 전체 데이터 표시
- 그래프 가로 스크롤 지원
- CSV 가져오기
- 로컬 저장(localStorage)
- 최초 1회 비밀번호 인증(환경변수 기반)

## 개발 실행
```bash
npm install
npm run dev
```

## 배포 빌드
```bash
npm run check
```

빌드 결과물은 dist 폴더에 생성됩니다.

## 로컬 배포 확인
```bash
npm run serve:lan
```

기본 주소
- http://localhost:4173
- 같은 네트워크 기기에서 접속 가능

## 리눅스 웹서버 배포(Nginx)
1. 서버에 Nginx 설치
2. 프로젝트에서 빌드 수행: `npm run build`
3. dist 폴더를 서버의 정적 경로로 복사
4. `deploy/nginx-mds.conf`를 참고해 사이트 설정
5. Nginx 재시작

상세 절차는 deploy/DEPLOY.md 문서를 참고하세요.

## GitHub Pages 배포
이 프로젝트는 `.github/workflows/deploy-pages.yml`로 자동 배포됩니다.

1. GitHub에 새 저장소 생성
2. 이 프로젝트를 `main` 브랜치로 push
3. GitHub 저장소 설정에서 Pages를 `GitHub Actions`로 설정
4. Actions 완료 후 배포 URL 접속

예시 명령

```bash
git init
git add .
git commit -m "Deploy-ready MDS app"
git branch -M main
git remote add origin https://github.com/<계정명>/<저장소명>.git
git push -u origin main
```

## 보안 주의
현재 비밀번호는 클라이언트 로컬 저장 기반의 간단한 보호 기능입니다.
강한 인증이 필요한 환경에서는 서버 인증 방식으로 전환해야 합니다.
