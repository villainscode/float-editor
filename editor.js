/**
 * FloatingEditor - 독립형 웹 에디터 플러그인
 * 
 * 이 플러그인은 어떤 웹페이지에도 쉽게 통합할 수 있는 독립형 리치 텍스트 에디터를 제공합니다.
 * 텍스트 선택 시 플로팅 툴바가 나타나며, 사용자는 선택한 텍스트에 서식을 적용할 수 있습니다.
 */

const FloatingEditor = (function() {
    // 프라이빗 변수
    let editorElements = [];
    let activeEditor = null;
    let toolbarElement = null;
    let debugElement = null;
    let currentSelection = null;
    let isToolbarVisible = false;
    
    // 기본 설정
    const DEFAULT_CONFIG = {
        toolbarOffset: 10, // 선택 영역 위 10px에 툴바 배치
        features: {
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
            code: true,
            link: true,
            clear: true
        }
    };
    
    // 사용자 설정
    let config = { ...DEFAULT_CONFIG };
    
    /**
     * 에디터 초기화 함수
     * @param {string|Element} selector - CSS 선택자 또는 DOM 요소
     * @param {Object} userConfig - 사용자 설정 (선택 사항)
     */
    function init(selector, userConfig = {}) {
        // 사용자 설정과 기본 설정 병합
        config = { ...DEFAULT_CONFIG, ...userConfig };
        
        // 선택자가 문자열인 경우 DOM 요소로 변환
        const elements = typeof selector === 'string' 
            ? document.querySelectorAll(selector) 
            : [selector];
        
        // 각 요소에 에디터 기능 적용
        elements.forEach(element => {
            if (element && !editorElements.includes(element)) {
                setupEditor(element);
                editorElements.push(element);
            }
        });
        
        // 툴바가 아직 생성되지 않은 경우 생성
        if (!toolbarElement) {
            createToolbar();
        }
        
        // 문서 클릭 이벤트 리스너 추가 (툴바 숨김 처리)
        document.addEventListener('click', handleDocumentClick);
        
        return {
            getElements: () => editorElements,
            getConfig: () => config,
            setConfig: newConfig => {
                config = { ...config, ...newConfig };
                // 툴바 업데이트
                if (toolbarElement) {
                    document.body.removeChild(toolbarElement);
                    toolbarElement = null;
                    createToolbar();
                }
            }
        };
    }
    
    /**
     * 에디터 요소 설정
     * @param {Element} element - 에디터로 설정할 DOM 요소
     */
    function setupEditor(element) {
        // 요소가 textarea인 경우 특별 처리
        const isTextarea = element.tagName.toLowerCase() === 'textarea';
        
        // 선택 이벤트 리스너 추가
        if (isTextarea) {
            // mouseup 이벤트를 추가하여 텍스트 선택 감지 개선
            element.addEventListener('mouseup', handleTextareaSelection);
            element.addEventListener('keyup', handleTextareaSelection);
            // 더블 클릭 이벤트 추가
            element.addEventListener('dblclick', handleTextareaSelection);
            // select 이벤트는 일부 브라우저에서 일관되게 작동하지 않을 수 있음
            element.addEventListener('select', handleTextareaSelection);
        } else {
            element.addEventListener('mouseup', handleTextSelection);
            element.addEventListener('keyup', handleTextSelection);
            // 더블 클릭 이벤트 추가
            element.addEventListener('dblclick', handleTextSelection);
        }
    }
    
    /**
     * textarea 선택 처리 함수 (textarea 전용)
     * @param {Event} event - 이벤트 객체
     */
    function handleTextareaSelection(event) {
        const textarea = event.target;
        
        // 더블 클릭 이벤트인 경우 약간의 지연 추가
        if (event.type === 'dblclick') {
            setTimeout(() => processTextareaSelection(textarea), 10);
            return;
        }
        
        processTextareaSelection(textarea);
    }
    
    /**
     * textarea 선택 처리 로직
     * @param {Element} textarea - textarea 요소
     */
    function processTextareaSelection(textarea) {
        // 선택 영역 가져오기
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        // 선택 영역이 없는 경우 툴바 숨김
        if (start === end) {
            hideToolbar();
            return;
        }
        
        // 선택 정보 저장
        currentSelection = {
            element: textarea,
            isTextarea: true,
            start,
            end,
            text: textarea.value.substring(start, end)
        };
        
        // 툴바 위치 계산 및 표시
        const coords = getTextareaCoordinates(textarea, start, end);
        showToolbar(coords);
        
        // 디버그 정보 업데이트
        updateDebugInfo();
        
        // 현재 활성 에디터 설정
        activeEditor = textarea;
    }
    
    /**
     * 텍스트 선택 처리 함수 (contenteditable 요소용)
     * @param {Event} event - 이벤트 객체
     */
    function handleTextSelection(event) {
        const element = event.target;
        
        // 더블 클릭 이벤트인 경우 약간의 지연 추가
        if (event.type === 'dblclick') {
            setTimeout(() => processContentEditableSelection(element), 10);
            return;
        }
        
        processContentEditableSelection(element);
    }
    
    /**
     * contenteditable 선택 처리 로직
     * @param {Element} element - contenteditable 요소
     */
    function processContentEditableSelection(element) {
        // 현재 선택 정보 가져오기
        const selection = window.getSelection();
        
        // 선택 영역이 없거나 빈 경우 툴바 숨김
        if (!selection || selection.isCollapsed) {
            hideToolbar();
            return;
        }
        
        const range = selection.getRangeAt(0);
        
        // 선택 영역이 없는 경우 툴바 숨김
        if (range.collapsed) {
            hideToolbar();
            return;
        }
        
        // 선택 영역의 시작과 끝 인덱스 계산
        const startIndex = getNodeOffset(element, range.startContainer, range.startOffset);
        const endIndex = getNodeOffset(element, range.endContainer, range.endOffset);
        
        // 선택 정보 저장
        currentSelection = {
            element,
            isTextarea: false,
            range,
            text: range.toString(),
            start: startIndex,
            end: endIndex
        };
        
        // 툴바 위치 계산 및 표시
        const coords = getSelectionCoordinates(range);
        showToolbar(coords);
        
        // 디버그 정보 업데이트
        updateDebugInfo();
        
        // 현재 활성 에디터 설정
        activeEditor = element;
    }
    
    /**
     * contenteditable 요소 내에서 노드의 오프셋 계산
     * @param {Element} root - 루트 요소
     * @param {Node} targetNode - 대상 노드
     * @param {number} targetOffset - 대상 노드 내의 오프셋
     * @returns {number} 루트 요소 기준 오프셋
     */
    function getNodeOffset(root, targetNode, targetOffset) {
        // 텍스트 노드가 아닌 경우 자식 노드로 처리
        if (targetNode.nodeType !== Node.TEXT_NODE) {
            let offset = 0;
            for (let i = 0; i < targetOffset; i++) {
                if (targetNode.childNodes[i]) {
                    offset += getTextContent(targetNode.childNodes[i]).length;
                }
            }
            return offset;
        }
        
        let offset = targetOffset;
        let node = targetNode;
        
        // 트리 순회하며 오프셋 계산
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        while (walker.nextNode()) {
            if (walker.currentNode === targetNode) {
                break;
            }
            offset += walker.currentNode.textContent.length;
        }
        
        return offset;
    }
    
    /**
     * 노드의 텍스트 콘텐츠 가져오기
     * @param {Node} node - 노드
     * @returns {string} 텍스트 콘텐츠
     */
    function getTextContent(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        
        let text = '';
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
        while (walker.nextNode()) {
            text += walker.currentNode.textContent;
        }
        
        return text;
    }
    
    /**
     * textarea 내 선택 영역의 좌표 계산
     * @param {Element} textarea - textarea 요소
     * @param {number} start - 선택 시작 인덱스
     * @param {number} end - 선택 종료 인덱스
     * @returns {Object} 좌표 정보
     */
    function getTextareaCoordinates(textarea, start, end) {
        // textarea의 위치 정보
        const rect = textarea.getBoundingClientRect();
        
        // 임시 요소를 사용하여 텍스트 위치 계산
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.overflow = 'hidden';
        div.style.width = getComputedStyle(textarea).width;
        div.style.height = 'auto';
        div.style.fontSize = getComputedStyle(textarea).fontSize;
        div.style.fontFamily = getComputedStyle(textarea).fontFamily;
        div.style.lineHeight = getComputedStyle(textarea).lineHeight;
        div.style.padding = getComputedStyle(textarea).padding;
        
        // 선택 영역 앞의 텍스트
        const textBeforeSelection = textarea.value.substring(0, start);
        // 선택된 텍스트
        const selectedText = textarea.value.substring(start, end);
        
        // 텍스트 추가
        div.textContent = textBeforeSelection;
        document.body.appendChild(div);
        
        // 선택 영역 시작 위치 계산
        const startHeight = div.clientHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20; // 기본값 설정
        
        // 스크롤 위치 고려
        const scrollTop = textarea.scrollTop;
        
        // 선택 영역의 실제 위치 계산 (스크롤 위치 고려)
        // 첫 줄 선택 시 적절한 위치 계산을 위해 최소값 설정
        const minTopPosition = rect.top + parseInt(getComputedStyle(textarea).paddingTop);
        // 기본 위치 계산 (30px 오프셋 적용)
        let selectionTop = rect.top + startHeight - scrollTop - 30;
        
        // 첫 줄 선택 시 너무 위로 올라가지 않도록 조정
        if (startHeight < lineHeight || start === 0) {
            selectionTop = minTopPosition;
        } else {
            // 첫 줄이 아닌 경우 추가로 5px 더 떨어지도록 조정
            selectionTop -= 5;
        }
        
        // 임시 요소 제거
        document.body.removeChild(div);
        
        // 선택 영역의 가로 위치 계산을 위한 추가 작업
        // 선택 영역 앞의 텍스트를 기준으로 가로 위치 계산
        const horizontalDiv = document.createElement('div');
        horizontalDiv.style.position = 'absolute';
        horizontalDiv.style.visibility = 'hidden';
        horizontalDiv.style.whiteSpace = 'pre';
        horizontalDiv.style.fontSize = getComputedStyle(textarea).fontSize;
        horizontalDiv.style.fontFamily = getComputedStyle(textarea).fontFamily;
        horizontalDiv.style.padding = '0';
        
        // 현재 줄의 시작 부분을 찾기
        let lineStart = start;
        while (lineStart > 0 && textarea.value[lineStart - 1] !== '\n') {
            lineStart--;
        }
        
        // 현재 줄의 텍스트
        const currentLineText = textarea.value.substring(lineStart, start);
        horizontalDiv.textContent = currentLineText;
        document.body.appendChild(horizontalDiv);
        
        // 선택 영역 시작 위치의 가로 좌표 계산
        const selectionLeft = rect.left + horizontalDiv.clientWidth + parseInt(getComputedStyle(textarea).paddingLeft);
        
        // 임시 요소 제거
        document.body.removeChild(horizontalDiv);
        
        // 좌표 계산 (선택 영역 바로 위에 위치하도록 수정)
        return {
            left: selectionLeft, // 선택 영역 시작 위치
            top: selectionTop, // 선택 영역 시작 위치 (30px 위로 이동)
            bottom: selectionTop + lineHeight, // 선택 영역 끝 위치 (한 줄 높이 추가)
            height: lineHeight
        };
    }
    
    /**
     * 일반 선택 영역의 좌표 계산
     * @param {Range} range - 선택 범위
     * @returns {Object} 좌표 정보
     */
    function getSelectionCoordinates(range) {
        // 선택 영역의 경계 정보 가져오기
        const rect = range.getBoundingClientRect();
        
        // 좌표 계산 (선택 영역 바로 위에 위치하도록)
        return {
            left: rect.left + (rect.width / 2), // 선택 영역의 가로 중앙
            top: rect.top, // 선택 영역의 상단
            bottom: rect.bottom, // 선택 영역의 하단
            height: rect.height
        };
    }
    
    /**
     * 툴바 생성 함수
     */
    function createToolbar() {
        // 툴바 컨테이너 생성
        toolbarElement = document.createElement('div');
        toolbarElement.className = 'floating-editor';
        
        // 툴바 내부 요소 생성
        const toolbar = document.createElement('div');
        toolbar.className = 'floating-editor-toolbar';
        
        // 기능 버튼 추가
        if (config.features.bold) {
            toolbar.appendChild(createToolbarButton('format_bold', '굵게', applyBold));
        }
        
        if (config.features.italic) {
            toolbar.appendChild(createToolbarButton('format_italic', '기울임', applyItalic));
        }
        
        if (config.features.underline) {
            toolbar.appendChild(createToolbarButton('format_underlined', '밑줄', applyUnderline));
        }
        
        // 구분선 추가
        toolbar.appendChild(createToolbarSeparator());
        
        if (config.features.strikethrough) {
            toolbar.appendChild(createToolbarButton('strikethrough_s', '취소선', applyStrikethrough));
        }
        
        if (config.features.code) {
            toolbar.appendChild(createToolbarButton('code', '코드', applyCode));
        }
        
        if (config.features.link) {
            toolbar.appendChild(createToolbarButton('link', '링크', applyLink));
        }
        
        // 구분선 추가
        toolbar.appendChild(createToolbarSeparator());
        
        if (config.features.clear) {
            toolbar.appendChild(createToolbarButton('format_clear', '서식 지우기', clearFormatting));
        }
        
        // 툴바를 컨테이너에 추가
        toolbarElement.appendChild(toolbar);
        
        // 디버그 정보 요소는 더 이상 추가하지 않음
        
        // 툴바를 문서에 추가
        document.body.appendChild(toolbarElement);
    }
    
    /**
     * 툴바 버튼 생성 함수
     * @param {string} icon - 아이콘 이름 (Material Icons)
     * @param {string} title - 버튼 툴팁
     * @param {Function} action - 클릭 시 실행할 함수
     * @returns {Element} 버튼 요소
     */
    function createToolbarButton(icon, title, action) {
        const button = document.createElement('button');
        button.className = 'floating-editor-button';
        button.title = title;
        button.innerHTML = `<span class="material-icons">${icon}</span>`;
        button.addEventListener('click', action);
        return button;
    }
    
    /**
     * 툴바 구분선 생성 함수
     * @returns {Element} 구분선 요소
     */
    function createToolbarSeparator() {
        const separator = document.createElement('div');
        separator.className = 'floating-editor-separator';
        return separator;
    }
    
    /**
     * 툴바 표시 함수
     * @param {Object} coords - 좌표 정보
     */
    function showToolbar(coords) {
        if (!toolbarElement) return;
        
        // 툴바 위치 설정
        const toolbarRect = toolbarElement.getBoundingClientRect();
        
        // 가로 위치 계산 (선택 영역의 중앙에 툴바 배치)
        const left = Math.max(10, Math.min(
            coords.left - (toolbarRect.width / 2),
            window.innerWidth - toolbarRect.width - 10
        ));
        
        // 세로 위치 계산 (선택 영역 바로 위에 툴바 배치)
        // textarea의 경우 이미 추가 오프셋이 적용되어 있으므로 그대로 사용
        const top = coords.top - toolbarRect.height - config.toolbarOffset;
        
        // 화면 상단을 벗어나는 경우 또는 너무 가까운 경우 선택 영역 아래에 배치
        const finalTop = top < 20 
            ? coords.bottom + config.toolbarOffset 
            : top;
        
        // 위치 적용
        toolbarElement.style.left = `${left}px`;
        toolbarElement.style.top = `${finalTop}px`;
        
        // 툴바 표시
        toolbarElement.classList.add('visible');
        isToolbarVisible = true;
        
        // 디버그 로그 추가
        console.log('툴바 표시:', {
            coords,
            left,
            top,
            finalTop,
            selection: currentSelection
        });
    }
    
    /**
     * 툴바 숨김 함수
     */
    function hideToolbar() {
        if (!toolbarElement) return;
        
        toolbarElement.classList.remove('visible');
        isToolbarVisible = false;
        currentSelection = null;
    }
    
    /**
     * 문서 클릭 이벤트 처리 함수
     * @param {Event} event - 이벤트 객체
     */
    function handleDocumentClick(event) {
        // 툴바 내부 클릭은 무시
        if (toolbarElement && toolbarElement.contains(event.target)) {
            event.stopPropagation();
            return;
        }
        
        // 에디터 요소 내부 클릭은 선택 처리 함수에서 처리
        if (editorElements.some(el => el.contains(event.target))) {
            return;
        }
        
        // 그 외의 경우 툴바 숨김
        hideToolbar();
    }
    
    /**
     * 디버그 정보 업데이트 함수
     */
    function updateDebugInfo() {
        if (!currentSelection) return;
        
        // 메인 디버그 정보 요소만 업데이트
        const mainDebugElement = document.getElementById('debug-info');
        if (mainDebugElement) {
            const { start, end, text } = currentSelection;
            mainDebugElement.textContent = `선택 영역: 시작 인덱스 ${start}, 종료 인덱스 ${end}, 길이 ${text.length}자`;
        }
    }
    
    /**
     * 서식 적용 함수 - 굵게
     */
    function applyBold() {
        applyFormatting('bold', '<b>$1</b>', 'editor-bold');
    }
    
    /**
     * 서식 적용 함수 - 기울임
     */
    function applyItalic() {
        applyFormatting('italic', '<i>$1</i>', 'editor-italic');
    }
    
    /**
     * 서식 적용 함수 - 밑줄
     */
    function applyUnderline() {
        applyFormatting('underline', '<u>$1</u>', 'editor-underline');
    }
    
    /**
     * 서식 적용 함수 - 취소선
     */
    function applyStrikethrough() {
        applyFormatting('strikethrough', '<s>$1</s>', 'editor-strikethrough');
    }
    
    /**
     * 서식 적용 함수 - 코드
     */
    function applyCode() {
        applyFormatting('code', '<code>$1</code>', 'editor-code');
    }
    
    /**
     * 서식 적용 함수 - 링크
     */
    function applyLink() {
        const url = prompt('링크 URL을 입력하세요:', 'https://');
        if (url) {
            applyFormatting('link', `<a href="${url}">$1</a>`, '');
        }
    }
    
    /**
     * 서식 지우기 함수
     */
    function clearFormatting() {
        if (!currentSelection) return;
        
        const { element, isTextarea, start, end, range, text } = currentSelection;
        
        if (isTextarea) {
            // HTML 태그 제거
            const cleanText = text.replace(/<[^>]*>/g, '');
            
            // 텍스트 교체
            element.value = element.value.substring(0, start) + 
                            cleanText + 
                            element.value.substring(end);
            
            // 선택 영역 유지
            element.setSelectionRange(start, start + cleanText.length);
            
        } else {
            // 현재 선택 영역의 HTML 내용 가져오기
            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            
            // HTML 태그 제거
            const cleanText = tempDiv.textContent;
            
            // 선택 영역 삭제 후 텍스트 삽입
            range.deleteContents();
            range.insertNode(document.createTextNode(cleanText));
            
            // 선택 영역 업데이트
            const newRange = document.createRange();
            newRange.setStart(range.startContainer, range.startOffset);
            newRange.setEnd(range.startContainer, range.startOffset + cleanText.length);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        
        // 툴바 숨김
        hideToolbar();
    }
    
    /**
     * 서식 적용 공통 함수
     * @param {string} type - 서식 유형
     * @param {string} htmlTemplate - HTML 템플릿
     * @param {string} className - 적용할 클래스 이름
     */
    function applyFormatting(type, htmlTemplate, className) {
        if (!currentSelection) return;
        
        const { element, isTextarea, start, end, range, text } = currentSelection;
        
        if (isTextarea) {
            // HTML 태그 삽입
            const formattedText = htmlTemplate.replace('$1', text);
            
            // 텍스트 교체
            element.value = element.value.substring(0, start) + 
                            formattedText + 
                            element.value.substring(end);
            
            // 선택 영역 업데이트
            const newEnd = start + formattedText.length;
            element.setSelectionRange(start, newEnd);
            
            // 포커스 유지
            element.focus();
            
        } else {
            // contenteditable 요소의 경우
            if (className) {
                // 스팬 요소 생성 및 클래스 추가
                const span = document.createElement('span');
                span.className = className;
                
                // 선택 영역의 내용을 스팬으로 감싸기
                range.surroundContents(span);
                
            } else {
                // HTML 직접 삽입 (링크 등)
                const formattedText = htmlTemplate.replace('$1', text);
                
                // 임시 요소에 HTML 파싱
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = formattedText;
                const fragment = document.createDocumentFragment();
                
                // 모든 자식 노드를 프래그먼트로 이동
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                
                // 선택 영역 삭제 후 HTML 삽입
                range.deleteContents();
                range.insertNode(fragment);
            }
            
            // 선택 영역 초기화
            document.getSelection().removeAllRanges();
        }
        
        // 툴바 숨김
        hideToolbar();
    }
    
    // 공개 API
    return {
        init,
        getToolbarElement: () => toolbarElement,
        isVisible: () => isToolbarVisible,
        hide: hideToolbar,
        show: () => {
            if (currentSelection) {
                const coords = currentSelection.isTextarea
                    ? getTextareaCoordinates(
                        currentSelection.element, 
                        currentSelection.start, 
                        currentSelection.end
                      )
                    : getSelectionCoordinates(currentSelection.range);
                
                showToolbar(coords);
            }
        }
    };
})(); 