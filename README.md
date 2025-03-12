# 플로팅 웹 에디터 플러그인

이 프로젝트는 어떤 웹페이지에도 쉽게 통합할 수 있는 독립형 플러그인 기반 리치 웹 에디터를 제공합니다. 텍스트 선택 시 플로팅 툴바가 나타나며, 사용자는 선택한 텍스트에 서식을 적용할 수 있습니다.

## 주요 기능

- **독립형 플러그인**: 자체 포함된 JavaScript 라이브러리로 구현되어 어떤 웹페이지에도 추가할 수 있습니다.
- **텍스트 선택 및 HTML 삽입**: 기존 textarea 또는 편집 가능한 입력 필드와 통합되어 선택한 콘텐츠의 서식을 지정할 수 있습니다.
- **플로팅 UI 및 위치 지정**: 선택한 텍스트 영역 위에 10px 떨어진 위치에 플로팅 툴바가 나타납니다.
- **모듈식 및 사용자 정의 가능한 플러그인**: 관련 기능을 주석 처리하여 특정 에디터 기능을 활성화하거나 비활성화할 수 있습니다.
- **웹 표준 및 반응형 디자인**: 웹 표준을 준수하는 깨끗하고 의미 있는 HTML을 생성하며, 다양한 장치와 화면 크기에서 일관되게 작동합니다.
- **선택 인덱스 계산**: 사용자가 텍스트를 선택하면 에디터는 선택의 시작 및 끝 인덱스를 계산하고 표시합니다.
- **Google Material 아이콘 및 툴바 사용자 정의**: 툴바 버튼에 Google Material 아이콘을 사용하며, Gmail의 이메일 서식 툴바를 모방합니다.

## 사용 방법

### 1. 파일 포함하기

HTML 파일에 다음 파일들을 포함시킵니다:

```html
<!-- Google Material Icons -->
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<!-- 스타일시트 -->
<link rel="stylesheet" href="styles.css">
<!-- 에디터 스크립트 -->
<script src="editor.js"></script>
```

### 2. 에디터 초기화하기

JavaScript에서 다음과 같이 에디터를 초기화합니다:

```javascript
// DOM이 로드된 후 에디터 초기화
document.addEventListener('DOMContentLoaded', function() {
    // textarea에 에디터 적용
    FloatingEditor.init('#editor-textarea');
    
    // 편집 가능한 div에 에디터 적용
    FloatingEditor.init('#editor-div');
});
```

### 3. 사용자 정의 설정 (선택 사항)

에디터를 초기화할 때 사용자 정의 설정을 제공할 수 있습니다:

```javascript
FloatingEditor.init('#editor-textarea', {
    showDebugInfo: true,
    toolbarOffset: 15,
    features: {
        bold: true,
        italic: true,
        underline: true,
        strikethrough: false, // 취소선 기능 비활성화
        code: true,
        link: true,
        clear: true
    }
});
```

## 예제

기본 예제는 `index.html` 파일에서 확인할 수 있습니다. 이 예제는 다음을 보여줍니다:

1. textarea에 에디터 적용하기
2. 편집 가능한 div에 에디터 적용하기
3. 디버그 정보 표시하기

## 사용 시나리오

1. 사용자가 textarea 또는 편집 가능한 div에서 텍스트를 선택합니다.
2. 선택 영역 위에 플로팅 툴바가 나타납니다.
3. 사용자가 툴바에서 서식 버튼(굵게, 기울임, 밑줄 등)을 클릭합니다.
4. 선택한 텍스트에 해당 서식이 적용됩니다.
5. 사용자가 다른 곳을 클릭하면 툴바가 사라집니다.

## 기술 요구 사항

- JavaScript ES6+
- CSS3
- 최신 웹 브라우저 (Chrome, Firefox, Edge, Safari)

## 라이선스

MIT 라이선스 