/**
 * Represents Xpath hto an element
 */
class Xpath {
    readonly value: string;
    constructor(value: string) {
        this.value = value;
    }
    /**
     * Returns an element this Xpath can point to
     */
    getElement(): Element {
        // tslint:disable-next-line:no-null-keyword
        const node =  document.evaluate(this.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return (node as Element);
    }
}


/**
 * Handles a specific highlighted text in the DOM
 */
export default class Highlighted {
    readonly elementPath: number[];
    readonly nodeTextIndex: number;
    readonly nodeIndex: number;
    readonly text: string;
    readonly endOffSet: number;
    readonly offset: number;
    readonly version: number | null;
    readonly rootXpath: Xpath;

    private constructor(elementPath: number[], nodeTextIndex: number, nodeIndex: number, text: string, endOffSet: number, offset: number, version: number | null, rootXpath: Xpath) {
        this.elementPath = elementPath;
        this.nodeTextIndex = nodeTextIndex;
        this.nodeIndex = nodeIndex;
        this.text = text;
        this.endOffSet = endOffSet;
        this.offset = offset;
        this.version = version;
        this.rootXpath = rootXpath;
    }

    /**
     * Generate Highlighted instance from json
     * @param json - Json string represents a Highlighted instance
     */
    static fromJson(json: string): Highlighted {
        const obj = JSON.parse(json);
        return new Highlighted(
            obj.elementPath,
            obj.nodeTextIndex,
            obj.nodeIndex,
            obj.text,
            obj.endOffSet,
            obj.offset,
            obj.version,
            new Xpath(obj.rootXpath.value)
        );
    }

    /**
     * Generate Highlighted instance from a {@link Range | Range}, if range starts and ends in the same node. otherwise undefined
     * @param range
     * @param rootXpath - {@link Xpath | Xpath} element to serve as root for the Highlighed instance
     * @param version - Optional - the document version
     */
    static fromRange(range: Range, rootXpath: Xpath, version: number | null): Highlighted | undefined {
        if (range.startContainer === range.endContainer) {
            return new Highlighted(
                pathFrom(range.startContainer.parentElement, rootXpath.getElement()),
                nodeTextIndex(range.startContainer, rootXpath.getElement()),
                childNodeIndex(range.startContainer),
                range.toString(),
                range.endOffset,
                range.startOffset,
                version,
                rootXpath
            );
        }
    }


    /**
     * Generate Highlighted instance from a {@link Selection | Selection}, if selection starts and ends in the same node. otherwise undefined
     * @param selection
     * @param rootXpath - {@link Xpath | Xpath} element to serve as root for the Highlighed instance
     * @param version - Optional - the document version
     */
    static fromSelection(selection: Selection, rootXpath: Xpath, version: number | null): Highlighted | undefined {
        if (selection.rangeCount > 1) throw new Error("can not comment multiple ranges");
        else return Highlighted.fromRange(selection.getRangeAt(0), rootXpath, version);
    }

    /**
     * Creates a range from the Highlighted instance
     * @param @todo locationTolerance - Optional. set tolerance for variations in the location of the highlighted string
     * @param @todo stringTolerance - Optional. set tolerance for variations in the highlighted string
     */
    public toRange(locationTolerance = 0, stringTolerance = 0): Range {
        const range = document.createRange();
        const node = elementFromPath(this.rootXpath.getElement(), this.elementPath).childNodes[this.nodeIndex];
        range.setStart(node, this.offset);
        range.setEnd(node, this.endOffSet);
        return range;
    }
}

/**
 * Returns the element position among it's siblings
 * @param elem - A DOM element
 */
export function childElementIndex(elem: Element): number {
    return !elem.previousElementSibling ? 0 : 1 + childElementIndex(elem.previousElementSibling);
}

/**
 * Returns the node position among it's siblings
 * @param node - a DOM node
 */
export function childNodeIndex(node: Node): number {
    return !node.previousSibling ? 0 : 1 + childNodeIndex(node.previousSibling);
}

/**
 * Builds a naive path as a vector of positions inside a root element
 * @param elem - The DOM element to build a path to
 * @param root - The DOM element to build a path from
 * @returns - Vector of relative positions from root to elem
 */
export function pathFrom(elem: Element | null, root: Element): number[] {
    if (elem === root) return [];
    if (elem === null) return [];
    else return (pathFrom(elem.parentElement, root)).concat([childElementIndex(elem)]);
}

/**
 * Extract the element at a specific path build with {@link pathFrom | pathFrom}
 * @param root - Root element from which the path starts
 * @param path - Vector of relative positions from root
 * @returns - The element at the specified path
 */
export function elementFromPath(root: Element, path: number[]): Element {
    if (path.length === 0) return root;
    else return elementFromPath(root.children[path[0]], path.slice(1, path.length));
}



function nodeListToArray(nodeList: NodeList): Node[] {
    const nodeArray: Node[] = [];
    nodeList.forEach(node => nodeArray.push(node));
    return nodeArray;
}

/**
 * Where a specific node is located in the root node text
 * @param node - The node we want the location of
 * @param root - the node we start the search from
 * @returns - a number indicating the position in the text of the root node, at which out node starts
 */
function nodeTextIndex(node: Node, root: Node): number {
    if (node === root) return 0;
    else {
        const childNodesArray = nodeListToArray(root.childNodes).filter(node =>
            node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE);
        const nextAnc: Node = childNodesArray.filter(n => n.contains(node)).pop()!;
        return childNodesArray
            .slice(0, childNodesArray.indexOf(nextAnc))
            .reduce((acc: number, n: Node) => acc + getText(n).length, 0)
            + nodeTextIndex(node, nextAnc);
    }
}

/**
 * What node contains the text at a specific index, relative to a root node
 * @param index - position in the text of root node
 * @param root - root node to start the search from
 * @returns - tuple of the node that contains this text index, and a number representing the offset of the position from the beggining of the node
 */
export function nodeAt(index: number, root: Node): [Node, number] {
    if (root.nodeType === Node.TEXT_NODE) return [root, index];
    else {
        const [newIndex, child] = getChildWithIndex(index, (root as Element));
        return nodeAt(newIndex, child);
    }
}

/**
 * From the immediate children of an element, get the child that contains the position in the element's text specified by index
 * @param index - position in text of parent element
 * @param root - element to search in
 * @returns - a tuple of the immediate child node that contains the position in the root text, and a number representing the offset of the position from start of node
 */
function getChildWithIndex(index: number, root: Element, childN = 0): [number, Node] {
    const childNodesArray = nodeListToArray(root.childNodes).filter(node =>
        node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE);
    const childLength = getText(childNodesArray[childN]).length;
    if (index < childLength) return [index, childNodesArray[childN]];
    else return getChildWithIndex(index - childLength, root, childN + 1);
}


/**
 * Get the full text of the node
 */
export function getText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node as Text).data;
    else return nodeListToArray(node.childNodes).reduce((acc: string, n: Node) => acc + getText(n), "");
}

function searchAll(str: string, searchTerm: string): number[] {
    const result: number[] = [];
    const regexp = new RegExp(searchTerm, "gi");
    let regexResult: RegExpExecArray | null;
    while (regexResult = regexp.exec(str)) result.push(regexResult.index);
    return result;
}

/**
 * DOM node where a search term is present
 * @param root - node to start the search from
 * @param searchTerm - the string to search
 * @param position - what occurence of the string we need
 * @returns tuple of the node containing the search term and a number representing the offset from the beggining of the node
 */
export function locateTerm(root: Node, searchTerm: string, position: number): [Node, number] {
    const nodeText = getText(root);
    const termIndex = searchAll(nodeText, searchTerm)[position];
    return nodeAt(termIndex, root);
}

/**
 * Given a range, return the index of the range text occurence within a node
 * @param root - Node to start the search in
 * @param range - range to extract text from
 */
export function locateTermIndex(root: Node, range: Range): number {
    const nodeText = getText(root);
    const termIndices = searchAll(nodeText, range.toString());
    const absOffset = nodeTextIndex(range.startContainer, root) + range.startOffset;
    return termIndices.indexOf(absOffset);
}