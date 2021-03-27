const { selection } = figma.currentPage;

async function getStyles(): Promise<String> {
  figma.root.children.flatMap((pageNode) =>
    pageNode.selection.forEach(async (node) => {
      const frame = figma.createFrame();
      frame.name = node.name;
      if (node.cornerRadius !== figma.mixed) {
        frame.cornerRadius = node.cornerRadius;
      } else {
        frame.topLeftRadius = node.topLeftRadius;
        frame.topRightRadius = node.topRightRadius;
        frame.bottomLeftRadius = node.bottomLeftRadius;
        frame.bottomRightRadius = node.bottomRightRadius;
      }
      frame.fills = node.fills;
      frame.strokes = node.strokes;
      frame.strokeWeight = node.strokeWeight;
      frame.resize(node.width, node.height);
      frame.effects = node.effects;
      frame.x = node.x;
      frame.y = node.y;
      node.remove();
      if (node.type === "ELLIPSE") {
        frame.cornerRadius = frame.width * 2;
      }
    })
  );
  return Promise.resolve("Done!");
}

getStyles();
figma.notify("Converted!");

figma.closePlugin();