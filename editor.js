/**
 * FloatingEditor - 독립형 웹 에디터 플러그인
 * 
 * 이 플러그인은 어떤 웹페이지에도 쉽게 통합할 수 있는 독립형 리치 텍스트 에디터를 제공합니다.
 * 텍스트 선택 시 플로팅 툴바가 나타나며, 사용자는 선택한 텍스트에 서식을 적용할 수 있습니다.
 */

const FloatingEditor = (function() {
    // 프라이빗 변수
    let editorElements = [];
    let toolbarElement = null;
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
        
        // contenteditable 요소에만 에디터 기능 적용
        elements.forEach(element => {
            if (element && !editorElements.includes(element) && element.hasAttribute('contenteditable')) {
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
        if (element.hasAttribute('contenteditable')) {
            element.addEventListener('mouseup', handleTextSelection);
            element.addEventListener('keyup', handleTextSelection);
            element.addEventListener('dblclick', handleTextSelection);
        }
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
        
        // 선택 영역의 위치 계산 및 툴바 표시
        const position = getSelectionPosition(element);
        showToolbar(position);
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
     * 선택 영역의 위치 계산
     * @param {Element} element - 선택이 발생한 요소
     * @returns {Object} 위치 정보 (top, left)
     */
    function getSelectionPosition(element) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return { top: 0, left: 0 };
        }
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 선택 영역 중앙에 툴바 배치
        const lineHeight = parseInt(getComputedStyle(element).lineHeight) || parseInt(getComputedStyle(element).fontSize) || 20;
        
        return {
            top: rect.top + window.scrollY - (lineHeight / 2),
            left: rect.left + (rect.width / 2) + window.scrollX,
            width: rect.width,
            height: rect.height,
            debug: {
                selectionTop: Math.round(rect.top),
                selectionLeft: Math.round(rect.left),
                selectionWidth: Math.round(rect.width),
                selectionHeight: Math.round(rect.height),
                lineHeight
            }
        };
    }
    
    /**
     * 텍스트의 너비 계산
     * @param {string} text - 너비를 계산할 텍스트
     * @param {Element} element - 스타일 참조용 요소
     * @returns {number} 텍스트 너비
     */
    function getTextWidth(text, element) {
        // 임시 캔버스를 사용하여 텍스트 너비 계산
        const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
        const context = canvas.getContext('2d');
        
        // 요소의 폰트 스타일 적용
        const fontStyle = getComputedStyle(element);
        context.font = `${fontStyle.fontSize} ${fontStyle.fontFamily}`;
        
        // 텍스트 너비 계산 및 패딩 고려
        const metrics = context.measureText(text);
        const paddingLeft = parseInt(fontStyle.paddingLeft) || 0;
        
        return metrics.width + paddingLeft;
    }
    
    /**
     * 툴바 생성 함수
     */
    function createToolbar() {
        // 툴바 컨테이너 생성
        toolbarElement = document.createElement('div');
        toolbarElement.className = 'floating-editor';
        toolbarElement.style.height = '36px'; // 툴바 높이를 36px로 고정
        toolbarElement.style.margin = '0'; // 마진 제거
        toolbarElement.style.padding = '0'; // 패딩 제거
        toolbarElement.style.boxSizing = 'border-box'; // 박스 사이징 설정
        toolbarElement.style.display = 'flex'; // 플렉스 레이아웃 사용
        toolbarElement.style.alignItems = 'center'; // 세로 중앙 정렬
        toolbarElement.style.justifyContent = 'center'; // 가로 중앙 정렬
        toolbarElement.style.overflow = 'visible'; // 오버플로우 허용
        
        // 디버그 정보 요소 생성
        const debugInfo = document.createElement('div');
        debugInfo.className = 'floating-editor-debug';
        debugInfo.style.position = 'absolute';
        debugInfo.style.top = '-20px';
        debugInfo.style.left = '0';
        debugInfo.style.width = '100%';
        debugInfo.style.textAlign = 'center';
        debugInfo.style.fontSize = '10px';
        debugInfo.style.fontFamily = 'monospace';
        debugInfo.style.color = '#666';
        debugInfo.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        debugInfo.style.padding = '2px';
        debugInfo.style.borderRadius = '3px';
        debugInfo.style.whiteSpace = 'nowrap';
        
        // 툴바 내부 요소 생성
        const toolbar = document.createElement('div');
        toolbar.className = 'floating-editor-toolbar';
        toolbar.style.height = '36px'; // 툴바 내부 요소 높이도 36px로 고정
        toolbar.style.margin = '0'; // 마진 제거
        toolbar.style.padding = '0'; // 패딩 제거
        toolbar.style.display = 'flex'; // 플렉스 레이아웃 사용
        toolbar.style.alignItems = 'center'; // 세로 중앙 정렬
        toolbar.style.justifyContent = 'center'; // 가로 중앙 정렬
        toolbar.style.boxSizing = 'border-box'; // 박스 사이징 설정
        toolbar.style.width = '100%'; // 너비 100%로 설정
        
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
        button.style.height = '36px'; // 버튼 높이를 36px로 고정
        button.style.width = '36px'; // 버튼 너비를 36px로 고정
        button.style.padding = '0'; // 패딩 제거
        button.style.margin = '0'; // 마진 제거
        button.style.border = 'none'; // 테두리 제거
        button.style.display = 'flex'; // 플렉스 레이아웃 사용
        button.style.alignItems = 'center'; // 세로 중앙 정렬
        button.style.justifyContent = 'center'; // 가로 중앙 정렬
        button.style.boxSizing = 'border-box'; // 박스 사이징 설정
        button.style.flexShrink = '0'; // 축소 방지
        
        // 아이콘 요소 생성 및 스타일 적용
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = icon;
        iconElement.style.fontSize = '24px'; // 아이콘 크기 설정
        iconElement.style.lineHeight = '1'; // 라인 높이 조정
        
        // 아이콘을 버튼에 추가
        button.appendChild(iconElement);
        
        // 클릭 이벤트 리스너 추가
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
        separator.style.height = '24px'; // 구분선 높이 설정
        separator.style.width = '1px'; // 구분선 너비 설정
        separator.style.margin = '0 4px'; // 좌우 마진만 설정
        separator.style.padding = '0'; // 패딩 제거
        separator.style.boxSizing = 'border-box'; // 박스 사이징 설정
        separator.style.flexShrink = '0'; // 축소 방지
        return separator;
    }
    
    /**
     * 툴바 표시 함수
     * @param {Object} position - 위치 정보 (top, left)
     */
    function showToolbar(position) {
        if (!toolbarElement) return;
        
        // 툴바 크기 정보
        const toolbarRect = toolbarElement.getBoundingClientRect();
        const tbWidth = toolbarRect.width;
        const tbHeight = 36; // 툴바 높이를 36px로 고정
        
        // 선택 영역 정보 가져오기
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 툴바 위치 계산 (선택 영역 중앙)
        let tbLeft = rect.left + (rect.width / 2) - (tbWidth / 2) + window.scrollX;
        let tbTop = rect.top - tbHeight - 10 + window.scrollY; // 10px 위에 배치
        
        // 화면 경계 처리
        // 왼쪽 경계
        if (tbLeft < window.scrollX + 10) {
            tbLeft = window.scrollX + 10;
        }
        
        // 오른쪽 경계
        if (tbLeft + tbWidth > window.scrollX + window.innerWidth - 10) {
            tbLeft = window.scrollX + window.innerWidth - tbWidth - 10;
        }
        
        // 상단 경계 처리
        if (tbTop < window.scrollY + 10) {
            // 선택 영역 아래에 툴바 표시
            tbTop = rect.bottom + 10 + window.scrollY;
        }
        
        // 툴바 위치 설정
        toolbarElement.style.left = `${tbLeft}px`;
        toolbarElement.style.top = `${tbTop}px`;
        toolbarElement.style.position = 'absolute';
        toolbarElement.style.zIndex = '9999';
        
        // 디버그 정보 업데이트
        const debugInfo = toolbarElement.querySelector('.floating-editor-debug');
        if (debugInfo) {
            debugInfo.textContent = `Selection(${Math.round(rect.left)}, ${Math.round(rect.top)}) Width: ${Math.round(rect.width)} Height: ${Math.round(rect.height)}`;
        }
        
        // 툴바 표시
        toolbarElement.classList.add('visible');
        isToolbarVisible = true;
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
     * 서식 적용 함수 - 굵게
     */
    function applyBold() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 bold 태그가 적용되어 있는지 확인
        const hasBoldTag = tempDiv.querySelector('b, strong') !== null;

        if (hasBoldTag) {
            // bold 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutBold(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 'b' || node.tagName.toLowerCase() === 'strong') {
                        // bold 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutBold(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutBold(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutBold(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // bold 태그 추가
            range.deleteContents();
            const boldElement = document.createElement('b');
            boldElement.innerHTML = tempDiv.innerHTML;
            range.insertNode(boldElement);

            // 선택 영역 설정
            const newRange = document.createRange();
            newRange.selectNodeContents(boldElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 적용 함수 - 기울임
     */
    function applyItalic() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 italic 태그가 적용되어 있는지 확인
        const hasItalicTag = tempDiv.querySelector('i, em') !== null;

        if (hasItalicTag) {
            // italic 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutItalic(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 'i' || node.tagName.toLowerCase() === 'em') {
                        // italic 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutItalic(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutItalic(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutItalic(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // italic 태그 추가
            range.deleteContents();
            const italicElement = document.createElement('i');
            italicElement.innerHTML = tempDiv.innerHTML;
            range.insertNode(italicElement);

            // 선택 영역 설정
            const newRange = document.createRange();
            newRange.selectNodeContents(italicElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 적용 함수 - 밑줄
     */
    function applyUnderline() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 underline 태그가 적용되어 있는지 확인
        const hasUnderlineTag = tempDiv.querySelector('u') !== null;

        if (hasUnderlineTag) {
            // underline 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutUnderline(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 'u') {
                        // underline 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutUnderline(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutUnderline(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutUnderline(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // underline 태그 추가
            range.deleteContents();
            const underlineElement = document.createElement('u');
            underlineElement.innerHTML = tempDiv.innerHTML;
            range.insertNode(underlineElement);

            // 선택 영역 설정
            const newRange = document.createRange();
            newRange.selectNodeContents(underlineElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 적용 함수 - 취소선
     */
    function applyStrikethrough() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 strikethrough 태그가 적용되어 있는지 확인
        const hasStrikeTag = tempDiv.querySelector('s, strike, del') !== null;

        if (hasStrikeTag) {
            // strikethrough 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutStrike(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 's' || 
                        node.tagName.toLowerCase() === 'strike' || 
                        node.tagName.toLowerCase() === 'del') {
                        // strikethrough 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutStrike(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutStrike(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutStrike(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // strikethrough 태그 추가
            range.deleteContents();
            const strikeElement = document.createElement('s');
            strikeElement.innerHTML = tempDiv.innerHTML;
            range.insertNode(strikeElement);

            // 선택 영역 설정
            const newRange = document.createRange();
            newRange.selectNodeContents(strikeElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 적용 함수 - 코드
     */
    function applyCode() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치와 선택 영역 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 code 태그가 적용되어 있는지 확인
        const hasCodeTag = tempDiv.querySelector('code') !== null;

        if (hasCodeTag) {
            // code 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutCode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 'code') {
                        // code 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutCode(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutCode(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutCode(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // code 태그 추가
            range.deleteContents();
            const codeElement = document.createElement('code');
            codeElement.innerHTML = tempDiv.innerHTML;
            range.insertNode(codeElement);

            // 선택 영역 설정
            const newRange = document.createRange();
            newRange.selectNodeContents(codeElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 적용 함수 - 링크
     */
    function applyLink() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;

        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);

        // 선택된 영역의 본사본 저장
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // 이미 link 태그가 적용되어 있는지 확인
        const hasLinkTag = tempDiv.querySelector('a') !== null;

        if (hasLinkTag) {
            // link 태그 제거
            const plainText = document.createDocumentFragment();
            function extractTextWithoutLink(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText.appendChild(node.cloneNode(true));
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName.toLowerCase() === 'a') {
                        // link 태그 내부의 콘텐츠만 추출
                        Array.from(node.childNodes).forEach(child => extractTextWithoutLink(child));
                    } else {
                        // 다른 태그는 유지
                        const clone = node.cloneNode(false);
                        Array.from(node.childNodes).forEach(child => {
                            extractTextWithoutLink(child);
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                Array.from(plainText.childNodes).forEach(extracted => clone.appendChild(extracted.cloneNode(true)));
                                plainText.textContent = '';
                            }
                        });
                        if (clone.hasChildNodes()) {
                            plainText.appendChild(clone);
                        }
                    }
                }
            }

            Array.from(tempDiv.childNodes).forEach(node => extractTextWithoutLink(node));
            
            // 원래 내용 삽입
            range.deleteContents();
            range.insertNode(plainText);

            // 선택 영역 복원
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // link 태그 추가
            const url = prompt('링크 URL을 입력하세요:', 'https://');
            if (url) {
                range.deleteContents();
                const linkElement = document.createElement('a');
                linkElement.href = url;
                linkElement.innerHTML = tempDiv.innerHTML;
                range.insertNode(linkElement);

                // 선택 영역 설정
                const newRange = document.createRange();
                newRange.selectNodeContents(linkElement);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }

        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    /**
     * 서식 지우기 함수
     */
    function clearFormatting() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        if (!selectedText) return;
        
        // 현재 툴바 위치 저장
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        
        // 선택된 텍스트를 본사하여 처리
        const rangeClone = range.cloneRange();
        const fragment = rangeClone.extractContents();
        
        // 순수 텍스트만 추출
        const plainText = document.createTextNode(fragment.textContent);
        
        // 원래 내용 삽입
        range.deleteContents();
        range.insertNode(plainText);
        
        // 선택 영역 복원
        const newRange = document.createRange();
        newRange.setStart(plainText, 0);
        newRange.setEnd(plainText, plainText.textContent.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // 툴바 위치 유지
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    

    
    // 공개 API
    return {
        init,
        hide: hideToolbar
    };
})(); 