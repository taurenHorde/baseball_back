##Baseball Team _6

Description
야구 팀을 만들어 팀원과 게스트를 구하는 사이트

Language / Library
React Typescript Node.js Express MongoDB react-celender Passport.js KakaoMap-Api Moment.js Joi

Main Function
ㆍPassport를 활용하여 회원 서비스 구현
ㆍServer에서 Middlewear를 활용하여 로그인 체크 / 팀원 체크 등 필요한 API에서 활용
ㆍ이용자의 잘못된 사용, 예외처리 구현
ㆍJoi를 통한 사용자 입력 데이터 검증 구현
ㆍKakaoMap API 를 사용하여 경기장 위치를 안내, 지도 클릭 시 카카오맵 길찾기 연동 구현
ㆍ인스타그램 알림 시간 처리 구현 (n분전 / n시간전 / n일전 등)
ㆍTransaction을 활용하여 실행단위를 변경하여 DB 데이터 변경 시 일관성과 원자성을 확보
ㆍreact-calender 라이브러리를 통한 모든 일정 달력으로 한 눈에 보기 구현

What I learned
ㆍTransaction이라는 정의와 사용법(Callback방식), Transaction 특성(ACID)을 습득
ㆍJoi라는 라이브러리와 사용법을 습득
ㆍRest API의 중요성에 대해서 몸소 습득
ㆍ'좋아요' 같은 간단한 기능은 선 구현 후 서버처리를 해도 된다는 방법?을 습득

What I need to learn
ㆍTypeScirpt에 대해서 더욱 공부가 필요, 일반적인 타입 지정이 아닌 어떻게 활용할 수 있는 지 알아볼 것.
ㆍRest API에 대해서 알아볼 것.
ㆍClassname / Api / DB 의 디자인의 중요성을 파악, 실무에서는 어떤 점을 중점으로 놓고 디자인을 하는지 알아볼 것

Consideration
ㆍ사용자가 입력한 데이터는 프론트와 서버 어디서 검증 절차를 해야 합리적인가.. 에 대해서 생각
ㆍDB에서 꺼낸 데이터를 사용범위에 맞게 손질은 프론트와 서버 어디서 해야 합리적인가.. 에 대해서 
ㆍ어떠한 기능이 있다면, 그 기능이 왜 생겼는지 간단하게라도 생각 해볼 것.

자세한 내용은 링크에서 확인 부탁드립니다.
https://taurenhorde.github.io/projects/project/baseball_team
