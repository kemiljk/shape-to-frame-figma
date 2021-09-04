const { selection } = figma.currentPage;
const nodes: SceneNode[] = [];

async function getStyles(): Promise<String> {
  figma.currentPage.selection.forEach(async (node) => {
    if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
      const frame = figma.createFrame();
      frame.name = node.name;
      if (node.cornerRadius !== figma.mixed) {
        frame.cornerRadius = node.cornerRadius;
      } else {
        frame.topLeftRadius = (node as RectangleNode).topLeftRadius;
        frame.topRightRadius = (node as RectangleNode).topRightRadius;
        frame.bottomLeftRadius = (node as RectangleNode).bottomLeftRadius;
        frame.bottomRightRadius = (node as RectangleNode).bottomRightRadius;
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
    } else if (node.type === "FRAME") {
      const shape = figma.createRectangle();
      shape.name = node.name;
      if (node.cornerRadius !== figma.mixed) {
        shape.cornerRadius = node.cornerRadius;
      } else {
        shape.topLeftRadius = node.topLeftRadius;
        shape.topRightRadius = node.topRightRadius;
        shape.bottomLeftRadius = node.bottomLeftRadius;
        shape.bottomRightRadius = node.bottomRightRadius;
      }
      if (
        node.cornerRadius !== figma.mixed &&
        node.cornerRadius >= node.width * 2
      ) {
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
    }
  });
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  return Promise.resolve("Done!");
}

getStyles();
figma.notify("Converted!");

figma.closePlugin();
