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
    
    // 선택 영역 저장
    let savedRange = null;
    function saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedRange = selection.getRangeAt(0);
            console.log('savedRange:', savedRange);
        }
    }
    function restoreSelection() {
        if (savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRange);
            console.log('restoreSelection:', savedRange);
        }
    }
    // 기본 설정
    const DEFAULT_CONFIG = {
        toolbarOffset: 10, // 선택 영역 위 10px에 툴바 배치
        features: {
            heading: true,
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
            height: rect.height
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
        
        // createToolbar() insert icon button for tag editor 
        if (config.features.heading) {  // 필요에 따라  같은 플래그를 사용할 수 있음
            toolbar.appendChild(createToolbarButton('format_size', 'font size', toggleHeadingLayer));
        }

        // bold
        if (config.features.bold) {
            toolbar.appendChild(createToolbarButton('format_bold', 'bold', applyBold));
        }
        
        // italic
        if (config.features.italic) {
            toolbar.appendChild(createToolbarButton('format_italic', 'italic', applyItalic));
        }
        
        // underline
        if (config.features.underline) {
            toolbar.appendChild(createToolbarButton('format_underlined', 'underline', applyUnderline));
        }
        
        // strikethrough
        if (config.features.strikethrough) {
            toolbar.appendChild(createToolbarButton('strikethrough_s', 'strike', applyStrikethrough));
        }
        
        // 구분선 추가
        toolbar.appendChild(createToolbarSeparator());
        
        // code
        if (config.features.code) {
            toolbar.appendChild(createToolbarButton('code', 'code', applyCode));
        }
        
        // link
        if (config.features.link) {
            toolbar.appendChild(createToolbarButton('link', 'link', applyLink));
        }
        
        // 구분선 추가
        toolbar.appendChild(createToolbarSeparator());
        
        // clear
        if (config.features.clear) {
            toolbar.appendChild(createToolbarButton('format_clear', 'clear format', clearFormatting));
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
        if (tbLeft < window.scrollX + 10) {
            tbLeft = window.scrollX + 10;
        }
        if (tbLeft + tbWidth > window.scrollX + window.innerWidth - 10) {
            tbLeft = window.scrollX + window.innerWidth - tbWidth - 10;
        }
        if (tbTop < window.scrollY + 10) {
            tbTop = rect.bottom + 10 + window.scrollY;
        }
        
        toolbarElement.style.left = `${tbLeft}px`;
        toolbarElement.style.top = `${tbTop}px`;
        toolbarElement.style.position = 'absolute';
        toolbarElement.style.zIndex = '9999';
        
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
        if (toolbarElement && toolbarElement.contains(event.target)) {
            event.stopPropagation();
            return;
        }

        // heading 레이어가 열려 있으면, 클릭한 대상이 heading 레이어 내부에 있지 않으면 숨김
        if (headingLayer && headingLayer.style.display !== 'none' && !headingLayer.contains(event.target)) {
            headingLayer.style.display = 'none';
        }
        
        if (editorElements.some(el => el.contains(event.target))) {
            return;
        }
        hideToolbar();
    }

    /**
     * Heading layer create
     */
    let headingLayer = null;

    // Heading 레이어 생성 함수
    function createHeadingLayer() {
        const layer = document.createElement('div');
        layer.className = 'heading-layer';
        // 기본 스타일 (추후 CSS 파일로 분리 가능)
        layer.style.position = 'absolute';
        layer.style.backgroundColor = '#ffffff';
        layer.style.border = '1px solid #e2e8f0';
        layer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        layer.style.padding = '4px';
        layer.style.display = 'none';
        layer.style.zIndex = '10000';

        // 각 옵션에 적용할 폰트 크기 (기본 HTML heading 태그 크기에 맞춤)
        const fontSizes = {
            h1: '2em',
            h2: '1.5em',
            h3: '1.17em',
            p: '1em'
        };
        // 옵션 목록 생성
        const options = [
            { label: 'H1', value: 'h1' },
            { label: 'H2', value: 'h2' },
            { label: 'H3', value: 'h3' },
            { label: 'Text', value: 'p' } // 일반 텍스트
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.textContent = opt.label;
            item.style.padding = '4px 8px';
            item.style.cursor = 'pointer';
            if (fontSizes[opt.value]) {
                item.style.fontSize = fontSizes[opt.value];
            }
            item.addEventListener('click', () => {
                // contenteditable 요소에 포커스 재설정
                if (savedRange) {
                    // 저장된 범위의 시작 노드의 부모 요소에 포커스를 줍니다.
                    savedRange.startContainer.parentElement.focus();
                    restoreSelection();
                }
                const tag = `<${opt.value}>`; // 태그 이름만 전달 (h1, h2, h3, p)  `<${opt.value}>`; or <${opt.value}>

                console.log('tag:', tag);
                console.log('Current range:', savedRange);
                console.log('Format tag:', tag);
                const result = document.execCommand("formatBlock", false, tag);
                console.log('execCommand result:', result);
                layer.style.display = 'none';
            });
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = '#f7fafc';
            });
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = '#ffffff';
            });
            layer.appendChild(item);
        });

        document.body.appendChild(layer);
        return layer;
    }

    // Heading 버튼 클릭 시 호출되는 토글 함수
    function toggleHeadingLayer(event) {
        event.stopPropagation();  // 클릭 이벤트 버블링 방지
        saveSelection();

        if (!headingLayer) {
            headingLayer = createHeadingLayer();
        }
        // 레이어 보이기/숨기기
        if (headingLayer.style.display === 'none' || headingLayer.style.display === '') {
            // 버튼 위치에 따라 레이어 위치 조정
            const rect = event.target.getBoundingClientRect();
            headingLayer.style.top = `${rect.bottom + window.scrollY}px`;
            headingLayer.style.left = `${rect.left + window.scrollX}px`;
            headingLayer.style.display = 'block';
        } else {
            headingLayer.style.display = 'none';
        }
    }
    
    // ---------------------------
    // 서식 적용 함수 (execCommand 사용)
    // ---------------------------
    
    function applyBold() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        document.execCommand("bold", false, null);
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    function applyItalic() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        document.execCommand("italic", false, null);
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    function applyUnderline() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        document.execCommand("underline", false, null);
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    function applyStrikethrough() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        document.execCommand("strikeThrough", false, null);
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    // code 태그는 execCommand 지원 없음 → 기존 custom 토글 사용
    function applyCode() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
        const existingCode = container.closest('code');
        if (existingCode && existingCode.contains(range.commonAncestorContainer)) {
            const parent = existingCode.parentNode;
            while (existingCode.firstChild) {
                parent.insertBefore(existingCode.firstChild, existingCode);
            }
            parent.removeChild(existingCode);
        } else {
            const newElement = document.createElement('code');
            // 여기서 editor-code 클래스를 추가
            newElement.className = 'editor-code';
            try {
                range.surroundContents(newElement);
            } catch (e) {
                console.error("Code wrapping failed:", e);
            }
        }
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    function applyLink() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        const selection = window.getSelection();
        if (selection.anchorNode) {
            let parent = selection.anchorNode.parentNode;
            if (parent && parent.tagName && parent.tagName.toLowerCase() === 'a') {
                document.execCommand("unlink", false, null);
                toolbarElement.style.top = `${currentTop}px`;
                toolbarElement.style.left = `${currentLeft}px`;
                return;
            }
        }
        const url = prompt('링크 URL을 입력하세요:', 'https://');
        if (url) {
            document.execCommand("createLink", false, url);
        }
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    function clearFormatting() {
        const currentTop = parseInt(toolbarElement.style.top);
        const currentLeft = parseInt(toolbarElement.style.left);
        // inline 서식 및 링크 제거
        document.execCommand("removeFormat", false, null);
        document.execCommand("unlink", false, null);
        // 블록 레벨 서식을 paragraph로 변환 (heading 태그 제거)
        // 일부 브라우저에서는 "P" (대문자)를 전달해야 합니다.
        document.execCommand("formatBlock", false, "P");
        toolbarElement.style.top = `${currentTop}px`;
        toolbarElement.style.left = `${currentLeft}px`;
    }
    
    // 공개 API (외부에서 init, hide 함수만 사용)
    return {
        init,
        hide: hideToolbar
    };
})();