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
        figma.currentPage.selection.forEach((node) => __awaiter(this, void 0, void 0, function* () {
            if (figma.command === "shape-to-frame") {
                if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
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
                    if (node.parent.type === "FRAME" || node.parent.type === "GROUP") {
                        node.parent.insertChild(0, frame);
                        frame.x = node.x;
                        frame.y = node.y;
                    }
                    nodes.push(frame);
                    node.remove();
                    figma.notify("Converted!");
                }
                else {
                    figma.notify("Please select a shape!");
                }
            }
            if (figma.command === "frame-to-shape") {
                if (node.type === "FRAME") {
                    const shape = figma.createRectangle();
                    shape.name = node.name;
                    if (node.cornerRadius !== figma.mixed) {
                        shape.cornerRadius = node.cornerRadius;
                    }
                    else {
                        shape.topLeftRadius = node.topLeftRadius;
                        shape.topRightRadius = node.topRightRadius;
                        shape.bottomLeftRadius = node.bottomLeftRadius;
                        shape.bottomRightRadius = node.bottomRightRadius;
                    }
                    if (node.cornerRadius !== figma.mixed &&
                        node.cornerRadius >= node.width * 2) {
                        shape.cornerRadius = shape.width * 2;
                    }
                    shape.fills = node.fills;
                    shape.strokes = node.strokes;
                    shape.strokeWeight = node.strokeWeight;
                    shape.resize(node.width, node.height);
                    shape.effects = node.effects;
                    shape.x = node.x;
                    shape.y = node.y;
                    if (node.parent.type === "FRAME" || node.parent.type === "GROUP") {
                        node.parent.insertChild(0, shape);
                        shape.x = node.x;
                        shape.y = node.y;
                    }
                    nodes.push(shape);
                    node.remove();
                    figma.notify("Converted!");
                }
                else {
                    figma.notify("Please select a Frame!");
                }
            }
            if (figma.command === "shape-to-al-frame") {
                if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
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
                    frame.layoutMode = "HORIZONTAL";
                    frame.itemSpacing = 8;
                    frame.paddingTop = 0;
                    frame.paddingLeft = 0;
                    frame.paddingBottom = 0;
                    frame.paddingRight = 0;
                    if (node.parent.type === "FRAME" || node.parent.type === "GROUP") {
                        node.parent.insertChild(0, frame);
                        frame.x = node.x;
                        frame.y = node.y;
                    }
                    nodes.push(frame);
                    node.remove();
                    figma.notify("Converted!");
                }
                else {
                    figma.notify("Please select a Frame!");
                }
            }
        }));
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
        return Promise.resolve("Done!");
    });
}
getStyles();
figma.closePlugin();
