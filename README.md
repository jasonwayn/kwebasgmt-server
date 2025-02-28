1. 로컬 환경 구성
이 프로젝트를 실행하기 위해 아래 환경이 필요합니다:

- **Node.js** 16+
- **MariaDB** 또는 **MySQL**
- **npm**

. 의존성 설치

먼저, **백엔드**와 **프론트엔드** 의존성을 각각 설치해야 합니다.

### 백엔드 (`server` 디렉토리)
`server` 디렉토리에서 의존성을 설치합니다:

```bash
cd server
npm install

### 프론트엔드 (`myblog` 디렉토리)
cd my-blog
npm install


2. 데이터베이스 세팅 방법
- database.sql 파일에 존재하는 DB스키마를 이용하여 mysql에 세팅 가능
- mysql -u root -p
- password : kweb (제 케이스)

3.프로젝트 실행
<서버 실행>
server 파일에서 node server.js

<프론트엔드 실행>
my-blog 파일에서 npm start
(프론트엔드는 http://localhost:5000에서 실행)


4.테스트 계정 정보
1. ID : shoot0428@naver.com
   PW : shoot0428

2. ID : test@email.com
   PW : test1234

- 
