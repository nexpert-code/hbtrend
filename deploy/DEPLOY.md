# 배포 가이드 (Linux + Nginx)

## 1) 앱 빌드
프로젝트 루트에서 실행

```bash
npm install
npm run check
```

성공하면 dist 폴더가 생성됩니다.

## 2) 서버 경로 준비
예시 경로

```bash
sudo mkdir -p /var/www/mds
sudo chown -R $USER:$USER /var/www/mds
```

## 3) 빌드 결과 복사
```bash
rm -rf /var/www/mds/dist
cp -R dist /var/www/mds/dist
```

## 4) Nginx 설정 적용
```bash
sudo cp deploy/nginx-mds.conf /etc/nginx/sites-available/mds
sudo ln -sf /etc/nginx/sites-available/mds /etc/nginx/sites-enabled/mds
sudo nginx -t
sudo systemctl reload nginx
```

## 5) 방화벽(선택)
```bash
sudo ufw allow 80/tcp
```

## 6) 갱신 배포
데이터 변경이 아닌 코드 변경 시 아래만 반복

```bash
npm run build
rm -rf /var/www/mds/dist
cp -R dist /var/www/mds/dist
sudo systemctl reload nginx
```

## 참고
- 앱 데이터와 비밀번호 인증 상태는 브라우저 localStorage에 저장됩니다.
- 브라우저를 바꾸거나 저장소를 지우면 다시 비밀번호를 입력해야 합니다.
- 비밀번호는 단순 보호 기능입니다. 의료기관 수준 보안이 필요하면 서버 인증을 사용하세요.
