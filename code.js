var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { selection } = figma.currentPage;
const nodes = [];
function getStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        figma.root.children.flatMap((pageNode) => pageNode.selection.forEach((node) => __awaiter(this, void 0, void 0, function* () {
            const frame = figma.createFrame();
            frame.name = node.name;
            if (node.cornerRadius !== figma.mixed) {
                frame.cornerRadius = node.cornerRadius;
            }
            else {
                frame.topLeftRadius = node.topLeftRadius;
                frame.topRightRadius = node.topRightRadius;
                frame.bottomLeftRadius = node.bottomLeftRadius;
                frame.bottomRightRadius = node.bottomRightRadius;
            }
            if (node.type === "ELLIPSE") {
                frame.cornerRadius = frame.width * 2;
            }
            frame.fills = node.fills;
            frame.strokes = node.strokes;
            frame.strokeWeight = node.strokeWeight;
            frame.resize(node.width, node.height);
            frame.effects = node.effects;
            frame.x = node.x;
            frame.y = node.y;
            nodes.push(frame);
            node.remove();
        })));
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
        return Promise.resolve("Done!");
    });
}
getStyles();
figma.notify("Converted!");
figma.closePlugin();
